package compose_test

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/ArmornetIO/showcase/compose"
)

// TestShippedCatchAllServesAnUnconfiguredHost is the bootstrap guarantee.
//
// Refusal-by-absence plus a required root would otherwise mean a fresh checkout
// serves NOTHING: every hostname a developer might use is unconfigured, so
// every hostname has no scope, so every request is refused — and the failure
// looks exactly like a broken build.
//
// So a catch-all ships PRESENT. Deleting it is how an operator closes a
// deployment: a visible, reviewable edit rather than a line somebody forgot to
// write.
func TestShippedCatchAllServesAnUnconfiguredHost(t *testing.T) {
	rules := defaultVisibility(t)

	set := compose.MustSet(
		compose.Root(app("console", "/", "index.html")),
		compose.Also(
			app("showcase", "/showcase", "index.html"),
			app("breach", "/breach", "index.html"),
		),
	)
	m, err := compose.DecodeManifest(openRepoFile(t, "apps.yaml"))
	if err != nil {
		t.Fatalf("apps.yaml: %v", err)
	}
	h, err := compose.NewHolder(m, set.Names(), rules)
	if err != nil {
		t.Fatalf("the shipped default does not load against the shipped manifest: %v", err)
	}
	handler := compose.Handler(set, h, compose.HandlerOptions{})

	// Hostnames nobody configured, which is what a fresh checkout always uses.
	for _, host := range []string{"localhost", "127.0.0.1", "my-laptop.local", "armornet-dev.test"} {
		rec := record()
		handler.ServeHTTP(rec, newRequest(host, "/"))
		if rec.Code != http.StatusOK {
			t.Errorf("%s/ answered %d on the shipped default — a fresh checkout would look like a broken build", host, rec.Code)
		}
	}
}

// Deleting the catch-all must actually close the deployment, or its presence is
// not a decision an operator can reverse.
func TestRemovingTheCatchAllClosesTheDeployment(t *testing.T) {
	rs, err := compose.DecodeRuleSet(stringReader(`
version: 1
hosts:
  - host: armornet.io
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
`))
	if err != nil {
		t.Fatal(err)
	}
	set := compose.MustSet(compose.Root(app("console", "/", "index.html")))
	m, _ := compose.DecodeManifest(stringReader(fiveAppManifest))
	h, err := compose.NewHolder(m, set.Names(), rs)
	if err != nil {
		t.Fatal(err)
	}
	handler := compose.Handler(set, h, compose.HandlerOptions{})

	rec := record()
	handler.ServeHTTP(rec, newRequest("some-other-host.test", "/"))
	if rec.Code != http.StatusNotFound {
		t.Errorf("an unconfigured host answered %d after the catch-all was removed, want 404", rec.Code)
	}
}

// The shipped default must be a real, loadable document — not an example that
// has drifted from the schema. It is the file a fresh deployment actually uses.
func defaultVisibility(t *testing.T) compose.RuleSet {
	t.Helper()
	rs, err := compose.DecodeRuleSet(openRepoFile(t, filepath.Join("configs", "visibility.default.yaml")))
	if err != nil {
		t.Fatalf("the shipped default visibility document does not decode: %v", err)
	}
	return rs
}

// openRepoFile reaches the armornet tree from this nested module. The engine
// itself never reads either file — this is a test asserting that what armornet
// SHIPS is loadable by the engine it ships with.
func openRepoFile(t *testing.T, rel string) *os.File {
	t.Helper()
	f, err := os.Open(filepath.Join("..", "..", rel))
	if err != nil {
		t.Fatalf("opening %s: %v", rel, err)
	}
	t.Cleanup(func() { _ = f.Close() })
	return f
}

// The inertness rule must not have weakened the check it refines. A scope whose
// apps ARE present here but whose root is missing is a live hostname with no
// answer for "/", and that has to stay fatal — otherwise "one document serves
// several profiles" becomes an excuse that swallows a real outage.
func TestLiveScopeWithAMissingRootStillFails(t *testing.T) {
	m, err := compose.DecodeManifest(stringReader(fiveAppManifest))
	if err != nil {
		t.Fatal(err)
	}
	rs, err := compose.DecodeRuleSet(stringReader(`
version: 1
hosts:
  - host: "*"
    root: secret
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
      - name: secret
        allow: [{ requires: [anyone] }]
`))
	if err != nil {
		t.Fatal(err)
	}
	// console IS in this build, so the scope is live; `secret` is not, so the
	// root is missing and "/" would answer nothing.
	ps := compose.Validate(m, rs, []string{"console"})
	if !ps.Failed() {
		t.Fatalf("a live scope with an absent root loaded cleanly:\n%s", ps)
	}
}

// And the inert case must genuinely be inert — reported, but not fatal.
func TestFullyInertScopeOnlyWarns(t *testing.T) {
	m, err := compose.DecodeManifest(stringReader(fiveAppManifest))
	if err != nil {
		t.Fatal(err)
	}
	rs, err := compose.DecodeRuleSet(stringReader(`
version: 1
hosts:
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
  - host: 127.0.0.1
    listener: installer
    root: secret
    apps:
      - name: secret
        allow: [{ requires: [anyone] }]
`))
	if err != nil {
		t.Fatal(err)
	}
	ps := compose.Validate(m, rs, []string{"console"})
	if ps.Failed() {
		t.Fatalf("a scope for a listener this build does not run was fatal:\n%s", ps)
	}
	if len(ps) == 0 {
		t.Error("the inert scope was not reported at all; silence is how a real typo hides")
	}
}
