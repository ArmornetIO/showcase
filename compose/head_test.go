package compose_test

import (
	"strings"
	"testing"

	"github.com/ArmornetIO/showcase/compose"
)

func TestInjectBeforeHeadClose(t *testing.T) {
	cases := []struct {
		name, doc string
		wantOK    bool
		why       string
	}{
		{"plain", "<head><title>x</title></head><body>", true, ""},
		{"uppercase", "<HEAD></HEAD><body>", true, "case is not an error in HTML"},
		{"mixed case", "<head></Head>", true, ""},
		{"space in tag", "<head></head >", true, "a generator may emit it"},
		{"newline in tag", "<head></head\n>", true, ""},
		// The one that made this worth writing: `</header>` opens identically,
		// and a naive scan injects into the middle of the body.
		{"header is not head", "<body><header>x</header></body>", false, ""},
		{"no head at all", "<div>a prerendered fragment</div>", false, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			out, ok := compose.InjectBeforeHeadClose([]byte(c.doc), []byte("<!--F-->"))
			if ok != c.wantOK {
				t.Fatalf("ok = %v, want %v %s", ok, c.wantOK, c.why)
			}
			if !ok {
				if string(out) != c.doc {
					t.Errorf("a miss must return the document untouched, got %q", out)
				}
				return
			}
			if !strings.Contains(string(out), "<!--F-->") {
				t.Fatalf("fragment missing: %q", out)
			}
			// Before the close, not after it.
			if strings.Index(string(out), "<!--F-->") > strings.Index(strings.ToLower(string(out)), "</head") {
				t.Errorf("fragment landed after the head closed: %q", out)
			}
		})
	}
}

// The first close wins. A document with two is malformed, but injecting into
// the last one would put the fragment outside the head of the real document.
func TestInjectUsesTheFirstHeadClose(t *testing.T) {
	out, ok := compose.InjectBeforeHeadClose([]byte("<head></head><body></head></body>"), []byte("X"))
	if !ok {
		t.Fatal("expected a match")
	}
	if !strings.HasPrefix(string(out), "<head>X</head>") {
		t.Errorf("injected into the wrong close tag: %q", out)
	}
}

// An empty fragment is a no-op that must not be reported as a failure — a host
// with nothing to inject has not hit the bug this boolean exists to surface.
func TestEmptyFragmentIsNotAMiss(t *testing.T) {
	if _, ok := compose.InjectBeforeHeadClose([]byte("<div>no head</div>"), nil); !ok {
		t.Error("an empty fragment should report success")
	}
}
