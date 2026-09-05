// Package compose serves several separately-built single-page apps from one
// process, deciding per request which app answers and whether the caller may
// see it.
//
// It imports the standard library and a YAML decoder, and nothing else. See
// README.md — that rule is the module's contract, not a style preference.
package compose

import (
	"fmt"
	"io"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// ManifestVersion is the document version this build understands.
const ManifestVersion = 1

// Manifest is apps.yaml: which apps exist, where each is mounted, and where its
// source lives. Presence, not permission — everything here is fixed at link
// time, which is why it is a separate document from the visibility rules.
type Manifest struct {
	Version int `yaml:"version"`
	// Shared are root-relative URLs no app owns. They exist because a handful
	// of assets (the wasm loader, the font files) are fetched root-relative on
	// purpose by more than one app, and a faithful one-owner-per-asset rule
	// would break them.
	Shared []string      `yaml:"shared"`
	Apps   []ManifestApp `yaml:"apps"`
}

// ManifestApp is one declared micro-frontend.
type ManifestApp struct {
	Name string `yaml:"name"`
	// Path is ONE prefix, not a list. Disjoint from every other app's, with the
	// single exception of "/" — which several apps may claim, because it means
	// "eligible to answer what no prefix claimed" rather than "owns every URL".
	Path      string `yaml:"path"`
	Source    string `yaml:"source"`
	Toolchain string `yaml:"toolchain"`
	Dev       Dev    `yaml:"dev"`
	// Listener is which listener serves this app; empty means the web listener.
	// The installer needs it: it is served by a separate process on loopback,
	// which is why its serving logic became a second implementation in the
	// first place.
	Listener string `yaml:"listener"`
	// Routes points at the app's own page manifest, and is what lets visibility
	// rules address this app's pages and groups by name.
	Routes string `yaml:"routes"`
	// Builtin is a zero-build fallback document, so a plain build still yields
	// a working page. A property of the app, not a special case in the server.
	Builtin string `yaml:"builtin"`

	// pages are the page and group names a visibility rule may address for this
	// app. NOT decoded from apps.yaml: they live in the app's own routes
	// manifest, which the CALLER reads and hands over via SetPages. Keeping that
	// read outside this package is what lets the engine stay disk-free.
	pages []string
}

// SetPages records the page and group names read from an app's routes manifest,
// so Validate can fail a refusal rung that targets a page nobody serves.
func (m *Manifest) SetPages(app string, names []string) error {
	for i := range m.Apps {
		if m.Apps[i].Name == app {
			m.Apps[i].pages = append([]string(nil), names...)
			return nil
		}
	}
	return fmt.Errorf("no app %q in the manifest", app)
}

// Pages returns the page and group names recorded for an app.
func (a ManifestApp) Pages() []string { return append([]string(nil), a.pages...) }

// Dev is the app's development-server configuration.
type Dev struct {
	Port int `yaml:"port"`
}

// Toolchains and where each writes its bundle. Adding one means teaching the
// generator a build directory, so the set is closed on purpose.
var toolchainOut = map[string]string{
	"sveltekit": "build",
	"vite":      "dist",
}

var appNameRe = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)

// DecodeManifest reads apps.yaml. Decoding is STRICT: an unknown field is a
// hard error and there is no lenient mode. A silently ignored field is this
// package's own failure mode — the bug it exists to prevent was a declaration
// that quietly did nothing.
func DecodeManifest(r io.Reader) (Manifest, error) {
	dec := yaml.NewDecoder(r)
	dec.KnownFields(true)

	var m Manifest
	if err := dec.Decode(&m); err != nil {
		return Manifest{}, fmt.Errorf("decoding manifest: %w", err)
	}
	if err := m.check(); err != nil {
		return Manifest{}, err
	}
	return m, nil
}

// check enforces the field rules. Version is checked first and reported on its
// own, so a host pinning an older engine against a newer document is told that
// in one sentence rather than by a confusing unknown-field error.
func (m Manifest) check() error {
	if m.Version != ManifestVersion {
		return fmt.Errorf("manifest version %d: this build understands version %d", m.Version, ManifestVersion)
	}
	if len(m.Apps) == 0 {
		return fmt.Errorf("manifest declares no apps")
	}
	for _, s := range m.Shared {
		if !strings.HasPrefix(s, "/") {
			return fmt.Errorf("shared entry %q must start with /", s)
		}
	}

	seenName := map[string]bool{}
	seenPort := map[int]string{}
	// Keyed by listener: two apps may share a path only if they answer on
	// different listeners, and "/" is exempt entirely.
	seenPath := map[string]string{}

	for _, a := range m.Apps {
		if !appNameRe.MatchString(a.Name) {
			return fmt.Errorf("app name %q must be lowercase kebab-case", a.Name)
		}
		if seenName[a.Name] {
			return fmt.Errorf("duplicate app name %q", a.Name)
		}
		seenName[a.Name] = true

		if !strings.HasPrefix(a.Path, "/") {
			return fmt.Errorf("app %q: path %q must start with /", a.Name, a.Path)
		}
		if a.Path != "/" && strings.HasSuffix(a.Path, "/") {
			return fmt.Errorf("app %q: path %q must not have a trailing slash", a.Name, a.Path)
		}
		if a.Path != "/" {
			key := a.Listener + "\x00" + a.Path
			if other, dup := seenPath[key]; dup {
				return fmt.Errorf("app %q claims path %q, already claimed by %q", a.Name, a.Path, other)
			}
			seenPath[key] = a.Name
		}

		if a.Source == "" {
			return fmt.Errorf("app %q: source is required", a.Name)
		}
		if _, ok := toolchainOut[a.Toolchain]; !ok {
			return fmt.Errorf("app %q: unknown toolchain %q (known: %s)", a.Name, a.Toolchain, strings.Join(knownToolchains(), ", "))
		}
		if a.Dev.Port == 0 {
			return fmt.Errorf("app %q: dev.port is required", a.Name)
		}
		if other, dup := seenPort[a.Dev.Port]; dup {
			return fmt.Errorf("app %q: dev port %d already used by %q", a.Name, a.Dev.Port, other)
		}
		seenPort[a.Dev.Port] = a.Name
	}
	return nil
}

