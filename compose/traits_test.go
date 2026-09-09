package compose_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/ArmornetIO/showcase/compose"
)

// A host trait that answers only for a caller the host recognises. Registered
// once for the whole test binary, because RegisterTrait panics on a duplicate —
// two answers to one question is a race, not a configuration.
func init() {
	compose.RegisterTrait("entitled", func(_ context.Context, p compose.Principal, arg string) bool {
		who, ok := p.(testPrincipal)
		return ok && who.entitlements[arg]
	})
}

type testPrincipal struct{ entitlements map[string]bool }

const identityRules = `
version: 1
hosts:
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
      - name: showcase
        allow: [{ requires: [signed-in, entitled:armory] }]
`

func identityHandler(t *testing.T, p compose.PrincipalFunc) http.Handler {
	t.Helper()
	set := compose.MustSet(
		compose.Root(app("console", "/", "index.html", "marker-console")),
		compose.Also(app("showcase", "/showcase", "index.html", "marker-showcase")),
	)
	m, err := compose.DecodeManifest(stringReader(fiveAppManifest))
	if err != nil {
		t.Fatal(err)
	}
	rs, err := compose.DecodeRuleSet(stringReader(identityRules))
	if err != nil {
		t.Fatal(err)
	}
	h, err := compose.NewHolder(m, set.Names(), rs)
	if err != nil {
		t.Fatal(err)
	}
	return compose.Handler(set, h, compose.HandlerOptions{Principal: p})
}

// TestRuleRequiringIdentityRefusesWithoutAPrincipal is FR-028.
//
// A host that supplies no principal must never satisfy a rule that asks who the
// caller is. This is a property of the SHAPE, not a rule anyone has to remember:
// rows are conjunctions and an unresolvable trait is false, so a row containing
// `signed-in` cannot match an anonymous caller and there is no negation with
// which to invert it.
func TestRuleRequiringIdentityRefusesWithoutAPrincipal(t *testing.T) {
	// No principal function at all — the standalone CLI's situation.
	h := identityHandler(t, nil)
	rec := record()
	h.ServeHTTP(rec, newRequest("x", "/showcase/marker-showcase"))
	if rec.Body.String() == "content of marker-showcase" {
		t.Fatal("an anonymous caller was served an app whose rule requires identity")
	}
}

// The same, but with a host that supplies a principal carrying nothing. An
// entitlement the host cannot confirm must not be assumed.
func TestUnentitledPrincipalIsRefused(t *testing.T) {
	h := identityHandler(t, func(*http.Request) compose.Principal {
		return testPrincipal{entitlements: map[string]bool{}}
	})
	rec := record()
	h.ServeHTTP(rec, newRequest("x", "/showcase/marker-showcase"))
	if rec.Body.String() == "content of marker-showcase" {
		t.Fatal("a signed-in but unentitled caller was served")
	}
}

// And the grant must actually work, or the two tests above pass by refusing
// everyone — which is secure and proves nothing.
func TestEntitledPrincipalIsServed(t *testing.T) {
	h := identityHandler(t, func(*http.Request) compose.Principal {
		return testPrincipal{entitlements: map[string]bool{"armory": true}}
	})
	rec := record()
	h.ServeHTTP(rec, newRequest("x", "/showcase/marker-showcase"))
	if rec.Body.String() != "content of marker-showcase" {
		t.Fatalf("an entitled caller was refused: %d %q", rec.Code, rec.Body.String())
	}
}

// An unregistered trait family must fail to LOAD. If it merely evaluated false
// a typo would silently turn a grant into a refusal — quiet, and wrong in the
// direction nobody notices until a customer does.
func TestUnregisteredTraitFamilyFailsToLoad(t *testing.T) {
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
        allow: [{ requires: [entitledd:armory] }]
`))
	if err != nil {
		t.Fatal(err)
	}
	ps := compose.Validate(m, rs, []string{"console"})
	if !ps.Failed() {
		t.Fatal("a rule naming an unregistered trait family loaded cleanly")
	}
	if got := ps.String(); !strings.Contains(got, "entitledd") {
		t.Errorf("the failure does not name the typo:\n%s", got)
	}
}

// An empty conjunction must not be vacuously true. `allow: [{}]` reads as "no
// conditions yet" to a person and would grant everyone.
func TestEmptyRequiresIsRefusedAtLoad(t *testing.T) {
	m, _ := compose.DecodeManifest(stringReader(fiveAppManifest))
	rs, err := compose.DecodeRuleSet(stringReader(`
version: 1
hosts:
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{}]
`))
	if err != nil {
		t.Fatal(err)
	}
	if !compose.Validate(m, rs, []string{"console"}).Failed() {
		t.Fatal("an empty requires loaded cleanly; it would grant everyone")
	}
}
