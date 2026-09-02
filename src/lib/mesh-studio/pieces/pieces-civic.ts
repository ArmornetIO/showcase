// ── mesh-studio/pieces-civic — the cognition & signal quarter ────────────────
// Eight more solids for the globe, in the same language `pieces.ts` set out: a
// list of convex parts, wound counter-clockwise seen from outside, measured in
// node radii. Nothing here changes the format; this file only adds buildings.
//
// The eight belong to one settlement, and that is a constraint rather than a
// flourish. At 40 pixels a viewer cannot read a building, only tell it from its
// neighbours — which only works if the neighbours share enough that the
// DIFFERENCE is the signal. So every piece in this quarter is built to the same
// three rules:
//
//  · A PLINTH COURSE. Every structure steps out of the ground on a low slab
//    ~0.15 radii high that oversails the mass above it by about 0.08. It is the
//    settlement's foundation habit, it reads at any size as "this was placed,
//    not dropped", and it is also what pins the model's lowest point to exactly
//    zero in one predictable spot.
//  · ONE TOP INCIDENT, never two. Each building breaks its own top edge with a
//    single vertical event — a spire, a mast, a dish, a flue, an apex. Two
//    verticals of similar height read as a pair of sticks and the eye stops
//    reading either; one reads as intent.
//  · THREE ROOFS AND NO MORE. A hipped pyramid, a ridge, or a flat deck. The
//    vocabulary is small on purpose: when the roof grammar is shared, the
//    silhouette below it is doing all the distinguishing.
//
// What varies is the MASS: a drum, a wide tiered hall, two towers with a gap
// between them, a needle, a descending cascade, an hourglass, a hut — and one
// that is barely a mass at all, a deck on four posts with daylight under it.
// Those eight outlines are different as black shapes, which is the only test
// that matters.

import type { ModeKey } from '../modes.gen.js';
import { box, gable, tooth, type Piece, type Solid, type PieceVert } from './pieces.js';

// ── Extra primitives ────────────────────────────────────────────────────────
// `pieces.ts` ships the three shapes its two buildings needed. These are the
// ones this quarter needs, kept here rather than pushed upstream — a primitive
// earns a place in the shared file by being used by more than one author.

/** A footprint in the tangent plane: (east, north) pairs, counter-clockwise
 *  SEEN FROM ABOVE. That handedness is not a style choice — the frame is
 *  right-handed (`e × n = h`), so a footprint wound this way extrudes into a
 *  solid whose roof normal already points up and whose walls already point out.
 *  Wind one backwards and every face of the building is inside-out at once. */
export type Foot = [number, number][];

/** Average of a footprint's corners. Good enough as a centre for the regular
 *  outlines used here, and it is only ever used to scale about. */
function centre(foot: Foot): [number, number] {
	const e = foot.reduce((s, p) => s + p[0], 0) / foot.length;
	const n = foot.reduce((s, p) => s + p[1], 0) / foot.length;
	return [e, n];
}

/** The general extrusion: two matching outlines at two heights, skinned.
 *
 *  Every flat-topped solid in this file is this function. The two outlines must
 *  correspond corner for corner and the lower one must be convex, or the sides
 *  stop being planar and the renderer's one-normal-per-face shortcut starts
 *  lying about which way a wall points. */
function loft(bottom: Foot, h0: number, top: Foot, h1: number): Solid {
	const k = bottom.length;
	const verts: PieceVert[] = [
		...bottom.map(([e, n]) => ({ e, n, h: h0 })),
		...top.map(([e, n]) => ({ e, n, h: h1 })),
	];
	return {
		verts,
		faces: [
			// Floor wound backwards — its outside faces down — then the roof
			// forwards, then one quad per footprint edge carrying it up. Identical
			// bookkeeping to `box`, generalised past four corners.
			Array.from({ length: k }, (_, i) => k - 1 - i),
			Array.from({ length: k }, (_, i) => k + i),
			...Array.from({ length: k }, (_, i) => [i, (i + 1) % k, k + ((i + 1) % k), k + i]),
		],
	};
}

