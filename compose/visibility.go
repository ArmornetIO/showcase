package compose

import (
	"fmt"
	"io"
	"net"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// RuleSetVersion is the visibility document version this build understands.
const RuleSetVersion = 1

// RuleSet is the visibility document: which hostnames see which apps, and what
// a caller who may not see one gets instead.
//
// It ships as its OWN document rather than a section of the server config, and
// that separation is a security requirement independent of how changes travel:
// the server config also holds the god-admin allowlist and the key-encryption-key
// reference, so write access to it for the sake of a visibility rule would be
// write access to those.
type RuleSet struct {
	Version int `yaml:"version"`
	// HostFrom is where the hostname comes from: "request" (default) or
	// "forwarded". "request" means the request's own host value and nothing
	// else — the correct default, not a placeholder, because the ingress in
	// front of the cluster already preserves it deliberately for the agent
	// WebSocket origin check.
	HostFrom string `yaml:"hostFrom"`
	// TrustedProxies must be non-empty when HostFrom is "forwarded". A
	// forwarded header from an untrusted peer is caller-controlled input, and
	// the thing it controls here is which apps exist.
	TrustedProxies []string `yaml:"trustedProxies"`
	Hosts          []Scope  `yaml:"hosts"`
}

// Scope is one hostname's answer. Exactly one scope answers a request: scopes
// never merge or layer, so there is no rule about precedence between two
// matched scopes to get wrong.
type Scope struct {
	Host    string   `yaml:"host"`
	Aliases []string `yaml:"aliases"`
	// Listener narrows this scope to one listener. The installer's loopback
	// scope needs it; a web scope leaves it empty.
	Listener string `yaml:"listener"`
	// Root is which "/"-claiming app answers unclaimed paths HERE. Required
	// when the profile carries more than one. This one line is the whole
	// per-host fallback mechanism, and it is what retires the jobboard tag.
	Root string    `yaml:"root"`
	Apps []AppRule `yaml:"apps"`
}

// AppRule grants an app to callers on this scope. Unmentioned is refused —
// there is no deny row, because a vocabulary with both grants and denials needs
// a precedence rule and a precedence rule is a thing to get wrong.
type AppRule struct {
	Name string `yaml:"name"`
	// Allow rows are ORed; the traits within a row are ANDed. First matching
	// row wins. No negation, no nesting: negation is what makes a rule set
	// uncheckable, and Validate answering "is this satisfiable" is worth more
	// than the rules it cannot express.
	Allow []Row `yaml:"allow"`
	// Refuse is what a refused caller GETS. First matching rung; the terminal
	// default is the canonical not-found. It lives on the app rule and not on
	// the allow row because a grant that describes its own denial is two things.
	Refuse []Rung     `yaml:"refuse"`
	Pages  []PageRule `yaml:"pages"`
	Groups []PageRule `yaml:"groups"`
}

// Row is one conjunction of traits.
type Row struct {
	Requires []string `yaml:"requires"`
}

// Rung is one step of the refusal ladder: what this caller is told, given what
// is already known about them.
type Rung struct {
	// When are the traits that must hold for this rung to apply. Empty matches
	// anyone, which is how the terminal rung is written.
	When []string `yaml:"when"`
	// To is the app or page the caller is sent to. An absent target is a LOAD
	// FAILURE, not a warning: it silently degrades a promised explanation into
	// a not-found, so the operator wrote a page nobody will ever see and
	// nothing said so.
	To string `yaml:"to"`
}

// PageRule gates one page or one page group within an app.
type PageRule struct {
	Name  string `yaml:"name"`
	Allow []Row  `yaml:"allow"`
}

// Host source modes.
const (
	HostFromRequest   = "request"
	HostFromForwarded = "forwarded"
)

// DecodeRuleSet reads a visibility document. Strict, for the same reason the
// manifest is — and more sharply: a silently ignored VISIBILITY field is this
// package's own failure mode with a security consequence attached.
func DecodeRuleSet(r io.Reader) (RuleSet, error) {
	dec := yaml.NewDecoder(r)
	dec.KnownFields(true)

	var rs RuleSet
	if err := dec.Decode(&rs); err != nil {
		return RuleSet{}, fmt.Errorf("decoding visibility rules: %w", err)
	}
	if err := rs.check(); err != nil {
		return RuleSet{}, err
	}
	return rs, nil
}

// check enforces what can be known without the manifest. Everything that needs
// to compare a name against the compiled-in vocabulary lives in Validate.
func (rs *RuleSet) check() error {
	if rs.Version != RuleSetVersion {
		return fmt.Errorf("visibility version %d: this build understands version %d", rs.Version, RuleSetVersion)
	}
	if rs.HostFrom == "" {
		rs.HostFrom = HostFromRequest
	}
	switch rs.HostFrom {
	case HostFromRequest:
		if len(rs.TrustedProxies) > 0 {
			return fmt.Errorf("trustedProxies is set but hostFrom is %q — it would have no effect, which is worse than an error", HostFromRequest)
		}
	case HostFromForwarded:
		if len(rs.TrustedProxies) == 0 {
			return fmt.Errorf("hostFrom %q requires a non-empty trustedProxies: without one the hostname is caller-controlled, and the hostname decides which apps exist", HostFromForwarded)
		}
		for _, p := range rs.TrustedProxies {
			if _, _, err := net.ParseCIDR(p); err != nil {
				if net.ParseIP(p) == nil {
					return fmt.Errorf("trustedProxies entry %q is neither an IP nor a CIDR", p)
				}
			}
		}
	default:
		return fmt.Errorf("hostFrom %q must be %q or %q", rs.HostFrom, HostFromRequest, HostFromForwarded)
	}

	if len(rs.Hosts) == 0 {
		return fmt.Errorf("visibility rules declare no hosts")
	}
	seen := map[string]string{}
	for _, s := range rs.Hosts {
		if s.Host == "" {
			return fmt.Errorf("host scope with no host")
		}
		for _, h := range append([]string{s.Host}, s.Aliases...) {
			key := s.Listener + "\x00" + strings.ToLower(h)
			if other, dup := seen[key]; dup {
				return fmt.Errorf("host %q is claimed twice (also by scope %q)", h, other)
			}
			seen[key] = s.Host
		}
		if s.Host != "*" && strings.Contains(s.Host, "*") && !strings.HasPrefix(s.Host, "*.") {
			return fmt.Errorf("host %q may only wildcard as a leading *. or the bare catch-all *", s.Host)
		}
		for _, a := range s.Apps {
			if a.Name == "" {
				return fmt.Errorf("host %q: app rule with no name", s.Host)
			}
			for _, ru := range a.Refuse {
				if ru.To == "" {
					return fmt.Errorf("host %q app %q: refuse rung with no target", s.Host, a.Name)
				}
			}
		}
	}
	// Ordered once here, not per request: matching is on the hot path for every
	// page and every asset, and re-deriving a total order on each one is how a
	// decision that should be a lookup becomes a sort.
	sort.SliceStable(rs.Hosts, func(i, j int) bool {
		return scopeSpecificity(rs.Hosts[i].Host) > scopeSpecificity(rs.Hosts[j].Host)
	})
	return nil
}

// scopeSpecificity ranks a scope for most-specific-first matching: an exact
// hostname beats a longer *.suffix, which beats the bare catch-all.
func scopeSpecificity(host string) int {
	switch {
	case host == "*":
		return 0
	case strings.HasPrefix(host, "*."):
		return len(host)
	default:
		return 1 << 20
	}
}
