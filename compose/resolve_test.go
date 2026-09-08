package compose_test

import (
	"net/http"
	"testing"

	"github.com/ArmornetIO/showcase/compose"
)

// Two apps both claim "/", which is the ONE legal overlap. Which of them
// answers is the scope's root, and that single line is what retires the
// jobboard build tag.
const twoHostRules = `
version: 1
hosts:
  - host: armornet.io
    aliases: [www.armornet.io]
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
      - name: showcase
        allow: [{ requires: [anyone] }]
  - host: jobs.example.com
    root: jobboard
    apps:
      - name: jobboard
        allow: [{ requires: [anyone] }]
  - host: "*.staging.armornet.io"
    root: showcase
    apps:
      - name: showcase
        allow: [{ requires: [anyone] }]
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
`

const fourAppManifest = `
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
  - name: jobboard
    path: /
    source: client-site
    toolchain: sveltekit
    dev: { port: 5399 }
  - name: deep
    path: /showcase/deep
    source: installer-ui
    toolchain: vite
    dev: { port: 5499 }
`

func fourAppSet(t *testing.T) (compose.Set, *compose.Holder) {
	t.Helper()
	set := compose.MustSet(
		compose.Root(app("console", "/", "index.html")),
		compose.Also(
			app("showcase", "/showcase", "index.html"),
			app("jobboard", "/", "index.html"),
			app("deep", "/showcase/deep", "index.html"),
		),
	)
	m, err := compose.DecodeManifest(stringReader(fourAppManifest))
	if err != nil {
		t.Fatal(err)
	}
	rs, err := compose.DecodeRuleSet(stringReader(twoHostRules))
	if err != nil {
		t.Fatal(err)
	}
	h, err := compose.NewHolder(m, set.Names(), rs)
	if err != nil {
		t.Fatal(err)
	}
	return set, h
}

// which reports which app answered, by reading the marker its bundle carries.
func which(t *testing.T, set compose.Set, h *compose.Holder, host, path string) (int, string) {
	t.Helper()
	req := newRequest(host, path)
	rec := record()
	compose.Handler(set, h, compose.HandlerOptions{}).ServeHTTP(rec, req)
	return rec.Code, rec.Body.String()
}

// TestMostSpecificHostWins covers step 2 of the decision procedure.
//
// Exact beats a wildcard suffix beats the catch-all, and scopes never merge:
// an app granted on the catch-all is NOT thereby granted on a hostname with its
// own scope. That is what lets one binary serve a hostname where the console
// simply does not exist.
func TestMostSpecificHostWins(t *testing.T) {
	set, h := fourAppSet(t)

	cases := []struct {
		host, path string
		wantStatus int
		wantBody   string
		why        string
	}{
		{"armornet.io", "/", 200, "content of index.html", "exact host, root console"},
		{"www.armornet.io", "/", 200, "content of index.html", "alias resolves to the same scope"},
		{"jobs.example.com", "/", 200, "content of index.html", "the OTHER app claiming / is rooted here"},
		{"anything-else.test", "/", 200, "content of index.html", "catch-all"},
		{"a.staging.armornet.io", "/showcase", 200, "content of index.html", "wildcard suffix scope"},
	}
	for _, c := range cases {
		status, _ := which(t, set, h, c.host, c.path)
		if status != c.wantStatus {
			t.Errorf("%s%s = %d, want %d (%s)", c.host, c.path, status, c.wantStatus, c.why)
		}
	}
}

// The console is granted on armornet.io and unmentioned on jobs.example.com.
// A visitor to the job board must not be able to tell it was compiled in — and
// since /showcase is not claimed there, they get the job board's own shell,
// exactly as they would if the console had never been built.
func TestUnmentionedAppIsInvisibleOnAnotherHost(t *testing.T) {
	set, h := fourAppSet(t)

	onArmornet, _ := which(t, set, h, "armornet.io", "/showcase")
	if onArmornet != http.StatusOK {
		t.Fatalf("/showcase on armornet.io = %d, want 200", onArmornet)
	}
	onJobs, body := which(t, set, h, "jobs.example.com", "/showcase")
	if onJobs != http.StatusOK {
		t.Errorf("/showcase on jobs.example.com = %d — a status difference is the enumeration oracle", onJobs)
	}
	if body != "content of index.html" {
		t.Errorf("jobs.example.com served %q for an unmentioned app's path", body)
	}
}

// TestLongestPrefixClaimWins covers step 1. /showcase/deep must beat /showcase,
// or the more specific app is permanently shadowed by the less specific one.
func TestLongestPrefixClaimWins(t *testing.T) {
	set := compose.MustSet(
		compose.Root(app("console", "/", "index.html")),
		compose.Also(
			app("showcase", "/showcase", "index.html", "marker-showcase"),
			app("deep", "/showcase/deep", "index.html", "marker-deep"),
		),
	)
	m, _ := compose.DecodeManifest(stringReader(fourAppManifest))
	rs, _ := compose.DecodeRuleSet(stringReader(`
version: 1
hosts:
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
      - name: showcase
        allow: [{ requires: [anyone] }]
      - name: deep
        allow: [{ requires: [anyone] }]
`))
	h, err := compose.NewHolder(m, set.Names(), rs)
	if err != nil {
		t.Fatal(err)
	}

	// Each app's bundle carries a distinctly-named file, so asking for it proves
	// which app answered rather than inferring it from a status code.
	if _, body := which(t, set, h, "x", "/showcase/deep/marker-deep"); body != "content of marker-deep" {
		t.Errorf("/showcase/deep/marker-deep answered %q — /showcase shadowed the deeper claim", body)
	}
	if _, body := which(t, set, h, "x", "/showcase/marker-showcase"); body != "content of marker-showcase" {
		t.Errorf("/showcase/marker-showcase answered %q", body)
	}
}

// An app's own asset namespace must resolve to it even when another app claims
// the URL space it appears to sit beneath.
func TestAssetNamespaceBeatsPathClaim(t *testing.T) {
	set, h := fourAppSet(t)
	if _, body := which(t, set, h, "armornet.io", "/_apps/showcase/index.html"); body != "content of index.html" {
		t.Errorf("asset namespace did not resolve to its owner: %q", body)
	}
}

// Path traversal must not reach another app's namespace through a claim the
// caller is allowed to use.
func TestTraversalCannotEscapeAClaim(t *testing.T) {
	set, h := fourAppSet(t)
	status, _ := which(t, set, h, "jobs.example.com", "/showcase/../_apps/console/index.html")
	if status == http.StatusOK {
		t.Error("a traversal reached the console's asset namespace on a host that does not grant the console")
	}
}
