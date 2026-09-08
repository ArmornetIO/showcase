package compose

import (
	"fmt"
	"io/fs"
	"sort"
)

// App is one compiled-in micro-frontend. Generated: cmd/appgen emits an App
// value per manifest entry, each owning its own embed.FS, so an app package
// that no profile imports is not compiled and its bytes genuinely do not ship.
type App struct {
	Name string
	// Path is the mount prefix. "/" means "eligible to answer what no other
	// prefix claimed" — which app actually does so on a given hostname is the
	// scope's Root, not a property of the app.
	Path string
	// AssetPrefix is this app's private root-relative namespace, derived from
	// Name. Two apps may both claim "/", so it cannot come from Path.
	AssetPrefix string
	Listener    string
	// Files is the built bundle, rooted at the app itself.
	Files fs.FS
	// Builtin is a zero-build fallback document served when Files is empty, so
	// a plain build still yields a working page. Nil when the app declares none.
	Builtin []byte
}

// Set is the apps one binary carries, and which of them answers unclaimed paths
// on each listener.
type Set struct {
	apps  []App
	roots map[string]string // listener -> app name
	// shared are root-relative URLs no app owns. On the Set and not on an App
	// precisely because no app owns them — they are a property of the whole
	// composition, and the first faithful one-owner-per-asset rule broke the
	// game's wasm loader by having nowhere to put them.
	shared []string
}

// Option configures a Set. A profile is a Go file of these — the explicit-import
// idiom engine/registry.go already uses for agents and tools.
type Option func(*Set)

// Root declares the app that answers unclaimed paths on its own listener.
func Root(a App) Option {
	return func(s *Set) {
		s.add(a)
		s.roots[listenerOf(a)] = a.Name
	}
}

// Also adds apps without making any of them a root.
func Also(apps ...App) Option {
	return func(s *Set) {
		for _, a := range apps {
			s.add(a)
		}
	}
}

// On adds apps to a named listener, overriding whatever listener they declare.
// The installer is why this exists: it is served by a separate process on
// loopback, and naming the listener is what lets one engine serve both.
func On(listener string, apps ...App) Option {
	return func(s *Set) {
		for _, a := range apps {
			a.Listener = listener
			s.add(a)
		}
	}
}

// MustSet builds a Set and panics at init on a listener with no root.
//
// It panics rather than returning an error because a profile is a package-level
// var: there is no caller to hand an error to, and a binary whose "/" answers
// nothing is not a runnable program. Go cannot enforce a required field at
// compile time, so this is the second of three layers — the generated
// per-profile test is the third.
func MustSet(opts ...Option) Set {
	s := Set{roots: map[string]string{}}
	for _, o := range opts {
		o(&s)
	}
	if len(s.apps) == 0 {
		panic("compose: profile declares no apps")
	}
	var missing []string
	for l := range s.listeners() {
		if s.roots[l] == "" {
			missing = append(missing, l)
		}
	}
	sort.Strings(missing)
	if len(missing) > 0 {
		panic(fmt.Sprintf("compose: no Root() for listener(s) %v — nothing would answer / there", missing))
	}
	return s
}

func (s *Set) add(a App) {
	for _, e := range s.apps {
		if e.Name == a.Name {
			panic(fmt.Sprintf("compose: app %q added to the profile twice", a.Name))
		}
	}
	s.apps = append(s.apps, a)
}

func (s Set) listeners() map[string]bool {
	out := map[string]bool{}
	for _, a := range s.apps {
		out[listenerOf(a)] = true
	}
	return out
}

func listenerOf(a App) string {
	if a.Listener == "" {
		return WebListener
	}
	return a.Listener
}

// SharedPaths returns the root-relative URLs no app owns.
func (s Set) SharedPaths() []string { return append([]string(nil), s.shared...) }

// Apps returns the set's apps, in the order the profile declared them.
func (s Set) Apps() []App { return append([]App(nil), s.apps...) }

// Names returns every app name in the set.
func (s Set) Names() []string {
	out := make([]string, len(s.apps))
	for i, a := range s.apps {
		out[i] = a.Name
	}
	return out
}

// App returns the named app if this binary carries it.
func (s Set) App(name string) (App, bool) {
	for _, a := range s.apps {
		if a.Name == name {
			return a, true
		}
	}
	return App{}, false
}

// RootFor returns the app answering unclaimed paths on a listener.
func (s Set) RootFor(listener string) (App, bool) {
	if listener == "" {
		listener = WebListener
	}
	name, ok := s.roots[listener]
	if !ok {
		return App{}, false
	}
	return s.App(name)
}
