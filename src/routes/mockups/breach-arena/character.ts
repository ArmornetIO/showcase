// ── /mockups/breach-map · the operators ──────────────────────────────────────
// The first character pass. Everything standing on this board so far has been a
// BUILDING — a Monopoly piece with a roof — and the four unit silhouettes have
// been flat polygons. This is the same vocabulary turned on a person: convex
// solids in the node's own east/north/height frame, node radii, wound
// counter-clockwise seen from outside, drawn by the same `pieceFacets` the
// settlement is drawn by.
//
// That reuse is not tidiness. It is why a character standing at The Checkpoint
// is lit by the same key light as The Checkpoint, sits into the same ground,
// leans with the same tangent frame, and gets smaller round the limb like
// everything else. A figure drawn in its own private projection would be a
// sticker on the globe, and the eye reads that instantly however good the art is.
//
// ── The design ───────────────────────────────────────────────────────────────
// Cute is a proportion, not a decoration. Three rules carry the whole look and
// nothing else here matters much:
//
//   1. THE HEAD IS TOO BIG. Two fifths of the total height, wider than the
//      shoulders. This is the entire trick — every mascot ever drawn is a normal
//      body under a head that would not fit through a door.
//   2. NOTHING HAS A CORNER. Every mass is an octagonal prism rather than a box.
//      Eight sides costs four triangles and is the difference between carved and
//      moulded.
//   3. ONE BRIGHT FACE. A visor band across the front of the head, standing a
//      hair proud of it so it catches the light as its own plane. It is the only
//      feature, so it does all the work of saying which way the character is
//      looking — and a thing you can tell is looking at something is a thing you
//      read as alive.
//
// The four roles are the SAME character with the dial turned. A brute is the
// base build widened and squashed; a drone loses its legs and gains a skirt; a
// ghost narrows and grows a hood. Same head, same visor, same silhouette family
// — because they are meant to read as four of one thing, which is what makes a
// board of them look designed rather than collected.

import { box, octagon, pieceFacets, prism, type Facet, type Piece, type Solid } from '$lib/index.js';
import type { TangentFrame } from '$lib/physics/sphere.js';
import type { UnitShape } from './fx.js';

/** The knobs a role is allowed to turn. Everything else is shared, on purpose:
 *  a role that can change anything produces four unrelated characters. */
interface Build {
	/** Half-width of the head. The headline number — this is what "cute" is. */
	head: number;
	/** Half-depth of the head, front to back. */
	headD: number;
	/** Half-width of the torso at the shoulders. */
	chest: number;
	chestD: number;
	/** Where the torso stops and the neck starts. */
	waist: number;
	/** Legs, or nothing at all — a drone hovers. */
	legs: boolean;
	/** How far the arms hang from the body. */
	reach: number;
	/** Total height, so a squad of mixed roles still lines up on one horizon. */
	tall: number;
}

const BUILDS: Record<UnitShape, Build> = {
	// The baseline. Everything else is this with something pushed.
	runner: { head: 0.40, headD: 0.34, chest: 0.29, chestD: 0.21, waist: 0.86, legs: true, reach: 0.09, tall: 1.62 },
	// Wider than it is tall, and stood on shorter legs so the mass sits low. A
	// heavy character is not a big character — it is a character whose weight is
	// nearer the ground.
	brute: { head: 0.46, headD: 0.40, chest: 0.42, chestD: 0.28, waist: 0.74, legs: true, reach: 0.14, tall: 1.52 },
	// No legs. It ends in a skirt and floats, which is worth more than any amount
	// of detail for saying "this one is not a person".
	drone: { head: 0.34, headD: 0.32, chest: 0.22, chestD: 0.20, waist: 0.80, legs: false, reach: 0.06, tall: 1.44 },
	// Narrow, and hooded — the head runs down into the shoulders instead of
	// sitting on a neck, so there is no gap of light through the silhouette.
	ghost: { head: 0.36, headD: 0.32, chest: 0.24, chestD: 0.19, waist: 0.92, legs: true, reach: 0.07, tall: 1.66 },
};

/** A rounded mass: an octagonal prism, which is the only shape in here. */
const lump = (w: number, d: number, h0: number, h1: number, cut = 0.34): Solid =>
	prism(octagon(w, d, cut), h0, h1);

/** Move a solid sideways and forwards. Translating the built solid rather than
 *  the footprint keeps every part a single expression — a limb is `lump(...)`
 *  put somewhere, not a bespoke footprint with an offset baked through it. */
const at = (s: Solid, e: number, n: number): Solid => ({
	faces: s.faces,
	verts: s.verts.map((v) => ({ e: v.e + e, n: v.n + n, h: v.h })),
});

/**
 * A face.
 *
 * A slab across the FRONT of the head — front being −n, since `n` runs away from
 * the viewer at rest. It stands `0.03` proud of the head's own face, and it is
 * wrapped round the corners of the octagon so it is still visible in three
 * quarter view; a flat band on the front face alone vanishes the moment the
 * character turns, which is exactly when you most want to know where it is
 * looking.
 */