/** A straight prism on any convex footprint — a box that is not a rectangle. */
export function prism(foot: Foot, h0: number, h1: number): Solid {
	return loft(foot, h0, foot, h1);
}

/** A prism whose top is the footprint scaled by `k` about its own centre.
 *
 *  `k < 1` is a batter — the inward lean that makes a tower read as founded
 *  rather than as a post pushed into the ground. `k > 1` is a corbel, and it is
 *  rarer and louder: a mass that grows as it rises is the one profile no other
 *  building in the set has, which is why the mill spends its whole silhouette
 *  budget on one.
 *
 *  The scale has to be UNIFORM. Under a uniform scale each top edge stays
 *  parallel to the bottom edge below it, and two parallel lines are coplanar —
 *  that is the entire reason the side quads of this solid are flat. Scale the
 *  axes differently and every wall becomes a saddle. */
export function taper(foot: Foot, h0: number, h1: number, k: number): Solid {
	const [ce, cn] = centre(foot);
	const top: Foot = foot.map(([e, n]) => [ce + (e - ce) * k, cn + (n - cn) * k]);
	return loft(foot, h0, top, h1);
}

/** A cone over a convex footprint: the hipped cap.
 *
 *  Every face is a triangle, so planarity is free and the apex can sit anywhere
 *  without breaking convexity. A hip beats a ridge when a mass is roughly square
 *  in plan — a ridge on a square footprint has no long direction to run along
 *  and reads as a crease rather than a roof. */
export function pyramid(foot: Foot, h0: number, hApex: number, ae?: number, an?: number): Solid {
	const [ce, cn] = centre(foot);
	const k = foot.length;
	return {
		verts: [
			...foot.map(([e, n]) => ({ e, n, h: h0 })),
			{ e: ae ?? ce, n: an ?? cn, h: hApex },
		],
		faces: [
			Array.from({ length: k }, (_, i) => k - 1 - i),
			...Array.from({ length: k }, (_, i) => [i, (i + 1) % k, k]),
		],
	};
}

/** A regular polygon footprint. `rot` turns it: at `π/8` an octagon presents a
 *  flat side to the viewer instead of a corner, which is what makes a drum read
 *  as a drum rather than as a crystal. */
export function ngon(r: number, sides: number, rot = 0, ce = 0, cn = 0): Foot {
	return Array.from({ length: sides }, (_, i) => {
		const a = rot + (2 * Math.PI * i) / sides;
		return [ce + r * Math.cos(a), cn + r * Math.sin(a)] as [number, number];
	});
}

/** A rectangle footprint, for feeding the loft/taper family. */
export function rect(e0: number, e1: number, n0: number, n1: number): Foot {
	return [
		[e0, n0],
		[e1, n0],
		[e1, n1],
		[e0, n1],
	];
}

/** A pitched roof whose ridge runs EAST — `gable` transposed.
 *
 *  Worth having as its own primitive rather than as a rotation, because the two
 *  orientations do completely different jobs at node size. A north-running ridge
 *  shows the viewer its long slope; an east-running ridge shows the viewer its
 *  TRIANGLE. The triangle is a pediment, and a pediment is the oldest shorthand
 *  there is for a building you are supposed to approach and be judged in. */
export function ridgeE(
	e0: number,
	e1: number,
	n0: number,
	n1: number,
	h0: number,
	h1: number,
): Solid {
	const nm = (n0 + n1) / 2;
	return {
		verts: [
			{ e: e0, n: n0, h: h0 },
			{ e: e1, n: n0, h: h0 },
			{ e: e1, n: n1, h: h0 },
			{ e: e0, n: n1, h: h0 },
			{ e: e0, n: nm, h: h1 },
			{ e: e1, n: nm, h: h1 },
		],
		faces: [
			[0, 3, 2, 1], // underside
			[0, 1, 5, 4], // near slope
			[2, 3, 4, 5], // far slope
			[3, 0, 4], // pediment, west
			[1, 2, 5], // pediment, east
		],
	};
}

