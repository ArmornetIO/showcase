package compose

import (
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
	// concern that would drag armornet's config type into this module. But the
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
	// armornet's hot-dev loop the bundle is deliberately absent — Vite is
	// serving it on another port — and the right response is a redirect back to
	// that port carrying the whole request URI, because the OIDC callback IS its
	// query string and a sign-in that lands on a diagnostic completes nothing.
	//
	// Nil keeps the built-in diagnostic, which is what the standalone CLI wants.
	Unbuilt http.Handler
}

// Handler serves every app in the set, applying visibility per request.
//
// A plain http.Handler and not a framework's: the host adapts it at its own
// edge with one line. That is what lets the same code serve armornet's gin
// listener, the installer's bare net/http listener, and the standalone CLI
// without any of them being special.
func Handler(set Set, h *Holder, opts HandlerOptions) http.Handler {
	listener := opts.Listener
	if listener == "" {
		listener = WebListener
	}
	rt := newRouter(set, listener, set.shared)
	shells := buildShells(rt, opts.Shell)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var p Principal
		if opts.Principal != nil {
			p = opts.Principal(r)
		}
		urlPath := cleanPath(r.URL.Path)

		d := rt.Resolve(r.Context(), h.Current(), hostOf(r, h.Current()), urlPath, p)
		if d.Outcome == OutcomeUnbuilt && opts.Unbuilt != nil {
			opts.Unbuilt.ServeHTTP(w, r)
			return
		}
		if d.Outcome != OutcomeServe {
			d.WriteRefusal(w, r)
			return
		}
		serveApp(w, r, *d.App, urlPath, shells[d.App.Name], opts.Unbuilt, d)
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

// serveApp writes an app's asset, or its shell.
//
// The shell fallback is what makes a single-page app work: any path the bundle
// has no file for is answered with index.html so the client router can take
// over. It is also why the refusal path had to be unified — the shell used to
// carry a cache header a plain not-found did not, and that one header was
// enough to tell a caller which URLs existed.
// buildShells renders each app's index.html once. An app with no shell and no
// builtin gets a nil entry, which serveApp reads as "not built".
func buildShells(rt *router, fn func(App, []byte) []byte) map[string][]byte {
	out := map[string][]byte{}
	for name, a := range rt.byName {
		var index []byte
		if f, _, ok := openFile(a.Files, "index.html"); ok {
			index, _ = io.ReadAll(f)
			_ = f.Close()
		} else if len(a.Builtin) > 0 {
			index = a.Builtin
		}
		if index == nil {
			continue
		}
		if fn != nil {
			index = fn(a, index)
		}
		out[name] = index
	}
	return out
}

func serveApp(w http.ResponseWriter, r *http.Request, a App, urlPath string, shell []byte, unbuilt http.Handler, d Decision) {
	rel := bundleRelative(a, urlPath)

	// The shell is served from the rendered copy, never from the bundle
	// directly. Otherwise the most common request on the site — "/" — resolves
	// to index.html as an ordinary FILE and silently skips whatever the host
	// injected into it, while a deep link like /overview gets the injected copy
	// via the fallback below. The bug that produces is maddening: the app works
	// on every route except the one everybody lands on.
	if rel == "index.html" && shell != nil {
		writeShell(w, shell)
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

	if shell != nil {
		writeShell(w, shell)
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
func writeShell(w http.ResponseWriter, shell []byte) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
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

func openFile(fsys fs.FS, name string) (fs.File, fs.FileInfo, bool) {
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
// Fingerprinted assets are immutable and cached hard; the shell never is. A
// cached shell is how a deploy ships new assets to a browser still running the
// previous index.html, which looks like a random front-end bug and is not one.
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
