// ── physics/hull — convex solids, and a box swept through them ───────────────
// The first 3D module here, and it keeps the module's rule: a hull is a set of
// planes and a bounding box, with no idea what it stands for. Whatever adapts a
// building, a crate or a cliff into hulls lives with that thing, not here.
//
// The model is the brush collision first-person engines have walked on for
// decades. A convex
// solid IS the intersection of its face planes' back half-spaces, so testing a
// moving box against it collapses to testing a moving POINT against the same
// planes pushed out by how far the box reaches along each normal. That turns
// the swept query into clipping a segment against half-spaces — a few dot
// products per plane, and it cannot tunnel at any speed, because nothing is
// sampled: the hit is solved for, not stumbled on.
//
// Pushing a plane out is exact on a face and generous at an edge: two pushed
// planes meeting at a sharp ridge cross well beyond the real corner, so a gable
// apex would grow an invisible spike. Six axis-aligned bevel planes at each
// solid's bounding box cap that spike at the box's own half-size. Edge bevels
// would go further; they are left out until somebody actually snags on one.
//
// Pure: no Svelte, no DOM, no dependencies, no knowledge of what a hull is.
import type { Vec3 } from './sphere.js';

/** A face plane: points `p` on it satisfy `n · p = d`; the solid is behind it. */
export interface Plane {
	nx: number;
	ny: number;
	nz: number;
	d: number;
	/** Plain data the adapter decides. Bevels and world limits are never climbable. */
	climbable: boolean;
}

/** One convex solid. */
export interface Hull {
	/** Face planes, then the bevels. */
	planes: Plane[];
	min: Vec3;
	max: Vec3;
}

export interface World {
	hulls: Hull[];
	/** An infinite floor: everything below this height is solid. */
	groundY: number;
	/** Walls that keep anything inside; only x and z are used. */
	bounds: { min: Vec3; max: Vec3 };
}

export interface Trace {
	/** How much of `from → to` was travelled before the hit, 0..1. */
	fraction: number;
	end: Vec3;
	/** What was hit, or null for a clear path. */
	plane: Plane | null;
	/** The box was already inside something at `from`. */
	startSolid: boolean;
}

/** How far short of a surface every hit stops. Without it a resting box sits
 *  exactly ON the plane, and the next trace starts inside it by rounding error. */
export const SKIN = 0.001;

/**
 * Build a hull from world-space corners and face loops, wound counter-clockwise
 * seen from outside (which is what makes the plain cross product point out).
 * Throws on a solid that is not convex: a concave one would make "behind every
 * plane" include space that is not solid, and the walker would stand on air.
 */
export function hullFromFaces(verts: Vec3[], faces: number[][], climbable: boolean[] = []): Hull {
	const planes: Plane[] = faces.map((f, i) => {
		const a = verts[f[0]];
		const b = verts[f[1]];
		const c = verts[f[2]];
		const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
		const wx = c.x - a.x, wy = c.y - a.y, wz = c.z - a.z;
		let nx = uy * wz - uz * wy;
		let ny = uz * wx - ux * wz;
		let nz = ux * wy - uy * wx;
		const len = Math.hypot(nx, ny, nz) || 1;
		nx /= len;
		ny /= len;
		nz /= len;
		return { nx, ny, nz, d: nx * a.x + ny * a.y + nz * a.z, climbable: !!climbable[i] };
	});

	const min = { x: Infinity, y: Infinity, z: Infinity };
	const max = { x: -Infinity, y: -Infinity, z: -Infinity };
	for (const v of verts) {
		min.x = Math.min(min.x, v.x); min.y = Math.min(min.y, v.y); min.z = Math.min(min.z, v.z);
		max.x = Math.max(max.x, v.x); max.y = Math.max(max.y, v.y); max.z = Math.max(max.z, v.z);
	}
	// Relative to the solid's size: corners come out of cos/sin in the footprints,
	// so a 14m building carries noise a unit cube would not.
	const tol = 1e-6 * Math.max(1, max.x - min.x, max.y - min.y, max.z - min.z);
	for (const p of planes)
		for (const v of verts)
			if (p.nx * v.x + p.ny * v.y + p.nz * v.z - p.d > tol) throw new Error('hullFromFaces: solid is not convex');

	const axes: [number, number, number, number][] = [
		[1, 0, 0, max.x], [-1, 0, 0, -min.x],
		[0, 1, 0, max.y], [0, -1, 0, -min.y],
		[0, 0, 1, max.z], [0, 0, -1, -min.z]
	];
	for (const [nx, ny, nz, d] of axes)
		if (!planes.some((p) => p.nx * nx + p.ny * ny + p.nz * nz > 0.9999))
			planes.push({ nx, ny, nz, d, climbable: false });

	return { planes, min, max };
}

/** The ground and the four world walls, as one-plane "hulls" — a half-space is
 *  a convex solid too, so they go through the exact same clip. Cached per world
 *  because `trace` runs a dozen times a step. */
/** Broadphase: each hull filed under every CELL-metre square of x/z its box
 *  touches. Built on first trace and rebuilt if the hull list changes length;
 *  `seen` stamps a hull once per query so one spanning several cells clips once. */
