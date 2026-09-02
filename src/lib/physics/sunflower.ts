// ── physics/sunflower — phyllotaxis placement ─────────────────────────────────
// Places bodies the way a sunflower head packs seeds: each one a golden angle
// (≈137.5°) around from the last, stepping outward so that equal counts occupy
// equal area. The result fills a disc uniformly instead of stacking onto rings.
//
// Why this rather than a ring: a ring puts every body at ONE radius, so the
// radius has to grow with the count and the middle is left empty. Phyllotaxis
// has no rings to fill — it spreads bodies evenly across the whole annulus, so
// the footprint grows with the square root of the count rather than linearly.
//
// Two properties earn it its place here beyond just density:
//
//   · The golden angle is irrational, so no two bodies ever share a bearing from
//     the centre. In a hub-and-spoke mesh every body needs a clear line back to
//     the hub — and phyllotaxis hands out distinct bearings for free, where a
//     ring-of-rings would stack bodies directly behind one another.
//
//   · Successive indices land far apart (137.5°), not side by side, so a body's
//     neighbours are drawn from all over the sequence. Nothing reads as a row.
//
// Closed form given a spacing constant, which is then solved by bisection —
// no iteration to a fixed point, no seed, no way to fail to converge.

export interface SunflowerOpts {
	/** Clear space between two bodies at rest. */
	margin?: number;
	/** Radius of the hub at the centre — bodies must clear it. */
	hubR?: number;
	/** Clear space between the hub and the nearest body. */
	hubMargin?: number;
	/** Rotates the whole pattern, in degrees. When `spread` is set this is the
	 *  bearing the wedge is centred on instead — 0 points right. */
	startAngle?: number;
	/** Confine the spiral to a wedge of this many degrees, rather than letting it
	 *  fill the whole turn. 120 with `startAngle: 0` fans the mesh out to the
	 *  right of the hub, which reads as a source and what flows from it rather
	 *  than as a hub with things around it.
	 *
	 *  The golden angle taken modulo the wedge is still equidistributed across it
	 *  — the spiral fills a sector the same way it fills a disc, and for the same
	 *  reason. Bodies still each claim equal area, because a sector annulus grows
	 *  with r² exactly as a full one does; only the constant changes. */
	spread?: number;
}

export interface SunflowerPlacement {
	/** Offset from the centre, index-aligned with the input radii. */
	points: { x: number; y: number }[];
	/** Distance from the centre to the outermost body's edge. */
	radius: number;
	/** The solved area constant — exposed for tests and tuning, not for callers. */
	spacing: number;
}

/** π(3−√5) ≈ 2.39996 rad ≈ 137.5°. The most irrational angle there is, which is
 *  why no two indices ever line up. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Body `i` sits at √(h² + s²(i+½)) from the centre, so the area between the hub
 *  and each successive body grows by a constant — an even spread over the
 *  annulus rather than a spiral that thins out as it goes. */
function placeAt(i: number, h: number, s: number, rot: number, wedge: number): { x: number; y: number } {
	const r = Math.sqrt(h * h + s * s * (i + 0.5));
	// Full turn: walk the golden angle. Wedge: walk it modulo the wedge, which
	// still spreads bodies evenly across the sector without ever repeating.
	const a = wedge > 0 ? rot + (((i * GOLDEN_ANGLE) % wedge) - wedge / 2) : i * GOLDEN_ANGLE + rot;
	return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

function points(radii: number[], h: number, s: number, rot: number, wedge: number) {
	return radii.map((_, i) => placeAt(i, h, s, rot, wedge));
}

/** Do any two bodies overlap at this spacing? Brute force — tens of bodies. */
function fits(radii: number[], pts: { x: number; y: number }[], margin: number): boolean {
	for (let i = 0; i < pts.length; i++)
		for (let j = i + 1; j < pts.length; j++) {
			const need = radii[i] + radii[j] + margin;
			const dx = pts[i].x - pts[j].x;
			const dy = pts[i].y - pts[j].y;
			if (dx * dx + dy * dy < need * need) return false;
		}
	return true;
}

/** Lay bodies out in a phyllotactic spiral around a hub, packed as tightly as
 *  their sizes allow.
 *
 *  The spacing constant is bisected rather than derived: the closed form for
 *  minimum separation only holds for equal radii, and a real mesh mixes a leaf
 *  with a fanned-out agent twice its size. Bisection asks the actual question —
 *  "does anything overlap at this spacing?" — so mixed sizes cost nothing. */
export function packSunflower(radii: number[], opts: SunflowerOpts = {}): SunflowerPlacement {
	const { margin = 0, hubR = 0, hubMargin = 0, startAngle = -90, spread } = opts;
	const rot = (startAngle * Math.PI) / 180;
	// A wedge of a full turn or more is just a full turn — fall back to the plain
	// spiral, which has no seam where the wedge would wrap onto itself.
	const wedge = spread && spread < 360 ? (Math.max(1, spread) * Math.PI) / 180 : 0;
	if (!radii.length) return { points: [], radius: Math.max(hubR + hubMargin, 1), spacing: 0 };

	const maxR = Math.max(...radii);
	// The innermost body must clear the hub, so the spiral starts outside it.
	const h = hubR + hubMargin + maxR;

	// Grow until nothing overlaps, then bisect back down to the tightest fit.
	let lo = 0;
	let hi = Math.max(2 * maxR + margin, 1);
	for (let i = 0; i < 64 && !fits(radii, points(radii, h, hi, rot, wedge), margin); i++) {
		lo = hi;
		hi *= 1.5;
	}
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (fits(radii, points(radii, h, mid, rot, wedge), margin)) hi = mid;
		else lo = mid;
	}

	const pts = points(radii, h, hi, rot, wedge);
	const radius = Math.max(...pts.map((p, i) => Math.hypot(p.x, p.y) + radii[i]));
	return { points: pts, radius, spacing: hi };
}
