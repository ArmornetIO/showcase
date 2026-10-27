// ── model-studio/model-geometry — boxes, holes and tubes, in millimetres ─────
// Physical objects drawn with the mesh globe's piece renderer: every part is a
// list of convex `Solid`s, so `pieceFacets` culls and shades them unchanged.
//
// Axes are the piece frame's: `e` across, `n` up the object, `h` out of the
// surface it is mounted on. Units are millimetres throughout.
//
// Pure: no Svelte, no DOM.

import { box, octagon, prism, type PieceVert, type Solid } from '../mesh-studio/pieces/pieces.js';
import { pieceFacets, type Facet } from '../mesh-studio/pieces/piece-facets.js';
import type { TangentFrame } from '../physics/sphere.js';
import type { Knob } from '../backdrop/backdrop-tokens.js';

export type Box3 = [e0: number, e1: number, n0: number, n1: number, h0: number, h1: number];

/**
 * The renderer sorts whole faces by their centre, so one big face paints over
 * whatever stands on it. Cells of ~6 mm keep faces comparable in size, which
 * is all a painter's sort needs.
 */
const CELL = 6;

function cuts(a: number, b: number): number[] {
	const k = Math.max(1, Math.round((b - a) / CELL));
	return Array.from({ length: k + 1 }, (_, i) => a + ((b - a) * i) / k);
}

/** A solid box, diced into cells. */
export function slab(...[e0, e1, n0, n1, h0, h1]: Box3): Solid[] {
	const [Es, Ns, Hs] = [cuts(e0, e1), cuts(n0, n1), cuts(h0, h1)];
	const out: Solid[] = [];
	for (let i = 1; i < Es.length; i++)
		for (let j = 1; j < Ns.length; j++)
			for (let k = 1; k < Hs.length; k++) out.push(box(Es[i - 1], Es[i], Ns[j - 1], Ns[j], Hs[k - 1], Hs[k]));
	return out;
}

/** A box with box-shaped holes through it: split on every hole edge, drop the
 *  cells that fall inside a hole. A hole may overrun the box; it is clipped. */
export function cut(b: Box3, holes: Box3[] = []): Solid[] {
	const axis = (i: number) =>
		[...new Set([b[i], b[i + 1], ...holes.flatMap((h) => [h[i], h[i + 1]]).filter((v) => v > b[i] && v < b[i + 1])])].sort(
			(x, y) => x - y
		);
	const [Es, Ns, Hs] = [axis(0), axis(2), axis(4)];
	const inside = (h: Box3, m: number[]) =>
		m[0] > h[0] && m[0] < h[1] && m[1] > h[2] && m[1] < h[3] && m[2] > h[4] && m[2] < h[5];
	const out: Solid[] = [];
	for (let i = 1; i < Es.length; i++)
		for (let j = 1; j < Ns.length; j++)
			for (let k = 1; k < Hs.length; k++) {
				const m = [(Es[i - 1] + Es[i]) / 2, (Ns[j - 1] + Ns[j]) / 2, (Hs[k - 1] + Hs[k]) / 2];
				if (!holes.some((h) => inside(h, m))) out.push(...slab(Es[i - 1], Es[i], Ns[j - 1], Ns[j], Hs[k - 1], Hs[k]));
			}
	return out;
}

const AXES = ['e', 'n', 'h'] as const;
const EPS = 1e-6;

/** The plane `e·x.e + n·x.n + h·x.h = d`, its normal a unit vector. As one
 *  face of a hole, the hole is on the side where the sum is under `d`. */
export type Plane = { e: number; n: number; h: number; d: number };

const dot = (p: Plane, v: PieceVert) => p.e * v.e + p.n * v.n + p.h * v.h;
const axisPlane = (axis: 0 | 1 | 2, at: number): Plane => ({ e: +(axis === 0), n: +(axis === 1), h: +(axis === 2), d: at });

/** `s` cut by plane `p`, keeping the side `keep` points to. Each face is
 *  clipped in turn and the cut is closed with a cap wound to face out, so the
 *  piece stays a convex solid. Null when nothing is left. */
