import { describe, it, expect } from 'vitest';
import {
	packInstance,
	packInstances,
	hexRgb,
	isSolid,
	INSTANCE_FLOATS,
	STATE_HEALTHY,
	STATE_OFFLINE,
	STATE_SELECTED
} from './piece-instances.js';
import type { StudioNode } from '../studio.types.js';
import { tangentFrame } from '../../physics/sphere.js';

/** A UNIT direction. `tangentFrame` builds its axes from whatever it is handed,
 *  so feeding it an unnormalised vector yields unnormalised axes — which would
 *  quietly scale every world normal and bias the shading bands. The assertion
 *  below caught exactly that when this fixture was sloppy, so it stays. */
const dir = (() => {
	const v = { x: 0.2, y: -0.3, z: 0.93 };
	const m = Math.hypot(v.x, v.y, v.z);
	return { x: v.x / m, y: v.y / m, z: v.z / m };
})();
const frame = tangentFrame(dir, 400, { step: 30, lean: 0.3 });

function node(over: Partial<StudioNode> = {}): StudioNode {
	return {
		id: 'n1',
		type: 'agentic',
		state: 'healthy',
		label: 'N',
		x: 120,
		y: 240,
		r: 30,
		piece: 'silos',
		frame,
		...over
	} as StudioNode;
}

const style = { color: '#7FE3F0', land: '#2C4A57' };
const styleOf = () => style;

describe('hexRgb', () => {
	it('reads both the long and short forms', () => {
		expect(hexRgb('#ffffff')).toEqual([1, 1, 1]);
		expect(hexRgb('#000000')).toEqual([0, 0, 0]);
		expect(hexRgb('#fff')).toEqual([1, 1, 1]);
		const [r, g, b] = hexRgb('#7FE3F0');
		expect(r).toBeCloseTo(0x7f / 255, 6);
		expect(g).toBeCloseTo(0xe3 / 255, 6);
		expect(b).toBeCloseTo(0xf0 / 255, 6);
	});

	it('falls back to a VISIBLE colour, never black', () => {
		// A black building reads as a hole in the scene; mid-grey reads as "someone
		// passed something odd", which is the failure you want.
		for (const bad of ['', 'rgb(1,2,3)', '#12', 'nonsense']) {
			expect(hexRgb(bad)).toEqual([0.5, 0.5, 0.5]);
		}
	});
});

describe('isSolid', () => {
	it('needs BOTH a shape and somewhere to stand', () => {
		expect(isSolid(node())).toBe(true);
		expect(isSolid(node({ frame: undefined }))).toBe(false);
		expect(isSolid(node({ piece: undefined }))).toBe(false);
	});
});

describe('packInstance', () => {
	it('writes exactly INSTANCE_FLOATS and reports the next offset', () => {
		const out = new Float32Array(INSTANCE_FLOATS * 2);
		const next = packInstance(out, 0, node() as never, style, STATE_HEALTHY);
		expect(next).toBe(INSTANCE_FLOATS);
		const second = packInstance(out, next, node() as never, style, STATE_HEALTHY);
		expect(second).toBe(INSTANCE_FLOATS * 2);
	});

	it('lays the frame out in the order the shader reads it', () => {
		// The packing order, PIECE_ATTRIBS, and the vertex shader's `in`
		// declarations are three statements of one fact. This pins the first.
		const out = new Float32Array(INSTANCE_FLOATS);
		packInstance(out, 0, node() as never, style, STATE_HEALTHY);
		expect([out[0], out[1]]).toEqual([120, 240]); // iOrigin
		expect(out[2]).toBeCloseTo(frame.e.x, 5);
		expect(out[3]).toBeCloseTo(frame.e.y, 5);
		expect(out[4]).toBeCloseTo(frame.n.x, 5);
		expect(out[5]).toBeCloseTo(frame.n.y, 5);
		expect(out[6]).toBeCloseTo(frame.u.x, 5);
		expect(out[7]).toBeCloseTo(frame.u.y, 5);
		expect(out[8]).toBeCloseTo(frame.grow, 5);
		expect(out[9]).toBe(0); // sink defaults
		// The world axes follow, and they must be UNIT — orientation is judged from
		// these, and a scaled normal would bias the shading bands.
		const axis = out.slice(10, 19);
		for (const a of [axis.slice(0, 3), axis.slice(3, 6), axis.slice(6, 9)]) {
			expect(Math.hypot(a[0], a[1], a[2])).toBeCloseTo(1, 5);
		}
		expect(out[INSTANCE_FLOATS - 2]).toBe(1); // iAlpha
		expect(out[INSTANCE_FLOATS - 1]).toBe(STATE_HEALTHY);
	});

	it('keeps screen displacement and world direction separate', () => {
		// Mixing them is the classic bug: one is scaled by `step` and bent by
		// perspective, the other is neither. If iE ever equalled iAxisE.xy the
		// shading would silently follow the projection.
		const out = new Float32Array(INSTANCE_FLOATS);
		packInstance(out, 0, node() as never, style, STATE_HEALTHY);
		expect(out[2]).not.toBeCloseTo(out[10], 3);
	});
});

