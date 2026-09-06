// ── The crest, as a thing in the world ───────────────────────────────────────
// A hexagonal ring the character stands in, built out of the same primitives
// the body is and handed to the same painter's pass — so what is in front of
// what is decided by DEPTH, once, by the renderer that already does it.
//
// This replaces a `clip-path` hexagon drawn over the figure in CSS, and the
// reason it had to is the reason a window does not cut your ears: a 2D clip is
// a cookie cutter. It removes whatever falls outside an outline regardless of
// where that thing is in space, so a head leaning out through the opening got
// planed off flat on both sides at exactly the width of the hole. Every fix for
// that was a wider hole, and a wider hole is no longer a socket.
//
// A ring in the world has no such problem. The head is in front of the rim, so
// it draws over it; the chest is behind, so the rim draws over the chest. Both
// facts fall out of one depth sort and neither is written down anywhere.
//
// The LEAN is what makes them different facts. A ring standing square to the
// camera puts its whole rim at one depth — in front of everything or behind
// everything, and either way there is no socket. Tipped back at the top, the
// upper rim goes behind the head while the lower rim comes forward of the
// chest, which is the geometry of leaning out of a porthole and the only reason
// this reads as three dimensions rather than as a badge.
import { prism, type Solid } from '../mesh-studio/pieces/pieces.js';
import { ccw, lift, tip, turn } from './solids.js';
import { measure, type Part } from './builds.js';
import type { Shape } from './characters.js';

export interface CrestOpts {
	/**
	 * Where the ring sits, as a fraction of the character's height.
	 *
	 * Anchored to the BUILD rather than to pixels: a brute and a drone are
	 * different heights, and a crest pinned at 0.62 crosses both of them at the
	 * same place on the body. That is the whole reason this reads from
	 * `measure` instead of taking a number of its own.
	 */
	at?: number;
	/** The opening, as a multiple of the head's half-width. Below 1 the rim
	 *  starts covering the face, which is the failure this number exists to be
	 *  turned away from. */
	open?: number;
	/** How thick the coloured LIP around the opening is, as a fraction of it. */
	rim?: number;
	/**
	 * How far the dark surround reaches past the lip, as a fraction of the
	 * opening. This is the part that makes it a HOLE.
	 *
	 * A lip on its own is a ring, and a ring only hides what is directly behind
	 * its own band — so the character's legs carried on below it in open space
	 * and the thing never read as one body passing through one opening. Surround
	 * wide enough to reach past the silhouette and everything below the opening
	 * is behind a surface, which is what being in a hole means.
	 */
	surround?: number;
	/**
	 * How far the plate is laid DOWN, in radians. Zero stands it up square to
	 * the camera — a badge; `π/2` lays it flat — ground.
	 *
	 * Between the two is where it reads as three dimensions, and the reason is
	 * the same either way: the near edge of the hole has to come toward the
	 * camera and the far edge go away from it, so one is in front of the
	 * character and the other behind. Square-on, the whole rim sits at ONE depth
	 * — in front of everything or behind everything — and it flattens into a
	 * sticker with a person next to it.
	 */
	lean?: number;
	/** Front-to-back thickness of the plate, as a fraction of the opening. */
	thick?: number;
	/**
	 * Turn the ring to FACE THE CAMERA, in radians about the vertical.
	 *
	 * Filled in by `art` from its own yaw, and the difference between a crest
	 * and a barrel hoop. Authored in the character's frame the ring squares up
	 * to the character's north — and the studio looks in from 35° off that, so
	 * it comes out foreshortened into a fat ellipse with the character standing
	 * in it. Squared to the VIEW it reads as the flat hexagon the rest of the
	 * HUD is drawn with, and still leans in depth, which is the part doing the
	 * work.
	 */
	face?: number;
	/** Which material paints it. `trim` is the player's own hue, which is what
	 *  the HUD's crests have always been. */
	mat?: Part['mat'];
}

const DEFAULTS = {
	// Chest height and a good deal wider than the shoulders. The ring has to
	// clear the body to read as a ring at all: any tighter and its upper bars
	// disappear behind the shoulders, leaving two slabs down the sides and no
	// hexagon anywhere.
	/** Waist height — the character is standing in the hole, not framed by it. */
	at: 0.5,
	// Wide enough for a body to come up through, which is arms and not head:
	// `open` is in head-widths and the arms reach past the skull.
	open: 1.3,
	rim: 0.22,
	// Reaches past the opening far enough to read as GROUND rather than as a
	// collar, and stops well before it becomes a slab painted across the card
	// and whatever else was on it.
	surround: 0.5,
	// Nearly flat, but not flat: laid all the way down the plate is edge-on and
	// its hexagon disappears into a line.
	lean: 1.25,
	// Thick enough to have an INSIDE, thin enough to stay a plate. The camera
	// looks slightly down, so some depth shows the far wall of the opening and
	// that lit strip is the difference between a hexagon with a hole in it and
	// a hexagon someone is standing inside. Much past this it stops being a
	// crest and becomes a barrel.
	thick: 0.12,
	face: 0,
	mat: 'trim' as const
};