function clip(s: Solid, p: Plane, keep: 1 | -1): Solid | null {
	const side = (v: PieceVert) => (dot(p, v) - p.d) * keep;
	if (s.verts.every((v) => side(v) > -EPS)) return s;
	if (s.verts.every((v) => side(v) < EPS)) return null;
	const polys: PieceVert[][] = [];
	const cap: PieceVert[] = [];
	for (const f of s.faces) {
		const poly = f.map((i) => s.verts[i]);
		const out: PieceVert[] = [];
		poly.forEach((a, i) => {
			const b = poly[(i + 1) % poly.length];
			const [sa, sb] = [side(a), side(b)];
			if (sa > -EPS) out.push(a);
			if (Math.abs(sa) <= EPS) cap.push(a);
			if ((sa > EPS && sb < -EPS) || (sa < -EPS && sb > EPS)) {
				const t = sa / (sa - sb);
				const p = { e: a.e + (b.e - a.e) * t, n: a.n + (b.n - a.n) * t, h: a.h + (b.h - a.h) * t };
				out.push(p);
				cap.push(p);
			}
		});
		// A crossing that lands on a vertex leaves a repeat; a repeat in the first
		// three would zero the normal the renderer takes from them.
		const clean = out.filter((p, i) => {
			const q = out[(i + 1) % out.length];
			return Math.abs(p.e - q.e) + Math.abs(p.n - q.n) + Math.abs(p.h - q.h) > EPS;
		});
		if (clean.length >= 3) polys.push(clean);
	}
	const ring = [...new Map(cap.map((p) => [`${p.e.toFixed(5)},${p.n.toFixed(5)},${p.h.toFixed(5)}`, p])).values()];
	if (ring.length >= 3) {
		// Sorted by angle in the plane's (u, v), with u × v the normal, the cap
		// faces along the normal; the cut face faces the side thrown away.
		const a = Math.abs(p.e) < 0.9 ? { e: 1, n: 0, h: 0 } : { e: 0, n: 1, h: 0 };
		const ad = a.e * p.e + a.n * p.n + a.h * p.h;
		const ul = { e: a.e - ad * p.e, n: a.n - ad * p.n, h: a.h - ad * p.h };
		const len = Math.hypot(ul.e, ul.n, ul.h);
		const u = { e: ul.e / len, n: ul.n / len, h: ul.h / len };
		const v = { e: p.n * u.h - p.h * u.n, n: p.h * u.e - p.e * u.h, h: p.e * u.n - p.n * u.e };
		const [U, V] = [(x: PieceVert) => x.e * u.e + x.n * u.n + x.h * u.h, (x: PieceVert) => x.e * v.e + x.n * v.n + x.h * v.h];
		const cu = ring.reduce((m, x) => m + U(x), 0) / ring.length;
		const cv = ring.reduce((m, x) => m + V(x), 0) / ring.length;
		ring.sort((x, y) => Math.atan2(V(x) - cv, U(x) - cu) - Math.atan2(V(y) - cv, U(y) - cu));
		polys.push(keep === 1 ? ring.reverse() : ring);
	}
	const verts: PieceVert[] = [];
	const faces = polys.map((p) => p.map((x) => verts.push(x) - 1));
	return { verts, faces };
}

/** A convex solid cut at each height in `cuts` (ascending): the slabs between,
 *  bottom first. */
export function layers(s: Solid, cuts: number[]): Solid[] {
	const out: Solid[] = [];
	let rest: Solid | null = s;
	for (const c of cuts) {
		if (!rest) break;
		const below = clip(rest, axisPlane(2, c), -1);
		if (below) out.push(below);
		rest = clip(rest, axisPlane(2, c), 1);
	}
	if (rest) out.push(rest);
	return out;
}

/** A convex solid with a box-shaped hole taken out of it: what is left, as up
 *  to six convex pieces. Untouched when the hole misses it. Any convex solid —
 *  a figure's limbs, not only the boxes `cut` dices. */
export function carve(s: Solid, hole: Box3): Solid[] {
	return carveHull(s, boxHole(hole));
}

