// ── backdrop/gl/strip-geometry — a Möbius layout as GPU vertices ────────────
//
// `mobiusLayout` emits SVG path strings, and it stays that way: the glass
// facets are still painted by the DOM and the projection maths has exactly one
// home. So this file's job is to ADAPT those strings into triangles once, at
// build time, rather than to grow a second copy of the maths that could drift
// from the first.
//
// The whole premise of the port is that this runs ONCE per layout. Everything
// that moves — the belt's dash flow, the slat wave, the energy pulse — is a
// phase, and a phase is a uniform, so none of it appears here.
//
// ── Why miter normals and not per-segment quads ────────────────────────────
// A stroked polyline drawn as one quad per segment leaves two artefacts: a
// hairline wedge on the outside of every turn, and — worse — a seam down every
// join, because two quads that merely ABUT each contribute partial coverage to
// the shared edge and the pair sums to less than one. Offsetting each shared
// point along its MITER instead makes consecutive quads share vertices exactly,
// so the strip tiles the stroke with no internal boundary at all. At 220
// segments a strip that is the difference between a rim and a dotted rim.

import type { MobiusLayout } from '../mobius.js';

/** Floats per stroke vertex. Kept beside the attribute list because the two
 *  disagreeing is the single most expensive mistake available here — a wrong
 *  stride reads a neighbour's bytes as position and scatters the geometry
 *  without erroring. */
export const STROKE_FLOATS = 10;

export const STROKE_ATTRIBS = [
	/** Layout user units — the same space the SVG viewBox is in. */
	{ name: 'aPos', size: 2 as const },
	/** Unit offset direction for the +1 side, mitred at joins. Scaled to a
	 *  half-width in PIXELS by the shader, because the stroke is
	 *  `non-scaling-stroke` and must not shrink with the strip. */
	{ name: 'aMiter', size: 2 as const },
	{ name: 'aSide', size: 1 as const },
	/** Arc position, 0…100 along this chunk — the `pathLength="100"` the rim's
	 *  dash pattern is authored against. */
	{ name: 'aArcN', size: 1 as const },
	/** Arc position in user units, which is what the energy dashes measure in. */
	{ name: 'aArcU', size: 1 as const },
	/** This chunk's full length in user units, so the shader can convert an
	 *  `aArcN` step into pixels for the round caps. */
	{ name: 'aChunkU', size: 1 as const },
	{ name: 'aDepth', size: 1 as const },
	/** Position in the pass's own cycle: chunk index / chunk count for the
	 *  energy, rung index / rung count for the slat wave. */
	{ name: 'aPhase', size: 1 as const }
];

/** One traveller's road: a chunk of the rim, resampled into a lookup its rider
 *  can be placed on by arc length. Kept in user units so a camera move is a
 *  transform rather than a rebuild. */
export interface Trail {
	/** x,y pairs. */
	pts: Float32Array;
	/** Cumulative length at each point; `cum[n-1]` is the total. */
	cum: Float32Array;
}

export interface StripGeometry {
	data: Float32Array;
	/** Vertex spans within `data`, in vertices. The rim and the rungs share one
	 *  buffer and one attribute layout so switching between them is a uniform
	 *  change rather than a rebind. */
	edgeFirst: number;
	edgeCount: number;
	rungFirst: number;
	rungCount: number;
	trails: Trail[];
}

/** Pull the points back out of an `M x,y L x,y …` string.
 *
 *  Narrow on purpose: `mobiusLayout` emits exactly this form, and a general SVG
 *  path parser here would be a large surface that no caller can reach. If the
 *  layout ever emits curves this returns their control points as vertices and
 *  the failure is visible immediately, which is the right way for this to
 *  break. */
export function parsePolyline(d: string): Float32Array {
	const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
	if (!nums) return new Float32Array(0);
	// An odd trailing number would pair a coordinate with nothing; drop it rather
	// than read past the end.
	const n = nums.length - (nums.length % 2);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) out[i] = Number(nums[i]);
	return out;
}

/** Cumulative arc length along a flat x,y array. */
function arcTable(pts: Float32Array): Float32Array {
	const n = pts.length / 2;
	const cum = new Float32Array(n);
	for (let i = 1; i < n; i++) {
		const dx = pts[i * 2] - pts[i * 2 - 2];
		const dy = pts[i * 2 + 1] - pts[i * 2 - 1];
		cum[i] = cum[i - 1] + Math.hypot(dx, dy);
	}
	return cum;
}

/**
 * Unit offset direction at every point of a polyline.
 *
 * Interior points get the average of the two adjacent segment normals, divided
 * by the cosine of the half-turn so the mitred corner keeps its width. The
 * divisor is clamped: a hairpin sends `1/cos` to infinity and one spike is
 * enough to throw a vertex off screen and stretch a triangle across the frame.
 */
