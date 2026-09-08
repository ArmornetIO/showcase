// ── character · what a figure WEARS ──────────────────────────────────────────
// Worn cosmetics as geometry, in the character's own east/north/height frame,
// contributed into the SAME part list the body is assembled into — so one cull,
// one shade and one painter's sort cover the figure and everything on it.
//
// WHAT THIS REPLACED, and why none of it could be patched. Headwear used to be
// flat SVG paths authored in a private `0 0 100 100` box, pasted over the
// rendered figure by a second `<svg>` and anchored by two eyeballed constants.
// Five things follow from that shape, and every one of them is a bug you cannot
// fix without leaving it:
//
//   · it never turned      — the overlay had no idea where the camera was, so
//                            the Locker's stage had to stay frozen at one yaw.
//                            THIS is why there was no turntable on the shop.
//   · it never sorted      — always painted last, so a brim covered the skull
//                            that should have been occluding it.
//   · it never shaded      — one flat fill against a faceted body reads as a
//                            sticker at every size.
//   · it never posed       — the body bobs on its walk clip; the hat did not.
//   · it never fitted      — one assumed skull, four builds whose head
//                            half-widths run 0.34 → 0.46.
//
// The rule that keeps all five fixed: NOTHING IN THIS FILE MAY CARRY A CONSTANT
// OF ITS OWN. Every item is written against `Anchors` — the measurements
// `builds.ts` derives from the build actually wearing it — so an item authored
// once fits the runner, the brute, the drone and the ghost, and a head that
// moves moves what is on it. A number here that is not a multiple of an anchor
// is the old `HEAD_W = 0.52` coming back under a new name.
//
// Everything is octagonal, because the body is (`builds.ts`, rule 2: nothing
// has a corner). A hat with square corners is a hat off a different model.

import type { Solid } from '../mesh-studio/pieces/pieces.js';
import type { Shape } from './characters.js';
import { figure, measure, type Anchors, type BodyTag, type Material, type Part } from './builds.js';
import { at, atAngle, lift, lump, ring, shear, taper } from './solids.js';
import { glyph, GLYPHS } from './glyphs.js';
// Imported here rather than defined here: a card is a held OBJECT, not a worn
// one, and its geometry has nothing in common with a hat beyond the anchor it
// hangs off. Same registry, separate file.
import { CARD_WEARABLES } from './cards.js';

/**
 * Where on the body a thing is worn.
 *
 * Metadata, not maths — an item positions itself off `Anchors`. This exists so
 * the surface dressing the figure can work in both directions: clicking the
 * model's head has to know which items go there, and dragging a hat onto the
 * model has to know that the chest is the wrong place to drop it.
 */
export type Anchor = 'crown' | 'brow' | 'shoulders' | 'back' | 'chest' | 'hand';

export const ANCHORS: { key: Anchor; label: string; hint: string }[] = [
	{ key: 'crown', label: 'Head', hint: 'Sits on the skull.' },
	{ key: 'brow', label: 'Eyes', hint: 'Across the visor, standing proud of it.' },
	{ key: 'shoulders', label: 'Shoulders', hint: 'Hung off the shoulder line.' },
	{ key: 'back', label: 'Back', hint: 'Behind the torso.' },
	{ key: 'chest', label: 'Chest', hint: 'On the front plate.' },
	{ key: 'hand', label: 'Card', hint: 'The card you are holding — back, frame and stamp compose onto one slate.' }
];

export interface Wearable {
	key: string;
	anchor: Anchor;
	/** The solids, built against the measurements of whoever is wearing it. */
	parts(a: Anchors): Part[];
	/**
	 * Body masses this displaces.
	 *
	 * A helmet and the ghost's hood want the same volume, and two solids in one
	 * place have no honest paint order between them — the eye reads the flicker
	 * as a fault in the model rather than as a hat. Declared on the ITEM so the
	 * renderer never grows a rule about hoods.
	 */
	suppress?: BodyTag[];
}

// ── Authoring helpers ────────────────────────────────────────────────────────
// Every item below is written in two units and no others: `hw`/`hd` for how
// wide and deep the skull is, and `hh` for how tall it is. That is the whole
// vocabulary, and it is what makes an item portable between builds.

const part = (solid: Solid, tint: number, mat: Material = 'trim'): Part => ({ solid, tint, mat });

/** Head height. The unit a hat's thickness, brim and stack are all measured in
 *  — using the figure's total height instead would make a brute's hat squat. */
