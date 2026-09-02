// ── mesh-studio/mesh-layout — shared mesh arrangement options ─────────────────
// The layout menu the agent-management mesh offers ("Grouped / Packed / Radial /
// Fan / Möbius / Globe"), factored out so any mesh canvas can present the SAME
// options and place nodes the SAME way. The 2D layouts are solved here — seed a
// feasible arrangement around the hub, then separate. 'globe' is intentionally
// not solved here: it solves for DIRECTIONS on a sphere and projects them every
// frame, so it's the caller's job (it owns the spin state).
//
// 'mobius' IS solved here, unlike the globe, because its projection is fixed:
// the strip does not spin, so the seed is a one-time 3D→2D place and everything
// downstream — separation, pinning, drag — treats it as any other planar layout.

import { packRing } from '../../physics/ring.js';
import { packSunflower } from '../../physics/sunflower.js';
import { packClusters } from '../../physics/cluster.js';
import { packMobius } from '../../physics/mobius-pack.js';
import { packInward, type Body, type Lane } from '../../physics/solver.js';

export type MeshLayoutId = 'grouped' | 'packed' | 'radial' | 'fan' | 'mobius' | 'globe';
/** The 2D layouts this module can solve (everything but the globe). */
export type PlanarMeshLayoutId = Exclude<MeshLayoutId, 'globe'>;

export interface MeshLayoutOption {
	id: MeshLayoutId;
	label: string;
	hint: string;
}

/** Single source of truth for the arrangement menu — named for what the operator
 *  gets, not for the algorithm behind it, each with the trade-off as a hint. */
export const MESH_LAYOUTS: MeshLayoutOption[] = [
	{ id: 'grouped', label: 'Grouped', hint: 'Agents of the same kind sit together' },
	{ id: 'packed', label: 'Packed', hint: 'Tightest fit — best for a large mesh' },
	{ id: 'radial', label: 'Radial', hint: 'One ring around the crest — every link traceable' },
	{ id: 'fan', label: 'Fan', hint: 'Crest on the left, the mesh it feeds spread out to the right' },
	{
		id: 'mobius',
		label: 'Möbius',
		hint: 'One loop walked twice — the far half runs back past the near half'
	},
	{ id: 'globe', label: 'Globe', hint: 'Agents on a sphere around the crest — drag to spin it' }
];

/** Anything with a mutable position + a footprint radius. */
export interface Placeable {
	x: number;
	y: number;
	r?: number;
}

export interface SolveMeshLayoutOpts {
	layout: PlanarMeshLayoutId;
	/** The crest the mesh is arranged around — fixed point, never moved. */
	hub: { x: number; y: number; r: number };
	/** Clear space between two nodes at rest. */
	margin?: number;
	/** Clear space between the hub and the nearest node. */
	hubMargin?: number;
	/** Extra clearance between groups in the 'grouped' layout. */
	groupMargin?: number;
	/** How wide the 'fan' wedge opens, in degrees. */
	fanSpread?: number;
	/** Grouping key per spoke (for 'grouped'); defaults to one group. */
	groupKeys?: (string | number)[];
	/**
	 * Per-spoke: keep this spoke's CURRENT x/y instead of seeding it a new one.
	 * A node the operator has already placed (dragged, or settled on a prior
	 * solve) stays where it is; only un-pinned spokes are free to be packed into
	 * the gaps around it. Defaults to every spoke un-pinned (a full re-place).
	 */
	pinned?: boolean[];
	/**
	 * Hold each hub→spoke line clear of every other node (radial only). Every node
	 * then needs its own bearing off the crest — which IS a ring — so it only makes
	 * sense for the one layout that already is one. Ignored for other layouts.
	 */
	lanes?: boolean;
	/** Room either side of a lane for the line and its chips. */
	laneClearance?: number;
	/** Möbius only: rotation about the vertical axis, degrees. */
	mobiusYaw?: number;
	/** Möbius only: tilt toward the viewer. Near 0 the strip is edge-on. */
	mobiusPitch?: number;
	/**
	 * Möbius only: receives the per-node depth (0 furthest … 1 nearest) from the
	 * seed, so the caller can size and fade the far half. Reported rather than
	 * applied here — `solveMeshLayout` owns positions, not appearance.
	 */
	onDepth?: (depth: number[]) => void;
}

/**
 * Place `spokes` around `hub` per the chosen 2D layout — mutates each spoke's
 * x/y in place. Seeds a feasible arrangement (ring / sunflower / wedge / clusters)
 * then runs the separation solver; only 'packed' pulls inward for density, the
 * others separate-only so the seed's shape survives.
 */
export function solveMeshLayout<T extends Placeable>(spokes: T[], opts: SolveMeshLayoutOpts): void {
	const { layout, hub, margin = 26, hubMargin = 28, groupMargin = 34, fanSpread = 120 } = opts;
	if (spokes.length === 0) return;

	const radii = spokes.map((s) => s.r ?? 34);
	const groupKeys = opts.groupKeys ?? spokes.map(() => 'all');
	const seedOpts = { margin, hubR: hub.r, hubMargin };

	const seed =
		layout === 'radial'
			? packRing(radii, seedOpts)
			: layout === 'packed'
				? packSunflower(radii, seedOpts)
				: layout === 'fan'
					? // The same spiral confined to a wedge pointing right: the crest reads
						// as a source with everything it feeds laid out downstream.
						packSunflower(radii, { ...seedOpts, startAngle: 0, spread: fanSpread })
					: layout === 'mobius'
						? // A single boundary curve walked twice. Unlike the other seeds
							// this one carries depth per point, which the caller reads to
							// size and fade nodes on the far half — see `onDepth`.
							packMobius(radii, {
								...seedOpts,
								yaw: opts.mobiusYaw ?? 0,
								pitch: opts.mobiusPitch ?? 58
							})
						: packClusters(radii, groupKeys, { ...seedOpts, groupMargin });

	// Depth only exists for the Möbius seed; every other packer returns plain
	// points, so the callback simply never fires for them.
	if (opts.onDepth && 'points' in seed && seed.points.length && 'depth' in seed.points[0]) {
		opts.onDepth((seed.points as { depth: number }[]).map((p) => p.depth));
	}

	const pinned = opts.pinned;
	const bodies: Body[] = [
		{ x: hub.x, y: hub.y, r: hub.r, invMass: 0 },
		...spokes.map((s, i) => {
			// A pinned spoke keeps its place — the operator may have put it there,
			// and re-solving must never move it (invMass 0). Only new/un-pinned
			// spokes seed from the layout and are free to be packed (invMass 1).
			const keep = pinned?.[i];
			return {
				x: keep ? s.x : hub.x + seed.points[i].x,
				y: keep ? s.y : hub.y + seed.points[i].y,
				r: radii[i],
				invMass: keep ? 0 : 1
			};
		})
	];
	// Each hub→spoke line is a lane no other node may sit on. Radial only: holding
	// them all clear is what gives every node its own bearing off the crest.
	const lanes: Lane[] =
		opts.lanes && layout === 'radial' ? spokes.map((_, i) => ({ i: 0, j: i + 1 })) : [];
	packInward(bodies, lanes, {
		center: { x: hub.x, y: hub.y },
		margin,
		laneClearance: opts.laneClearance ?? 0,
		// Only 'packed' asks for the inward density pull; every other seed IS the
		// arrangement, so we separate overlaps only and leave the shape intact.
		...(layout === 'packed' ? {} : { pull: 0 })
	});
	spokes.forEach((s, i) => {
		s.x = bodies[i + 1].x;
		s.y = bodies[i + 1].y;
	});
}
