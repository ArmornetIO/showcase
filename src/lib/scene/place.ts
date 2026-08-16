// ── Placement — one solve, two kinds of participation ──────────────────────
// The central design problem this file answers: mesh node positions are SOLVER
// owned (packRing → packInward), while components are hand-placed. Those are
// not two systems needing a bridge. They are one solve in which some bodies are
// immovable.
//
// `physics/solver.ts` already documents the concept it needs:
//     invMass — 0 = immovable: the hub, or a node the operator placed by hand.
// and `mesh-layout.ts` already exposes `pinned?: boolean[]`. So a hand-placed
// Card dropped into the mesh doesn't get special-cased — it enters the solve at
// its authored coordinates with invMass 0, and the mesh packs around it.

import type { Scene, SceneObject } from './types.js';
import { solveMeshLayout } from '../mesh-studio/layout/mesh-layout.js';
import { packSphere, spin, project, type Vec3 } from '../physics/sphere.js';
import { spinElapsedAt } from './state.js';

export interface Placed {
	x: number;
	y: number;
	/** Globe only — perspective scale, depth for painter's sorting, and whether
	 *  the body is on the near face. Absent for planar layouts. */
	scale?: number;
	depth?: number;
	front?: boolean;
}

/** Where the globe camera rests, and how fast a spinning beat turns it. */
export const GLOBE_REST = { yaw: 0.6, pitch: 0.34, viewDistance: 2.6 };
/** Radians per millisecond, matched to the supply-chain demo's feel. */
export const SPIN_RATE = 0.000192;

/**
 * The static half of placement. For a planar layout this IS the answer; for the
 * globe it is a set of unit-sphere DIRECTIONS, because a globe node has no 2D
 * position — only a bearing that gets projected afresh at every moment.
 *
 * `physics/README.md` puts it exactly: "the sphere is the state, and x/y is only
 * ever a projection of it."
 */
export interface PlacementPlan {
	mode: 'planar' | 'globe';
	/** Planar: every node. Globe: components only (they don't ride the sphere). */
	positions: Map<string, Placed>;
	globe?: {
		radius: number;
		dirs: Map<string, Vec3>;
		/** Drawn radius per node, which perspective scales. */
		baseR: Map<string, number>;
	};
}

/** A component's footprint as a circle, so it can take part in a 2D solve.
 *  The adapter lives HERE and not in `physics/` on purpose: physics knows about
 *  circles, and nothing else. Translating "a 360px Card" into "a body of radius
 *  R" is scene knowledge. */
function componentRadius(o: SceneObject): number {
	const w = o.component?.w ?? 240;
	// Components are wider than tall in practice; half the diagonal of a 16:9-ish
	// box is a fair, slightly generous circle.
	return Math.round(Math.sqrt(w * w + (w * 0.6) * (w * 0.6)) / 2);
}

/**
 * Resolve every object's position. Deterministic: same scene in, same map out.
 *
 * Solved nodes are seeded and packed. Pinned nodes and fixed components keep
 * their authored coordinates and act as immovable bodies that the solved ones
 * must clear.
 */
export function planPlacement(scene: Scene): PlacementPlan {
	if (scene.layout === 'globe') {
		const nodes = scene.objects.filter((o) => o.kind === 'mesh.node');
		const radii = nodes.map((o) => o.node?.r ?? 34);
		const sph = packSphere(radii, { margin: 14 });
		// packSphere only sees the bodies ON the shell; the crest sits at its
		// centre, so the sphere has to clear that too.
		const radius = Math.max(sph.radius, scene.hub.r + 40 + (radii.length ? Math.max(...radii) : 0));
		const positions = new Map<string, Placed>();
		// Components are canvas furniture, not shell bodies — they keep their
		// authored spot while the globe turns behind them.
		for (const o of scene.objects) {
			if (o.kind !== 'component') continue;
			positions.set(o.id, { x: o.place.x ?? scene.hub.x, y: o.place.y ?? scene.hub.y });
		}
		positions.set('__hub__', { x: scene.hub.x, y: scene.hub.y });
		return {
			mode: 'globe',
			positions,
			globe: {
				radius,
				dirs: new Map(nodes.map((o, i) => [o.id, sph.dirs[i]])),
				baseR: new Map(nodes.map((o, i) => [o.id, radii[i]])),
			},
		};
	}
	return { mode: 'planar', positions: resolvePlacement(scene) };
}

/**
 * Placement at a moment. Planar layouts ignore `t` entirely; the globe projects
 * its directions through the current spin.
 *
 * Rotation is banked spin-enabled TIME, never a per-frame accumulator — so a
 * scrub to `t` shows the orientation playback would have reached, which is the
 * whole reason the timeline can be trusted.
 */
