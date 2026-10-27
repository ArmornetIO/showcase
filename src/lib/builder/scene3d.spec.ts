import { describe, expect, it } from 'vitest';
import { composeMap } from '../game/map.js';
import type { CanvasItem } from './store.svelte.js';
import { OBJECT3D, pickAt, sceneMap } from './scene3d.js';

const obj = (id: string, subject: string, x: number, z: number, extra: Partial<CanvasItem> = {}): CanvasItem => ({
	id,
	componentId: OBJECT3D,
	x: 0,
	y: 0,
	w: 0,
	h: 0,
	zIndex: 0,
	visible: true,
	locked: false,
	props: { subject, x, z, lift: 0, yaw: 90, scale: 1 },
	...extra
});

describe('sceneMap', () => {
	it('puts each visible object where its props say, in radians', () => {
		const def = sceneMap([obj('a', 'piece:house', 3, -4), obj('b', 'piece:keep', 0, 0, { visible: false })]);
		expect(def.puts).toEqual([{ prop: 'piece:house', x: 3, y: 0, z: -4, yaw: Math.PI / 2, scale: 1 }]);
		expect(def.props['piece:house']).toBeDefined();
		expect(def.props['piece:keep']).toBeUndefined();
	});

	it('composes as a BREACH map, models and characters included', () => {
		const def = sceneMap([obj('a', 'piece:house', 0, 0), obj('b', 'character:hunter', 4, 0), obj('c', 'model:garage-riser', -4, 0)]);
		const m = composeMap(def, 1);
		expect(m.placed).toBe(3);
		expect(m.batches.length).toBeGreaterThan(0);
	});

	it('drops subjects it cannot draw rather than failing the scene', () => {
		expect(sceneMap([obj('a', 'piece:no-such-building', 0, 0)]).puts).toEqual([]);
	});
});

describe('pickAt', () => {
	it('picks the object under a ground point, and nothing on empty ground', () => {
		const items = [obj('a', 'piece:house', 0, 0), obj('b', 'piece:house', 30, 0)];
		expect(pickAt(items, 0.5, 0.5)?.id).toBe('a');
		expect(pickAt(items, 30, 0)?.id).toBe('b');
		expect(pickAt(items, 15, 15)).toBeNull();
	});
});