const visor = (b: Build, h0: number, h1: number): Solid => {
	const w = b.head * 0.9;
	const ce = w * 0.4;
	// Proud of the head at the front, sunk into it at the back — so the solid is
	// a genuine band around the front third rather than a slice through the whole
	// head. Getting this wrong is very hard to see and very obvious once seen: the
	// visor stays lit when the character has its back to you.
	const front = -b.headD - 0.03;
	const back = -b.headD * 0.45;
	const foot: [number, number][] = [
		[-w + ce, front],
		[w - ce, front],
		[w, front + b.headD * 0.28],
		[w * 0.86, back],
		[-w * 0.86, back],
		[-w, front + b.headD * 0.28],
	];
	return prism(foot, h0, h1);
};

/**
 * A character, split by how it is LIT rather than by what it is.
 *
 * `body` is the figure. `glow` is the handful of faces that are meant to read as
 * emitting — the visor, a sensor bead — and they are a separate piece because the
 * renderer sorts facets by depth and throws the solid they came from away. Two
 * pieces is the cheapest way to say "draw these ones bright" without teaching the
 * shared renderer about materials it does not otherwise need.
 *
 * And it is worth the split: the visor is the only feature on the whole model.
 * Unlit, all four roles are the same orange lump from the front.
 */
export interface CharacterModel {
	body: Piece;
	glow: Piece;
}

export function character(shape: UnitShape): CharacterModel {
	const b = BUILDS[shape];
	const t = b.tall;
	// Proportions are fractions of the total height, so changing `tall` moves the
	// whole figure rather than stretching its neck.
	const hipH = t * (b.legs ? 0.24 : 0.1);
	const chestTop = t * 0.53;
	const headBase = t * (shape === 'ghost' ? 0.5 : 0.57);
	const parts: Solid[] = [];

	if (b.legs) {
		// Feet and legs as one stubby mass each. Separate solids so the gap between
		// them survives at any zoom — one wide block would read as a plinth.
		for (const side of [-1, 1]) {
			const e = side * b.chest * 0.46;
			parts.push(at(lump(b.chest * 0.3, b.chestD * 0.62, 0, hipH, 0.4), e, 0));
			// A boot: fractionally wider and shorter than the leg, pushed forward.
			parts.push(
				at(lump(b.chest * 0.34, b.chestD * 0.78, 0, hipH * 0.42, 0.4), e, -b.chestD * 0.2),
			);
		}
	} else {
		// The hover skirt: a wide, shallow cone-ish stack. Two rings rather than a
		// taper, because at this poly count a real cone is eight long thin
		// triangles that alias into a smear.
		parts.push(lump(b.chest * 1.35, b.chestD * 1.35, hipH * 0.2, hipH * 0.75, 0.42));
		parts.push(lump(b.chest * 0.95, b.chestD * 0.95, hipH * 0.7, chestTop * 0.6, 0.4));
	}

	// Torso — the one mass that is deeper at the bottom than the top, which is
	// what stops a stack of prisms reading as a stack of prisms.
	parts.push(lump(b.chest * 0.86, b.chestD * 0.92, hipH * 0.9, chestTop * 0.62));
	parts.push(lump(b.chest, b.chestD, chestTop * 0.55, chestTop));

	// Arms, hanging. Short and set slightly forward, so they read from the front
	// rather than merging into the body's outline.
	for (const side of [-1, 1]) {
		const e = side * (b.chest + b.reach * 0.5);
		parts.push(
			at(
				lump(b.reach * 0.8, b.reach * 0.8, chestTop * 0.42, chestTop * 0.98, 0.4),
				e,
				-b.chestD * 0.12,
			),
		);
	}

	// Neck. A ghost has none — the hood runs straight into the shoulders.
	if (shape !== 'ghost') {
		parts.push(lump(b.chest * 0.4, b.chestD * 0.5, chestTop * 0.94, headBase + 0.02, 0.4));
	}

	// THE HEAD. Bigger than the shoulders, which is the whole design.
	parts.push(lump(b.head, b.headD, headBase, t * 0.94));
	// The crown: a shallow cap that takes the flatness off the top.
	parts.push(lump(b.head * 0.82, b.headD * 0.82, t * 0.92, t, 0.45));

	// Eye level, and no lower. A band across the middle of the head is a mouth
	// guard; the same band in the upper third is a pair of eyes, and that one
	// choice is most of whether the thing looks friendly.
	const glow: Solid[] = [
		visor(b, headBase + (t - headBase) * 0.38, headBase + (t - headBase) * 0.68),
	];

	// One accessory each, and one only. The role has to be legible in silhouette
	// at thirty pixels, and a second piece of kit costs more than it says.
	if (shape === 'runner') {
		// A fin, swept back — the only part of the design that suggests speed.
		parts.push(box(-0.03, 0.03, -0.02, b.headD * 1.5, t * 0.9, t * 1.16));
	} else if (shape === 'brute') {
		// Pauldrons. Weight on the shoulders, where weight reads.
		for (const side of [-1, 1]) {
			parts.push(
				at(
					lump(b.chest * 0.4, b.chestD * 1.05, chestTop * 0.82, chestTop * 1.12, 0.42),
					side * b.chest * 1.02,
					0,
				),
			);
		}
	} else if (shape === 'drone') {
		// A single mast with a bead on it. Nothing on a drone should look like it
		// was made for hands — and the bead is lit, so it reads as a sensor rather
		// than as a knob.
		parts.push(box(-0.025, 0.025, -0.025, 0.025, t * 0.98, t * 1.24));
		glow.push(lump(0.07, 0.07, t * 1.2, t * 1.34, 0.45));
	} else {
		// The hood: a wide shallow mass over the head and down the back, cut away at
		// the front so the visor still shows through it. That cutaway is the whole
		// difference between a hood and a bucket — and the reason it is built from a
		// half-octagon rather than a ring is that a ring is not convex, and convex
		// is what makes the cull exact.
		parts.push(
			prism(
				octagon(b.head * 1.16, b.headD * 1.24, 0.3).slice(3),
				headBase + (t - headBase) * 0.42,
				t * 1.02,
			),
		);
	}

	return { body: parts, glow };
}

