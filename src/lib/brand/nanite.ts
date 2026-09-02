// ── logo-nanotech · the plates the mark assembles itself out of ──────────────
// The scene is two SHIPPED marks and a bridge between them: `ArmornetLogo` (the
// flat line crest) becomes `ArmornetCrestChrome` (the forged cut). Neither is
// redrawn here — a third hand-cut shield is a third silhouette that drifts. What
// this file supplies is the only thing the two components cannot: the transition
// surface, tiled into plates that can fly.
//
// Everything is authored in the CHROME box (200×220), because that is where the
// destination lives. The source contours come back out of `chromeContours`, and
// the outer wall is recovered by mitring the inner one OUTWARD rather than by
// re-deriving `meshToBox` — a second copy of that map is a second shield.
//
// Pure: no Svelte, no DOM, no clock. The page supplies `t` and gets back a
// transform and a colour per plate.

import { chromeContours, chromeFigure } from '../icons/ArmornetCrestChrome.svelte';
import { insetPoints, rayHit, type CrestMeshShape, type Pt } from '../icons/ArmornetCrestMesh.svelte';
import { LOGO_SHAPE } from '../icons/ArmornetLogo.svelte';

/** `BAND_IN` in the chrome component — how far its frame's inner edge sits in. */
const FRAME_W = 9;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const smooth = (a: number, b: number, x: number) => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
/** Overshoot on the way in. A plate that decelerates onto its seat reads as
 *  placed; one that overshoots and settles reads as SNAPPED to, which is the
 *  whole difference between assembly and a fade. */
