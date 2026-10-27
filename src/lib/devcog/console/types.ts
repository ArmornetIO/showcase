// The console's vocabulary. Declared values, not `{#if}`s scattered across
// three files — which is how the old panel could hide half of itself without
// anyone noticing it had.
import type { Snippet } from 'svelte';
import type { NitsController } from '../qa/nits.svelte.js';

/** When a control's change takes effect. Rendered as a badge, never a sentence. */
export type AppliesWhen = 'live' | 'reload' | 'resize';

/** One tab of the console. */
export interface ToolGroup {
	id: string;
	/** Rail label. Keep it to ~7 characters — the rail is 52px wide. */
	label: string;
	/** Rail glyph. */
	glyph?: string;
	/** Rail order. Built-ins occupy 50/60/70 so a host can sit before or between. */
	order?: number;
	/**
	 * False when the current context does not offer this group. It still renders
	 * in the rail: a group that vanishes is a group nobody knows exists.
	 */
	available?: boolean;
	/** Why it is unavailable. Required when `available` is false. */
	gate?: string;
	/** Allowed to scroll internally. Only the capture batch should set this. */
	scrolls?: boolean;
	/** Badge on the rail entry, e.g. the pending capture count. */
	count?: number;
	/** The group body. Receives the one inspector so host tools can borrow it. */
	content: Snippet<[NitsController]>;
}

/** Storage keys and branding the host injects, so nothing here is app-specific. */
export interface ConsoleConfig {
	/**
	 * Cookie holding the open state and selected group. Every console on the
	 * host that uses the same name stays aligned with the others.
	 */
	stateKey: string;
}

export const DEFAULT_CONSOLE_CONFIG: ConsoleConfig = {
	stateKey: 'devcog_console'
};
