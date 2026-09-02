import { describe, it, expect } from 'vitest';
import { arcGeom, labelBox, nodeR, outerR, packingR, silhouetteR } from './mesh-metrics.js';
import type { StudioNode } from '../studio.types.js';

const node = (o: Partial<StudioNode> = {}): StudioNode =>
	({ id: 'n', type: 'agentic', state: 'healthy', label: 'n', x: 0, y: 0, ...o }) as StudioNode;

describe('nodeR', () => {
	it('takes an explicit radius over the type default', () => {
		expect(nodeR(node({ r: 44 }))).toBe(44);
	});

	it('falls back to a per-type default', () => {
		expect(nodeR(node({ type: 'control-plane' }))).toBe(56);
		expect(nodeR(node({ type: 'daemon' }))).toBe(42);
		expect(nodeR(node())).toBe(50);
	});

	it('scales with tuning', () => {
		expect(nodeR(node({ r: 44 }), 1.5)).toBe(66);
	});
});

describe('arcGeom', () => {
	it('adds nothing when the node has no links', () => {
		expect(arcGeom(0, 44)).toEqual({ step: 0, outerR: 44 });
	});

	it('clears the rim by the gap for a single link', () => {
		expect(arcGeom(1, 44).outerR).toBe(51);
	});

	it('tightens the ring spacing as links pile up', () => {
		expect(arcGeom(12, 44).step).toBeLessThan(arcGeom(4, 44).step);
	});

	it('never spaces rings wider than the cap', () => {
		expect(arcGeom(2, 200).step).toBeLessThanOrEqual(6);
	});

	it('floors the spacing, so a heavily-linked node keeps growing', () => {
		// The 2.4 floor outranks the band bound past ~10 links: spacing stops
		// tightening and the halo widens with every link after that. Nothing overlaps
		// (the layout sizes from these numbers), but the node does get large.
		expect(arcGeom(20, 44).step).toBe(2.4);
		expect(arcGeom(20, 44).outerR).toBeGreaterThan(arcGeom(12, 44).outerR);
	});
});

describe('outerR', () => {
	it('is the bare disc when arcs are off', () => {
		expect(outerR(44, 5, false)).toBe(44);
	});

	it('clears the ring stack when arcs are on', () => {
		expect(outerR(44, 5, true)).toBeGreaterThan(44);
	});
});

describe('labelBox', () => {
	it('widens with the longest caption line', () => {
		const short = labelBox(node({ label: 'dns' }));
		const long = labelBox(node({ label: 'io.armornet.agent.supply-chain' }));
		expect(long.halfW).toBeGreaterThan(short.halfW);
	});

	it('reaches further as the caption stack grows', () => {
		const bare = labelBox(node({ label: 'dns' })).reach;
		const valued = labelBox(node({ label: 'dns', value: '12' })).reach;
		const live = labelBox(node({ label: 'dns', value: '12', liveSlot: 'AGENTS' })).reach;
		expect(valued).toBeGreaterThan(bare);
		expect(live).toBeGreaterThan(valued);
	});
});

describe('silhouetteR', () => {
	it('is the disc for a bare node', () => {
		expect(silhouetteR(node({ r: 44 }))).toBe(44);
	});

	it('grows past the disc once connection rings show', () => {
		const r = silhouetteR(node({ r: 44 }), { connCount: 3, showArcs: true });
		expect(r).toBeGreaterThan(44);
	});

	it('is dominated by the satellite ring when an agent fans out', () => {
		const collapsed = node({ r: 44, modes: ['a', 'b', 'c'] });
		const expanded = node({ r: 44, modes: ['a', 'b', 'c'], expanded: true });
		// The screenshot's bug: fanning out more than doubles what the node occupies,
		// and the old fixed-slot layout gave it a leaf's room regardless.
		expect(silhouetteR(expanded)).toBeGreaterThan(silhouetteR(collapsed) * 2);
	});

	it('ignores modes a single-mode node does not fan out', () => {
		expect(silhouetteR(node({ r: 44, modes: ['a'], expanded: true }))).toBe(44);
	});
});

describe('packingR', () => {
	it('covers the caption when the caption is wider than the body', () => {
		const wide = node({ r: 44, label: 'io.armornet.agent.supply-chain.scanner' });
		expect(packingR(wide)).toBeGreaterThan(silhouetteR(wide));
	});

	it('is never smaller than the body', () => {
		const n = node({ r: 44, label: 'a', modes: ['a', 'b', 'c'], expanded: true });
		expect(packingR(n)).toBeGreaterThanOrEqual(silhouetteR(n));
	});

	it('leaves room below the rim for the caption stack', () => {
		const n = node({ r: 44, label: 'dns', value: '12', liveSlot: 'AGENTS' });
		expect(packingR(n, { connCount: 3, showArcs: true })).toBeGreaterThan(
			outerR(44, 3, true) + labelBox(n).reach - 0.01
		);
	});
});
