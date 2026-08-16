// ── /mockups/breach-map · what the operator is holding ───────────────────────
// The board draws a card being played as an arrow crossing a globe. That is the
// SPECTATOR's picture, and it is the right one for them: three other people are
// watching a map and need to know who did what to where.
//
// It is the wrong picture for the person playing the card. They are not watching
// the board — they have been put inside one of the figures standing on it, and
// what a body has that a map does not is a pair of hands with something in them.
// So this file exists for one reason: from inside, an attack is not a vector, it
// is a WEAPON DISCHARGING. Everything downstream of that — the recoil, the
// tracers, the ammo count going down — follows from having a real object in
// frame to fire.
//
// ── Built the same way as everything else ────────────────────────────────────
// Same convex solids, same `pieceFacets`, same key light as the buildings and
// the characters. That is deliberate and it is the whole reason a hand-drawn gun
// sprite was not used: the weapon has to look like it was made in the same
// factory as the world behind it, and the cheapest way to guarantee that is for
// it to be lit by the same function.
//
// The one thing the shared kit could not do is a barrel. `prism` extrudes a
// footprint UPWARD, which builds a building; a gun is the same idea rotated —
// a cross-section swept ALONG the bore. Hence `sweepN`, which is the only new
// geometry in here and is thirty lines.

import {
	box,
	octagon,
	pieceFacets,
	pieceProjector,
	type Facet,
	type Piece,
	type PieceVert,
	type Solid
} from '$lib/index.js';
import type { TangentFrame } from '$lib/physics/sphere.js';
import type { UnitShape } from './fx.js';

// ── Geometry ─────────────────────────────────────────────────────────────────

/**
 * Sweep a cross-section along the bore.
 *
 * The kit's `prism` extrudes an (e, n) footprint up the h axis, which is what a
 * building is. A weapon is a long thing lying along n, so its natural
 * description is an (e, h) section swept from `n0` to `n1` — the same solid,
 * turned ninety degrees, and worth writing out rather than faking with a box
 * because a barrel with four sides reads as a plank.
 *
 * Winding is the fiddly part and it is not negotiable: `pieceFacets` culls on
 * the plain cross product, so a face wound the wrong way is invisible from the
 * side you are looking at and solid from the side you are not. Given a section
 * wound counter-clockwise in (e, h): the NEAR cap takes it as-is (its outward
 * normal is −n), the FAR cap takes it reversed, and each side quad is wound
 * BACKWARDS around the section — because mapping (e, h, n) onto the kit's
 * (e, n, h) is a single axis swap, and a single swap flips handedness.
 */
function sweepN(section: [number, number][], n0: number, n1: number): Solid {
	const k = section.length;
	return {
		verts: [
			...section.map(([e, h]) => ({ e, n: n0, h })),
			...section.map(([e, h]) => ({ e, n: n1, h }))
		],
		faces: [
			section.map((_, i) => i),
			section.map((_, i) => k + (k - 1 - i)),
			...section.map((_, i) => {
				const j = (i + 1) % k;
				return [j, i, k + i, k + j];
			})
		]
	};
}

/** An octagonal bore section of half-width `w` and half-height `t`. Eight sides
 *  for the same reason the characters have eight: it is the cheapest thing that
 *  stops reading as a box. */
const ring = (w: number, t: number, cut = 0.34): [number, number][] => octagon(w, t, cut);

/** A tube along the bore. */
const tube = (w: number, t: number, n0: number, n1: number, cut = 0.34): Solid =>
	sweepN(ring(w, t, cut), n0, n1);

/** Shift a solid sideways and up — same trick as the characters, so a part is
 *  one expression put somewhere rather than a bespoke section. */
const at = (s: Solid, e: number, h: number): Solid => ({
	faces: s.faces,
	verts: s.verts.map((v) => ({ e: v.e + e, n: v.n, h: v.h + h }))
});

// ── What a weapon IS, to the rest of the scene ───────────────────────────────