describe('packInstances', () => {
	it('packs only the drawable nodes', () => {
		const nodes = [
			node({ id: 'a' }),
			node({ id: 'b', frame: undefined }), // flat arrangement — no frame
			node({ id: 'c', piece: undefined }), // a disc
			node({ id: 'd' })
		];
		const r = packInstances(nodes, styleOf);
		expect(r.count).toBe(2);
		expect(r.order.map((n) => n.id)).toEqual(['a', 'd']);
	});

	it('marks the selected node, and only it', () => {
		const nodes = [node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c', state: 'offline' })];
		const r = packInstances(nodes, styleOf, 'b');
		const stateAt = (i: number) => r.data[i * INSTANCE_FLOATS + INSTANCE_FLOATS - 1];
		expect(stateAt(0)).toBe(STATE_HEALTHY);
		expect(stateAt(1)).toBe(STATE_SELECTED);
		expect(stateAt(2)).toBe(STATE_OFFLINE);
	});

	it('selection outranks offline — the scene wins over the node', () => {
		const r = packInstances([node({ id: 'x', state: 'offline' })], styleOf, 'x');
		expect(r.data[INSTANCE_FLOATS - 1]).toBe(STATE_SELECTED);
	});

	it('reuses the callers buffer, and never shrinks it', () => {
		// This runs every frame for the life of the globe. Allocating a fresh
		// Float32Array each time is garbage the collector has to find mid-animation.
		const many = Array.from({ length: 20 }, (_, i) => node({ id: `n${i}` }));
		const first = packInstances(many, styleOf);
		const again = packInstances(many, styleOf, null, first.data);
		expect(again.data).toBe(first.data);
		// A smaller frame keeps the same (larger) buffer rather than reallocating.
		const fewer = packInstances(many.slice(0, 3), styleOf, null, first.data);
		expect(fewer.data).toBe(first.data);
		expect(fewer.count).toBe(3);
	});

	it('grows when the mesh outgrows the buffer', () => {
		const small = packInstances([node()], styleOf);
		const big = packInstances(
			Array.from({ length: 40 }, (_, i) => node({ id: `n${i}` })),
			styleOf,
			null,
			small.data
		);
		expect(big.data).not.toBe(small.data);
		expect(big.data.length).toBeGreaterThanOrEqual(40 * INSTANCE_FLOATS);
	});

	it('is deterministic — same scene, same bytes', () => {
		const nodes = [node({ id: 'a' }), node({ id: 'b' })];
		const a = packInstances(nodes, styleOf, 'a');
		const b = packInstances(nodes, styleOf, 'a');
		expect([...b.data.slice(0, b.count * INSTANCE_FLOATS)]).toEqual([
			...a.data.slice(0, a.count * INSTANCE_FLOATS)
		]);
	});
});
