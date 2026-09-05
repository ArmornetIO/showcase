package compose

import (
	"context"
	"sort"
	"strings"
)

// router is the path→app half of the decision, computed ONCE at Handler
// construction.
//
// Per-request work is a prefix walk over a slice that is already sorted longest
// first, plus a map lookup. Rebuilding this per request would turn every asset
// fetch into a sort, and assets are the bulk of the traffic.
type router struct {
	listener string
	// claims are the apps with a real prefix, longest first, so the first match
	// is the most specific one. "/"-claiming apps are NOT here: they do not own
	// a prefix, they are candidates for what nothing else claimed.
	claims []claim
	// assets maps an app's own namespace to it. Separate from claims because an
	// asset URL must resolve to its owner even when another app claims the path
	// it appears to sit under.
	assets []claim
	byName map[string]App
	// shared are root-relative URLs no app owns.
	shared []string
}

type claim struct {
	prefix string
	app    App
}

func newRouter(s Set, listener string, shared []string) *router {
	rt := &router{listener: listener, byName: map[string]App{}, shared: shared}
	for _, a := range s.Apps() {
		if listenerOf(a) != listener {
			continue
		}
		rt.byName[a.Name] = a
		if a.Path != "/" {
			rt.claims = append(rt.claims, claim{prefix: a.Path, app: a})
		}
		if a.AssetPrefix != "" {
			rt.assets = append(rt.assets, claim{prefix: a.AssetPrefix, app: a})
		}
	}
	longestFirst := func(c []claim) {
		sort.SliceStable(c, func(i, j int) bool { return len(c[i].prefix) > len(c[j].prefix) })
	}
	longestFirst(rt.claims)
	longestFirst(rt.assets)
	return rt
}

// claimKind is what a path resolved to.
type claimKind int

const (
	// claimNone means no app claims it; the caller falls back to the root.
	claimNone claimKind = iota
	// claimApp means an app owns it.
	claimApp
	// claimReserved means it is inside the asset namespace but no app in this
	// build owns it. It must NOT fall through to the root's SPA shell — see
	// claimFor.
	claimReserved
)

// claims reports which app owns a path, and whether the answer came from a real
// prefix or from falling through to the scope's root.
//
// Order matters and is not arbitrary:
//
//  1. asset namespaces, because an asset belongs to the app that built it
//     regardless of which app claims the URL it looks like it sits under;
//  2. shared URLs, which no app owns and which therefore fall to the root —
//     they are fetched root-relative by several apps on purpose, and the wasm
//     loader breaks the moment one app is allowed to claim them;
//  3. the longest matching prefix;
//  4. nothing — the caller falls back to the scope's root.
func (rt *router) claimFor(path string) (App, claimKind) {
	for _, c := range rt.assets {
		if underPrefix(path, c.prefix) {
			return c.app, claimApp
		}
	}
	// Inside the asset namespace but owned by nothing in this build. RESERVED,
	// not unclaimed — and the difference is a disclosure.
	//
	// Falling through to the root's SPA shell here answers 200 with the root
	// app's index.html for /_apps/<absent-app>/x.js, while the same URL for an
	// app that IS built but refused answers 404. That difference enumerates the
	// binary: probe an asset namespace and the status code tells you whether
	// the app was compiled in. An asset URL is never a client-router route, so
	// there is nothing to lose by refusing it outright.
	if strings.HasPrefix(path, AssetNamespace) {
		return App{}, claimReserved
	}
	for _, s := range rt.shared {
		if path == s || strings.HasPrefix(path, s) {
			return App{}, claimNone
		}
	}
	for _, c := range rt.claims {
		if underPrefix(path, c.prefix) {
			return c.app, claimApp
		}
	}
	return App{}, claimNone
}

// underPrefix reports whether path is the prefix itself or beneath it.
//
// Segment-aware, so /breach does not claim /breach-admin. Getting this wrong in
// the permissive direction hands one app another app's URLs; getting it wrong
// in the strict direction 404s an app's own root.
func underPrefix(path, prefix string) bool {
	if prefix == "/" {
		return true
	}
	p := strings.TrimSuffix(prefix, "/")
	return path == p || strings.HasPrefix(path, p+"/")
}

