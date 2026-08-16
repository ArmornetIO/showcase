// ── mesh-studio/piece-facets — turning a solid into visible faces ────────────
// `pieces.ts` says what a shape IS, in the node's own east/north/height frame.
// This says what of it you can SEE from where you are standing: cull the faces
// pointing away, shade the survivors by which way they face, and sort them back
// to front so a painter's pass is the whole hidden-surface problem.
//
// Lifted out of NodePiece because there is now more than one thing standing on a
// plot. A building on the globe and a character in a first-person scene are the
// same three operations over the same vertex format, and two copies of a cull
// are two culls that drift — one of them gets a fix and the other keeps a
// backwards-wound face nobody notices until it is lit from the other side.
//
// Pure: no Svelte, no DOM. The caller supplies a frame (see physics/sphere
// `tangentFrame`, or `studioFrame` below for a shape seen in isolation) and gets
// back paths.

import type { Piece, PieceVert } from './pieces.js';
import type { TangentFrame, Vec3 } from '../../physics/sphere.js';

/** Where the light comes from, in world terms — over the viewer's left shoulder
 *  and slightly above. High enough that roofs are the bright plane and walls are
 *  not, shallow enough that the shading reads as form rather than as noon. */
export const PIECE_LIGHT: Vec3 = { x: -0.42, y: -0.5, z: 0.76 };

/** Three hard values, no gradient. At node size a smooth ramp turns to mush —
 *  neighbouring faces land a few percent apart and read as one blob. Hard steps
 *  keep every plane distinct. */
export function band(lit: number): number {
	if (lit > 0.62) return 1;
	if (lit > 0.22) return 0.76;
	return 0.54;
}

/** A visible face.
 *
 *  It keeps its LOCAL vertices as well as its projected path, because a caller
 *  may need to cut it at a constant height — contour banding over a building
 *  does exactly that — and height is a local fact the screen path has already
 *  thrown away. */
export interface Facet {
	d: string;
	shade: number;
	depth: number;
	verts: PieceVert[];
}

export interface FacetOpts {
	/** How deep the piece sits into the ground it stands on. Applied here rather
	 *  than in the shapes: how far a thing is buried is a fact about the ground,
	 *  not about what the thing is. */
	sink?: number;
	/** Uniform scale on the whole piece, in the frame's own units. */
	scale?: number;
	light?: Vec3;
}

/**
 * Where a local vertex lands on screen, relative to the piece's own centre.
 *
 * Affine in the three axes, with one correction: the higher a vertex sits the
 * nearer the eye it is, so its offsets ACROSS the surface open out. Without that,
 * a piece seen from directly overhead is a roof lying flat on its own floor with
 * no sign of any height at all.
 *
 * Handed back as a closure rather than kept private, because a caller that draws
 * anything ELSE in the piece's local space — a contour cutting it at constant
 * height, the point its apex reaches — has to place those points with exactly
 * this projection or they will not sit on the solid they belong to.
 */
export function pieceProjector(
	frame: TangentFrame,
	opts: FacetOpts = {},
): (v: PieceVert) => { x: number; y: number } {
	const sink = opts.sink ?? 0;
	const k0 = opts.scale ?? 1;
	return (v) => {
		const h = v.h * k0 - sink;
		const e = v.e * k0;
		const n = v.n * k0;
		const g = 1 + (frame.grow - 1) * h;
		return {
			x: (e * frame.e.x + n * frame.n.x) * g + h * frame.u.x,
			y: (e * frame.e.y + n * frame.n.y) * g + h * frame.u.y,
		};
	};
}

/**
 * Cull, shade and sort.
 *
 * The normal falls out of the winding: `pieces.ts` guarantees faces are wound
 * counter-clockwise seen from outside, and the local frame is orthonormal and
 * right-handed, so the plain cross product of two edges IS the outward normal.
 * That one convention is what makes culling and shading a line each.
 */
