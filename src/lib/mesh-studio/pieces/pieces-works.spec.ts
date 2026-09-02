import { describe, it, expect } from 'vitest';
import { WORKS_PIECES, WORKS_MODE_PIECES } from './pieces-works.js';
import type { Solid } from './pieces.js';

/** Cross product of the first two edges of a face — the outward normal, IF the
 *  face is wound counter-clockwise seen from outside. Re-derived here rather
 *  than imported: a test that reuses the renderer's own maths only proves the
 *  two agree with each other. */
function normal(s: Solid, face: number[]) {
	const [a, b, c] = face.map((i) => s.verts[i]);
	const u = { e: b.e - a.e, n: b.n - a.n, h: b.h - a.h };
	const w = { e: c.e - a.e, n: c.n - a.n, h: c.h - a.h };
	return {
		e: u.n * w.h - u.h * w.n,
		n: u.h * w.e - u.e * w.h,
		h: u.e * w.n - u.n * w.e
	};
}

function centroid(verts: { e: number; n: number; h: number }[]) {
	return verts.reduce(
		(acc, v, _, arr) => ({
			e: acc.e + v.e / arr.length,
			n: acc.n + v.n / arr.length,
			h: acc.h + v.h / arr.length
		}),
		{ e: 0, n: 0, h: 0 }
	);
}

/** Every face points AWAY from the solid it belongs to.
 *
 *  This is the whole contract the pieces offer the renderer: back-face culling
 *  and shading are both `normal · viewer`, so one face wound backwards is not a
 *  subtle error — it is a hole in the solid, through which you see its inside.
 *  And on a static globe you would never notice; it only shows up on the spin
 *  that turns that face toward you. */
function assertOutward(solid: Solid, what: string) {
	const c = centroid(solid.verts);
	for (const face of solid.faces) {
		const nrm = normal(solid, face);
		const fc = centroid(face.map((i) => solid.verts[i]));
		const away = (fc.e - c.e) * nrm.e + (fc.n - c.n) * nrm.n + (fc.h - c.h) * nrm.h;
		expect(away, `${what} face [${face.join(',')}] is wound inside-out`).toBeGreaterThan(0);
	}
}

describe('the works pieces', () => {
	for (const [id, piece] of Object.entries(WORKS_PIECES)) {
		it(`${id} is built from outward-wound convex parts`, () => {
			expect(piece.length).toBeGreaterThan(0);
			piece.forEach((solid, i) => assertOutward(solid, `${id}[${i}]`));
		});

		it(`${id} stands ON the surface and inside its own plot`, () => {
			const all = piece.flatMap((s) => s.verts);
			// Nothing below the ground: a piece sits on the sphere, not in it.
			expect(Math.min(...all.map((v) => v.h))).toBe(0);
			// Nothing taller than it is wide by much, and nothing overhanging far
			// past the node's own radius — a piece that spills sideways collides
			// with its neighbours the moment the globe packs tighter.
			expect(Math.max(...all.map((v) => v.h))).toBeLessThanOrEqual(2);
			expect(Math.max(...all.map((v) => Math.abs(v.e)))).toBeLessThanOrEqual(1);
			expect(Math.max(...all.map((v) => Math.abs(v.n)))).toBeLessThanOrEqual(1);
		});

		it(`${id} is tall enough to read as a solid`, () => {
			// Below about 1.4 the band of side the slant gives you is too thin to
			// tell one silhouette from another — see the height note in pieces.ts.
			const top = Math.max(...piece.flatMap((s) => s.verts.map((v) => v.h)));
			expect(top).toBeGreaterThanOrEqual(1.4);
		});
	}
});

describe('the mode map', () => {
	const MODES = [
		'dns_proxy',
		'github_runner',
		'hardened_agent',
		'posture',
		'codebase_analysis',
		'vscode_enforcement'
	];

	for (const mode of MODES) {
		it(`${mode} maps to a shape that exists`, () => {
			const shape = WORKS_MODE_PIECES[mode];
			expect(shape, `${mode} has no building`).toBeTruthy();
			expect(WORKS_PIECES[shape], `${shape} is not a known building`).toBeDefined();
		});
	}

	it('gives every mode its own building — a shared silhouette is a lost mode', () => {
		const shapes = MODES.map((m) => WORKS_MODE_PIECES[m]);
		expect(new Set(shapes).size).toBe(MODES.length);
	});
});
