package compose

import (
	"net"
	"net/http"
	"strings"
)

// hostOf extracts the hostname a request should be judged by.
//
// The default is the request's own Host and NOTHING else. That is a decision,
// not a placeholder: the hostname here selects which apps exist, so a header an
// arbitrary caller can set would let that caller choose what they are allowed
// to see. The ingress in front of this already preserves the real Host
// deliberately, because the agent WebSocket origin check depends on it — so
// "request" is both the safe default and the accurate one.
//
// The port is always dropped. A scope is written as a hostname and matching
// "example.com:8443" against "example.com" would otherwise silently fail in
// exactly one environment: a developer's.
func hostOf(r *http.Request, rs RuleSet) string {
	h := r.Host
	if rs.HostFrom == HostFromForwarded && forwardedIsTrusted(r, rs.TrustedProxies) {
		if fwd := firstForwardedHost(r); fwd != "" {
			h = fwd
		}
	}
	return normalizeHost(h)
}

func normalizeHost(h string) string {
	h = strings.TrimSpace(h)
	if h == "" {
		return ""
	}
	if stripped, _, err := net.SplitHostPort(h); err == nil {
		h = stripped
	}
	return strings.ToLower(strings.TrimSuffix(h, "."))
}

// firstForwardedHost reads the CLIENT's hostname from the forwarding headers.
//
// X-Forwarded-Host wins because it names the host specifically; Forwarded is
// read only as a fallback. In both, the FIRST value is the original client's —
// later entries were appended by intermediaries, and trusting the last one lets
// the nearest proxy overwrite the answer.
func firstForwardedHost(r *http.Request) string {
	if v := r.Header.Get("X-Forwarded-Host"); v != "" {
		first, _, _ := strings.Cut(v, ",")
		return strings.TrimSpace(first)
	}
	for _, part := range strings.Split(r.Header.Get("Forwarded"), ",") {
		for _, kv := range strings.Split(part, ";") {
			k, v, ok := strings.Cut(strings.TrimSpace(kv), "=")
			if ok && strings.EqualFold(k, "host") {
				return strings.Trim(strings.TrimSpace(v), `"`)
			}
		}
	}
	return ""
}

// forwardedIsTrusted reports whether the immediate peer is a declared proxy.
//
// Without this the forwarding header is just caller-controlled input, which is
// why an empty trustedProxies is refused at LOAD time rather than here — a
// deployment that mis-declares this should fail to start, not fail open on
// every request.
func forwardedIsTrusted(r *http.Request, cidrs []string) bool {
	ipStr, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ipStr = r.RemoteAddr
	}
	ip := net.ParseIP(strings.TrimSpace(ipStr))
	if ip == nil {
		return false
	}
	for _, c := range cidrs {
		if _, netw, err := net.ParseCIDR(c); err == nil {
			if netw.Contains(ip) {
				return true
			}
			continue
		}
		if only := net.ParseIP(c); only != nil && only.Equal(ip) {
			return true
		}
	}
	return false
}

// scopeFor returns the one scope answering this hostname on this listener.
//
// Most specific wins: an exact hostname, then the longest matching *.suffix,
// then the bare catch-all. RuleSet.check has already sorted Hosts into that
// order, so the first match is the answer and there is no precedence rule left
// to get wrong at request time.
//
// Exactly one scope answers. Scopes never merge or layer — an app granted on a
// catch-all is NOT thereby granted on a hostname with its own scope, because
// "this hostname's answer" is a complete statement and not an override.
func scopeFor(rs RuleSet, listener, host string) (Scope, bool) {
	for _, sc := range rs.Hosts {
		if scopeListener(sc) != listener {
			continue
		}
		if scopeMatches(sc, host) {
			return sc, true
		}
	}
	return Scope{}, false
}

func scopeListener(sc Scope) string {
	if sc.Listener == "" {
		return WebListener
	}
	return sc.Listener
}

func scopeMatches(sc Scope, host string) bool {
	for _, h := range append([]string{sc.Host}, sc.Aliases...) {
		h = strings.ToLower(h)
		switch {
		case h == "*":
			return true
		case strings.HasPrefix(h, "*."):
			// "*.example.com" claims sub.example.com and example.com itself.
			// Omitting the apex is the classic way a wildcard scope looks
			// correct and leaves the bare domain with no answer at all.
			suffix := h[1:]
			if strings.HasSuffix(host, suffix) || host == strings.TrimPrefix(suffix, ".") {
				return true
			}
		case h == host:
			return true
		}
	}
	return false
}
