import { describe, it, expect } from 'vitest';
import { packInward, relax, type Body, type Lane } from './solver.js';
import { packRing } from './ring.js';

const body = (x: number, y: number, r: number, invMass = 1): Body => ({ x, y, r, invMass });

/** Worst overlap across every pair — negative means bodies are interpenetrating. */
function worstGap(bodies: Body[]): number {
	let worst = Infinity;
	for (let i = 0; i < bodies.length; i++)
		for (let j = i + 1; j < bodies.length; j++) {
			const d = Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y);
			worst = Math.min(worst, d - bodies[i].r - bodies[j].r);
		}
	return worst;
}

/** Distance from a point to a segment — the same test the lane constraint uses,
 *  written independently so the assertion isn't just the implementation echoed. */
function distToSegment(p: Body, a: Body, b: Body): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len2 = dx * dx + dy * dy;
	const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
	return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Worst encroachment onto any lane by a body that isn't one of its endpoints. */
function worstLaneGap(bodies: Body[], lanes: Lane[]): number {
	let worst = Infinity;
	for (const lane of lanes)
		for (let k = 0; k < bodies.length; k++) {
			if (k === lane.i || k === lane.j) continue;
			worst = Math.min(worst, distToSegment(bodies[k], bodies[lane.i], bodies[lane.j]) - bodies[k].r);
		}
	return worst;
}

/** A hub with `n` equal spokes seeded on a ring — the real mesh's shape. */
function mesh(n: number, spokeR = 68.6, hubR = 58) {
	const seed = packRing(Array(n).fill(spokeR), { margin: 18, hubR, hubMargin: 40 });
	const bodies: Body[] = [body(0, 0, hubR, 0)];
	const lanes: Lane[] = [];
	seed.points.forEach((p, i) => {
		bodies.push(body(p.x, p.y, spokeR));
		lanes.push({ i: 0, j: i + 1 });
	});
	return { bodies, lanes, seedRadius: seed.radius };
}

const radiusOf = (bodies: Body[]) => Math.max(...bodies.slice(1).map((b) => Math.hypot(b.x, b.y)));

/** Bodies come to rest at contact, less the slop deliberately left unprojected —
 *  so "touching" means within slop of exact, never looser. */
const SLOP = 0.5;
function expectTouching(a: Body, b: Body, target: number) {
	const d = Math.hypot(a.x - b.x, a.y - b.y);
	expect(d).toBeGreaterThanOrEqual(target - SLOP - 1e-6);
	expect(d).toBeLessThanOrEqual(target + 1e-6);
}

describe('relax', () => {
	it('separates two overlapping bodies to contact — and no further', () => {
		// The density requirement: a force-based solver would settle wherever
		// repulsion balanced out. Projection removes the overlap and stops.
		const bodies = [body(0, 0, 10), body(5, 0, 10)];
		for (let i = 0; i < 40; i++) relax(bodies, []);
		expectTouching(bodies[0], bodies[1], 20);
	});

	it('honours a margin', () => {
		const bodies = [body(0, 0, 10), body(5, 0, 10)];
		for (let i = 0; i < 40; i++) relax(bodies, [], { margin: 6 });
		expectTouching(bodies[0], bodies[1], 26);
	});

	it('leaves bodies that already clear each other alone', () => {
		const bodies = [body(0, 0, 10), body(100, 0, 10)];
		expect(relax(bodies, [])).toBe(0);
		expect(bodies[1].x).toBe(100);
	});

	it('never moves an immovable body — the operator is not fought for a position', () => {
		const bodies = [body(0, 0, 10, 0), body(5, 0, 10)];
		for (let i = 0; i < 40; i++) relax(bodies, []);
		expect(bodies[0].x).toBe(0);
		expect(bodies[0].y).toBe(0);
		// The movable one absorbs the entire correction.
		expectTouching(bodies[0], bodies[1], 20);
	});

	it('separates coincident bodies instead of dividing by zero', () => {
		const bodies = [body(0, 0, 10), body(0, 0, 10)];
		for (let i = 0; i < 40; i++) relax(bodies, []);
		const d = Math.hypot(bodies[0].x - bodies[1].x, bodies[0].y - bodies[1].y);
		expect(Number.isFinite(d)).toBe(true);
		expectTouching(bodies[0], bodies[1], 20);
	});

	it('is deterministic from a degenerate seed', () => {
		const run = () => {
			const bodies = [body(0, 0, 10), body(0, 0, 10), body(0, 0, 10)];
			for (let i = 0; i < 60; i++) relax(bodies, []);
			return bodies.map((b) => `${b.x.toFixed(4)},${b.y.toFixed(4)}`).join(' ');
		};
		expect(run()).toBe(run());
	});

	it('settles — corrections decay to nothing', () => {
		const bodies = [body(0, 0, 10), body(5, 0, 10), body(3, 3, 10)];
		let last = Infinity;
		for (let i = 0; i < 200; i++) last = relax(bodies, []);
		expect(last).toBeLessThan(0.5);
	});

	it('pushes a body off a lane it blocks', () => {
		// c sits squarely on the a→b line.
		const bodies = [body(0, 0, 10, 0), body(200, 0, 10, 0), body(100, 0, 10)];
		for (let i = 0; i < 60; i++) relax(bodies, [{ i: 0, j: 1 }], { laneClearance: 12 });
		expect(distToSegment(bodies[2], bodies[0], bodies[1]) - bodies[2].r).toBeGreaterThan(11);
	});

	it("does not push a lane's own endpoints off it", () => {
		const bodies = [body(0, 0, 10), body(200, 0, 10)];
		expect(relax(bodies, [{ i: 0, j: 1 }], { laneClearance: 40 })).toBe(0);
	});
});

