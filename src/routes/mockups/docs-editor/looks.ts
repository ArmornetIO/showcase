// Presentation lookups and the derived vocabulary shared across the editor.
// Kept out of the components so that what amber MEANS, and where the line
// between "aging" and "stale" sits, is defined exactly once.
//
// Colours are the design system's palette tokens, never literal hexes, so a
// stale citation here is the same amber as a warned interception on the mesh
// view — because it is literally the same token, not a hex that happens to
// match today.

import type { IconName } from '$lib/icons/Icon.svelte';
import type {
	AnchorState,
	Command,
	CommandBinding,
	Control,
	DocStatus,
	Evidence,
	EvidenceKind,
	Freshness,
	SyncState
} from './data.js';

export const ANCHOR: Record<
	AnchorState,
	{ label: string; icon: IconName; color: string; blurb: string }
> = {
	anchored: {
		label: 'Anchored',
		icon: 'link',
		color: 'var(--fg-dim)',
		blurb: 'Identity confirmed against the file in HEAD.'
	},
	reanchor: {
		label: 'Needs re-anchoring',
		icon: 'alert-triangle',
		color: 'var(--palette-amber)',
		blurb: 'The heading moved and was reworded. A human must confirm the binding.'
	},
	new: {
		label: 'New section',
		icon: 'plus',
		color: 'var(--palette-blue)',
		blurb: 'Minted in the last sync. Nothing points here yet.'
	}
};

export const SYNC: Record<SyncState, { label: string; color: string }> = {
	synced: { label: 'In sync with origin', color: 'var(--palette-emerald-l)' },
	drifted: { label: 'Section drift — a binding needs a decision', color: 'var(--palette-amber)' },
	local: { label: 'Uncommitted local changes', color: 'var(--palette-blue)' },
	conflict: { label: 'Conflicts with origin', color: 'var(--palette-red)' }
};

/** The frontmatter lifecycle. A document is approved or it isn't. */
export const DOC_STATUS: Record<DocStatus, { label: string; color: string }> = {
	draft: { label: 'Draft', color: 'var(--fg-dim)' },
	review: { label: 'In review', color: 'var(--palette-amber)' },
	approved: { label: 'Approved', color: 'var(--palette-emerald-l)' },
	deprecated: { label: 'Deprecated', color: 'var(--fg-dim)' }
};

export const EVIDENCE_KIND: Record<EvidenceKind, { label: string; icon: IconName }> = {
	run_output: { label: 'Run output', icon: 'play' },
	attestation: { label: 'Attestation', icon: 'user' },
	config_capture: { label: 'Config capture', icon: 'settings' },
	document: { label: 'Document', icon: 'file-text' }
};

// ── The catalog axis ──────────────────────────────────────────────────────
// Whether a runner may execute this Command at all. It is ONE question, asked
// identically of a script, a binary invocation and a non-executing assertion,
// because all three hash. The old four-state `blockState` folded this together
// with transient activity ("running") and with a body kind ("inline"), which is
// why it only ever worked for fenced markdown.
//
// The catalog is keyed by CONTENT HASH — deliberately, so that a re-scrape of
// the repo is naturally idempotent. Git's sha versions a Command; the hash
// identifies it in the catalog. Different jobs, both needed.

export type CatalogState = 'unapproved' | 'approved' | 'superseded';

export const CATALOG: Record<
	CatalogState,
	{ label: string; color: string; icon: IconName; blurb: string }
> = {
	unapproved: {
		label: 'Not in the catalog',
		color: 'var(--fg-dim)',
		icon: 'code',
		blurb: 'Ordinary prose. No runner will execute it until a human approves it.'
	},
	approved: {
		label: 'Approved',
		color: 'var(--palette-emerald-l)',
		icon: 'shield-check',
		blurb: 'In the command catalog. A runner will execute it and emit evidence.'
	},
	superseded: {
		label: 'Changed since approval',
		color: 'var(--palette-amber)',
		icon: 'alert-triangle',
		blurb: 'The body was edited after approval. Re-approve before it can run again.'
	}
};

/**
 * A changed command must never inherit the authority of the one a human
 * approved. That refusal is the safety property the whole feature rests on.
 */
export function catalogState(c: Command): CatalogState {
	if (!c.approval) return 'unapproved';
	return c.approval.approved_hash === c.body_hash ? 'approved' : 'superseded';
}

// ── The source axis ───────────────────────────────────────────────────────
// Only meaningful for a Command discovered by parsing a repo document. This is
// NOT a catalog state — it is the same question the clause re-anchoring flow
// already asks, one level down: a thing we point at moved underneath us.

export const SOURCE: Record<string, { label: string; color: string; blurb: string }> = {
	tracking: {
		label: 'Tracking source',
		color: 'var(--fg-dim)',
		blurb: 'The block in the source document still matches what we parsed.'
	},
	drifted: {
		label: 'Source drifted',
		color: 'var(--palette-amber)',
		blurb: 'The block changed in its document. Re-read it, or detach and keep this copy.'
	},
	orphaned: {
		label: 'Source gone',
		color: 'var(--palette-red)',
		blurb: 'The block was deleted from its document. This Command outlived it.'
	}
};

// ── Binding status ────────────────────────────────────────────────────────
// What a bound check is saying about the clause it is attached to, at a glance.
//
// This deliberately does NOT invent a second vocabulary alongside freshness.
// Freshness is the clock, the run outcome is the verdict, and status is their
// product: `overdue` IS `expired`, `due` IS `stale`. Anything else would give a
// reader two words for one fact.

