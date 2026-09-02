// ── mesh-studio/piece-mesh — the buildings, flattened for the GPU ────────────
// `pieces.ts` authors solids the way a draughtsman would: a bag of corners and a
// list of index loops round them. That is the right shape to WRITE a building in
// and the wrong one to draw a hundred of. This turns each catalogue entry into
// the two buffers a WebGL2 draw call actually wants, once, at module load —
// after which a frame costs a uniform update and a `drawArrays`, and the ~1,300
// per-frame `<path>` mutations `NodePiece.svelte` performs go away entirely.
//
// The flattening is deliberately lossy in one direction only: vertices are NOT
// shared between faces. A shared corner would have to carry an averaged normal,
// and an averaged normal is a smooth shade — the exact thing the three hard
// bands exist to avoid, because at 40 pixels a smooth ramp turns a building into
// a lump. Duplicating corners per face is what keeps every plane flat and
// distinct. The cost is ~3× the vertices of an indexed mesh, on shapes of a few
// hundred triangles; it does not matter.
//
// WINDING — the one fact the GL layer depends on and cannot re-derive:
//   Faces arrive counter-clockwise seen from OUTSIDE, in the right-handed local
//   (e, n, h) frame. But the renderer's screen-y points DOWN, so that same loop
//   projects CLOCKWISE. The GL layer therefore sets `gl.frontFace(gl.CW)`. This
//   module must not "tidy" or re-order any loop: that constant is only correct
//   while the emitted winding is faithfully the source's.
//
// Pure: no DOM, no Svelte, no GL calls. It knows about arrays of numbers.
import type { ModeKey } from '../modes.gen.js';
import { ALL_PIECES, MODE_PIECES } from './piece-catalogue.js';
import type { Piece, PieceVert } from './pieces.js';

/** Floats per vertex in `PieceMesh.verts`. The GL layer's `vertexAttribPointer`
 *  stride is this times 4 — exported so the number lives in one place rather
 *  than being retyped where the attributes are bound. */
export const PIECE_VERT_FLOATS = 7;

/** Floats per vertex in `PieceMesh.edges` — the SAME interleave as `verts`, so
 *  both buffers bind against one static attribute layout and the shader's
 *  back-face cull works identically on a line and on a triangle. Separate name
 *  because they are separate buffers, not because the number can differ. */
export const PIECE_EDGE_FLOATS = 7;

/** One piece, flattened for the GPU. Built once at module load. */
export interface PieceMesh {
	/** Interleaved static vertices, 7 floats each:
	 *    aLocal  vec3 (e, n, h)   — piece-local, in node radii
	 *    aNormal vec3 (e, n, h)   — the FACE's local normal, normalised
	 *    aHNorm  float            — aLocal.h / maxH for this piece, 0..1
	 *  Vertices are NOT shared between faces: each triangle carries its own
	 *  face normal, which is what makes the flat three-band shading work.
	 *
	 *  Emission order is solid, then face, then fan — the source's own order.
	 *  Nothing in the draw depends on it, but it is what lets a test walk the
	 *  catalogue alongside the buffer and check them off against each other. */
	verts: Float32Array;
	/** Triangle count (verts.length / 7 / 3). */
	triangles: number;
	/** Deduped edge list for the wireframe pass, ready for `gl.LINES`: two
	 *  vertices per edge in the SAME 7-float interleave as `verts`, so 14 floats
	 *  per edge and `edges.length / 7` vertices.
	 *
	 *  Carrying a normal on a LINE looks redundant until you remember the edge
	 *  pass culls with the same `normal · axis` test the faces do — a bare
	 *  position would normalise a zero vector into NaN and the wireframe would
	 *  cull at random. An edge has no normal of its own, so it borrows one; see
	 *  the tie-break where the buffer is built. */
	edges: Float32Array;
	/** Tallest vertex, in node radii. */
	maxH: number;
}

/** Quantiser for the edge dedupe key. Positions come out of `cos`/`sin` in the
 *  polygon footprints, so two corners that are the same corner can differ in the
 *  last bits; a micro-radius grid is far finer than any feature of a piece
 *  (~0.06 radii at the tightest) and far coarser than that noise. */
const GRID = 1e6;

const key = (x: number, y: number, z: number) =>
	`${Math.round(x * GRID)},${Math.round(y * GRID)},${Math.round(z * GRID)}`;

/** One deduped edge, mid-build: its two endpoints and the normal it borrowed. */
interface EdgeRun {
	p: PieceVert;
	q: PieceVert;
	ne: number;
	nn: number;
	nh: number;
}

