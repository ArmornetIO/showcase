package compose

import (
	"context"
	"fmt"
	"net/http"
)

// Outcome is what the resolver decided to do with a request.
type Outcome int

const (
	// OutcomeServe means an app answers.
	OutcomeServe Outcome = iota
	// OutcomeRefuse means the caller does not get to know the app exists.
	OutcomeRefuse
	// OutcomeHandoff means the caller is sent somewhere that can explain, one
	// hop, target preserved.
	OutcomeHandoff
	// OutcomeUnbuilt means a declared app has no bundle. Only reachable in a
	// development build; in a shipped binary an app with no bytes cannot have
	// been linked in.
	OutcomeUnbuilt
)

// Decision is one request's answer. Everything the response needs is on it, so
// that the refusal path has no branch that could accidentally differ per call
// site — which is the whole of FR-012.
type Decision struct {
	Outcome Outcome
	// App is the app that answers, set only for OutcomeServe and OutcomeUnbuilt.
	App *App
	// Handoff is the absolute-path target for OutcomeHandoff, with the caller's
	// original target preserved in its query.
	Handoff string
}

// WriteRefusal writes every refusal, on every path, from this one function.
//
// FR-012 requires the response to a rule-refused app, a path claimed by no app,
// and an app absent from the build to be identical — status, headers and body.
// A difference in a single header is the disclosure, so there is exactly one
// writer and no second place to get it wrong. Two prior behaviours collapse in
// here: the SPA shell set a cache header a plain not-found did not, and asset
// misses answered differently again.
func (d Decision) WriteRefusal(w http.ResponseWriter, r *http.Request) {
	switch d.Outcome {
	case OutcomeHandoff:
		// A handoff is not a refusal in disguise — it is an operator's explicit
		// decision to tell this caller something, written as a refuse rung. The
		// caller already knows the target exists, because they were sent to it.
		http.Redirect(w, r, d.Handoff, http.StatusSeeOther)
	case OutcomeUnbuilt:
		writeUnbuilt(w, d.App)
	default:
		writeCanonicalNotFound(w)
	}
}

// writeCanonicalNotFound is the ONE not-found response this package emits.
//
// Byte-for-byte http.NotFound's, and deliberately so: the response a caller
// gets for an app they may not see has to be the response any unrouted URL on
// this server gets, and the cheapest way to guarantee that is to emit the same
// bytes the standard library does for every other miss. No cache header, no
// Content-Length variation, nothing derived from the request.
func writeCanonicalNotFound(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusNotFound)
	fmt.Fprintln(w, "404 page not found")
}

// writeUnbuilt is the ONE exemption from the identical-response rule, and it is
// gated on the development switch.
//
// A declared app with no bundle answers with a diagnostic naming it and how to
// start its dev server. That diagnostic is the only thing standing between a
// developer and this feature's own motivating failure — an app that was
// declared, was not being served, and said nothing about it until a person
// clicked a link. Outside development the exemption does not exist and the
// canonical not-found is written instead.
func writeUnbuilt(w http.ResponseWriter, a *App) {
	if !devMode.Load() || a == nil {
		writeCanonicalNotFound(w)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusServiceUnavailable)
	fmt.Fprintf(w, "compose: app %q is declared in apps.yaml but has no bundle.\n\n", a.Name)
	fmt.Fprintf(w, "Start its dev server:\n    make dev-app APP=%s\n\n", a.Name)
	fmt.Fprintf(w, "Or build it into the binary:\n    make build\n\n")
	fmt.Fprintf(w, "This message appears in development builds only.\n")
}

// pickRung selects the refusal ladder rung for a caller: the first whose
// conditions hold. A rung with no conditions matches anyone, which is how the
// terminal rung is written. No rung matching means the canonical not-found,
// which is also what an app with no ladder at all gets.
func pickRung(ctx context.Context, p Principal, ladder []Rung) (Rung, bool) {
	for _, ru := range ladder {
		if len(ru.When) == 0 || matchRow(ctx, p, ru.When) {
			return ru, true
		}
	}
	return Rung{}, false
}
