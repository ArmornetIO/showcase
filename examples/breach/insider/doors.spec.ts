import { describe, expect, it } from 'vitest';
import { DOORS } from './office.js';
import { doorStates, leafModel, stepDoors, toggle, SWING_S } from './doors.js';

/** Where the leaf's free edge (2 × the 0.75m jamb from the hinge, along +z) lands. */
const edge = (m: Float32Array) => ({ x: m[8] * 1.5 + m[12], z: m[10] * 1.5 + m[14] });

describe('doors', () => {
	it('shuts every leaf across its own doorway', () => {
		for (const ds of doorStates(DOORS)) {
			ds.at = 1;
			const e = edge(leafModel(ds, new Float32Array(16)));
			const { x, z, hinge } = ds.door;
			// Hinge and free edge sit either side of the doorway's middle.
			expect(Math.hypot(e.x - x, e.z - z)).toBeCloseTo(Math.hypot(hinge.x - x, hinge.z - z), 1);
			expect(Math.hypot(e.x - hinge.x, e.z - hinge.z)).toBeCloseTo(1.5, 2);
			expect((e.x - x) * (hinge.x - x) + (e.z - z) * (hinge.z - z)).toBeLessThan(0);
		}
	});

	it('swings shut over SWING_S, and will not shut on you', () => {
		const [d] = doorStates(DOORS);
		expect(toggle(d, { x: d.door.x, z: d.door.z })).toBe(false);
		expect(toggle(d, { x: d.door.x + 1.5, z: d.door.z })).toBe(true);
		stepDoors([d], SWING_S / 2);
		expect(d.at).toBeCloseTo(0.5);
		stepDoors([d], SWING_S);
		expect(d.at).toBe(1);
	});
});
