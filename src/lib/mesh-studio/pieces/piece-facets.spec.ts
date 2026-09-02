import { describe, it, expect } from 'vitest';
import { box, octagon, prism } from './pieces.js';
import { pieceFacets, pieceProjector, studioFrame, band } from './piece-facets.js';

const FRONT = studioFrame(0, 0, 10);

/** Signed area of a footprint in (e, n). Positive is the winding `box` uses, and
 *  the winding every solid here has to match for the cull to be a cull rather
 *  than an inside-out cull. */
function area(foot: [number, number][]): number {
	let a = 0;
	for (let i = 0; i < foot.length; i++) {
		const [x1, y1] = foot[i];
		const [x2, y2] = foot[(i + 1) % foot.length];
		a += x1 * y2 - x2 * y1;
	}
	return a / 2;
}

describe('octagon', () => {
	it('winds the same way box does', () => {
		// The whole cull rests on this. A footprint wound the other way produces
		// inward normals, every face is culled, and the piece renders as nothing —
		// which looks like a data problem rather than a winding one.
		expect(area(octagon(1, 1))).toBeGreaterThan(0);
		expect(
			area([
				[-1, -1],
				[1, -1],
				[1, 1],
				[-1, 1],
			]),
		).toBeGreaterThan(0);
	});

	it('is convex at every chamfer, including the degenerate ends', () => {
		for (const cut of [0, 0.2, 0.34, 0.5, 1]) {
			const f = octagon(0.8, 0.5, cut);
			for (let i = 0; i < f.length; i++) {
				const a = f[i];
				const b = f[(i + 1) % f.length];
				const c = f[(i + 2) % f.length];
				const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
				expect(cross).toBeGreaterThanOrEqual(-1e-12);
			}
		}
	});
});

describe('prism', () => {
	it('agrees with box on a square footprint', () => {
		const a = prism(
			[
				[-1, -1],
				[1, -1],
				[1, 1],
				[-1, 1],
			],
			0,
			2,
		);
		const b = box(-1, 1, -1, 1, 0, 2);
		expect(a.verts).toEqual(b.verts);
		expect(a.faces.length).toBe(b.faces.length);
		// Same visible set from the same camera is the property that matters; the
		// face ORDER is an implementation detail of how the sides are enumerated.
		expect(pieceFacets([a], FRONT).length).toBe(pieceFacets([b], FRONT).length);
	});

	it('gives one face per footprint edge plus a floor and a roof', () => {
		expect(prism(octagon(1, 1), 0, 1).faces.length).toBe(10);
	});
});

describe('pieceFacets', () => {
	const cube = [box(-1, 1, -1, 1, 0, 2)];

	it('culls the faces pointing away', () => {
		// Six faces, and from any single camera you can never see more than three.
		const seen = pieceFacets(cube, studioFrame(0.6, 0.4, 10));
		expect(seen.length).toBeGreaterThan(0);
		expect(seen.length).toBeLessThanOrEqual(3);
	});

	it('sorts back to front, which IS the hidden-surface pass', () => {
		const seen = pieceFacets(cube, studioFrame(0.6, 0.4, 10));
		for (let i = 1; i < seen.length; i++) {
			expect(seen[i].depth).toBeGreaterThanOrEqual(seen[i - 1].depth);
		}
	});

	it('shows you the FAR side if a footprint is wound backwards', () => {
		// The failure this is here to name, and what it actually looks like. Reversing
		// the footprint turns every normal inward, so the cull keeps exactly the faces
		// it should have dropped: you get the inside of the solid, painted in the
		// order that would have been right for the outside. It does not error and it
		// does not vanish — it renders, subtly wrongly, which is why it is worth a
		// test rather than a comment.
		const cam = studioFrame(0.6, 0.4, 10);
		const inside = prism(
			[
				[-1, 1],
				[1, 1],
				[1, -1],
				[-1, -1],
			],
			0,
			2,
		);
		const near = pieceFacets(cube, cam);
		const far = pieceFacets([inside], cam);
		const mean = (fs: { depth: number }[]) => fs.reduce((s, f) => s + f.depth, 0) / fs.length;
		expect(mean(far)).toBeLessThan(mean(near));
	});

	it('scales the whole piece without moving its foot', () => {
		const one = pieceProjector(FRONT)({ e: 1, n: 0, h: 0 });
		const two = pieceProjector(FRONT, { scale: 2 })({ e: 1, n: 0, h: 0 });
		expect(two.x).toBeCloseTo(one.x * 2, 9);
		const origin = pieceProjector(FRONT)({ e: 0, n: 0, h: 0 });
		expect(origin.x).toBeCloseTo(0, 12);
		expect(origin.y).toBeCloseTo(0, 12);
	});

	it('bands the light into three hard values, never a ramp', () => {
		expect(new Set([band(1), band(0.4), band(-1)]).size).toBe(3);
		expect(band(1)).toBeGreaterThan(band(0.4));
		expect(band(0.4)).toBeGreaterThan(band(-1));
	});
});

describe('studioFrame', () => {
	it('is orthonormal at every angle, or the cross product is not a normal', () => {
		for (const [y, p] of [
			[0, 0],
			[0.7, 0.26],
			[Math.PI, -0.4],
			[2.4, 1.1],
		]) {
			const { axis } = studioFrame(y, p, 10);
			const len = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
			const dot = (
				a: { x: number; y: number; z: number },
				b: { x: number; y: number; z: number },
			) => a.x * b.x + a.y * b.y + a.z * b.z;
			expect(len(axis.e)).toBeCloseTo(1, 9);
			expect(len(axis.n)).toBeCloseTo(1, 9);
			expect(len(axis.u)).toBeCloseTo(1, 9);
			expect(dot(axis.e, axis.n)).toBeCloseTo(0, 9);
			expect(dot(axis.e, axis.u)).toBeCloseTo(0, 9);
			expect(dot(axis.n, axis.u)).toBeCloseTo(0, 9);
		}
	});

	it('puts up on screen and the far side away at rest', () => {
		const { axis } = studioFrame(0, 0, 10);
		expect(axis.u.y).toBeLessThan(0); // screen y runs DOWN
		expect(axis.n.z).toBeLessThan(0); // north is away from the viewer
		expect(axis.e.x).toBeCloseTo(1, 9);
	});

	it('turns a face away by half a turn', () => {
		// The property the character visor depends on: what faces you at 0 must not
		// face you at π, or a figure keeps its eyes on you with its back turned.
		expect(studioFrame(0, 0, 10).axis.n.z).toBeCloseTo(-studioFrame(Math.PI, 0, 10).axis.n.z, 9);
	});
});