// Resolve decides what answers one request. The whole procedure, in order.
//
// Every step that does not produce an app produces a REFUSAL, and the refusal
// is written by one function so that "no scope for this hostname", "no app
// claims this path", "this app is not granted here" and "this app is not in
// this build" are indistinguishable to the caller. That indistinguishability is
// the feature: a visitor to the job board's hostname must not be able to tell
// the console was ever compiled in.
func (rt *router) Resolve(ctx context.Context, rs RuleSet, host, path string, p Principal) Decision {
	scope, ok := scopeFor(rs, rt.listener, host)
	if !ok {
		return Decision{Outcome: OutcomeRefuse}
	}

	app, kind := rt.claimFor(path)
	if kind == claimReserved {
		return Decision{Outcome: OutcomeRefuse}
	}
	if kind == claimNone {
		// Unclaimed paths and shared URLs go to this hostname's root. The root
		// is what makes several apps able to claim "/" without ambiguity: they
		// are all eligible, and the scope picks.
		root, has := rt.byName[scope.Root]
		if !has {
			// The root names an app this binary does not carry. Validate fails
			// a set like this at load, so reaching here means a set was
			// installed some other way — and the safe answer grants nothing.
			return Decision{Outcome: OutcomeRefuse}
		}
		app = root
	}

	rule, mentioned := appRule(scope, app.Name)
	if !mentioned {
		// Unmentioned is refused. There are no deny rows in this vocabulary, so
		// silence is the denial and there is no precedence question. It goes
		// through the same refusal path as an explicit denial so that the two
		// are answered identically — an operator who removed an app from a scope
		// and one who never added it owe the caller the same nothing.
		return refusalFor(ctx, rt, scope, AppRule{}, app, path, p)
	}

	if matchAny(ctx, p, rule.Allow) {
		if isEmptyBundle(app) {
			// Declared, granted, and not built. Only reachable in development;
			// a shipped binary cannot link an app with no bytes.
			return Decision{Outcome: OutcomeUnbuilt, App: &app}
		}
		return Decision{Outcome: OutcomeServe, App: &app}
	}

	return refusalFor(ctx, rt, scope, rule, app, path, p)
}

// fallThroughToRoot answers a refused path with the scope's root app, which is
// what that path would have answered had the refused app never been built.
//
// This is how FR-012 is satisfied STRUCTURALLY rather than by matching headers.
// A caller asking for /secret on a host that refuses it gets the root app's
// shell — precisely what they would get if `secret` were absent from the
// binary, because an unclaimed path falls to the root either way. Emitting a
// canonical 404 instead would have been the leak: /secret would answer 404 when
// the app exists-but-is-refused and 200 when it does not exist at all, and a
// caller could enumerate the build by reading status codes.
//
// It does not apply when the root itself is the refused app, or when the root
// is not granted here — then there is genuinely nothing to answer with.
// It also does not apply to an ASSET path. An asset URL is never a client-router
// route, so answering one with the root's shell would both be wrong (a stylesheet
// request served HTML) and re-open the leak: /_apps/<refused>/x.js would answer
// 200 while /_apps/<absent>/x.js answers 404. Assets are refused in both cases,
// which is what makes those two indistinguishable.
func fallThroughToRoot(ctx context.Context, rt *router, sc Scope, refused App, path string, p Principal) (Decision, bool) {
	if strings.HasPrefix(path, AssetNamespace) {
		return Decision{}, false
	}
	root, has := rt.byName[sc.Root]
	if !has || root.Name == refused.Name {
		return Decision{}, false
	}
	rule, mentioned := appRule(sc, root.Name)
	if !mentioned || !matchAny(ctx, p, rule.Allow) {
		return Decision{}, false
	}
	if isEmptyBundle(root) {
		return Decision{}, false
	}
	return Decision{Outcome: OutcomeServe, App: &root}, true
}

func appRule(sc Scope, name string) (AppRule, bool) {
	for _, ar := range sc.Apps {
		if ar.Name == name {
			return ar, true
		}
	}
	return AppRule{}, false
}

// isEmptyBundle reports whether an app has no built assets. An app with a
// zero-build fallback is never empty — that is what the fallback is for.
func isEmptyBundle(a App) bool {
	if len(a.Builtin) > 0 {
		return false
	}
	if a.Files == nil {
		return true
	}
	f, err := a.Files.Open("index.html")
	if err != nil {
		return true
	}
	_ = f.Close()
	return false
}
