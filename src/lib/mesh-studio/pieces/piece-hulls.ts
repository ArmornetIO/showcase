// ── mesh-studio/piece-hulls — the buildings, flattened for physics ───────────
// `piece-mesh` flattens a piece for the GPU; this flattens the same piece for
// `physics/hull`. It is the ONE file that knows both what a piece is and what a
// hull is — physics stays ignorant of buildings, and the catalogue of physics.
//
// The pieces need no collision meshes of their own: every solid in the
// catalogue is already convex and wound counter-clockwise from outside
// (`piece-catalogue.spec.ts` enforces it), which is exactly what a hull is.
//
// Each face is also given a CLASS — walkable, climbable or wall — decided once,
// here, from its local normal. Physics carries the climbable bit as plain data;
// the dev overlay paints all three so you can see what the walker thinks of a
// building before you try to climb it.
//
// Pure: no Svelte, no DOM, no GL.
import { ALL_PIECES } from './piece-catalogue.js';
import type { Solid } from './pieces.js';
import { hullFromFaces, type Hull } from '../../physics/hull.js';
import type { Vec3 } from '../../physics/sphere.js';

/** A piece standing in a y-up metre world. */
export interface Placement {
	piece: string;
	x: number;
	z: number;
	/** Turn about +y, radians. */
	yaw: number;
	/** Metres per node radius. */
	scale: number;
}

export type FaceClass = 'walkable' | 'climbable' | 'wall';

/** Solids of a piece whose VERTICAL walls are climbable too, by index into the
 *  piece's solid list; `'all'` for every solid. Filled for the pieces that have
 *  no battered walls (specs/056 research R7). */
export const CLIMB_OVERRIDES: Record<string, 'all' | number[]> = {};

/** cos 45° — the same floor limit as `WALKER_DEFAULTS.walkableNy`. */
const WALKABLE = 0.7;

/** Leaning walls and steep pitches: too steep to stand on, not sheer. */
export const climbableByDefault = (nh: number): boolean => nh > 0.02 && nh < WALKABLE;

function localNormal(s: Solid, f: number[]): { e: number; n: number; h: number } {
	const a = s.verts[f[0]], b = s.verts[f[1]], c = s.verts[f[2]];
	const ue = b.e - a.e, un = b.n - a.n, uh = b.h - a.h;
	const we = c.e - a.e, wn = c.n - a.n, wh = c.h - a.h;
	const e = un * wh - uh * wn, n = uh * we - ue * wh, h = ue * wn - un * we;
	const len = Math.hypot(e, n, h) || 1;
	return { e: e / len, n: n / len, h: h / len };
}

function classify(piece: string, solid: number, nh: number): FaceClass {
	if (nh >= WALKABLE) return 'walkable';
	if (climbableByDefault(nh)) return 'climbable';
	const o = CLIMB_OVERRIDES[piece];
	if (o && Math.abs(nh) <= 0.02 && (o === 'all' || o.includes(solid))) return 'climbable';
	return 'wall';
}

/** One hull per solid of the placed piece. Local (e, n, h) goes to world via
 *  (e, h, −n) — the mockup's frame — then the placement's turn, scale and seat. */
export function hullsForPlacement(p: Placement): Hull[] {
	const c = Math.cos(p.yaw) * p.scale;
	const s = Math.sin(p.yaw) * p.scale;
	return ALL_PIECES[p.piece].map((solid, si) => {
		const verts: Vec3[] = solid.verts.map((v) => ({
			x: p.x + c * v.e + s * -v.n,
			y: p.scale * v.h,
			z: p.z - s * v.e + c * -v.n
		}));
		const climbable = solid.faces.map((f) => classify(p.piece, si, localNormal(solid, f).h) === 'climbable');
		return hullFromFaces(verts, solid.faces, climbable);
	});
}

const overlays = new Map<string, Record<FaceClass, Float32Array>>();

/** Every face of a piece, split by class, as piece-LOCAL triangles in the
 *  `PieceMesh.verts` layout (e, n, h, normal, h/maxH). Fanned from the first
 *  corner exactly as `piece-mesh` fans them, so an overlay lands on the very
 *  same depths as the faces under it and wins a LEQUAL test instead of
 *  z-fighting. Cached per piece. */
export function faceClassOverlay(piece: string): Record<FaceClass, Float32Array> {
	const hit = overlays.get(piece);
	if (hit) return hit;
	const solids = ALL_PIECES[piece];
	let maxH = 0;
	for (const s of solids) for (const v of s.verts) maxH = Math.max(maxH, v.h);
	const out: Record<FaceClass, number[]> = { walkable: [], climbable: [], wall: [] };
	solids.forEach((s, si) => {
		for (const f of s.faces) {
			const nrm = localNormal(s, f);
			const into = out[classify(piece, si, nrm.h)];
			for (let i = 1; i < f.length - 1; i++)
				for (const v of [s.verts[f[0]], s.verts[f[i]], s.verts[f[i + 1]]])
					into.push(v.e, v.n, v.h, nrm.e, nrm.n, nrm.h, maxH ? v.h / maxH : 0);
		}
	});
	const res = {
		walkable: new Float32Array(out.walkable),
		climbable: new Float32Array(out.climbable),
		wall: new Float32Array(out.wall)
	};
	overlays.set(piece, res);
	return res;
}
