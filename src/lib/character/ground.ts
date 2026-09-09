// ── Ground · the card stands on the game's own planet ────────────────────────
// A scene had no ground. Everything below the feet was a CSS wash, which costs
// twice: the figures float, and every pace of card the camera spends under them
// is spent on a gradient instead of on a picture.
//
// The fix is not to draw a floor. `physics/terrain` is already the elevation
// field the globe is built from — hand it a direction, get a height — so the
// ground under a card can be a PATCH OF THAT FIELD rather than a new invention.
// Same seed, same planet: the hill behind the Forge on a card is the hill that
// is behind the Forge on the board, and nobody has to keep two of them in step.
//
// One quad per cell, not one box. A heightfield of boxes is six faces a cell and
// a grid of little cliffs; a heightfield of quads sharing their corners is one
// face a cell and a continuous surface, which is both cheaper and correct.
import { makeTerrain, type TerrainOpts } from '../physics/terrain.js';
import type { Solid } from '../mesh-studio/pieces/pieces.js';

export interface GroundOpts extends TerrainOpts {
	/** How wide the patch is, in paces. Wants to comfortably exceed the camera
	 *  window, or the player sees the side of the world. */
	span?: number;
	/**
	 * How far back the ground goes before it stops, in paces — the horizon.
	 *
	 * This is a real number and not a large one, because the projector is
	 * ORTHOGRAPHIC: parallel lines never converge, so a ground plane running to
	 * infinity does not recede to a horizon, it fills the frame and keeps going.
	 * The far edge of the patch IS the skyline, and where it lands is this.
	 */
	far?: number;
	/** How far forward, past the camera. Only has to cover the near corners. */
	near?: number;
	/** Cells across. The cost is quadratic and the read is not: past about 20 the
	 *  extra detail lands under a pixel. */
	cells?: number;
	/**
	 * How far the field moves the surface, in paces.
	 *
	 * Small under the cast, because ground that competes for attention is a
	 * landscape with some people standing in it. But not zero: the only thing
	 * keeping the far edge from reading as a ruled line is the terrain putting a
	 * wobble in it, which is the difference between a skyline and a cut.
	 */
	relief?: number;
	/** How much of the sphere the patch covers. Small: the field is authored at
	 *  planet scale, and sampling a whole hemisphere under one card gives a
	 *  hillside rather than a piece of ground. */
	zoom?: number;
	/** Where on the globe the patch is cut from, so two cards are not the same
	 *  square metre. */
	at?: { e?: number; n?: number };
}

const DEFAULTS = {
	span: 26,
	far: 7.5,
	near: 6,
	cells: 18,
	relief: 0.5,
	zoom: 0.03,
	seed: 20260809,
	octaves: 4,
	frequency: 9,
	gain: 0.5
} satisfies GroundOpts;

/**
 * A patch of the world, as one solid, in a frame where +n is straight away from
 * the camera.
 *
 * Camera-aligned rather than world-aligned, which matters entirely because of
 * the far edge: a square patch laid out on the world axes and then viewed from
 * some yaw presents a CORNER to the viewer, and that corner is a hard diagonal
 * across the sky. Squared up to the camera the same edge is a level skyline with
 * the terrain's own roll in it. `sceneArt` turns it back by the scene's yaw.
 *
 * One solid rather than one per cell because `paint` sorts whole items, and a
 * hundred separate ground tiles would each take their turn in the depth order
 * against the cast — which is how a character ends up standing behind the tile
 * they are standing on. As a single solid the ground's faces sort among
 * themselves and against everything else in the same pass.
 */
export function groundPatch(opts: GroundOpts = {}): Solid {
	const o = { ...DEFAULTS, ...opts };
	const field = makeTerrain(o);
	const cols = Math.max(2, Math.round(o.cells));
	const depth = o.near + o.far;
	// Square-ish cells. A grid stretched in one axis reads as a direction the
	// ground is combed in, and the eye finds it immediately.
	const rows = Math.max(2, Math.round((cols * depth) / o.span));
	const ae = o.at?.e ?? 0;
	const an = o.at?.n ?? 0;

	const verts: Solid['verts'] = [];
	for (let j = 0; j <= rows; j++) {
		for (let i = 0; i <= cols; i++) {
			const e = -o.span / 2 + (i * o.span) / cols;
			const n = -o.near + (j * depth) / rows;
			// A small cap around +y. Normalising is what makes it a direction on the
			// sphere; the zoom is how many paces of card one radian of planet is
			// worth, and it is the knob that decides whether this reads as ground or
			// as the side of a mountain.
			const x = (e + ae) * o.zoom;
			const z = (n + an) * o.zoom;
			const len = Math.hypot(x, 1, z);
			verts.push({
				e,
				n,
				h: field.heightAt({ x: x / len, y: 1 / len, z: z / len }) * o.relief
			});
		}
	}

	// Counter-clockwise seen from above, so the surface normal points up and the
	// facet survives the back-face cull. Wound the other way the ground is
	// invisible from every angle a card is ever shot at, which is not a subtle
	// failure but is a silent one.
	const faces: number[][] = [];
	const idx = (i: number, j: number) => j * (cols + 1) + i;
	for (let j = 0; j < rows; j++) {
		for (let i = 0; i < cols; i++) {
			faces.push([idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)]);
		}
	}

	return { verts, faces };
}
