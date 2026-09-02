import { describe, it, expect } from 'vitest';
import { FX_KNOBS, FX_DEFAULTS, fxRegion, resolveFx, type SvgFxType } from './svg-fx.js';

describe('resolveFx', () => {
	it('keeps a bevel shoulder even when size collapses to zero', () => {
		// A height map with no slope gives the lighting nothing to read, so the
		// whole effect silently vanishes. The floor is deliberate.
		expect(resolveFx({ size: 0 }).bump).toBeGreaterThan(0);
		expect(resolveFx({ size: 0, softness: 0 }).bump).toBeGreaterThan(0);
	});

	it('clamps the knobs that would otherwise invert the effect', () => {
		expect(resolveFx({ size: -5 }).size).toBe(0);
		expect(resolveFx({ strength: -2 }).strength).toBe(0);
		expect(resolveFx({ softness: 4 }).softness).toBe(1);
		expect(resolveFx({ softness: -4 }).softness).toBe(0);
	});

	it('pushes the engrave offset AWAY from the light', () => {
		// Lit from the upper left (135°), the pressed lip must darken toward the
		// lower right, matching the direction the lit effects use.
		const upperLeft = resolveFx({ azimuth: 135, size: 10 });
		expect(upperLeft.dx).toBeGreaterThan(0);
		expect(upperLeft.dy).toBeGreaterThan(0);

		const upperRight = resolveFx({ azimuth: 45, size: 10 });
		expect(upperRight.dx).toBeLessThan(0);
		expect(upperRight.dy).toBeGreaterThan(0);
	});

	it('scales feathering with softness, and drops it entirely at 0', () => {
		expect(resolveFx({ size: 10, softness: 0 }).feather).toBe(0);
		expect(resolveFx({ size: 10, softness: 1 }).feather).toBeGreaterThan(
			resolveFx({ size: 10, softness: 0.5 }).feather
		);
	});

	it('fills unspecified tuning from the defaults', () => {
		expect(resolveFx()).toMatchObject({
			size: FX_DEFAULTS.size,
			azimuth: FX_DEFAULTS.azimuth,
			light: FX_DEFAULTS.light
		});
	});
});

describe('fxRegion', () => {
	it('opens the region symmetrically so effects are not cropped', () => {
		// The SVG default region is -10%/120% and clips every one of these effects.
		expect(fxRegion(50)).toEqual({ x: '-50%', y: '-50%', width: '200%', height: '200%' });
		expect(fxRegion(0)).toEqual({ x: '0%', y: '0%', width: '100%', height: '100%' });
	});

	it('never emits a negative-size region', () => {
		const r = fxRegion(-20);
		expect(r).toEqual({ x: '0%', y: '0%', width: '100%', height: '100%' });
	});
});

describe('FX_KNOBS', () => {
	const types: SvgFxType[] = ['glow', 'outline', 'emboss', 'chrome', 'engrave'];

	it('covers every effect type', () => {
		expect(Object.keys(FX_KNOBS).sort()).toEqual([...types].sort());
	});

	it('only advertises knobs that exist in the tuning', () => {
		for (const t of types) {
			for (const k of FX_KNOBS[t]) expect(FX_DEFAULTS).toHaveProperty(k);
		}
	});

	it('gives the lit effects a light direction and the paint effects a colour', () => {
		for (const t of ['emboss', 'chrome'] as const) {
			expect(FX_KNOBS[t]).toContain('azimuth');
			expect(FX_KNOBS[t]).toContain('light');
		}
		for (const t of ['glow', 'outline'] as const) expect(FX_KNOBS[t]).toContain('color');
	});
});