export const outBack = (x: number) => {
	const c1 = 1.44;
	return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Deterministic per-plate noise. Seeded, not `Math.random`, so the cascade is
 *  the same every replay — a scatter you cannot re-watch is a scatter you cannot
 *  tune. */
function hash(i: number, salt = 0): number {
	const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
	return x - Math.floor(x);
}

export interface Plate {
	/** Where the plate ENDS UP, as a static path. Flight is a transform on top of
	 *  this, never a remesh: 200 paths whose `d` changes every frame is 200 path
	 *  re-parses, and the shape is not what is moving. */
	d: string;
	cx: number;
	cy: number;
	/** 0 at the core, 1 at the shield wall. Drives the cascade order AND the
	 *  bevel — a dome is just "tilt outward as radius grows". */
	rf: number;
	/** Screen-space facet normal, y DOWN to match SVG. */
	nx: number;
	ny: number;
	nz: number;
	/** Per-chip brightness bias. Neighbouring plates shading a few percent apart
	 *  merge into bands and the field goes back to reading as one surface; this is
	 *  what keeps it grainy. */
	tone: number;
	/** ms into the assemble beat before this plate starts moving. */
	delay: number;
	/** Where it comes in from, and how it is tumbling when it does. */
	ox: number;
	oy: number;
	spin: number;
	seed: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const poly2path = (p: readonly Pt[]) => `M${p.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(' L')} Z`;

/** Concentric rings of plates, coarse at the core and fine at the wall.
 *
 *  Constant angular divisions all the way in would put a sliver at the centre
 *  for every plate at the rim. Stepping the count per ring costs a hairline
 *  T-junction between rings, which the seam stroke covers, and buys plates that
 *  are all roughly square — which is what makes them read as PLATES rather than
 *  as a sunburst. */
const RINGS: { f0: number; f1: number; n: number }[] = [
	{ f0: 0.0, f1: 0.15, n: 14 },
	{ f0: 0.15, f1: 0.3, n: 22 },
	{ f0: 0.3, f1: 0.44, n: 30 },
	{ f0: 0.44, f1: 0.58, n: 38 },
	{ f0: 0.58, f1: 0.71, n: 46 },
	{ f0: 0.71, f1: 0.84, n: 52 },
	{ f0: 0.84, f1: 1.0, n: 56 }
];

export interface Assembly {
	plates: Plate[];
	/** The chrome component's own contours, for clips and rim strokes. */
	outer: string;
	inner: string;
	/** The emissive core the plating closes around. */
	fig: ReturnType<typeof chromeFigure>;
	/** Box centre the cascade radiates from — the figure's hub, not the bbox: the
	 *  mark ignites at the thing that means something, then spreads. */
	ox: number;
	oy: number;
}

export function buildAssembly(shape: CrestMeshShape = LOGO_SHAPE): Assembly {
	const C = chromeContours(shape);
	const inner = C.innerPoly;
	// Mitred back OUT rather than re-derived. `insetPoints` is signed, and the
	// outer wall is by construction the inner one offset by the frame width.
	const outer = insetPoints(inner, -FRAME_W);
	const fig = chromeFigure(shape);

	const [ox, oy] = fig.hub;
	const plates: Plate[] = [];
	let i = 0;

	// ── the field ────────────────────────────────────────────────────────────
	// One polar tiling of everything inside the frame. `rayHit` against the inner
	// contour is what makes the plating CONFORM: the crown slot and the point are
	// found by the same cast, so no ring has to know the silhouette it is in.
	//
	// The tiling itself stays a clean grid — CELL IDENTITY (which ring, which
	// division) has to be a grid or the silhouette-fitting above breaks. What
	// must not stay clean is the SHAPE that comes out of each cell: a scaled copy
	// of a trapezoid is still a trapezoid, so "shard" work happens per corner
	// (jitter in ray-space, which `corner()` re-casts and so can never leave the
	// silhouette) and per cell (drop it, split it on a diagonal, or chamfer a
	// corner off it) rather than as a uniform post-shrink.
	let ringIdx = 0;
	for (const ring of RINGS) {
		const isQuad = ring.f0 !== 0;
		for (let j = 0; j < ring.n; j++) {
			const a0 = ((j / ring.n) * Math.PI * 2) - Math.PI / 2;
			const a1 = (((j + 1) / ring.n) * Math.PI * 2) - Math.PI / 2;
			// Identifies the CELL, not the plate(s) it ends up producing — a cell can
			// yield zero, one or two plates, and the jitter/fate rolls below have to
			// stay stable regardless of which, or a neighbouring drop would reshuffle
			// this cell's shape.
			const cellId = ringIdx * 1000 + j;
			const corner = (a: number, f: number): Pt => {
				const dx = Math.cos(a);
				const dy = Math.sin(a);
				const [hx, hy] = rayHit([ox, oy], [dx, dy], inner);
				const R = Math.hypot(hx - ox, hy - oy);
				return [ox + dx * R * f, oy + dy * R * f];
			};
			let s = 0;
			const jcorner = (a: number, f: number): Pt => {
				const ja = (hash(cellId, 40 + s) - 0.5) * (a1 - a0) * 0.5;
				const jf = (hash(cellId, 41 + s) - 0.5) * (ring.f1 - ring.f0) * 0.4;
				s += 2;
				return corner(a + ja, clamp01(f + jf));
			};
			const pts: Pt[] = isQuad
				? [jcorner(a0, ring.f0), jcorner(a1, ring.f0), jcorner(a1, ring.f1), jcorner(a0, ring.f1)]
				: [[ox, oy], jcorner(a0, ring.f1), jcorner(a1, ring.f1)];

			// Fate is one roll shared by drop/split/chamfer so the three are mutually
			// exclusive slices of the same [0,1) rather than three coin flips that can
			// all land — a cell that got both split AND chamfered is not a shard, it's
			// a bug. Only quads split or chamfer; a triangle chamfered is a smaller
			// triangle, which the vertex-jitter above already produces for free.
			const fate = hash(cellId, 50);
			let shards: Pt[][];
			if (fate < 0.08) {
				shards = [];
			} else if (isQuad && fate < 0.48) {
				const [p0, p1, p2, p3] = pts;
				shards =
					hash(cellId, 51) < 0.5 ? [[p0, p1, p2], [p0, p2, p3]] : [[p1, p2, p3], [p1, p3, p0]];
			} else if (isQuad && fate < 0.63) {
				const drop = Math.floor(hash(cellId, 52) * 4);
				shards = [pts.filter((_, idx) => idx !== drop)];
			} else {
				shards = [pts];
			}

			for (const shard of shards) {
				plates.push(
					makePlate(i, fieldShrink(shard, i), (ring.f0 + ring.f1) / 2, (a0 + a1) / 2, ox, oy, 0, 1)
				);
				i++;
			}
		}
		ringIdx++;
	}

	// ── the frame ────────────────────────────────────────────────────────────
	// One plate per outline vertex, spanning the wall. These land LAST, so the
	// silhouette closes over the field instead of framing an empty shield while
	// it fills — the shield has to look like it is being built, not filled in.
	for (let k = 0; k < inner.length; k++) {
		const k1 = (k + 1) % inner.length;
		const pts: Pt[] = [outer[k], outer[k1], inner[k1], inner[k]];
		const mx = (outer[k][0] + inner[k1][0]) / 2;
		const my = (outer[k][1] + inner[k1][1]) / 2;
		// Barely chipped and barely turned. The frame carries the SILHOUETTE, and a
		// silhouette assembled out of visibly scattered chips is not a silhouette.
		plates.push(makePlate(i++, pts, 1.12, Math.atan2(my - oy, mx - ox), ox, oy, 1250, 0.25));
	}

	return { plates, outer: poly2path(outer), inner: poly2path(inner), fig, ox, oy };
}

/** Extra size scatter on top of `makePlate`'s own shrink, interior field only.
 *  A field of actual debris has a long tail of much-smaller pieces, not just
 *  even gaps between same-sized ones — so roll a separate, rarer "this one is
 *  tiny" case rather than just widening one uniform range, which would just
 *  make the average plate smaller and not change what the field reads as. */
function fieldShrink(pts: Pt[], seed: number): Pt[] {
	const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
	const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
	const debris = hash(seed, 60) < 0.16;
	const k = debris ? 0.32 + hash(seed, 61) * 0.22 : 0.68 + hash(seed, 61) * 0.3;
	return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k] as Pt);
}