export type BindingStatus =
	| 'blocked'
	| 'running'
	| 'failing'
	| 'overdue'
	| 'due'
	| 'passing'
	| 'never_run';

export const BINDING_STATUS: Record<
	BindingStatus,
	{ label: string; color: string; icon: IconName; blurb: string }
> = {
	blocked: {
		label: 'Cannot run',
		color: 'var(--palette-amber)',
		icon: 'shield-alert',
		blurb: 'Not approved in the catalog, so no runner will touch it.'
	},
	running: {
		label: 'Running',
		color: 'var(--accent)',
		icon: 'loader-2',
		blurb: 'Dispatched to its runner.'
	},
	failing: {
		label: 'Failing',
		color: 'var(--palette-red)',
		icon: 'x-circle',
		blurb: 'It ran, and the control did not hold. Worse than no proof.'
	},
	overdue: {
		label: 'Past cadence',
		color: 'var(--palette-red)',
		icon: 'alert-triangle',
		blurb: 'It passed, but too long ago to prove this period.'
	},
	due: {
		label: 'Due to re-run',
		color: 'var(--palette-amber)',
		icon: 'clock',
		blurb: 'Still inside cadence, but close enough to re-collect now.'
	},
	passing: {
		label: 'Passing',
		color: 'var(--palette-emerald-l)',
		icon: 'check-circle',
		blurb: 'Proven, and current against this clause’s cadence.'
	},
	never_run: {
		label: 'Never run',
		color: 'var(--fg-dim)',
		icon: 'circle',
		blurb: 'Bound with a plan, but it has produced no proof yet.'
	}
};

/**
 * Resolved in strict precedence: can it run → is it running → did it pass →
 * is that pass still current. Cadence comes from the SECTION, never from the
 * Command, because the same Command bound to a 90-day and a 365-day control is
 * judged differently by each.
 */
export function bindingStatus(
	c: Command,
	cadence_days: number,
	running = false
): BindingStatus {
	if (running) return 'running';
	if (catalogState(c) !== 'approved') return 'blocked';
	const last = c.runs[0];
	if (!last) return 'never_run';
	if (last.outcome !== 'pass') return 'failing';
	const f = freshnessOf(last.age_days, cadence_days);
	return f === 'expired' ? 'overdue' : f === 'stale' ? 'due' : 'passing';
}

/** Worst status across a clause's bindings — what the dock icon shows. */
const STATUS_RANK: BindingStatus[] = [
	'failing',
	'overdue',
	'blocked',
	'due',
	'never_run',
	'running',
	'passing'
];

export function worstBindingStatus(statuses: BindingStatus[]): BindingStatus | null {
	if (statuses.length === 0) return null;
	for (const s of STATUS_RANK) if (statuses.includes(s)) return s;
	return statuses[0];
}

/** A schedule that cannot keep its control fresh is worth saying out loud. */
export function scheduleFits(b: CommandBinding, cadence_days: number): boolean {
	return b.trigger.mode !== 'scheduled' || b.trigger.every_days <= cadence_days;
}

// ── Freshness ─────────────────────────────────────────────────────────────
// The one piece of arithmetic an auditor actually cares about: how far through
// its cadence a citation is. Bands are generous early and unforgiving at the
// end — evidence at 99% of cadence is still valid, and saying so beats crying
// wolf.

export const FRESHNESS: Record<Freshness, { label: string; color: string; icon: IconName }> = {
	fresh: { label: 'Fresh', color: 'var(--palette-emerald-l)', icon: 'check-circle' },
	aging: { label: 'Aging', color: 'var(--palette-blue)', icon: 'clock' },
	stale: { label: 'Due for re-collection', color: 'var(--palette-amber)', icon: 'clock' },
	expired: { label: 'Past cadence', color: 'var(--palette-red)', icon: 'alert-triangle' }
};

export function freshnessOf(age_days: number, cadence_days: number): Freshness {
	const r = age_days / cadence_days;
	if (r >= 1) return 'expired';
	if (r >= 0.75) return 'stale';
	if (r >= 0.4) return 'aging';
	return 'fresh';
}

/**
 * A clause's evidence is scored against the STRICTEST control it claims — one
 * serving both a 90-day and a 365-day control has to satisfy the 90.
 */
export function cadenceFor(cs: Control[], fallback_days: number): number {
	if (cs.length === 0) return fallback_days;
	return Math.min(...cs.map((c) => c.cadence_days));
}

export function worstFreshness(items: Evidence[], cadence_days: number): Freshness | null {
	if (items.length === 0) return null;
	const order: Freshness[] = ['fresh', 'aging', 'stale', 'expired'];
	return items
		.map((e) => freshnessOf(e.age_days, cadence_days))
		.reduce((a, b) => (order.indexOf(b) > order.indexOf(a) ? b : a));
}

/**
 * Every control a clause's evidence actually satisfies, including equivalents in
 * other frameworks reached through the crosswalk. This is the number that makes
 * the control model worth building: one run, several frameworks answered.
 */
export function alsoSatisfied(cs: Control[]): { ref: string; framework: string }[] {
	const out: { ref: string; framework: string }[] = [];
	const seen = new Set(cs.map((c) => `${c.framework} ${c.ref}`));
	for (const c of cs) {
		for (const x of c.crosswalk) {
			const key = `${x.framework} ${x.ref}`;
			if (x.strength === 'equivalent' && !seen.has(key)) {
				seen.add(key);
				out.push({ ref: x.ref, framework: x.framework });
			}
		}
	}
	return out;
}
