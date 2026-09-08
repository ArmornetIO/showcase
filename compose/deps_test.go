package compose_test

import (
	"os/exec"
	"strings"
	"testing"
)

// Import paths this module must never reach, and what each would cost.
//
// Written as a test and not a review convention because the constraint is
// negative: nothing about adding one of these fails to compile, and by the time
// someone notices, the module is no longer extractable and the standalone tool
// no longer runs where armornet does not. This is the check that makes the
// open-source boundary real rather than aspirational — it should run in CI from
// the first commit.
var banned = map[string]string{
	"github.com/gin-gonic/gin":       "the engine is a plain http.Handler; the host adapts it with one gin.WrapH line",
	"k8s.io/":                        "everything cluster-aware belongs in the host behind RuleSource",
	"github.com/google/cel-go":       "the rule vocabulary is closed and named, which is what makes Validate able to answer at all",
	"github.com/open-policy-agent/":  "same reason as cel-go: an expression language is a rule set nobody can check",
	"github.com/ArmornetIO/armornet": "the engine must build and run with no armornet code present",
}

func TestModuleImportsNothingItShouldNot(t *testing.T) {
	// `go list -deps` over this module's own packages resolves the FULL
	// transitive graph, so a banned import three hops down a helper is caught
	// as surely as a direct one.
	out, err := exec.Command("go", "list", "-deps", "./...").CombinedOutput()
	if err != nil {
		t.Fatalf("go list -deps: %v\n%s", err, out)
	}
	for dep := range strings.FieldsSeq(string(out)) {
		for prefix, why := range banned {
			if strings.HasPrefix(dep, prefix) {
				t.Errorf("compose depends on %s\n  banned prefix: %s\n  why: %s", dep, prefix, why)
			}
		}
	}
}

// The allowlist is the positive half of the same rule: the standard library,
// this module, and a YAML decoder. Anything else is a dependency decision, and
// a dependency decision in a module whose whole value is being extractable
// deserves to be a deliberate edit here rather than a `go get`.
var allowedNonStdlib = []string{
	"github.com/ArmornetIO/showcase/compose",
	"gopkg.in/yaml.v3",
}

func TestModuleHasOnlyTheDeclaredThirdPartyDependencies(t *testing.T) {
	out, err := exec.Command("go", "list", "-deps", "./...").CombinedOutput()
	if err != nil {
		t.Fatalf("go list -deps: %v\n%s", err, out)
	}
	for dep := range strings.FieldsSeq(string(out)) {
		// A stdlib import path has no dot in its first segment.
		first, _, _ := strings.Cut(dep, "/")
		if !strings.Contains(first, ".") {
			continue
		}
		if !hasPrefixAny(dep, allowedNonStdlib) {
			t.Errorf("undeclared third-party dependency %s — add it to allowedNonStdlib only if you mean it", dep)
		}
	}
}

func hasPrefixAny(s string, prefixes []string) bool {
	for _, p := range prefixes {
		if strings.HasPrefix(s, p) {
			return true
		}
	}
	return false
}
