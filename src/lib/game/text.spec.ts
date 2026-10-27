import { describe, it, expect } from 'vitest';
import { text3d, textWidth } from './text.js';

describe('text3d', () => {
	it('makes one box per run of lit pixels in a row', () => {
		// I: a run of three, five single stems, a run of three.
		expect(text3d('I')).toHaveLength(7);
		expect(text3d('-')).toHaveLength(1);
		expect(text3d(' ')).toHaveLength(0);
	});

	it('centres the line on x by default and sets it at the cap height', () => {
		const xs = text3d('HI', { size: 0.7 }).flatMap((s) => s.verts.map((v) => v.e));
		const w = textWidth('HI', 0.7);
		expect(Math.min(...xs)).toBeCloseTo(-w / 2);
		expect(Math.max(...xs)).toBeCloseTo(w / 2);
		const hs = text3d('H', { size: 0.7, y: 2 }).flatMap((s) => s.verts.map((v) => v.h));
		expect(Math.min(...hs)).toBeCloseTo(2);
		expect(Math.max(...hs)).toBeCloseTo(2.7);
	});

	it('reads lower case as upper and refuses what it cannot draw', () => {
		expect(text3d('ab')).toEqual(text3d('AB'));
		expect(() => text3d('é')).toThrow(/no glyph/);
	});
});
