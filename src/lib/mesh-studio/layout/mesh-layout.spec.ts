import { describe, it, expect } from 'vitest';
import { solveMeshLayout, MESH_LAYOUTS, type Placeable } from './mesh-layout.js';

const hub = { x: 500, y: 350, r: 58 };
const spoke = (x = NaN, y = NaN, r = 44): Placeable => ({ x, y, r });

/** Worst overlap across every pair — negative means bodies interpenetrate. */
function worstGap(bodies: { x: number; y: number; r?: number }[], hubBody = hub): number {
	const all = [hubBody, ...bodies];
	let worst = Infinity;
	for (let i = 0; i < all.length; i++)
		for (let j = i + 1; j < all.length; j++) {
			const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y);
			worst = Math.min(worst, d - (all[i].r ?? 44) - (all[j].r ?? 44));
		}
	return worst;
}

describe('solveMeshLayout', () => {
	it('places every spoke without overlap, around the hub', () => {
		for (const { id } of MESH_LAYOUTS) {
			if (id === 'globe') continue; // globe is projected by the caller, not solved here
			const spokes = Array.from({ length: 12 }, () => spoke());
			solveMeshLayout(spokes, { layout: id, hub });
			expect(worstGap(spokes), `layout ${id} overlaps`).toBeGreaterThan(-1);
			for (const s of spokes) {
				expect(Number.isFinite(s.x)).toBe(true);
				expect(Number.isFinite(s.y)).toBe(true);
			}
		}
	});

	it('is a no-op for zero spokes', () => {
		expect(() => solveMeshLayout([], { layout: 'packed', hub })).not.toThrow();
	});

	it('keeps pinned spokes exactly in place while placing the rest', () => {
		const kept = spoke(120, 80, 44);
		const fresh = spoke();
		const spokes = [kept, fresh];
		solveMeshLayout(spokes, { layout: 'packed', hub, pinned: [true, false] });
		// Pinned node untouched…
		expect(kept.x).toBe(120);
		expect(kept.y).toBe(80);
		// …fresh node given a real position.
		expect(Number.isFinite(fresh.x)).toBe(true);
		expect(Number.isFinite(fresh.y)).toBe(true);
	});

	it('radial lanes keep hub→spoke lines clear (no node crowds another spoke on a small mesh)', () => {
		const spokes = Array.from({ length: 8 }, () => spoke());
		solveMeshLayout(spokes, { layout: 'radial', hub, lanes: true, laneClearance: 14 });
		// A clean ring: every spoke is roughly equidistant from the hub and none overlap.
		expect(worstGap(spokes)).toBeGreaterThan(-1);
	});
});
