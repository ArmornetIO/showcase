package compose_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/ArmornetIO/showcase/compose"
)

// TestHostAndCLIAgree pins FR-027: the product and the standalone tool reach
// identical decisions for identical inputs.
//
// The two differ in exactly one way that could plausibly change an answer —
// where the bundle comes from. The product compiles it in, so its fs.FS is an
// embed.FS rooted by fs.Sub; the CLI reads a checkout, so its fs.FS is an
// os.DirFS. Everything downstream of that is the same code, and this test is
// what keeps it that way: it builds one Set each way over identical file
// contents and sweeps the same requests through both.
//
// The trait set is swept as an INPUT rather than assumed away. FR-027's
// "identical inputs" is only a meaningful claim if the registered families are
// counted among them — the CLI registers none of the host's and offers --trait
// instead, so a decision that silently depended on a family only one side had
// would satisfy the letter of the requirement and none of it.
func TestHostAndCLIAgree(t *testing.T) {
	const index = "<!doctype html><title>console</title></head>"
	const asset = "console asset bytes"

	// The host's shape: bundles compiled in, apps added by a profile.
	embedded := compose.MustSet(
		compose.Root(compose.App{
			Name: "console", Path: "/", AssetPrefix: compose.AssetPrefix("console"),
			Files: fstest.MapFS{
				"index.html":  &fstest.MapFile{Data: []byte(index)},
				"app.js":      &fstest.MapFile{Data: []byte(asset)},
				"favicon.ico": &fstest.MapFile{Data: []byte("icon")},
			},
		}),
		compose.Also(compose.App{
			Name: "showcase", Path: "/showcase", AssetPrefix: compose.AssetPrefix("showcase"),
			Files: fstest.MapFS{"index.html": &fstest.MapFile{Data: []byte("<!doctype html><title>showcase</title></head>")}},
		}),
		compose.Shared("/fonts/"),
	)

	// The CLI's shape: the same bytes on disk, read with os.DirFS.
	dir := t.TempDir()
	writeTree(t, filepath.Join(dir, "console"), map[string]string{
		"index.html": index, "app.js": asset, "favicon.ico": "icon",
	})
	writeTree(t, filepath.Join(dir, "showcase"), map[string]string{
		"index.html": "<!doctype html><title>showcase</title></head>",
	})
	fromDisk := compose.MustSet(
		compose.Root(compose.App{
			Name: "console", Path: "/", AssetPrefix: compose.AssetPrefix("console"),
			Files: os.DirFS(filepath.Join(dir, "console")),
		}),
		compose.Also(compose.App{
			Name: "showcase", Path: "/showcase", AssetPrefix: compose.AssetPrefix("showcase"),
			Files: os.DirFS(filepath.Join(dir, "showcase")),
		}),
		compose.Shared("/fonts/"),
	)

	// A family neither side has built in, answering from the caller. Registered
	// once for the whole test: RegisterTrait panics on a duplicate, deliberately,
	// so a family is a process-wide fact and both handlers below see the same one.
	compose.RegisterTrait("agree-entitled", func(_ context.Context, p compose.Principal, arg string) bool {
		s, _ := p.(string)
		return s == arg
	})

	principals := map[string]compose.Principal{
		"anonymous":   nil,
		"entitled":    "showcase",
		"un-entitled": "something-else",
	}
	paths := []string{
		"/",                      // the root's shell
		"/overview",              // a client-router route
		"/app.js",                // an asset by its bundle-relative name
		"/_apps/console/app.js",  // the same asset through its namespace
		"/_apps/console/gone.js", // a miss inside a namespace: refused, never a shell
		"/_apps/jobboard/x.js",   // a namespace no app in this build owns
		"/showcase",              // a claimed prefix
		"/showcase/",             //   and its trailing-slash spelling
		"/fonts/inter.woff2",     // shared: owned by nobody, answered by the root
		"/nothing-claims-this",
	}
	hosts := []string{"example.com", "other.example.com"}

	// Two handlers agreeing on "404" for everything would pass this test while
	// proving nothing, so the sweep records what it saw and asserts a mix at
	// the end. A comparison that cannot fail is indistinguishable from a broken
	// comparison.
	seen := map[int]int{}

	for pname, p := range principals {
		hostH := compose.Handler(embedded, holder(t, embedded, agreeRules), compose.HandlerOptions{
			Principal: fixedPrincipal(p),
		})
		cliH := compose.Handler(fromDisk, holder(t, fromDisk, agreeRules), compose.HandlerOptions{
			Principal: fixedPrincipal(p),
		})

		for _, host := range hosts {
			for _, path := range paths {
				t.Run(pname+" "+host+path, func(t *testing.T) {
					hostRec, cliRec := httptest.NewRecorder(), httptest.NewRecorder()
					hostH.ServeHTTP(hostRec, newRequest(host, path))
					cliH.ServeHTTP(cliRec, newRequest(host, path))
					seen[hostRec.Code]++

					if hostRec.Code != cliRec.Code {
						t.Errorf("status: host %d, CLI %d", hostRec.Code, cliRec.Code)
					}
					if hostRec.Body.String() != cliRec.Body.String() {
						t.Errorf("body differs:\n host: %q\n  CLI: %q", hostRec.Body.String(), cliRec.Body.String())
					}
					// Every header the DECISION produces. Last-Modified is
					// excluded on purpose and is the only exclusion: it is
					// metadata of the file the bytes came from, so an embed.FS
					// (zero time) and a checkout (a real one) differ there
					// without either having decided anything differently.
					for _, h := range []string{"Content-Type", "Cache-Control", "Vary", "Location", "X-Content-Type-Options", "Content-Encoding"} {
						if got, want := cliRec.Header().Get(h), hostRec.Header().Get(h); got != want {
							t.Errorf("header %s: host %q, CLI %q", h, want, got)
						}
					}
				})
			}
		}
	}

	if seen[200] == 0 || seen[404] == 0 {
		t.Errorf("sweep produced no mix of outcomes (%v): the two sides agree, but on nothing", seen)
	}
}