/** Rotate a solid about the east axis and set it down somewhere.
 *
 *  A rigid rotation is an affine map with positive determinant, so it carries
 *  planarity, convexity AND winding through untouched — which is why the one
 *  oblique element in this quarter is built flat and then tipped, rather than
 *  written out tilted by hand. Hand-written oblique vertices are where
 *  inside-out faces come from. */
export function tiltE(s: Solid, deg: number, dn = 0, dh = 0): Solid {
	const t = (deg * Math.PI) / 180;
	const c = Math.cos(t);
	const si = Math.sin(t);
	return {
		verts: s.verts.map((v) => ({
			e: v.e,
			n: v.n * c - v.h * si + dn,
			h: v.n * si + v.h * c + dh,
		})),
		faces: s.faces.map((f) => [...f]),
	};
}

// ── The buildings ───────────────────────────────────────────────────────────
// Heights follow the reasoning in `pieces.ts`: a piece is only seen at a slant,
// so the band of side it shows is its height times the sine of that slant, and
// under about 1.4 radii tall two different silhouettes converge into one lump.
// Six of these sit between 1.66 and 1.94. The seventh is short on purpose.

/** The flat side an octagon should present to the viewer. Shared so the drum,
 *  its mount and its dish are all the same polygon at three sizes — the
 *  cheapest possible way to make three parts look like one machine. */
const OCT = Math.PI / 8;

/** OBSERVATORY — watches the outside world.
 *
 *  A drum with a dish tipped off it. The whole silhouette is bought by one
 *  decision: the dish is a big OBLIQUE plane and nothing else in the settlement
 *  has one. Every other roof here is level or symmetric about its ridge, so a
 *  single slab leaning at 46° is unmistakable even as a black shape at a slant —
 *  and it is the only part whose outline changes as the globe turns, which is
 *  precisely the right behaviour for the building whose job is looking outward.
 *
 *  The dish is also deliberately WIDER than the mount it sits on. An instrument
 *  that overhangs its own support reads as aimed; one that sits inside its
 *  footprint reads as a chimney pot. */
const OBSERVATORY: Piece = [
	prism(ngon(0.82, 8, OCT), 0, 0.16),
	// Lean-to on the west flank. Pure asymmetry: a perfectly radial building
	// looks the same from every direction and therefore looks like a graphic
	// rather than a place. One low box fixes that for one part.
	box(-0.74, -0.34, -0.28, 0.28, 0.16, 0.54),
	// The drum battered in from 0.62 to 0.46 over its height. Slight — enough
	// that the two vertical edges of the silhouette are not parallel, which is
	// most of what separates a masonry drum from a can.
	taper(ngon(0.62, 8, OCT), 0.16, 0.92, 0.742),
	// The mount: a narrow neck, and tall enough that the dish is clearly CARRIED.
	// Shortened, the dish sits on the drum and the whole thing becomes a hat.
	prism(ngon(0.24, 8, OCT), 0.92, 1.46),
	// Built flat about the origin, then tipped so its far rim rises and its near
	// rim drops. Thin — 0.09 of a radius — because a dish that reads as a slab
	// reads as a wall; the point is that it is a surface with an attitude.
	tiltE(prism(ngon(0.52, 8, OCT), -0.045, 0.045), 46, -0.04, 1.5),
];

/** COURT — deliberates and returns a verdict.
 *
 *  The only building in the quarter that is wider than it is tall, and the only
 *  one whose roof shows the viewer a triangle. Everything about it is
 *  approach-and-judgement: two courses of steps before you reach the floor, a
 *  cross-gabled porch pushed out toward you, and a pediment spanning the whole
 *  front.
 *
 *  The spire matters more than it looks. A tiered hall with a level ridge is a
 *  market; the same hall with one thing rising off the centre of that ridge is
 *  an institution — a verdict has to leave the building, and the spire is the
 *  part that says so. */
