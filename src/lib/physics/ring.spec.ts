import { describe, it, expect } from 'vitest';
import { packRing, solveRingRadius } from './ring.js';

/** Closest approach between any two placed nodes, minus the room they need —
 *  negative means they overlap. This is the property the whole module exists for,
 *  so it's asserted directly rather than through the radius it happens to pick. */
function worstClearance(radii: number[], opts = {}): number {
	const { points } = packRing(radii, opts);
	let worst = Infinity;
	for (let i = 0; i < points.length; i++) {
		for (let j = i + 1; j < points.length; j++) {
			const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
			worst = Math.min(worst, d - radii[i] - radii[j]);
		}
	}
	return worst;
}

describe('solveRingRadius', () => {
	it('holds a node that is larger than the ring would otherwise be', () => {
		expect(solveRingRadius([200])).toBeGreaterThanOrEqual(200);
	});

	it('clears the hub', () => {
		// 44 out on the ring + 58 of hub + 40 of gap: the ring cannot come closer.
		expect(solveRingRadius([44, 44], { hubR: 58, hubMargin: 40 })).toBeGreaterThanOrEqual(142);
	});

	it('grows with the node count — the fixed-radius bug', () => {
		const few = solveRingRadius(Array(6).fill(44));
		const many = solveRingRadius(Array(24).fill(44));
		expect(many).toBeGreaterThan(few);
	});

	it('grows when one node fans out, so it does not crowd its neighbours', () => {
		const leaves = Array(8).fill(44);
		const withFannedOut = [...leaves.slice(1), 106];
		expect(solveRingRadius(withFannedOut)).toBeGreaterThan(solveRingRadius(leaves));
	});

	it('is deterministic', () => {
		const radii = [44, 106, 44, 58, 44];
		expect(solveRingRadius(radii)).toBe(solveRingRadius(radii));
	});

	it('survives an empty mesh', () => {
		expect(solveRingRadius([], { hubR: 58, hubMargin: 40 })).toBe(98);
	});
});

describe('packRing', () => {
	it('never overlaps uniform nodes, at any count', () => {
		// n=18 is where the old fixed 250px ring began overlapping bare discs.
		for (const n of [2, 3, 8, 12, 18, 24, 50]) {
			expect(worstClearance(Array(n).fill(44))).toBeGreaterThanOrEqual(-0.01);
		}
	});

	it('never overlaps mixed sizes — the screenshot case', () => {
		// A fanned-out agent (106) beside leaves: even slots gave it a leaf's room.
		expect(worstClearance([106, 44, 44, 58, 44, 106, 44])).toBeGreaterThanOrEqual(-0.01);
	});

	it('honours the margin between neighbours', () => {
		expect(worstClearance(Array(12).fill(44), { margin: 18 })).toBeGreaterThanOrEqual(17.99);
	});

	it('packs to contact — no looser than it has to be', () => {
		// With no slack the ring is set by the nodes themselves, so at least one pair
		// sits at exactly the margin. A ring that merely avoided overlap could sit
		// arbitrarily far out and still pass every test above; this is what pins it.
		const radii = Array(12).fill(44);
		expect(worstClearance(radii, { margin: 18 })).toBeLessThan(18.5);
	});

	it('places a node every margin apart rather than bunching the slack', () => {
		// One large node forces a ring the small ones don't need. The leftover turn is
		// shared out, so no two of them end up crowded on the far side.
		const { points } = packRing([200, 20, 20, 20, 20], { margin: 10 });
		const gaps = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
		const spread = Math.max(...gaps.slice(1)) - Math.min(...gaps.slice(1));
		expect(spread).toBeLessThan(1);
	});

	it('starts at the given bearing', () => {
		const { points, radius } = packRing([44], { startAngle: -90 });
		expect(points[0].x).toBeCloseTo(0, 6);
		expect(points[0].y).toBeCloseTo(-radius, 6);
	});

	it('survives an empty mesh', () => {
		expect(packRing([]).points).toEqual([]);
	});
});
