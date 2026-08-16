import { describe, it, expect } from 'vitest';
import { packSunflower, GOLDEN_ANGLE } from './sunflower.js';

/** Closest approach between any two bodies, minus the room they need. */
function worstGap(radii: number[], pts: { x: number; y: number }[]): number {
	let worst = Infinity;
	for (let i = 0; i < pts.length; i++)
		for (let j = i + 1; j < pts.length; j++)
			worst = Math.min(worst, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) - radii[i] - radii[j]);
	return worst;
}

describe('packSunflower', () => {
	it('never overlaps, at any mesh size', () => {
		for (const n of [2, 3, 8, 12, 20, 30, 50]) {
			const radii = Array(n).fill(68.6);
			const { points } = packSunflower(radii, { margin: 18, hubR: 58, hubMargin: 40 });
			expect(worstGap(radii, points), `n=${n}`).toBeGreaterThanOrEqual(17.99);
		}
	});

	it('never overlaps with mixed sizes', () => {
		const radii = [146, 68.6, 68.6, 80.6, 68.6, 146, 68.6, 80.6, 68.6, 68.6, 146, 68.6];
		const { points } = packSunflower(radii, { margin: 18, hubR: 58, hubMargin: 40 });
		expect(worstGap(radii, points)).toBeGreaterThanOrEqual(17.99);
	});

	it('clears the hub', () => {
		const radii = Array(20).fill(68.6);
		const { points } = packSunflower(radii, { margin: 18, hubR: 58, hubMargin: 40 });
		for (const [i, p] of points.entries())
			expect(Math.hypot(p.x, p.y) - radii[i], `body ${i}`).toBeGreaterThanOrEqual(58 + 40 - 0.01);
	});

	it('gives every body its own bearing — no body hides behind another', () => {
		// The property that makes hub lines legible for free: with distinct bearings
		// nothing sits on anyone else's radial line back to the hub.
		const { points } = packSunflower(Array(50).fill(68.6), { hubR: 58 });
		const bearings = points.map((p) => Math.atan2(p.y, p.x)).sort((a, b) => a - b);
		let closest = Infinity;
		for (let i = 1; i < bearings.length; i++) closest = Math.min(closest, bearings[i] - bearings[i - 1]);
		expect(closest).toBeGreaterThan(0.01);
	});

	it('grows with √n, not n — the void never forms', () => {
		const r = (n: number) => packSunflower(Array(n).fill(68.6), { margin: 18, hubR: 58, hubMargin: 40 }).radius;
		// Quadrupling the mesh should roughly double the footprint, not quadruple it.
		const ratio = r(48) / r(12);
		expect(ratio).toBeLessThan(2.6);
	});

	it('spaces successive bodies a golden angle apart', () => {
		const { points } = packSunflower(Array(3).fill(10), { hubR: 0 });
		const bearing = (i: number) => Math.atan2(points[i].y, points[i].x);
		const delta = ((bearing(1) - bearing(0)) % (Math.PI * 2)) + Math.PI * 2;
		expect(delta % (Math.PI * 2)).toBeCloseTo(GOLDEN_ANGLE, 4);
	});

	it('is deterministic', () => {
		const key = () =>
			packSunflower(Array(20).fill(68.6), { margin: 18, hubR: 58, hubMargin: 40 })
				.points.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)
				.join(' ');
		expect(key()).toBe(key());
	});

	it('survives an empty mesh', () => {
		expect(packSunflower([], { hubR: 58, hubMargin: 40 }).points).toEqual([]);
	});
});

describe('packSunflower · wedge', () => {
	const fan = (n: number) =>
		packSunflower(Array(n).fill(68.6), {
			margin: 18,
			hubR: 58,
			hubMargin: 40,
			startAngle: 0,
			spread: 120,
		});

	it('keeps every body inside the wedge', () => {
		for (const p of fan(24).points) {
			const deg = (Math.atan2(p.y, p.x) * 180) / Math.PI;
			expect(Math.abs(deg)).toBeLessThanOrEqual(60.01);
		}
	});

	it('puts the whole mesh to one side of the hub', () => {
		for (const p of fan(24).points) expect(p.x).toBeGreaterThan(0);
	});

	it('never overlaps in a wedge either', () => {
		for (const n of [2, 8, 24, 40]) {
			const radii = Array(n).fill(68.6);
			expect(worstGap(radii, fan(n).points), `n=${n}`).toBeGreaterThanOrEqual(17.99);
		}
	});

	it('still spreads across the wedge rather than bunching at one edge', () => {
		const degs = fan(24).points.map((p) => (Math.atan2(p.y, p.x) * 180) / Math.PI);
		expect(Math.min(...degs)).toBeLessThan(-30);
		expect(Math.max(...degs)).toBeGreaterThan(30);
	});

	it('reaches further than a full turn would — a wedge is less room', () => {
		const radii = Array(24).fill(68.6);
		const full = packSunflower(radii, { margin: 18, hubR: 58, hubMargin: 40 });
		expect(fan(24).radius).toBeGreaterThan(full.radius);
	});

	it('treats a full turn or more as no wedge at all', () => {
		const radii = Array(12).fill(68.6);
		const o = { margin: 18, hubR: 58, hubMargin: 40 };
		expect(packSunflower(radii, { ...o, spread: 360 }).points).toEqual(packSunflower(radii, o).points);
	});
});
