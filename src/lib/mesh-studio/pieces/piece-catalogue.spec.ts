import { describe, it, expect } from 'vitest';
import { ALL_PIECES, MODE_PIECES, pieceForMode } from './piece-catalogue.js';
import { PIECES } from './pieces.js';
import { WORKS_PIECES } from './pieces-works.js';
import { CIVIC_PIECES } from './pieces-civic.js';
import { GLYPH_PIECES, SUSPENDED_PIECES } from './pieces-glyphs.js';
import { MODE_KEYS } from '../modes.gen.js';

describe('the settlement', () => {
	it('gives every agent mode a building', () => {
		// The load-bearing test of the whole catalogue. Identity moved off colour
		// and onto silhouette, so a mode with no building has no identity left —
		// it falls back to a disc, which says nothing once the palette collapses.
		// A new mode arriving in modes.gen.ts must fail HERE rather than shipping
		// as an anonymous marker nobody notices.
		const missing = MODE_KEYS.filter((k) => !MODE_PIECES[k]);
		expect(missing, `modes with no building: ${missing.join(', ')}`).toEqual([]);
	});

	it('names only buildings that exist', () => {
		for (const [mode, id] of Object.entries(MODE_PIECES)) {
			expect(ALL_PIECES[id], `${mode} → ${id}`).toBeDefined();
		}
	});

	it('stands no two modes in the same building', () => {
		// Two modes sharing a silhouette are indistinguishable on the globe, which
		// is precisely the failure the shapes exist to prevent.
		const used = Object.values(MODE_PIECES);
		expect(new Set(used).size).toBe(used.length);
	});

	it('merges every catalogue without collision', () => {
		// A name clash would silently overwrite one set's building with another's —
		// the kind of loss that only shows up as "that mode looks wrong somehow".
		//
		// Asserted as IDENTITY rather than as a count. Counting caught the same
		// property but reported it as `expected 19 to be 18`, which names neither
		// the clashing id nor the set that lost — and a failure you have to go
		// hunting through four files for is one you are tempted to retune past.
		// This one fails on the colliding key, by name.
		for (const src of [PIECES, WORKS_PIECES, CIVIC_PIECES, GLYPH_PIECES]) {
			for (const [id, piece] of Object.entries(src)) {
				expect(ALL_PIECES[id], `${id} was overwritten by another catalogue`).toBe(piece);
			}
		}
	});

	it('resolves a mode straight to its geometry', () => {
		for (const key of MODE_KEYS) {
			const piece = pieceForMode(key);
			expect(piece, key).toBeDefined();
			expect(piece!.length, key).toBeGreaterThan(0);
		}
		expect(pieceForMode('no_such_mode')).toBeUndefined();
	});
});

describe('every building in the settlement', () => {
	// The contract from pieces.spec.ts, re-asserted across the MERGED catalogue.
	// Each authoring file tests its own set; nothing else checks that what the
	// renderer actually reaches for still holds the line.
	for (const [id, piece] of Object.entries(ALL_PIECES)) {
		const suspended = SUSPENDED_PIECES.has(id);
		const how = suspended ? 'hangs clear of the surface' : 'stands on the surface';
		it(`${id} ${how}, inside its plot, and not too tall`, () => {
			const all = piece.flatMap((s) => s.verts);
			const base = Math.min(...all.map((v) => v.h));
			if (suspended) {
				// Asserted, not waived. A projection that has drifted down onto the
				// ground and a building that has drifted up off it are different bugs
				// with the same symptom, and exempting the first from the check would
				// hide the second whenever a piece was mislabelled. Clear by a real
				// margin rather than by epsilon: the gap IS the effect.
				expect(base, 'suspended, but resting on the ground').toBeGreaterThan(0.2);
			} else {
				expect(base, 'floats or sinks').toBe(0);
			}
			expect(Math.max(...all.map((v) => v.h))).toBeLessThanOrEqual(2);
			expect(Math.max(...all.map((v) => Math.abs(v.e)))).toBeLessThanOrEqual(1);
			expect(Math.max(...all.map((v) => Math.abs(v.n)))).toBeLessThanOrEqual(1);
		});
	}

	it('names every piece that leaves the ground', () => {
		// The other half of the fork: a piece may float only if it SAYS it floats.
		// Without this, `SUSPENDED_PIECES` could quietly become the place a broken
		// building goes to stop failing.
		const airborne = Object.entries(ALL_PIECES)
			.filter(([, p]) => Math.min(...p.flatMap((s) => s.verts).map((v) => v.h)) > 0)
			.map(([id]) => id);
		expect(airborne.sort(), 'floating but not declared suspended').toEqual(
			[...SUSPENDED_PIECES].sort()
		);
	});

	it('keeps every face wound outward', () => {
		for (const [id, piece] of Object.entries(ALL_PIECES)) {
			piece.forEach((solid, i) => {
				const c = solid.verts.reduce(
					(acc, v, _, arr) => ({
						e: acc.e + v.e / arr.length,
						n: acc.n + v.n / arr.length,
						h: acc.h + v.h / arr.length
					}),
					{ e: 0, n: 0, h: 0 }
				);
				for (const face of solid.faces) {
					const [a, b, cc] = face.map((k) => solid.verts[k]);
					const u = { e: b.e - a.e, n: b.n - a.n, h: b.h - a.h };
					const w = { e: cc.e - a.e, n: cc.n - a.n, h: cc.h - a.h };
					const nrm = {
						e: u.n * w.h - u.h * w.n,
						n: u.h * w.e - u.e * w.h,
						h: u.e * w.n - u.n * w.e
					};
					const fc = face.reduce(
						(acc, k, _, arr) => ({
							e: acc.e + solid.verts[k].e / arr.length,
							n: acc.n + solid.verts[k].n / arr.length,
							h: acc.h + solid.verts[k].h / arr.length
						}),
						{ e: 0, n: 0, h: 0 }
					);
					const away = (fc.e - c.e) * nrm.e + (fc.n - c.n) * nrm.n + (fc.h - c.h) * nrm.h;
					expect(away, `${id}[${i}] face [${face.join(',')}] is inside-out`).toBeGreaterThan(0);
				}
			});
		}
	});
});