/**
 * Turn a character on the spot until it is looking at you.
 *
 * A piece inherits its plot's frame, and a BUILDING should — a house faces
 * whichever way the ground it was built on faces, and that is most of what makes
 * a settlement look like it grew rather than like it was placed. A person is the
 * opposite: a character whose one feature is a face has to be pointing that face
 * somewhere on purpose, and on a marker the only defensible answer is at the
 * viewer.
 *
 * So the frame is spun about its own up-axis by the angle that swings the model's
 * front (−n) as far toward the eye as it can go. Solving rather than searching:
 * `n'.z = n.z·cosθ + e.z·sinθ` is a single sinusoid in θ, so its minimum is one
 * `atan2` away, and no pose on the globe has more than one answer.
 */
export function faceViewer(f: TangentFrame): TangentFrame {
	const th = Math.atan2(f.axis.e.z, f.axis.n.z) + Math.PI;
	const c = Math.cos(th);
	const s = Math.sin(th);
	const mix = <T extends { x: number; y: number }>(a: T, b: T, ka: number, kb: number) => ({
		x: a.x * ka + b.x * kb,
		y: a.y * ka + b.y * kb,
	});
	return {
		e: mix(f.e, f.n, c, -s),
		n: mix(f.n, f.e, c, s),
		u: f.u,
		axis: {
			e: {
				x: f.axis.e.x * c - f.axis.n.x * s,
				y: f.axis.e.y * c - f.axis.n.y * s,
				z: f.axis.e.z * c - f.axis.n.z * s,
			},
			n: {
				x: f.axis.n.x * c + f.axis.e.x * s,
				y: f.axis.n.y * c + f.axis.e.y * s,
				z: f.axis.n.z * c + f.axis.e.z * s,
			},
			u: f.axis.u,
		},
		grow: f.grow,
	};
}

/**
 * Every visible face of a character, body and lights TOGETHER, in draw order.
 *
 * This exists because the obvious thing is wrong. Rendering the body, then the
 * glow on top, looks right from the front and is broken from behind: culling is
 * per-solid and there is no z-buffer, so the only thing keeping a near face over
 * a far one is the depth sort — and two sorted lists drawn one after the other
 * are not one sorted list. The visor's REAR face is front-facing when you are
 * behind the character, and a second pass paints it straight over the back of
 * the head. You get a figure whose eyes glow through its own skull.
 *
 * So they are sorted as one list and told apart by a flag. `lit` is the whole
 * material system and it does not need to be any bigger than this.
 */
export function characterFacets(
	model: CharacterModel,
	frame: TangentFrame,
): Array<Facet & { lit: boolean }> {
	return [
		...pieceFacets(model.body, frame).map((f) => ({ ...f, lit: false })),
		...pieceFacets(model.glow, frame).map((f) => ({ ...f, lit: true })),
	].sort((a, b) => a.depth - b.depth);
}

/** Built once — a character is a constant, and rebuilding forty prisms a frame
 *  to draw the same four figures is the kind of thing that only shows up on the
 *  machine you are not testing on. */
export const CHARACTERS: Record<UnitShape, CharacterModel> = {
	runner: character('runner'),
	brute: character('brute'),
	drone: character('drone'),
	ghost: character('ghost'),
};

/** How tall each one stands, in node radii — for anything that has to place a
 *  label above a figure's head without projecting it first. */
export const CHARACTER_HEIGHT: Record<UnitShape, number> = {
	runner: BUILDS.runner.tall * 1.16,
	brute: BUILDS.brute.tall * 1.12,
	drone: BUILDS.drone.tall * 1.34,
	ghost: BUILDS.ghost.tall * 1.02,
};
