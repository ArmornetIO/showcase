import { describe, it, expect } from 'vitest';
import { packClusters } from './cluster.js';

const MODES = [
	'editor', 'editor', 'supply', 'supply', 'vendor', 'vendor',
	'dns', 'dns', 'hello', 'hello', 'runner', 'runner',
];

function worstGap(radii: number[], pts: { x: number; y: number }[]): number {
	let worst = Infinity;
	for (let i = 0; i < pts.length; i++)
		for (let j = i + 1; j < pts.length; j++)
			worst = Math.min(
				worst,
				Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) - radii[i] - radii[j],
			);
	return worst;
}

/** Mean distance between members of the same group, vs. members of different
 *  groups. A cluster exists exactly when the first is well under the second. */
function cohesionRatio(groups: string[], pts: { x: number; y: number }[]) {
	let same = 0, sameN = 0, diff = 0, diffN = 0;
	for (let i = 0; i < pts.length; i++)
		for (let j = i + 1; j < pts.length; j++) {
			const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
			if (groups[i] === groups[j]) { same += d; sameN++; } else { diff += d; diffN++; }
		}
	return { same: same / sameN, diff: diff / diffN };
}

describe('packClusters', () => {
	it('puts same-group bodies together — what attraction could not do', () => {
		const radii = MODES.map(() => 68.6);
		const { points } = packClusters(radii, MODES, { margin: 18, hubR: 58, hubMargin: 40 });
		const { same, diff } = cohesionRatio(MODES, points);
		// Same-mode pairs must end up dramatically closer than unrelated nodes.
		expect(same).toBeLessThan(diff / 2);
		// And close to touching (2r + margin = 155).
		expect(same).toBeLessThan(200);
	});

	it('never overlaps', () => {
		const radii = MODES.map(() => 68.6);
		const { points } = packClusters(radii, MODES, { margin: 18, hubR: 58, hubMargin: 40 });
		expect(worstGap(radii, points)).toBeGreaterThanOrEqual(17.99);
	});

	it('never overlaps with mixed sizes and uneven groups', () => {
		const groups = ['a', 'a', 'a', 'b', 'c', 'c', 'd', 'd', 'd', 'd'];
		const radii = [146, 68.6, 80.6, 44, 68.6, 146, 68.6, 80.6, 68.6, 44];
		const { points } = packClusters(radii, groups, { margin: 18, hubR: 58, hubMargin: 40 });
		expect(worstGap(radii, points)).toBeGreaterThanOrEqual(17.99);
	});

	it('clears the hub', () => {
		const radii = MODES.map(() => 68.6);
		const { points } = packClusters(radii, MODES, { margin: 18, hubR: 58, hubMargin: 40 });
		for (const [i, p] of points.entries())
			expect(Math.hypot(p.x, p.y) - radii[i], `body ${i}`).toBeGreaterThanOrEqual(58 + 40 - 0.01);
	});

	it('treats a group of one as just a body — no needless offset', () => {
		const { points, centers } = packClusters([44, 44], ['a', 'b'], { margin: 18 });
		expect(points[0]).toEqual({ x: centers.get('a')!.x, y: centers.get('a')!.y });
	});

	it('reports where each group landed', () => {
		const { centers } = packClusters(MODES.map(() => 68.6), MODES, { hubR: 58 });
		expect([...centers.keys()].sort()).toEqual(['dns', 'editor', 'hello', 'runner', 'supply', 'vendor']);
	});

	it('is deterministic — groups order by first appearance, not Map iteration', () => {
		const key = () =>
			packClusters(MODES.map(() => 68.6), MODES, { margin: 18, hubR: 58, hubMargin: 40 })
				.points.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)
				.join(' ');
		expect(key()).toBe(key());
	});

	it('handles every body in one group', () => {
		const radii = Array(6).fill(44);
		const groups = Array(6).fill('only');
		const { points } = packClusters(radii, groups, { margin: 18, hubR: 58, hubMargin: 40 });
		expect(worstGap(radii, points)).toBeGreaterThanOrEqual(17.99);
	});

	it('handles every body in its own group', () => {
		const radii = Array(6).fill(44);
		const groups = radii.map((_, i) => `g${i}`);
		const { points } = packClusters(radii, groups, { margin: 18, hubR: 58, hubMargin: 40 });
		expect(worstGap(radii, points)).toBeGreaterThanOrEqual(17.99);
	});

	it('survives an empty mesh', () => {
		expect(packClusters([], [], { hubR: 58, hubMargin: 40 }).points).toEqual([]);
	});
});
