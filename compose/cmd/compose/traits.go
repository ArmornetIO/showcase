package main

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/ArmornetIO/showcase/compose"
)

// traitOverrides collects --trait flags into a registerable trait set.
//
// This is the one mechanism serving three callers that would otherwise each
// grow their own: the test harness deciding what a caller is, this tool
// inspecting a decision without the product running, and the in-app developer
// override. FR-027 requires the host and the CLI to reach identical decisions
// for identical inputs — and the registered trait set IS an input, so the tool
// registering none of armornet's families and taking them from the command line
// is what makes the comparison meaningful rather than a coincidence.
type traitOverrides struct {
	// byFamily is the answer for a bare family, and the fallback for an
	// argument this flag set did not name.
	byFamily map[string]bool
	// byArg is the answer for one "family:arg" specifically. Separate from
	// byFamily because `--trait entitled:armory=true` must not also grant
	// `entitled:anything-else`.
	byArg map[string]map[string]bool
	order []string
}

func newTraitOverrides() *traitOverrides {
	return &traitOverrides{byFamily: map[string]bool{}, byArg: map[string]map[string]bool{}}
}

func (t *traitOverrides) String() string { return strings.Join(t.order, ",") }

// Set parses one `family[:arg]=bool`. The value is required: a bare `--trait
// entitled` would have to mean true, and a trait silently defaulting to true is
// how a grant appears in a decision nobody asked for.
func (t *traitOverrides) Set(v string) error {
	key, val, ok := strings.Cut(v, "=")
	if !ok {
		return fmt.Errorf("trait %q must be family[:arg]=true|false", v)
	}
	var b bool
	switch strings.ToLower(strings.TrimSpace(val)) {
	case "true", "yes", "1":
		b = true
	case "false", "no", "0":
		b = false
	default:
		return fmt.Errorf("trait %q: value %q must be true or false", v, val)
	}

	family, arg, hasArg := strings.Cut(strings.TrimSpace(key), ":")
	if family == "" {
		return fmt.Errorf("trait %q names no family", v)
	}
	if compose.TraitRegistered(family) {
		// The built-ins are the engine's own vocabulary and re-registering one
		// panics. Refusing here names the family and the flag that does work,
		// rather than crashing with a stack trace.
		return fmt.Errorf("trait family %q is built into the engine and cannot be overridden (use --dev for the dev family)", family)
	}
	if hasArg {
		if t.byArg[family] == nil {
			t.byArg[family] = map[string]bool{}
		}
		t.byArg[family][arg] = b
	} else {
		t.byFamily[family] = b
	}
	t.order = append(t.order, v)
	return nil
}

// families returns every family this flag set mentions, sorted so registration
// order cannot vary between runs.
func (t *traitOverrides) families() []string {
	seen := map[string]bool{}
	for f := range t.byFamily {
		seen[f] = true
	}
	for f := range t.byArg {
		seen[f] = true
	}
	out := make([]string, 0, len(seen))
	for f := range seen {
		out = append(out, f)
	}
	sort.Strings(out)
	return out
}

// register installs the overrides as trait families.
//
// An unmentioned argument under a mentioned family answers the family's own
// value, defaulting to FALSE. That default is deliberate: an unknown trait must
// never grant, because a rule row is a conjunction and false is the only answer
// that cannot turn a refusal into a grant by accident.
func (t *traitOverrides) register() {
	for _, family := range t.families() {
		fallback := t.byFamily[family]
		args := t.byArg[family]
		compose.RegisterTrait(family, func(_ context.Context, _ compose.Principal, arg string) bool {
			if v, ok := args[arg]; ok {
				return v
			}
			return fallback
		})
	}
}