function miters(pts: Float32Array): Float32Array {
	const n = pts.length / 2;
	const out = new Float32Array(n * 2);
	if (n < 2) return out;

	const nx = new Float32Array(n - 1);
	const ny = new Float32Array(n - 1);
	for (let i = 0; i < n - 1; i++) {
		const dx = pts[i * 2 + 2] - pts[i * 2];
		const dy = pts[i * 2 + 3] - pts[i * 2 + 1];
		const len = Math.hypot(dx, dy) || 1;
		// Left-hand perpendicular. Which side is "+1" does not matter — the quad
		// takes both — only that it is consistent along the run.
		nx[i] = -dy / len;
		ny[i] = dx / len;
	}

	for (let i = 0; i < n; i++) {
		const a = i === 0 ? 0 : i - 1;
		const b = i === n - 1 ? n - 2 : i;
		let mx = nx[a] + nx[b];
		let my = ny[a] + ny[b];
		const len = Math.hypot(mx, my) || 1;
		mx /= len;
		my /= len;
		const scale = 1 / Math.max(mx * nx[b] + my * ny[b], 0.25);
		out[i * 2] = mx * scale;
		out[i * 2 + 1] = my * scale;
	}
	return out;
}

/** Vertices a polyline of `n` points costs: two triangles per segment, with the
 *  shared points duplicated rather than indexed. Duplication beats an index
 *  buffer at this size and removes a second allocation to keep in step. */
function vertsFor(n: number): number {
	return Math.max(0, n - 1) * 6;
}

/** Emit one polyline's triangles into `data` at `at` (in floats). Returns the
 *  new write head. */
function emitStroke(
	data: Float32Array,
	at: number,
	pts: Float32Array,
	depth: number,
	phase: number
): number {
	const n = pts.length / 2;
	if (n < 2) return at;
	const cum = arcTable(pts);
	const total = cum[n - 1] || 1;
	const m = miters(pts);

	// Winding is irrelevant — strokes are drawn with culling off — so the two
	// triangles are laid out for readability rather than for a face direction.
	const order = [0, 1, 2, 1, 3, 2] as const;
	for (let s = 0; s < n - 1; s++) {
		for (const corner of order) {
			const p = s + (corner >> 1); // 0,1 → this point · 2,3 → the next
			const side = corner & 1 ? -1 : 1;
			data[at++] = pts[p * 2];
			data[at++] = pts[p * 2 + 1];
			data[at++] = m[p * 2];
			data[at++] = m[p * 2 + 1];
			data[at++] = side;
			data[at++] = (cum[p] / total) * 100;
			data[at++] = cum[p];
			data[at++] = total;
			data[at++] = depth;
			data[at++] = phase;
		}
	}
	return at;
}

/**
 * Everything the GPU needs for one strip, in one buffer.
 *
 * `traffic` only decides how many rim chunks get an arc-length table; the
 * riders themselves are placed per frame, since there are a handful of them and
 * a lookup is cheaper than the geometry a GPU-side path evaluation would need.
 */
export function buildStripGeometry(layout: MobiusLayout, traffic: number): StripGeometry {
	const edgePts = layout.edge.map((e) => parsePolyline(e.d));
	const rungPts = layout.rungs.map((r) => parsePolyline(r.d));

	let verts = 0;
	for (const p of edgePts) verts += vertsFor(p.length / 2);
	const edgeCount = verts;
	for (const p of rungPts) verts += vertsFor(p.length / 2);

	const data = new Float32Array(verts * STROKE_FLOATS);
	let at = 0;
	edgePts.forEach((p, i) => {
		at = emitStroke(data, at, p, layout.edge[i].depth, edgePts.length ? i / edgePts.length : 0);
	});
	rungPts.forEach((p, i) => {
		at = emitStroke(data, at, p, layout.rungs[i].depth, rungPts.length ? i / rungPts.length : 0);
	});

	const trails: Trail[] = [];
	for (let i = 0; i < Math.min(traffic, edgePts.length); i++) {
		const pts = edgePts[i];
		if (pts.length >= 4) trails.push({ pts, cum: arcTable(pts) });
	}

	return {
		data,
		edgeFirst: 0,
		edgeCount,
		rungFirst: edgeCount,
		rungCount: verts - edgeCount,
		trails
	};
}

/** Where a rider sits at `t` ∈ 0…1 of its trail, in layout user units.
 *
 *  Linear in ARC LENGTH, not in point index: the rim's samples are evenly
 *  spaced in `u`, and perspective makes that anything but evenly spaced on
 *  screen. Indexing would make the rider surge on the near side, which is the
 *  opposite of what `offset-distance` does. */
export function trailPoint(trail: Trail, t: number): { x: number; y: number } {
	const n = trail.cum.length;
	const total = trail.cum[n - 1] || 1;
	const want = (((t % 1) + 1) % 1) * total;
	let lo = 0;
	let hi = n - 1;
	while (lo < hi - 1) {
		const mid = (lo + hi) >> 1;
		if (trail.cum[mid] <= want) lo = mid;
		else hi = mid;
	}
	const span = trail.cum[hi] - trail.cum[lo] || 1;
	const f = (want - trail.cum[lo]) / span;
	return {
		x: trail.pts[lo * 2] + (trail.pts[hi * 2] - trail.pts[lo * 2]) * f,
		y: trail.pts[lo * 2 + 1] + (trail.pts[hi * 2 + 1] - trail.pts[lo * 2 + 1]) * f
	};
}
