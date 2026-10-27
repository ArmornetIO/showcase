import { describe, expect, it } from 'vitest';
import { studioFrame } from '../mesh-studio/pieces/piece-facets.js';
import { box, type Solid } from '../mesh-studio/pieces/pieces.js';
import { carve, carveHull, cut, hexHole, modelFacets, movePart, pickPart, screenToModel, slab, type Part } from './model-geometry.js';
import { MODELS } from './models.js';

describe('cut', () => {
	it('drops exactly the cells inside a hole', () => {
		const holed = cut([0, 12, 0, 12, 0, 2], [[4, 8, 4, 8, -1, 3]]);
		expect(holed.length).toBeLessThan(cut([0, 12, 0, 12, 0, 2]).length);
		// No surviving cell may sit inside the hole.
		for (const s of holed) {
			const e = s.verts.reduce((a, v) => a + v.e, 0) / s.verts.length;
			const n = s.verts.reduce((a, v) => a + v.n, 0) / s.verts.length;
			expect(e > 4 && e < 8 && n > 4 && n < 8).toBe(false);
		}
	});
});

describe('carve', () => {
	const volume = (s: Solid) =>
		s.faces.reduce((v, f) => {
			const a = s.verts[f[0]];
			for (let j = 1; j + 1 < f.length; j++) {
				const [b, c] = [s.verts[f[j]], s.verts[f[j + 1]]];
				v += (a.e * (b.n * c.h - b.h * c.n) - a.n * (b.e * c.h - b.h * c.e) + a.h * (b.e * c.n - b.n * c.e)) / 6;
			}
			return v;
		}, 0);

	it('takes exactly the hole out, every piece still outward-wound', () => {
		const pieces = carve(box(0, 10, 0, 10, 0, 10), [3, 6, 2, 5, -1, 4]);
		for (const s of pieces) expect(volume(s)).toBeGreaterThan(0);
		expect(pieces.reduce((v, s) => v + volume(s), 0)).toBeCloseTo(1000 - 3 * 3 * 4, 6);
	});

	it('takes exactly a hexagon out through a slanted cut', () => {
		const pieces = carveHull(box(-5, 5, 0, 2, -5, 5), hexHole(0, 0, 1.6, -1, 3));
		for (const s of pieces) expect(volume(s)).toBeGreaterThan(0);
		expect(pieces.reduce((v, s) => v + volume(s), 0)).toBeCloseTo(200 - (Math.sqrt(3) / 2) * 1.6 ** 2 * 2, 6);
	});

	it('leaves a solid the hole misses alone', () => {
		const s = box(0, 1, 0, 1, 0, 1);
		expect(carve(s, [5, 6, 5, 6, 5, 6])).toEqual([s]);
	});
});

describe('modelFacets', () => {
	const inside: Part = { id: 'in', label: 'in', kind: 'board', size: '', solids: slab(-2, 2, -2, 2, 1, 2) };
	const lid: Part = {
		id: 'lid',
		label: 'lid',
		kind: 'cover',
		size: '',
		side: { axis: 'h', sign: 1, layer: 1 },
		solids: slab(-5, 5, -5, 5, 3, 4)
	};

	it('paints a shell the camera is outside of after the cavity', () => {
		const above = modelFacets([lid, inside], studioFrame(0, 0.8, 5));
		expect(above.at(-1)?.part.id).toBe('lid');
	});

	it('paints it before the cavity from the other side', () => {
		const below = modelFacets([lid, inside], studioFrame(0, -0.8, 5));
		expect(below[0].part.id).toBe('lid');
	});
});

