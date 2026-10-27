package compose_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/ArmornetIO/showcase/compose"
)

const page = "<html><head><title>x</title></head><body></body></html>"

func pageApp(name, path string) compose.App {
	return compose.App{
		Name:        name,
		Path:        path,
		AssetPrefix: compose.AssetPrefix(name),
		Files:       fstest.MapFS{"index.html": &fstest.MapFile{Data: []byte(page)}},
	}
}

func devBundle() fstest.MapFS {
	return fstest.MapFS{"devcog.js": &fstest.MapFile{Data: []byte("export {}")}}
}

func devHandler(t *testing.T, set compose.Set, rules string, opts compose.HandlerOptions) http.Handler {
	t.Helper()
	return compose.Handler(set, holder(t, set, rules), opts)
}

func get(h http.Handler, url string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
	return rec
}

func decodeIndex(t *testing.T, rec *httptest.ResponseRecorder) []compose.IndexEntry {
	t.Helper()
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("index Content-Type = %q, want application/json (body %q)", ct, rec.Body.String())
	}
	var idx compose.AppIndex
	if err := json.Unmarshal(rec.Body.Bytes(), &idx); err != nil {
		t.Fatalf("index is not JSON: %v", err)
	}
	return idx.Apps
}

func names(entries []compose.IndexEntry) string {
	out := make([]string, len(entries))
	for i, e := range entries {
		out[i] = e.Name
	}
	return strings.Join(out, ",")
}

// Every app gets the console, including the ones that never mounted one —
// that is the whole reason injection lives in the framework and not in apps.
func TestDevToolsInjectedIntoEveryApp(t *testing.T) {
	set := compose.MustSet(
		compose.Root(pageApp("console", "/")),
		compose.Also(pageApp("showcase", "/showcase")),
	)
	h := devHandler(t, set, oneHostRules, compose.HandlerOptions{
		DevTools: devBundle(),
		Shell: func(_ compose.App, doc []byte) []byte {
			out, _ := compose.InjectBeforeHeadClose(doc, []byte("<meta name=host>"))
			return out
		},
	})
	for _, url := range []string{"http://x/", "http://x/showcase/", "http://x/deep/link"} {
		body := get(h, url).Body.Bytes()
		if n := bytes.Count(body, compose.DevToolsTag()); n != 1 {
			t.Errorf("%s carries the console tag %d times, want 1: %s", url, n, body)
		}
		if !bytes.Contains(body, []byte("<meta name=host>")) {
			t.Errorf("%s lost the host's own injection: %s", url, body)
		}
	}
}

// Off means absent, not dormant: no tag, and the namespace is not answered.
func TestDevToolsOffWithoutABundle(t *testing.T) {
	set := compose.MustSet(compose.Root(pageApp("console", "/")))
	h := devHandler(t, set, oneHostRules, compose.HandlerOptions{})
	if body := get(h, "http://x/").Body.Bytes(); bytes.Contains(body, compose.DevToolsTag()) {
		t.Errorf("console injected with dev tools off: %s", body)
	}
	if rec := get(h, "http://x"+compose.AppIndexPath); strings.Contains(rec.Header().Get("Content-Type"), "json") {
		t.Errorf("the app index answered with dev tools off")
	}
}

// On but unbuilt — the everyday state of a first hot-loop run — must still
// answer the index: an app that mounts its own console reads it, and without it
// BROWSE says the server publishes none. Only injection waits for the script,
// because a tag pointing at a 404 is an error on every page load.
func TestUnbuiltDevToolsStillServeTheIndex(t *testing.T) {
	set := compose.MustSet(compose.Root(pageApp("console", "/")))
	h := devHandler(t, set, oneHostRules, compose.HandlerOptions{DevTools: fstest.MapFS{}})
	if body := get(h, "http://x/").Body.Bytes(); bytes.Contains(body, compose.DevToolsTag()) {
		t.Errorf("console injected with no script to serve: %s", body)
	}
	if got := names(decodeIndex(t, get(h, "http://x"+compose.AppIndexPath))); got != "console" {
		t.Errorf("index = %q, want console", got)
	}
}

// Two injectors in front of one page — the server and the dev front door —
// must leave one console, or both mount and fight over every key.
func TestInjectDevToolsIsIdempotent(t *testing.T) {
	once, ok := compose.InjectDevTools([]byte(page))
	if !ok {
		t.Fatal("no head close found in a document that has one")
	}
	twice, _ := compose.InjectDevTools(once)
	if n := bytes.Count(twice, compose.DevToolsTag()); n != 1 {
		t.Errorf("tag appears %d times after two injections, want 1", n)
	}
}

