import { describe, it, expect } from 'vitest';
import { mobiusLayout } from '../mobius.js';
import { seedStrips } from '../strips.js';
import { buildStripGeometry, parsePolyline, trailPoint, STROKE_FLOATS } from './strip-geometry.js';
import { fadeAt, fadeParams, stripBox, viewBoxOf, WORLD } from './strip-placement.js';
import { parseCssColor, rotateHue } from './strip-colors.js';

// The GPU half of the backdrop cannot be asserted on — a shader either draws or
// it does not, and neither outcome is a value a test can read. What CAN be
// pinned is everything upstream of it, which is also where the bugs that look
// like "the strips vanished" actually live: the adapter that turns path strings
// into triangles, the placement arithmetic, and the colour parser that stands
// between a CSS token and a uniform.

const layout = () => mobiusLayout(['t0'], { radius: 420, band: 150, segments: 40, rungs: 6 });

describe('parsePolyline', () => {
	it('recovers the points mobiusLayout wrote', () => {
		expect(Array.from(parsePolyline('M1,2L-3.5,4'))).toEqual([1, 2, -3.5, 4]);
	});

	it('drops an unpaired trailing coordinate rather than reading past the end', () => {
		expect(parsePolyline('M1,2L3').length).toBe(2);
	});

	it('returns nothing for an empty path', () => {
		expect(parsePolyline('').length).toBe(0);
	});
});

describe('buildStripGeometry', () => {
	it('packs two triangles per segment, in one buffer with two spans', () => {
		const l = layout();
		const g = buildStripGeometry(l, 2);
		const points = (d: string) => parsePolyline(d).length / 2;
		const edgeVerts = l.edge.reduce((n, e) => n + (points(e.d) - 1) * 6, 0);
		const rungVerts = l.rungs.reduce((n, r) => n + (points(r.d) - 1) * 6, 0);

		expect(g.edgeFirst).toBe(0);
		expect(g.edgeCount).toBe(edgeVerts);
		expect(g.rungFirst).toBe(edgeVerts);
		expect(g.rungCount).toBe(rungVerts);
		expect(g.data.length).toBe((edgeVerts + rungVerts) * STROKE_FLOATS);
	});

	it('emits a trail per traveller and none beyond the traffic asked for', () => {
		expect(buildStripGeometry(layout(), 2).trails).toHaveLength(2);
		expect(buildStripGeometry(layout(), 0).trails).toHaveLength(0);
	});

	it('offsets a join by a MITRED normal, so consecutive quads share their corners', () => {
		const g = buildStripGeometry(layout(), 0);
		// Vertex 2 of a segment is the next point's +side corner; vertex 6 is the
		// following segment's own +side corner at the same point. Sharing the
		// position and the offset is what leaves no seam down the join.
		const at = (v: number) => Array.from(g.data.subarray(v * STROKE_FLOATS, v * STROKE_FLOATS + 4));
		expect(at(2)).toEqual(at(6));
	});
});

describe('trailPoint', () => {
	it('walks by arc length, so perspective does not make a rider surge', () => {
		// Two segments, the second three times the first: half the DISTANCE lands
		// inside the long one, whereas indexing would put it at the joint.
		const trail = { pts: new Float32Array([0, 0, 1, 0, 5, 0]), cum: new Float32Array([0, 1, 5]) };
		expect(trailPoint(trail, 0.5).x).toBeCloseTo(2.5);
		expect(trailPoint(trail, 0).x).toBeCloseTo(0);
	});

	it('wraps, because the rim is a loop and the clock never stops', () => {
		const trail = { pts: new Float32Array([0, 0, 4, 0]), cum: new Float32Array([0, 4]) };
		expect(trailPoint(trail, 1.25).x).toBeCloseTo(1);
		expect(trailPoint(trail, -0.75).x).toBeCloseTo(1);
	});
});