const headH = (a: Anchors) => a.crown - a.jaw;

const NONE: Wearable = { key: 'hat.none', anchor: 'crown', parts: () => [] };

/** Knitted, so it HUGS: a turn-up that grips the skull and a dome that shrinks
 *  as it rises. A beanie whose sides are vertical is a bucket. */
const BEANIE: Wearable = {
	key: 'hat.beanie',
	anchor: 'crown',
	suppress: ['hood'],
	parts: (a) => {
		const hh = headH(a);
		return [
			part(lump(a.headW * 1.07, a.headD * 1.07, a.crown - 0.17 * hh, a.crown - 0.02 * hh, 0.3), 0.82),
			part(
				taper(
					a.headW * 1.02,
					a.headD * 1.02,
					a.headW * 0.58,
					a.headD * 0.58,
					a.crown - 0.05 * hh,
					a.crown + 0.17 * hh,
					0.3
				),
				1
			),
			part(lump(a.headW * 0.17, a.headD * 0.17, a.crown + 0.16 * hh, a.crown + 0.25 * hh, 0.5), 1.15)
		];
	}
};

/** A shell and a brim, plus the ridge down the middle that is the only reason a
 *  hard hat reads as a hard hat and not as a bowl. */
const HARDHAT: Wearable = {
	key: 'hat.hardhat',
	anchor: 'crown',
	suppress: ['hood'],
	parts: (a) => {
		const hh = headH(a);
		return [
			part(lump(a.headW * 1.52, a.headD * 1.38, a.crown - 0.09 * hh, a.crown - 0.02 * hh, 0.42), 0.8),
			part(
				taper(
					a.headW * 1.04,
					a.headD * 1.04,
					a.headW * 0.7,
					a.headD * 0.7,
					a.crown - 0.07 * hh,
					a.crown + 0.21 * hh,
					0.34
				),
				1
			),
			part(lump(a.headW * 0.1, a.headD * 0.8, a.crown + 0.17 * hh, a.crown + 0.27 * hh, 0.2), 1.18)
		];
	}
};

/** Band over the crown, a cup on each ear, and a boom. The band is thin in
 *  NORTH and wide in EAST — a headset band runs ear to ear, and built the other
 *  way round it is a mohawk. */
const HEADSET: Wearable = {
	key: 'hat.headset',
	anchor: 'crown',
	suppress: ['hood'],
	parts: (a) => {
		const hh = headH(a);
		const cup = (s: number) =>
			part(
				at(
					lump(a.headW * 0.19, a.headD * 0.44, a.brow - 0.11 * hh, a.brow + 0.15 * hh, 0.42),
					s * a.headW * 1.02
				),
				0.92
			);
		return [
			part(lump(a.headW * 1.06, a.headD * 0.15, a.crown - 0.03 * hh, a.crown + 0.09 * hh, 0.25), 1.1),
			cup(-1),
			cup(1),
			// Slung forward off the left cup, and kept clear of the visor's own
			// face — a boom that intersects the one bright plane on the model
			// covers the only feature the character has.
			part(
				at(
					lump(a.headW * 0.06, a.headD * 0.5, a.brow - 0.08 * hh, a.brow - 0.02 * hh, 0.3),
					-a.headW * 0.86,
					a.browFront * 0.85
				),
				1.05
			)
		];
	}
};

/** A disc cocked forward. Sheared rather than turned, because a shear keeps
 *  every side a vertical plane and the eye cannot tell at this angle. */
const BERET: Wearable = {
	key: 'hat.beret',
	anchor: 'crown',
	suppress: ['hood'],
	parts: (a) => {
		const hh = headH(a);
		return [
			part(
				shear(
					lump(a.headW * 1.26, a.headD * 1.16, a.crown - 0.04 * hh, a.crown + 0.07 * hh, 0.46),
					0.2
				),
				0.95
			),
			part(
				at(
					lump(a.headW * 0.11, a.headD * 0.11, a.crown + 0.09 * hh, a.crown + 0.16 * hh, 0.5),
					0,
					a.headD * 0.52
				),
				1.2
			)
		];
	}
};

/** Turned: the brim is at POSITIVE north, which is the back. The whole joke of
 *  the item is which way it points, so it is the one measurement that matters. */
