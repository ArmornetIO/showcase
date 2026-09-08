package compose_test

import (
	"strings"
	"testing"

	"github.com/ArmornetIO/showcase/compose"
)

const testManifest = `
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
`

const goodRules = `
version: 1
hosts:
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
`

// The set is well-formed YAML and decodes fine. It is invalid because it names
// an app the manifest does not declare — which is a typo, and a typo in a
// visibility document is exactly the failure this package refuses to apply.
const badRules = `
version: 1
hosts:
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
      - name: consoel
        allow: [{ requires: [anyone] }]
`

func mustManifest(t *testing.T) compose.Manifest {
	t.Helper()
	m, err := compose.DecodeManifest(strings.NewReader(testManifest))
	if err != nil {
		t.Fatalf("decoding test manifest: %v", err)
	}
	return m
}

func mustRules(t *testing.T, src string) compose.RuleSet {
	t.Helper()
	rs, err := compose.DecodeRuleSet(strings.NewReader(src))
	if err != nil {
		t.Fatalf("decoding test rules: %v", err)
	}
	return rs
}

func TestInvalidRuleSetKeepsLastKnownGood(t *testing.T) {
	m := mustManifest(t)
	present := []string{"console", "showcase"}

	h, err := compose.NewHolder(m, present, mustRules(t, goodRules))
	if err != nil {
		t.Fatalf("seeding holder: %v", err)
	}
	before := h.Current()

	ps, err := h.Swap(mustRules(t, badRules))

	// Rejected...
	if err == nil {
		t.Fatal("swap accepted a rule set naming an app the manifest does not declare")
	}
	// ...loudly, naming the offender. A rejection nobody can act on is only
	// marginally better than a silent one.
	if !strings.Contains(ps.String(), "consoel") {
		t.Errorf("rejection does not name the offending app:\n%s", ps)
	}
	if !ps.Failed() {
		t.Error("Problems.Failed() is false for a rejected set")
	}
	// ...and WHOLE: the good half of the document must not have been applied.
	after := h.Current()
	if len(after.Hosts) != len(before.Hosts) || len(after.Hosts[0].Apps) != len(before.Hosts[0].Apps) {
		t.Fatalf("previous set did not stay in force: before %d apps, after %d",
			len(before.Hosts[0].Apps), len(after.Hosts[0].Apps))
	}
}

func TestSeedingWithAnInvalidSetFails(t *testing.T) {
	// No last known good exists yet, so there is nothing to fall back to and a
	// process that started this way has nothing to serve.
	if _, err := compose.NewHolder(mustManifest(t), []string{"console"}, mustRules(t, badRules)); err == nil {
		t.Fatal("NewHolder accepted an invalid seed")
	}
}

func TestSwapReportsWarningsWithoutRejecting(t *testing.T) {
	// A grant naming an app that is declared but not in THIS build is inert,
	// not broken — one visibility document is expected to serve several
	// profiles, so it must not stop a load.
	const warnRules = `
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
	h, err := compose.NewHolder(mustManifest(t), []string{"console"}, mustRules(t, goodRules))
	if err != nil {
		t.Fatalf("seeding holder: %v", err)
	}
	ps, err := h.Swap(mustRules(t, warnRules))
	if err != nil {
		t.Fatalf("swap rejected an inert rule: %v", err)
	}
	if len(ps) == 0 {
		t.Error("swap reported no warning for an app outside the build")
	}
	if len(h.Current().Hosts[0].Apps) != 2 {
		t.Error("the accepted set was not installed")
	}
}

func TestUnknownFieldIsAHardError(t *testing.T) {
	// Forward compatibility is the version gate's job, not lenient parsing's.
	const typo = `
version: 1
hosts:
  - host: "*"
    root: console
    aps:
      - name: console
        allow: [{ requires: [anyone] }]
`
	if _, err := compose.DecodeRuleSet(strings.NewReader(typo)); err == nil {
		t.Fatal("decoder accepted an unknown field; a silently ignored visibility field is this package's own failure mode")
	}
}

func TestFileSourceIsStatic(t *testing.T) {
	// A nil watch channel is a normal answer for a source that does not watch,
	// and Follow must treat it as one rather than blocking forever.
	if ch := compose.NewFileSource("visibility.yaml").Watch(t.Context()); ch != nil {
		t.Error("FileSource claims to watch")
	}
}

// stringReader is a tiny helper the serving tests share; the decode functions
// take an io.Reader so the fixtures can stay inline as string constants.
func stringReader(s string) *strings.Reader { return strings.NewReader(s) }
