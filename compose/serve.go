package compose

import (
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
)

// Shared registers the root-relative URLs no app owns.
func Shared(paths ...string) Option {
	return func(s *Set) { s.shared = append(s.shared, paths...) }
}

// HandlerOptions configures a handler beyond the set and the rules.
type HandlerOptions struct {
	// Listener names which listener this handler answers on. Empty means the
	// web listener. The installer's is why this exists: one engine, two
	// processes, and each must serve only the apps assigned to it.
	Listener string
	// Principal resolves the caller. Nil means every caller is anonymous,
	// which is the correct default and what the standalone CLI uses.
	Principal PrincipalFunc
	// Shell rewrites an app's index.html ONCE, at construction.
	//
	// The engine has no opinion about what a host puts in a shell, and must not
	// — injecting a runtime config object is exactly the kind of product
	// concern that would drag a host's config type into this module. But the
	// hook has to exist, because a host that cannot touch the shell cannot ship
	// a single-page app that needs anything from the server at boot.
	//
	// Applied at construction and not per request on purpose: it is the same
	// bytes for every caller, and doing it per request would put a JSON marshal
	// and a byte-slice search on the hot path of every page load.
	Shell func(app App, index []byte) []byte
	// Unbuilt answers a declared app that has no bundle, replacing the engine's
	// own development diagnostic.
	//
	// It exists because a host can have a better answer than a diagnostic. In
	// a typical hot-dev loop the bundle is deliberately absent — Vite is
	// serving it on another port — and the right response is a redirect back to
	// that port carrying the whole request URI, because the OIDC callback IS its
	// query string and a sign-in that lands on a diagnostic completes nothing.
	//
	// Nil keeps the built-in diagnostic, which is what the standalone CLI wants.
	Unbuilt http.Handler
	// DevTools is the dev console bundle. Set, DevNamespace answers the app
	// index and the console's script, and — when the bundle holds that script —
	// every page this handler renders boots the console. Nil, none of it
	// exists. The host decides when it is development.
	DevTools fs.FS
}

// Handler serves every app in the set, applying visibility per request.
//
// A plain http.Handler and not a framework's: the host adapts it at its own
// edge with one line. That is what lets the same code serve a gin
// listener, the installer's bare net/http listener, and the standalone CLI
// without any of them being special.
func Handler(set Set, h *Holder, opts HandlerOptions) http.Handler {
	listener := opts.Listener
	if listener == "" {
		listener = WebListener
	}
	rt := newRouter(set, listener, set.shared)
	dev := opts.DevTools
	shell := opts.Shell
	if dev != nil && hasDevScript(dev) {
		shell = withDevTools(shell)
	}
	rendered := buildPages(rt, shell)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// No URL of ours reaches another site, yet one app can still tell which
		// of our pages sent a visitor: BREACH reads the stepper's to skip its
		// start screen. `no-referrer` would break that.
		w.Header().Set("Referrer-Policy", "same-origin")
		var p Principal
		if opts.Principal != nil {
			p = opts.Principal(r)
		}
		urlPath := cleanPath(r.URL.Path)

		if dev != nil && underPrefix(urlPath, DevNamespace) {
			serveDevTools(w, r, dev, rt, h.Current(), p, urlPath)
			return
		}

		d := rt.Resolve(r.Context(), h.Current(), hostOf(r, h.Current()), urlPath, p)
		if d.Outcome == OutcomeUnbuilt && opts.Unbuilt != nil {
			opts.Unbuilt.ServeHTTP(w, r)
			return
		}
		if d.Outcome != OutcomeServe {
			d.WriteRefusal(w, r)
			return
		}
		serveApp(w, r, *d.App, urlPath, rendered[d.App.Name], opts.Unbuilt, d)
	})
}

