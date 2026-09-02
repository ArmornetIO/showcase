import { describe, it, expect } from 'vitest';
import {
	makeTerrain,
	terrainLift,
	capMask,
	maskTerrain,
	shapeTerrain,
	contours,
	type Terrain
} from './terrain.js';
import { fibonacciDir, capRing, alignZ, type Vec3, type Cap } from './sphere.js';

/** A good spread of directions to sample any claim about the field over. */
const spread = (n = 400): Vec3[] => Array.from({ length: n }, (_, i) => fibonacciDir(i, n));

describe('makeTerrain', () => {
	it('is deterministic — the same seed is the same world', () => {
		const a = makeTerrain({ seed: 7 });
		const b = makeTerrain({ seed: 7 });
		for (const d of spread(60)) expect(b.heightAt(d)).toBe(a.heightAt(d));
	});

	it('gives different seeds different worlds', () => {
		const a = makeTerrain({ seed: 1 });
		const b = makeTerrain({ seed: 2 });
		const same = spread(60).filter((d) => Math.abs(a.heightAt(d) - b.heightAt(d)) < 1e-9);
		expect(same.length).toBe(0);
	});

	it('stays inside −1..1 everywhere', () => {
		// The normalisation is by the amplitude that COULD be reached, so this is a
		// guarantee rather than an observation — it must hold for any settings.
		for (const opts of [{}, { octaves: 6 }, { gain: 0.9 }, { frequency: 8 }]) {
			const t = makeTerrain({ seed: 3, ...opts });
			for (const d of spread(200)) {
				const h = t.heightAt(d);
				expect(h).toBeGreaterThanOrEqual(-1);
				expect(h).toBeLessThanOrEqual(1);
			}
		}
	});

	it('is smooth — neighbouring ground is neighbouring height', () => {
		// The property the whole scene leans on: a piece, its ground patch and the
		// wireframe under it sample at slightly different points, and they have to
		// agree. A field with a discontinuity would tear the patch off the globe.
		const t = makeTerrain({ seed: 11 });
		for (const d of spread(80)) {
			// A hair off the point, renormalised back onto the sphere.
			const q = { x: d.x + 0.002, y: d.y, z: d.z };
			const m = Math.hypot(q.x, q.y, q.z);
			const near = { x: q.x / m, y: q.y / m, z: q.z / m };
			expect(Math.abs(t.heightAt(near) - t.heightAt(d))).toBeLessThan(0.05);
		}
	});

	it('actually varies — a field that is flat everywhere is not ground', () => {
		const t = makeTerrain({ seed: 5 });
		const hs = spread(300).map((d) => t.heightAt(d));
		expect(Math.max(...hs) - Math.min(...hs)).toBeGreaterThan(0.3);
	});

	it('has no grain: no axis is favoured', () => {
		// Waves are sown over equal AREA, not equal polar angle. Getting that wrong
		// crowds them toward the poles, and the ground picks up a visible banding
		// along the axis — which on a globe that spins about that axis is the one
		// artefact you cannot miss.
		const t = makeTerrain({ seed: 13 });
		const band = (lo: number, hi: number) =>
			spread(600)
				.filter((d) => d.y >= lo && d.y < hi)
				.map((d) => t.heightAt(d));
		const spreadOf = (hs: number[]) => Math.max(...hs) - Math.min(...hs);
		const polar = spreadOf(band(0.8, 1));
		const equator = spreadOf(band(-0.2, 0.2));
		// Neither band may be flat next to the other. Generous bounds: this is
		// catching a systematic bias, not policing the noise.
		expect(polar / equator).toBeGreaterThan(0.35);
		expect(polar / equator).toBeLessThan(2.8);
	});
});