const CELL = 4;
const NONE: number[] = [];
const cell = (v: number) => Math.floor(v / CELL);
const key = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
interface Grid {
	n: number;
	cells: Map<number, number[]>;
	seen: Uint32Array;
	query: number;
}
const grids = new WeakMap<World, Grid>();
function gridOf(world: World): Grid {
	const hit = grids.get(world);
	if (hit && hit.n === world.hulls.length) return hit;
	const cells = new Map<number, number[]>();
	world.hulls.forEach((h, i) => {
		for (let cx = cell(h.min.x); cx <= cell(h.max.x); cx++)
			for (let cz = cell(h.min.z); cz <= cell(h.max.z); cz++) {
				const k = key(cx, cz);
				const list = cells.get(k);
				if (list) list.push(i);
				else cells.set(k, [i]);
			}
	});
	const g = { n: world.hulls.length, cells, seen: new Uint32Array(world.hulls.length), query: 0 };
	grids.set(world, g);
	return g;
}

const limitsOf = new WeakMap<World, Plane[]>();
function limits(world: World): Plane[] {
	let l = limitsOf.get(world);
	if (!l) {
		const { min, max } = world.bounds;
		l = [
			{ nx: 0, ny: 1, nz: 0, d: world.groundY, climbable: false },
			{ nx: 1, ny: 0, nz: 0, d: min.x, climbable: false },
			{ nx: -1, ny: 0, nz: 0, d: -max.x, climbable: false },
			{ nx: 0, ny: 0, nz: 1, d: min.z, climbable: false },
			{ nx: 0, ny: 0, nz: -1, d: -max.z, climbable: false }
		];
		limitsOf.set(world, l);
	}
	return l;
}

/** Running result of one trace, shared across the hulls it is clipped against. */
interface Best {
	fraction: number;
	plane: Plane | null;
	startSolid: boolean;
}

/**
 * Clip the centre's path against one solid's pushed-out planes — the classic
 * clip-box-to-brush, in metres. Enter is the latest plane crossed going in,
 * leave the earliest going out; a hit is enter < leave.
 */
function clip(planes: Plane[], from: Vec3, to: Vec3, half: Vec3, best: Best): void {
	let enter = -1;
	let leave = 1;
	let hit: Plane | null = null;
	let startOut = false;
	for (const p of planes) {
		const dist = p.d + Math.abs(p.nx) * half.x + Math.abs(p.ny) * half.y + Math.abs(p.nz) * half.z;
		const d1 = p.nx * from.x + p.ny * from.y + p.nz * from.z - dist;
		const d2 = p.nx * to.x + p.ny * to.y + p.nz * to.z - dist;
		if (d1 > 0) startOut = true;
		// Fully in front of one plane for the whole move: cannot touch this solid.
		if (d1 > 0 && (d2 >= SKIN || d2 >= d1)) return;
		if (d1 <= 0 && d2 <= 0) continue;
		if (d1 > d2) {
			const f = Math.max(0, (d1 - SKIN) / (d1 - d2));
			if (f > enter) {
				enter = f;
				hit = p;
			}
		} else {
			const f = Math.min(1, (d1 + SKIN) / (d1 - d2));
			if (f < leave) leave = f;
		}
	}
	if (!startOut) {
		// Started inside. Report it, and let the move proceed so a walker that
		// spawned or rounded its way in can still walk back out.
		best.startSolid = true;
		return;
	}
	if (enter < leave && enter > -1 && enter < best.fraction) {
		best.fraction = enter;
		best.plane = hit;
	}
}

/**
 * Sweep an axis-aligned box (half-extents `half`, centred on the path) from
 * `from` to `to`. Returns the earliest hit across every hull, the ground and the
 * world walls.
 */
export function trace(world: World, from: Vec3, to: Vec3, half: Vec3): Trace {
	const best: Best = { fraction: 1, plane: null, startSolid: false };
	const lox = Math.min(from.x, to.x) - half.x, hix = Math.max(from.x, to.x) + half.x;
	const loy = Math.min(from.y, to.y) - half.y, hiy = Math.max(from.y, to.y) + half.y;
	const loz = Math.min(from.z, to.z) - half.z, hiz = Math.max(from.z, to.z) + half.z;
	// Only the hulls filed under the cells the sweep crosses — an office of
	// cubicles is ~1500 hulls, and a walker traces several times a step.
	const g = gridOf(world);
	const q = ++g.query;
	for (let cx = cell(lox); cx <= cell(hix); cx++)
		for (let cz = cell(loz); cz <= cell(hiz); cz++)
			for (const i of g.cells.get(key(cx, cz)) ?? NONE) {
				if (g.seen[i] === q) continue;
				g.seen[i] = q;
				const h = world.hulls[i];
				if (hix < h.min.x || lox > h.max.x || hiy < h.min.y || loy > h.max.y || hiz < h.min.z || loz > h.max.z) continue;
				clip(h.planes, from, to, half, best);
			}
	for (const p of limits(world)) clip([p], from, to, half, best);

	const f = best.fraction;
	return {
		fraction: f,
		end: { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f, z: from.z + (to.z - from.z) * f },
		plane: best.plane,
		startSolid: best.startSolid
	};
}
