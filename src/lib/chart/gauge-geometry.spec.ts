import { describe, expect, test } from 'vitest';
import { gaugeArcPath, gaugeFilled, gaugeFrac, gaugePoint, gaugeSegments } from './gauge-geometry.js';
import type { GaugeBand } from './chart.types.js';

const D: [number, number] = [0, 100];
const ARC = { cx: 100, cy: 100, sweep: 240, startAngle: 150 };

describe('gaugeFrac', () => {
	test('maps the domain onto 0–1', () => {
		expect(gaugeFrac(0, D)).toBe(0);
		expect(gaugeFrac(50, D)).toBe(0.5);
		expect(gaugeFrac(100, D)).toBe(1);
	});

	test('clamps out-of-range readings to the ends', () => {
		// Unclamped these sweep off the dial — 120 would render past the scale's
		// end and read as a higher score than the gauge can express.
		expect(gaugeFrac(-20, D)).toBe(0);
		expect(gaugeFrac(120, D)).toBe(1);
	});

	test('handles a non-zero floor', () => {
		expect(gaugeFrac(75, [50, 100])).toBe(0.5);
	});

	test('a zero-width domain does not divide by zero', () => {
		expect(gaugeFrac(5, [10, 10])).toBe(0);
	});
});

describe('gaugeSegments', () => {
	const bands: GaugeBand[] = [
		{ to: 60, color: 'red' },
		{ to: 85, color: 'amber' },
		{ to: 100, color: 'green' }
	];

	test('bands are contiguous — each starts where the last stopped', () => {
		const segs = gaugeSegments(bands, D);
		expect(segs.map((s) => [s.from, s.to])).toEqual([
			[0, 0.6],
			[0.6, 0.85],
			[0.85, 1]
		]);
	});

	test('a bound past the ceiling is clipped, not drawn beyond it', () => {
		const segs = gaugeSegments([{ to: 60, color: 'red' }, { to: 500, color: 'green' }], D);
		expect(segs[1].to).toBe(1);
	});

	test('a band already past the ceiling collapses instead of drawing backwards', () => {
		const segs = gaugeSegments(
			[{ to: 100, color: 'a' }, { to: 40, color: 'b' }],
			D
		);
		expect(segs[1].from).toBe(1);
		expect(segs[1].to).toBe(1);
		expect(segs[1].to).toBeGreaterThanOrEqual(segs[1].from);
	});

	test('covers the whole scale with no gaps', () => {
		const segs = gaugeSegments(bands, D);
		expect(segs[0].from).toBe(0);
		expect(segs[segs.length - 1].to).toBe(1);
		for (let i = 1; i < segs.length; i++) expect(segs[i].from).toBe(segs[i - 1].to);
	});
});

describe('gaugeFilled', () => {
	const segs = gaugeSegments(
		[
			{ to: 60, color: 'red' },
			{ to: 85, color: 'amber' },
			{ to: 100, color: 'green' }
		],
		D
	);

	test('the reading is cut at band boundaries, keeping every band it crossed', () => {
		// A 76 has passed through red and stopped inside amber. Painting one hue
		// to the reading covers the bands it is meant to be read against.
		const filled = gaugeFilled(segs, gaugeFrac(76, D));
		expect(filled.map((s) => s.color)).toEqual(['red', 'amber']);
		expect(filled[1].to).toBeCloseTo(0.76, 5);
	});

	test('bands beyond the reading are dropped, not drawn at zero width', () => {
		const filled = gaugeFilled(segs, gaugeFrac(30, D));
		expect(filled).toHaveLength(1);
		expect(filled[0].to).toBeCloseTo(0.3, 5);
	});

	test('a zero reading fills nothing', () => {
		expect(gaugeFilled(segs, 0)).toHaveLength(0);
	});

	test('a full reading fills every band', () => {
		expect(gaugeFilled(segs, 1)).toHaveLength(3);
	});
});

describe('gaugePoint', () => {
	test('the midpoint of a 240° gauge sits at the top', () => {
		const [x, y] = gaugePoint(0.5, 50, ARC);
		expect(x).toBeCloseTo(100, 5);
		expect(y).toBeCloseTo(50, 5); // SVG y grows downward, so above centre
	});

	test('the ends sit below centre, mirrored about it', () => {
		const [x0, y0] = gaugePoint(0, 50, ARC);
		const [x1, y1] = gaugePoint(1, 50, ARC);
		expect(y0).toBeGreaterThan(ARC.cy);
		expect(y0).toBeCloseTo(y1, 5);
		expect(x0).toBeCloseTo(2 * ARC.cx - x1, 5);
	});
});

describe('gaugeArcPath', () => {
	test('sets the large-arc flag only past 180° of sweep', () => {
		// 240° × 0.8 = 192° needs the flag; 240° × 0.5 = 120° must not have it,
		// or the renderer draws the complement of the arc it was asked for.
		expect(gaugeArcPath(0, 0.8, 50, ARC)).toMatch(/A 50\.00 50\.00 0 1 1/);
		expect(gaugeArcPath(0, 0.5, 50, ARC)).toMatch(/A 50\.00 50\.00 0 0 1/);
	});

	test('always sweeps clockwise', () => {
		expect(gaugeArcPath(0.2, 0.4, 50, ARC).trim().endsWith('1')).toBe(false);
		expect(gaugeArcPath(0.2, 0.4, 50, ARC)).toContain(' 0 1 ');
	});
});