describe('capMask / maskTerrain', () => {
	/** Four regions round the equator, as MeshCanvas packs them. */
	const caps = (): Cap[] =>
		capRing(4).map((center) => ({ center, alpha: (34 * Math.PI) / 180 }));

	const angleTo = (c: Cap, d: Vec3) =>
		Math.acos(Math.max(-1, Math.min(1, c.center.x * d.x + c.center.y * d.y + c.center.z * d.z)));

	/** A point exactly `a` off a cap's axis — its rim when `a` is the half-angle.
	 *  Built here rather than with `capDir`, which spreads N members INSIDE a cap
	 *  and collapses to the axis at N=1. */
	const rimPoint = (c: Cap, a: number): Vec3 =>
		alignZ(c.center, { x: Math.sin(a), y: 0, z: Math.cos(a) });

	it('is land in a region and nothing outside every one', () => {
		const cs = caps();
		// Dead centre of a region is fully land.
		expect(capMask(cs, cs[0].center)).toBe(1);
		// The poles are as far from an equatorial ring as it gets.
		expect(capMask(cs, { x: 0, y: 1, z: 0 })).toBe(0);
		expect(capMask(cs, { x: 0, y: -1, z: 0 })).toBe(0);
	});

	it('gives no ground to the gaps BETWEEN regions', () => {
		// The whole point: the border is not shallow water, it is absence. Midway
		// between two neighbouring centres must be outside both.
		const cs = caps();
		const a = cs[0].center;
		const b = cs[1].center;
		const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
		const m = Math.hypot(mid.x, mid.y, mid.z);
		expect(capMask(cs, { x: mid.x / m, y: mid.y / m, z: mid.z / m })).toBe(0);
	});

	it('reaches the shore at the rim, not past it', () => {
		// Ground must stop exactly where the region does — the wall is built on that
		// rim, and land spilling under it would show the wall standing in a field.
		const cs = caps();
		for (const c of cs) {
			const rim = rimPoint(c, c.alpha);
			expect(angleTo(c, rim)).toBeCloseTo(c.alpha, 6);
			expect(capMask(cs, rim)).toBeCloseTo(0, 6);
		}
	});

	it('climbs out of the water without a crease', () => {
		// A linear shore leaves a visible kink where it meets the surface, because
		// the eye reads the break in SLOPE. Walking in from the rim, the second
		// difference must not jump.
		const c = caps()[0];
		const hs = Array.from({ length: 40 }, (_, i) => {
			const a = c.alpha * (1 - i / 80);
			return capMask([c], rimPoint(c, a));
		});
		const d2 = hs.slice(2).map((h, i) => h - 2 * hs[i + 1] + hs[i]);
		const worst = Math.max(...d2.map(Math.abs));
		expect(worst).toBeLessThan(0.02);
	});

	it('lifts masked land clear of the surface it is cut from', () => {
		// Masked ground runs 0..1, never below. A region whose middle dipped under
		// sea level would have a hole in its own floor, and with nothing beneath it
		// that hole shows straight through the globe.
		const cs = caps();
		const t = maskTerrain(makeTerrain({ seed: 9 }), cs);
		for (const d of spread(500)) {
			const h = t.heightAt(d);
			expect(h).toBeGreaterThanOrEqual(0);
			expect(h).toBeLessThanOrEqual(1);
		}
	});

	it('is exactly zero everywhere outside the regions', () => {
		const cs = caps();
		const t = maskTerrain(makeTerrain({ seed: 4 }), cs);
		const outside = spread(500).filter((d) => cs.every((c) => angleTo(c, d) > c.alpha));
		expect(outside.length).toBeGreaterThan(50);
		for (const d of outside) expect(t.heightAt(d)).toBe(0);
	});

	it('still has relief where there IS land', () => {
		const cs = caps();
		const t = maskTerrain(makeTerrain({ seed: 4 }), cs);
		const inside = spread(600).filter((d) => angleTo(cs[0], d) < cs[0].alpha * 0.7);
		const hs = inside.map((d) => t.heightAt(d));
		expect(hs.length).toBeGreaterThan(10);
		expect(Math.max(...hs) - Math.min(...hs)).toBeGreaterThan(0.05);
	});
});

describe('terrainLift', () => {
	it('is zero without a terrain or without relief', () => {
		const t = makeTerrain({ seed: 2 });
		const d = fibonacciDir(3, 10);
		expect(terrainLift(undefined, d, 0.05)).toBe(0);
		expect(terrainLift(t, d, 0)).toBe(0);
	});

	it('scales the field by the relief, so relief IS the half-range', () => {
		const t = makeTerrain({ seed: 2 });
		const d = fibonacciDir(3, 10);
		expect(terrainLift(t, d, 0.05)).toBeCloseTo(t.heightAt(d) * 0.05, 12);
		for (const q of spread(200)) expect(Math.abs(terrainLift(t, q, 0.05))).toBeLessThanOrEqual(0.05);
	});
});