describe('stripBox', () => {
	const spec = seedStrips(1, 7)[0];

	it('reads percentages against the frame and vw against the viewport', () => {
		const box = stripBox(spec, { w: 1000, h: 500 }, 1600, null);
		expect(box.cx).toBeCloseTo((spec.left / 100) * 1000);
		expect(box.cy).toBeCloseTo((spec.top / 100) * 500);
		expect(box.w).toBeCloseTo((spec.size / 100) * 1600);
	});

	it('scales a spec through WORLD inside a Canvas, not through a 100×100 box', () => {
		const box = stripBox(spec, { w: 1000, h: 500 }, 1600, { tx: 10, ty: 20, tk: 2 });
		expect(box.cx).toBeCloseTo((spec.left / 100) * WORLD.w * 2 + 10);
		expect(box.w).toBeCloseTo((spec.size / 100) * WORLD.w * 2);
	});
});

describe('viewBoxOf', () => {
	it('pads the extent on every side, so a stroke is not clipped by its own box', () => {
		const l = layout();
		const v = viewBoxOf(l);
		expect(v.x).toBe(l.extent.minX - 40);
		expect(v.w).toBe(l.extent.maxX - l.extent.minX + 80);
	});
});

describe('fadeAt', () => {
	const f = fadeParams({ ...seedStrips(1, 7)[0], fade: 0.25, fadeAngle: 90 }, 100, 50);

	it('is opaque through the middle and gone at both ends', () => {
		expect(fadeAt(f, 50, 25, 100, 50)).toBe(1);
		expect(fadeAt(f, 0, 25, 100, 50)).toBe(0);
		expect(fadeAt(f, 100, 25, 100, 50)).toBe(0);
	});

	it('eases rather than ramping linearly, which would read as a grey band', () => {
		const mid = fadeAt(f, 12.5, 25, 100, 50);
		expect(mid).toBeGreaterThan(0);
		expect(mid).toBeLessThan(0.5);
	});

	it('is a no-op when the strip asked for whole ends', () => {
		const none = fadeParams({ ...seedStrips(1, 7)[0], fade: 0 }, 100, 50);
		expect(fadeAt(none, 0, 0, 100, 50)).toBe(1);
	});
});

describe('parseCssColor', () => {
	it('reads every form tokens.css and the presets actually use', () => {
		expect(parseCssColor('rgba(255, 0, 0, 0.5)', [0, 0, 0, 1])).toEqual([1, 0, 0, 0.5]);
		expect(parseCssColor('#5eead4', [0, 0, 0, 1])[3]).toBe(1);
		expect(parseCssColor('hsl(0 100% 50%)', [0, 0, 0, 1])).toEqual([1, 0, 0, 1]);
		expect(parseCssColor('transparent', [1, 1, 1, 1])).toEqual([0, 0, 0, 0]);
	});

	it('expands short hex and reads the optional alpha byte', () => {
		expect(parseCssColor('#f00', [0, 0, 0, 1])).toEqual([1, 0, 0, 1]);
		expect(parseCssColor('#ff000080', [0, 0, 0, 1])[3]).toBeCloseTo(0.502, 2);
	});

	it('falls back rather than guessing, because a silent black is a blank strip', () => {
		const fb: [number, number, number, number] = [0.1, 0.2, 0.3, 0.4];
		expect(parseCssColor('color-mix(in srgb, red, blue)', fb)).toBe(fb);
		expect(parseCssColor('', fb)).toBe(fb);
		expect(parseCssColor(null, fb)).toBe(fb);
	});
});

describe('rotateHue', () => {
	it('leaves a colour alone at zero and preserves its alpha', () => {
		const c: [number, number, number, number] = [0.2, 0.6, 0.5, 0.8];
		expect(rotateHue(c, 0)).toBe(c);
		expect(rotateHue(c, 140)[3]).toBe(0.8);
	});

	it('turns the hue rather than the brightness', () => {
		const [r, g, b] = rotateHue([1, 0, 0, 1], 120);
		expect(g).toBeGreaterThan(r);
		expect(g).toBeGreaterThan(b);
	});

	it('comes back round after a full turn', () => {
		const out = rotateHue([0.3, 0.7, 0.2, 1], 360);
		expect(out[0]).toBeCloseTo(0.3, 4);
		expect(out[1]).toBeCloseTo(0.7, 4);
	});
});
