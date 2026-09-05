package compose

import (
	"context"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
)

// Principal is the caller, opaque to the engine. The host resolves it from the
// request and the host's own traits interpret it; the engine only ever passes
// it through, which is what keeps identity out of this module.
type Principal any

// PrincipalFunc resolves the caller from a request. Returning nil means
// anonymous — which is a valid answer, not an error.
type PrincipalFunc func(r *http.Request) Principal

// TraitFunc answers one trait for one caller. The argument is whatever followed
// the colon in "family:arg", empty for a bare family.
type TraitFunc func(ctx context.Context, p Principal, arg string) bool

var (
	traitMu sync.RWMutex
	traits  = map[string]TraitFunc{}

	// devMode gates the one refusal exemption. A variable and not a build tag
	// because the diagnostic it enables is the only thing standing between a
	// developer and this feature's own motivating failure — and a behaviour
	// reachable only under a build tag is a behaviour with no test.
	devMode atomic.Bool
)

// Built-in trait families. Everything else belongs to the host: the product
// registers entitled/role/fga, the standalone CLI registers none and offers
// --trait overrides instead.
func init() {
	RegisterTrait("anyone", func(context.Context, Principal, string) bool { return true })
	RegisterTrait("signed-in", func(_ context.Context, p Principal, _ string) bool { return p != nil })
	RegisterTrait("dev", func(context.Context, Principal, string) bool { return devMode.Load() })
}

// RegisterTrait adds a trait family. A rule naming an unregistered family fails
// to LOAD rather than evaluating false: the host knows its families at compile
// time, so a typo is a typo and must be loud. Registering the same family twice
// panics — two answers to one question is not a configuration, it is a race.
func RegisterTrait(family string, fn TraitFunc) {
	if family == "" || strings.Contains(family, ":") {
		panic("compose: trait family " + family + " must be non-empty and contain no colon")
	}
	traitMu.Lock()
	defer traitMu.Unlock()
	if _, dup := traits[family]; dup {
		panic("compose: trait family " + family + " registered twice")
	}
	traits[family] = fn
}

// SetDev enables the development-only refusal diagnostic. Off by default, so a
// production binary that never calls it cannot leak the diagnostic.
func SetDev(on bool) { devMode.Store(on) }

// DevEnabled reports whether the development exemption is active.
func DevEnabled() bool { return devMode.Load() }

// RegisteredTraits returns the known families, sorted.
//
// FR-027 requires the product and the standalone tool to reach identical
// decisions for identical inputs — which holds only if the registered trait set
// is counted as an input. This is how a caller counts it.
func RegisteredTraits() []string {
	traitMu.RLock()
	defer traitMu.RUnlock()
	out := make([]string, 0, len(traits))
	for f := range traits {
		out = append(out, f)
	}
	sort.Strings(out)
	return out
}

// TraitRegistered reports whether a family is known. Validate uses it; nothing
// on the request path should need to ask.
func TraitRegistered(family string) bool {
	traitMu.RLock()
	defer traitMu.RUnlock()
	_, ok := traits[family]
	return ok
}

// splitTrait splits "family:arg" into its parts. A bare family has an empty arg.
func splitTrait(t string) (family, arg string) {
	family, arg, _ = strings.Cut(t, ":")
	return family, arg
}

// evalTrait answers one trait. An unregistered family is FALSE — a load-time
// failure has already refused that rule set, so reaching here means a set was
// swapped in behind our back, and the safe answer is the one that grants
// nothing.
func evalTrait(ctx context.Context, p Principal, t string) bool {
	family, arg := splitTrait(t)
	traitMu.RLock()
	fn, ok := traits[family]
	traitMu.RUnlock()
	if !ok {
		return false
	}
	return fn(ctx, p, arg)
}

// matchRow reports whether every trait in a row holds. Rows are CONJUNCTIONS
// and an unresolvable trait is false, so fail-closed is a property of the shape
// rather than a rule anyone has to remember: a row containing something the
// host cannot answer can never match, and there is no negation to invert it.
func matchRow(ctx context.Context, p Principal, requires []string) bool {
	if len(requires) == 0 {
		// An empty conjunction is vacuously true in logic, and that is exactly
		// the wrong answer here: `allow: [{}]` would read as "no conditions
		// yet" and grant everyone. Say `requires: [anyone]` and mean it.
		return false
	}
	for _, t := range requires {
		if !evalTrait(ctx, p, t) {
			return false
		}
	}
	return true
}

// matchAny reports whether any row matches. Rows are ORed; the first match wins
// and the rest are not evaluated.
func matchAny(ctx context.Context, p Principal, rows []Row) bool {
	for _, r := range rows {
		if matchRow(ctx, p, r.Requires) {
			return true
		}
	}
	return false
}