export function placementAt(scene: Scene, plan: PlacementPlan, t: number): Map<string, Placed> {
	if (plan.mode !== 'globe' || !plan.globe) return plan.positions;

	const yaw = GLOBE_REST.yaw + spinElapsedAt(scene, t) * SPIN_RATE;
	const out = new Map(plan.positions);
	for (const [id, dir] of plan.globe.dirs) {
		const p = project(spin(dir, yaw, GLOBE_REST.pitch), plan.globe.radius, GLOBE_REST.viewDistance);
		out.set(id, {
			x: scene.hub.x + p.x,
			y: scene.hub.y + p.y,
			scale: p.scale,
			depth: p.depth,
			front: p.front,
		});
	}
	return out;
}

/** The globe's yaw at `t` — the wireframe has to project with the same pose the
 *  nodes do, or the web slides off them. */
export function globePoseAt(scene: Scene, t: number) {
	return {
		yaw: GLOBE_REST.yaw + spinElapsedAt(scene, t) * SPIN_RATE,
		pitch: GLOBE_REST.pitch,
		viewDistance: GLOBE_REST.viewDistance,
	};
}

export function resolvePlacement(scene: Scene): Map<string, Placed> {
	const out = new Map<string, Placed>();

	// Planar only — the globe is handled by `planPlacement`, because a sphere
	// solves for directions and projects them, which `solveMeshLayout` says
	// outright is the caller's job.
	if (scene.layout === 'globe') return out;

	// Only mesh nodes take part in the mesh layout; components join the solve as
	// obstacles but are never moved by it.
	const nodes = scene.objects.filter((o) => o.kind === 'mesh.node');
	const obstacles = scene.objects.filter((o) => o.kind === 'component' && o.place.mode !== 'solved');

	// `spokes` is mutated in place by the solver, so build throwaway carriers
	// rather than handing it the scene's own objects.
	const spokes = nodes.map((o) => ({
		x: o.place.x ?? scene.hub.x,
		y: o.place.y ?? scene.hub.y,
		r: o.node?.r ?? 34,
	}));
	const pinned = nodes.map((o) => o.place.mode === 'pinned');

	// Obstacles ride along as extra pinned spokes: the solver has exactly one
	// notion of "immovable", so there is nothing to invent.
	const obstacleSpokes = obstacles.map((o) => ({
		x: o.place.x ?? scene.hub.x,
		y: o.place.y ?? scene.hub.y,
		r: componentRadius(o),
	}));

	const all = [...spokes, ...obstacleSpokes];
	const allPinned = [...pinned, ...obstacles.map(() => true)];

	if (all.length) {
		solveMeshLayout(all, {
			layout: scene.layout,
			hub: scene.hub,
			pinned: allPinned,
			lanes: scene.layout === 'radial',
			laneClearance: 12,
		});
	}

	nodes.forEach((o, i) => out.set(o.id, { x: all[i].x, y: all[i].y }));
	obstacles.forEach((o, i) =>
		out.set(o.id, { x: obstacleSpokes[i].x, y: obstacleSpokes[i].y }),
	);
	// Components that never entered the solve (there are none today, but the
	// branch keeps the map total) fall back to their authored position.
	for (const o of scene.objects) {
		if (!out.has(o.id) && o.kind !== 'mesh.edge') {
			out.set(o.id, { x: o.place.x ?? scene.hub.x, y: o.place.y ?? scene.hub.y });
		}
	}
	out.set('__hub__', { x: scene.hub.x, y: scene.hub.y });
	return out;
}

/** The four placement authorities, as the UI states them. Kept next to the
 *  resolver so the label can never drift from the behaviour. */
export const PLACEMENT_LABEL: Record<string, { glyph: string; label: string; hint: string }> = {
	solved: {
		glyph: '⚙',
		label: 'SOLVED',
		hint: 'The layout places it. Drag to pin it and re-solve the rest around it.',
	},
	pinned: {
		glyph: '📌',
		label: 'PINNED',
		hint: 'You placed it. The solver packs everything else around it.',
	},
	fixed: {
		glyph: '✋',
		label: 'HAND',
		hint: 'You place it. It never moves on its own.',
	},
	// Globe nodes. There is nothing to pin: a position here is a projection of
	// yaw/pitch, not a stored coordinate, so the honest handle is the spin.
	projected: {
		glyph: '◐',
		label: 'PROJECTED',
		hint: 'Position comes from the sphere. Spin the globe — there is no x/y to pin.',
	},
};
