package compose

import (
	"io/fs"
	"strconv"
	"strings"
)

// encodings is the server's preference order, best first. A client's
// Accept-Encoding is intersected with this and the first survivor wins.
//
// No Compressor interface and no codec import on this side: serving a sidecar
// is opening a second file and naming it in a header, which is what keeps this
// module's dependency graph the standard library. The "br" row is deliberately
// present and inert — a sidecar that does not exist is skipped, so the day a
// .br file appears beside a .gz it is served with no code change here.
var encodings = []struct{ token, ext string }{
	{"br", ".br"},
	{"gzip", ".gz"},
}

// openEncoded returns the best precompressed sidecar the caller will accept.
func openEncoded(fsys fs.FS, name, accept string) (fs.File, fs.FileInfo, string, bool) {
	if fsys == nil || accept == "" {
		return nil, nil, "", false
	}
	for _, e := range encodings {
		if !acceptable(accept, e.token) {
			continue
		}
		if f, info, ok := openFile(fsys, name+e.ext); ok {
			return f, info, e.token, true
		}
	}
	return nil, nil, "", false
}

// acceptable reports whether the client will take a coding, honouring q=0.
//
// "gzip;q=0" is a refusal, not a preference, and a client that sends it and
// receives gzip anyway gets bytes it will not decode — a blank page with no
// error in it. An explicit entry for the token beats a wildcard, which is the
// whole reason this is not a substring search.
func acceptable(header, token string) bool {
	tokenQ, starQ := -1.0, -1.0
	for part := range strings.SplitSeq(header, ",") {
		name, params, _ := strings.Cut(strings.TrimSpace(part), ";")
		name = strings.TrimSpace(name)
		switch {
		case strings.EqualFold(name, token):
			tokenQ = qValue(params)
		case name == "*":
			starQ = qValue(params)
		}
	}
	if tokenQ >= 0 {
		return tokenQ > 0
	}
	return starQ > 0
}

// qValue reads the q parameter, defaulting to 1 when absent or unparseable.
func qValue(params string) float64 {
	for p := range strings.SplitSeq(params, ";") {
		k, v, ok := strings.Cut(strings.TrimSpace(p), "=")
		if !ok || !strings.EqualFold(strings.TrimSpace(k), "q") {
			continue
		}
		q, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		if err != nil {
			return 1
		}
		return q
	}
	return 1
}
