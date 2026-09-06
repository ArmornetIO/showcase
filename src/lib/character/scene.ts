// ── A scene · more than one thing, looked at once ────────────────────────────
// Card art. A figure alone against a colour is a portrait, and a portrait is
// what an icon in a circle already was — the thing a card face has instead of
// art. What a card wants is a PLACE with somebody doing something in it, which
// means at least two objects, which means the one hard problem: what is in
// front of what.
//
// That problem is already solved once, in `paint`. `pieceFacets` sorts within
// a single solid, so anything drawn from several has to re-sort across all of
// them together — and the moment it does, a figure can stand behind a wall,
// beside it, or half-hidden by its corner without anybody writing down which.
// This file's whole job is to put things in world coordinates and hand the pile
// over; it decides nothing about depth, because depth is not a decision.
//
// Scale, for anybody placing something: a character is about 1.5 tall
// (`BUILDS[shape].tall`) and a piece as authored is about 2. So a building at
// `size: 1` is a hut a person could look over. Buildings here are scaled up to
// read as buildings.
import type { Piece, Solid } from '../mesh-studio/pieces/pieces.js';
import { pieceProjector, studioFrame } from '../mesh-studio/pieces/piece-facets.js';
import { at, lift, turn } from './solids.js';
import { measure } from './builds.js';
import { figureParts, paint, DEFAULT_ART, type Painted, type Tri, type Rect } from './render.js';
import type { CharacterSkin } from './characters.js';
import type { Pose } from './poses.js';
import type { CrestOpts } from './crest.js';
import { groundPatch, type GroundOpts } from './ground.js';

/** Same hundred-to-one the figure renderer draws at — the two share a frame, so
 *  they have to share its step or a character would arrive a hundred times the
 *  size of the building beside them. */
const STEP = 100;

/** Where a thing stands, in paces and radians. */
export interface Spot {
	/** Right of centre. */
	e?: number;
	/** Away from the camera. Positive is deeper into the card. */
	n?: number;
	/** Turned about the vertical — which way it is facing. */
	face?: number;
	/** Off the ground. For anything flying, and for stacking one thing on top
	 *  of another. */
	h?: number;
	size?: number;
}

export interface Actor extends Spot {
	who: CharacterSkin;
	worn?: readonly string[];
	pose?: Pose;
	/** The hue worn items fly in. */
	trim?: string;
	/** A ground plate to stand this one in — see `crest.ts`. */
	crest?: CrestOpts | null;
	/**
	 * Draw them as a bystander rather than the subject.
	 *
	 * Dims the whole figure toward the background. What lets a card hold a crowd
	 * without the crowd competing with the person the card is about — the actor
	 * at full strength is the one the eye is supposed to land on, and three
	 * equally lit figures have no subject at all.
	 */
	extra?: boolean;
}

export interface Prop extends Spot {
	piece: Piece;
	color: string;
	/** Albedo. Below 1 the thing sits back into the scene. */
	tint?: number;
	/**
	 * Draw it as a light rather than a surface — flat, at full hue, unshaded.
	 *
	 * The one thing a scene of matte blocks cannot say without it is WHEN. A lit
	 * window makes a building somewhere people are at night; the same building
	 * without one is a shape at any hour, and half these cards are about work
	 * that happens because nobody is watching.
	 */
	emits?: boolean;
}

export interface SceneSpec {
	actors?: Actor[];
	props?: Prop[];
	/**
	 * Real ground under the cast, cut from the globe's own elevation field.
	 *
	 * Joins the same paint as everything else, which is the point: a floor
	 * composited under the figures would be a floor they are standing IN FRONT
	 * OF, and one sorted with them is a floor they are standing ON — a building
	 * set into a rise occludes its own footings without anybody saying so.
	 */
	ground?: (GroundOpts & Spot & { color: string; tint?: number }) | null;
	/** Radians about the vertical — the whole scene's camera. */
	yaw?: number;
	pitch?: number;
	suit?: string;
	glow?: number;
	/**
	 * Shoot every scene the same way, instead of framing each on its own
	 * contents.
	 *
	 * Bounds framing is right for a portrait and wrong for a SET. A card whose
	 * crew is spread wide gets zoomed out to contain them and a card with one
	 * figure gets zoomed in, so the same character is drawn at three sizes
	 * across three cards and the deck reads as a pile of unrelated pictures.
	 * Fixing the window makes the camera a property of the DECK: whoever stands
	 * in it is drawn at the size they actually are, and stepping back is
	 * something a scene does by putting its subject further away.
	 */
	look?: {
		/** What the window is centred on, in paces. */
		e?: number;
		n?: number;
		h?: number;
		/** How much world fits across it, in paces. */
		width: number;
	};
}

