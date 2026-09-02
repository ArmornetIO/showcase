// ── logo-nanotech · the mesh figure, read as a solid ─────────────────────────
// The crestlink figure is drawn as four flat circles and three flat spokes, and
// every consumer so far has treated it as exactly that. It is not. Solve for a
// tripod — apex at the hub, three feet on one circle about a vertical axis — and
// the three satellites fall out to four decimal places:
//
//   feet at 120° · radius 61.08 · hung 50.70 below the apex · pitch asin(0.361)
//
// That is not a coincidence anyone has to be told about, it is the figure's
// construction showing through, and it is what lets the mark SPIN. The rest pose
// is a whole number of turns away from itself, so a spin that lands is not eased
// into an approximation of the logo — it lands ON the logo, exactly, and the
// frame where the animation stops is bit-identical to the frame where it never
// started.
//
// Solved rather than typed in. The constants above are what the solve currently
// returns; hard-coding them would mean a figure re-placed by half a unit spins
// around an axis that is no longer its own, and nothing would say so.
//
// Pure: no Svelte, no DOM, no clock.

import type { Pt } from '../icons/ArmornetCrestMesh.svelte';

/** Rest azimuths, in the order `CRESTLINK_NODES` gives its satellites: the two
 *  flanking ones, then the low one. 90° is straight at the viewer. */
const REST = [(210 * Math.PI) / 180, (330 * Math.PI) / 180, (90 * Math.PI) / 180];

export interface Tripod {
	/** Apex — the top node. The spin axis is vertical and runs through it. */
	hx: number;
	hy: number;
	/** Foot circle radius, in the figure's own plane. */
	R: number;
	/** How far the feet hang below the apex. */
	drop: number;
	/** Foreshortening of the foot circle: sin of the camera's pitch. */
	k: number;
	rest: number[];
}

/**
 * Recover the solid from the three drawn satellites.
 *
 * Three feet on a circle at known azimuths over-determine nothing: `R` comes
 * from the flanking pair's horizontal span, and the pitch and the drop come from
 * how much LOWER the near foot sits than those two. If the figure ever stops
 * being a tripod this returns the nearest one rather than failing, which is the
 * right failure — a mark that spins slightly wrong beats a mark that throws.
 */
export function readTripod(hub: Pt, nodes: readonly Pt[]): Tripod {
	const [hx, hy] = hub;
	const [left, right, low] = nodes;
	const R = (right[0] - left[0]) / (2 * Math.cos(Math.PI / 6));
	const flank = (left[1] + right[1]) / 2;
	// The near foot drops by R·k below the apex-plus-drop line and the flanking
	// pair rise by half that, so their separation is 1.5·R·k — one equation, one
	// unknown, no fitting.
	const k = (low[1] - flank) / (1.5 * R);
	return { hx, hy, R, k, drop: flank - hy + 0.5 * R * k, rest: REST };
}

export interface Foot {
	x: number;
	y: number;
	/** −1 at the back of the turn, +1 at the front. Painter's order and the size
	 *  a near foot is drawn at both come off this. */
	depth: number;
}

/** Where a foot lands at a given azimuth. `tilt` scales the foreshortening only
 *  — a dreidel losing its axis changes how open the circle reads, not how wide
 *  it is, and scaling both is a zoom rather than a wobble. */
export function foot(t: Tripod, az: number, tilt = 1): Foot {
	return {
		x: t.hx + t.R * Math.cos(az),
		y: t.hy + t.drop + t.R * Math.sin(az) * t.k * tilt,
		depth: Math.sin(az)
	};
}