/**
 * How this thing behaves when it goes off.
 *
 * Separate from the geometry because the shot is what the player actually reads.
 * A carbine and a cannon can share every polygon and still feel nothing alike if
 * one of them empties three rounds in a quarter second and the other one lands
 * once and throws the camera — and the numbers below are the whole of that
 * difference.
 */
export interface WeaponSpec {
	/** On the HUD, under the ammo. The class's identity in three or four words. */
	name: string;
	/** Rounds in a volley. One volley is one card resolution. */
	shots: number;
	/** Milliseconds between rounds. Zero for anything that fires once. */
	cadence: number;
	/** How far the viewmodel is thrown back, in fractions of the frame height. */
	recoil: number;
	/** How hard the EYE is thrown, in radians of pose. The gun kicking and the
	 *  head kicking are two different tells and a weapon that only does the first
	 *  reads as a prop being waggled. */
	kick: number;
	/** A continuous beam rather than discrete rounds. Draws as one thick line
	 *  that holds for the volley instead of tracers crossing the gap. */
	beam: boolean;
	/** Tracer thickness in px at rest. */
	tracer: number;
	/** How many pips the magazine strip draws. */
	magazine: number;
	/** Muzzle flare radius, in fractions of the frame width. */
	flash: number;
}

export interface WeaponModel {
	/** The gun and the hands. */
	body: Piece;
	/** The parts that EMIT — the cell, the sight dot. Split for the same reason
	 *  the characters' visor is: one sorted list, two materials. */
	glow: Piece;
	/** Where rounds leave from, in the model's own local space. Everything the
	 *  scene draws going out into the world starts here, so it is a fact about the
	 *  model rather than a number guessed at in the renderer. */
	muzzle: PieceVert;
	spec: WeaponSpec;
}

/** The knobs a class is allowed to turn. Everything else is shared so four
 *  weapons read as four of one thing — the same argument the characters make. */
interface Rig {
	/** Bore half-width, and how far out the muzzle is. */
	bore: number;
	len: number;
	/** Receiver half-width and half-height. */
	body: number;
	deep: number;
	/** How far right of centre the weapon is held, and how low. */
	hold: number;
	drop: number;
	/** A box magazine hanging under the receiver. */
	mag: boolean;
	/** A shoulder stock behind it. */
	stock: boolean;
	/** An optic on top. Off for the things that are pointed rather than aimed. */
	optic: boolean;
	/** Muzzle furniture: a brake (slotted), an emitter (flared), or nothing. */
	snout: 'brake' | 'emitter' | 'can' | 'none';
}

const RIGS: Record<UnitShape, Rig> = {
	// prettier-ignore
	runner: { bore: 0.030, len: 1.34, body: 0.062, deep: 0.070, hold: 0.30, drop: -0.16, mag: true,  stock: true,  optic: true,  snout: 'brake' },
	// Everything wider, shorter and heavier. A cannon is not a longer carbine —
	// it is a carbine that has given up reach for mass, which is what makes the
	// one round it fires land like it cost something.
	// prettier-ignore
	brute:  { bore: 0.060, len: 1.10, body: 0.105, deep: 0.115, hold: 0.26, drop: -0.20, mag: false, stock: true,  optic: false, snout: 'brake' },
	// No stock, no magazine, no optic: nothing on it was made for hands, because
	// the thing holding it does not have any.
	// prettier-ignore
	drone:  { bore: 0.042, len: 1.20, body: 0.070, deep: 0.058, hold: 0.24, drop: -0.13, mag: false, stock: false, optic: false, snout: 'emitter' },
	// Long and thin with the whole front third given over to the can. A silenced
	// weapon should look like it is mostly silencer.
	// prettier-ignore
	ghost:  { bore: 0.026, len: 1.26, body: 0.050, deep: 0.058, hold: 0.28, drop: -0.15, mag: true,  stock: false, optic: true,  snout: 'can' }
};

