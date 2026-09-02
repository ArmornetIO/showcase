import { describe, it, expect } from 'vitest';
import { PIECES, box, gable, tooth, type Solid } from './pieces.js';

/** Cross product of the first two edges of a face — the outward normal, IF the
 *  face is wound counter-clockwise seen from outside. Re-derived here rather
 *  than imported: a test that reuses the renderer's own maths only proves the
 *  two agree with each other. */
function normal(s: Solid, face: number[]) {
	const [a, b, c] = face.map((i) => s.verts[i]);
	const u = { e: b.e - a.e, n: b.n - a.n, h: b.h - a.h };
	const w = { e: c.e - a.e, n: c.n - a.n, h: c.h - a.h };
	return {
		e: u.n * w.h - u.h * w.n,
		n: u.h * w.e - u.e * w.h,
		h: u.e * w.n - u.n * w.e
	};
}

function centroid(verts: { e: number; n: number; h: number }[]) {
	return verts.reduce(
		(acc, v, _, arr) => ({
			e: acc.e + v.e / arr.length,
			n: acc.n + v.n / arr.length,
			h: acc.h + v.h / arr.length
		}),
		{ e: 0, n: 0, h: 0 }
	);
}

/** Every face points AWAY from the solid it belongs to.
 *
 *  This is the whole contract `pieces.ts` offers the renderer: back-face culling
 *  and shading are both `normal · viewer`, so one face wound backwards is not a
 *  subtle error — it is a hole in the solid, through which you see its inside.
 *  And on a static globe you would never notice; it only shows up on the spin
 *  that turns that face toward you. */
function assertOutward(solid: Solid, what: string) {
	const c = centroid(solid.verts);
	for (const face of solid.faces) {
		const nrm = normal(solid, face);
		const fc = centroid(face.map((i) => solid.verts[i]));
		const away = (fc.e - c.e) * nrm.e + (fc.n - c.n) * nrm.n + (fc.h - c.h) * nrm.h;
		expect(away, `${what} face [${face.join(',')}] is wound inside-out`).toBeGreaterThan(0);
	}
}

describe('piece primitives', () => {
	it('winds a box outward on every face', () => {
		assertOutward(box(-1, 1, -1, 1, 0, 2), 'box');
	});

	it('winds a gable outward on every face', () => {
		assertOutward(gable(1, -1, 1, 0, 1.5), 'gable');
	});

	it('winds a sawtooth outward on every face', () => {
		assertOutward(tooth(0, 1, -1, 1, 0, 0.8), 'tooth');
	});

	it('closes a box: six faces, eight corners', () => {
		const b = box(-1, 1, -2, 2, 0, 3);
		expect(b.verts).toHaveLength(8);
		expect(b.faces).toHaveLength(6);
		// Every edge of a closed solid is shared by exactly two faces.
		const edges = new Map<string, number>();
		for (const f of b.faces)
			for (let i = 0; i < f.length; i++) {
				const key = [f[i], f[(i + 1) % f.length]].sort((x, y) => x - y).join('-');
				edges.set(key, (edges.get(key) ?? 0) + 1);
			}
		expect([...edges.values()].every((count) => count === 2)).toBe(true);
	});
});

describe('the pieces', () => {
	for (const [id, piece] of Object.entries(PIECES)) {
		it(`${id} is built from outward-wound convex parts`, () => {
			expect(piece.length).toBeGreaterThan(0);
			piece.forEach((solid, i) => assertOutward(solid, `${id}[${i}]`));
		});

		it(`${id} stands ON the surface and inside its own plot`, () => {
			const all = piece.flatMap((s) => s.verts);
			// Nothing below the ground: a piece sits on the sphere, not in it.
			expect(Math.min(...all.map((v) => v.h))).toBe(0);
			// Nothing taller than it is wide by much, and nothing overhanging far
			// past the node's own radius — a piece that spills sideways collides
			// with its neighbours the moment the globe packs tighter.
			expect(Math.max(...all.map((v) => v.h))).toBeLessThanOrEqual(2);
			expect(Math.max(...all.map((v) => Math.abs(v.e)))).toBeLessThanOrEqual(1);
			expect(Math.max(...all.map((v) => Math.abs(v.n)))).toBeLessThanOrEqual(1);
		});
	}
});
