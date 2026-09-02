import { describe, it, expect } from 'vitest';
import { collapseCss, COLLAPSE_DURATION, type CollapseMetrics } from './collapse.js';

const metrics: CollapseMetrics = {
	height: 120,
	paddingTop: 4,
	paddingBottom: 6,
	marginTop: 2,
	marginBottom: 8,
	opacity: 1
};

describe('collapseCss', () => {
	it('is fully closed at t=0', () => {
		const css = collapseCss(0, metrics);
		expect(css).toContain('height: 0px;');
		expect(css).toContain('padding-top: 0px;');
		expect(css).toContain('margin-bottom: 0px;');
		expect(css).toContain('opacity: 0;');
	});

	it('reaches the measured box at t=1', () => {
		const css = collapseCss(1, metrics);
		expect(css).toContain('height: 120px;');
		expect(css).toContain('padding-top: 4px;');
		expect(css).toContain('padding-bottom: 6px;');
		expect(css).toContain('margin-top: 2px;');
		expect(css).toContain('margin-bottom: 8px;');
		expect(css).toContain('opacity: 1;');
	});

	it('interpolates linearly in t', () => {
		expect(collapseCss(0.5, metrics)).toContain('height: 60px;');
		expect(collapseCss(0.25, metrics)).toContain('height: 30px;');
	});

	it('always clips overflow so content cannot spill mid-collapse', () => {
		for (const t of [0, 0.5, 1]) expect(collapseCss(t, metrics)).toContain('overflow: hidden;');
	});

	it('honours a non-zero closed opacity (fade disabled)', () => {
		expect(collapseCss(0, metrics, 1)).toContain('opacity: 1;');
		expect(collapseCss(0.5, metrics, 1)).toContain('opacity: 1;');
	});

	it('fades from a partially transparent rest opacity', () => {
		const dim = { ...metrics, opacity: 0.5 };
		expect(collapseCss(1, dim)).toContain('opacity: 0.5;');
		expect(collapseCss(0, dim)).toContain('opacity: 0;');
	});

	it('keeps the default duration short enough to read as feedback', () => {
		expect(COLLAPSE_DURATION).toBeLessThanOrEqual(200);
	});
});
