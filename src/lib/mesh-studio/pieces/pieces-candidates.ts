// ── Candidates for `posture` — what survived ─────────────────────────────────
// A holding pen, not a quarter. What is wired in here appears in PIECE STUDIO
// as an unclaimed building so it can be turned on the turntable; nothing here
// is mapped to a mode until it wins.
//
// Six concepts were built and rendered in parallel. Five were ditched, and the
// reason they were ditched is one rule rather than five accidents, so it is
// recorded in `.claude/skills/create-piece/SKILL.md` under the projection
// gotcha rather than here: THE CAMERA IS PLAN-DOMINANT. Measured off the
// renders, e ≈ 250 and n ≈ 230 px/unit — and n projects to screen-VERTICAL —
// against h ≈ 111. Both horizontal axes run at nearly full scale while height
// runs at 0.45.
//
// Every one of the six put its reading on the vertical axis, and that is what
// killed them:
//
//  · `plumb`, `balance` — meaning carried by an ANGLE or a directed offset. An
//    orientation has a null bearing, and at it the piece asserts the OPPOSITE
//    value with full confidence: the tilted balance projects to a true vertical,
//    the hanging bob to dead centre.
//  · `caliper`, `post`, `vessel` — meaning carried by a vertical DISTANCE
//    bracketed or marked by solids with real plan extent. Plan footprint and
//    height compete for the same screen axis and plan wins about 2:1, so the
//    mark always eats the quantity it is supposed to measure.
//
// Both escapes are therefore closed at once: a vertical reading is compressed
// and gets swallowed, and a horizontal one is not bearing-invariant. `standard`
// survives because its reading is neither — it is a CORRESPONDENCE (a pointer
// level with one specific tooth) carried by graduations thin enough in n to
// have almost no plan extent to spend.
// A SECOND ROUND was tried and every one of it was ditched, which is worth a
// line here because the reasons generalise past the shapes:
//
//  · `ward`, a quartered shield — the best of the three on the turntable, and
//    ditched on a fact about the SET rather than about the shape. The shield is
//    already spent: `supply_chain_proxy` stands as `Guarded pkg`, which is a
//    shield too, and two modes sharing a silhouette is the exact failure this
//    catalogue exists to prevent. Light market research says the same thing from
//    outside — shield/shield-check is the category cliché and carries no
//    identity, while a gauge is comparatively rare.
//  · `rampart`, a keep with three merlons of four — its count ran partly along
//    NORTH, and north projects to screen-VERTICAL, the same axis the merlons'
//    own height lands on. Tall enough to read, the far pair covers the near
//    pair; short enough to separate, they are studs on a box. There is no
//    setting in between: the constraint is arithmetic, not tuning.
//  · `helm`, the one VOLUME — built to beat the plate's edge-on weakness by not
//    being a plate, and it falsified its own premise. A plan-dominant camera
//    looks DOWN, so a solid of revolution presents its PLAN, and the plan of a
//    helm is a disc — the exact no-identity state the piece system exists to
//    escape. A plate at least gets to show its drawing.
//
// The bottom line all three agree on: a piece's identity has to live in the
// EAST–HEIGHT plane, because that is the only plane this camera renders without
// collapsing it into something else.
import type { Piece } from './pieces.js';
import { PIECE as STANDARD } from './cand-standard.js';

export const CANDIDATE_PIECES: Record<string, Piece> = {
	standard: STANDARD,
};

/** Every candidate hangs. Stated once here rather than per file, because the
 *  contract is a property of the set — these are projections, and a projection
 *  that has grown a base has stopped being one. */
export const CANDIDATE_SUSPENDED = Object.keys(CANDIDATE_PIECES);