describe('packInward', () => {
	it('fills the void — packs tighter than the ring it started from', () => {
		const { bodies, lanes, seedRadius } = mesh(30);
		packInward(bodies, lanes, { center: { x: 0, y: 0 }, margin: 18, laneClearance: 14 });
		// The whole point: 30 nodes must not sit on one ever-growing ring.
		expect(radiusOf(bodies)).toBeLessThan(seedRadius * 0.85);
	});

	it('never overlaps, at any mesh size', () => {
		for (const n of [3, 8, 12, 24, 40]) {
			const { bodies, lanes } = mesh(n);
			packInward(bodies, lanes, { center: { x: 0, y: 0 }, margin: 18, laneClearance: 14 });
			expect(worstGap(bodies), `n=${n}`).toBeGreaterThan(16);
		}
	});

	it('keeps every link followable — no node buries another node line', () => {
		for (const n of [12, 24, 40]) {
			const { bodies, lanes } = mesh(n);
			packInward(bodies, lanes, { center: { x: 0, y: 0 }, margin: 18, laneClearance: 14 });
			expect(worstLaneGap(bodies, lanes), `n=${n}`).toBeGreaterThan(12);
		}
	});

	it('leaves the hub where it is', () => {
		const { bodies, lanes } = mesh(12);
		packInward(bodies, lanes, { center: { x: 0, y: 0 }, margin: 18, laneClearance: 14 });
		expect(bodies[0].x).toBe(0);
		expect(bodies[0].y).toBe(0);
	});

	it('never moves a pinned node, and packs the rest around it', () => {
		const { bodies, lanes } = mesh(12);
		bodies[1].invMass = 0;
		const held = { x: bodies[1].x, y: bodies[1].y };
		packInward(bodies, lanes, { center: { x: 0, y: 0 }, margin: 18, laneClearance: 14 });
		expect(bodies[1].x).toBe(held.x);
		expect(bodies[1].y).toBe(held.y);
		expect(worstGap(bodies)).toBeGreaterThan(16);
	});

	it('packs mixed sizes without overlap', () => {
		const radii = [146, 68.6, 68.6, 80.6, 68.6, 146, 68.6, 80.6, 68.6];
		const seed = packRing(radii, { margin: 18, hubR: 58, hubMargin: 40 });
		const bodies: Body[] = [body(0, 0, 58, 0), ...seed.points.map((p, i) => body(p.x, p.y, radii[i]))];
		const lanes: Lane[] = radii.map((_, i) => ({ i: 0, j: i + 1 }));
		packInward(bodies, lanes, { center: { x: 0, y: 0 }, margin: 18, laneClearance: 14 });
		expect(worstGap(bodies)).toBeGreaterThan(16);
		expect(worstLaneGap(bodies, lanes)).toBeGreaterThan(12);
	});

	it('is deterministic', () => {
		const run = () => {
			const { bodies, lanes } = mesh(20);
			packInward(bodies, lanes, { center: { x: 0, y: 0 }, margin: 18, laneClearance: 14 });
			return bodies.map((b) => `${b.x.toFixed(4)},${b.y.toFixed(4)}`).join(' ');
		};
		expect(run()).toBe(run());
	});

	it('survives an empty mesh', () => {
		expect(() => packInward([], [], { center: { x: 0, y: 0 } })).not.toThrow();
	});
});
