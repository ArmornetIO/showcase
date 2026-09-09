// The fracture is geometry, and the property that matters is COVERAGE: the
// wedges have to partition the box, because any angle they miss is a slice of
// the crest that no shard draws — a hole in the shield that looks deliberate.
import { describe, expect, it } from 'vitest';
import { shatter, debris } from './shatter.js';

describe('shatter', () => {
	it('is the same break every time', () => {
		expect(shatter()).toEqual(shatter());
	});

	it('cuts the box into as many pieces as it was asked for', () => {
		expect(shatter(7)).toHaveLength(7);
		expect(shatter(4)).toHaveLength(4);
	});

	it('closes every wedge on the box edge', () => {
		for (const s of shatter()) {
			const pts = s.poly.split(',').map((p) => p.trim().split(/\s+/).map(parseFloat));
			// A wedge is at least the origin and two boundary hits; anything less is
			// a degenerate clip that shows nothing.
			expect(pts.length).toBeGreaterThanOrEqual(3);
			for (const [x, y] of pts) {
				expect(x).toBeGreaterThanOrEqual(-0.01);
				expect(x).toBeLessThanOrEqual(100.01);
				expect(y).toBeGreaterThanOrEqual(-0.01);
				expect(y).toBeLessThanOrEqual(100.01);
			}
			// Every point but the origin sits ON a wall.
			const onWall = pts
				.slice(1)
				.every(([x, y]) => [x, y].some((v) => v < 0.01 || v > 99.99));
			expect(onWall).toBe(true);
		}
	});

	it('keeps the pieces close enough for the silhouette to survive', () => {
		for (const s of shatter()) {
			expect(Math.hypot(s.dx, s.dy)).toBeLessThan(16);
			expect(Math.abs(s.rot)).toBeLessThan(10);
		}
	});

	it('leaves some bits behind and sends the rest away', () => {
		const d = debris();
		expect(d.some((p) => p.hold > 0)).toBe(true);
		expect(d.some((p) => p.hold === 0)).toBe(true);
	});
});