function makePlate(
	i: number,
	pts: Pt[],
	rf: number,
	theta: number,
	ox: number,
	oy: number,
	floor = 0,
	chip = 1
): Plate {
	const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
	const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;

	// ── what makes it a particle and not a mirror ────────────────────────────
	// A polar tiling laid down edge to edge is a continuous polished surface, and
	// a continuous polished surface with facet normals on it is a disco ball. The
	// fix is not shading, it is GAPS: pull every plate off its neighbours and turn
	// it a few degrees, and the same tiling reads as a field of separate chips
	// that happen to be arranged on the mark. What is behind them then shows
	// through, which is the other half of it — a swarm you cannot see between is
	// a skin.
	//
	// Baked into the path rather than applied as a transform: a plate at rest must
	// cost nothing per frame, and this never changes once it has landed.
	const shrink = 1 - chip * (0.3 + hash(i, 7) * 0.16);
	const rest = chip * (hash(i, 8) - 0.5) * 0.16;
	const cr = Math.cos(rest);
	const sr = Math.sin(rest);
	pts = pts.map(([x, y]) => {
		const dx = (x - cx) * shrink;
		const dy = (y - cy) * shrink;
		return [cx + dx * cr - dy * sr, cy + dx * sr + dy * cr] as const;
	});

	// A dome, jittered. The jitter is the point: a clean dome shades like a
	// polished bowl, and what we want is a surface made of separately-machined
	// panels that agree about the overall form and disagree about the detail.
	//
	// SHALLOW, and that was not the first guess. At a full radian of tilt the
	// outer panels turn far enough to reflect the ground, the whole lower half of
	// the shield goes black, and the mark reads as a funnel seen down the throat
	// rather than as a face with a bevel on it. A shield is nearly flat.
	const phi = 0.1 + 0.6 * Math.pow(Math.min(rf, 1), 1.4) + (hash(i, 1) - 0.5) * 0.2;
	const th = theta + (hash(i, 2) - 0.5) * 0.26;
	const s = Math.sin(phi);

	// Flown in from straight out along its own radius, from well outside the
	// frame. Radial rather than random: 200 plates converging on one point is a
	// swarm arriving, and 200 plates on 200 unrelated vectors is confetti.
	const off = 190 + hash(i, 3) * 150;

	return {
		d: poly2path(pts),
		cx,
		cy,
		rf,
		nx: s * Math.cos(th),
		ny: s * Math.sin(th),
		nz: Math.cos(phi),
		tone: 0.72 + hash(i, 9) * 0.56,
		// Core first, wall last, with a slow rotational ripple laid over the top so
		// the ring does not land as one flat pop.
		delay:
			floor +
			rf * 820 +
			hash(i, 4) * 190 +
			(1 - Math.cos(theta * 2 - 0.6)) * 95,
		ox: Math.cos(theta) * off,
		oy: Math.sin(theta) * off,
		spin: (hash(i, 5) - 0.5) * 260,
		seed: hash(i, 6)
	};
}

