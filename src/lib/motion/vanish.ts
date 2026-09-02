// ── Vanish — a floating panel retracting into the control that opened it ─────
// The counterpart to `collapse`: collapse is for a region embedded in the flow
// that squeezes its neighbours back together, this is for something that floats
// *over* the page and should read as being pulled back to its source rather
// than as a box losing height.
//
//   {#if open}
//     <div class="menu" out:vanish={{ origin: 'top right' }}>…</div>
//   {/if}
//
// Four cheap, compositor-friendly channels move at once — lift, scale, blur and
// fade — which is what makes it read as "sucked back in" rather than "faded
// out". Point it at the trigger with `origin`; a menu anchored bottom-end wants
// `top right`, one anchored bottom-start wants `top left`.
import { cubicIn } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';
import { prefersReducedMotion } from './reduced-motion.js';

export interface VanishParams {
	/** Milliseconds. */
	duration?: number;
	delay?: number;
	easing?: (t: number) => number;
	/** How far the panel pulls toward its trigger, px. */
	lift?: number;
	/** Scale at the closed end. 1 disables the shrink. */
	scale?: number;
	/** Peak blur at the closed end, px. 0 disables it. */
	blur?: number;
	/**
	 * CSS `transform-origin` — the point the panel retracts toward.
	 *
	 * Defaults to reading `--exit-origin` off the node, so a component that
	 * knows where it is anchored (a menu that flips between bottom-start and
	 * bottom-end, say) can steer the retraction from CSS without the caller
	 * having to thread the value through the transition's params.
	 */
	origin?: string;
}

/** The resolved knobs `vanishCss` interpolates. */
export type VanishGeometry = Required<Pick<VanishParams, 'lift' | 'scale' | 'blur' | 'origin'>>;

/** Long enough to read as a movement, short enough to never be in the way. */
export const VANISH_DURATION = 200;

export const VANISH_DEFAULTS: Readonly<VanishGeometry> = Object.freeze({
	lift: 8,
	scale: 0.92,
	blur: 4,
	origin: 'var(--exit-origin, top center)'
});

/**
 * The interpolated style at progress `t` (0 = gone, 1 = at rest). Pure and
 * exported so the curve can be unit-tested without a DOM.
 */
export function vanishCss(t: number, g: VanishGeometry): string {
	const u = 1 - t; // how far along the exit we are
	return (
		`transform-origin: ${g.origin};` +
		// The minus is a literal in the CSS, not an operator on the number. Inside
		// the interpolation it would bind looser than `.toFixed` — `-(u *
		// g.lift).toFixed(3)` formats "4.000" and then coerces it straight back to
		// the number -4, throwing away the padding. Negating first is no better at
		// rest: `u` is 0 there, and `(-0).toFixed(3)` is "0.000", because toFixed
		// drops the sign on negative zero.
		`transform: translateY(-${(u * g.lift).toFixed(3)}px) scale(${(g.scale + t * (1 - g.scale)).toFixed(4)});` +
		`filter: blur(${(u * g.blur).toFixed(3)}px);` +
		`opacity: ${t.toFixed(4)};`
	);
}

/**
 * Svelte transition: retracts a floating panel toward `origin` while it fades.
 *
 * Honours `prefers-reduced-motion` by collapsing to a 0ms cut — the panel still
 * disappears, it just does not travel.
 */
export function vanish(node: Element, params: VanishParams = {}): TransitionConfig {
	const {
		duration = VANISH_DURATION,
		delay = 0,
		easing = cubicIn,
		lift = VANISH_DEFAULTS.lift,
		scale = VANISH_DEFAULTS.scale,
		blur = VANISH_DEFAULTS.blur,
		origin = VANISH_DEFAULTS.origin
	} = params;
	return {
		delay,
		duration: prefersReducedMotion() ? 0 : duration,
		easing,
		css: (t) => vanishCss(t, { lift, scale, blur, origin })
	};
}
