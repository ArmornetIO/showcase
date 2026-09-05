package compose_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/ArmornetIO/showcase/compose"
)

func bundle(files ...string) fstest.MapFS {
	m := fstest.MapFS{}
	for _, f := range files {
		m[f] = &fstest.MapFile{Data: []byte("content of " + f)}
	}
	return m
}

func app(name, path string, files ...string) compose.App {
	return compose.App{
		Name:        name,
		Path:        path,
		AssetPrefix: compose.AssetPrefix(name),
		Files:       bundle(files...),
	}
}

// newRequest builds a GET for a host and path; record is a fresh recorder. Both
// exist so the serving tests read as assertions rather than as plumbing.
func newRequest(host, path string) *http.Request {
	return httptest.NewRequest(http.MethodGet, "http://"+host+path, nil)
}

func record() *httptest.ResponseRecorder { return httptest.NewRecorder() }

// serveOnce runs one request against a handler built from the given set+rules.
func serveOnce(t *testing.T, set compose.Set, rules string, method, url string) *httptest.ResponseRecorder {
	t.Helper()
	h := holder(t, set, rules)
	req := httptest.NewRequest(method, url, nil)
	rec := httptest.NewRecorder()
	compose.Handler(set, h, compose.HandlerOptions{}).ServeHTTP(rec, req)
	return rec
}

func holder(t *testing.T, set compose.Set, rules string) *compose.Holder {
	t.Helper()
	m, err := compose.DecodeManifest(stringReader(fiveAppManifest))
	if err != nil {
		t.Fatalf("manifest: %v", err)
	}
	rs, err := compose.DecodeRuleSet(stringReader(rules))
	if err != nil {
		t.Fatalf("rules: %v", err)
	}
	h, err := compose.NewHolder(m, set.Names(), rs)
	if err != nil {
		t.Fatalf("holder: %v", err)
	}
	return h
}

const fiveAppManifest = `
version: 1
apps:
  - name: console
    path: /
    source: app-ui
    toolchain: sveltekit
    dev: { port: 5173 }
  - name: showcase
    path: /showcase
    source: showcase
    toolchain: sveltekit
    dev: { port: 5299 }
  - name: secret
    path: /secret
    source: client-site
    toolchain: sveltekit
    dev: { port: 5399 }
`

// Only the console and showcase are granted. `secret` is compiled in but
// unmentioned, which is the case FR-012 is really about.
const oneHostRules = `
version: 1
hosts:
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
      - name: showcase
        allow: [{ requires: [anyone] }]
`

