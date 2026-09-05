package compose

import (
	"context"
	"net/url"
	"strings"
)

// ReturnParam carries the caller's original target across a handoff.
//
// Named here rather than in the host because the engine is what writes the
// redirect, and a return parameter the destination page cannot predict is a
// return parameter nobody reads.
const ReturnParam = "next"

// refusalFor turns a refused request into what the caller actually receives.
//
// The ladder is the operator's chance to say something useful — "sign in",
// "request access" — to a caller who has already been identified far enough to
// deserve the explanation. Where no rung matches, the answer is the canonical
// not-found, which is the same answer an unclaimed path and an app absent from
// the build get.
//
// One hop, never two. A refusal that redirects to a page which itself refuses
// and redirects again is a loop, and the loop is indistinguishable from an
// outage — so the destination of a handoff is never re-resolved through the
// ladder. If the target refuses, the caller gets the canonical not-found and
// the operator has a misconfiguration to fix, not a browser spinning.
func refusalFor(ctx context.Context, rt *router, sc Scope, rule AppRule, refused App, target string, p Principal) Decision {
	rung, ok := pickRung(ctx, p, rule.Refuse)
	if !ok {
		// No rung: say nothing, and say it in the way that reveals nothing.
		// Falling through to the root is what this path would have answered had
		// the app never been built, which is what makes the two indistinguishable.
		if d, ok := fallThroughToRoot(ctx, rt, sc, refused, target, p); ok {
			return d
		}
		return Decision{Outcome: OutcomeRefuse}
	}

	dest, ok := handoffPath(rt, sc, rung.To)
	if !ok {
		// The rung names something this binary cannot serve. Validate fails
		// that at load precisely because it is not inert — it silently degrades
		// a promised explanation into a not-found. Reaching here means a set
		// arrived unvalidated, so answer as though the rung were not written.
		if d, ok := fallThroughToRoot(ctx, rt, sc, refused, target, p); ok {
			return d
		}
		return Decision{Outcome: OutcomeRefuse}
	}
	if underPrefix(target, dest) {
		// The caller is already at the destination. Redirecting them to where
		// they are is the loop this function exists to refuse.
		return Decision{Outcome: OutcomeRefuse}
	}

	return Decision{Outcome: OutcomeHandoff, Handoff: withReturn(dest, target)}
}

// handoffPath resolves a rung target to a path this binary can actually serve.
//
// A target may name an app or a page. An app resolves to its mount; a page is
// taken as a path and is only accepted if some app on this listener claims it,
// so a rung cannot send a caller somewhere nothing answers.
func handoffPath(rt *router, sc Scope, to string) (string, bool) {
	if app, ok := rt.byName[to]; ok {
		if _, mentioned := appRule(sc, app.Name); !mentioned {
			// Sending a caller to an app this hostname refuses would hand them
			// a not-found and tell them nothing, which is worse than the plain
			// refusal they would otherwise have got.
			return "", false
		}
		return app.Path, true
	}
	if !strings.HasPrefix(to, "/") {
		return "", false
	}
	if _, kind := rt.claimFor(to); kind == claimApp {
		return to, true
	}
	// A page under the scope's root — the common case, since login and access
	// pages live in the console.
	if _, has := rt.byName[sc.Root]; has {
		return to, true
	}
	return "", false
}

// withReturn appends the caller's original target so the destination can send
// them back.
//
// Scheme and host are dropped deliberately, and this is the one piece of
// behaviour lifted verbatim from the existing login-return logic rather than
// redesigned. A return target that carries an origin is an open redirect: the
// destination page will follow it after a successful sign-in, so an attacker
// who can choose it can bounce a freshly-authenticated caller anywhere. A
// path-only value cannot leave this origin.
func withReturn(dest, target string) string {
	if target == "" || target == "/" {
		return dest
	}
	u, err := url.Parse(target)
	if err != nil {
		return dest
	}
	// Path and query only — never u.Scheme or u.Host.
	back := u.EscapedPath()
	if back == "" {
		return dest
	}
	if u.RawQuery != "" {
		back += "?" + u.RawQuery
	}

	sep := "?"
	if strings.Contains(dest, "?") {
		sep = "&"
	}
	return dest + sep + ReturnParam + "=" + url.QueryEscape(back)
}