function build(piece: Piece): PieceMesh {
	let maxH = 0;
	for (const solid of piece) for (const v of solid.verts) if (v.h > maxH) maxH = v.h;
	// A flat piece would be a bug upstream, not something to render; the guard is
	// only here so it fails as a visibly wrong building rather than as a buffer
	// full of NaN, which shows up as nothing at all and looks like a GL problem.
	const invH = maxH > 0 ? 1 / maxH : 0;

	let triangles = 0;
	for (const solid of piece) for (const f of solid.faces) triangles += f.length - 2;

	const verts = new Float32Array(triangles * 3 * PIECE_VERT_FLOATS);
	// Keyed by the pair of ENDPOINT POSITIONS, not by index — indices are local to
	// a solid, and pieces stack solids that meet exactly (a sawtooth on a shed
	// shares its whole eaves line with the next tooth). A topological dedupe would
	// leave those edges drawn twice, which on an additively-blended wireframe is a
	// visible bright seam wherever two parts touch.
	const seen = new Map<string, EdgeRun>();

	let o = 0;
	for (const solid of piece) {
		for (const face of solid.faces) {
			const a = solid.verts[face[0]];
			const b = solid.verts[face[1]];
			const c = solid.verts[face[2]];
			// The local frame is orthonormal and right-handed, so the plain cross of
			// two edges IS the normal — and the counter-clockwise-from-outside winding
			// is what makes it point outward. Three corners are enough because faces
			// are planar by construction; a Newell sum would buy nothing here.
			const ue = b.e - a.e;
			const un = b.n - a.n;
			const uh = b.h - a.h;
			const we = c.e - a.e;
			const wn = c.n - a.n;
			const wh = c.h - a.h;
			const ne = un * wh - uh * wn;
			const nn = uh * we - ue * wh;
			const nh = ue * wn - un * we;
			const len = Math.hypot(ne, nn, nh) || 1;
			const nex = ne / len;
			const nnx = nn / len;
			const nhx = nh / len;

			// Fan from the first corner. Only valid because every face is convex —
			// which `pieces.ts` guarantees by only ever emitting convex parts, the
			// same guarantee its exact back-face culling rests on.
			for (let i = 1; i < face.length - 1; i++) {
				for (const v of [solid.verts[face[0]], solid.verts[face[i]], solid.verts[face[i + 1]]]) {
					verts[o] = v.e;
					verts[o + 1] = v.n;
					verts[o + 2] = v.h;
					verts[o + 3] = nex;
					verts[o + 4] = nnx;
					verts[o + 5] = nhx;
					verts[o + 6] = v.h * invH;
					o += PIECE_VERT_FLOATS;
				}
			}

			for (let i = 0; i < face.length; i++) {
				const p = solid.verts[face[i]];
				const q = solid.verts[face[(i + 1) % face.length]];
				const kp = key(p.e, p.n, p.h);
				const kq = key(q.e, q.n, q.h);
				// Sorted, so the two faces that share an edge — which traverse it in
				// opposite directions, that being what makes the solid closed — agree
				// on one key.
				const k = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
				const had = seen.get(k);
				// An edge belongs to two faces and has no normal of its own, so it
				// borrows the MORE UPWARD-FACING one. A roof edge shared with a wall
				// then stays visible when the wall turns away, which is the case that
				// matters: the eye reads the top silhouette first, and rooflines that
				// wink out at glancing angles cost more than a wall edge lingering a
				// few degrees too long. Strictly-greater, so a tie keeps the face seen
				// first — the buffer must not depend on Map iteration luck.
				if (!had) seen.set(k, { p, q, ne: nex, nn: nnx, nh: nhx });
				else if (nhx > had.nh) {
					// Only the normal is taken from the winning face. The endpoints stay
					// the first ones seen: two solids that meet agree on a corner only to
					// within the dedupe grid, and swapping which of the two near-identical
					// positions is emitted would make the buffer depend on face order for
					// no gain.
					had.ne = nex;
					had.nn = nnx;
					had.nh = nhx;
				}
			}
		}
	}

	const edges = new Float32Array(seen.size * 2 * PIECE_EDGE_FLOATS);
	let eo = 0;
	for (const s of seen.values()) {
		for (const v of [s.p, s.q]) {
			edges[eo] = v.e;
			edges[eo + 1] = v.n;
			edges[eo + 2] = v.h;
			edges[eo + 3] = s.ne;
			edges[eo + 4] = s.nn;
			edges[eo + 5] = s.nh;
			edges[eo + 6] = v.h * invH;
			eo += PIECE_EDGE_FLOATS;
		}
	}

	return { verts, triangles, edges, maxH };
}

/** Every building in the settlement, flattened. */
export const PIECE_MESHES: Record<string, PieceMesh> = Object.freeze(
	Object.fromEntries(Object.entries(ALL_PIECES).map(([id, piece]) => [id, build(piece)]))
);

/** Mode key → mesh, mirroring MODE_PIECES.
 *
 *  Two lookups and no allocation: this is called per node per frame, and a
 *  helper that built anything would put the whole settlement through the
 *  collector every time the globe turned. */
export function meshForMode(mode: string): PieceMesh | undefined {
	// `string` in, same as `pieceForMode` and for the same reason — see its note
	// on why the table being total does not make this lookup infallible.
	const id = MODE_PIECES[mode as ModeKey] as string | undefined;
	return id ? PIECE_MESHES[id] : undefined;
}
