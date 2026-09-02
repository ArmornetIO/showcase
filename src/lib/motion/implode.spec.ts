import { describe, it, expect } from 'vitest';
import {
	implodeCss,
	IMPLODE_DEFAULTS,
	IMPLODE_DURATION,
	type ImplodeGeometry
} from './implode.js';

const g: ImplodeGeometry = {
	split: 0.5,
	bar: 0.05,
	bulge: 0.06,
	flash: 0.7,
	origin: 'center'
};

/** Pull a number out of the generated declaration block. */
function num(css: string, re: RegExp): number {
	const m = css.match(re);
	if (!m) throw new Error(`no match for ${re} in: ${css}`);
	return parseFloat(m[1]);
}
const scaleX = (css: string) => num(css, /scale\(([-\d.]+),/);
const scaleY = (css: string) => num(css, /scale\([-\d.]+, ([-\d.]+)\)/);
const opacity = (css: string) => num(css, /opacity: ([-\d.]+);/);
const bright = (css: string) => num(css, /brightness\(([-\d.]+)\)/);

describe('implodeCss', () => {
	it('is untouched at rest (t=1)', () => {
		const css = implodeCss(1, g);
		expect(scaleX(css)).toBe(1);
		expect(scaleY(css)).toBe(1);
		expect(opacity(css)).toBe(1);
		expect(bright(css)).toBe(1);
	});

	it('is fully gone at t=0', () => {
		const css = implodeCss(0, g);
		expect(scaleX(css)).toBe(0);
		expect(opacity(css)).toBe(0);
	});

	it('folds to the bar height by the end of phase A', () => {
		// u = split exactly — the fold is complete, the pinch has not started.
		const css = implodeCss(1 - g.split, g);
		expect(scaleY(css)).toBeCloseTo(g.bar, 5);
		expect(scaleX(css)).toBeCloseTo(1 + g.bulge, 5);
	});

	it('holds full opacity through the fold — the fade is tail-only', () => {
		expect(opacity(implodeCss(1 - g.split * 0.5, g))).toBe(1);
		expect(opacity(implodeCss(1 - g.split, g))).toBe(1);
	});

	it('widens as it folds, then narrows as it pinches', () => {
		const mid = scaleX(implodeCss(1 - g.split * 0.5, g));
		expect(mid).toBeGreaterThan(1);
		const late = scaleX(implodeCss(1 - (g.split + (1 - g.split) * 0.5), g));
		expect(late).toBeLessThan(mid);
	});

	it('brightens through the fold and stays lit through the pinch', () => {
		expect(bright(implodeCss(1 - g.split, g))).toBeCloseTo(1 + g.flash, 5);
		expect(bright(implodeCss(0.01, g))).toBeCloseTo(1 + g.flash, 5);
	});

	it('never produces a negative scale', () => {
		for (let i = 0; i <= 20; i++) {
			const css = implodeCss(i / 20, g);
			expect(scaleX(css)).toBeGreaterThanOrEqual(0);
			expect(scaleY(css)).toBeGreaterThanOrEqual(0);
		}
	});

	it('honours a neutral flash', () => {
		expect(bright(implodeCss(0.2, { ...g, flash: 0 }))).toBe(1);
	});

	it('does not divide by zero at the degenerate splits', () => {
		expect(() => implodeCss(0.5, { ...g, split: 0 })).not.toThrow();
		expect(() => implodeCss(0.5, { ...g, split: 1 })).not.toThrow();
	});
});

describe('implode defaults', () => {
	it('cannot be mutated by a caller', () => {
		expect(Object.isFrozen(IMPLODE_DEFAULTS)).toBe(true);
	});

	it('folds into itself rather than toward an anchor', () => {
		expect(IMPLODE_DEFAULTS.origin).toBe('center');
	});

	it('leaves room for two phases without dragging', () => {
		expect(IMPLODE_DURATION).toBeGreaterThan(200);
		expect(IMPLODE_DURATION).toBeLessThanOrEqual(320);
	});
});
