import { describe, expect, it } from 'vitest';
import type { World } from 'showcase';
import { navGrid, route } from './nav.js';

const HALF = { x: 0.4, y: 0.9, z: 0.4 };
const box = (x0: number, x1: number, z0: number, z1: number, y0 = 0, y1 = 1) => ({
	planes: [],
	min: { x: x0, y: y0, z: z0 },
	max: { x: x1, y: y1, z: z1 }
});
// A 20 m room with a desk-high wall across the middle, open only at the east
// end; a kerb and a lintel across the north half.
const world: World = {
	groundY: 0,
	bounds: { min: { x: -10, y: 0, z: -10 }, max: { x: 10, y: 0, z: 10 } },
	hulls: [box(-10, 6, -0.2, 0.2), box(-3, -2, 5, 6, 0, 0.3), box(0, 1, 5, 6, 2.2, 3.2)]
};
const grid = navGrid(world, HALF, 0.45);

describe('route', () => {
	it('goes round a wall instead of through it', () => {
		const path = route(grid, { x: -5, z: -5 }, { x: -5, z: 5 })!;
		expect(path).not.toBeNull();
		// Every leg stays clear of the wall: it has to round the east end.
		expect(Math.max(...path.map((p) => p.x))).toBeGreaterThan(6);
	});

	it('walks over what is under step height and under what is over head height', () => {
		const path = route(grid, { x: -8, z: 5.5 }, { x: 2, z: 5.5 })!;
		expect(path).toHaveLength(1);
	});

	it('stops beside a target inside a solid, on the side it came from', () => {
		const path = route(grid, { x: -5, z: -5 }, { x: 0, z: 0 })!;
		const end = path[path.length - 1];
		expect(end.z).toBeLessThan(-(0.2 + HALF.z));
	});
});
