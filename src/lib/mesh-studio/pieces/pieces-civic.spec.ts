import { describe, it, expect } from 'vitest';
import {
	CIVIC_PIECES,
	CIVIC_MODE_PIECES,
	prism,
	taper,
	pyramid,
	ngon,
	rect,
	ridgeE,
	tiltE,
	type Foot
} from './pieces-civic.js';
import type { Solid } from './pieces.js';

/** Cross product of the first two edges of a face — the outward normal, IF the
 *  face is wound counter-clockwise seen from outside. Re-derived here rather
 *  than imported, for the same reason `pieces.spec.ts` re-derives it: a test
 *  that reuses the renderer's own maths only proves the two agree. */
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
 *  The renderer culls and shades from `normal · viewer`, so a face wound
 *  backwards is not a shading bug — it is a hole through which you see the
 *  inside of the building, and only on the part of the spin that turns it
 *  toward you. */
function assertOutward(solid: Solid, what: string) {
	const c = centroid(solid.verts);
	for (const face of solid.faces) {
		const nrm = normal(solid, face);
		const fc = centroid(face.map((i) => solid.verts[i]));
		const away = (fc.e - c.e) * nrm.e + (fc.n - c.n) * nrm.n + (fc.h - c.h) * nrm.h;
		expect(away, `${what} face [${face.join(',')}] is wound inside-out`).toBeGreaterThan(0);
	}
}

/** Every face is FLAT.
 *
 *  The renderer takes one normal per face, from its first three vertices, and
 *  shades the whole polygon with it. A quad that bows — which is what a
 *  non-uniformly tapered wall does — gets lit as though it were the plane of its
 *  first corner, so it reads at the wrong brightness and its contour isolines
 *  land in the wrong place. Only quads and larger can fail this; triangles are
 *  planar by definition. */
function assertPlanar(solid: Solid, what: string) {
	for (const face of solid.faces) {
		if (face.length < 4) continue;
		const nrm = normal(solid, face);
		const len = Math.hypot(nrm.e, nrm.n, nrm.h);
		const a = solid.verts[face[0]];
		for (const i of face.slice(3)) {
			const v = solid.verts[i];
			const off =
				((v.e - a.e) * nrm.e + (v.n - a.n) * nrm.n + (v.h - a.h) * nrm.h) / len;
			expect(Math.abs(off), `${what} face [${face.join(',')}] is not flat`).toBeLessThan(1e-7);
		}
	}
}

/** Every part is CONVEX: no vertex sits outside the plane of any face.
 *
 *  This is the assumption the whole hidden-surface pass rests on. Culling
 *  back-facing polygons is only exact on a convex solid; on a concave one a
 *  front-facing face can still be hidden by another part of the same solid, and
 *  no amount of depth sorting between PARTS will fix it. */
function assertConvex(solid: Solid, what: string) {
	for (const face of solid.faces) {
		const nrm = normal(solid, face);
		const len = Math.hypot(nrm.e, nrm.n, nrm.h);
		const a = solid.verts[face[0]];
		for (const v of solid.verts) {
			const d =
				((v.e - a.e) * nrm.e + (v.n - a.n) * nrm.n + (v.h - a.h) * nrm.h) / len;
			expect(d, `${what} bulges past face [${face.join(',')}]`).toBeLessThan(1e-6);
		}
	}
}

/** Every edge is shared by exactly two faces — the part is closed.
 *
 *  Winding alone cannot catch a MISSING face: the remaining faces are all still
 *  wound correctly, and the gap only shows as a see-through wall when the solid
 *  turns. This is the cheap check that every skin was actually emitted. */
function assertClosed(solid: Solid, what: string) {
	const edges = new Map<string, number>();
	for (const f of solid.faces)
		for (let i = 0; i < f.length; i++) {
			const key = [f[i], f[(i + 1) % f.length]].sort((x, y) => x - y).join('-');
			edges.set(key, (edges.get(key) ?? 0) + 1);
		}
	for (const [key, count] of edges)
		expect(count, `${what} edge ${key} is shared by ${count} faces, not 2`).toBe(2);
}

const SQUARE: Foot = rect(-1, 1, -1, 1);

