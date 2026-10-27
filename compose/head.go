package compose

import (
	"bytes"
	"strings"
)

// InjectBeforeHeadClose puts a fragment immediately before a document's
// </head>, and reports whether it found one.
//
// The boolean is the entire reason this exists. Every host that uses
// HandlerOptions.Shell writes some form of
//
//	bytes.Replace(doc, []byte("</head>"), append(frag, "</head>"...), 1)
//
// and bytes.Replace returns the document UNCHANGED when the needle is absent —
// no error, no signal. What ships then is a shell with none of the host's
// runtime configuration in it, and the symptom surfaces much later as an app
// that boots with no config and cannot say why. The hook's signature has no
// error channel to report through, so the answer has to come back here.
//
// It matters more since a bundle's every .html is rendered through the hook
// rather than only its shell: a prerendered page from some other toolchain that
// closes its head differently would silently ship unconfigured.
//
// Matching is case-insensitive and tolerates whitespace inside the tag
// (`</HEAD>`, `</head >`), because none of those are errors in HTML and all of
// them are things a generator emits. A document with no head close at all is
// returned untouched with false — deciding what to do about that is the host's
// call, not this function's.
func InjectBeforeHeadClose(doc, fragment []byte) ([]byte, bool) {
	if len(fragment) == 0 {
		return doc, true
	}
	i := indexHeadClose(doc)
	if i < 0 {
		return doc, false
	}
	out := make([]byte, 0, len(doc)+len(fragment))
	out = append(out, doc[:i]...)
	out = append(out, fragment...)
	out = append(out, doc[i:]...)
	return out, true
}

// indexHeadClose finds the byte offset of the first head close tag, or -1.
//
// Hand-scanned rather than regexp'd: this runs over every HTML file in every
// bundle at construction, and a regexp here would be the only one in the
// module for a match this simple.
func indexHeadClose(doc []byte) int {
	const open = "</"
	for i := 0; ; {
		rel := bytes.Index(doc[i:], []byte(open))
		if rel < 0 {
			return -1
		}
		at := i + rel
		rest := doc[at+len(open):]
		if len(rest) >= 4 && strings.EqualFold(string(rest[:4]), "head") {
			// Only a tag that actually closes here — `</header>` starts the same
			// way and is not this.
			j := 4
			for j < len(rest) && isASCIISpace(rest[j]) {
				j++
			}
			if j < len(rest) && rest[j] == '>' {
				return at
			}
		}
		i = at + len(open)
	}
}

func isASCIISpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f'
}
