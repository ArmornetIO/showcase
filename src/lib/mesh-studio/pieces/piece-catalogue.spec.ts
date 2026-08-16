import { describe, it, expect } from 'vitest';
import { ALL_PIECES, MODE_PIECES, pieceForMode } from './piece-catalogue.js';
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

	it('merges the three catalogues without collision', () => {
		// A name clash would silently overwrite one set's building with another's —
		// the kind of loss that only shows up as "that mode looks wrong somehow".
		expect(Object.keys(ALL_PIECES).length).toBe(2 + 8 + 7);
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
		it(`${id} stands on the surface, inside its plot, and not too tall`, () => {
			const all = piece.flatMap((s) => s.verts);
			expect(Math.min(...all.map((v) => v.h)), 'floats or sinks').toBe(0);
			expect(Math.max(...all.map((v) => v.h))).toBeLessThanOrEqual(2);
			expect(Math.max(...all.map((v) => Math.abs(v.e)))).toBeLessThanOrEqual(1);
			expect(Math.max(...all.map((v) => Math.abs(v.n)))).toBeLessThanOrEqual(1);
		});
	}

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
