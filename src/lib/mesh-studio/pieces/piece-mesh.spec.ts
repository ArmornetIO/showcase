import { describe, it, expect, vi } from 'vitest';
import {
	PIECE_MESHES,
	meshForMode,
	PIECE_VERT_FLOATS,
	PIECE_EDGE_FLOATS,
	type PieceMesh
} from './piece-mesh.js';
import { ALL_PIECES, MODE_PIECES } from './piece-catalogue.js';
import { MODE_KEYS } from '../modes.gen.js';
import type { Piece, PieceVert } from './pieces.js';

// Everything the buffers are checked against is re-derived here from the
// catalogue. A test that asked `piece-mesh.ts` what it thinks the normal is
// would only prove it agrees with itself — and the whole point of the module is
// that the flattening did not quietly change the geometry on its way to the GPU.

type Vec = { e: number; n: number; h: number };

const sub = (a: Vec, b: Vec): Vec => ({ e: a.e - b.e, n: a.n - b.n, h: a.h - b.h });

const cross = (u: Vec, w: Vec): Vec => ({
	e: u.n * w.h - u.h * w.n,
	n: u.h * w.e - u.e * w.h,
	h: u.e * w.n - u.n * w.e
});

const dot = (a: Vec, b: Vec) => a.e * b.e + a.n * b.n + a.h * b.h;

const mag = (a: Vec) => Math.hypot(a.e, a.n, a.h);

/** The raw (unnormalised) outward normal of a source face, from the winding. */
const faceNormal = (verts: PieceVert[], face: number[]) =>
	cross(sub(verts[face[1]], verts[face[0]]), sub(verts[face[2]], verts[face[0]]));

const unit = (a: Vec) => {
	const m = mag(a) || 1;
	return { e: a.e / m, n: a.n / m, h: a.h / m };
};

/** Same point, allowing for the f32 the buffers are stored in. */
const near = (a: Vec, b: Vec) =>
	Math.abs(a.e - b.e) < 1e-5 && Math.abs(a.n - b.n) < 1e-5 && Math.abs(a.h - b.h) < 1e-5;

/** Vertex `i` of a buffer, unpacked. `verts` and `edges` share one interleave,
 *  which is the whole point of the layout — so one unpacker reads both. */
function at(buf: Float32Array, i: number, stride: number = PIECE_VERT_FLOATS) {
	const o = i * stride;
	return {
		local: { e: buf[o], n: buf[o + 1], h: buf[o + 2] },
		normal: { e: buf[o + 3], n: buf[o + 4], h: buf[o + 5] },
		hNorm: buf[o + 6]
	};
}

/** The edge buffer as pairs of unpacked vertices. */
function edgesOf(mesh: PieceMesh) {
	const out: [ReturnType<typeof at>, ReturnType<typeof at>][] = [];
	for (let i = 0; i < mesh.edges.length / PIECE_EDGE_FLOATS; i += 2) {
		out.push([at(mesh.edges, i, PIECE_EDGE_FLOATS), at(mesh.edges, i + 1, PIECE_EDGE_FLOATS)]);
	}
	return out;
}

/** Every face of a piece, flattened out of its solids: the raw normal from its
 *  winding, and its boundary as CONSECUTIVE corner pairs. Consecutive and not
 *  merely "both corners appear" — a quad contains both ends of its own diagonal
 *  too, and that face is not adjoining anything. */
function allFaces(piece: Piece) {
	const out: { raw: Vec; pairs: [Vec, Vec][] }[] = [];
	for (const solid of piece) {
		for (const face of solid.faces) {
			out.push({
				raw: faceNormal(solid.verts, face),
				pairs: face.map((k, i): [Vec, Vec] => [
					solid.verts[k],
					solid.verts[face[(i + 1) % face.length]]
				])
			});
		}
	}
	return out;
}

/** Area of a planar polygon: half the magnitude of the summed edge cross
 *  products about the origin. Independent of the fan the mesh chose, which is
 *  what makes it a check on the triangulation rather than a restatement of it. */
function polygonArea(verts: PieceVert[], face: number[]) {
	let s: Vec = { e: 0, n: 0, h: 0 };
	for (let i = 0; i < face.length; i++) {
		const c = cross(verts[face[i]], verts[face[(i + 1) % face.length]]);
		s = { e: s.e + c.e, n: s.n + c.n, h: s.h + c.h };
	}
	return mag(s) / 2;
}

/** Same micro-radius grid the module quantises edge endpoints onto — restated,
 *  not imported. Coarser and the key would merge distinct corners; finer and
 *  trig noise in the polygon footprints would split coincident ones. */
