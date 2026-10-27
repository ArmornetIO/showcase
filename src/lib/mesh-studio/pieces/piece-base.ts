// ── pieces/piece-base — what a piece stands on ───────────────────────────────
// Every piece has a base, and there are two kinds. A BUILDING is `attached`:
// founded on the terrain and buried to its footings in the ground patch, which
// is what it has always been. A projection is `hover`: it hangs over a dais —
// a pool of light lying flat on the ground, lit at the rim, with a dark hole
// under the piece and air between the two. That is the BREACH lobby's floor
// (`Figure`'s `ground`), laid into the globe's own ground plane.
//
// The base is drawn in the node's tangent frame, so it foreshortens with the
// ground. The ring it replaces was a screen-facing circle, which stands up
// behind a piece like a halo instead of lying under it.

import { SUSPENDED_PIECES } from './pieces-glyphs.js';
import { DAIS_R } from '../gl/piece-shaders.js';

export type PieceBase = 'attached' | 'hover';

/** Which base a piece stands on. Hanging is already declared per piece, in
 *  `SUSPENDED_PIECES`, so the base follows it rather than being a second list
 *  that could disagree. */
export const baseOf = (pieceId: string): PieceBase =>
	SUSPENDED_PIECES.has(pieceId) ? 'hover' : 'attached';

const DAIS_STEPS = 40;

/** The dais as a flat disc at h = 0, in the same 7-float interleave as
 *  `PieceMesh.verts` (local, normal, normalised height), so it binds against the
 *  piece program's attribute layout unchanged. Wound counter-clockwise seen
 *  from above — the catalogue's own guarantee, which the host's culling assumes.
 *  The shading is radial and lives in the shader; the mesh is only coverage. */
export const DAIS_MESH: Float32Array = (() => {
	const out: number[] = [];
	const at = (i: number) => {
		const a = (2 * Math.PI * i) / DAIS_STEPS;
		return [DAIS_R * Math.cos(a), DAIS_R * Math.sin(a)];
	};
	for (let i = 0; i < DAIS_STEPS; i++) {
		const [e0, n0] = at(i);
		const [e1, n1] = at(i + 1);
		for (const [e, n] of [
			[0, 0],
			[e0, n0],
			[e1, n1],
		])
			// Normalised height 1, not 0: the shader ramps land → ink up that axis,
			// and the dais is lit in the piece's ink, not the ground's.
			out.push(e, n, 0, 0, 0, 1, 1);
	}
	return new Float32Array(out);
})();
