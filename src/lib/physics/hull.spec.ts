import { describe, it, expect } from 'vitest';
import { hullFromFaces, trace, SKIN, type World } from './hull.js';
import type { Vec3 } from './sphere.js';

/** An axis-aligned box hull, wound counter-clockwise from outside in y-up. */
function boxHull(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
	const v: Vec3[] = [
		[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
		[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]
	].map(([x, y, z]) => ({ x, y, z }));
	return hullFromFaces(v, [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]);
}

const HALF = { x: 0.4, y: 0.9, z: 0.4 };
const BOUNDS = { min: { x: -50, y: 0, z: -50 }, max: { x: 50, y: 0, z: 50 } };
const worldOf = (...hulls: ReturnType<typeof boxHull>[]): World => ({ hulls, groundY: 0, bounds: BOUNDS });

describe('hullFromFaces', () => {
	it('points every face plane outward', () => {
		const h = boxHull(0, 1, 0, 1, 0, 1);
		const top = h.planes.find((p) => p.ny > 0.99)!;
		expect(top.d).toBeCloseTo(1);
	});

	it('rejects a solid that is not convex', () => {
		// A tetrahedron with a fifth corner poking out past one face.
		const v = [
			{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 },
			{ x: 0.1, y: 0.1, z: 0.1 }
		];
		expect(() => hullFromFaces(v, [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 4], [1, 4, 3], [2, 3, 4]])).toThrow();
	});

	it('caps a sharp ridge with bevels', () => {
		// A 20°-apex prism ridge along z. Pushed-out sloped planes alone would meet
		// far above the apex; the +y bevel must stop a falling box at max.y + half.y.
		const w = Math.tan((10 * Math.PI) / 180);
		const v = [
			{ x: -w, y: 0, z: -1 }, { x: w, y: 0, z: -1 }, { x: 0, y: 1, z: -1 },
			{ x: -w, y: 0, z: 1 }, { x: w, y: 0, z: 1 }, { x: 0, y: 1, z: 1 }
		];
		const ridge = hullFromFaces(v, [[0, 2, 1], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]]);
		const tr = trace(worldOf(ridge), { x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: 0 }, HALF);
		expect(tr.end.y).toBeGreaterThan(1 + HALF.y - 0.01);
		expect(tr.end.y).toBeLessThan(1 + HALF.y + 0.01);
	});
});

describe('trace', () => {
	it('stops a fast box at a thin wall instead of tunnelling', () => {
		// 11 m/s at a 1/30 s frame is 0.37m a step; the wall is 0.1m thick.
		const world = worldOf(boxHull(5, 5.1, 0, 5, -20, 20));
		const tr = trace(world, { x: 4.5, y: 1, z: 0 }, { x: 5.6, y: 1, z: 0 }, HALF);
		expect(tr.plane?.nx).toBeCloseTo(-1);
		expect(tr.end.x).toBeLessThan(5 - HALF.x);
		expect(tr.end.x).toBeGreaterThan(5 - HALF.x - 2 * SKIN);
	});

	it('reports startSolid only when the box really starts inside', () => {
		const world = worldOf(boxHull(5, 5.1, 0, 5, -20, 20));
		expect(trace(world, { x: 5, y: 2, z: 0 }, { x: 5, y: 2, z: 0 }, HALF).startSolid).toBe(true);
		expect(trace(world, { x: 0, y: 2, z: 0 }, { x: 0, y: 2, z: 0 }, HALF).startSolid).toBe(false);
	});

	it('lets a box resting on the ground slide along it without a hit', () => {
		const y = HALF.y + SKIN;
		const tr = trace(worldOf(), { x: 0, y, z: 0 }, { x: 3, y, z: 0 }, HALF);
		expect(tr.plane).toBeNull();
		expect(tr.fraction).toBe(1);
	});

	it('treats the world bounds as walls', () => {
		const tr = trace(worldOf(), { x: 0, y: 1, z: 0 }, { x: 80, y: 1, z: 0 }, HALF);
		expect(tr.end.x).toBeLessThan(50 - HALF.x);
	});
});