func knownToolchains() []string {
	out := make([]string, 0, len(toolchainOut))
	for t := range toolchainOut {
		out = append(out, t)
	}
	sort.Strings(out)
	return out
}

// DeclaredManifest builds the vocabulary half of a Manifest from names alone.
//
// Validate needs to know which app names EXIST, not where their sources live —
// so a host that has compiled the vocabulary in does not need to ship apps.yaml
// beside its binary and read it back at startup. A container has no checkout,
// and a manifest a process re-reads at runtime is a manifest somebody can edit
// underneath it.
func DeclaredManifest(names ...string) Manifest {
	m := Manifest{Version: ManifestVersion}
	for _, n := range names {
		m.Apps = append(m.Apps, ManifestApp{Name: n})
	}
	return m
}

// App returns the named app.
func (m Manifest) App(name string) (ManifestApp, bool) {
	for _, a := range m.Apps {
		if a.Name == name {
			return a, true
		}
	}
	return ManifestApp{}, false
}

// Names returns every declared app name, in manifest order.
func (m Manifest) Names() []string {
	out := make([]string, len(m.Apps))
	for i, a := range m.Apps {
		out[i] = a.Name
	}
	return out
}

// ResolvedApp is a manifest entry with every default and derivation applied.
// It exists so that defaults do not live only inside struct literals — that is
// how you get "it works on my machine", and it is what `compose print
// --resolved` prints and what the generator's enforcement test diffs against.
type ResolvedApp struct {
	Name string `json:"name" yaml:"name"`
	Path string `json:"path" yaml:"path"`
	// AssetPrefix is derived from the NAME, never the path. Two apps may both
	// claim "/", so a path-derived namespace would collide between them — and
	// asset URLs that collide serve one app's bundle to the other.
	AssetPrefix string `json:"assetPrefix" yaml:"assetPrefix"`
	Source      string `json:"source" yaml:"source"`
	Toolchain   string `json:"toolchain" yaml:"toolchain"`
	// BuildDir is where the toolchain writes the bundle, relative to Source.
	BuildDir string `json:"buildDir" yaml:"buildDir"`
	// EmbedDir is the generated package directory the bundle is copied into.
	EmbedDir string `json:"embedDir" yaml:"embedDir"`
	Listener string `json:"listener" yaml:"listener"`
	DevPort  int    `json:"devPort" yaml:"devPort"`
	Routes   string `json:"routes,omitempty" yaml:"routes,omitempty"`
	Builtin  string `json:"builtin,omitempty" yaml:"builtin,omitempty"`
}

// Resolved is the whole manifest with defaults and derivations applied.
type Resolved struct {
	Version int           `json:"version" yaml:"version"`
	Shared  []string      `json:"shared" yaml:"shared"`
	Apps    []ResolvedApp `json:"apps" yaml:"apps"`
}

// WebListener is the listener an app answers on when it names none.
const WebListener = "web"

// AssetNamespace is the reserved root under which every app's private asset
// namespace lives. Reserved means a URL beneath it is never a client-router
// route: if no app in this build owns it, it is refused rather than answered
// with the root app's shell, because the difference between those two answers
// would let a caller enumerate which apps were compiled in.
const AssetNamespace = "/_apps/"

// AssetPrefix is an app's private root-relative asset namespace, derived from
// its name. Not authorable in the manifest: authoring it is how you make it
// collide, and there is no path to derive it from when two apps share "/".
func AssetPrefix(name string) string { return AssetNamespace + name }

// AppsDir is where the generated per-app packages live.
//
// Under server/ui because serving a user interface is that package's domain,
// and because nothing prevents it: server/installer can import server/ui (no
// cycle — checked, not assumed), and the installer is a SUBCOMMAND of the same
// binary, which already links both. An earlier draft put these in internal/ on
// the belief that an import cycle forced it. There is no such cycle.
const AppsDir = "server/ui/apps"

// EmbedDir is the generated Go package directory holding an app's bundle.
func EmbedDir(name string) string { return AppsDir + "/" + name }

// Resolve applies every default and derivation. Pure — it reads nothing from
// disk, so the CLI, the generator and the enforcement test all get the same
// answer from the same code.
func (m Manifest) Resolve() Resolved {
	out := Resolved{Version: m.Version, Shared: append([]string(nil), m.Shared...)}
	for _, a := range m.Apps {
		listener := a.Listener
		if listener == "" {
			listener = WebListener
		}
		out.Apps = append(out.Apps, ResolvedApp{
			Name:        a.Name,
			Path:        a.Path,
			AssetPrefix: AssetPrefix(a.Name),
			Source:      a.Source,
			Toolchain:   a.Toolchain,
			BuildDir:    toolchainOut[a.Toolchain],
			EmbedDir:    EmbedDir(a.Name),
			Listener:    listener,
			DevPort:     a.Dev.Port,
			Routes:      a.Routes,
			Builtin:     a.Builtin,
		})
	}
	return out
}