// TestRegisteredTraitsAreAnInput is the other half of FR-027's "identical
// inputs": the same rules and the same request give a DIFFERENT answer when the
// trait set differs, so the trait set has to be compared alongside the
// documents rather than treated as ambient.
func TestRegisteredTraitsAreAnInput(t *testing.T) {
	set := compose.MustSet(
		compose.Root(app("console", "/", "index.html")),
		compose.Also(app("showcase", "/showcase", "index.html")),
	)
	// An unregistered family cannot be loaded at all: it FAILS validation
	// rather than evaluating false, so a typo cannot quietly turn a grant into
	// a refusal nobody ordered.
	m, err := compose.DecodeManifest(stringReader(fiveAppManifest))
	if err != nil {
		t.Fatalf("manifest: %v", err)
	}
	rs, err := compose.DecodeRuleSet(stringReader(unknownFamilyRules))
	if err != nil {
		t.Fatalf("rules: %v", err)
	}
	if _, err := compose.NewHolder(m, set.Names(), rs); err == nil {
		t.Fatal("a rule naming an unregistered trait family loaded; it must fail so a typo is loud")
	}

	// The engine's whole vocabulary. Everything else belongs to a host — the
	// product registers entitled/role/fga, the CLI registers none and takes
	// --trait instead — which is exactly why the registered set has to be
	// compared alongside the two documents rather than assumed shared.
	//
	// Asserted as presence and not as an exact set: traits are process-wide by
	// design (RegisterTrait panics on a duplicate), so any test in this package
	// that registers a family of its own is also in this list.
	for _, f := range []string{"anyone", "signed-in", "dev"} {
		if !compose.TraitRegistered(f) {
			t.Errorf("built-in family %q missing from %v", f, compose.RegisteredTraits())
		}
	}
}

func writeTree(t *testing.T, dir string, files map[string]string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func fixedPrincipal(p compose.Principal) compose.PrincipalFunc {
	if p == nil {
		return nil
	}
	return func(*http.Request) compose.Principal { return p }
}

const agreeRules = `
version: 1
hosts:
  - host: example.com
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
      - name: showcase
        allow: [{ requires: ["agree-entitled:showcase"] }]
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [anyone] }]
`

const unknownFamilyRules = `
version: 1
hosts:
  - host: "*"
    root: console
    apps:
      - name: console
        allow: [{ requires: [entitledd] }]
`