const COURT: Piece = [
	box(-0.94, 0.94, -0.66, 0.66, 0, 0.16),
	// A second course rather than one thick plinth. Two shallow steps catch two
	// different shading bands and read as a stair; one deep step reads as a kerb.
	box(-0.84, 0.84, -0.56, 0.56, 0.16, 0.34),
	box(-0.7, 0.7, -0.44, 0.44, 0.34, 0.98),
	// Ridge running east, so the near face of the roof is the pediment.
	ridgeE(-0.8, 0.8, -0.54, 0.54, 0.98, 1.44),
	box(-0.34, 0.34, -0.62, -0.3, 0.34, 0.74),
	// The porch roof runs NORTH — across the main ridge, not along it. Its ridge
	// tops out below the main slope it dies into, which is the one detail that
	// makes two roofs read as one building instead of two collided boxes.
	gable(0.42, -0.66, -0.3, 0.74, 1.08),
	// Rooted below the ridge line so it emerges THROUGH the roof. A spire that
	// starts at the ridge looks balanced on it.
	taper(rect(-0.17, 0.17, -0.17, 0.17), 1.16, 1.88, 0.55),
];

/** FORUM — text exchange across the mesh.
 *
 *  Two masses and a span, and the load-bearing element is the GAP. Every other
 *  piece here is solid from the ground up; this one has daylight through the
 *  middle of it, and a hole in a silhouette survives scale, blur and glow better
 *  than any amount of surface incident. Read as a black shape it is the only
 *  one of the seven that is not simply connected.
 *
 *  The two ends are deliberately unequal — different heights, different caps. An
 *  exchange has two parties and they are never symmetric; a mirrored pair would
 *  read as a monument to itself. */
const FORUM: Piece = [
	box(-0.94, 0.94, -0.48, 0.48, 0, 0.16),
	box(-0.88, -0.34, -0.42, 0.42, 0.16, 1.18),
	box(0.34, 0.88, -0.42, 0.42, 0.16, 1.02),
	// The span sits at two thirds height, which leaves a void 0.68 wide and 0.60
	// tall — about six pixels square at node size, and six pixels of background
	// is the smallest hole that still reads as a hole rather than as grime.
	// It runs into both towers rather than butting them, so it is a bridge and
	// not a shelf.
	box(-0.46, 0.46, -0.26, 0.26, 0.76, 0.96),
	pyramid(rect(-0.94, -0.28, -0.48, 0.48), 1.18, 1.58, -0.61, 0),
	// The shorter tower answers with a mast instead of a hip. Between the two
	// caps the top edge goes: slope, gap, needle. That profile is the piece.
	box(0.52, 0.7, -0.1, 0.1, 1.02, 1.8),
];

/** BEACON — claims a job and throws it outbound.
 *
 *  The tallest and narrowest thing in the settlement. Where the court spreads,
 *  this stacks: a battered shaft, a gallery that steps back OUT over it, a
 *  slimmer stage above, a hipped cap.
 *
 *  Two features carry it. The corbelled gallery — a mass that widens partway up
 *  — puts a hard notch in an otherwise smooth taper, and a notch is the cheapest
 *  legible event on a vertical. And the arm: a single horizontal thrown east,
 *  clear of the plinth's shadow, pointing at nothing on the tower. A tower with
 *  an arm is not watching, it is transmitting, and the direction is the whole
 *  difference between this and the observatory. */
const BEACON: Piece = [
	box(-0.56, 0.56, -0.56, 0.56, 0, 0.16),
	// Batters to just over half its base width across nine tenths of a radius.
	// Steeper and it reads as a spike; straighter and it reads as a post.
	taper(rect(-0.48, 0.48, -0.48, 0.48), 0.16, 1.06, 0.54),
	box(-0.42, 0.42, -0.42, 0.42, 1.06, 1.26),
	// Reaches almost to the edge of the plot — the throw has to clear the
	// building's own outline or it disappears into it.
	box(0.3, 0.94, -0.11, 0.11, 1.12, 1.3),
	box(-0.21, 0.21, -0.21, 0.21, 1.26, 1.62),
	// The cap oversails its stage slightly, the same courtesy the plinth pays the
	// ground. Top and bottom of the tower agree; the middle is where it argues.
	pyramid(rect(-0.25, 0.25, -0.25, 0.25), 1.62, 1.94),
];