/** How long a single plate takes to fly its approach. */
export const PLATE_FLIGHT = 620;

/** The last moment any plate is still on screen — flight, hold and dissolve. */
export const assembleSpan = (a: Assembly) =>
	a.plates.reduce((m, p) => Math.max(m, p.delay), 0) +
	PLATE_FLIGHT +
	PLATE_HOLD +
	PLATE_DISSOLVE;

export interface ChromeEnv {
	/** Key direction, swung to make the highlight travel across the panels. */
	lx: number;
	ly: number;
	lz: number;
	/** Where the glint band is, in box units along `glintAxis`. */
	glint: number;
	glintAxis: number;
	/** Brand tint on the grazing edges. Chrome is neutral; the rim is not. */
	accent: [number, number, number];
	/** 0 chrome, 1 the inert graphite the mark starts as. */
	matte: number;
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/**
 * A plate's colour.
 *
 * Chrome is not a lit surface, it is a MIRROR, so the shading is an environment
 * lookup and not a lambert term: reflect the view about the facet normal and ask
 * what is in that direction. The environment is the cheapest one that still
 * reads as metal — dark ground, bright sky, and a hard horizon band between them
 * — and it is the horizon that does the work. Take it out and every panel goes
 * an even grey, which is what plastic looks like.
 */
export function plateFill(p: Plate, env: ChromeEnv, heat: number): string {
	const d = 2 * p.nz;
	const rx = d * p.nx;
	const ry = d * p.ny;
	const rz = d * p.nz - 1;

	const up = -ry;
	const sky = smooth(-0.2, 0.9, up);
	const horizon = Math.exp(-Math.pow((up - 0.05) * 4.4, 2));
	// The 0.22 floor is a FILL light, not laziness. A physically dark ground is
	// correct and unreadable: the panels facing down go to black, and a black
	// panel next to a white one is not chrome, it is a hole.
	let lum = 0.22 + 0.5 * sky + 0.34 * horizon + 0.12 * smooth(0.05, 0.95, -up);

	const kd = rx * env.lx + ry * env.ly + rz * env.lz;
	// Tighter and dimmer than a mirror's. A broad blown-out specular is exactly
	// what made the field read as one polished ball — every chip caught the same
	// highlight, so they all agreed, so they stopped being separate things. A hard
	// narrow glint fires on a FEW of them at a time, which is what a scattering of
	// loose metal actually does.
	const spec = Math.pow(Math.max(0, kd), 46) * 1.35;
	const fres = Math.pow(1 - p.nz, 3);

	const u = p.cx * Math.cos(env.glintAxis) + p.cy * Math.sin(env.glintAxis);
	const glint = Math.exp(-Math.pow((u - env.glint) / 18, 2)) * (0.3 + 0.7 * sky);
	lum = lum * p.tone + glint * 0.4;

	const [ar, ag, ab] = env.accent;
	let r = lum * 168 + spec * 255 + fres * ar * 0.34 + glint * 52;
	let g = lum * 186 + spec * 255 + fres * ag * 0.4 + glint * 74;
	let b = lum * 208 + spec * 255 + fres * ab * 0.44 + glint * 82;

	// The inert state, for the side-by-side. Same normals, three hard bands and
	// no environment at all — which is exactly the difference being demonstrated.
	if (env.matte > 0) {
		const k = p.nz > 0.86 ? 1 : p.nz > 0.62 ? 0.78 : 0.58;
		const m = env.matte;
		r = r * (1 - m) + k * 104 * m;
		g = g * (1 - m) + k * 112 * m;
		b = b * (1 - m) + k * 126 * m;
	}

	// White-hot on arrival, cooling over ~a fifth of a second. The flash is what
	// makes a landing an EVENT; without it the cascade is 200 things sliding.
	if (heat > 0) {
		r += (255 - r) * heat;
		g += (255 - g) * heat;
		b += (255 - b) * heat;
	}

	return `rgb(${clamp255(r)},${clamp255(g)},${clamp255(b)})`;
}

/**
 * The chip's own edge.
 *
 * A dark seam is what you stroke a TILED surface with — it says "these panels
 * are joined". A particle is not joined to anything, so its edge is lit: the
 * brand accent while it is cold, driven to white while it is still hot from
 * arriving. This is most of what separates the field from a mosaic, and it costs
 * one stroke colour that was already being computed for the fill.
 */
export function plateEdge(p: Plate, env: ChromeEnv, heat: number): string {
	const [ar, ag, ab] = env.accent;
	const k = 0.42 + 0.58 * Math.pow(1 - p.nz, 2);
	const r = ar * k + (255 - ar * k) * heat;
	const g = ag * k + (255 - ag * k) * heat;
	const b = ab * k + (255 - ab * k) * heat;
	return `rgb(${clamp255(r)},${clamp255(g)},${clamp255(b)})`;
}

/** Plate flight, as one SVG transform. Offset, tumble and scale about the
 *  plate's own centre — scaling about the box would slide every plate toward
 *  the middle as it shrank, which reads as a zoom, not as an approach. */
export function plateFlight(p: Plate, tA: number): string {
	const k = clamp01((tA - p.delay) / PLATE_FLIGHT);
	if (k >= 1) return '';
	const e = outBack(k);
	const x = p.ox * (1 - e);
	const y = p.oy * (1 - e);
	const rot = p.spin * (1 - e);
	const sc = 0.22 + 0.78 * outCubic(k);
	return `translate(${r2(x)} ${r2(y)}) translate(${r2(p.cx)} ${r2(p.cy)}) rotate(${r2(rot)}) scale(${r2(sc)}) translate(${r2(-p.cx)} ${r2(-p.cy)})`;
}

/** Landing flash, 1 at the moment of contact and gone a fifth of a second on. */
export function plateHeat(p: Plate, tA: number): number {
	const since = tA - (p.delay + PLATE_FLIGHT);
	if (since < 0) return clamp01((tA - p.delay) / PLATE_FLIGHT) * 0.35;
	return Math.exp(-since / 150);
}

/** How long a landed plate is held before it hands off to the forged cut. */
const PLATE_HOLD = 430;
const PLATE_DISSOLVE = 620;

/**
 * A plate is opaque in flight, holds a beat on contact, then dissolves.
 *
 * The dissolve is the whole mechanism, not a tidy-up. The forged mark is already
 * underneath; if the plating simply STAYED, the scene would end with two hundred
 * flat quads sitting on top of far better artwork and the cut would only appear
 * once they were all cleared — which reads as a wipe. Fading each plate a beat
 * after it lands means the chrome emerges plate BY plate, trailing the leading
 * edge of the cascade, so the plating is not covering the mark. It is becoming it.
 */
export function plateAlpha(p: Plate, tA: number): number {
	const inn = smooth(0, PLATE_FLIGHT * 0.3, tA - p.delay);
	const out = smooth(
		p.delay + PLATE_FLIGHT + PLATE_HOLD,
		p.delay + PLATE_FLIGHT + PLATE_HOLD + PLATE_DISSOLVE,
		tA
	);
	return inn * (1 - out);
}

/** The nanite stream: motes that run in on the same vectors the plates do, so
 *  the swarm and the assembly are visibly one event rather than two effects
 *  playing at once. */
export interface Mote {
	a: number;
	r0: number;
	delay: number;
	speed: number;
	size: number;
	/** Degrees per second of tumble. A mote that holds its attitude on the way in
	 *  is a dot travelling; one that turns is a piece of something. */
	spin: number;
	seed: number;
}

export function buildMotes(n = 90): Mote[] {
	return Array.from({ length: n }, (_, i) => ({
		a: hash(i, 11) * Math.PI * 2,
		r0: 150 + hash(i, 12) * 210,
		delay: hash(i, 13) * 1700,
		speed: 900 + hash(i, 14) * 700,
		size: 0.9 + hash(i, 15) * 2.4,
		spin: (hash(i, 17) - 0.5) * 900,
		seed: hash(i, 16)
	}));
}
