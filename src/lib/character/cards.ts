// ── character · the card in your hand ────────────────────────────────────────
// Card cosmetics as geometry, held by the figure — which is the only place they
// could go without reintroducing everything this work removed.
//
// The obvious shape was a second flat surface: draw a card face-on somewhere on
// the screen and lay art over it. That is exactly the Mannequin overlay again,
// one object along: a picture that cannot turn, cannot sort against anything,
// and needs its own anchoring table. So a card is a SOLID the character holds.
// It swings on the arm, it is lit by the same key light, it sorts against the
// torso behind it, and every cosmetic on it is a plate standing off its face.
//
// WHAT IS AND IS NOT GEOMETRY HERE. A back, a frame and a stamp are shapes, so
// they are solids. A FINISH is not: it is how the surface takes light — matte
// versus gloss versus a holographic sheen. That is a material property, and it
// is expressed as one (`mat`), not as a sheet of glass modelled in front of the
// card. The rule was never "everything is a solid"; it was "no second drawing
// pipeline", and a material is not a drawing.
//
// The card body is carried by the BACK, because a frame with no card to sit on
// is a floating rectangle. Backs are always equipped, so the body always
// exists, and frame and stamp compose onto it by landing in the same place.

import type { Shape } from './characters.js';
import type { Anchors, Material, Part } from './builds.js';
import { at, lift, lump } from './solids.js';
import { glyph, GLYPHS } from './glyphs.js';
import type { Wearable } from './wearables.js';

/** The card, in the wearer's units. Held out from the body and a little
 *  forward, so it is not edge-on at the roster's three-quarter camera and not
 *  buried in the hip either. */
function slate(a: Anchors) {
	const w = a.chestW * 0.58;
	return {
		/** Half-width, half-height, half-thickness. */
		w,
		h: w * 1.42,
		t: a.chestD * 0.055,
		/**
		 * Where its middle sits: clear of the right arm, forward of the body so
		 * the face catches the key light, and raised to chest height.
		 *
		 * The standoff is the card's OWN half-width plus the arm's, not a fixed
		 * gap — otherwise the inner edge cuts through the arm on the brute, whose
		 * chest (and therefore card) is half again as wide as the runner's.
		 */
		e: a.armE + a.armW * 1.2 + w,
		n: -a.chestD * 1.3,
		mid: a.hand + w * 1.9
	};
}

/** Held items ride the arm — same limb tag and pivot the arm itself carries, so
 *  a walk cycle swings the card with the hand rather than leaving it hanging in
 *  the air beside a moving character. */
const held = (solid: Part['solid'], tint: number, mat: Material, a: Anchors): Part => ({
	solid,
	tint,
	mat,
	limb: 'armR',
	pivot: a.armTop
});

/** Put a solid built about the origin onto the card's face. */
const onCard = (s: Part['solid'], c: ReturnType<typeof slate>, depth: number) =>
	at(lift(s, c.mid), c.e, c.n + depth);

// ── Backs ────────────────────────────────────────────────────────────────────
// Each back is the card body plus its device. Seen by everyone except its
// owner, which is the whole appeal — so the device is on the face pointing AWAY
// from the character, standing proud of it.

function back(key: string, device: string | null, face: Material = 'trim'): Wearable {
	return {
		key: `back.${key}`,
		anchor: 'hand',
		parts: (a) => {
			const c = slate(a);
			// The body. A low chamfer, because a card is a rounded rectangle and the
			// octagon's default cut turns it into a stop sign.
			const parts: Part[] = [held(onCard(lump(c.w, c.t, -c.h, c.h, 0.12), c, 0), 0.9, 'suit', a)];
			if (device) {
				for (const g of glyph(GLYPHS[device], c.w * 0.5, c.t * 0.9)) {
					parts.push(held(onCard(g, c, -c.t), 1.1, face, a));
				}
			}
			return parts;
		}
	};
}

// ── Frames ───────────────────────────────────────────────────────────────────
// Four bars round the edge, standing off the face. A frame never covers the
// middle of the card, which is the same guarantee the old CSS one made — only
// now it is guaranteed by where the geometry is rather than by a z-index.

function frame(key: string, thick: number, rivets = false): Wearable {
	return {
		key: `frame.${key}`,
		anchor: 'hand',
		parts: (a) => {
			const c = slate(a);
			const bw = c.w * thick;
			const d = -c.t * 1.6;
			const bar = (s: Part['solid']) => held(onCard(s, c, d), 1.05, 'trim', a);
			const parts: Part[] = [
				bar(lump(c.w, c.t * 0.5, c.h - bw * 2, c.h, 0.1)),
				bar(lump(c.w, c.t * 0.5, -c.h, -c.h + bw * 2, 0.1)),
				bar(at(lump(bw, c.t * 0.5, -c.h, c.h, 0.1), -c.w + bw, 0)),
				bar(at(lump(bw, c.t * 0.5, -c.h, c.h, 0.1), c.w - bw, 0))
			];
			if (rivets) {
				for (const [e, h] of [
					[-1, -1],
					[-1, 1],
					[1, -1],
					[1, 1]
				] as const) {
					parts.push(
						bar(at(lump(bw * 0.5, c.t * 0.6, h * c.h - h * bw * 2, h * c.h - h * bw, 0.4), e * (c.w - bw * 1.4), 0))
					);
				}
			}
			return parts;
		}
	};
}

// ── Stamps ───────────────────────────────────────────────────────────────────
// Struck on a card that landed. The smallest thing in the catalogue and the one
// a player looks at most often, because it appears every time they win.

function stamp(key: string, device: string): Wearable {
	return {
		key: `stamp.${key}`,
		anchor: 'hand',
		parts: (a) => {
			const c = slate(a);
			return glyph(GLYPHS[device], c.w * 0.26, c.t * 0.9).map((s) =>
				held(at(onCard(s, c, -c.t * 1.9), 0, 0), 1.2, 'lamp', a)
			);
		}
	};
}

// ── Finishes ─────────────────────────────────────────────────────────────────
// NOT geometry, and the one place this feature draws that line. A finish is how
// the card's own faces take light, so it is a material swap on the body: matte
// reflects (`trim`), gloss emits a little (`lamp`). Modelling a sheet of glass
// in front of the card would be geometry that exists only to be shiny.

export type Finish = 'matte' | 'gloss';

export const FINISH_MAT: Record<Finish, Material> = { matte: 'trim', gloss: 'lamp' };

export const CARD_WEARABLES: Wearable[] = [
	back('issue', null),
	back('grid', 'bars'),
	back('hazard', 'cross'),
	back('static', 'ring'),
	back('charter', 'zero'),
	frame('none', 0),
	frame('hairline', 0.05),
	frame('rivet', 0.07, true),
	frame('chamfer', 0.12),
	stamp('slash', 'chevron'),
	stamp('pin', 'star'),
	stamp('seal', 'skull')
];