const SPECS: Record<UnitShape, WeaponSpec> = {
	runner: {
		name: 'burst carbine',
		shots: 3,
		cadence: 84,
		recoil: 0.055,
		kick: 0.012,
		beam: false,
		tracer: 2.4,
		magazine: 12,
		flash: 0.06
	},
	brute: {
		name: 'breach cannon',
		shots: 1,
		cadence: 0,
		recoil: 0.175,
		kick: 0.05,
		beam: false,
		tracer: 6.5,
		magazine: 4,
		flash: 0.13
	},
	drone: {
		name: 'lance emitter',
		shots: 1,
		cadence: 0,
		recoil: 0.02,
		kick: 0.004,
		beam: true,
		tracer: 5,
		magazine: 6,
		flash: 0.08
	},
	ghost: {
		name: 'suppressed injector',
		shots: 2,
		cadence: 210,
		recoil: 0.028,
		kick: 0.006,
		beam: false,
		tracer: 1.6,
		magazine: 8,
		flash: 0.02
	}
};

/**
 * Build one.
 *
 * Held right of centre and canted in, which is not decoration: a weapon on the
 * centre line covers the thing you are shooting at, and one held level reads as
 * a floating prop. Offset and cant are how every first-person view ever drawn
 * says "there is a body attached to this".
 */
export function weapon(shape: UnitShape): WeaponModel {
	const r = RIGS[shape];
	const parts: Solid[] = [];
	const glow: Solid[] = [];
	const put = (s: Solid) => parts.push(at(s, r.hold, r.drop));

	// Receiver — the mass the rest hangs off. Deeper at the back than the front,
	// the same taper the characters' torso has, for the same reason: a stack of
	// even prisms reads as a stack of even prisms.
	put(tube(r.body, r.deep, -0.42, 0.16));
	put(tube(r.body * 0.86, r.deep * 0.72, 0.16, 0.52));

	// Barrel, and then the front furniture.
	put(tube(r.bore * 1.5, r.bore * 1.5, 0.5, r.len - 0.2));
	if (r.snout === 'brake') {
		// A brake: a stub wider than the bore with two slots cut as gaps between
		// three rings. Cheaper than a real cut and reads the same at this size.
		for (const [a, b] of [
			[r.len - 0.2, r.len - 0.14],
			[r.len - 0.1, r.len - 0.04],
			[r.len, r.len + 0.04]
		]) {
			put(tube(r.bore * 2.4, r.bore * 2.4, a, b));
		}
		put(tube(r.bore * 1.2, r.bore * 1.2, r.len - 0.2, r.len + 0.04));
	} else if (r.snout === 'can') {
		// The can. Most of the front of the weapon, and blunt at the end.
		put(tube(r.bore * 3.1, r.bore * 3.1, r.len - 0.52, r.len));
	} else if (r.snout === 'emitter') {
		// A flare rather than a muzzle — three widening rings ending open.
		put(tube(r.bore * 1.9, r.bore * 1.9, r.len - 0.3, r.len - 0.16));
		put(tube(r.bore * 2.8, r.bore * 2.8, r.len - 0.16, r.len - 0.06));
		put(tube(r.bore * 3.6, r.bore * 3.6, r.len - 0.06, r.len));
		// The lit throat, recessed inside the flare so it is a glow coming OUT of
		// something rather than a disc stuck on the end.
		glow.push(at(tube(r.bore * 2.4, r.bore * 2.4, r.len - 0.1, r.len - 0.02), r.hold, r.drop));
	}

	// Grip and trigger guard, hanging under the back of the receiver. Angled by
	// building it as two stacked boxes rather than a real rake — at this size the
	// silhouette is all that survives and the silhouette is the same.
	put(box(-r.body * 0.7, r.body * 0.7, -0.3, -0.14, -r.deep - 0.2, -r.deep));
	put(box(-r.body * 0.7, r.body * 0.7, -0.22, -0.08, -r.deep - 0.13, -r.deep));

	if (r.mag) {
		// Magazine, forward of the grip and canted the other way — the one part
		// that tells you which end is the front from underneath.
		put(box(-r.body * 0.62, r.body * 0.62, -0.02, 0.22, -r.deep - 0.3, -r.deep + 0.01));
	}
	if (r.stock) {
		put(tube(r.body * 0.55, r.deep * 0.62, -0.74, -0.4));
		put(tube(r.body * 0.8, r.deep * 0.95, -0.82, -0.74));
	}
	if (r.optic) {
		// A short tube on a riser. The riser matters more than the tube: an optic
		// sitting flat on the receiver is a bump, and one standing off it is a
		// piece of kit.
		put(box(-r.body * 0.3, r.body * 0.3, -0.12, 0.06, r.deep, r.deep + 0.05));
		put(tube(r.body * 0.44, r.body * 0.44, -0.2, 0.12, 0.4));
		// The dot. The only thing on the model that emits and the only thing a
		// player will look for, so it goes at the back of the tube where a real
		// one is.
		glow.push(
			at(tube(r.body * 0.22, r.body * 0.22, -0.21, -0.19, 0.45), r.hold, r.drop + r.deep + 0.09)
		);
	}

	// The power cell — a lit sliver let into the side of the receiver. Every
	// class gets one, because it is the single feature that ties the gun to the
	// visor on the face holding it.
	glow.push(at(box(-r.body - 0.004, r.body + 0.004, -0.24, 0.02, -r.deep * 0.4, r.deep * 0.3), r.hold, r.drop));

	// ── Hands ────────────────────────────────────────────────────────────────
	// Two lumps, and they earn their place several times over. A weapon with no
	// hands on it is an object floating in the corner of the screen; the moment
	// there is a fist round the grip it is being HELD, and everything above it in
	// the frame becomes a person rather than a camera.
	//
	// The support hand goes on the barrel, forward, which also breaks up the long
	// straight run of the bore — the one part of the silhouette that otherwise
	// reads as a stick.
	const fist = (n: number, e: number, h: number, k: number) =>
		put(at(tube(0.075 * k, 0.085 * k, n - 0.09 * k, n + 0.09 * k, 0.4), e, h));
	fist(-0.19, 0, -r.deep - 0.12, 1);
	if (!r.stock && !r.mag) {
		// A drone has no shoulder and no magazine, so the support hand has nothing
		// to brace against — it holds the emitter itself, further out.
		fist(r.len - 0.5, -r.body * 0.4, -r.deep * 0.6, 0.92);
	} else {
		fist(0.42, -r.body * 0.5, -r.deep - 0.06, 0.95);
	}
	// Forearms, running back out of the bottom of the frame. Long and tapering,
	// because the frame edge has to cut them off rather than them ending in mid
	// air — an arm that stops is a severed arm.
	put(at(tube(0.085, 0.1, -1.5, -0.16, 0.4), -0.02, -r.deep - 0.34));
	put(at(tube(0.075, 0.09, -1.2, 0.4, 0.4), -r.body * 1.4, -r.deep - 0.5));

	return {
		body: parts,
		glow,
		muzzle: { e: r.hold, n: r.len + 0.02, h: r.drop },
		spec: SPECS[shape]
	};
}

