package compose

import (
	"bytes"
	"context"
	"encoding/json"
	"io/fs"
	"net/http"
)

// The framework's own development namespace: the dev console every page is
// given, and the index of apps it browses between.
//
// A root of its own rather than a name under AssetNamespace, because nothing
// here belongs to an app — the console is injected into every app on the
// listener, and the index describes all of them.
const (
	DevNamespace = "/_compose/"
	// DevScript is the console's entry file within HandlerOptions.DevTools. A
	// fixed name, not a fingerprinted one, so it is served no-cache: a page
	// must never boot the console a previous build shipped.
	DevScript     = "devcog.js"
	DevScriptPath = DevNamespace + DevScript
	// AppIndexPath answers which apps this caller can reach from this page.
	AppIndexPath = DevNamespace + "apps.json"

	// devToolsMarker makes injection idempotent. In the hot loop a page can
	// cross two injectors — a server that renders it and the dev front door in
	// front of that server — and two consoles on one page fight over every key.
	devToolsMarker = "data-compose-devtools"
)

// DevToolsTag is the fragment that boots the dev console on a page.
func DevToolsTag() []byte {
	return []byte(`<script type="module" src="` + DevScriptPath + `" ` + devToolsMarker + `></script>`)
}

// InjectDevTools puts the dev console's tag into a document once, and reports
// whether the document now carries it.
func InjectDevTools(doc []byte) ([]byte, bool) {
	if bytes.Contains(doc, []byte(devToolsMarker)) {
		return doc, true
	}
	return InjectBeforeHeadClose(doc, DevToolsTag())
}

// IndexEntry is one app a caller can navigate to.
type IndexEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	// Root marks the app answering this hostname's unclaimed paths.
	Root bool `json:"root,omitempty"`
}

// AppIndex is what AppIndexPath answers.
type AppIndex struct {
	Apps []IndexEntry `json:"apps"`
}

// index lists the apps a caller can reach on this listener and hostname, in the
// order the profile declared them.
//
// It is Resolve asked for every app at once, and it must stay that: an entry
// the caller would be refused is a link that lands on another app's shell, and
// an app the binary does not carry is a disclosure. So a "/"-claiming app that
// is not this hostname's root is left out too — nothing routes to it here.
func (rt *router) index(ctx context.Context, rs RuleSet, host string, p Principal) AppIndex {
	out := AppIndex{Apps: []IndexEntry{}}
	scope, ok := scopeFor(rs, rt.listener, host)
	if !ok {
		return out
	}
	for _, a := range rt.ordered {
		if a.Path == "/" && a.Name != scope.Root {
			continue
		}
		rule, mentioned := appRule(scope, a.Name)
		if !mentioned || !matchAny(ctx, p, rule.Allow) {
			continue
		}
		out.Apps = append(out.Apps, IndexEntry{Name: a.Name, Path: a.Path, Root: a.Name == scope.Root})
	}
	return out
}

// hasDevScript reports whether a bundle can boot the console. One without its
// script still turns the namespace on — an app that mounts its own console
// reads the index regardless — but is not injected: a tag pointing at a 404 is
// an error on every page load.
func hasDevScript(fsys fs.FS) bool {
	f, _, ok := openFile(fsys, DevScript)
	if ok {
		_ = f.Close()
	}
	return ok
}

// withDevTools wraps the host's shell hook so every rendered page also boots
// the console. The host's hook runs first: it owns the document, and the
// console is an addition to whatever it produced.
func withDevTools(shell func(App, []byte) []byte) func(App, []byte) []byte {
	return func(a App, doc []byte) []byte {
		if shell != nil {
			doc = shell(a, doc)
		}
		// A document with no head close already failed the host's own
		// injection, which is where that gets reported.
		out, _ := InjectDevTools(doc)
		return out
	}
}

// serveDevTools answers the development namespace.
func serveDevTools(w http.ResponseWriter, r *http.Request, bundle fs.FS, rt *router, rs RuleSet, p Principal, urlPath string) {
	switch urlPath {
	case AppIndexPath:
		w.Header().Set("Content-Type", "application/json")
		// Per caller and per hostname, so no shared cache may keep it.
		w.Header().Set("Cache-Control", "no-store")
		// Explicit: a host's NoRoute writer (gin's) arrives preset to 404, and
		// an implicit status would ship the index as a miss.
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(rt.index(r.Context(), rs, hostOf(r, rs), p))
	case DevScriptPath:
		f, info, ok := openFile(bundle, DevScript)
		if !ok {
			writeCanonicalNotFound(w)
			return
		}
		defer f.Close()
		writeAsset(w, r, bundle, DevScript, f, info, false)
	default:
		writeCanonicalNotFound(w)
	}
}