describe('MODELS', () => {
	it('starts with the empty canvas and builds every model', () => {
		expect(MODELS[0].id).toBe('blank');
		for (const m of MODELS) expect(() => m.build({ exploded: true }, m.knobs ?? [])).not.toThrow();
	});

	it('stops each pole stage at full extension with its collar against the lip', () => {
		const m = MODELS.find((x) => x.id === 'telescopic-pole')!;
		const parts = m.build({ exploded: false }, m.knobs!.map((k) => ({ ...k, value: 100 }) as typeof k));
		const hs = (id: string) => parts.find((p) => p.id === id)!.solids.flatMap((s) => s.verts.map((v) => v.h));
		// Stage 1 is the base; each next stage's foot rides up to where the
		// previous stage's top less two band lengths sits.
		for (let s = 1; s < 4; s++) {
			const [outerTop, innerFoot] = [Math.max(...hs(`stage-${s}`)), Math.min(...hs(`stage-${s + 1}`))];
			expect(outerTop - innerFoot).toBeCloseTo(40, 6);
		}
	});

	it('keeps the rack-outside pinion on the rack from collapsed to full stroke', () => {
		const m = MODELS.find((x) => x.id === 'pole-rack')!;
		for (const value of [0, 100]) {
			const parts = m.build(
				{ exploded: false },
				m.knobs!.map((k) => ('prop' in k && k.prop === 'extend' ? ({ ...k, value } as typeof k) : k))
			);
			const hs = (id: string) => parts.find((p) => p.id === id)!.solids.flatMap((s) => s.verts.map((v) => v.h));
			// Where the pinion meets the rack is level with its centre.
			const [pinion, inner] = [hs('pinion'), hs('inner')];
			const mesh = (Math.min(...pinion) + Math.max(...pinion)) / 2;
			expect(mesh).toBeGreaterThan(Math.min(...inner) + 3);
			expect(mesh).toBeLessThan(Math.max(...inner) - 3);
		}
	});

	it('fits the ESP32 and relay tray in the Maintainer head, front sealed, at every height the picker offers', () => {
		const m = MODELS.find((x) => x.id === 'founder-maintainer')!;
		const height = m.knobs!.find((k) => 'prop' in k && k.prop === 'height')!;
		for (const value of 'options' in height ? height.options : []) {
			const parts = m.build({ exploded: false, xray: true }, m.knobs!.map((k) => (k === height ? { ...k, value } : k)));
			const span = (id: string, k: 'e' | 'n' | 'h') => {
				const vs = parts.find((p) => p.id === id)!.solids.flatMap((s) => s.verts.map((v) => v[k]));
				return [Math.min(...vs), Math.max(...vs)];
			};
			for (const id of ['maintainer-mini', 'maintainer-relay'])
				for (const k of ['e', 'n', 'h'] as const) {
					expect(span(id, k)[0]).toBeGreaterThan(span('maintainer-head', k)[0]);
					expect(span(id, k)[1]).toBeLessThan(span('maintainer-head', k)[1]);
				}
			// The relay's slot, a clearance in front of it, keeps a wall to the
			// head's face at its own height: the tray never breaks out the front.
			const [r0, r1] = span('maintainer-relay', 'h');
			const face = Math.min(
				...parts
					.find((p) => p.id === 'maintainer-head')!
					.solids.filter((s) => s.verts.some((v) => v.h <= r0) && s.verts.some((v) => v.h >= r1))
					.flatMap((s) => s.verts.map((v) => v.n))
			);
			expect(span('maintainer-relay', 'n')[0] - 0.6 - face).toBeGreaterThan(1.2);
		}
	});

	it('sleeves both heads with the fit all round and wall to spare, at every figure height', () => {
		const m = MODELS.find((x) => x.id === 'head-coupler')!;
		const height = m.knobs!.find((k) => 'prop' in k && k.prop === 'height')!;
		for (const value of 'options' in height ? height.options : []) {
			const parts = m.build({ exploded: false }, m.knobs!.map((k) => (k === height ? { ...k, value } : k)));
			const span = (id: string, k: 'e' | 'n') => {
				const vs = parts.find((p) => p.id === id)!.solids.flatMap((s) => s.verts.map((v) => v[k]));
				return Math.max(...vs) - Math.min(...vs);
			};
			// Across, where nothing stands proud of the head: 0.15 fit and a 1.2
			// wall a side. Front to back the visor does.
			expect(span('sleeve', 'e') - span('head-top', 'e')).toBeCloseTo(2 * (0.15 + 1.2), 1);
			expect(span('head-under', 'n')).toBeCloseTo(span('head-top', 'n'), 5);
		}
	});
});

describe('pickPart', () => {
	const part = (id: string, h0: number, h1: number): Part => ({ id, label: id, kind: 'part', size: '', solids: [box(-5, 5, -5, 5, h0, h1)] });

	it('picks the part nearest the viewer, and misses empty ground', () => {
		const frame = studioFrame(0, Math.PI / 2 - 0.001, 2);
		const parts = [part('low', 0, 4), part('high', 4, 8)];
		expect(pickPart(parts, frame, { x: 0, y: 0 })).toBe(1);
		expect(pickPart(parts, frame, { x: 40, y: 40 })).toBe(-1);
	});

	it('moves a part by a screen drag so it lands under the pointer', () => {
		const frame = studioFrame(-0.62, 0.7, 3);
		const moved = [movePart(part('p', 0, 4), screenToModel(frame, 3, 50, -20))];
		expect(pickPart(moved, frame, { x: 50, y: -20 })).toBe(0);
		expect(pickPart(moved, frame, { x: 0, y: 0 })).toBe(-1);
	});
});

describe('pickPart', () => {
	const part = (id: string, h0: number, h1: number): Part => ({ id, label: id, kind: 'part', size: '', solids: [box(-5, 5, -5, 5, h0, h1)] });

	it('picks the part nearest the viewer, and misses empty ground', () => {
		const frame = studioFrame(0, Math.PI / 2 - 0.001, 2);
		const parts = [part('low', 0, 4), part('high', 4, 8)];
		expect(pickPart(parts, frame, { x: 0, y: 0 })).toBe(1);
		expect(pickPart(parts, frame, { x: 40, y: 40 })).toBe(-1);
	});

	it('moves a part by a screen drag so it lands under the pointer', () => {
		const frame = studioFrame(-0.62, 0.7, 3);
		const moved = [movePart(part('p', 0, 4), screenToModel(frame, 3, 50, -20))];
		expect(pickPart(moved, frame, { x: 50, y: -20 })).toBe(0);
		expect(pickPart(moved, frame, { x: 0, y: 0 })).toBe(-1);
	});
});
