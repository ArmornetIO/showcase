import { readJson, writeJson } from '../storage.js';
import { normalizeFlourish, type FlourishKind } from '../motion/effects.js';
import {
	DEFAULT_EXIT,
	exitSpec,
	normalizeExit,
	type ExitKind,
	type ExitSpec
} from '../motion/exits.js';

// ── Advanced settings — the app's "power user" preferences ───────────────────
// Deliberately its own store rather than piggy-backing on the theme store:
// themes are about colour, this is about behaviour, and more advanced toggles
// will land here over time.

const STORAGE_KEY = 'armornet-advanced-settings';

export interface AdvancedSettings {
	/** Which selection flourish the side nav plays on click. `none` = plain. */
	navFlourish: FlourishKind;
	/**
	 * How transient overlays — menus, popovers — leave the screen. Global on
	 * purpose: a primitive reads it rather than taking a prop, so every overlay
	 * in both apps moves the same way without a single call site restating it.
	 */
	overlayExit: ExitKind;
	/**
	 * Idle time in ms before an overlay that opted into auto-dismissal closes
	 * itself. Not whether it dismisses — that stays a per-surface decision —
	 * only how long the shared timer runs.
	 */
	overlayIdleMs: number;
}

const DEFAULTS: AdvancedSettings = {
	navFlourish: 'none',
	overlayExit: DEFAULT_EXIT,
	overlayIdleMs: 2000
};

/** Guard rails for a value that reaches a timer — and may come from storage. */
const IDLE_MIN = 250;
const IDLE_MAX = 60_000;

function normalizeIdleMs(v: unknown): number {
	const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULTS.overlayIdleMs;
	return Math.min(IDLE_MAX, Math.max(IDLE_MIN, Math.round(n)));
}

/** Every stored field is re-normalised: what comes back was written by an older build. */
function revive(parsed: unknown): AdvancedSettings {
	const p = (parsed ?? {}) as Partial<AdvancedSettings>;
	return {
		navFlourish: normalizeFlourish(p.navFlourish),
		overlayExit: normalizeExit(p.overlayExit),
		overlayIdleMs: normalizeIdleMs(p.overlayIdleMs)
	};
}

/**
 * The advanced preferences, as one store.
 *
 * Reads are plain property access; every write goes through a setter that
 * normalises and persists, so there is no way to leave the in-memory value and
 * the stored value disagreeing.
 */
class AdvancedSettingsStore {
	#navFlourish = $state<FlourishKind>(DEFAULTS.navFlourish);
	#overlayExit = $state<ExitKind>(DEFAULTS.overlayExit);
	#overlayIdleMs = $state(DEFAULTS.overlayIdleMs);
	#hydrated = false;

	get navFlourish(): FlourishKind {
		return this.#navFlourish;
	}

	get overlayExit(): ExitKind {
		return this.#overlayExit;
	}

	get overlayIdleMs(): number {
		return this.#overlayIdleMs;
	}

	/**
	 * The selected exit motion, resolved to a transition and its duration.
	 *
	 * This is what a primitive reads instead of hardcoding an animation or taking
	 * an `exit` prop. Derived, so a component that reads it re-renders when the
	 * preference changes with no subscription to manage.
	 */
	readonly exit: ExitSpec = $derived(exitSpec(this.#overlayExit));

	setNavFlourish(kind: FlourishKind): void {
		this.#navFlourish = normalizeFlourish(kind);
		this.#persist();
	}

	setOverlayExit(kind: ExitKind): void {
		this.#overlayExit = normalizeExit(kind);
		this.#persist();
	}

	setOverlayIdleMs(ms: number): void {
		this.#overlayIdleMs = normalizeIdleMs(ms);
		this.#persist();
	}

	/** Load the cached preferences. Call once from the app shell; idempotent. */
	hydrate(): void {
		if (this.#hydrated) return;
		this.#hydrated = true;
		const stored = readJson(STORAGE_KEY, DEFAULTS, revive);
		this.#navFlourish = stored.navFlourish;
		this.#overlayExit = stored.overlayExit;
		this.#overlayIdleMs = stored.overlayIdleMs;
	}

	/** Back to shipped defaults, cache included. */
	reset(): void {
		this.#navFlourish = DEFAULTS.navFlourish;
		this.#overlayExit = DEFAULTS.overlayExit;
		this.#overlayIdleMs = DEFAULTS.overlayIdleMs;
		this.#persist();
	}

	#persist(): void {
		writeJson(STORAGE_KEY, {
			navFlourish: this.#navFlourish,
			overlayExit: this.#overlayExit,
			overlayIdleMs: this.#overlayIdleMs
		} satisfies AdvancedSettings);
	}
}

export const advancedSettings = new AdvancedSettingsStore();
