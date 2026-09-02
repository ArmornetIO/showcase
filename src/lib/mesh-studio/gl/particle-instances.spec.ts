import { describe, it, expect } from 'vitest';
import { packParticles, cssRgb, type ParticleRun } from './particle-instances.js';
import { PARTICLE_FLOATS, KIND_CUBIC, KIND_ELBOW } from './particle-shaders.js';
import { bowControl } from '../../primitives/canvas/edge-path.js';

const CYAN: [number, number, number] = [0.13, 0.83, 0.93];

function run(over: Partial<ParticleRun> = {}): ParticleRun {
	return {
		a: { x: 0, y: 0 },
		b: { x: 100, y: 0 },
		curve: 'line',
		color: '#22D3EE',
		dur: 2,
		count: 3,
		size: 2,
		...over,
	};
}

/** Evaluate the cubic the pack wrote, the way the vertex shader does. */
function cubicAt(d: Float32Array, base: number, t: number): [number, number] {
	const u = 1 - t;
	const p = (i: number) => [d[base + i], d[base + i + 1]] as const;
	const [x0, y0] = p(0);
	const [x1, y1] = p(2);
	const [x2, y2] = p(4);
	const [x3, y3] = p(6);
	const w0 = u * u * u,
		w1 = 3 * u * u * t,
		w2 = 3 * u * t * t,
		w3 = t * t * t;
	return [w0 * x0 + w1 * x1 + w2 * x2 + w3 * x3, w0 * y0 + w1 * y1 + w2 * y2 + w3 * y3];
}

describe('cssRgb', () => {
	it('parses the forms meshPalette.ink can return', () => {
		expect(cssRgb('#fff', CYAN)).toEqual([1, 1, 1]);
		expect(cssRgb('#22D3EE', CYAN)[0]).toBeCloseTo(0x22 / 255, 5);
		expect(cssRgb('rgba(34,211,238,0.65)', CYAN)[1]).toBeCloseTo(211 / 255, 5);
	});

	// The reason the fallback exists: `ink` passes an unrecognised colour straight
	// through, and a `var()` name has no value outside a live element.
	it('falls back rather than guessing on a var() passthrough', () => {
		expect(cssRgb('var(--palette-cyan)', CYAN)).toEqual(CYAN);
	});
});

describe('packParticles', () => {
	it('emits one vertex per particle', () => {
		const p = packParticles([run({ count: 3 }), run({ count: 2 })], CYAN);
		expect(p.count).toBe(5);
	});

	it('staggers phase so a stream is not a clump', () => {
		const p = packParticles([run({ count: 4 })], CYAN);
		const phases = [0, 1, 2, 3].map((i) => p.data[i * PARTICLE_FLOATS + 11]);
		expect(phases).toEqual([0, 0.25, 0.5, 0.75]);
	});

	// Degree elevation is exact, and this is the assertion that says so: the cubic
	// the shader evaluates must land on the same points as the quadratic the SVG
	// edge is drawn from, or the energy runs beside its own line.
	it('raises a bow to a cubic that tracks the drawn quadratic', () => {
		const a = { x: 10, y: 20 };
		const b = { x: 210, y: 90 };
		const p = packParticles([run({ a, b, curve: 'bow', count: 1 })], CYAN);
		const { cx, cy } = bowControl(a, b);

		for (const t of [0, 0.25, 0.5, 0.75, 1]) {
			const u = 1 - t;
			const qx = u * u * a.x + 2 * u * t * cx + t * t * b.x;
			const qy = u * u * a.y + 2 * u * t * cy + t * t * b.y;
			const [gx, gy] = cubicAt(p.data, 0, t);
			// 4dp, not more: the control points round-trip through a Float32Array on
			// the way to the GPU, so ~1e-6 of drift at these coordinates is the
			// storage format and not the elevation.
			expect(gx).toBeCloseTo(qx, 4);
			expect(gy).toBeCloseTo(qy, 4);
		}
	});

	it('flags an elbow for the shader branch instead of approximating it', () => {
		const p = packParticles([run({ curve: 'elbow', count: 1 })], CYAN);
		expect(p.data[14]).toBe(KIND_ELBOW);
		expect(packParticles([run({ curve: 'line', count: 1 })], CYAN).data[14]).toBe(KIND_CUBIC);
	});

	// A node dragged onto another briefly makes a zero-length edge; an unguarded
	// 1/dur there is an infinite rate and a full-screen flicker.
	it('clamps the rate of a degenerate run', () => {
		const p = packParticles([run({ dur: 0, count: 1 })], CYAN);
		expect(Number.isFinite(p.data[12])).toBe(true);
		expect(p.data[12]).toBeLessThanOrEqual(20);
	});

	it('reuses a buffer that is already big enough', () => {
		const first = packParticles([run({ count: 8 })], CYAN);
		const second = packParticles([run({ count: 2 })], CYAN, first.data);
		expect(second.data).toBe(first.data);
		expect(second.count).toBe(2);
	});

	it('reports no particles when every run is empty', () => {
		expect(packParticles([run({ count: 0 })], CYAN).count).toBe(0);
	});
});
