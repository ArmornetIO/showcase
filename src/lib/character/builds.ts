// ── agent-select · the figure ────────────────────────────────────────────────
// The character standing on the stage, built out of the SAME primitives the
// breach board and the mesh globe stand on: `octagon` / `prism` from
// `mesh-studio/pieces`, wound counter-clockwise seen from outside, in the
// node's own east/north/height frame. No second geometry kernel — a figure
// drawn in its own private projection is a sticker, and the eye reads that
// instantly however good the art is.
//
// Three rules from `examples/breach/character.ts` carry the whole look:
//   1. THE HEAD IS TOO BIG — two fifths of the height, wider than the shoulders.
//   2. NOTHING HAS A CORNER — every mass is an octagonal prism, never a box.
//   3. ONE BRIGHT FACE — a visor band proud of the head, the only feature.

import { octagon, prism, type Solid } from '../mesh-studio/pieces/pieces.js';
import type { Shape } from './characters.js';

export interface Build {
	/** Half-width of the head. The headline number — this is what "cute" is. */
	head: number;
	headD: number;
	/** Half-width of the torso at the shoulders. */
	chest: number;
	chestD: number;
	/** How far the arms hang from the body. */
	reach: number;
	/** Legs, or nothing at all — a drone hovers. */
	legs: boolean;
	/** Total height, so a squad of mixed roles lines up on one horizon. */
	tall: number;
}

/** The knobs a role may turn, straight off `character.ts`. Everything else is
 *  shared on purpose: a role that can change anything produces four unrelated
 *  characters instead of four of one thing. */
export const BUILDS: Record<Shape, Build> = {
	runner: { head: 0.4, headD: 0.34, chest: 0.29, chestD: 0.21, reach: 0.09, legs: true, tall: 1.62 },
	brute: { head: 0.46, headD: 0.4, chest: 0.42, chestD: 0.28, reach: 0.14, legs: true, tall: 1.52 },
	drone: { head: 0.34, headD: 0.32, chest: 0.22, chestD: 0.2, reach: 0.06, legs: false, tall: 1.44 },
	ghost: { head: 0.36, headD: 0.32, chest: 0.24, chestD: 0.19, reach: 0.07, legs: true, tall: 1.66 }
};

/** Three materials, and the reason the roster reads as a roster.
 *
 *  A figure painted entirely in its character's colour is a solid lump of that
 *  colour: nothing on it is emphasised, because everything is. So the SUIT is
 *  one dark grey shared by all four and the colour is spent only on PLATE —
 *  boots, chest, pauldrons, hood — and on the LAMP. Four silhouettes in one
 *  suit with four trims read as a squad; four solid colours read as four toys
 *  out of different boxes. */
export type Material = 'suit' | 'plate' | 'lamp';

/** Which swinging thing a part belongs to. Untagged parts are the body: they
 *  ride the pose's vertical offset and never rotate. Four tags is the whole
 *  skeleton, which is all a figure with no elbows or knees can use. */
export type Limb = 'legL' | 'legR' | 'armL' | 'armR';

export interface Part {
	solid: Solid;
	/** Albedo within the material — a knee is darker than a shoulder. */
	tint: number;
	mat: Material;
	limb?: Limb;
	/** Height the limb swings about — the hip, or the shoulder. */
	pivot?: number;
	/**
	 * Ride the limb's arc without turning with it.
	 *
	 * For feet. A boot rigidly welded to a rotating leg tips onto its edge at
	 * the extremes of a stride, shows its underside, and dips through the floor
	 * — because the figure has no ankle to keep it level. Orbiting the mass and
	 * leaving its orientation alone is what an ankle would have done.
	 */
	rigid?: boolean;
}

/** Move a built solid rather than its footprint, so a limb stays a single
 *  expression: `lump(...)` put somewhere, not a bespoke outline with an offset
 *  baked through it. */
const at = (s: Solid, e: number, n = 0): Solid => ({
	faces: s.faces,
	verts: s.verts.map((v) => ({ e: v.e + e, n: v.n + n, h: v.h }))
});

/** A rounded mass: an octagonal prism, which is the only shape in here. */
const lump = (w: number, d: number, h0: number, h1: number, cut = 0.34): Solid =>
	prism(octagon(w, d, cut), h0, h1);

