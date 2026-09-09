package compose_test

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ArmornetIO/showcase/compose"
	"github.com/ArmornetIO/showcase/compose/assetenc"
)

// The two halves of the sidecar contract are exercised together on purpose.
//
// assetenc decides that a gzip sidecar is named "<file>.gz"; compose opens
// exactly that name. Nothing about disagreeing on the suffix fails to compile,
// and the symptom of a drift is not an error — it is every asset silently
// reverting to uncompressed, which looks like nothing at all. So the tool's
// real output is what gets served here, rather than a fixture that agrees with
// the server by construction.
func servedBundle(t *testing.T) compose.App {
	t.Helper()
	dir := t.TempDir()

	// Compressible and over the size floor: the same shape as a real chunk.
	js := strings.Repeat("export const answer = 42;\n", 200)
	write(t, filepath.Join(dir, "app.js"), js)
	write(t, filepath.Join(dir, "index.html"), "<!doctype html><title>x</title>")
	// Under the floor. A gzip member's own header and trailer would make the
	// sidecar bigger than this.
	write(t, filepath.Join(dir, "tiny.css"), "a{color:red}")
	// Not in the compressible set, and already compressed by its own format.
	write(t, filepath.Join(dir, "font.woff2"), strings.Repeat("x", 4096))

	if _, err := assetenc.Dir(dir, assetenc.Options{}); err != nil {
		t.Fatalf("assetenc: %v", err)
	}
	return compose.App{
		Name:        "console",
		Path:        "/",
		AssetPrefix: compose.AssetPrefix("console"),
		Files:       os.DirFS(dir),
	}
}

func write(t *testing.T, path, body string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func getAsset(t *testing.T, app compose.App, url, acceptEncoding string) *httptest.ResponseRecorder {
	t.Helper()
	set := compose.MustSet(compose.Root(app))
	req := httptest.NewRequest(http.MethodGet, url, nil)
	if acceptEncoding != "" {
		req.Header.Set("Accept-Encoding", acceptEncoding)
	}
	rec := httptest.NewRecorder()
	compose.Handler(set, holder(t, set, oneHostRules), compose.HandlerOptions{}).ServeHTTP(rec, req)
	return rec
}

func TestAcceptEncodingServesTheSidecar(t *testing.T) {
	app := servedBundle(t)
	rec := getAsset(t, app, "http://x/app.js", "gzip, deflate, br")

	if got := rec.Header().Get("Content-Encoding"); got != "gzip" {
		t.Fatalf("Content-Encoding = %q, want gzip — the sidecar was built but not served", got)
	}
	zr, err := gzip.NewReader(rec.Body)
	if err != nil {
		t.Fatalf("body is not gzip: %v", err)
	}
	body, err := io.ReadAll(zr)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(string(body), "export const answer") {
		t.Errorf("decoded body is not the original asset: %.40q", body)
	}
	// The type must describe the DECODED representation. Sniffing the gzip
	// bytes would answer application/x-gzip and the browser would download the
	// file instead of executing it.
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/javascript") && !strings.HasPrefix(ct, "application/javascript") {
		t.Errorf("Content-Type = %q, want a JavaScript type", ct)
	}
}

// Vary is the header that makes the whole thing safe to cache, and it is the
// one most easily forgotten because omitting it works perfectly in every
// development setup — there is no shared cache on a laptop. In front of a CDN
// it serves gzip to a client that cannot decode it, permanently, with no error
// anywhere. It therefore belongs on every negotiable answer, not only the
// compressed ones.
func TestVaryIsPresentWhicheverVariantIsServed(t *testing.T) {
	app := servedBundle(t)
	for _, c := range []struct{ name, accept string }{
		{"compressed", "gzip"},
		{"identity", ""},
		{"refused", "gzip;q=0"},
		{"no sidecar exists", "gzip"},
	} {
		url := "http://x/app.js"
		if c.name == "no sidecar exists" {
			url = "http://x/tiny.css"
		}
		rec := getAsset(t, app, url, c.accept)
		if got := rec.Header().Get("Vary"); got != "Accept-Encoding" {
			t.Errorf("%s: Vary = %q, want Accept-Encoding", c.name, got)
		}
	}
}

func TestIdentityIsServedWhenTheClientCannotDecode(t *testing.T) {
	app := servedBundle(t)
	for _, accept := range []string{"", "identity", "gzip;q=0", "br", "*;q=0, identity"} {
		rec := getAsset(t, app, "http://x/app.js", accept)
		if got := rec.Header().Get("Content-Encoding"); got != "" {
			t.Errorf("Accept-Encoding %q got Content-Encoding %q — those bytes will not decode", accept, got)
		}
		if !strings.HasPrefix(rec.Body.String(), "export const answer") {
			t.Errorf("Accept-Encoding %q did not get the plain asset", accept)
		}
	}
}

// A wildcard is the client saying "anything", and an explicit entry for a
// coding overrides it in both directions.
func TestWildcardAndExplicitPrecedence(t *testing.T) {
	app := servedBundle(t)
	cases := map[string]string{
		"*":              "gzip",
		"*;q=1.0":        "gzip",
		"*, gzip;q=0":    "",
		"*;q=0, gzip":    "gzip",
		"gzip;q=0.5":     "gzip",
		"br;q=1, gzip":   "gzip", // no .br sidecar exists, so the row is inert
		"identity, gzip": "gzip",
	}
	for accept, want := range cases {
		rec := getAsset(t, app, "http://x/app.js", accept)
		if got := rec.Header().Get("Content-Encoding"); got != want {
			t.Errorf("Accept-Encoding %q: Content-Encoding = %q, want %q", accept, got, want)
		}
	}
}

func TestNoSidecarForFilesThatCannotBenefit(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "tiny.css"), "a{color:red}")
	write(t, filepath.Join(dir, "font.woff2"), strings.Repeat("x", 4096))
	if _, err := assetenc.Dir(dir, assetenc.Options{}); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"tiny.css.gz", "font.woff2.gz"} {
		if _, err := os.Stat(filepath.Join(dir, name)); err == nil {
			t.Errorf("%s was written — a sidecar that cannot pay for itself still costs binary size", name)
		}
	}
}

// Running the tool twice must be a no-op, not a second round of compression.
// embed-ui is reached from several targets and a developer will run it back to
// back; <file>.gz.gz would be served to nobody and embedded in everything.
func TestSecondRunDoesNotCompressItsOwnOutput(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "app.js"), strings.Repeat("export const answer = 42;\n", 200))
	if _, err := assetenc.Dir(dir, assetenc.Options{}); err != nil {
		t.Fatal(err)
	}
	if _, err := assetenc.Dir(dir, assetenc.Options{}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "app.js.gz.gz")); err == nil {
		t.Error("app.js.gz.gz exists — the tool compressed its own sidecar")
	}
}

// Fingerprinted assets are cached for a year, so their caching must survive
// negotiation untouched. This is the invariant the whole adaptive-delivery
// design rests on: only the ENCODING of an immutable URL may differ.
func TestImmutableCachingIsUnchangedByNegotiation(t *testing.T) {
	app := servedBundle(t)
	for _, accept := range []string{"gzip", ""} {
		rec := getAsset(t, app, "http://x/app.js", accept)
		if got := rec.Header().Get("Cache-Control"); got != "public, max-age=31536000, immutable" {
			t.Errorf("Accept-Encoding %q: Cache-Control = %q", accept, got)
		}
	}
}
