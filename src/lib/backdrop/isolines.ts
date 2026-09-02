// ── isolines — marching squares over a noise field ──────────────────────────
//
// Named `isolines`, NOT `contours`: `physics/terrain.ts` already exports a
// `contours()` (plus `Contour`/`ContourLine`/`ContourSegment`) for the globe's
// terrain caps, and it is in the library barrel. Two exported `contours` in one
// package is a collision waiting to be imported wrong — that module owns the
// word.
//
// Turns a scalar field into iso-level polylines. Used once, at mount, to build
// a static SVG for the terrain backdrop; nothing here runs per frame.

import { fbm } from './noise.js';

export interface Isoline {
	/** SVG path `d`, already smoothed. */
	d: string;
	/** Which iso-level this came from, 0 = lowest. */
	level: number;
	/** 0…1 up the level stack — drives weight, opacity and hue. */
	depth: number;
}

interface Options {
	cols?: number;
	rows?: number;
	levels?: number;
	seed?: number;
	/** Field frequency. Higher is busier terrain. */
	frequency?: number;
	/** Drop polylines shorter than this many points — they are visual lint. */
	minPoints?: number;
}

/** Linear crossing point between two lattice samples. */
function cross(a: number, b: number, iso: number): number {
	const d = b - a;
	return Math.abs(d) < 1e-6 ? 0.5 : (iso - a) / d;
}

/**
 * Catmull-Rom through the points, emitted as cubic Béziers.
 *
 * Marching squares produces hard little zig-zags at lattice resolution; drawn
 * raw they read as a low-poly mesh rather than as contours. This is the pass
 * that makes them look surveyed.
 */
function smooth(pts: { x: number; y: number }[]): string {
	if (pts.length < 2) return '';
	if (pts.length === 2) {
		return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
	}

	let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
	for (let i = 0; i < pts.length - 1; i++) {
		const p0 = pts[i - 1] ?? pts[i];
		const p1 = pts[i];
		const p2 = pts[i + 1];
		const p3 = pts[i + 2] ?? p2;
		const c1x = p1.x + (p2.x - p0.x) / 6;
		const c1y = p1.y + (p2.y - p0.y) / 6;
		const c2x = p2.x - (p3.x - p1.x) / 6;
		const c2y = p2.y - (p3.y - p1.y) / 6;
		d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
	}
	return d;
}

/**
 * Trace contours across a noise field.
 *
 * Cells are emitted as independent short segments and then chained greedily by
 * matching endpoints. That is simpler than a full topology walk and produces
 * the same picture at this scale; the tradeoff is that a contour may arrive in
 * two or three pieces rather than one, which is invisible once stroked.
 */
export function traceIsolines({
	cols = 90,
	rows = 56,
	levels = 8,
	seed = 7,
	frequency = 2.4,
	minPoints = 6
}: Options = {}): Isoline[] {
	// Sample the field on the lattice. One pass, reused by every level.
	const field = new Float32Array((cols + 1) * (rows + 1));
	for (let y = 0; y <= rows; y++) {
		for (let x = 0; x <= cols; x++) {
			field[y * (cols + 1) + x] = fbm((x / cols) * frequency, (y / rows) * frequency, 0, 3, seed);
		}
	}

	const at = (x: number, y: number) => field[y * (cols + 1) + x];
	const out: Isoline[] = [];
	const w = 1000 / cols;
	const h = 1000 / rows;

	for (let l = 0; l < levels; l++) {
		// Levels sit inside the field's range rather than spanning 0…1: the
		// extremes of fbm are rare, so contours there are tiny scraps.
		const iso = 0.3 + (l / (levels - 1)) * 0.4;
		const segs: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];

		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const tl = at(x, y);
				const tr = at(x + 1, y);
				const br = at(x + 1, y + 1);
				const bl = at(x, y + 1);
				const idx =
					(tl > iso ? 8 : 0) + (tr > iso ? 4 : 0) + (br > iso ? 2 : 0) + (bl > iso ? 1 : 0);
				if (idx === 0 || idx === 15) continue;

				const T = { x: (x + cross(tl, tr, iso)) * w, y: y * h };
				const R = { x: (x + 1) * w, y: (y + cross(tr, br, iso)) * h };
				const B = { x: (x + cross(bl, br, iso)) * w, y: (y + 1) * h };
				const L = { x: x * w, y: (y + cross(tl, bl, iso)) * h };

				const push = (a: { x: number; y: number }, b: { x: number; y: number }) =>
					segs.push({ a, b });

				// The saddles (5, 10) are split arbitrarily — either resolution is
				// valid and the difference is one cell wide.
				switch (idx) {
					case 1: case 14: push(L, B); break;
					case 2: case 13: push(B, R); break;
					case 3: case 12: push(L, R); break;
					case 4: case 11: push(T, R); break;
					case 6: case 9:  push(T, B); break;
					case 7: case 8:  push(L, T); break;
					case 5:          push(L, T); push(B, R); break;
					case 10:         push(L, B); push(T, R); break;
				}
			}
		}

		// Chain segments end-to-end into polylines.
		const used = new Array(segs.length).fill(false);
		const key = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
		const byStart = new Map<string, number[]>();
		segs.forEach((s, i) => {
			const k = key(s.a);
			if (!byStart.has(k)) byStart.set(k, []);
			byStart.get(k)!.push(i);
		});

		for (let i = 0; i < segs.length; i++) {
			if (used[i]) continue;
			used[i] = true;
			const pts = [segs[i].a, segs[i].b];
			// Walk forward while a segment starts where the last one ended.
			for (;;) {
				const next = (byStart.get(key(pts[pts.length - 1])) ?? []).find((j) => !used[j]);
				if (next === undefined) break;
				used[next] = true;
				pts.push(segs[next].b);
			}
			if (pts.length < minPoints) continue;
			out.push({ d: smooth(pts), level: l, depth: l / (levels - 1) });
		}
	}

	return out;
}
