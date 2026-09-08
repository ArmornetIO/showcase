// ── character · solid moves ──────────────────────────────────────────────────
// The handful of transforms a figure and everything it wears are assembled out
// of. Each takes a `Solid` and hands back a `Solid` in the same east/north/
// height frame, so a limb, a hat and a badge are all "a lump, put somewhere"
// rather than three bespoke outlines with an offset baked through each.
//
// Gathered here because there were three private copies: `builds.ts` had `at`,
// `render.ts` had `lift`/`swing`/`orbit`, and anything that wanted to hang
// something off a character had to write a fourth. A move that exists twice is
// a move that gets fixed once.
//
// EVERY TRANSFORM BELOW PRESERVES WINDING, and that is not a nicety —
// `pieceFacets` derives the outward normal from the face's winding, so a
// transform that flipped a solid would cull precisely the faces it should have
// kept and keep the ones it should have dropped. Translation, shear and
// positive scaling are safe. That is why there is no `mirror` here: a
// left-handed copy of a solid has to be authored, not derived.

import { octagon, prism, type Solid } from '../mesh-studio/pieces/pieces.js';

/** Move a solid across the ground. */
export const at = (s: Solid, e: number, n = 0): Solid =>
	e || n ? { faces: s.faces, verts: s.verts.map((v) => ({ e: v.e + e, n: v.n + n, h: v.h })) } : s;

/** Move a solid up. */
export const lift = (s: Solid, dh: number): Solid =>
	dh ? { faces: s.faces, verts: s.verts.map((v) => ({ ...v, h: v.h + dh })) } : s;

/** A rounded mass: an octagonal prism, which is the only shape the body uses.
 *  `cut` is how far the corners come in — 0 is a box, 1 a diamond, a third is
 *  where it stops looking like either. */
export const lump = (w: number, d: number, h0: number, h1: number, cut = 0.34): Solid =>
	prism(octagon(w, d, cut), h0, h1);

/**
 * A lump that changes size on the way up.
 *
 * The shape the body never needed and everything worn does: a dome, a horn, a
 * bell, a crown point. Built by hand rather than through `prism` because a
 * prism is this with one footprint used twice — so the face topology below is
 * copied from `prism` deliberately, and the two must stay identical: floor
 * wound backwards, roof forwards, one quad per footprint edge carrying it up.
 *
 * Convex as long as it is a real frustum. Taking the top past zero would fold
 * the sides through each other and hand the cull a normal pointing inward, so
 * a point is a taper to a small non-zero cap, not to nothing.
 */
export function taper(
	w0: number,
	d0: number,
	w1: number,
	d1: number,
	h0: number,
	h1: number,
	cut = 0.34
): Solid {
	const floor = octagon(w0, d0, cut);
	const roof = octagon(w1, d1, cut);
	const k = floor.length;
	return {
		verts: [
			...floor.map(([e, n]) => ({ e, n, h: h0 })),
			...roof.map(([e, n]) => ({ e, n, h: h1 }))
		],
		faces: [
			Array.from({ length: k }, (_, i) => k - 1 - i),
			Array.from({ length: k }, (_, i) => k + i),
			...Array.from({ length: k }, (_, i) => {
				const j = (i + 1) % k;
				return [i, j, k + j, k + i];
			})
		]
	};
}

/**
 * Tip a solid without turning it: slide every vertex's height by where it sits.
 *
 * A shear rather than a rotation because a rotation of a footprint-extruded
 * solid is no longer footprint-extruded — its floor stops being level, which is
 * fine, but its sides stop being vertical quads, which the winding rules above
 * were written for. Shearing keeps every face a plane and every normal honest,
 * and at the angles a hat is worn at the eye cannot tell the difference.
 */
export const shear = (s: Solid, byN = 0, byE = 0): Solid =>
	byN || byE
		? { faces: s.faces, verts: s.verts.map((v) => ({ ...v, h: v.h + v.n * byN + v.e * byE })) }
		: s;

/**
 * Swing a solid about a height, in the plane that runs front to back.
 *
 * Applied to the geometry rather than to the drawn path on purpose: a limb
 * rotated after projection would keep the depth it had at rest, and the arm that
 * swung forward would still sort behind the torso it is now in front of. Posing
 * before the cull is what makes the painter's pass stay honest.
 */
