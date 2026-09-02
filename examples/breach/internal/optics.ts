// ── Looking at something from a long way off ─────────────────────────────────
// The third shot's body language, and the second pure module of its kind. See
// `gait.ts` for the first, and for why these live outside the component: a
// camera behaviour you can assert on in Node is one that can be wrong loudly
// instead of quietly.
//
// What is different about this one is that NOBODY IS MOVING. `gait.ts` answers
// "what does the camera do while a body walks"; there is no walk here. The
// operator is already in position, already looking at the thing, and the whole
// event happens in the optics and in what gets written over the world. So the
// motion budget goes somewhere else entirely:
//
//   the drift    A long lens magnifies the hand holding it. This is the least
//                still camera of the three, and it is least still precisely
//                BECAUSE the operator is furthest away and doing least.
//   the sift     A shortlist collapsing. Deterministic, decelerating, and it
//                lands on the answer — a spinner that might miss is a spinner
//                the eye stops trusting the moment it sees it miss once.

import type { CameraPose } from 'showcase';

/** A sine of a stated PERIOD, because `Math.sin(ms / 190)` is not a 190ms
 *  cycle — it is a 1.2 second one, and writing the divisor inline is how a
 *  "fast tremor" ends up slower than the wander it was meant to ride on. That
 *  is not hypothetical; it is what the first version of this file did. */
const osc = (ms: number, periodMs: number, phase = 0) =>
	Math.sin((ms / periodMs) * Math.PI * 2 + phase);

/**
 * Long-lens shake.
 *
 * Three sines at spread frequencies rather than the two `breathe` uses, and one
 * of them fast. A pair of slow sines reads as a boat; what says "this is a long
 * lens on a hand" is a high-frequency tremor riding a slow wander, because that
 * is what magnification actually does to a held camera — it multiplies the
 * small errors far more than the large ones.
 *
 * Deliberately the largest of the three shots' idle motions. The blackout's
 * `stilledPose` is somebody holding their breath at arm's length from the
 * thing; this is somebody watching it from across a territory.
 */
export function lensDrift(base: CameraPose, ms: number, amount = 1): CameraPose {
	const wander = osc(ms, 6200) * 0.009 + osc(ms, 3400, 2.1) * 0.004;
	const tremor = osc(ms, 190) * 0.0016 + osc(ms, 127, 0.7) * 0.0011;
	return {
		yaw: base.yaw + (wander + tremor) * amount,
		pitch: base.pitch + (osc(ms, 4600, 1.4) * 0.0065 + tremor * 0.8) * amount,
		viewDistance: base.viewDistance
	};
}

/** How many candidates the sift cycles through before it settles. Enough that
 *  the early cycling reads as searching rather than as flicking between two
 *  things, and few enough that every step is a legible frame at speed. */
export const SIFT_SPINS = 17;

/**
 * Which candidate is showing, part way through the sift.
 *
 * A decelerating spinner that is GUARANTEED to stop on `answer`. Both halves of
 * that matter:
 *
 * Deceleration, because a list that cycles at a constant rate and then stops has
 * not decided anything — it has been switched off. Easing out is what makes the
 * last few steps read as candidates being weighed and discarded.
 *
 * Guaranteed, because the alternative — cycle freely and then swap to the answer
 * at the end — puts a seam exactly where the shot needs continuity: the last
 * step becomes a cut rather than the spinner coming to rest, and it is the one
 * frame the player is looking hardest at.
 *
 * It passing OVER the answer several times on the way is not a flaw; that is
 * what cycling is, and every slot machine does it. What must never happen is the
 * index going backwards, which reads as the search changing its mind. `step` is
 * monotonic in `t`, so it cannot.
 *
 * Solved by working backwards from where it must finish rather than by trying
 * offsets until one fits.
 */
export function sifting(t: number, count: number, answer: number): number {
	if (count <= 0) return 0;
	const k = Math.max(0, Math.min(1, t));
	// Ease-out cubic: fast, then weighing, then settled.
	const eased = 1 - Math.pow(1 - k, 3);
	const step = Math.floor(eased * SIFT_SPINS);
	// Start wherever it has to start for `step === SIFT_SPINS` to land on the
	// answer. `+ count` keeps the modulus positive for a negative difference.
	const start = ((answer - SIFT_SPINS) % count + count) % count;
	return (start + step) % count;
}

/**
 * The name landing, as a settle from 0 to 1 with a small overshoot.
 *
 * Overshoot rather than a plain ease because a lock that merely arrives reads as
 * a fade-in. One short excursion past the mark and back is what the eye reads as
 * something being SEIZED — the same reason a snapped cable rings down in
 * `gait.ts` rather than stopping dead.
 *
 * Small on purpose: past about 12% the overshoot stops reading as a mechanism
 * catching and starts reading as a bounce, which is a cartoon.
 */
export function lockSettle(t: number): number {
	const k = Math.max(0, Math.min(1, t));
	if (k >= 1) return 1;
	// Ease-out-back. The first attempt was a decaying cosine, which overshot to
	// 1.37 — the decay is still large where the cosine first goes negative, and
	// the two multiply. This form has its overshoot as a stated constant instead
	// of as an emergent product of two curves, which is the difference between
	// tuning a number and discovering one.
	const c = 1.7;
	const p = k - 1;
	return 1 + (c + 1) * p * p * p + c * p * p;
}

/**
 * How far the name has travelled outward, 0 at the target and 1 at the far edge.
 *
 * The blackout closes a darkness IN on the building; this pushes rings OUT from
 * it, and the inversion is the whole point of the pair. One card takes something
 * away from a place, and the other tells everywhere else about it.
 *
 * Rings rather than one expanding circle, and each one is a function of the same
 * clock offset by its index — so they are evenly spaced in TIME, not in space,
 * which is what a propagating announcement looks like. Evenly spaced in space is
 * a target painted on the floor.
 */
export function ripple(ms: number, index: number, periodMs: number, count: number): number {
	const phase = ms / periodMs - index / count;
	return phase <= 0 ? 0 : phase % 1;
}
