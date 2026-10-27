package compose_test

import (
	"net/http"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/ArmornetIO/showcase/compose"
)

// prerenderedApp is a partly-prerendered SvelteKit build: a real index.html
// with the front page's copy baked in, a 200.html client-router shell for
// everything else, and one prerendered inner page.
func prerenderedApp() compose.Set {
	return compose.MustSet(compose.Root(compose.App{
		Name: "console", Path: "/", AssetPrefix: compose.AssetPrefix("console"),
		Files: fstest.MapFS{
			"index.html":   file("<!doctype html><h1>front page copy</h1></head>"),
			"200.html":     file("<!doctype html><div id=spa></div></head>"),
			"privacy.html": file("<!doctype html><h1>privacy copy</h1></head>"),
			"app.js":       file("asset"),
		},
	}))
}

func file(s string) *fstest.MapFile { return &fstest.MapFile{Data: []byte(s)} }

// The whole point of prerendering: the URL a crawler asks for must answer with
// that page's copy, not with the empty client-router shell. Both would return
// 200, which is why this is worth a test — the failure is invisible from the
// status code and shows up months later as a site that ranks for nothing.
func TestPrerenderedPageBeatsTheShell(t *testing.T) {
	set := prerenderedApp()
	h := holder(t, set, oneHostRules)

	cases := []struct{ path, want, why string }{
		{"/", "front page copy", "the real index.html, not the fallback"},
		{"/privacy", "privacy copy", "prerendered inner page, resolved by adding .html"},
		{"/overview", "id=spa", "no baked file — the client router shell"},
	}
	for _, c := range cases {
		status, body := which(t, set, h, "example.test", c.path)
		if status != http.StatusOK {
			t.Errorf("%s = %d, want 200", c.path, status)
			continue
		}
		if !strings.Contains(body, c.want) {
			t.Errorf("%s served %q, want it to contain %q (%s)", c.path, body, c.want, c.why)
		}
	}
}

// Every HTML the bundle ships gets the host's injection, not only the shell.
// A prerendered page served raw is a page with no runtime config — in
// armornet's case no feature flags and no site-verification tag, on precisely
// the pages a verifier and a crawler fetch.
func TestShellHookReachesPrerenderedPages(t *testing.T) {
	set := prerenderedApp()
	h := holder(t, set, oneHostRules)

	inject := func(_ compose.App, index []byte) []byte {
		return []byte(strings.Replace(string(index), "</head>", "<!--injected--></head>", 1))
	}
	for _, path := range []string{"/", "/privacy", "/overview"} {
		rec := record()
		req := newRequest("example.test", path)
		compose.Handler(set, h, compose.HandlerOptions{Shell: inject}).ServeHTTP(rec, req)
		if !strings.Contains(rec.Body.String(), "<!--injected-->") {
			t.Errorf("%s was served without the host's injection: %q", path, rec.Body.String())
		}
	}
}

// A tab detects a deploy by comparing the build its page carries with the
// header the server now answers with, so the two must agree on every page of
// one bundle and differ across bundles.
func TestBuildIDMatchesAcrossPagesAndChangesWithTheShell(t *testing.T) {
	serve := func(set compose.Set, path string) (header, body string) {
		rec := record()
		compose.Handler(set, holder(t, set, oneHostRules), compose.HandlerOptions{}).ServeHTTP(rec, newRequest("example.test", path))
		return rec.Header().Get(compose.BuildHeader), rec.Body.String()
	}

	set := prerenderedApp()
	build, _ := serve(set, "/")
	if build == "" {
		t.Fatal("no build header on the shell")
	}
	for _, path := range []string{"/", "/privacy", "/overview"} {
		header, body := serve(set, path)
		meta := `<meta name="` + compose.BuildMeta + `" content="` + build + `">`
		if header != build || !strings.Contains(body, meta) {
			t.Errorf("%s: header %q, body %q; want both to carry build %q", path, header, body, build)
		}
	}

	rebuilt := compose.MustSet(compose.Root(compose.App{
		Name: "console", Path: "/", AssetPrefix: compose.AssetPrefix("console"),
		Files: fstest.MapFS{"200.html": file("<!doctype html><div id=spa2></div></head>")},
	}))
	if next, _ := serve(rebuilt, "/"); next == build {
		t.Errorf("a different shell kept build %q", build)
	}
}

// An app that prerenders nothing keeps index.html as its shell. The 200.html
// convention is an addition, not a migration every existing bundle has to make.
func TestIndexRemainsTheShellWithoutA200(t *testing.T) {
	set := compose.MustSet(compose.Root(compose.App{
		Name: "console", Path: "/", AssetPrefix: compose.AssetPrefix("console"),
		Files: fstest.MapFS{"index.html": file("<!doctype html><div id=spa></div></head>")},
	}))
	h := holder(t, set, oneHostRules)

	for _, path := range []string{"/", "/overview", "/deep/link"} {
		status, body := which(t, set, h, "example.test", path)
		if status != http.StatusOK || !strings.Contains(body, "id=spa") {
			t.Errorf("%s = %d %q, want the index shell", path, status, body)
		}
	}
}
