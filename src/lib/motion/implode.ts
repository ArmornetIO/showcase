// ── Implode — a panel folding into itself, game-HUD style ────────────────────
// Where `vanish` is a polite retraction and `collapse` is a height squeeze, this
// is the one with a bit of theatre: the panel snaps shut vertically into a lit
// bar, then that bar pinches to a point and blinks out. It is the CRT power-off,
// which is why it reads as a UI *closing* rather than a box fading.
//
//   {#if open}
//     <div class="menu" out:implode>…</div>
//   {/if}
//
// Two phases share one progress value, so it stays a single pure function of
// `t` and needs no keyframes or timers:
//
//   phase A (fold)   scaleY 1 → 0.05, scaleX bulges slightly, brightness rises
//   phase B (pinch)  scaleX → 0 while the bar dims out
//
// A fade is deliberately confined to the tail: fading the whole way is what
// makes an exit read as "it disappeared" instead of "it closed".
import { cubicIn } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';
import { prefersReducedMotion } from './reduced-motion.js';

export interface ImplodeParams {
	/** Milliseconds. */
	duration?: number;
	delay?: number;
	easing?: (t: number) => number;
	/** Share of the exit spent folding before the pinch begins, 0–1. */
	split?: number;
	/** Height of the lit bar at the end of the fold, as a scale factor. */
	bar?: number;
	/** How far the panel widens as it folds — the squeezed-out look. */
	bulge?: number;
	/** Peak brightness multiplier at full fold. 0 disables the flash. */
	flash?: number;
	/** CSS `transform-origin` — the point the panel folds into. */
	origin?: string;
}

/** The resolved knobs `implodeCss` interpolates. */
export type ImplodeGeometry = Required<
	Pick<ImplodeParams, 'split' | 'bar' | 'bulge' | 'flash' | 'origin'>
>;

/** Long enough for two phases to read as two phases. */
export const IMPLODE_DURATION = 260;

export const IMPLODE_DEFAULTS: Readonly<ImplodeGeometry> = Object.freeze({
	split: 0.55,
	bar: 0.05,
	bulge: 0.06,
	flash: 0.7,
	// Centre, not the anchored corner: the point of this one is that the panel
	// folds into *itself*. Retracting toward the trigger is `vanish`'s job.
	origin: 'center'
});

/**
 * The interpolated style at progress `t` (0 = gone, 1 = at rest). Pure and
 * exported so both phases can be unit-tested without a DOM.
 */
export function implodeCss(t: number, g: ImplodeGeometry): string {
	const u = 1 - t; // exit progress, 0 → 1
	let scaleX: number;
	let scaleY: number;
	let opacity: number;
	let lit: number;

	if (u <= g.split) {
		// Phase A — fold vertically into a bar, widening a touch as it goes.
		const p = g.split === 0 ? 1 : u / g.split;
		scaleY = 1 - p * (1 - g.bar);
		scaleX = 1 + p * g.bulge;
		opacity = 1;
		lit = 1 + p * g.flash;
	} else {
		// Phase B — pinch the bar to a point and blink it out.
		const q = g.split === 1 ? 1 : (u - g.split) / (1 - g.split);
		scaleY = g.bar * (1 - q * 0.4);
		scaleX = (1 + g.bulge) * (1 - q);
		opacity = 1 - q;
		lit = 1 + g.flash;
	}

	return (
		`transform-origin: ${g.origin};` +
		`transform: scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)});` +
		`filter: brightness(${lit.toFixed(3)});` +
		`opacity: ${opacity.toFixed(4)};`
	);
}

/**
 * Svelte transition: folds a panel into a lit bar, then pinches it out.
 *
 * Honours `prefers-reduced-motion` by collapsing to a 0ms cut — the panel still
 * disappears, it just does not perform.
 */
export function implode(node: Element, params: ImplodeParams = {}): TransitionConfig {
	const {
		duration = IMPLODE_DURATION,
		delay = 0,
		easing = cubicIn,
		split = IMPLODE_DEFAULTS.split,
		bar = IMPLODE_DEFAULTS.bar,
		bulge = IMPLODE_DEFAULTS.bulge,
		flash = IMPLODE_DEFAULTS.flash,
		origin = IMPLODE_DEFAULTS.origin
	} = params;
	return {
		delay,
		duration: prefersReducedMotion() ? 0 : duration,
		easing,
		css: (t) => implodeCss(t, { split, bar, bulge, flash, origin })
	};
}