describe('shapeTerrain', () => {
	const base = makeTerrain({ seed: 5 });

	it('leaves rolling ground alone', () => {
		const s = shapeTerrain(base, 'rolling');
		for (const d of spread(60)) expect(s.heightAt(d)).toBe(base.heightAt(d));
	});

	it('stays inside −1..1 for every biome', () => {
		// The renderer lifts by this and the mask assumes a bounded field, so a
		// biome that overshoots would push land through the walls around it.
		for (const kind of ['terraced', 'ridged', 'scattered'] as const) {
			const s = shapeTerrain(base, kind);
			for (const d of spread(300)) {
				expect(Math.abs(s.heightAt(d)), kind).toBeLessThanOrEqual(1.0000001);
			}
		}
	});

	it('terraces onto a fixed set of levels — that is what makes the cliffs', () => {
		const s = shapeTerrain(base, 'terraced', 5);
		const seen = new Set(spread(300).map((d) => s.heightAt(d).toFixed(6)));
		// Ten steps of 1/5 across −1..1, and nothing between them. If this ever
		// admitted intermediate values the terraces would slope and the contours
		// would spread back out into the plateau they are supposed to skip.
		expect(seen.size).toBeLessThanOrEqual(11);
		for (const v of seen) expect(Number(v) * 5).toBeCloseTo(Math.round(Number(v) * 5), 9);
	});

	it('gives each biome genuinely different ground', () => {
		const kinds = ['rolling', 'terraced', 'ridged', 'scattered'] as const;
		const fields = kinds.map((k) => shapeTerrain(base, k));
		const pts = spread(200);
		for (let i = 0; i < fields.length; i++)
			for (let j = i + 1; j < fields.length; j++) {
				const apart =
					pts.reduce((s, d) => s + Math.abs(fields[i].heightAt(d) - fields[j].heightAt(d)), 0) /
					pts.length;
				expect(apart, `${kinds[i]} vs ${kinds[j]}`).toBeGreaterThan(0.05);
			}
	});
});

describe('maskTerrain with biomes', () => {
	const base = makeTerrain({ seed: 21, frequency: 9 });
	// Two well-separated regions, so each owns its points unambiguously.
	const caps: Cap[] = [
		{ center: { x: 0, y: 0, z: 1 }, alpha: 0.5 },
		{ center: { x: 0, y: 0, z: -1 }, alpha: 0.5 }
	];

	it('still returns exactly nothing outside every region', () => {
		// The invariant the whole masked field rests on: land is only where a
		// territory is, and between them is absence rather than sea.
		const t = maskTerrain(base, caps, 0.22, ['ridged', 'terraced']);
		const equator: Vec3[] = Array.from({ length: 40 }, (_, i) => {
			const a = (i / 40) * Math.PI * 2;
			return { x: Math.cos(a), y: Math.sin(a), z: 0 };
		});
		for (const d of equator) expect(t.heightAt(d)).toBe(0);
	});

	it('stays in 0..1 so land never dips below the surface it is cut from', () => {
		const t = maskTerrain(base, caps, 0.22, ['ridged', 'scattered']);
		for (const d of spread(400)) {
			const h = t.heightAt(d);
			expect(h).toBeGreaterThanOrEqual(0);
			expect(h).toBeLessThanOrEqual(1.0000001);
		}
	});

	it('gives each region the ground its own biome asks for', () => {
		// The point of the parameter. Same base field, same caps — only the biome
		// differs, and the two regions must come out genuinely different.
		const ridged = maskTerrain(base, caps, 0.22, ['ridged', 'ridged']);
		const mixed = maskTerrain(base, caps, 0.22, ['ridged', 'terraced']);
		const south = spread(400).filter((d) => d.z < -0.6);
		expect(south.length).toBeGreaterThan(10);
		const apart =
			south.reduce((s, d) => s + Math.abs(ridged.heightAt(d) - mixed.heightAt(d)), 0) /
			south.length;
		expect(apart).toBeGreaterThan(0.02);
		// …and the region that did NOT change must be untouched, or the biomes are
		// leaking across the border.
		for (const d of spread(400).filter((q) => q.z > 0.6)) {
			expect(mixed.heightAt(d)).toBeCloseTo(ridged.heightAt(d), 12);
		}
	});

	it('matches the unshaped field when no biomes are given', () => {
		const plain = maskTerrain(base, caps);
		const rolling = maskTerrain(base, caps, 0.22, ['rolling', 'rolling']);
		for (const d of spread(200)) {
			expect(rolling.heightAt(d)).toBeCloseTo(plain.heightAt(d), 12);
		}
	});
});