/** MILL — a stream arrives and comes out processed.
 *
 *  A cascade. Three decks stepping down west to east, each drop about a third of
 *  a radius, finished with a shed slope running the last stage into the ground.
 *  Read as a black shape it is a staircase, and a staircase is direction: the
 *  eye enters at the tall end and leaves at the low one, which is the whole
 *  claim the building is making about what happens inside it.
 *
 *  The hopper is the loudest single gesture in the quarter and it is spent
 *  deliberately: it is the ONLY mass here that grows as it rises. Everything
 *  else in the settlement batters inward, so an inverted taper reads instantly
 *  as a mouth — something built to catch what is coming rather than to stand
 *  against it. */
const MILL: Piece = (() => {
	const deck = 0.14;
	const dn = 0.4;
	return [
		box(-0.92, 0.92, -0.46, 0.46, 0, deck),
		box(-0.88, -0.3, -dn, dn, deck, 1.16),
		box(-0.3, 0.24, -dn, dn, deck, 0.84),
		box(0.24, 0.88, -dn, dn, deck, 0.54),
		// The race: vertical face west, sloping away east. Flush against the
		// middle block's east wall, so the roof reads as one surface running down
		// out of the building rather than as a wedge parked beside it.
		tooth(0.24, 0.88, -dn, dn, 0.54, 0.84),
		// Flares to nearly twice its throat. Set over the tall deck, because a
		// hopper feeds downward and one at the low end would be running uphill.
		taper(rect(-0.77, -0.41, -0.18, 0.18), 1.16, 1.6, 1.85),
		// The exhaust, at the far end from the intake and off the centre line —
		// the same off-axis instinct the factory's chimney has, and for the same
		// reason: a stack belongs to the process, not to the elevation.
		box(0.54, 0.72, -0.14, 0.06, 0.54, 1.66),
	];
})();

/** MARK — finds and names who you deal with.
 *
 *  A survey station: splayed base, pinched waist, flared head, one long
 *  sightline across it. The plan is a TRIANGLE, alone in the settlement, and
 *  that is doing real work — three walls means the shading engine has three
 *  planes to give three different values to, and a three-sided drum never
 *  presents the flat symmetric face that makes a round tower look inert.
 *
 *  The waist is the silhouette. Everything else here is widest at the bottom;
 *  this one goes wide, narrow, wide again, and an hourglass outline is
 *  identifiable at a size where its details have long since dissolved. The arm
 *  across the head is a sightline, not a transmitter — it lies flat across the
 *  building rather than reaching out of one side of it. */
const MARK: Piece = (() => {
	/** Apex north, so the plan's flat side faces the viewer at rest and its point
	 *  runs away — the orientation a triangulation mark is actually set in. */
	const tri = (r: number) => ngon(r, 3, Math.PI / 2);
	return [
		prism(tri(0.86), 0, 0.16),
		// Batters hard — to under half — over less than three quarters of a
		// radius. That is a steeper lean than the beacon's, and it should be: this
		// is a base built to be immovable, not a shaft built to be tall.
		taper(tri(0.74), 0.16, 0.88, 0.46),
		prism(tri(0.32), 0.88, 1.3),
		// Corbels back out to twice the waist. The head has to be visibly heavier
		// than what carries it or the waist reads as damage rather than design.
		taper(tri(0.3), 1.3, 1.58, 2.15),
		box(-0.92, 0.92, -0.1, 0.1, 1.42, 1.58),
		pyramid(tri(0.24), 1.58, 1.94),
	];
})();

