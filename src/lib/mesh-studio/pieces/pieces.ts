// ── mesh-studio/pieces — solids that STAND on the mesh ───────────────────────
// Every node on the globe so far is a marker lying flat on the surface: a disc
// that happens to be somewhere. A piece is the other thing — a small solid
// standing ON the sphere, like a token on a board. It has a footprint, a height,
// and sides you can see round.
//
// The model is deliberately the smallest one that can do that:
//
//  · Coordinates are LOCAL to the node — east, north, and height — in units of
//    the node's own radius. So a piece is written once and is the right size on
//    any globe, at any zoom, at any node size. Nothing here is in pixels.
//  · A piece is a list of CONVEX solids, not one mesh. Back-face culling is
//    exact on a convex solid and needs no z-buffer, so "cull each part, then
//    sort the surviving faces by depth" is the whole hidden-surface pass — the
//    same painter's trick the globe already uses for nodes.
//  · Faces are wound counter-clockwise SEEN FROM OUTSIDE. That single
//    convention is what makes `cross(edge1, edge2)` the outward normal, which
//    is in turn what makes culling and shading one line each.
//
// Pure: no Svelte, no DOM, no projection. A renderer supplies the frame (see
// physics/sphere `tangentFrame`) and this supplies the shape.

/** A vertex in the node's local frame. Node radii, not pixels. */
export interface PieceVert {
	/** Along the surface, to the right. */
	e: number;
	/** Along the surface, away from the viewer at rest. */
	n: number;
	/** Straight up off the surface. */
	h: number;
}

/** One convex part of a piece. */
export interface Solid {
	verts: PieceVert[];
	/** Index loops, counter-clockwise seen from outside. */
	faces: number[][];
}

export type Piece = Solid[];

/** A box, axis-aligned in the tangent frame.
 *
 *  The face order is the general rule for any extruded footprint: the floor
 *  wound backwards, the roof wound forwards, and one quad per footprint edge
 *  carrying it up. Every other solid here is the same idea with a different
 *  outline. */
export function box(
	e0: number,
	e1: number,
	n0: number,
	n1: number,
	h0: number,
	h1: number,
): Solid {
	const foot: [number, number][] = [
		[e0, n0],
		[e1, n0],
		[e1, n1],
		[e0, n1],
	];
	const verts: PieceVert[] = [
		...foot.map(([e, n]) => ({ e, n, h: h0 })),
		...foot.map(([e, n]) => ({ e, n, h: h1 })),
	];
	return {
		verts,
		faces: [
			[0, 3, 2, 1], // floor — wound backwards, since its outside faces down
			[4, 5, 6, 7], // roof
			[0, 1, 5, 4],
			[1, 2, 6, 5],
			[2, 3, 7, 6],
			[3, 0, 4, 7],
		],
	};
}

/** Extrude any footprint straight up.
 *
 *  `box` is this with four corners, and the comment above is this function's
 *  specification — floor wound backwards, roof forwards, one quad per footprint
 *  edge. Worth having in the general form because the moment a shape wants to be
 *  ROUND, the answer at this poly count is a footprint with more corners, and
 *  writing that out by hand is where winding mistakes come from.
 *
 *  The footprint must be convex and wound counter-clockwise in (e, n) — the same
 *  guarantee every other solid here makes, and what keeps culling a one-liner. */
export function prism(foot: [number, number][], h0: number, h1: number): Solid {
	const k = foot.length;
	const verts: PieceVert[] = [
		...foot.map(([e, n]) => ({ e, n, h: h0 })),
		...foot.map(([e, n]) => ({ e, n, h: h1 })),
	];
	const floor = Array.from({ length: k }, (_, i) => k - 1 - i);
	const roof = Array.from({ length: k }, (_, i) => k + i);
	const sides = Array.from({ length: k }, (_, i) => {
		const j = (i + 1) % k;
		return [i, j, k + j, k + i];
	});
	return { verts, faces: [floor, roof, ...sides] };
}

/**
 * A rectangle with its corners cut off — the cheapest thing that reads as ROUND.
 *
 * Eight sides rather than four is the entire difference between a character that
 * looks carved and one that looks moulded, and it costs four triangles. `cut` is
 * how far in from each corner the chamfer starts, as a fraction of the half-span:
 * 0 is a box, 1 is a diamond, and about a third is where it stops looking like
 * either.
 */
export function octagon(w: number, d: number, cut = 0.34): [number, number][] {
	const ce = w * cut;
	const cn = d * cut;
	return [
		[-w + ce, -d],
		[w - ce, -d],
		[w, -d + cn],
		[w, d - cn],
		[w - ce, d],
		[-w + ce, d],
		[-w, d - cn],
		[-w, -d + cn],
	];
}

