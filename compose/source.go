package compose

import (
	"context"
	"fmt"
	"os"
	"sync/atomic"
)

// RuleSource is where visibility rules come from. The engine ships a
// file-backed one; everything cluster-aware lives in the HOST behind this
// interface, so the engine never imports a Kubernetes client and the standalone
// tool works unchanged.
//
// It is also the seam that keeps a proposal-driven source from being foreclosed:
// one drops in here without the resolver changing.
type RuleSource interface {
	// Rules returns the current set.
	Rules(ctx context.Context) (RuleSet, error)
	// Watch returns a channel of subsequent sets, or nil if the source is
	// static. A nil channel is a normal answer, not a missing feature.
	Watch(ctx context.Context) <-chan RuleSet
}

// Holder is the last-known-good rule set.
//
// It lives in the ENGINE and not in the host because the standalone tool and a
// laptop need the identical property: a rule set that does not validate must
// never be partially applied, and what stays in force is the last one that did.
// A host-side implementation would give the product that guarantee and the CLI
// a different one, and FR-027 requires them to agree.
type Holder struct {
	// cur is swapped whole. An atomic pointer and not a mutex-guarded field
	// because the read is on the hot path for every page and every asset, and
	// the write happens when a human edits a file.
	cur atomic.Pointer[RuleSet]

	// manifest and present are the inputs Validate needs besides the set
	// itself. Fixed for the lifetime of the process — the binary's apps cannot
	// change while it runs — so they are plain fields.
	manifest Manifest
	present  []string
}

// NewHolder seeds a holder with a set that must already be valid. The seed
// failing is fatal in a way a later swap is not: there is no last known good to
// fall back to, so a process that started with an invalid set has nothing to
// serve and should say so at boot rather than at first request.
func NewHolder(m Manifest, present []string, seed RuleSet) (*Holder, error) {
	h := &Holder{manifest: m, present: append([]string(nil), present...)}
	if err := Validate(m, seed, h.present).Err(); err != nil {
		return nil, fmt.Errorf("initial rule set: %w", err)
	}
	h.cur.Store(&seed)
	return h, nil
}

// Current returns the set in force. Never nil after NewHolder.
func (h *Holder) Current() RuleSet { return *h.cur.Load() }

// Swap validates a candidate and installs it, or rejects it WHOLE and leaves
// the previous set in force.
//
// Returning the problems rather than only an error is the point: a rejected
// swap that says nothing is indistinguishable from a swap that worked, and the
// operator whose edit silently did nothing is exactly who this package exists
// to protect.
func (h *Holder) Swap(next RuleSet) (Problems, error) {
	ps := Validate(h.manifest, next, h.present)
	if err := ps.Err(); err != nil {
		return ps, err
	}
	h.cur.Store(&next)
	return ps, nil
}

// Follow applies every set a source produces, keeping the last known good on
// each rejection. Blocks until ctx is done or the source's channel closes; a
// static source (nil channel) returns immediately.
//
// report is called for every outcome including the successful ones, because a
// swap that logged nothing is how a deployment ends up not knowing which rules
// are actually in force.
func (h *Holder) Follow(ctx context.Context, src RuleSource, report func(Problems, error)) {
	ch := src.Watch(ctx)
	if ch == nil {
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		case next, ok := <-ch:
			if !ok {
				return
			}
			ps, err := h.Swap(next)
			if report != nil {
				report(ps, err)
			}
		}
	}
}

// FileSource reads a visibility document from disk. Static: it does not watch,
// because a file watcher is a platform concern and this module has one job.
type FileSource struct{ Path string }

// NewFileSource returns a source reading path.
func NewFileSource(path string) FileSource { return FileSource{Path: path} }

// Rules reads and decodes the document.
func (s FileSource) Rules(context.Context) (RuleSet, error) {
	f, err := os.Open(s.Path)
	if err != nil {
		return RuleSet{}, fmt.Errorf("opening %s: %w", s.Path, err)
	}
	defer f.Close()
	return DecodeRuleSet(f)
}

// Watch returns nil: this source is static.
func (s FileSource) Watch(context.Context) <-chan RuleSet { return nil }

// Compile-time check that the shipped source satisfies the seam it defines.
var _ RuleSource = FileSource{}