// TestRefusalIsByteIdentical is the test the whole refusal design exists for.
//
// The reasons a caller gets nothing — compiled in but not granted here, claimed
// by no app, absent from the build entirely — must be indistinguishable. If any
// of them differs by status, body, or a single header, that difference tells a
// visitor what else this binary is carrying, and a visitor to the job board's
// hostname learns the console exists.
//
// The cases split into two groups because a page and an asset are different
// questions, and the honest form of the requirement is per group. See the
// comment on `groups` below for why forcing all five into one answer would have
// been the wrong fix rather than a stricter one.
func TestRefusalIsByteIdentical(t *testing.T) {
	compiledIn := compose.MustSet(
		compose.Root(app("console", "/", "index.html")),
		compose.Also(
			app("showcase", "/showcase", "index.html"),
			app("secret", "/secret", "index.html"),
		),
	)
	// The same profile WITHOUT the secret app — genuine absence, the thing a
	// refusal has to be indistinguishable from.
	absent := compose.MustSet(
		compose.Root(app("console", "/", "index.html")),
		compose.Also(app("showcase", "/showcase", "index.html")),
	)

	// TWO groups, and the grouping is the point. Within each group the reason a
	// caller got nothing must be unknowable; between groups the answers
	// legitimately differ because a page and an asset are different questions.
	//
	// A PAGE falls through to the root app's shell — exactly what that URL
	// answers when the app was never built, since an unclaimed path goes to the
	// root either way. An ASSET is refused outright, because an asset URL is
	// never a client-router route and answering one with a shell would put the
	// status code back to work as an oracle.
	groups := map[string]map[string]struct {
		set compose.Set
		url string
	}{
		"pages": {
			"refused by rule (compiled in, not granted)": {compiledIn, "http://x/secret"},
			"absent from the build":                      {absent, "http://x/secret"},
			"claimed by no app at all":                   {compiledIn, "http://x/nothing-claims-this"},
		},
		"assets": {
			"refused asset": {compiledIn, "http://x/_apps/secret/app.js"},
			"absent asset":  {absent, "http://x/_apps/secret/app.js"},
		},
	}

	type response struct {
		status int
		header string
		body   string
	}
	seen := map[string]map[string]response{}
	for group, cases := range groups {
		seen[group] = map[string]response{}
		for name, c := range cases {
			rec := serveOnce(t, c.set, oneHostRules, http.MethodGet, c.url)
			h := rec.Header().Clone()
			// Date is generated per response; a slow machine rolling the second
			// between two requests would fail this for a reason unrelated to
			// disclosure.
			h.Del("Date")
			seen[group][name] = response{
				rec.Code,
				h.Get("Content-Type") + "|" + h.Get("Cache-Control") + "|" + h.Get("X-Content-Type-Options"),
				rec.Body.String(),
			}
		}
	}

	for group, got := range seen {
		var first string
		for name := range got {
			if first == "" || name < first {
				first = name
			}
		}
		for name, r := range got {
			if r != got[first] {
				t.Errorf("[%s] refusal for %q differs from %q — that difference is the disclosure\n  got:  %+v\n  want: %+v",
					group, name, first, r, got[first])
			}
		}
	}

	// And the groups must not be trivially equal to each other in the wrong
	// direction: an asset refusal has to be a real refusal, not a shell.
	for name, r := range seen["assets"] {
		if r.status != http.StatusNotFound {
			t.Errorf("asset case %q answered %d, want 404 — an asset URL must never be answered with a shell", name, r.status)
		}
	}
	for name, r := range seen["pages"] {
		if r.status != http.StatusOK {
			t.Errorf("page case %q answered %d, want the root shell (200); a 404 here is the enumeration oracle", name, r.status)
		}
	}
}

// A granted app must actually be served — otherwise the test above passes by
// refusing everything, which is secure and useless.
func TestGrantedAppIsServed(t *testing.T) {
	set := compose.MustSet(
		compose.Root(app("console", "/", "index.html")),
		compose.Also(app("showcase", "/showcase", "index.html")),
	)
	for _, url := range []string{"http://x/", "http://x/showcase", "http://x/showcase/"} {
		rec := serveOnce(t, set, oneHostRules, http.MethodGet, url)
		if rec.Code != http.StatusOK {
			t.Errorf("%s answered %d, want 200 — the refusal test is worthless if nothing is ever served", url, rec.Code)
		}
	}
}

// The shell must never be cached. A cached index.html serves a browser the old
// shell against new fingerprinted assets after a deploy, which looks like a
// random front-end bug.
func TestShellIsNotCached(t *testing.T) {
	set := compose.MustSet(compose.Root(app("console", "/", "index.html")))
	rec := serveOnce(t, set, oneHostRules, http.MethodGet, "http://x/")
	if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("shell Cache-Control = %q, want no-cache", cc)
	}
}

// The shell hook must actually run, and run ONCE per app rather than per
// request — a host that cannot touch index.html cannot ship an SPA that needs
// anything from the server at boot, and one that pays for the rewrite on every
// page load has put a marshal on the hot path.
func TestShellHookRunsOncePerApp(t *testing.T) {
	set := compose.MustSet(
		compose.Root(app("console", "/", "index.html")),
		compose.Also(app("showcase", "/showcase", "index.html")),
	)
	h := holder(t, set, oneHostRules)

	calls := map[string]int{}
	handler := compose.Handler(set, h, compose.HandlerOptions{
		Shell: func(a compose.App, index []byte) []byte {
			calls[a.Name]++
			return append(index, []byte("<!--injected-->")...)
		},
	})

	for range 3 {
		rec := record()
		handler.ServeHTTP(rec, newRequest("x", "/"))
		if !strings.Contains(rec.Body.String(), "<!--injected-->") {
			t.Fatalf("the shell hook did not run: %q", rec.Body.String())
		}
	}
	if calls["console"] != 1 {
		t.Errorf("shell hook ran %d times for the console across 3 requests, want 1", calls["console"])
	}
}