/** One character, assembled. Every role is this function with a build. */
export function figure(shape: Shape): Part[] {
	const b = BUILDS[shape];
	const T = b.tall;
	const parts: Part[] = [];
	/** Head half-width, floored so it always out-measures the shoulders. A head
	 *  the torso beats is not a small head — it is a small character wearing a
	 *  big body, and the brute is the build that exposes it. */
	const hw = Math.max(b.head * 0.88, b.chest * 1.12);
	const hd = b.headD * 0.94;

	const add = (
		solid: Solid,
		tint: number,
		mat: Material,
		limb?: Limb,
		pivot?: number,
		rigid?: boolean
	) => parts.push({ solid, tint, mat, limb, pivot, rigid });

	if (b.legs) {
		// Stood apart, not welded together. Two masses with daylight between them
		// read as legs; two masses touching read as a plinth.
		const lw = b.chest * 0.34;
		const le = b.chest * 0.58;
		// The hip: where the leg stops, so a swing pivots at the top of the mass
		// rather than through its middle and the foot travels the way a foot does.
		const hip = 0.31 * T;
		for (const [limb, s] of [['legL', -le], ['legR', le]] as const) {
			add(at(lump(lw, b.chestD * 0.75, 0, hip), s), 0.8, 'suit', limb, hip);
			// Boots — a coloured band at the floor stops the legs bleeding into the
			// ground shadow, which is what makes a figure look STOOD ON something.
			add(at(lump(lw * 1.3, b.chestD * 1.05, 0, 0.09 * T), s), 0.9, 'plate', limb, hip, true);
		}
	} else {
		// A bell that TAPERS and stops short of the floor. Widening toward the
		// ground makes a plinth, and a plinth is the one silhouette that cannot
		// float — the shape has to shed mass on the way down.
		add(lump(b.chest * 1.06, b.chestD * 1.02, 0.3 * T, 0.42 * T, 0.42), 0.85, 'suit');
		add(lump(b.chest * 0.62, b.chestD * 0.6, 0.22 * T, 0.3 * T, 0.42), 0.66, 'suit');
		add(lump(b.chest * 0.42, b.chestD * 0.4, 0.17 * T, 0.22 * T, 0.42), 0.5, 'plate');
		// The thing it hovers ON, with daylight between it and the body. A lit pad
		// touching the hull is a foot; a lit pad with a gap is thrust.
		add(lump(b.chest * 0.74, b.chestD * 0.74, 0.075 * T, 0.125 * T, 0.5), 1, 'lamp');
	}

	add(lump(b.chest, b.chestD, 0.27 * T, 0.58 * T), 1, 'suit');
	// The one flat highlight on the body, so the eye has somewhere to land
	// between the boots and the visor.
	add(lump(b.chest * 0.66, b.chestD * 1.14, 0.4 * T, 0.55 * T, 0.5), 1, 'plate');

	const aw = Math.max(b.chest * 0.2, 0.05);
	// Hung off the body, but never so far that the shoulders out-measure the
	// head — and never so close that they vanish into the torso. Every build
	// wants a different one of those two limits, so take both.
	const ae = Math.min(
		b.chest + Math.max(b.reach * 0.6, 0.06),
		Math.max(hw * 1.02 - aw, b.chest + aw * 0.6)
	);
	// A brute's shoulder plate sits ON TOP of where the arm stops rather than
	// beside it: two masses at the same height and the same depth have no honest
	// paint order between them, and the eye reads the flicker as a detached
	// block floating next to the body.
	const aTop = (shape === 'brute' ? 0.5 : 0.555) * T;
	for (const [limb, s] of [['armL', -ae], ['armR', ae]] as const)
		add(at(lump(aw, b.chestD * 0.5, 0.28 * T, aTop), s), 0.86, 'suit', limb, aTop);

	if (shape === 'brute') {
		// A heavy character is not a big character — it is a character whose
		// weight is nearer the ground, so mass goes on the shoulders.
		const pw = b.chest * 0.38;
		const pe = b.chest * 0.94;
		for (const s of [-pe, pe])
			add(at(lump(pw, b.chestD * 0.85, 0.5 * T, 0.62 * T, 0.45), s), 0.95, 'plate');
	}

	add(lump(b.chest * 0.34, b.chestD * 0.5, 0.55 * T, 0.62 * T), 0.5, 'suit');

	if (shape === 'ghost') {
		// A hood is OPEN AT THE FRONT. Built as a full prism around the head it is
		// just a bigger head in another colour drawn over the face, so it is
		// pushed back behind the visor's rear edge and only wraps the skull from
		// the sides and behind.
		add(at(lump(hw * 1.16, b.headD * 0.72, 0.54 * T, 0.97 * T, 0.3), 0, b.headD * 0.42), 0.72, 'plate');
	}

	add(lump(hw, hd, 0.58 * T, T, 0.32), 1.05, 'suit');

	// One bright face: a band across the front third, proud of the head at the
	// front and sunk into it at the back, so it stays a plane in three quarter
	// view instead of vanishing the moment the character turns.
	const vw = hw * 0.88;
	const ce = vw * 0.36;
	const front = -hd - 0.035;
	const back = -hd * 0.4;
	add(
		prism(
			[
				[-vw + ce, front],
				[vw - ce, front],
				[vw, front + hd * 0.3],
				[vw * 0.9, back],
				[-vw * 0.9, back],
				[-vw, front + hd * 0.3]
			],
			0.74 * T,
			0.855 * T
		),
		1,
		'lamp'
	);

	return parts;
}
