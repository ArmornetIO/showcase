import { describe, expect, test } from 'vitest';
import { inferYDomain, buildScaleY } from './chart-scales.js';
import type { ChartSeries, ChartConfig } from './chart.types.js';

const series: ChartSeries[] = [
	{ id: 'dns', label: 'DNS', stackGroup: 't', points: [{ x: '01', y: 18 }, { x: '02', y: 4 }] },
	{ id: 'npm', label: 'NPM', stackGroup: 't', points: [{ x: '01', y: 68 }, { x: '02', y: 6 }] }
];
const visible = new Set(['dns', 'npm']);

describe('inferYDomain', () => {
	test('unstacked takes the tallest single point', () => {
		const [, max] = inferYDomain(series, visible);
		expect(max).toBeGreaterThanOrEqual(68);
		expect(max).toBeLessThan(86);
	});

	test('stacked reaches the tallest TOTAL, not the tallest segment', () => {
		// 18 + 68 = 86 at x=01. A domain topping out at 68 clips the stack, which
		// is what made the chart render empty.
		const [, max] = inferYDomain(series, visible, undefined, 'left', 0.08, true);
		expect(max).toBeGreaterThanOrEqual(86);
	});

	test('separate stack groups are not summed into each other', () => {
		const twoStacks: ChartSeries[] = [
			{ id: 'a', label: 'A', stackGroup: 'x', points: [{ x: '01', y: 10 }] },
			{ id: 'b', label: 'B', stackGroup: 'y', points: [{ x: '01', y: 10 }] }
		];
		const [, max] = inferYDomain(twoStacks, new Set(['a', 'b']), undefined, 'left', 0.08, true);
		expect(max).toBeLessThan(20);
	});

	test('an explicit domain still wins', () => {
		const d = inferYDomain(series, visible, { domain: [0, 5] }, 'left', 0.08, true);
		expect(d).toEqual([0, 5]);
	});
});

describe('buildScaleY', () => {
	test('a stacked-bar config gets a stack-aware scale', () => {
		const config: ChartConfig = { type: 'stacked-bar', series };
		const scale = buildScaleY(config, visible, 100);
		// The full stack must land inside the plot, i.e. at or below the top edge.
		expect(scale(86)).toBeGreaterThanOrEqual(0);
		expect(scale(0)).toBeLessThanOrEqual(100);
	});
});