export function swing(s: Solid, angle: number, pivot: number): Solid {
	if (!angle) return s;
	const c = Math.cos(angle);
	const k = Math.sin(angle);
	return {
		faces: s.faces,
		verts: s.verts.map((v) => {
			const dh = v.h - pivot;
			return { e: v.e, n: v.n * c + dh * k, h: pivot - v.n * k + dh * c };
		})
	};
}

/** Move a solid along the arc its pivot would swing it through, WITHOUT turning
 *  it — the ankle a rigid figure does not have. See `Part.rigid`. */
export function orbit(s: Solid, angle: number, pivot: number): Solid {
	if (!angle) return s;
	const n = s.verts.reduce((a, v) => a + v.n, 0) / s.verts.length;
	const h = s.verts.reduce((a, v) => a + v.h, 0) / s.verts.length;
	const dh = h - pivot;
	const c = Math.cos(angle);
	const k = Math.sin(angle);
	const dn = n * c + dh * k - n;
	const dz = pivot - n * k + dh * c - h;
	return { faces: s.faces, verts: s.verts.map((v) => ({ e: v.e + 0, n: v.n + dn, h: v.h + dz })) };
}

/**
 * Turn a solid about the vertical.
 *
 * The one rotation that is safe here, and worth having for exactly that reason:
 * it is a proper rotation, so its determinant is +1 and the winding survives
 * it. (The transform that does NOT survive is a mirror — see the header.) It
 * keeps sides vertical, which is what `shear` could not promise about a tip.
 */
export function turn(s: Solid, angle: number): Solid {
	if (!angle) return s;
	const c = Math.cos(angle);
	const k = Math.sin(angle);
	return {
		faces: s.faces,
		verts: s.verts.map((v) => ({ e: v.e * c + v.n * k, n: -v.e * k + v.n * c, h: v.h }))
	};
}

/**
 * Tip a solid about the east axis — the move that stands a flat thing UP.
 *
 * `prism` only extrudes along height, so anything authored as an outline comes
 * out lying face-up. A badge on a chest has to face FORWARD, so it is authored
 * flat, extruded thin, and tipped a quarter turn. A proper rotation again, so
 * the winding survives it.
 */
export function tip(s: Solid, angle: number): Solid {
	if (!angle) return s;
	const c = Math.cos(angle);
	const k = Math.sin(angle);
	return {
		faces: s.faces,
		verts: s.verts.map((v) => ({ e: v.e, n: v.n * c - v.h * k, h: v.n * k + v.h * c }))
	};
}

/**
 * Force a footprint counter-clockwise.
 *
 * `prism` demands CCW winding and gives no diagnostic when it does not get it —
 * the solid simply culls inside out, which looks like a missing shape rather
 * than a reversed one. Hand-authored outlines get this wrong constantly (the
 * y-axis points up while you draw and down when you look), so every authored
 * footprint goes through here rather than through a reviewer's eye.
 */
export function ccw(foot: [number, number][]): [number, number][] {
	let a = 0;
	for (let i = 0; i < foot.length; i++) {
		const [x0, y0] = foot[i];
		const [x1, y1] = foot[(i + 1) % foot.length];
		a += x0 * y1 - x1 * y0;
	}
	return a < 0 ? [...foot].reverse() : foot;
}

/** A ring of `k` solids about the vertical, each made by a maker handed its own
 *  angle. Rings are the one thing a kernel of convex solids cannot express as a
 *  single shape — a torus is not convex — so a halo, a crown's points and a
 *  hover skirt are all this. */
export function ring(k: number, make: (angle: number, i: number) => Solid): Solid[] {
	return Array.from({ length: k }, (_, i) => make((i / k) * Math.PI * 2, i));
}

/** Turn a solid to face out along an angle, then push it out to that radius.
 *
 *  Elliptical by default because a head is wider than it is deep: a crown's
 *  points set on a circle stand off the temples and cut into the brow. */
export const atAngle = (s: Solid, angle: number, rE: number, rN = rE): Solid =>
	at(turn(s, angle), Math.sin(angle) * rE, Math.cos(angle) * rN);
