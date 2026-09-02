import { describe, it, expect } from 'vitest';
import { vanishCss, VANISH_DEFAULTS, VANISH_DURATION, type VanishGeometry } from './vanish.js';

const g: VanishGeometry = { lift: 8, scale: 0.92, blur: 4, origin: 'top right' };

describe('vanishCss', () => {
	it('is at rest at t=1 — no travel, no blur, fully opaque', () => {
		const css = vanishCss(1, g);
		expect(css).toContain('translateY(-0.000px)');
		expect(css).toContain('scale(1.0000)');
		expect(css).toContain('blur(0.000px)');
		expect(css).toContain('opacity: 1.0000;');
	});

	it('is fully retracted at t=0', () => {
		const css = vanishCss(0, g);
		expect(css).toContain('translateY(-8.000px)');
		expect(css).toContain('scale(0.9200)');
		expect(css).toContain('blur(4.000px)');
		expect(css).toContain('opacity: 0.0000;');
	});

	it('interpolates every channel at the midpoint', () => {
		const css = vanishCss(0.5, g);
		expect(css).toContain('translateY(-4.000px)');
		expect(css).toContain('scale(0.9600)');
		expect(css).toContain('blur(2.000px)');
		expect(css).toContain('opacity: 0.5000;');
	});

	it('retracts toward the given origin', () => {
		expect(vanishCss(0.5, g)).toContain('transform-origin: top right;');
	});

	it('honours neutral geometry — scale 1 / blur 0 leave those channels flat', () => {
		const css = vanishCss(0, { ...g, scale: 1, blur: 0 });
		expect(css).toContain('scale(1.0000)');
		expect(css).toContain('blur(0.000px)');
	});
});

describe('vanish defaults', () => {
	it('cannot be mutated by a caller', () => {
		expect(Object.isFrozen(VANISH_DEFAULTS)).toBe(true);
	});

	it('is quick enough to stay out of the way', () => {
		expect(VANISH_DURATION).toBeLessThanOrEqual(250);
	});
});
