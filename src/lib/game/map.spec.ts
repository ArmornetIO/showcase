import { describe, it, expect } from 'vitest';
import { composeMap, cuboid, type MapDef } from './map.js';

const def = (over: Partial<MapDef> = {}): MapDef => ({
	id: 't',
	label: 'T',
	materials: { wood: { face: '--fg' }, glass: { face: '--bg', lit: 0 } },
	props: {
		desk: {
			solids: [cuboid(-1, 1, 0.7, 0.75, -0.5, 0.5)],
			material: 'wood',
			slots: [{ kind: 'item', x: 0, y: 0.75, z: 0 }]
		},
		cup: { kind: 'item', ghost: true, solids: [cuboid(-0.05, 0.05, 0, 0.1, -0.05, 0.05)], material: 'glass' }
	},
	chunks: { pair: [{ prop: 'desk', x: -2, z: 0 }, { prop: 'desk', x: 2, z: 0 }] },
	puts: [{ chunk: 'pair', x: 10, z: 0 }],
	spawn: { x: 0, y: 0, z: 0 },
	bounds: { x0: -50, x1: 50, z0: -50, z1: 50 },
	...over
});

describe('composeMap', () => {
	it('fills each slot from its kind, and only solid props collide', () => {
		const m = composeMap(def());
		expect(m.placed).toBe(4); // two desks, a cup on each
		expect(m.world.hulls).toHaveLength(2); // the cups are ghosts
		expect(m.batches.map((b) => b.material).sort()).toEqual(['glass', 'wood']);
	});

	it('places a chunk in its parent frame', () => {
		const [a, b] = composeMap(def()).world.hulls;
		expect([a.min.x, b.max.x].map((v) => Math.round(v))).toEqual([7, 13]);
		expect(a.max.y).toBeCloseTo(0.75);
	});

	it('turns a chunk with its yaw', () => {
		const [a] = composeMap(def({ puts: [{ chunk: 'pair', x: 0, z: 0, yaw: Math.PI / 2 }] })).world.hulls;
		// x −2 turned a quarter about +y lands on z = +2 (x' = c·x + s·z, z' = −s·x + c·z).
		expect((a.min.z + a.max.z) / 2).toBeCloseTo(2);
	});

	it('is the same map for the same seed', () => {
		const props = { ...def().props, mug: { kind: 'item', ghost: true, solids: [cuboid(0, 0.1, 0, 0.1, 0, 0.1)], material: 'wood' } };
		const sizes = (seed: number) => composeMap(def({ props }), seed).batches.map((b) => b.tris.length).join();
		expect(sizes(3)).toBe(sizes(3));
	});

	it('refuses a chunk that contains itself', () => {
		expect(() => composeMap(def({ chunks: { loop: [{ chunk: 'loop', x: 0, z: 0 }] }, puts: [{ chunk: 'loop', x: 0, z: 0 }] }))).toThrow(/nesting/);
	});
});
