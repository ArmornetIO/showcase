import { readJson, writeJson } from '../storage.js';
import { formatStack, parseStack, type BackdropId } from '../backdrop/backdrops.js';
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
	/**
	 * Which animated backdrop the app shell paints, or `none`.
	 *
	 * It lives here rather than in the theme store for the reason stated at the
	 * top of this file — themes are about colour, this is about behaviour — and
	 * a backdrop is closest to `navFlourish`: a decorative flourish, off by
	 * default, that a person goes looking for.
	 *
	 * Default is `none` on purpose. The app ships without one today, and turning
	 * a per-frame effect on for every user by way of a settings refactor is a
	 * visual change nobody asked for.
	 */
	backdrop: BackdropChoice;
	/**
	 * 0–1. The knob that has to exist: every backdrop is a compositing cost on a
	 * dense page, so a person must be able to turn it down without turning it
	 * off.
	 */
	backdropStrength: number;
	/**
	 * How hard the corners are, app-wide. Behaviour rather than colour, so it
	 * lands here for the reason at the top of this file — and it is an axis
	 * crossed with the palette, not a sixth palette.
	 *
	 * `soft` is the default because it reproduces what shipped: the tiers in
	 * `tokens.css` are calibrated to the radii the components already had, so
	 * turning this store on changes nothing until someone picks otherwise.
	 */
	radius: RadiusChoice;
	/**
	 * How the side nav draws its hierarchy: plain indent + chevrons, or the
	 * commit-graph gutter.
	 *
	 * A preference rather than a prop because it is one look for the whole app —
	 * two navs drawn differently in the same session is not a variant, it is a
	 * bug — and because it is exactly the kind of thing a person turns on for
	 * themselves and nobody else.
	 */
	navStyle: NavStyleChoice;
}

/** `plain` is what shipped; `graph` draws the branch/merge gutter. */
export type NavStyleChoice = 'plain' | 'graph';

const NAV_STYLES: readonly NavStyleChoice[] = ['plain', 'graph'];

/** Sharp is squared-off, soft is what shipped, round overshoots deliberately. */
export type RadiusChoice = 'sharp' | 'soft' | 'round';

const RADIUS_CHOICES: readonly RadiusChoice[] = ['sharp', 'soft', 'round'];

/**
 * `none`, every standalone family, every Möbius composition — or several of
 * them comma-joined, which is how a stack is stored.
 *
 * A string rather than a `BackdropId[]` so the stored shape is unchanged: what
 * an older build wrote is a valid stack of one, and what this writes is
 * readable by anything that only understands single ids as long as it goes
 * through `parseStack`.
 */
export type BackdropChoice = BackdropId | string;

const DEFAULTS: AdvancedSettings = {
	navFlourish: 'none',
	overlayExit: DEFAULT_EXIT,
	overlayIdleMs: 2000,
	backdrop: 'none',
	backdropStrength: 0.85,
	radius: 'soft',
	navStyle: 'plain'
};

/** Guard rails for a value that reaches a timer — and may come from storage. */
const IDLE_MIN = 250;
const IDLE_MAX = 60_000;

function normalizeIdleMs(v: unknown): number {
	const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULTS.overlayIdleMs;
	return Math.min(IDLE_MAX, Math.max(IDLE_MIN, Math.round(n)));
}

/**
 * A stored backdrop name is only valid if the preset list still has it —
 * compositions get renamed and removed, and a dangling name would resolve to
 * nothing and paint an empty layer rather than falling back visibly.
 *
 * `parseStack` applies that rule to every member of a stack and drops the ones
 * that no longer resolve, so a stack that has lost one layer keeps painting the
 * others instead of falling back to `none` wholesale.
 */
function normalizeBackdrop(v: unknown): BackdropChoice {
	return formatStack(parseStack(v));
}

function normalizeRadius(v: unknown): RadiusChoice {
	return RADIUS_CHOICES.includes(v as RadiusChoice) ? (v as RadiusChoice) : DEFAULTS.radius;
}

function normalizeNavStyle(v: unknown): NavStyleChoice {
	return NAV_STYLES.includes(v as NavStyleChoice) ? (v as NavStyleChoice) : DEFAULTS.navStyle;
}

function normalizeStrength(v: unknown): number {
	const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULTS.backdropStrength;
	return Math.min(1, Math.max(0, n));
}

/** Every stored field is re-normalised: what comes back was written by an older build. */
function revive(parsed: unknown): AdvancedSettings {
	const p = (parsed ?? {}) as Partial<AdvancedSettings>;
	return {
		navFlourish: normalizeFlourish(p.navFlourish),
		overlayExit: normalizeExit(p.overlayExit),
		overlayIdleMs: normalizeIdleMs(p.overlayIdleMs),
		backdrop: normalizeBackdrop(p.backdrop),
		backdropStrength: normalizeStrength(p.backdropStrength),
		radius: normalizeRadius(p.radius),
		navStyle: normalizeNavStyle(p.navStyle)
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
	#backdrop = $state<BackdropChoice>(DEFAULTS.backdrop);
	#backdropStrength = $state(DEFAULTS.backdropStrength);
	#radius = $state<RadiusChoice>(DEFAULTS.radius);
	#navStyle = $state<NavStyleChoice>(DEFAULTS.navStyle);
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

	get backdrop(): BackdropChoice {
		return this.#backdrop;
	}

	get backdropStrength(): number {
		return this.#backdropStrength;
	}

	get radius(): RadiusChoice {
		return this.#radius;
	}

	get navStyle(): NavStyleChoice {
		return this.#navStyle;
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

	setBackdrop(choice: BackdropChoice): void {
		this.#backdrop = normalizeBackdrop(choice);
		this.#persist();
	}

	setBackdropStrength(v: number): void {
		this.#backdropStrength = normalizeStrength(v);
		this.#persist();
	}

	setRadius(choice: RadiusChoice): void {
		this.#radius = normalizeRadius(choice);
		this.#persist();
	}

	setNavStyle(choice: NavStyleChoice): void {
		this.#navStyle = normalizeNavStyle(choice);
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
		this.#backdrop = stored.backdrop;
		this.#backdropStrength = stored.backdropStrength;
		this.#radius = stored.radius;
		this.#navStyle = stored.navStyle;
	}

	/** Back to shipped defaults, cache included. */
	reset(): void {
		this.#navFlourish = DEFAULTS.navFlourish;
		this.#overlayExit = DEFAULTS.overlayExit;
		this.#overlayIdleMs = DEFAULTS.overlayIdleMs;
		this.#backdrop = DEFAULTS.backdrop;
		this.#backdropStrength = DEFAULTS.backdropStrength;
		this.#radius = DEFAULTS.radius;
		this.#navStyle = DEFAULTS.navStyle;
		this.#persist();
	}

	#persist(): void {
		writeJson(STORAGE_KEY, {
			navFlourish: this.#navFlourish,
			overlayExit: this.#overlayExit,
			overlayIdleMs: this.#overlayIdleMs,
			backdrop: this.#backdrop,
			backdropStrength: this.#backdropStrength,
			radius: this.#radius,
			navStyle: this.#navStyle
		} satisfies AdvancedSettings);
	}
}

export const advancedSettings = new AdvancedSettingsStore();