export interface Scene {
	/** Back to front, across every object in the scene. */
	tris: Tri[];
	/** Everything, padded. */
	box: Rect;
}

/** Uniform scale about the origin. Not in `solids.ts` because a body has a
 *  BUILD rather than a size — nothing about a character is scaled, and scaling
 *  one would be the "adjust the crop instead of the model" mistake again. A
 *  prop is scenery and genuinely has no true size. */
const sized = (s: Solid, k: number): Solid =>
	k === 1 ? s : { ...s, verts: s.verts.map((v) => ({ e: v.e * k, n: v.n * k, h: v.h * k })) };

/** Scale, turn, then move. In that order and not another: `turn` rotates about
 *  the vertical through the ORIGIN, so a thing turned after it has been moved
 *  swings around the middle of the card instead of about its own feet. */
const place = (s: Solid, spot: Spot): Solid =>
	at(lift(turn(sized(s, spot.size ?? 1), spot.face ?? 0), spot.h ?? 0), spot.e ?? 0, spot.n ?? 0);

/** How far back a bystander is pushed. Enough to read as behind the subject at
 *  a glance, not so far that they turn into silhouettes and stop being people. */
const EXTRA_TINT = 0.62;

/**
 * One card's worth of world, in paint order.
 *
 * Everything goes through a single `paint` — actors, their crests, and every
 * building — which is the only reason a character can stand half behind a wall.
 * Sorting the figures and the scenery separately and stacking the two results
 * would put every person permanently in front of, or permanently behind, every
 * structure on the card.
 */
export function sceneArt(spec: SceneSpec): Scene {
	const yaw = spec.yaw ?? DEFAULT_ART.yaw;
	const pitch = spec.pitch ?? DEFAULT_ART.pitch;
	const frame = studioFrame(yaw, pitch, STEP);
	const project = pieceProjector(frame);

	const items: Painted[] = [];

	// First into the list and last out of the bounds. It spans far wider than the
	// shot on purpose — the camera must not be able to see the edge of the world —
	// so framing on it would zoom every card out to hold a patch of dirt.
	if (spec.ground) {
		items.push({
			// Turned BACK by the yaw the patch was built square to, so the far edge
			// stays a level skyline whatever bearing the scene is shot from.
			solid: place(groundPatch(spec.ground), {
				...spec.ground,
				face: yaw + (spec.ground.face ?? 0)
			}),
			color: spec.ground.color,
			emits: false,
			tint: spec.ground.tint ?? 1
		});
	}
	const cast = items.length;

	for (const a of spec.actors ?? []) {
		const parts = figureParts(a.who, {
			suit: spec.suit,
			pose: a.pose,
			worn: a.worn,
			trim: a.trim,
			// The crest squares up to the VIEW, and the view is the scene's, so it
			// takes the scene's yaw less however far this actor has been turned —
			// otherwise turning a character to face a building drags their ground
			// plate round with them and it stops being ground.
			crest: a.crest && { face: yaw - (a.face ?? 0), ...a.crest }
		});
		for (const p of parts) {
			items.push({
				...p,
				solid: place(p.solid, a),
				tint: a.extra ? p.tint * EXTRA_TINT : p.tint
			});
		}
	}

	for (const p of spec.props ?? []) {
		for (const solid of p.piece) {
			items.push({
				solid: place(solid, p),
				color: p.color,
				emits: p.emits ?? false,
				tint: p.tint ?? 1
			});
		}
	}

	const tris = paint(items, frame, spec.glow ?? DEFAULT_ART.glow);

	if (spec.look) {
		// Square, and left square: the window's aspect is the art box's business,
		// and `slice` is what reconciles the two. A height guessed here would be a
		// second opinion about the shape of a container this file cannot see.
		const c = project({ e: spec.look.e ?? 0, n: spec.look.n ?? 0, h: spec.look.h ?? 0 });
		const w = spec.look.width * STEP;
		return { tris, box: { x: c.x - w / 2, y: c.y - w / 2, w, h: w } };
	}

	let x0 = Infinity;
	let x1 = -Infinity;
	let y0 = Infinity;
	let y1 = -Infinity;
	for (const it of items.slice(cast)) {
		for (const v of it.solid.verts) {
			const q = project(v);
			if (q.x < x0) x0 = q.x;
			if (q.x > x1) x1 = q.x;
			if (q.y < y0) y0 = q.y;
			if (q.y > y1) y1 = q.y;
		}
	}
	const pad = 0.1 * STEP;
	return {
		tris,
		box: { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 }
	};
}

/** How tall a build stands, for anybody placing something at head height or
 *  stacking one actor on another. Re-exported so a scene recipe does not have
 *  to reach into `builds` for the one number it needs. */
export const heightOf = (who: CharacterSkin): number => measure(who.shape).tall;
