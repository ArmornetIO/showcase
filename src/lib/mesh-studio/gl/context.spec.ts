// Node tests — no WebGL here. Only the byte-layout maths, which is the part of
// a VAO that fails silently: a wrong offset draws SOMETHING, just not the right
// thing, so it has to be pinned down where it can be checked exactly.
import { describe, it, expect } from 'vitest';
import { attribLayout, type AttribSpec } from './context.js';

const FLOAT = 4;

describe('attribLayout', () => {
	it('packs a single attribute at offset 0', () => {
		expect(attribLayout([{ name: 'aPos', size: 2 }])).toEqual({
			stride: 8,
			offsets: [0],
		});
	});

	it('packs interleaved attributes tight, in declaration order', () => {
		// vec2 position, vec3 colour, float alpha → 6 floats per vertex.
		const specs: AttribSpec[] = [
			{ name: 'aPos', size: 2 },
			{ name: 'aColor', size: 3 },
			{ name: 'aAlpha', size: 1 },
		];
		expect(attribLayout(specs)).toEqual({ stride: 24, offsets: [0, 8, 20] });
	});

	it('ignores divisor — instancing changes advance rate, not layout', () => {
		const a: AttribSpec[] = [
			{ name: 'aCenter', size: 2 },
			{ name: 'aRadius', size: 1 },
		];
		const b: AttribSpec[] = [
			{ name: 'aCenter', size: 2, divisor: 1 },
			{ name: 'aRadius', size: 1, divisor: 1 },
		];
		expect(attribLayout(b)).toEqual(attribLayout(a));
	});

	it('has no stride for no attributes', () => {
		expect(attribLayout([])).toEqual({ stride: 0, offsets: [] });
	});
});

describe('attribLayout invariants', () => {
	// Every combination of sizes up to four attributes. Small enough to enumerate
	// exhaustively, which beats a sampled property test: there is no case left
	// unvisited to hide a bug in.
	const sizes: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
	const cases: AttribSpec[][] = [];
	const grow = (prefix: AttribSpec[]) => {
		if (prefix.length) cases.push(prefix);
		if (prefix.length === 4) return;
		for (const s of sizes) grow([...prefix, { name: `a${prefix.length}`, size: s }]);
	};
	grow([]);

	it('covers every layout up to four attributes', () => {
		expect(cases.length).toBe(4 + 16 + 64 + 256);
	});

	it('offsets are float-aligned and strictly increasing', () => {
		for (const specs of cases) {
			const { offsets } = attribLayout(specs);
			expect(offsets.length).toBe(specs.length);
			for (let i = 0; i < offsets.length; i++) {
				expect(offsets[i] % FLOAT).toBe(0);
				if (i > 0) expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
			}
		}
	});

	it('stride equals the total float width, and the last attribute ends on it', () => {
		for (const specs of cases) {
			const { stride, offsets } = attribLayout(specs);
			const total = specs.reduce((n, a) => n + a.size, 0);
			expect(stride).toBe(total * FLOAT);
			const last = specs.length - 1;
			expect(offsets[last] + specs[last].size * FLOAT).toBe(stride);
		}
	});

	it('each attribute starts exactly where the previous one ended — no gaps, no overlap', () => {
		for (const specs of cases) {
			const { offsets } = attribLayout(specs);
			for (let i = 1; i < specs.length; i++) {
				expect(offsets[i]).toBe(offsets[i - 1] + specs[i - 1].size * FLOAT);
			}
		}
	});

	it('a prefix of a layout lays out identically — appending never shifts what is already there', () => {
		for (const specs of cases) {
			if (specs.length < 2) continue;
			const head = attribLayout(specs.slice(0, -1));
			const full = attribLayout(specs);
			expect(full.offsets.slice(0, -1)).toEqual(head.offsets);
		}
	});

	it('indexing a record by stride lands on the right float', () => {
		// The arithmetic a caller would otherwise write by hand: vertex n's
		// attribute i sits at n·stride + offset[i], and dividing that back by four
		// must give its index in the flat Float32Array.
		const specs: AttribSpec[] = [
			{ name: 'aPos', size: 3 },
			{ name: 'aUv', size: 2 },
		];
		const { stride, offsets } = attribLayout(specs);
		const floatIndex = (vertex: number, attrib: number) =>
			(vertex * stride + offsets[attrib]) / FLOAT;
		expect(floatIndex(0, 0)).toBe(0);
		expect(floatIndex(0, 1)).toBe(3);
		expect(floatIndex(1, 0)).toBe(5);
		expect(floatIndex(1, 1)).toBe(8);
		expect(floatIndex(2, 0)).toBe(10);
	});
});