describe('civic primitives', () => {
	const cases: [string, Solid][] = [
		['prism', prism(ngon(1, 8, Math.PI / 8), 0, 1.5)],
		['taper in', taper(SQUARE, 0, 1.5, 0.4)],
		['taper out', taper(SQUARE, 0, 1.5, 1.8)],
		['taper off-centre', taper(rect(0.2, 1, -0.4, 0.4), 0, 1, 1.6)],
		['pyramid', pyramid(SQUARE, 0, 1.5)],
		['pyramid, eccentric apex', pyramid(SQUARE, 0, 1.5, 0.6, -0.4)],
		['triangular prism', prism(ngon(1, 3, Math.PI / 2), 0, 1)],
		['ridgeE', ridgeE(-1, 1, -0.6, 0.6, 0, 1.2)],
		['tilted plate', tiltE(prism(ngon(0.8, 8, Math.PI / 8), -0.05, 0.05), 46, 0, 1)]
	];

	for (const [what, solid] of cases) {
		it(`${what} is outward, flat, convex and closed`, () => {
			assertOutward(solid, what);
			assertPlanar(solid, what);
			assertConvex(solid, what);
			assertClosed(solid, what);
		});
	}

	it('winds an ngon footprint counter-clockwise seen from above', () => {
		// The roof of a prism built on it must point UP. Get this backwards and
		// every face of every building on that footprint inverts at once.
		const p = prism(ngon(1, 6), 0, 1);
		const roof = p.faces[1];
		expect(normal(p, roof).h).toBeGreaterThan(0);
	});

	it('keeps a tilted plate rigid', () => {
		// A tilt must not resize anything — it is a rotation, and the moment it
		// scales, the "affine maps preserve winding" argument stops holding.
		const flat = prism(rect(-1, 1, -0.5, 0.5), 0, 0.2);
		const tipped = tiltE(flat, 37, 0, 2);
		const span = (s: Solid, k: 'e' | 'n' | 'h') =>
			Math.max(...s.verts.map((v) => v[k])) - Math.min(...s.verts.map((v) => v[k]));
		expect(span(tipped, 'e')).toBeCloseTo(span(flat, 'e'), 10);
		// The north/height extents swap some of their length between each other,
		// but the diagonal they span is conserved.
		expect(Math.hypot(span(tipped, 'n'), span(tipped, 'h'))).toBeGreaterThan(
			Math.hypot(span(flat, 'n'), span(flat, 'h')) - 1e-9
		);
	});
});

describe('the civic pieces', () => {
	for (const [id, piece] of Object.entries(CIVIC_PIECES)) {
		it(`${id} is built from outward-wound convex parts`, () => {
			expect(piece.length).toBeGreaterThan(0);
			piece.forEach((solid, i) => {
				assertOutward(solid, `${id}[${i}]`);
				assertPlanar(solid, `${id}[${i}]`);
				assertConvex(solid, `${id}[${i}]`);
				assertClosed(solid, `${id}[${i}]`);
			});
		});

		it(`${id} stands ON the surface and inside its own plot`, () => {
			const all = piece.flatMap((s) => s.verts);
			// Nothing below the ground: a piece sits on the sphere, not in it.
			expect(Math.min(...all.map((v) => v.h))).toBe(0);
			expect(Math.max(...all.map((v) => v.h))).toBeLessThanOrEqual(2);
			expect(Math.max(...all.map((v) => Math.abs(v.e)))).toBeLessThanOrEqual(1);
			expect(Math.max(...all.map((v) => Math.abs(v.n)))).toBeLessThanOrEqual(1);
		});

		it(`${id} spends its parts on masses rather than on trim`, () => {
			// More than about ten convex parts at node size is detail nobody can
			// resolve, paid for in per-face culling and sorting on every frame.
			expect(piece.length).toBeLessThanOrEqual(10);
		});
	}

	it('stands tall enough to read as a solid, except the hut', () => {
		// Below ~1.4 radii the band of visible SIDE collapses and two different
		// silhouettes converge into one lump. The hut opts out: being the small one
		// is its entire character.
		for (const [id, piece] of Object.entries(CIVIC_PIECES)) {
			const top = Math.max(...piece.flatMap((s) => s.verts.map((v) => v.h)));
			if (id === 'hut') expect(top).toBeLessThan(1.4);
			else expect(top, `${id} is too short to read`).toBeGreaterThanOrEqual(1.4);
		}
	});

	it('makes the hut the smallest thing in the settlement', () => {
		const plot = (p: (typeof CIVIC_PIECES)[string]) =>
			Math.max(...p.flatMap((s) => s.verts.map((v) => Math.max(Math.abs(v.e), Math.abs(v.n)))));
		const hut = plot(CIVIC_PIECES.hut);
		for (const [id, piece] of Object.entries(CIVIC_PIECES)) {
			if (id === 'hut') continue;
			expect(plot(piece), `${id} should out-spread the hut`).toBeGreaterThan(hut);
		}
	});
});

describe('the mode mapping', () => {
	const MODES = [
		'intelligence',
		'language',
		'harness',
		'momus',
		'feed_content_analysis',
		'vendor_identification',
		'hello_world'
	];

	it('covers exactly the cognition & signal modes', () => {
		expect(Object.keys(CIVIC_MODE_PIECES).sort()).toEqual([...MODES].sort());
	});

	for (const key of MODES) {
		it(`${key} resolves to a piece that exists`, () => {
			const shape = CIVIC_MODE_PIECES[key];
			expect(shape, `${key} has no shape`).toBeTruthy();
			expect(CIVIC_PIECES[shape], `${key} → ${shape} is not a piece`).toBeDefined();
		});
	}

	it('gives every mode its own silhouette', () => {
		// Two modes sharing a shape are the same node on the globe, whatever the
		// legend says they are.
		const shapes = Object.values(CIVIC_MODE_PIECES);
		expect(new Set(shapes).size).toBe(shapes.length);
	});
});
