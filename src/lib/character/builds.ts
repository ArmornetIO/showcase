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
//
// This file is the BODY only. What the body wears is `wearables.ts`, which
// assembles the two — so nothing here has to know that hats exist, and a new
// hat is never a new branch in the figure assembler.

import { prism, type Solid } from '../mesh-studio/pieces/pieces.js';
import { at, lump } from './solids.js';
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

/** Four materials, and the reason the roster reads as a roster.
 *
 *  A figure painted entirely in its character's colour is a solid lump of that
 *  colour: nothing on it is emphasised, because everything is. So the SUIT is
 *  one dark grey shared by all four and the colour is spent only on PLATE —
 *  boots, chest, pauldrons, hood — and on the LAMP. Four silhouettes in one
 *  suit with four trims read as a squad; four solid colours read as four toys
 *  out of different boxes.
 *
 *  TRIM is the fourth and it is not the body's: it is the hue the PLAYER owns,
 *  spent on what they put on. Keeping it apart from `plate` is the whole reason
 *  a bought hat can fly the account's colour while the shoulders underneath it
 *  stay the class's — one material for "who I am on the roster", another for
 *  "whose side I am on today". */
export type Material = 'suit' | 'plate' | 'lamp' | 'trim';

/** Which swinging thing a part belongs to. Untagged parts are the body: they
 *  ride the pose's vertical offset and never rotate. Four tags is the whole
 *  skeleton, which is all a figure with no elbows or knees can use. */
export type Limb = 'legL' | 'legR' | 'armL' | 'armR';

/**
 * Which mass of the body a part IS.
 *
 * Two jobs, and it grew the second one. Originally this named only the masses a
 * worn item might have to displace (a helmet and the ghost's hood want the same
 * volume, and two solids in one place have no honest paint order between them).
 * Now it also names every mass you can PAINT — so the list is exhaustive rather
 * than "the ones something can collide with", because a body part with no tag
 * is a body part nobody can colour.
 */
export type BodyTag =
	| 'leg'
	| 'boot'
	| 'bell'
	| 'pad'
	| 'torso'
	| 'chest'
	| 'arm'
	| 'pauldron'
	| 'neck'
	| 'hood'
	| 'head'
	| 'visor';

/** The paintable masses, in the order a person reads a body: ground up. Drives
 *  the customisation panel, so a mass added to `figure()` without a tag simply
 *  cannot be coloured — which is the failure this list exists to make loud. */
export const BODY_PARTS: { tag: BodyTag; label: string; mat: Material }[] = [
	{ tag: 'boot', label: 'Boots', mat: 'plate' },
	{ tag: 'leg', label: 'Legs', mat: 'suit' },
	{ tag: 'pad', label: 'Thrust pad', mat: 'lamp' },
	{ tag: 'bell', label: 'Hover bell', mat: 'suit' },
	{ tag: 'torso', label: 'Torso', mat: 'suit' },
	{ tag: 'chest', label: 'Chest plate', mat: 'plate' },
	{ tag: 'arm', label: 'Arms', mat: 'suit' },
	{ tag: 'pauldron', label: 'Pauldrons', mat: 'plate' },
	{ tag: 'neck', label: 'Neck', mat: 'suit' },
	{ tag: 'hood', label: 'Hood', mat: 'plate' },
	{ tag: 'head', label: 'Head', mat: 'suit' },
	{ tag: 'visor', label: 'Visor', mat: 'lamp' }
];

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
	/** What this mass IS — for displacement, and for paint. */
	tag?: BodyTag;
	/**
	 * The worn item this part belongs to, if it is not body.
	 *
	 * What lets a single hat be painted without repainting every other worn
	 * thing. `mat` says which colour a part falls back to; this says which
	 * colour is ITS OWN, and the renderer prefers the more specific one.
	 */
	owner?: string;
}

/**
 * Where things hang off a build.
 *
 * The seam that lets one authored hat fit four bodies. Every number a worn item
 * could want is derived HERE, from the same expressions `figure()` builds the
 * body with — so a head that moves moves what is on it, and an item never
 * carries a constant of its own. The two hand-tuned numbers this replaced
 * (`HEAD_W = 0.52`, `HEAD_Y = 0.50`, eyeballed against one build in the old
 * overlay) are the failure this shape exists to prevent: they were right for
 * the runner and wrong for the other three, and there was no way to tell from
 * reading them which.
 */
export interface Anchors {
	/** Total height. Everything else is in the same units. */
	tall: number;
	/** The skull, as built: half-width, half-depth, and the heights it spans. */
	headW: number;
	headD: number;
	/** Top of the skull — where a hat sits. */
	crown: number;
	/** Underside of the skull, where it meets the neck. */
	jaw: number;
	/** Middle of the visor band, and how far proud of the skull its face stands.
	 *  What anything worn across the eyes has to clear. */
	brow: number;
	browFront: number;
	/** The torso. */
	chestW: number;
	chestD: number;
	/** Top of the torso — the shoulder line, and what a cape or a pauldron
	 *  hangs from. */
	shoulder: number;
	/** Where an arm hangs: its centre east of the middle, its half-width, and
	 *  the heights it spans. A held object goes at `hand`. */
	armE: number;
	armW: number;
	armTop: number;
	hand: number;
	/** The chest plate's front face, and the height of its middle — where a
	 *  badge or a device is mounted. */
	plateH: number;
	plateN: number;
	/** Height a leg swings about. */
	hip: number;
	/** False for a build that hovers — a boot has nothing to go on. */
	legs: boolean;
}