/** A box-shaped hole as the planes `carveHull` takes. */
export function boxHole(b: Box3): Plane[] {
	return ([0, 1, 2] as const).flatMap((a) => {
		const p = axisPlane(a, b[2 * a + 1]);
		return [{ e: -p.e, n: -p.n, h: -p.h, d: -b[2 * a] }, p];
	});
}

/** A convex solid with a convex hole taken out of it — the hole being where
 *  every plane in `hole` has the point on its low side. One piece per plane
 *  at most; untouched when the hole misses it. */
export function carveHull(s: Solid, hole: Plane[]): Solid[] {
	if (hole.some((p) => s.verts.every((v) => dot(p, v) >= p.d - EPS))) return [s];
	const out: Solid[] = [];
	let rest: Solid | null = s;
	for (const p of hole) {
		if (!rest) break;
		const outside = clip(rest, p, 1);
		if (outside) out.push(outside);
		rest = clip(rest, p, -1);
	}
	return out;
}

/** The planes of a convex solid, each pushed out `by`: the hole that solid
 *  drops into with that clearance on every face. */
export function grow(s: Solid, by: number): Plane[] {
	return s.faces.map((f) => {
		// Newell's normal, over every edge: a clipped face often starts on three
		// corners in a line, and a normal off those points anywhere.
		const vs = f.map((i) => s.verts[i]);
		const a = vs[0];
		const p = vs.reduce(
			(m, x, i) => {
				const y = vs[(i + 1) % vs.length];
				return { e: m.e + (x.n - y.n) * (x.h + y.h), n: m.n + (x.h - y.h) * (x.e + y.e), h: m.h + (x.e - y.e) * (x.n + y.n) };
			},
			{ e: 0, n: 0, h: 0 }
		);
		const len = Math.hypot(p.e, p.n, p.h);
		const q = { e: p.e / len, n: p.n / len, h: p.h / len, d: 0 };
		return { ...q, d: dot(q, a) + by };
	});
}

/**
 * A round run along one axis, `r` to its flats, from `a` to `b` along it; `at`
 * is where it crosses the other two axes, in e-n-h order. Upright it is a
 * 16-gon. Lying down it is a teardrop, its roof a 45° ridge: a round roof
 * sags with nothing under it, a ridge prints. As a hole, `grow(rod(…), 0)`.
 */
export function rod(axis: 'e' | 'n' | 'h', at: [number, number], a: number, b: number, r: number): Solid {
	const R = r / Math.cos(Math.PI / 16);
	const ring = (from: number, k: number) =>
		Array.from({ length: k }, (_, i): [number, number] => {
			const t = from + (i * Math.PI) / 8;
			return [R * Math.cos(t), R * Math.sin(t)];
		});
	if (axis === 'h') return prism(ring(0, 16).map(([x, y]) => [x + at[0], y + at[1]]), a, b);
	// Round the bottom from 135° to 45°, then up to the ridge.
	const drop: [number, number][] = [...ring((3 * Math.PI) / 4, 13), [0, R * Math.SQRT2]];
	// Stood up by a turn, never a mirror, so the faces stay outward-wound.
	const s = prism(drop, axis === 'n' ? -b : a, axis === 'n' ? -a : b);
	return {
		faces: s.faces,
		verts: s.verts.map((v) =>
			axis === 'n' ? { e: v.e + at[0], n: -v.h, h: v.n + at[1] } : { e: v.h, n: v.e + at[0], h: v.n + at[1] }
		)
	};
}

export type Pt2 = [number, number];

/** The part of a convex `poly` where a·x + b·y ≤ c, itself convex. */
export function within(poly: Pt2[], a: number, b: number, c: number): Pt2[] {
	return poly.flatMap((p, i) => {
		const q = poly[(i + 1) % poly.length];
		const [sp, sq] = [a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c];
		const out: Pt2[] = sp <= 0 ? [p] : [];
		if (sp * sq < 0) out.push([p[0] + ((q[0] - p[0]) * sp) / (sp - sq), p[1] + ((q[1] - p[1]) * sp) / (sp - sq)]);
		return out;
	});
}

/** A hexagonal hole through `n0`–`n1`, flats top and bottom: `flat` across
 *  them, centred on (e, h). The honeycomb a light shows through. */