// The script has a fixed name, so it must not be cached: a page would boot
// whatever console the previous build shipped.
func TestDevScriptIsServedUncached(t *testing.T) {
	set := compose.MustSet(compose.Root(pageApp("console", "/")))
	h := devHandler(t, set, oneHostRules, compose.HandlerOptions{DevTools: devBundle()})

	rec := get(h, "http://x"+compose.DevScriptPath)
	if rec.Code != http.StatusOK || rec.Body.String() != "export {}" {
		t.Fatalf("script answered %d %q", rec.Code, rec.Body.String())
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("script Cache-Control = %q, want no-cache", cc)
	}
	if rec := get(h, "http://x"+compose.DevNamespace+"nope"); rec.Code != http.StatusNotFound {
		t.Errorf("unknown dev path answered %d, want 404", rec.Code)
	}
}

// presetStatus is a writer whose status is already decided unless the handler
// decides otherwise — how gin hands a NoRoute handler its response.
type presetStatus struct {
	*httptest.ResponseRecorder
	wrote bool
}

func (p *presetStatus) WriteHeader(code int) { p.wrote = true; p.ResponseRecorder.WriteHeader(code) }
func (p *presetStatus) Write(b []byte) (int, error) {
	if !p.wrote {
		p.WriteHeader(http.StatusNotFound)
	}
	return p.ResponseRecorder.Write(b)
}

// Every dev answer states its own status. Mounted as a framework's fallback it
// inherits a 404, and an index shipped as a 404 reads to the console as "this
// server publishes none" — which is how it first failed.
func TestDevAnswersSetTheirOwnStatus(t *testing.T) {
	set := compose.MustSet(compose.Root(pageApp("console", "/")))
	h := devHandler(t, set, oneHostRules, compose.HandlerOptions{DevTools: devBundle()})
	for _, path := range []string{compose.AppIndexPath, compose.DevScriptPath, "/"} {
		w := &presetStatus{ResponseRecorder: httptest.NewRecorder()}
		h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "http://x"+path, nil))
		if w.Code != http.StatusOK {
			t.Errorf("%s answered %d under a preset-404 writer, want 200", path, w.Code)
		}
	}
}

// The index is Resolve asked for every app at once. An app the caller would be
// refused, or a "/" app that is not this hostname's root, is a link that lands
// somewhere else — so neither may appear.
func TestAppIndexListsOnlyReachableApps(t *testing.T) {
	set := compose.MustSet(
		compose.Root(pageApp("console", "/")),
		compose.Also(pageApp("showcase", "/showcase"), pageApp("secret", "/secret")),
	)
	h := devHandler(t, set, oneHostRules, compose.HandlerOptions{DevTools: devBundle()})

	got := decodeIndex(t, get(h, "http://x"+compose.AppIndexPath))
	if names(got) != "console,showcase" {
		t.Fatalf("index = %s, want console,showcase — secret is compiled in but not granted", names(got))
	}
	if !got[0].Root || got[1].Root || got[1].Path != "/showcase" {
		t.Errorf("entries = %+v, want console as root and showcase at /showcase", got)
	}
}

func TestAppIndexLeavesOutANonRootSlashApp(t *testing.T) {
	set := compose.MustSet(
		compose.Root(pageApp("console", "/")),
		compose.Also(pageApp("secret", "/")),
	)
	rules := `
version: 1
hosts:
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
      - name: secret
        allow: [{ requires: [anyone] }]
`
	h := devHandler(t, set, rules, compose.HandlerOptions{DevTools: devBundle()})
	if got := names(decodeIndex(t, get(h, "http://x"+compose.AppIndexPath))); got != "console" {
		t.Errorf("index = %s, want console — secret claims / but nothing routes to it here", got)
	}
}

// The same grant, judged per caller: what one principal can reach another
// may not, so the index is never shared between them.
func TestAppIndexFollowsThePrincipal(t *testing.T) {
	set := compose.MustSet(
		compose.Root(pageApp("console", "/")),
		compose.Also(pageApp("showcase", "/showcase")),
	)
	rules := `
version: 1
hosts:
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
      - name: showcase
        allow: [{ requires: [signed-in] }]
`
	signedIn := false
	h := devHandler(t, set, rules, compose.HandlerOptions{
		DevTools: devBundle(),
		Principal: func(*http.Request) compose.Principal {
			if signedIn {
				return "someone"
			}
			return nil
		},
	})

	anon := get(h, "http://x"+compose.AppIndexPath)
	if got := names(decodeIndex(t, anon)); got != "console" {
		t.Errorf("anonymous index = %s, want console", got)
	}
	if cc := anon.Header().Get("Cache-Control"); cc != "no-store" {
		t.Errorf("index Cache-Control = %q, want no-store — it differs per caller", cc)
	}
	signedIn = true
	if got := names(decodeIndex(t, get(h, "http://x"+compose.AppIndexPath))); got != "console,showcase" {
		t.Errorf("signed-in index = %s, want console,showcase", got)
	}
}