/** A pointy-top hexagon, in the plane this is authored flat in.
 *
 *  Pointy-TOP matters and survives the tip: `n` becomes height when the plate
 *  stands up, so the vertex has to be the point at maximum `n` here to be the
 *  point at the top there. Authored the other way round it stands up flat-top
 *  and stops matching every other hexagon in the HUD. */
const hex = (r: number, turnBy = 0): [number, number][] =>
	Array.from({ length: 6 }, (_, i) => {
		const a = (i / 6) * Math.PI * 2 + turnBy;
		return [r * Math.sin(a), r * Math.cos(a)] as [number, number];
	});

/**
 * The crest for one build, as parts ready to join a figure's assembly.
 *
 * Six segments, not one shape. `prism` demands a CONVEX footprint and a ring is
 * the canonical thing that is not one — so it is cut at the corners into six
 * trapezoids, each of which is convex, and the seams land on the hexagon's own
 * vertices where nothing can see them.
 */
export function crestParts(shape: Shape, opts: CrestOpts = {}): Part[] {
	const o = { ...DEFAULTS, ...opts };
	const a = measure(shape);

	const inner = a.headW * o.open;
	const lip = inner * (1 + o.rim);
	const edge = inner * (1 + o.surround);
	const t = inner * o.thick;

	// Tipped a quarter turn LESS the lean, so the plate that was authored lying
	// flat ends up standing and leaning away from the camera at the top.
	const stand = Math.PI / 2 - o.lean;
	const h = a.tall * o.at;

	// TWO rings, not one. The surround is the card: dark, and wide enough to be
	// a surface rather than a band. The lip is the seat's colour, and it is only
	// the few units nearest the opening — a hole reads by its EDGE, and flooding
	// the whole plate with a hue turns the card into a coloured slab with a
	// person in it.
	const ring = (r0: number, r1: number, mat: Part['mat'], base: number, lit: boolean): Part[] => {
		const A = hex(r0);
		const B = hex(r1);
		return Array.from({ length: 6 }, (_, i) => {
			const j = (i + 1) % 6;
			const foot = ccw([B[i], B[j], A[j], A[i]]);
			// Stand it up, square it to the camera, then lift it to height. Turning
			// after the tip and before the lift keeps the rotation about the ring's
			// own centre rather than about the character's feet.
			const solid: Solid = lift(turn(tip(prism(foot, -t / 2, t / 2), stand), o.face), h);
			return { solid, tint: base * (lit ? segTint((i + 0.5) / 6) : 1), mat, tag: undefined };
		});
	};

	// The surround is shaded FLAT. It is one surface, and six segments each
	// given their own albedo put a seam down every hexagon vertex — six bright
	// creases radiating out of the hole across something that is supposed to be
	// a plate. The lip is where the six are allowed to differ, because there the
	// facets are the point.
	return [...ring(lip, edge, 'suit', 0.62, false), ...ring(inner, lip, o.mat, 1, true)];
}

/**
 * How lit one segment of the ring is, from where it sits on the hexagon.
 *
 * `pieceFacets` shades by NORMAL, and every segment of a flat ring shares one —
 * so without this the six read as a single stroke of colour and the hexagon
 * comes out as an outline rather than as a solid with a top and an underside.
 * Albedo is the only channel left, and it is enough: the rim goes bright along
 * the top-left and drops away toward the bottom-right, which is the same key
 * light the figure standing in it is already shaded by.
 *
 * Kept BRIGHT and shallow on purpose. The part of the ring you actually see is
 * its lower front, and a lighting model that darkens the bottom therefore
 * darkens the only bit on screen — which lands under the card's own fill and
 * reads as a hole rather than as a plate the character is standing in. Above
 * the card it reads as a solid, and the depth then comes from `pieceFacets`
 * shading the lip against the face, which is where depth should come from.
 *
 * `f` is the segment's position around the ring, 0 at the top point.
 */
function segTint(f: number): number {
	const a = f * Math.PI * 2;
	// Up and a little to the left, matching the studio key.
	const lit = -0.5 * Math.sin(a) + 0.87 * Math.cos(a);
	return 1.16 + lit * 0.16;
}