export function hexHole(e: number, h: number, flat: number, n0: number, n1: number): Plane[] {
	const sides = Array.from({ length: 6 }, (_, k) => {
		const t = Math.PI / 6 + (k * Math.PI) / 3;
		const [ce, ch] = [Math.cos(t), Math.sin(t)];
		return { e: ce, n: 0, h: ch, d: ce * e + ch * h + flat / 2 };
	});
	return [...sides, { e: 0, n: -1, h: 0, d: -n0 }, { e: 0, n: 1, h: 0, d: n1 }];
}

/** An octagonal tube standing along `h`: eight convex wedges, outer edge to
 *  inner edge, so the bore stays open and every solid stays convex. */
export function tube(e: number, n: number, ro: number, ri: number, h0: number, h1: number): Solid[] {
	const o = octagon(ro, ro);
	const i = octagon(ri, ri);
	return o.map((_, k) => {
		const j = (k + 1) % o.length;
		const quad = [o[k], o[j], i[j], i[k]].map(([a, b]) => [a + e, b + n] as [number, number]);
		return prism(quad, h0, h1);
	});
}

// ── Parts ─────────────────────────────────────────────────────────────────────

/** What a part is made of, which is all that decides its colour. */
export type PartKind = 'shell' | 'cover' | 'board' | 'chip' | 'metal' | 'part' | 'wire';

export const PART_FILL: Record<PartKind, string> = {
	shell: 'var(--palette-slate)',
	cover: 'var(--palette-slate-l)',
	board: 'var(--palette-emerald)',
	chip: 'var(--palette-zinc-l)',
	metal: 'var(--fg-muted)',
	part: 'var(--palette-blue)',
	wire: 'var(--palette-red)'
};

export interface Part {
	id: string;
	label: string;
	kind: PartKind;
	/** Dimensions as a person would say them — the panel's read-out. */
	size: string;
	solids: Solid[];
	/** A colour per solid, for parts made of several materials — a printed
	 *  figure is four spools. Absent, the whole part wears its kind's fill. */
	colors?: string[];
	/**
	 * Which side of the model's cavity this shell piece lies on, and how many
	 * shells out it is. Unset = inside the cavity. See `modelFacets`.
	 */
	side?: { axis: 'e' | 'n' | 'h'; sign: 1 | -1; layer: number };
	/** Ghosted along with the shell under x-ray. A shell piece is printed. */
	shell?: boolean;
	/** Printed though not shell — a figure on a bed. Bought parts (boards,
	 *  relays) and the plate are neither, and stay out of the export. */
	printed?: boolean;
}

export interface ModelFacet extends Facet {
	part: Part;
	rank: number;
	color: string;
}

/**
 * Cull, shade and sort a whole model.
 *
 * A face-centre sort alone paints a board edge over the wall in front of it.
 * Every shell piece lies wholly on one side of a cavity plane, so if the
 * camera is on that side the piece is in front of everything inside, and
 * behind it otherwise — exact, where comparing face centres is a guess. Outer
 * layers go outermost in both directions.
 */
export function modelFacets(parts: Part[], frame: TangentFrame, xray = false): ModelFacet[] {
	const rank = (p: Part) => {
		if (!p.side) return 0;
		const toward = p.side.sign * frame.axis[p.side.axis === 'h' ? 'u' : p.side.axis].z > 0;
		return toward ? p.side.layer : -p.side.layer;
	};
	return parts
		.flatMap((p) => {
			const opts = { showBack: xray && !!(p.shell || p.printed) };
			const r = rank(p);
			if (!p.colors)
				return pieceFacets(p.solids, frame, opts).map((f) => ({ ...f, part: p, rank: r, color: PART_FILL[p.kind] }));
			const colors = p.colors;
			return p.solids.flatMap((s, i) =>
				pieceFacets([s], frame, opts).map((f) => ({ ...f, part: p, rank: r, color: colors[i] }))
			);
		})
		.sort((a, b) => a.rank - b.rank || a.depth - b.depth);
}

