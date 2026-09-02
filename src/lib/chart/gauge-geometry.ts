// Pure geometry for the gauge renderer.
//
// Separate from the component for the same reason `chart-scales.ts` is: this is
// where a gauge is actually wrong or right — a band that overlaps its
// neighbour, a reading that sweeps off the end of the dial, an arc flag that
// flips at 180° — and none of it needs a DOM to check.

import type { GaugeBand } from './chart.types.js';

/** Domain value → 0–1 along the arc. Clamped: an out-of-range reading pins to
 *  an end rather than sweeping off the dial or wrapping past the start. */
export function gaugeFrac(value: number, domain: [number, number]): number {
	const [lo, hi] = domain;
	const span = hi - lo;
	if (!Number.isFinite(span) || span === 0) return 0;
	return Math.max(0, Math.min(1, (value - lo) / span));
}

export interface GaugeSegment {
	/** 0–1 along the arc. */
	from: number;
	to: number;
	color: string;
	label?: string;
}

/**
 * Bands → contiguous arc segments.
 *
 * Bands are declared by upper bound only, so each necessarily starts where the
 * previous stopped: a scale cannot be given overlaps or gaps. Bounds beyond the
 * domain are clipped to it, and a band already past the ceiling collapses to
 * zero width rather than drawing backwards.
 */
export function gaugeSegments(bands: GaugeBand[], domain: [number, number]): GaugeSegment[] {
	const [lo, hi] = domain;
	let cursor = lo;
	return bands.map((b) => {
		const from = Math.max(lo, Math.min(cursor, hi));
		const to = Math.max(from, Math.min(b.to, hi));
		cursor = to;
		return {
			from: gaugeFrac(from, domain),
			to: gaugeFrac(to, domain),
			color: b.color,
			label: b.label
		};
	});
}

/** Clip segments to the reading, dropping any the reading has not reached. */
export function gaugeFilled(segments: GaugeSegment[], v: number): GaugeSegment[] {
	return segments.map((s) => ({ ...s, to: Math.min(s.to, v) })).filter((s) => s.to > s.from);
}

export interface GaugeArcOpts {
	cx: number;
	cy: number;
	/** Degrees of arc the scale spans. */
	sweep: number;
	/** SVG degrees where the scale starts (0 = 3 o'clock, growing clockwise). */
	startAngle: number;
}

/** A point on the arc at fraction `t` and radius `r`. */
export function gaugePoint(t: number, r: number, o: GaugeArcOpts): [number, number] {
	const rad = ((o.startAngle + t * o.sweep) * Math.PI) / 180;
	return [o.cx + r * Math.cos(rad), o.cy + r * Math.sin(rad)];
}

/**
 * SVG arc path between two fractions.
 *
 * The large-arc flag is computed from the swept angle rather than hardcoded:
 * a 240° gauge needs it set for its outer bands and cleared for its inner ones,
 * and getting it wrong draws the complement of the intended arc — the one
 * failure mode of this shape that looks deliberate.
 */
export function gaugeArcPath(t0: number, t1: number, r: number, o: GaugeArcOpts): string {
	const [x0, y0] = gaugePoint(t0, r, o);
	const [x1, y1] = gaugePoint(t1, r, o);
	const large = (t1 - t0) * o.sweep > 180 ? 1 : 0;
	return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
