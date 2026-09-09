package compose

import (
	"fmt"
	"sort"
	"strings"
)

// Severity separates a problem that must stop a load from one that must only be
// reported. The split is not cosmetic: at write time validation rejects, but at
// load time it must not crash, because ONE visibility document is expected to
// serve several build profiles.
type Severity int

const (
	// Warn is inert: the rule cannot do anything in this binary, and the
	// binary is not the only one this document configures.
	Warn Severity = iota
	// Fail is an unsatisfiable obligation: something the document promises
	// cannot be delivered at all.
	Fail
)

func (s Severity) String() string {
	if s == Fail {
		return "fail"
	}
	return "warn"
}

// Problem is one validation finding, addressed well enough to fix.
type Problem struct {
	Severity Severity
	// Where names the scope, app or rung the problem is in.
	Where string
	// Message says what is wrong and, where it is not obvious, why it matters.
	Message string
}

func (p Problem) String() string {
	return fmt.Sprintf("%s: %s: %s", p.Severity, p.Where, p.Message)
}

// Problems is a findings list.
type Problems []Problem

// Failed reports whether anything in the list must stop a load.
func (ps Problems) Failed() bool {
	for _, p := range ps {
		if p.Severity == Fail {
			return true
		}
	}
	return false
}

func (ps Problems) String() string {
	var b strings.Builder
	for _, p := range ps {
		b.WriteString("  ")
		b.WriteString(p.String())
		b.WriteString("\n")
	}
	return b.String()
}

// Err is the list as an error, or nil when nothing must stop a load. A method
// rather than Problems implementing error: a Problems value carrying only
// warnings is a successful validation, and an error type that is never nil is
// how a warning becomes an outage.
func (ps Problems) Err() error {
	if !ps.Failed() {
		return nil
	}
	return fmt.Errorf("visibility rules are not usable:\n%s", ps)
}

// Validate checks a rule set against the compiled-in vocabulary. One function,
// three call sites: when a change is composed (reject), when a change is
// accepted (reject — never trust the composer), and before a set is swapped in
// (keep last known good, report loudly).
//
// present is the apps THIS binary actually carries, and it is what separates a
// warning from a failure: a grant naming an app outside this profile is inert,
// while a refusal target or a host root naming something absent is a promise
// the binary cannot keep.
func Validate(m Manifest, rs RuleSet, present []string) Problems {
	declared := map[string]bool{}
	for _, n := range m.Names() {
		declared[n] = true
	}
	built := map[string]bool{}
	for _, n := range present {
		built[n] = true
	}
	pages := pageNames(m)

	var out Problems
	add := func(sev Severity, where, format string, args ...any) {
		out = append(out, Problem{Severity: sev, Where: where, Message: fmt.Sprintf(format, args...)})
	}

	for _, sc := range rs.Hosts {
		where := "host " + sc.Host

		// Whether this scope can do anything at all in THIS binary.
		//
		// A scope none of whose apps are present is inert — no request can
		// reach it, because nothing it grants exists here. The installer's
		// loopback scope is the everyday case: it belongs to a listener a web
		// build does not even run, and failing the load over it would mean the
		// shipped default configuration could not start the shipped default
		// build. One document is expected to serve several profiles, and this
		// is what that promise costs.
		live := false
		for _, ar := range sc.Apps {
			if built[ar.Name] {
				live = true
				break
			}
		}
		// An inert scope's problems are reported, not fatal. A LIVE scope with
		// no answer for "/" is fatal, because that hostname really is broken.
		rootSeverity := Fail
		if !live {
			rootSeverity = Warn
		}

		switch {
		case sc.Root == "":
			add(Fail, where, "no root: nothing would answer / on this hostname")
		case !declared[sc.Root]:
			// A typo is a typo whether or not the scope is live: the vocabulary
			// is compiled in, so this can never become correct.
			add(Fail, where, "root %q is not an app in the manifest", sc.Root)
		case !built[sc.Root]:
			add(rootSeverity, where, "root %q is declared but not in this build: this hostname has no answer for / (inert here if this scope's apps are all absent too)", sc.Root)
		}

		seenApp := map[string]bool{}
		for _, ar := range sc.Apps {
			aw := where + " app " + ar.Name
			if seenApp[ar.Name] {
				add(Fail, aw, "named twice in one scope: two answers to one question is not a configuration")
			}
			seenApp[ar.Name] = true

			switch {
			case !declared[ar.Name]:
				// The vocabulary is compiled in, so an unknown name is a typo,
				// and a typo in a grant is a grant that silently does nothing.
				add(Fail, aw, "not an app in the manifest")
				continue
			case !built[ar.Name]:
				add(Warn, aw, "declared but not in this build — the rule is inert here, which is fine if this document also configures a profile that carries it")
			}

			if len(ar.Allow) == 0 {
				add(Warn, aw, "no allow rows: the app is mentioned but granted to nobody, which is the same as leaving it out")
			}
			for i, row := range ar.Allow {
				checkRow(fmt.Sprintf("%s allow[%d]", aw, i), row.Requires, add)
			}

			for i, ru := range ar.Refuse {
				rw := fmt.Sprintf("%s refuse[%d]", aw, i)
				// An empty `when` is the TERMINAL rung and entirely legal — it
				// is how "everyone else gets this" is written — so it does not
				// go through checkRow's empty-conjunction failure.
				if len(ru.When) > 0 {
					checkRow(rw, ru.When, add)
				}
				// Not inert, unlike an unknown grant: it silently degrades a
				// promised explanation into a not-found. The operator wrote a
				// page nobody will ever see and nothing said so.
				if !declared[ru.To] && !pages[ru.To] {
					add(Fail, rw, "refusal target %q is neither an app nor a page: the caller would get a not-found instead of the explanation this rung promises", ru.To)
				} else if declared[ru.To] && !built[ru.To] {
					// Same inertness rule as the root: unreachable in a build
					// that carries none of this scope's apps.
					add(rootSeverity, rw, "refusal target %q is not in this build: the caller would be sent to nothing", ru.To)
				}
			}

			for _, pr := range append(append([]PageRule(nil), ar.Pages...), ar.Groups...) {
				pw := aw + " page " + pr.Name
				for i, row := range pr.Allow {
					checkRow(fmt.Sprintf("%s allow[%d]", pw, i), row.Requires, add)
				}
			}
		}
	}

	sort.SliceStable(out, func(i, j int) bool { return out[i].Severity > out[j].Severity })
	return out
}

type addFunc func(sev Severity, where, format string, args ...any)

// checkRow validates one conjunction. An unregistered trait family fails: the
// host knows its families at compile time, so a typo cannot be allowed to
// evaluate quietly false and turn a grant into a refusal nobody ordered.
func checkRow(where string, requires []string, add addFunc) {
	if len(requires) == 0 {
		add(Fail, where, "empty requires: an empty conjunction would read as \"no conditions yet\"; write requires: [anyone] and mean it")
		return
	}
	for _, t := range requires {
		family, _ := splitTrait(t)
		if !TraitRegistered(family) {
			add(Fail, where, "unknown trait family %q in %q (registered: %s)", family, t, strings.Join(RegisteredTraits(), ", "))
		}
	}
}

// pageNames collects the page and group names a refusal rung may target. Only
// apps declaring a routes manifest contribute any; the generator is what reads
// those manifests and hands them here, so this package still touches no disk.
func pageNames(m Manifest) map[string]bool {
	out := map[string]bool{}
	for _, a := range m.Apps {
		for _, p := range a.pages {
			out[p] = true
		}
	}
	return out
}