// cleanPath normalises a request path before any matching happens.
//
// path.Clean resolves "." and ".." segments, which is what stops
// "/showcase/../_apps/console/x" from reaching the console's namespace through
// the showcase claim. Doing it once, here, means every matcher downstream can
// compare literally.
func cleanPath(p string) string {
	if p == "" {
		return "/"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	cleaned := path.Clean(p)
	if strings.HasSuffix(p, "/") && cleaned != "/" {
		cleaned += "/"
	}
	return cleaned
}

// pages is one app's HTML, rendered through the host's shell hook at
// construction and keyed by bundle-relative name.
//
// Every .html file and not just the shell, because a bundle may be partly
// PRERENDERED: `/privacy` ships as `privacy.html` with the copy already in it,
// which is the only version of that page a crawler or a link-preview scraper
// will ever see. Those files need the host's injection exactly as much as the
// shell does — a prerendered page served raw is a page with no runtime config,
// typically meaning no feature flags and no site-verification tag.
type pages struct {
	byName map[string][]byte
	// shell is the key in byName to answer an unmatched path with: the file the
	// client router boots from.
	shell string
	// build names the bundle every page here came from. It rides in each page
	// as BuildMeta and on each HTML response as BuildHeader, so a tab still
	// running the old bundle can tell that a deploy replaced it: its own meta
	// stops matching the header the server now answers with.
	build string
}

// BuildMeta and BuildHeader carry an app's build id; see pages.build.
const (
	BuildMeta   = "compose-build"
	BuildHeader = "X-Compose-Build"
)

// buildID is a hash of the raw shell, before the host's hook. The shell names
// the fingerprinted entry chunks, so it changes whenever the code does; hashing
// it unhooked keeps the id identical on every replica of one image even if a
// host injects per-process config.
//
// ponytail: a bundle that changes only an unfingerprinted file (static/,
// public/) keeps its id. Hash the whole bundle if that ever has to count.
func buildID(shell []byte) string {
	sum := sha256.Sum256(shell)
	return hex.EncodeToString(sum[:6])
}

// shellCandidates are the fallback filenames, most specific first.
//
// `200.html` is the convention static hosts use for an SPA fallback, and an app
// that prerenders its own `/` MUST use it — otherwise the fallback and the
// prerendered front page are the same filename and one silently overwrites the
// other. An app that prerenders nothing keeps index.html and is unaffected.
var shellCandidates = []string{"200.html", "index.html"}

func buildPages(rt *router, fn func(App, []byte) []byte) map[string]pages {
	out := map[string]pages{}
	for name, a := range rt.byName {
		raw := map[string][]byte{}
		for _, rel := range htmlFiles(a.Files) {
			f, _, ok := openFile(a.Files, rel)
			if !ok {
				continue
			}
			body, err := io.ReadAll(f)
			_ = f.Close()
			if err != nil {
				continue
			}
			raw[rel] = body
		}
		p := pages{byName: map[string][]byte{}}
		for _, c := range shellCandidates {
			if _, ok := raw[c]; ok {
				p.shell = c
				break
			}
		}
		// A builtin stands in for a bundle nobody built. It is the installer's
		// zero-build setup page, and it is a shell like any other.
		if p.shell == "" && len(a.Builtin) > 0 {
			p.shell = "index.html"
			raw[p.shell] = a.Builtin
		}
		if p.shell == "" {
			// No shell and no builtin: not built. serveApp reads the absent entry
			// as such and hands the request to the host's Unbuilt handler.
			continue
		}
		p.build = buildID(raw[p.shell])
		meta := []byte(`<meta name="` + BuildMeta + `" content="` + p.build + `">`)
		for rel, body := range raw {
			if fn != nil {
				body = fn(a, body)
			}
			// A page with no head close already failed the host's own injection,
			// which is where that gets reported.
			p.byName[rel], _ = InjectBeforeHeadClose(body, meta)
		}
		out[name] = p
	}
	return out
}

// htmlFiles lists every .html in a bundle, bundle-relative.
//
// Walked rather than probed for known names because which pages a build chose
// to prerender is the BUILD's decision, not this engine's — the whole point is
// that turning prerendering on for another route needs no change here.
func htmlFiles(fsys fs.FS) []string {
	if fsys == nil {
		return nil
	}
	var out []string
	_ = fs.WalkDir(fsys, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(p, ".html") {
			return nil
		}
		out = append(out, p)
		return nil
	})
	return out
}

func serveApp(w http.ResponseWriter, r *http.Request, a App, urlPath string, p pages, unbuilt http.Handler, d Decision) {
	rel := bundleRelative(a, urlPath)

	// HTML is served from the rendered copies, never from the bundle directly.
	// Otherwise the most common request on the site — "/" — resolves to
	// index.html as an ordinary FILE and silently skips whatever the host
	// injected into it, while a deep link like /overview gets the injected copy
	// via the fallback below. The bug that produces is maddening: the app works
	// on every route except the one everybody lands on.
	if body, ok := p.byName[rel]; ok {
		writeShell(w, body, p.build)
		return
	}

	// A PRERENDERED page: /privacy is `privacy.html` in the bundle. Ahead of the
	// shell fallback, because both would answer and only this one carries the
	// page's actual copy — which is the entire reason the page was prerendered.
	if body, ok := p.byName[rel+".html"]; ok {
		writeShell(w, body, p.build)
		return
	}

	if f, info, ok := openFile(a.Files, rel); ok {
		defer f.Close()
		writeAsset(w, r, a.Files, rel, f, info, true)
		return
	}

	// An asset miss under an app's OWN namespace is a real miss, not a route
	// for the client router: nothing good is served by handing index.html to
	// something that asked for a stylesheet. It also has to be refused
	// identically to any other miss, or the difference maps the bundle.
	if a.AssetPrefix != "" && underPrefix(urlPath, a.AssetPrefix) {
		d.Outcome = OutcomeRefuse
		d.WriteRefusal(w, r)
		return
	}

	if body, ok := p.byName[p.shell]; ok {
		writeShell(w, body, p.build)
		return
	}

	if unbuilt != nil {
		unbuilt.ServeHTTP(w, r)
		return
	}
	d.Outcome = OutcomeUnbuilt
	d.App = &a
	d.WriteRefusal(w, r)
}

