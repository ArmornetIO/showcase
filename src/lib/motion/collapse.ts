// ── Collapse — a quick height transition for expand/collapse regions ─────────
// The counterpart to Flourish: Flourish is a decorative burst keyed by a replay
// counter, this is a real enter/leave transition for a region that opens and
// closes. Use it on the element an `{#if}` creates and removes:
//
//   {#if open}
//     <div transition:collapse>…</div>
//   {/if}
//
// Deliberately short — a nav subtree closing is feedback, not choreography, so
// the default is fast enough to read as "it snapped shut" rather than an
// animation you wait on.
import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';
import { prefersReducedMotion } from './reduced-motion.js';

export interface CollapseParams {
	/** Milliseconds. Kept short by default — this is feedback, not choreography. */
	duration?: number;
	delay?: number;
	easing?: (t: number) => number;
	/** Opacity at the closed end. 1 disables the fade and animates height only. */
	opacity?: number;
}

/** The box measurements a collapse interpolates. All values in px. */
export interface CollapseMetrics {
	height: number;
	paddingTop: number;
	paddingBottom: number;
	marginTop: number;
	marginBottom: number;
	/** Opacity of the element at rest (the open end of the fade). */
	opacity: number;
}

/** Default duration — short enough to feel instant, long enough to be seen. */
export const COLLAPSE_DURATION = 160;

/**
 * The interpolated style at progress `t` (0 = closed, 1 = open). Pure and
 * exported so the geometry can be unit-tested without a DOM.
 */
export function collapseCss(t: number, m: CollapseMetrics, closedOpacity = 0): string {
	const fade = closedOpacity + t * (m.opacity - closedOpacity);
	return (
		'overflow: hidden;' +
		`height: ${t * m.height}px;` +
		`padding-top: ${t * m.paddingTop}px;` +
		`padding-bottom: ${t * m.paddingBottom}px;` +
		`margin-top: ${t * m.marginTop}px;` +
		`margin-bottom: ${t * m.marginBottom}px;` +
		`opacity: ${fade};`
	);
}

/** Read the open-state box metrics off a live element. */
export function readMetrics(node: Element): CollapseMetrics {
	const s = getComputedStyle(node);
	const num = (v: string) => parseFloat(v) || 0;
	return {
		height: num(s.height),
		paddingTop: num(s.paddingTop),
		paddingBottom: num(s.paddingBottom),
		marginTop: num(s.marginTop),
		marginBottom: num(s.marginBottom),
		opacity: s.opacity === '' ? 1 : num(s.opacity)
	};
}

/**
 * Svelte transition: slides a region open/closed by animating its height.
 *
 * Honours `prefers-reduced-motion` by collapsing to a 0ms cut — the region
 * still appears and disappears, it just does not travel.
 */
export function collapse(node: Element, params: CollapseParams = {}): TransitionConfig {
	const { duration = COLLAPSE_DURATION, delay = 0, easing = cubicOut, opacity = 0 } = params;
	const metrics = readMetrics(node);
	return {
		delay,
		duration: prefersReducedMotion() ? 0 : duration,
		easing,
		css: (t) => collapseCss(t, metrics, opacity)
	};
}