export function pieceFacets(piece: Piece, frame: TangentFrame, opts: FacetOpts = {}): Facet[] {
	const light = opts.light ?? PIECE_LIGHT;
	const at = pieceProjector(frame, opts);

	/** A local direction in world terms, where +z is toward the viewer. */
	const world = (e: number, n: number, h: number) => ({
		x: e * frame.axis.e.x + n * frame.axis.n.x + h * frame.axis.u.x,
		y: e * frame.axis.e.y + n * frame.axis.n.y + h * frame.axis.u.y,
		z: e * frame.axis.e.z + n * frame.axis.n.z + h * frame.axis.u.z,
	});

	const out: Facet[] = [];
	for (const solid of piece) {
		for (const face of solid.faces) {
			const a = solid.verts[face[0]];
			const b = solid.verts[face[1]];
			const c = solid.verts[face[2]];
			const u = { e: b.e - a.e, n: b.n - a.n, h: b.h - a.h };
			const w = { e: c.e - a.e, n: c.n - a.n, h: c.h - a.h };
			const nrm = world(
				u.n * w.h - u.h * w.n,
				u.h * w.e - u.e * w.h,
				u.e * w.n - u.n * w.e,
			);
			const len = Math.hypot(nrm.x, nrm.y, nrm.z) || 1;
			// Facing away — the piece's own front will cover it.
			if (nrm.z / len <= 0.001) continue;
			const pts = face.map((i) => at(solid.verts[i]));
			out.push({
				d: `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`,
				shade: band((nrm.x * light.x + nrm.y * light.y + nrm.z * light.z) / len),
				depth:
					face.reduce((s, i) => {
						const v = solid.verts[i];
						return s + world(v.e, v.n, v.h).z;
					}, 0) / face.length,
				verts: face.map((i) => solid.verts[i]),
			});
		}
	}
	// Back to front. Culling already removed the far side of every part; this is
	// only about which PART is in front of which.
	return out.sort((p, q) => p.depth - q.depth);
}

/**
 * A frame for looking at a piece on its own, off the globe.
 *
 * `tangentFrame` answers "which way is up where this thing is STANDING", which
 * needs a sphere to stand on. A character in a first-person overlay, or a shape
 * on a design sheet, has no plot — it just needs a camera. Same interface, so
 * the same renderer draws both, which is the entire reason this exists rather
 * than a second projector.
 *
 * Orthographic on purpose (`grow: 1`). Perspective on a single small subject
 * buys nothing and costs a vanishing point that has to agree with whatever else
 * is on screen; a turntable view of one model is the one place flat is right.
 */
export function studioFrame(yaw: number, pitch: number, step: number): TangentFrame {
	// Worked in an ordinary right-handed space (X right, Y UP, Z toward viewer)
	// and flipped at the end, because getting a rotation right in a y-down frame
	// is the sort of thing that is correct on the third attempt.
	const cy = Math.cos(yaw);
	const sy = Math.sin(yaw);
	const cp = Math.cos(pitch);
	const sp = Math.sin(pitch);

	// At rest: east is screen-right, north is away from the viewer, up is up.
	const spin = (v: [number, number, number]): Vec3 => {
		const [x, y, z] = v;
		// Yaw about the vertical, then pitch about the (already yawed) horizontal.
		const x1 = x * cy + z * sy;
		const z1 = -x * sy + z * cy;
		const y2 = y * cp - z1 * sp;
		const z2 = y * sp + z1 * cp;
		// Flip to the screen convention: +y is DOWN.
		return { x: x1, y: -y2, z: z2 };
	};

	const e = spin([1, 0, 0]);
	const n = spin([0, 0, -1]);
	const u = spin([0, 1, 0]);
	return {
		e: { x: e.x * step, y: e.y * step },
		n: { x: n.x * step, y: n.y * step },
		u: { x: u.x * step, y: u.y * step },
		axis: { e, n, u },
		grow: 1,
	};
}