const CAP: Wearable = {
	key: 'hat.cap',
	anchor: 'crown',
	suppress: ['hood'],
	parts: (a) => {
		const hh = headH(a);
		return [
			part(
				taper(
					a.headW * 1.03,
					a.headD * 1.03,
					a.headW * 0.76,
					a.headD * 0.76,
					a.crown - 0.11 * hh,
					a.crown + 0.11 * hh,
					0.34
				),
				1
			),
			part(
				at(
					lump(a.headW * 0.74, a.headD * 0.6, a.crown - 0.09 * hh, a.crown - 0.03 * hh, 0.42),
					0,
					a.headD * 1.32
				),
				0.84
			)
		];
	}
};

/** A band across the eyes, standing PROUD of the visor rather than in it —
 *  `browFront` is exactly how far out the one bright plane already reaches, so
 *  this is the anchor that stops the item from being swallowed by it. */
const VISOR: Wearable = {
	key: 'hat.visor',
	anchor: 'brow',
	parts: (a) => {
		const hh = headH(a);
		const n = a.browFront - a.headD * 0.09;
		return [
			// Kept INSIDE the skull's own silhouette. Wider than the head, a band
			// standing proud of the face stops reading as a visor and starts
			// reading as a rod passing through it — which is exactly what it looked
			// like the first time, at three-quarter view and nowhere else.
			part(at(lump(a.headW * 0.97, a.headD * 0.12, a.brow - 0.09 * hh, a.brow + 0.1 * hh, 0.3), 0, n), 0.9),
			part(
				at(
					lump(a.headW * 0.78, a.headD * 0.06, a.brow - 0.04 * hh, a.brow + 0.05 * hh, 0.3),
					0,
					n - a.headD * 0.06
				),
				1,
				'lamp'
			)
		];
	}
};

/** Brim, stack, band. The stack is straight-sided on purpose — it is the one
 *  item on the roster that is allowed to be architecture. */
const TOPHAT: Wearable = {
	key: 'hat.tophat',
	anchor: 'crown',
	suppress: ['hood'],
	parts: (a) => {
		const hh = headH(a);
		return [
			part(lump(a.headW * 1.62, a.headD * 1.5, a.crown - 0.03 * hh, a.crown + 0.05 * hh, 0.45), 0.78),
			part(lump(a.headW * 0.88, a.headD * 0.88, a.crown + 0.04 * hh, a.crown + 0.74 * hh, 0.34), 1),
			part(lump(a.headW * 0.92, a.headD * 0.92, a.crown + 0.13 * hh, a.crown + 0.25 * hh, 0.34), 0.5)
		];
	}
};

/** Three tapering segments a side, each stepping out and up. A horn is a curve,
 *  and a curve at this poly count is a short stack of frusta — one long taper
 *  reads as a spike. Nothing tapers to nothing: a zero cap would fold the sides
 *  through each other and hand the cull an inward normal. */
const HORNS: Wearable = {
	key: 'hat.horns',
	anchor: 'crown',
	parts: (a) => {
		const hh = headH(a);
		const w = a.headW;
		const d = a.headD;
		const seg = (s: number) => [
			part(
				at(
					taper(w * 0.23, d * 0.23, w * 0.17, d * 0.17, a.crown - 0.07 * hh, a.crown + 0.15 * hh, 0.4),
					s * w * 0.7
				),
				0.9
			),
			part(
				at(
					taper(w * 0.17, d * 0.17, w * 0.11, d * 0.11, a.crown + 0.15 * hh, a.crown + 0.33 * hh, 0.4),
					s * w * 0.85
				),
				1
			),
			part(
				at(
					taper(w * 0.11, d * 0.11, w * 0.04, d * 0.04, a.crown + 0.33 * hh, a.crown + 0.49 * hh, 0.4),
					s * w * 0.97
				),
				1.15
			)
		];
		return [...seg(-1), ...seg(1)];
	}
};

/** A band and five points. The points are a `ring`, which is how a kernel of
 *  convex solids draws anything annular at all — and they are set on an ELLIPSE
 *  because the skull is wider than it is deep. */
const CROWN: Wearable = {
	key: 'hat.crown',
	anchor: 'crown',
	suppress: ['hood'],
	parts: (a) => {
		const hh = headH(a);
		const w = a.headW;
		return [
			part(lump(w * 1.05, a.headD * 1.05, a.crown - 0.05 * hh, a.crown + 0.15 * hh, 0.32), 0.88),
			...ring(5, (th) =>
				atAngle(
					taper(w * 0.14, w * 0.11, w * 0.04, w * 0.04, a.crown + 0.12 * hh, a.crown + 0.36 * hh, 0.4),
					th,
					w * 0.78,
					a.headD * 0.78
				)
			).map((s) => part(s, 1.15))
		];
	}
};

