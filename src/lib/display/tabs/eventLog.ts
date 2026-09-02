// Presentational helpers for an activity log, shared by EventLogTab (the full
// log) and EntityOverviewTab (the recent-activity excerpt).
//
// The library owns a small TONE vocabulary rather than any particular product's
// event names. A host maps its own kinds onto a tone at the call site — one
// lookup table there beats this file knowing what a "dns_block" is.

/** The character of a log entry. Drives its colour and glyph, nothing else. */
export type LogEventTone =
	| 'up'
	| 'down'
	| 'degraded'
	| 'denied'
	| 'sync'
	| 'error'
	| 'relay'
	| 'neutral';

/** One row in an activity list. `ts` is a pre-formatted display string —
 *  formatting is the host's job, since only it knows the reader's locale and
 *  whether "3m ago" or an absolute stamp is the useful thing. */
export interface LogEventVM {
	/** Defaults to `neutral` when the host has no opinion. */
	tone?: LogEventTone;
	msg: string;
	ts: string;
}

const TONE_COLOR: Record<LogEventTone, string> = {
	up: 'var(--accent-emerald)',
	down: 'var(--fg-dim)',
	degraded: 'var(--palette-amber)',
	denied: 'var(--palette-red)',
	sync: 'var(--palette-blue)',
	error: 'var(--palette-amber)',
	relay: 'var(--palette-violet)',
	neutral: 'var(--fg-dim)'
};

const TONE_ICON: Record<LogEventTone, string> = {
	up: '↑',
	down: '↓',
	degraded: '△',
	denied: '⊘',
	sync: '⟳',
	error: '!',
	relay: '⇄',
	neutral: '·'
};

/** Accent colour for a tone, as a CSS value. */
export function eventColor(tone: LogEventTone | undefined): string {
	return TONE_COLOR[tone ?? 'neutral'];
}

/** Single-glyph icon for a tone. */
export function eventIcon(tone: LogEventTone | undefined): string {
	return TONE_ICON[tone ?? 'neutral'];
}