/** HUT — the first thing anyone runs.
 *
 *  Deliberately the smallest and plainest structure in the settlement: half the
 *  footprint of its neighbours and barely two thirds their height. It breaks the
 *  1.4-radii legibility rule on purpose, because next to six tall buildings the
 *  thing that reads is not its own silhouette but the SCALE GAP — a viewer does
 *  not need to identify it, only to notice it is the small one.
 *
 *  It still keeps the settlement's grammar — plinth course, oversailing hipped
 *  cap, one flue breaking the top edge — so it reads as the first building of
 *  this civilisation rather than as a leftover block. Everything else here is
 *  this, elaborated. */
const HUT: Piece = [
	box(-0.46, 0.46, -0.42, 0.42, 0, 0.12),
	box(-0.36, 0.36, -0.32, 0.32, 0.12, 0.58),
	// The cap oversails the walls on all four sides, which is what makes two
	// small boxes read as roof-on-house instead of one stepped stub.
	pyramid(rect(-0.46, 0.46, -0.4, 0.4), 0.58, 1.02),
	// The one piece of ambition it has. Thin, but not thinner than 0.15 of a
	// radius — below that a part stops being a line and becomes a smudge.
	box(0.15, 0.3, -0.09, 0.06, 0.7, 1.18),
];

/** PAVILION — the browser agent. A WASM agent hosted by somebody else's page.
 *
 *  Every other building in the settlement is a MASS: something with walls, that
 *  the org owns, that stays put. This mode is none of those things — it runs
 *  inside a page it does not control and it is gone when the tab closes. So the
 *  building is the one thing here that is mostly NOT there: a floor, four posts,
 *  a deck, and daylight through the middle.
 *
 *  That void is doing the real work. At 40 pixels every other silhouette is a
 *  solid block of ink, and this one reads as a frame — the difference survives
 *  the zoom the quarter's whole rule set is written around, which no amount of
 *  detail in a filled outline would.
 *
 *  It keeps the three habits: a plinth course, a flat deck (one of the three
 *  permitted roofs), and exactly one thing breaking the top edge. */
const PAVILION: Piece = (() => {
	const floor = 0.15;
	const eaves = 0.95;
	const deck = 1.12;
	// Slender, but not below the 0.15-of-a-radius floor the hut's mast sets —
	// under that a part stops being a post and becomes a smudge. Set in from the
	// plinth edge so the deck above oversails BOTH the posts and the plinth,
	// which is what stops the four legs reading as a solid wall in profile.
	const p = 0.11;
	const o = 0.3;
	const post = (e: number, n: number) => box(e - p, e + p, n - p, n + p, floor, eaves);
	return [
		box(-0.5, 0.5, -0.5, 0.5, 0, floor),
		post(-o, -o),
		post(o, -o),
		post(o, o),
		post(-o, o),
		box(-0.52, 0.52, -0.52, 0.52, eaves, deck),
		// The one top incident: a thin mast, off-centre so the piece has a front.
		box(0.12, 0.26, -0.07, 0.07, deck, 1.74),
	];
})();

/** Every piece this quarter offers, by shape name. */
export const CIVIC_PIECES: Record<string, Piece> = {
	observatory: OBSERVATORY,
	court: COURT,
	forum: FORUM,
	beacon: BEACON,
	mill: MILL,
	mark: MARK,
	hut: HUT,
	pavilion: PAVILION,
};

/** Which structure each agent mode stands as.
 *
 *  Keyed by mode, not by shape, because the mapping is an editorial judgement
 *  and is expected to move: a mode is a job, a piece is a building, and the
 *  claim that THIS building does THAT job is the part worth being able to change
 *  without touching any geometry. */
// `satisfies` rather than an annotation, for the reason WORKS_MODE_PIECES gives:
// an index signature hides which keys this half contributes, and the merged map
// downstream needs to count them to prove it covers every mode.
export const CIVIC_MODE_PIECES = {
	intelligence: 'observatory',
	language: 'court',
	harness: 'forum',
	momus: 'beacon',
	hello_world: 'hut',
	browser: 'pavilion',
	// A mill takes material in from outside and hands back something usable,
	// which is the whole job of the fetch mode.
	fetch: 'mill',
} satisfies Partial<Record<ModeKey, string>>;

export type CivicPieceId = keyof typeof CIVIC_PIECES;