/** Everything a worn item is allowed to know about the body wearing it. */
export function measure(shape: Shape): Anchors {
	const b = BUILDS[shape];
	const T = b.tall;
	const headW = Math.max(b.head * 0.88, b.chest * 1.12);
	const headD = b.headD * 0.94;
	const armW = Math.max(b.chest * 0.2, 0.05);
	const armTop = (shape === 'brute' ? 0.5 : 0.555) * T;
	return {
		tall: T,
		headW,
		headD,
		crown: T,
		jaw: 0.58 * T,
		// The visor spans 0.74–0.855; a brow band is its middle.
		brow: 0.7975 * T,
		browFront: -headD - 0.035,
		chestW: b.chest,
		chestD: b.chestD,
		shoulder: 0.58 * T,
		armE: Math.min(
			b.chest + Math.max(b.reach * 0.6, 0.06),
			Math.max(headW * 1.02 - armW, b.chest + armW * 0.6)
		),
		armW,
		armTop,
		hand: 0.28 * T,
		// The chest highlight spans 0.40–0.55 and stands `chestD * 1.14` proud.
		plateH: 0.475 * T,
		plateN: -b.chestD * 1.14,
		hip: 0.31 * T,
		legs: b.legs
	};
}

/** One character's BODY, assembled. Every role is this function with a build.
 *  What it wears is added by `assemble()` in `wearables.ts`. */
export function figure(shape: Shape): Part[] {
	const b = BUILDS[shape];
	const a = measure(shape);
	const T = a.tall;
	const parts: Part[] = [];
	const hw = a.headW;
	const hd = a.headD;

	const add = (solid: Solid, tint: number, mat: Material, tag: BodyTag, rest: Partial<Part> = {}) =>
		parts.push({ solid, tint, mat, tag, ...rest });

	if (b.legs) {
		// Stood apart, not welded together. Two masses with daylight between them
		// read as legs; two masses touching read as a plinth.
		const lw = b.chest * 0.34;
		const le = b.chest * 0.58;
		// The hip: where the leg stops, so a swing pivots at the top of the mass
		// rather than through its middle and the foot travels the way a foot does.
		const hip = a.hip;
		for (const [limb, s] of [['legL', -le], ['legR', le]] as const) {
			add(at(lump(lw, b.chestD * 0.75, 0, hip), s), 0.8, 'suit', 'leg', { limb, pivot: hip });
			// Boots — a coloured band at the floor stops the legs bleeding into the
			// ground shadow, which is what makes a figure look STOOD ON something.
			add(at(lump(lw * 1.3, b.chestD * 1.05, 0, 0.09 * T), s), 0.9, 'plate', 'boot', {
				limb,
				pivot: hip,
				rigid: true
			});
		}
	} else {
		// A bell that TAPERS and stops short of the floor. Widening toward the
		// ground makes a plinth, and a plinth is the one silhouette that cannot
		// float — the shape has to shed mass on the way down.
		add(lump(b.chest * 1.06, b.chestD * 1.02, 0.3 * T, 0.42 * T, 0.42), 0.85, 'suit', 'bell');
		add(lump(b.chest * 0.62, b.chestD * 0.6, 0.22 * T, 0.3 * T, 0.42), 0.66, 'suit', 'bell');
		add(lump(b.chest * 0.42, b.chestD * 0.4, 0.17 * T, 0.22 * T, 0.42), 0.5, 'plate', 'bell');
		// The thing it hovers ON, with daylight between it and the body. A lit pad
		// touching the hull is a foot; a lit pad with a gap is thrust.
		add(lump(b.chest * 0.74, b.chestD * 0.74, 0.075 * T, 0.125 * T, 0.5), 1, 'lamp', 'pad');
	}

	add(lump(b.chest, b.chestD, 0.27 * T, a.shoulder), 1, 'suit', 'torso');
	// The one flat highlight on the body, so the eye has somewhere to land
	// between the boots and the visor.
	add(lump(b.chest * 0.66, b.chestD * 1.14, 0.4 * T, 0.55 * T, 0.5), 1, 'plate', 'chest');

	// Hung off the body, but never so far that the shoulders out-measure the
	// head — and never so close that they vanish into the torso. Every build
	// wants a different one of those two limits, so `measure` takes both.
	for (const [limb, s] of [['armL', -a.armE], ['armR', a.armE]] as const)
		add(at(lump(a.armW, b.chestD * 0.5, a.hand, a.armTop), s), 0.86, 'suit', 'arm', {
			limb,
			pivot: a.armTop
		});

	if (shape === 'brute') {
		// A heavy character is not a big character — it is a character whose
		// weight is nearer the ground, so mass goes on the shoulders.
		const pw = b.chest * 0.38;
		const pe = b.chest * 0.94;
		for (const s of [-pe, pe])
			add(at(lump(pw, b.chestD * 0.85, 0.5 * T, 0.62 * T, 0.45), s), 0.95, 'plate', 'pauldron');
	}

	add(lump(b.chest * 0.34, b.chestD * 0.5, 0.55 * T, 0.62 * T), 0.5, 'suit', 'neck');

	if (shape === 'ghost') {
		// A hood is OPEN AT THE FRONT. Built as a full prism around the head it is
		// just a bigger head in another colour drawn over the face, so it is
		// pushed back behind the visor's rear edge and only wraps the skull from
		// the sides and behind.
		add(
			at(lump(hw * 1.16, b.headD * 0.72, 0.54 * T, 0.97 * T, 0.3), 0, b.headD * 0.42),
			0.72,
			'plate',
			'hood'
		);
	}

	add(lump(hw, hd, a.jaw, T, 0.32), 1.05, 'suit', 'head');

	// One bright face: a band across the front third, proud of the head at the
	// front and sunk into it at the back, so it stays a plane in three quarter
	// view instead of vanishing the moment the character turns.
	const vw = hw * 0.88;
	const ce = vw * 0.36;
	const front = a.browFront;
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
		'lamp',
		'visor'
	);

	return parts;
}