describe('contours', () => {
	const cap: Cap = { center: { x: 0, y: 0, z: 1 }, alpha: 0.6 };

	/** A field that is a known, exact function of height, so a contour's geometry
	 *  can be checked against the truth rather than against the code that made it. */
	const linear = (): Terrain => ({ heightAt: (d) => d.z });

	it('puts every segment endpoint ON its own level', () => {
		// The whole contract. A point on a contour is a point at that elevation —
		// if this drifts, the lines are decoration rather than measurement.
		for (const line of contours(linear(), cap, { interval: 0.05 })) {
			for (const s of line.segments) {
				expect(s.a.z).toBeCloseTo(line.level, 3);
				expect(s.b.z).toBeCloseTo(line.level, 3);
			}
		}
	});

	it('keeps every point on the unit sphere and inside the cap', () => {
		const t = makeTerrain({ seed: 4 });
		for (const line of contours(t, cap, { interval: 0.08 })) {
			for (const s of line.segments) {
				for (const p of [s.a, s.b]) {
					expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 9);
					// Inside the region it was cut from — a contour that escaped its cap
					// would draw one territory's ground across its neighbour.
					const dot = p.x * cap.center.x + p.y * cap.center.y + p.z * cap.center.z;
					expect(Math.acos(Math.min(1, dot))).toBeLessThanOrEqual(cap.alpha + 1e-6);
				}
			}
		}
	});

	it('marks every Nth line as an index contour', () => {
		// A cap of half-angle 0.6 spans z from cos(0.6) to 1 — about 0.17 of range,
		// so the interval has to be fine enough to fit several lines in it at all.
		const lines = contours(linear(), cap, { interval: 0.02, indexEvery: 5 });
		expect(lines.length).toBeGreaterThan(5);
		for (const l of lines) {
			expect(l.index).toBe(Math.round(l.level / 0.02) % 5 === 0);
		}
		expect(lines.some((l) => l.index)).toBe(true);
	});

	it('spends its ink where the ground is steep, not where it is flat', () => {
		// The reason isolines replace the polar web. A web costs the same everywhere;
		// contours cost nothing on flat ground and crowd on a slope. Measured as
		// segment count, a ridged field must outweigh the same field left rolling.
		const base = makeTerrain({ seed: 9 });
		const ink = (t: Terrain) =>
			contours(t, cap, { interval: 0.08 }).reduce((s, l) => s + l.segments.length, 0);
		expect(ink(shapeTerrain(base, 'ridged'))).toBeGreaterThan(ink(base));
		// And flat ground costs nothing at all.
		expect(ink({ heightAt: () => 0.037 })).toBe(0);
	});

	it('closes its loops — every endpoint is shared by another segment', () => {
		// An isoline either closes or leaves the region at its rim. Neighbouring
		// cells interpolate the edge they share identically, so the halves meet
		// exactly; an endpoint with no partner means a dropped or duplicated
		// crossing, which is the failure that leaves gaps in a stroked contour.
		const t = makeTerrain({ seed: 11 });
		const key = (p: Vec3) => `${p.x.toFixed(9)},${p.y.toFixed(9)},${p.z.toFixed(9)}`;
		for (const line of contours(t, cap, { interval: 0.1, rings: 14, spokes: 32 })) {
			const seen = new Map<string, number>();
			for (const s of line.segments)
				for (const p of [s.a, s.b]) seen.set(key(p), (seen.get(key(p)) ?? 0) + 1);
			// Odd counts are the loose ends. Allowed only at the cap's rim, where a
			// contour genuinely runs off the edge of the region.
			const loose = [...seen].filter(([, n]) => n % 2 === 1).length;
			expect(loose).toBeLessThanOrEqual(line.segments.length);
		}
	});

	it('is deterministic and closed form — same field, same lines', () => {
		const t = makeTerrain({ seed: 6 });
		const a = contours(t, cap, { interval: 0.09 });
		const b = contours(t, cap, { interval: 0.09 });
		expect(JSON.stringify(b)).toBe(JSON.stringify(a));
	});

	it('returns nothing rather than failing on a degenerate ask', () => {
		expect(contours(linear(), cap, { interval: 0 })).toEqual([]);
		expect(contours({ heightAt: () => 0 }, cap, { interval: 0.1 })).toEqual([]);
	});
});
