// ── mobius-pack — seed placements along a Möbius strip's edge ────────────────
//
// The seed half of the `mobius` mesh arrangement, in the same shape as
// `packRing` and `packSunflower`: given a list of node radii, return points
// relative to the hub. `solveMeshLayout` takes it from there — separation,
// pinning, and everything drag already does.
//
// ── Why a Möbius arrangement is not just a prettier ring ──────────────────
// A Möbius boundary is a SINGLE closed curve that takes TWO laps to walk: after
// one circuit you are back at the same bearing but on the opposite edge, and
// only after the second do you return to where you started. So n nodes spread
// over the full traversal put n/2 on each visual edge, and the second half runs
// back past the first. A ring says "these return exactly"; a Möbius says "these
// come back past where they have been before they close" — which is the truer
// claim about a mesh whose traffic loops.
//
// Depth is carried out with the points, because a node at the back of the strip
// should be drawn smaller and dimmer than one at the front. A ring has no such
// axis and its callers ignore the field.

import { mobiusLayout, type MobiusOptions } from '../backdrop/mobius.js';

export interface MobiusPackOpts extends MobiusOptions {
	/** Clear space between two nodes at rest. Widens the strip when crowded. */
	margin?: number;
	/** The hub's radius — the strip is scaled to clear it. */
	hubR?: number;
	hubMargin?: number;
}

export interface MobiusPlacementPoint {
	x: number;
	y: number;
	/** 0 = furthest away, 1 = nearest. Drives size, fade and paint order. */
	depth: number;
	/** Perspective scale at this point: >1 nearer than the centre. */
	scale: number;
	/** Which lap — 0 on the first circuit, 1 on the second (the far edge). */
	lap: 0 | 1;
}

export interface MobiusPackResult {
	points: MobiusPlacementPoint[];
	/** The strip's projected half-extent, for framing the view. */
	radius: number;
}

/**
 * Place `radii.length` nodes along the strip's single boundary curve.
 *
 * The strip is sized from the nodes rather than fixed: crowding a 40-node mesh
 * onto a strip scaled for 6 would overlap every one of them, and the separation
 * solver would then spend its whole budget undoing the seed.
 */
export function packMobius(radii: number[], opts: MobiusPackOpts = {}): MobiusPackResult {
	if (!radii.length) return { points: [], radius: Math.max(opts.hubR ?? 0, 1) };

	const margin = opts.margin ?? 0;
	const hubClear = (opts.hubR ?? 0) + (opts.hubMargin ?? 0);

	// Circumference the nodes actually need, converted back to a radius. The
	// curve is walked twice, so the available length is 2 · 2πR, not 2πR — the
	// factor of two here is the whole reason a Möbius holds more than a ring of
	// the same size.
	const needed = radii.reduce((sum, r) => sum + 2 * r + margin, 0);
	const fromNodes = needed / (2 * Math.PI * 2);
	const radius = Math.max(fromNodes, hubClear, opts.radius ?? 0, 60);

	const ids = radii.map((_, i) => `n${i}`);
	const layout = mobiusLayout(ids, {
		...opts,
		radius,
		// Band scales with the strip unless the caller pinned it, so the twist
		// stays proportionate instead of flattening as the mesh grows.
		band: opts.band ?? radius * 0.34
	});

	return {
		points: layout.points.map((p) => ({
			x: p.x,
			y: p.y,
			depth: p.depth,
			scale: p.scale,
			lap: p.lap
		})),
		radius: Math.max(
			1,
			Math.max(
				Math.abs(layout.extent.minX),
				Math.abs(layout.extent.maxX),
				Math.abs(layout.extent.minY),
				Math.abs(layout.extent.maxY)
			)
		)
	};
}