/** Not a torus — it cannot be, and it should not pretend. Ten lit pips on an
 *  ellipse above the crown, each turned to face out, in `lamp` so the halo is
 *  the one worn thing that EMITS rather than reflects. */
const HALO: Wearable = {
	key: 'hat.halo',
	anchor: 'crown',
	parts: (a) => {
		const hh = headH(a);
		const w = a.headW;
		return ring(16, (th) =>
			atAngle(
				lump(w * 0.11, w * 0.045, a.crown + 0.31 * hh, a.crown + 0.36 * hh, 0.35),
				th,
				w * 0.84,
				a.headD * 0.9
			)
		).map((s) => part(s, 1, 'lamp'));
	}
};

/**
 * A mark, worn on the chest plate.
 *
 * Every emblem in the catalogue becomes one of these, which is what "no 2D
 * marks" means in practice: the device on your side's flag is the same solid
 * that stands on your figure's chest, lit by the same light, turning with the
 * same camera. It was a raw SVG `<path>` pasted into a flag box; it is now
 * geometry, and it is thin — that is the whole permitted concession.
 */
const badge = (id: string): Wearable => ({
	key: `emblem.${id}`,
	anchor: 'chest',
	parts: (a) =>
		glyph(GLYPHS[id], a.chestW * 0.44, a.chestD * 0.1).map((s) =>
			part(at(lift(s, a.plateH), 0, a.plateN), 1.05)
		)
});

export const BADGES: Wearable[] = Object.keys(GLYPHS).map(badge);

export const WEARABLES: Record<string, Wearable> = Object.fromEntries(
	[
		NONE,
		BEANIE,
		HARDHAT,
		HEADSET,
		BERET,
		CAP,
		VISOR,
		TOPHAT,
		HORNS,
		CROWN,
		HALO,
		...BADGES,
		...CARD_WEARABLES
	].map((w) => [w.key, w])
);

export const wearable = (key: string): Wearable | undefined => WEARABLES[key];

/** What a click on a part of the model should offer. */
export const wornAt = (anchor: Anchor) =>
	Object.values(WEARABLES).filter((w) => w.anchor === anchor);

/**
 * One character, dressed.
 *
 * The single place a body and what it wears become one list — which is the
 * whole fix. `render.ts` culls, shades and sorts whatever it is handed, so a
 * hat that arrives here is a hat that turns, sorts, shades and poses for free,
 * and one that arrives any other way is a sticker again.
 */
export function assemble(
	shape: Shape,
	worn: readonly string[] = [],
	/**
	 * Which build the worn items are CUT for, when it is not the one wearing
	 * them.
	 *
	 * The file's whole rule is that an item may carry no constant of its own, so
	 * everything below is written against the anchors of whoever puts it on and
	 * therefore always fits. This is the one seam through that guarantee, and it
	 * exists because "always fits" is a property somebody eventually needs to
	 * break on purpose: a figure in clothes measured for a different body is a
	 * figure in somebody else's clothes, which is a thing no colour can say.
	 *
	 * It changes the ANCHORS the items are built against and nothing else. The
	 * body is still the body — so a runner in brute-cut kit is a runner whose hat
	 * is a third too wide and sits low, rather than a brute.
	 */
	fit: Shape = shape
): Part[] {
	const items = worn.map((k) => WEARABLES[k]).filter((w): w is Wearable => !!w);
	if (!items.length) return figure(shape);

	const a = measure(fit);
	const gone = new Set(items.flatMap((w) => w.suppress ?? []));
	const body = gone.size ? figure(shape).filter((p) => !p.tag || !gone.has(p.tag)) : figure(shape);
	// Stamped here rather than in each item's `parts()`: an author writing a hat
	// should not have to remember to sign every solid, and one that forgot would
	// silently become unpaintable.
	return [...body, ...items.flatMap((w) => w.parts(a).map((p) => ({ ...p, owner: w.key })))];
}

/** The worn set as one string, for the render memo.
 *
 *  Load-bearing: `art()` memoises on its whole signature, so a loadout missing
 *  from that signature means swapping a hat hands back the figure wearing the
 *  previous one — for ever. Sorted, because {crown, halo} and {halo, crown} are
 *  the same figure and should not be cached twice. */
export const wornKey = (worn: readonly string[] = []) =>
	worn.filter((k) => WEARABLES[k] && k !== NONE.key).sort().join(',');
