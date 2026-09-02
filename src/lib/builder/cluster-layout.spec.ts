// Node-side coverage for what a cluster does to its members.
//
// The DOM-bound half (dragging the title bar, drawing guides) belongs to the
// browser suite. What matters here is the arithmetic three surfaces depend on
// agreeing about: which items a cluster contains, where a stack puts them, and
// what applying a template leaves on the canvas.
import { describe, it, expect, beforeEach } from 'vitest';
import { builder } from './store.svelte.js';
import type { BuilderTemplate } from './templates.js';

// DataTable rather than something self-sizing: the stack maths reads the
// registry's placement size, so a component with real dimensions is the one that
// pins the arithmetic. `StatTile` is used deliberately in one test below,
// because a 0×0 registry entry is the case that used to collapse a stack.
const TILE = 'DataTable';
const TILE_W = 380;
const TILE_H = 240;
/** What #extent stands in with when the registry says "size yourself". */
const FALLBACK_H = 80;

function addTiles(n: number, x: number, y: number, step = 300) {
	for (let i = 0; i < n; i++) builder.addItem(TILE, x, y + i * step);
}

describe('clusters', () => {
	beforeEach(() => {
		builder.clearCanvas();
	});

	it('contains the items inside its rect and nothing outside it', () => {
		const c = builder.addCluster(100, 100, 400, 400);
		builder.addItem(TILE, 140, 140);
		builder.addItem(TILE, 140, 300);
		builder.addItem(TILE, 900, 900); // well clear of the cluster

		expect(builder.clusterMembers(c.id)).toHaveLength(2);
	});

	it('carries its members when it moves', () => {
		const c = builder.addCluster(100, 100, 400, 400);
		builder.addItem(TILE, 140, 140);
		const before = builder.items.find((i) => i.componentId === TILE)!;

		builder.setClusterRect(c.id, 200, 260, 400, 400);

		const after = builder.items.find((i) => i.id === before.id)!;
		expect(after.x).toBe(before.x + 100);
		expect(after.y).toBe(before.y + 160);
	});

	it('leaves positions alone in free layout', () => {
		const c = builder.addCluster(100, 100, 600, 600);
		addTiles(3, 140, 140);
		const before = builder.items.map((i) => ({ x: i.x, y: i.y }));

		builder.reflowCluster(c.id);

		expect(builder.items.map((i) => ({ x: i.x, y: i.y }))).toEqual(before);
	});

	it('stacks members down at padding and gap, and grows to fit', () => {
		const c = builder.addCluster(100, 100, 600, 1000);
		addTiles(3, 140, 140);

		builder.updateCluster(c.id, { layout: 'stack', padding: 20, gap: 20 });

		const members = builder.clusterMembers(c.id).sort((a, b) => a.y - b.y);
		expect(members).toHaveLength(3);
		for (const [n, m] of members.entries()) {
			expect(m.x).toBe(120); // cluster.x 100 + padding 20
			expect(m.y).toBe(120 + n * (TILE_H + 20));
		}
		// 3 tiles + 2 gaps + padding top and bottom.
		const cluster = builder.clusters.find((cl) => cl.id === c.id)!;
		expect(cluster.h).toBe(TILE_H * 3 + 20 * 2 + 20 * 2);
	});

	it('stacks across when the direction says so', () => {
		const c = builder.addCluster(100, 100, 400, 1000);
		addTiles(3, 140, 140);

		builder.updateCluster(c.id, { layout: 'stack', direction: 'horizontal', gap: 20 });

		const members = builder.clusterMembers(c.id).sort((a, b) => a.x - b.x);
		for (const [n, m] of members.entries()) {
			expect(m.y).toBe(120);
			expect(m.x).toBe(120 + n * (TILE_W + 20));
		}
		expect(builder.clusters.find((cl) => cl.id === c.id)!.w).toBe(TILE_W * 3 + 20 * 2 + 20 * 2);
	});

	it('gives a self-sizing component real height in a stack', () => {
		// StatTile is 0×0 in the registry — it sizes itself in the DOM. A stack
		// cannot ask the DOM, and reading that 0 literally used to pile the members
		// one gap apart, which reads as the layout having ignored them.
		const c = builder.addCluster(100, 100, 600, 1000);
		builder.addItem('StatTile', 140, 140);
		builder.addItem('StatTile', 140, 440);

		builder.updateCluster(c.id, { layout: 'stack', gap: 20 });

		const members = builder.clusterMembers(c.id).sort((a, b) => a.y - b.y);
		expect(members[1].y - members[0].y).toBe(FALLBACK_H + 20);
	});

	it('orders a stack by where the members currently sit', () => {
		const c = builder.addCluster(100, 100, 600, 1000);
		builder.addItem(TILE, 140, 600);
		builder.addItem(TILE, 140, 200);
		const [low, high] = builder.items; // insertion order: y=600 then y=200

		builder.updateCluster(c.id, { layout: 'stack' });

		// The one that was higher up ends up first, regardless of when it was added.
		const after = new Map(builder.items.map((i) => [i.id, i.y]));
		expect(after.get(high.id)!).toBeLessThan(after.get(low.id)!);
	});
});

describe('applyTemplate', () => {
	beforeEach(() => {
		builder.clearCanvas();
	});

	const TEMPLATE: BuilderTemplate = {
		id: 't',
		name: 'Two tiles',
		description: '',
		items: [
			{ componentId: TILE, x: 0, y: 0 },
			{ componentId: TILE, x: 240, y: 0 }
		]
	};

	it('wraps the arrangement in a cluster sized to it', () => {
		builder.applyTemplate(TEMPLATE, 100, 100);

		expect(builder.clusters).toHaveLength(1);
		const c = builder.clusters[0];
		expect(c.name).toBe('Two tiles');
		expect(c.layout).toBe('free');
		// Two tiles spanning 460 wide, plus 20 padding on each side.
		expect(c.w).toBe(240 + TILE_W + 40);
		expect(builder.clusterMembers(c.id)).toHaveLength(2);
	});

	it('does not also group a clustered template', () => {
		builder.applyTemplate(TEMPLATE, 100, 100);

		// Both bind the same items, and a group binds harder — dragging one member
		// would move all of them, which is the gesture the cluster exists to serve.
		expect(builder.groups).toHaveLength(0);
		expect(builder.items.every((i) => i.groupId === undefined)).toBe(true);
	});

	it('groups instead when the template opts out of clustering', () => {
		builder.applyTemplate({ ...TEMPLATE, cluster: false }, 100, 100);

		expect(builder.clusters).toHaveLength(0);
		expect(builder.groups).toHaveLength(1);
		expect(builder.items.every((i) => i.groupId === builder.groups[0].id)).toBe(true);
	});

	it('honours a template that asks to be stacked', () => {
		builder.applyTemplate({ ...TEMPLATE, cluster: { layout: 'stack', gap: 10 } }, 100, 100);

		const c = builder.clusters[0];
		expect(c.layout).toBe('stack');
		const members = builder.clusterMembers(c.id).sort((a, b) => a.y - b.y);
		expect(members[1].y - members[0].y).toBe(TILE_H + 10);
		expect(members[0].x).toBe(members[1].x);
	});
});