const grid = (x: number) => Math.round(x * 1e6);
const edgeKey = (a: Vec, b: Vec) => {
	const ka = `${grid(a.e)},${grid(a.n)},${grid(a.h)}`;
	const kb = `${grid(b.e)},${grid(b.n)},${grid(b.h)}`;
	return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

const entries = Object.entries(ALL_PIECES);

describe('the settlement, flattened', () => {
	it('flattens every building the catalogue names', () => {
		expect(Object.keys(PIECE_MESHES).sort()).toEqual(Object.keys(ALL_PIECES).sort());
	});

	for (const [id, piece] of entries) {
		const mesh = PIECE_MESHES[id];

		it(`${id} fans every face and keeps the source winding`, () => {
			// The contract the GL layer's `gl.frontFace(gl.CW)` rests on. A face
			// silently reversed here is not a shading glitch — it is a hole in the
			// solid that only appears on the bearing that turns it toward you.
			expect(mesh.verts.length).toBe(mesh.triangles * 3 * PIECE_VERT_FLOATS);

			let t = 0;
			for (const solid of piece) {
				for (const face of solid.faces) {
					const raw = faceNormal(solid.verts, face);
					for (let i = 1; i < face.length - 1; i++, t++) {
						const fan = [face[0], face[i], face[i + 1]].map((k) => solid.verts[k]);
						for (let c = 0; c < 3; c++) {
							const v = at(mesh.verts, t * 3 + c);
							expect(v.local.e, `${id} tri ${t}.${c} e`).toBe(Math.fround(fan[c].e));
							expect(v.local.n, `${id} tri ${t}.${c} n`).toBe(Math.fround(fan[c].n));
							expect(v.local.h, `${id} tri ${t}.${c} h`).toBe(Math.fround(fan[c].h));
							// Agrees in SIGN with the source face's own cross, and is unit.
							expect(dot(v.normal, raw), `${id} tri ${t} normal flipped`).toBeGreaterThan(0);
							expect(mag(v.normal)).toBeCloseTo(1, 6);
						}
					}
				}
			}
			expect(t, `${id} triangle count`).toBe(mesh.triangles);
		});

		it(`${id} conserves area through the fan`, () => {
			// Planar and convex, so the fan partitions the polygon exactly — any
			// overlap or gap (a face fanned from the wrong corner, an index dropped)
			// shows up as an area that no longer adds up.
			let t = 0;
			for (const solid of piece) {
				for (const face of solid.faces) {
					let fanned = 0;
					for (let i = 1; i < face.length - 1; i++, t++) {
						const a = at(mesh.verts, t * 3).local;
						const b = at(mesh.verts, t * 3 + 1).local;
						const c = at(mesh.verts, t * 3 + 2).local;
						fanned += mag(cross(sub(b, a), sub(c, a))) / 2;
					}
					expect(fanned, `${id} face [${face.join(',')}]`).toBeCloseTo(
						polygonArea(solid.verts, face),
						6
					);
				}
			}
		});

		it(`${id} still stands on the surface, inside its plot`, () => {
			// The catalogue's own contract, re-asserted on what the GPU will actually
			// receive: the flattening is where a stray offset would creep in.
			let minH = Infinity;
			let maxH = -Infinity;
			let maxE = 0;
			let maxN = 0;
			for (let i = 0; i < mesh.verts.length / PIECE_VERT_FLOATS; i++) {
				const l = at(mesh.verts, i).local;
				minH = Math.min(minH, l.h);
				maxH = Math.max(maxH, l.h);
				maxE = Math.max(maxE, Math.abs(l.e));
				maxN = Math.max(maxN, Math.abs(l.n));
			}
			expect(minH, 'floats or sinks').toBe(0);
			expect(maxH).toBeLessThanOrEqual(2);
			expect(maxE).toBeLessThanOrEqual(1);
			expect(maxN).toBeLessThanOrEqual(1);
		});

		it(`${id} normalises height against its own apex`, () => {
			const apex = Math.max(...piece.flatMap((s) => s.verts.map((v) => v.h)));
			expect(mesh.maxH).toBe(apex);

			let t = 0;
			for (const solid of piece) {
				for (const face of solid.faces) {
					for (let i = 1; i < face.length - 1; i++, t++) {
						const fan = [face[0], face[i], face[i + 1]].map((k) => solid.verts[k]);
						for (let c = 0; c < 3; c++) {
							const v = at(mesh.verts, t * 3 + c);
							expect(v.hNorm).toBe(Math.fround(fan[c].h / apex));
							expect(v.hNorm).toBeGreaterThanOrEqual(0);
							expect(v.hNorm).toBeLessThanOrEqual(1);
						}
					}
				}
			}
		});

		it(`${id} draws every boundary edge exactly once`, () => {
			const want = new Set<string>();
			for (const solid of piece) {
				for (const face of solid.faces) {
					for (let i = 0; i < face.length; i++) {
						want.add(edgeKey(solid.verts[face[i]], solid.verts[face[(i + 1) % face.length]]));
					}
				}
			}

			// f32 rounding moves an endpoint by ~1e-7 at most, which the 1e-6 grid
			// absorbs — so the emitted edges key identically to the source ones. This
			// is the claim that widening the edge vertex did not move any geometry.
			const got = edgesOf(mesh).map((edge) => edgeKey(edge[0].local, edge[1].local));

			expect(mesh.edges.length % (2 * PIECE_EDGE_FLOATS), 'whole edges').toBe(0);
			expect(new Set(got).size, `${id} emits a duplicate edge`).toBe(got.length);
			expect(new Set(got)).toEqual(want);
		});

		it(`${id} gives every edge vertex a real face normal`, () => {
			// The bug this exists for: the edge pass culls with the same
			// `normal · axis` test the faces do, so a bare position would put
			// `normalize(vec3(0))` — NaN — into the cull and the wireframe would
			// vanish in patches. An edge has no normal of its own; it must borrow a
			// genuine one from a face it actually lies on.
			const faces = allFaces(piece);

			for (const edge of edgesOf(mesh)) {
				const [p, q] = edge;
				expect(mag(p.normal)).toBeCloseTo(1, 6);
				expect(mag(q.normal)).toBeCloseTo(1, 6);
				// Both endpoints of a line share one normal — the shader culls the
				// whole primitive, so a disagreement would be meaningless.
				expect(q.normal).toEqual(p.normal);

				expect(p.hNorm).toBeCloseTo(p.local.h / mesh.maxH, 6);
				expect(q.hNorm).toBeCloseTo(q.local.h / mesh.maxH, 6);

				// Containment re-derived here rather than taken on trust: the faces
				// that carry this exact pair along their boundary.
				const owners = faces.filter((f) =>
					f.pairs.some(
						([a, b]) =>
							(near(a, p.local) && near(b, q.local)) || (near(a, q.local) && near(b, p.local))
					)
				);
				expect(owners.length, `${id} edge belongs to no face`).toBeGreaterThan(0);
				const match = owners.some((f) => {
					const u = unit(f.raw);
					return (
						Math.abs(u.e - p.normal.e) < 1e-6 &&
						Math.abs(u.n - p.normal.n) < 1e-6 &&
						Math.abs(u.h - p.normal.h) < 1e-6
					);
				});
				expect(match, `${id} edge borrowed a normal from no adjoining face`).toBe(true);

				// The tie-break, stated as a property: nothing adjoining it faces
				// further up than what it took.
				const highest = Math.max(...owners.map((f) => unit(f.raw).h));
				expect(p.normal.h).toBeGreaterThan(highest - 1e-6);
			}
		});
	}
});

describe('modes', () => {
	it('stands every mode in a flattened building', () => {
		// The catalogue guarantees a mode has a SHAPE; this is the separate claim
		// that the shape survived flattening and is something the GPU can draw.
		for (const key of MODE_KEYS) {
			const mesh = meshForMode(key);
			expect(mesh, key).toBeDefined();
			expect(mesh!.triangles, key).toBeGreaterThan(0);
			expect(mesh, key).toBe(PIECE_MESHES[MODE_PIECES[key]]);
		}
	});

	it('has nothing for a mode that has no building', () => {
		expect(meshForMode('no_such_mode')).toBeUndefined();
	});
});

describe('determinism', () => {
	it('builds the same buffers on a fresh evaluation', () => {
		// Everything is computed once at load, so "the same twice" is the only
		// guarantee that nothing leaked in from iteration order or a shared scratch
		// buffer — either of which would show as a building that renders correctly
		// until the day the module is loaded in a different order.
		vi.resetModules();
		return import('./piece-mesh.js').then((again) => {
			expect(again.PIECE_MESHES).not.toBe(PIECE_MESHES);
			for (const id of Object.keys(PIECE_MESHES)) {
				expect(again.PIECE_MESHES[id].verts, id).toEqual(PIECE_MESHES[id].verts);
				expect(again.PIECE_MESHES[id].edges, id).toEqual(PIECE_MESHES[id].edges);
				expect(again.PIECE_MESHES[id].triangles, id).toBe(PIECE_MESHES[id].triangles);
				expect(again.PIECE_MESHES[id].maxH, id).toBe(PIECE_MESHES[id].maxH);
			}
		});
	});
});