// writeShell writes an app's rendered index.html.
//
// Never cached: a cached shell serves a browser the previous index.html against
// this deploy's fingerprinted assets, which looks like a random front-end bug
// and is not one.
func writeShell(w http.ResponseWriter, shell []byte, build string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set(BuildHeader, build)
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(shell)
}

// bundleRelative maps a URL to a path inside the app's bundle.
//
// Both the mount prefix and the asset namespace are stripped, because a bundle
// is built rooted at itself and knows nothing about where it was mounted.
func bundleRelative(a App, urlPath string) string {
	p := urlPath
	if a.AssetPrefix != "" && underPrefix(p, a.AssetPrefix) {
		p = strings.TrimPrefix(p, strings.TrimSuffix(a.AssetPrefix, "/"))
	} else if a.Path != "/" {
		p = strings.TrimPrefix(p, strings.TrimSuffix(a.Path, "/"))
	}
	p = strings.TrimPrefix(p, "/")
	if p == "" || strings.HasSuffix(p, "/") {
		p += "index.html"
	}
	return p
}

// openFile opens a bundle file, or decodes its gzip sidecar when the build kept
// only that (assetenc's DropOriginals).
func openFile(fsys fs.FS, name string) (fs.File, fs.FileInfo, bool) {
	if f, info, ok := openPlain(fsys, name); ok {
		return f, info, true
	}
	gz, info, ok := openPlain(fsys, name+".gz")
	if !ok {
		return nil, nil, false
	}
	zr, err := gzip.NewReader(gz)
	if err != nil {
		_ = gz.Close()
		return nil, nil, false
	}
	return gunzipFile{Reader: zr, gz: gz, info: info}, info, true
}

// gunzipFile reads a sidecar back as its original. Not a ReadSeeker, so
// serveFile streams it whole; its info is the sidecar's, which nothing on that
// path reads.
type gunzipFile struct {
	*gzip.Reader
	gz   fs.File
	info fs.FileInfo
}

func (g gunzipFile) Stat() (fs.FileInfo, error) { return g.info, nil }

func (g gunzipFile) Close() error {
	_ = g.Reader.Close()
	return g.gz.Close()
}

func openPlain(fsys fs.FS, name string) (fs.File, fs.FileInfo, bool) {
	if fsys == nil || !fs.ValidPath(name) {
		return nil, nil, false
	}
	f, err := fsys.Open(name)
	if err != nil {
		return nil, nil, false
	}
	info, err := f.Stat()
	if err != nil || info.IsDir() {
		_ = f.Close()
		return nil, nil, false
	}
	return f, info, true
}

// writeAsset writes one file with the right type, caching and content coding.
//
// Fingerprinted assets are immutable and cached hard, unlike the shell — see
// writeShell for why the two must differ.
//
// A precompressed sidecar is preferred when the caller accepts its coding. The
// bytes are identical for every caller and never change between deploys, so
// they are produced once at build time rather than per request.
func writeAsset(w http.ResponseWriter, r *http.Request, fsys fs.FS, name string, f fs.File, info fs.FileInfo, asset bool) {
	if ct := mime.TypeByExtension(path.Ext(name)); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	switch {
	case !asset || strings.HasSuffix(name, ".html"):
		w.Header().Set("Cache-Control", "no-cache")
	default:
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}

	// Vary goes on every asset, not only the ones that came back compressed.
	// It describes how the URL behaves, not what this particular answer was:
	// an identity response cached without it is later served to a client that
	// asked for gzip, and the compressed one to a client that cannot decode it.
	// Either way the failure is silent, cached, and shared by everyone behind
	// that intermediary — which is why this header ships in the same commit as
	// the sidecars and not after them.
	w.Header().Set("Vary", "Accept-Encoding")

	if enc, encInfo, token, ok := openEncoded(fsys, name, r.Header.Get("Accept-Encoding")); ok {
		defer enc.Close()
		// The body is now gzip, so ServeContent's sniffing would answer
		// "application/x-gzip" for any extension mime could not name. The type
		// has to describe the DECODED representation; pin it before writing.
		if w.Header().Get("Content-Type") == "" {
			w.Header().Set("Content-Type", "application/octet-stream")
		}
		w.Header().Set("Content-Encoding", token)
		serveFile(w, r, name, enc, encInfo)
		return
	}

	serveFile(w, r, name, f, info)
}

func serveFile(w http.ResponseWriter, r *http.Request, name string, f fs.File, info fs.FileInfo) {
	if rs, ok := f.(io.ReadSeeker); ok {
		http.ServeContent(w, r, name, info.ModTime(), rs)
		return
	}
	// An embed.FS file is a ReadSeeker, so this is the fallback for an exotic
	// fs.FS a host supplied. No range support, which is correct rather than
	// lazy: a bundle asset is small and served whole.
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, f)
}

// Compile-time proof that Handler needs nothing from a framework.
var _ = func(s Set, h *Holder) http.Handler { return Handler(s, h, HandlerOptions{}) }
