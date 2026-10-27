import { describe, it, expect } from 'vitest';
import { ALL_PIECES } from './piece-catalogue.js';
import { hullsForPlacement, faceClassOverlay } from './piece-hulls.js';

// The first-person street. Kept in step with routes/mockups/first-person by hand.
const STREET = [
	'house', 'keep', 'archive', 'forum', 'court', 'mill', 'checkpoint',
	'bastion', 'observatory', 'precinct', 'silos', 'forge', 'pavilion', 'redoubt'
];

describe('hullsForPlacement', () => {
	for (const piece of STREET) {
		// `hullFromFaces` throws unless every corner lies behind every face plane, so
		// building at all is the containment check; this asserts it, at both turns.
		it(`${piece}: one convex hull per solid, standing on the ground`, () => {
			for (const yaw of [Math.PI / 2, -Math.PI / 2]) {
				const hulls = hullsForPlacement({ piece, x: 14, z: -18, yaw, scale: 7 });
				expect(hulls).toHaveLength(ALL_PIECES[piece].length);
				for (const h of hulls) {
					expect(h.max.y).toBeLessThanOrEqual(2 * 7 + 1e-9);
					expect(h.min.y).toBeGreaterThanOrEqual(-1e-9);
				}
			}
		});
	}
});

describe('faceClassOverlay', () => {
	it('covers every triangle of the piece exactly once', () => {
		for (const piece of STREET) {
			const o = faceClassOverlay(piece);
			let tris = 0;
			for (const s of ALL_PIECES[piece]) for (const f of s.faces) tris += f.length - 2;
			const got = (o.walkable.length + o.climbable.length + o.wall.length) / 7 / 3;
			expect(got).toBe(tris);
		}
	});

	it('gives every street piece something to stand on', () => {
		for (const piece of STREET) expect(faceClassOverlay(piece).walkable.length).toBeGreaterThan(0);
	});
});