/** `p` slid by `d` millimetres. */
export function movePart(p: Part, d: PieceVert): Part {
	return {
		...p,
		solids: p.solids.map((s) => ({ ...s, verts: s.verts.map((v) => ({ e: v.e + d.e, n: v.n + d.n, h: v.h + d.h })) }))
	};
}

/** Index of the part nearest the viewer under `pt` (frame-projected units,
 *  pivot offset already removed), or −1. Depth is the face's plane AT the
 *  pointer: a face's mean puts a nested stage's long wall in front of the
 *  outer stage that hides it. */
export function pickPart(parts: Part[], frame: TangentFrame, pt: { x: number; y: number }): number {
	const { e, n, u, axis } = frame;
	let best = -1;
	let bestZ = -Infinity;
	parts.forEach((p, pi) => {
		for (const s of p.solids) {
			const xy = s.verts.map((v) => [v.e * e.x + v.n * n.x + v.h * u.x, v.e * e.y + v.n * n.y + v.h * u.y]);
			const z = s.verts.map((v) => v.e * axis.e.z + v.n * axis.n.z + v.h * axis.u.z);
			for (const f of s.faces) {
				let inside = false;
				for (let i = 0, j = f.length - 1; i < f.length; j = i++) {
					const [xi, yi] = xy[f[i]];
					const [xj, yj] = xy[f[j]];
					if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
				}
				if (!inside) continue;
				// Solve pt = a + α(b−a) + β(c−a) on screen; z follows the same weights.
				const [a, b, c] = [f[0], f[1], f[2]];
				const [ux, uy, vx, vy] = [xy[b][0] - xy[a][0], xy[b][1] - xy[a][1], xy[c][0] - xy[a][0], xy[c][1] - xy[a][1]];
				const det = ux * vy - uy * vx;
				// Edge-on: no area to point at.
				if (Math.abs(det) < EPS) continue;
				const [px, py] = [pt.x - xy[a][0], pt.y - xy[a][1]];
				const al = (px * vy - py * vx) / det;
				const be = (ux * py - uy * px) / det;
				const fz = z[a] + al * (z[b] - z[a]) + be * (z[c] - z[a]);
				if (fz > bestZ) [best, bestZ] = [pi, fz];
			}
		}
	});
	return best;
}

/** A drag of (dx, dy) frame-projected units as millimetres in the screen
 *  plane, so the part follows the pointer from any camera. */
export function screenToModel(frame: TangentFrame, step: number, dx: number, dy: number): PieceVert {
	const { e, n, u } = frame.axis;
	return { e: (e.x * dx + e.y * dy) / step, n: (n.x * dx + n.y * dy) / step, h: (u.x * dx + u.y * dy) / step };
}

// ── Models ────────────────────────────────────────────────────────────────────

export interface ModelStat {
	label: string;
	value: string;
	sub: string;
}

export interface ModelView {
	/** Pull the layers apart along `h`. */
	exploded: boolean;
	/** X-ray is on: a model may add what is hidden inside, drawn solid. */
	xray?: boolean;
	/** Laid out as printed, holes cut: the export, and the stage's Print
	 *  layout switch. Holes `carve` cuts into a figure split it into pieces
	 *  the painter's sort cannot always order, so every other view draws the
	 *  figure whole. */
	print?: boolean;
}

export interface Model {
	id: string;
	name: string;
	/** One line under the stage: what this is for. */
	blurb: string;
	/** What it is for — a latch, a drawer. The palette lists it under each;
	 *  untagged, under Models. */
	tags?: string[];
	/** Pixels per millimetre the stage opens at. */
	zoom: number;
	/** Height the camera orbits about, mm. */
	pivot: number;
	/** Half-width of the floor grid, mm. 0 = none — a model with its own floor
	 *  (a build plate) has no use for a second one. Default 60. */
	grid?: number;
	/** What this model exposes for tuning, drawn under the view switches. */
	knobs?: Knob[];
	build: (view: ModelView, knobs: Knob[]) => Part[];
	/** The figures behind the gear: dimensions, counts. A function when they
	 *  move with the knobs. */
	stats: ModelStat[] | ((knobs: Knob[]) => ModelStat[]);
}
