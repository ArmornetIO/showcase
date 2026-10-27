import { describe, it, expect } from 'vitest';
import { hullFromFaces, trace, type World } from './hull.js';
import { spawnWalker, stepWalker, WALKER_DEFAULTS, type WalkerInput, type WalkerState } from './walker.js';

// Same box as hull.spec's — repeated rather than imported, because importing a
// spec file runs its suite a second time.
function boxHull(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
	const v = [
		[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
		[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]
	].map(([x, y, z]) => ({ x, y, z }));
	return hullFromFaces(v, [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]);
}

const DT = 1 / 120;
const HALF = WALKER_DEFAULTS.half;
const BOUNDS = { min: { x: -50, y: 0, z: -50 }, max: { x: 50, y: 0, z: 50 } };

// A wall at x = 5, a 1m plinth north of the origin, a 0.4m step south of it.
const world: World = {
	hulls: [boxHull(5, 5.1, 0, 5, -20, 20), boxHull(-3, 3, 0, 1, -10, -5), boxHull(-3, 3, 0, 0.4, 5, 10)],
	groundY: 0,
	bounds: BOUNDS
};

const input = (o: Partial<WalkerInput> = {}): WalkerInput => ({ forward: 0, strafe: 0, yaw: 0, run: false, jump: false, ...o });
const run = (s: WalkerState, n: number, i: WalkerInput | ((k: number) => WalkerInput)) => {
	for (let k = 0; k < n; k++) s = stepWalker(world, s, typeof i === 'function' ? i(k) : i, DT);
	return s;
};
const settled = (x: number, z: number) => run(spawnWalker(world, { x, y: 0, z }), 10, input());
const inside = (s: WalkerState) =>
	trace(world, { ...s.pos, y: s.pos.y + HALF.y }, { ...s.pos, y: s.pos.y + HALF.y }, HALF).startSolid;

// yaw 0 looks toward −z; π/2 toward +x; π toward +z.
const EAST = Math.PI / 2;
const SOUTH = Math.PI;

describe('stepWalker — walls (US1)', () => {
	it('stops at a wall and never ends inside it', () => {
		let s = settled(0, 0);
		for (let k = 0; k < 240; k++) {
			s = stepWalker(world, s, input({ forward: 1, yaw: EAST }), DT);
			expect(inside(s)).toBe(false);
		}
		expect(s.pos.x).toBeGreaterThan(5 - HALF.x - 0.01);
		expect(s.pos.x).toBeLessThan(5 - HALF.x);
	});

	it('slides along a wall hit at 45° keeping at least half its speed (SC-005)', () => {
		let s = run(settled(0, 0), 240, input({ forward: 1, yaw: EAST }));
		const z0 = s.pos.z;
		s = run(s, 120, input({ forward: 1, yaw: Math.PI / 4 }));
		const along = WALKER_DEFAULTS.walkSpeed * Math.SQRT1_2;
		expect(Math.abs(s.pos.z - z0)).toBeGreaterThanOrEqual(0.5 * along);
	});

	it('is pure — the same inputs give the same output and the input is untouched', () => {
		const s = settled(0, 0);
		const copy = structuredClone(s);
		const a = stepWalker(world, s, input({ forward: 1 }), DT);
		const b = stepWalker(world, s, input({ forward: 1 }), DT);
		expect(a).toEqual(b);
		expect(s).toEqual(copy);
	});
});

describe('stepWalker — standing and stepping (US2)', () => {
	it('drifts less than 1cm standing still for ten seconds (SC-003)', () => {
		const s0 = settled(0, 0);
		const s = run(s0, 1200, input());
		expect(s.mode).toBe('ground');
		expect(Math.hypot(s.pos.x - s0.pos.x, s.pos.y - s0.pos.y, s.pos.z - s0.pos.z)).toBeLessThan(0.01);
	});

	it('walks up a 0.4m step', () => {
		const s = run(settled(0, 2), 120, input({ forward: 1, yaw: SOUTH }));
		expect(s.mode).toBe('ground');
		expect(s.pos.y).toBeCloseTo(0.4, 2);
	});

	it('does not walk up a 1m plinth, but jumps onto it', () => {
		let s = run(settled(0, -3), 240, input({ forward: 1 }));
		expect(s.pos.y).toBeLessThan(0.01);
		expect(s.pos.z).toBeGreaterThan(-5);
		s = run(s, 120, (k) => input({ forward: 1, jump: k === 0 }));
		expect(s.mode).toBe('ground');
		expect(s.pos.y).toBeCloseTo(1, 2);
	});

	it('walks off a ledge, falls and lands', () => {
		let s = run(settled(0, -3), 120, (k) => input({ forward: 1, jump: k === 0 }));
		s = run(s, 480, input({ forward: 1 }));
		expect(s.mode).toBe('ground');
		expect(s.pos.y).toBeLessThan(0.01);
	});

	it('gives the same result however the fixed steps are batched into frames (SC-006)', () => {
		const inputs = Array.from({ length: 600 }, (_, k) => input({ forward: 1, yaw: k * 0.01, jump: k % 90 === 0 }));
		const finals = [1, 2, 4].map((batch) => {
			let s = settled(0, 0);
			for (let f = 0; f < inputs.length; f += batch)
				for (let k = f; k < Math.min(f + batch, inputs.length); k++) s = stepWalker(world, s, inputs[k], DT);
			return s.pos;
		});
		for (const p of finals.slice(1)) {
			expect(Math.abs(p.x - finals[0].x)).toBeLessThan(0.001);
			expect(Math.abs(p.z - finals[0].z)).toBeLessThan(0.001);
		}
	});
});
