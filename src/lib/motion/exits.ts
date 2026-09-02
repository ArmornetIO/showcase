// ── Exit motions — the shared source of truth ────────────────────────────────
// The counterpart to `effects.ts`. That file catalogues the decorative bursts a
// control can play; this one catalogues how a transient overlay (a menu, a
// popover) leaves the screen. Both the advanced-settings menu (which lets you
// pick one) and the primitives (which play one) read from here, so the list can
// never drift.
//
// A primitive should NOT hardcode a transition. Ask for the current one:
//
//   const spec = $derived(advancedSettings.exit);
//   <div out:go={{ duration: spec.duration }}>   // go = spec.transition
//
// …and it inherits the global preference for free, with no prop to thread.
// This module stays a pure catalogue and imports no state: the settings store
// imports `normalizeExit` from here, so a dependency back the other way would
// be a cycle. `advancedSettings.exit` — the derived "what is selected right
// now" — therefore lives with the store.
import type { TransitionConfig } from 'svelte/transition';
import { collapse, COLLAPSE_DURATION } from './collapse.js';
import { vanish, VANISH_DURATION } from './vanish.js';
import { implode, IMPLODE_DURATION } from './implode.js';

export type ExitKind = 'implode' | 'vanish' | 'collapse' | 'none';

/**
 * The narrowest useful transition contract — only `duration` is passed, so any
 * motion primitive (or a caller's own) drops in without widening this type.
 */
export type MotionExit = (node: Element, params: { duration?: number }) => TransitionConfig;

export interface ExitOption {
	value: ExitKind;
	label: string;
	description: string;
}

/** The selectable exits, in menu order. */
export const EXITS: ExitOption[] = [
	{
		value: 'implode',
		label: 'Implode',
		description: 'The panel folds into a lit bar, then pinches out.'
	},
	{
		value: 'vanish',
		label: 'Vanish',
		description: 'The panel retracts toward the control that opened it.'
	},
	{
		value: 'collapse',
		label: 'Collapse',
		description: 'The panel squeezes shut, losing its height.'
	},
	{ value: 'none', label: 'None', description: 'The panel is removed instantly.' }
];

/** An instant removal — the honest "no motion" option, not a 1ms fade. */
export const cut: MotionExit = () => ({ duration: 0 });

export interface ExitSpec {
	/** The Svelte transition to run as the node is destroyed. */
	transition: MotionExit;
	/** Its natural duration in ms, so a caller need not know the number. */
	duration: number;
}

/** Every exit paired with its natural duration. */
export const EXIT_SPECS: Readonly<Record<ExitKind, ExitSpec>> = Object.freeze({
	implode: { transition: implode, duration: IMPLODE_DURATION },
	vanish: { transition: vanish, duration: VANISH_DURATION },
	collapse: { transition: collapse, duration: COLLAPSE_DURATION },
	none: { transition: cut, duration: 0 }
});

const KINDS = new Set<ExitKind>(['implode', 'vanish', 'collapse', 'none']);

/** The exit used when nothing has been chosen or a stored value is junk. */
export const DEFAULT_EXIT: ExitKind = 'implode';

/** Coerce an untrusted value (e.g. from localStorage) to a valid kind. */
export function normalizeExit(v: unknown): ExitKind {
	return typeof v === 'string' && KINDS.has(v as ExitKind) ? (v as ExitKind) : DEFAULT_EXIT;
}

/** Look up a kind's spec. */
export function exitSpec(kind: ExitKind): ExitSpec {
	return EXIT_SPECS[normalizeExit(kind)];
}
