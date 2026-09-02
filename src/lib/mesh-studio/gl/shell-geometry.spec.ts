import { describe, it, expect } from 'vitest';
import {
	buildShellGrid,
	buildShellWeb,
	buildShellDisc,
	shellLimb,
	SHELL_STEPS,
	SHELL_VERT_FLOATS,
} from './shell-geometry.js';

const OPTS = { yaw: 0, pitch: 0, radius: 100, viewDistance: 2.6, cx: 200, cy: 150 };

describe('buildShellGrid', () => {
	it('samples one closed ring per meridian and parallel', () => {
		const grid = buildShellGrid(4, 3);
		expect(grid).toHaveLength(7);
		for (const ring of grid) expect(ring).toHaveLength(SHELL_STEPS + 1);
	});

	it('keeps every sample on the unit sphere', () => {
		for (const ring of buildShellGrid(3, 2))
			for (const { p } of ring) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 10);
	});

	it('never places a parallel ON a pole', () => {
		// A pole is a point, not a circle. A ring of radius 0 would be 72 segments
		// of zero length, which `ribbon` turns into 72 degenerate quads.
		for (const ring of buildShellGrid(0, 5))
			for (const { p } of ring) expect(Math.abs(p.y)).toBeLessThan(0.999);
	});

	it('looks the terrain up once per sample, on the UNSPUN point', () => {
		const seen: number[] = [];
		buildShellGrid(1, 0, (p) => {
			seen.push(p.y);
			return 0.5;
		});
		expect(seen).toHaveLength(SHELL_STEPS + 1);
	});

	it('carries the lift through', () => {
		const grid = buildShellGrid(1, 0, () => 0.25);
		expect(grid[0].every((s) => s.lift === 0.25)).toBe(true);
	});
});

describe('buildShellWeb', () => {
	it('splits every segment into exactly one hemisphere', () => {
		const grid = buildShellGrid(6, 4);
		const build = buildShellWeb(grid, OPTS);
		const segments = grid.reduce((n, r) => n + r.length - 1, 0);
		expect(build.back.count + build.front.count).toBe(segments * 6);
		expect(build.vertices).toBe(segments * 6);
	});

	it('lays the far half out before the near half, contiguously', () => {
		const build = buildShellWeb(buildShellGrid(6, 4), OPTS);
		expect(build.back.first).toBe(0);
		expect(build.front.first).toBe(build.back.count);
	});

	it('puts roughly half the sphere on each side at rest', () => {
		const build = buildShellWeb(buildShellGrid(8, 5), OPTS);
		const total = build.back.count + build.front.count;
		expect(build.back.count / total).toBeGreaterThan(0.35);
		expect(build.back.count / total).toBeLessThan(0.65);
	});

	it('moves the split when the globe turns', () => {
		const grid = buildShellGrid(8, 5);
		const at = (yaw: number) => {
			const b = buildShellWeb(grid, { ...OPTS, yaw });
			return b.front.count;
		};
		// A quarter turn cannot leave every segment on the side it started.
		expect(at(0)).not.toBe(at(Math.PI / 2));
	});

	it('reuses the caller’s array rather than allocating each frame', () => {
		const grid = buildShellGrid(6, 4);
		const first = buildShellWeb(grid, OPTS);
		const second = buildShellWeb(grid, { ...OPTS, yaw: 0.3 }, first.data);
		expect(second.data).toBe(first.data);
	});

	it('grows a reused array that is too small', () => {
		const grid = buildShellGrid(6, 4);
		const tiny = new Float32Array(8);
		const build = buildShellWeb(grid, OPTS, tiny);
		expect(build.data).not.toBe(tiny);
		expect(build.data.length).toBeGreaterThanOrEqual(build.vertices * SHELL_VERT_FLOATS);
	});

	it('draws nothing at zero radius', () => {
		const build = buildShellWeb(buildShellGrid(6, 4), { ...OPTS, radius: 0 });
		expect(build.vertices).toBe(0);
		expect(build.back.count).toBe(0);
		expect(build.front.count).toBe(0);
	});

	it('centres the projection on cx/cy', () => {
		const grid = buildShellGrid(2, 1);
		const build = buildShellWeb(grid, OPTS);
		let minX = Infinity;
		let maxX = -Infinity;
		for (let i = 0; i < build.vertices * SHELL_VERT_FLOATS; i += SHELL_VERT_FLOATS) {
			minX = Math.min(minX, build.data[i]);
			maxX = Math.max(maxX, build.data[i]);
		}
		expect((minX + maxX) / 2).toBeCloseTo(OPTS.cx, 6);
	});

	it('emits a ribbon whose two edges straddle the segment', () => {
		// One meridian, no parallels: the expand offsets must be equal and opposite
		// within a quad, or the stroke sits to one side of the line it draws.
		const build = buildShellWeb(buildShellGrid(1, 0), OPTS);
		const d = build.data;
		const ex = [d[2], d[6], d[10], d[14], d[18], d[22]];
		expect(ex[0]).toBeCloseTo(-ex[2], 10);
		expect(ex[0] + ex[1] + ex[2] + ex[3] + ex[4] + ex[5]).toBeCloseTo(0, 10);
	});

	it('keeps the ribbon half-width at a half unit before the shader scales it', () => {
		const build = buildShellWeb(buildShellGrid(1, 0), OPTS);
		expect(Math.hypot(build.data[2], build.data[3])).toBeCloseTo(0.5, 10);
	});
});

describe('shellLimb', () => {
	it('is wider than the sphere, because you see less than a hemisphere', () => {
		expect(shellLimb(100, 2.6)).toBeGreaterThan(100);
	});

	it('approaches the radius as the camera pulls away', () => {
		expect(shellLimb(100, 1000)).toBeCloseTo(100, 3);
	});

	it('clamps a camera that would sit inside the globe', () => {
		// Below 1.2 radii the closed form goes imaginary; GlobeFrame clamps to the
		// same floor, and the two must agree or the GL sphere and the SVG fallback
		// are different sizes.
		expect(shellLimb(100, 0.5)).toBe(shellLimb(100, 1.2));
		expect(Number.isFinite(shellLimb(100, 0.5))).toBe(true);
	});
});

describe('buildShellDisc', () => {
	it('bleeds past the limb so the stroke has somewhere to land', () => {
		const d = buildShellDisc(0, 0, 50);
		expect(Math.min(...d)).toBe(-52);
		expect(Math.max(...d)).toBe(52);
	});

	it('is two triangles', () => {
		expect(buildShellDisc(0, 0, 10)).toHaveLength(12);
	});

	it('reuses the array it is handed', () => {
		const reuse = new Float32Array(12);
		expect(buildShellDisc(1, 2, 3, reuse)).toBe(reuse);
	});
});
