// ── Flourish effects — the shared source of truth ────────────────────────────
// Both the advanced-settings menu (which lets you pick one) and the Flourish
// primitive (which plays one) read from here, so the list can never drift.

export type FlourishKind = 'none' | 'sparkle' | 'firework' | 'shimmer' | 'aurora';

export interface FlourishOption {
	value: Exclude<FlourishKind, 'none'>;
	label: string;
	description: string;
}

/** The selectable effects, in menu order. `none` is the implicit default and is
 *  intentionally absent — "select nothing" is how you get the plain look back. */
export const FLOURISHES: FlourishOption[] = [
	{ value: 'sparkle', label: 'Sparkle', description: 'Four-point stars scatter from the icon.' },
	{ value: 'firework', label: 'Firework', description: 'A radial burst detonates on select.' },
	{ value: 'shimmer', label: 'Shimmer', description: 'A light sweeps across, trailing stars.' },
	{ value: 'aurora', label: 'Aurora Glow', description: 'A soft glow blooms with orbiting sparks.' }
];

const KINDS = new Set<FlourishKind>(['none', 'sparkle', 'firework', 'shimmer', 'aurora']);

/** Coerce an untrusted value (e.g. from localStorage) to a valid kind. */
export function normalizeFlourish(v: unknown): FlourishKind {
	return typeof v === 'string' && KINDS.has(v as FlourishKind) ? (v as FlourishKind) : 'none';
}