/** A pitched roof: a wedge whose ridge runs north, centred on east 0.
 *
 *  This is the piece that says "building" rather than "block" — a flat-topped
 *  box at this size reads as a die. */
export function gable(w: number, n0: number, n1: number, h0: number, h1: number): Solid {
	return {
		verts: [
			{ e: -w, n: n0, h: h0 },
			{ e: w, n: n0, h: h0 },
			{ e: w, n: n1, h: h0 },
			{ e: -w, n: n1, h: h0 },
			{ e: 0, n: n0, h: h1 },
			{ e: 0, n: n1, h: h1 },
		],
		faces: [
			[0, 3, 2, 1], // underside
			[1, 2, 5, 4], // east slope
			[3, 0, 4, 5], // west slope
			[0, 1, 4], // gable end, near
			[2, 3, 5], // gable end, far
		],
	};
}

/** One tooth of a sawtooth roof: a right-angled wedge, vertical face to the
 *  west, sloping away east. Repeated along a shed roof it is the silhouette
 *  that reads as INDUSTRY and nothing else — the north-light roof every
 *  19th-century factory was built with, and the reason a factory is legible at
 *  30 pixels when a warehouse is not. */
export function tooth(e0: number, e1: number, n0: number, n1: number, h0: number, h1: number): Solid {
	return {
		verts: [
			{ e: e0, n: n0, h: h0 },
			{ e: e1, n: n0, h: h0 },
			{ e: e0, n: n0, h: h1 },
			{ e: e0, n: n1, h: h0 },
			{ e: e1, n: n1, h: h0 },
			{ e: e0, n: n1, h: h1 },
		],
		faces: [
			[0, 3, 4, 1], // underside
			[0, 2, 5, 3], // the vertical face — the "window" of a north light
			[1, 4, 5, 2], // the slope
			[0, 1, 2], // end, near
			[3, 5, 4], // end, far
		],
	};
}

// ── The pieces themselves ────────────────────────────────────────────────────
// Written in node radii: 1.0 east is one radius right of centre, 1.0 high is one
// radius off the surface. A piece is sized so its FOOTPRINT sits inside the disc
// the node would otherwise have drawn — it stands on its own plot rather than
// overhanging the neighbours.

// Heights are set against a hard constraint: a piece is only ever seen at a
// slant, and the band of SIDE you get is its height times the sine of that
// slant. At the ~25° the frame leans by, a piece 1.6 radii tall shows about 0.68
// of a radius of side — call it 18px on a 27px node, which is enough to tell a
// gable from a sawtooth. Shorter than about 1.4 and the two silhouettes converge
// into "a lump", however good the shading is.

/** The plain token — a house. Square footprint, pitched roof, nothing else.
 *  The Monopoly piece: the simplest solid that still reads as a building rather
 *  than a block, and the baseline every other piece is a variation on. */
const HOUSE: Piece = [
	box(-0.46, 0.46, -0.46, 0.46, 0, 0.92),
	// The roof overhangs the walls slightly, which is what makes the two parts
	// read as roof-on-house instead of one stepped column.
	gable(0.56, -0.56, 0.56, 0.92, 1.62),
];

/** A factory: a low wide shed under a sawtooth roof, with a chimney.
 *
 *  Wider than it is tall, because that is the proportion that says "shed" — a
 *  tall factory reads as an office block. The chimney is off-centre for the same
 *  reason a real one is: it belongs to the building, not to its symmetry. */
const FACTORY: Piece = (() => {
	const w = 0.86; // half-width of the shed
	const dn = 0.44; // half-depth
	const deck = 0.8; // where the walls stop and the roof starts
	const teeth = 3;
	const span = (2 * w) / teeth;
	return [
		box(-w, w, -dn, dn, 0, deck),
		// Three teeth across 1.72 radii — each notch is about a fifth of a radius
		// deep, which is the smallest step that survives at node size. Two teeth
		// read as a kink in the roof; four read as a comb.
		...Array.from({ length: teeth }, (_, i) =>
			tooth(-w + i * span, -w + (i + 1) * span, -dn, dn, deck, deck + 0.42),
		),
		// Chimney: narrow, and tall enough to clear the roof by its own height —
		// a stack level with the ridge reads as a vent. It also breaks the top
		// silhouette, which is most of how a factory is told from a shed.
		box(0.42, 0.64, -0.16, 0.06, deck, 1.95),
	];
})();

/** Every piece a node may ask for by name. */
export const PIECES: Record<string, Piece> = {
	house: HOUSE,
	factory: FACTORY,
};

export type PieceId = keyof typeof PIECES;