/** Every visible face of the weapon, body and lights sorted as ONE list.
 *
 *  Same shape as `characterFacets`, and for the same reason spelled out there:
 *  two passes is two depth sorts, and the second one paints the cell straight
 *  through the receiver in front of it. */
export function weaponFacets(
	model: WeaponModel,
	frame: TangentFrame
): Array<Facet & { lit: boolean }> {
	return [
		...pieceFacets(model.body, frame).map((f) => ({ ...f, lit: false })),
		...pieceFacets(model.glow, frame).map((f) => ({ ...f, lit: true }))
	].sort((a, b) => a.depth - b.depth);
}

/** Where the muzzle lands on screen, relative to the model's own origin. The
 *  tracers have to leave the actual end of the actual barrel as it is actually
 *  drawn this frame — recoil, sway and all — so this is projected with the same
 *  projector the facets are, rather than approximated. */
export function muzzleAt(model: WeaponModel, frame: TangentFrame): { x: number; y: number } {
	return pieceProjector(frame)(model.muzzle);
}

/** Built once. Four weapons are constants. */
export const WEAPONS: Record<UnitShape, WeaponModel> = {
	runner: weapon('runner'),
	brute: weapon('brute'),
	drone: weapon('drone'),
	ghost: weapon('ghost')
};
