// ── How a body moves the camera ──────────────────────────────────────────────
// `breathe()` in FirstPerson is the whole of the insert shot's body language: two
// sines, below the threshold of anything you could point at, and above the
// threshold of dead. That is right for somebody STANDING. It is wrong for
// somebody sneaking, and the difference is not amplitude.
//
// A sine never stops. Turn one up until you can see it and you get a boat, not a
// walk — because what makes a footstep read as a footstep is the PAUSE after it.
// A careful step is rise, settle, and then nothing at all while the weight tests
// the ground. The stillness is the whole tell: it is what a person does when they
// are listening for whether anyone heard the last one.
//
// So this file is pure functions over a clock. No Svelte, no camera, no DOM —
// the same reason `rules.ts` is pure. A gait you can assert on in Node is a gait
// that can be wrong loudly instead of quietly.

import type { CameraPose } from 'showcase';

export interface Gait {
	/** Radians the eye rises onto the ball of the foot and settles back. */
	bob: number;
	/** Radians of yaw as the weight goes from one foot to the other. The reason
	 *  a creep reads as a body rather than as a dolly: a camera that advances
	 *  without ever shifting its weight is on rails. */
	sway: number;
	/** Globe radii the eye lifts on the rise. Tiny, and it can only ever be
	 *  POSITIVE: `SURFACE_DISTANCE` is a hard floor the projector clamps at, so
	 *  a crouch cannot be spent going lower. It is spent on the pause instead. */
	lift: number;
	/** One step, ms. Long on purpose — at 500 this is a jog, and a jog cannot be
	 *  sneaking however low you put the camera. */
	step: number;
}

/** Somebody trying not to be heard. */
export const CREEP: Gait = { bob: 0.019, sway: 0.024, lift: 0.008, step: 980 };

/**
 * Somebody who is supposed to be here.
 *
 * The deliberate inverse of `CREEP`, and the contrast is the point of having
 * both in one file. A longer stride, almost no bob, and a sway that is present
 * only because a body that advances without shifting its weight is a dolly.
 *
 * It exists for the Maintainer, whose passive is `nobody audits a friend`. The
 * frightening thing about that card is not tradecraft, it is ACCESS: the
 * implant goes in during an ordinary walk through a door somebody held open.
 * Staging it as a sneak would flatter it into a heist and lose the whole point.
 */
export const STROLL: Gait = { bob: 0.006, sway: 0.011, lift: 0.003, step: 1240 };

/**
 * One careful step, as a weight from 0 to 1.
 *
 * Three segments, and the third is the point of the whole thing:
 *
 *   rise    0.00–0.52   slow, eased — the weight going onto the front foot
 *   settle  0.52–0.74   quicker — it lands
 *   still   0.74–1.00   exactly zero. Nothing moves.
 *
 * That flat run is why this is a piecewise function and not a sine with a phase
 * offset. A sine's minimum is an instant; a creep's is a beat you can hear.
 */
export function stepWeight(t: number): number {
	const p = t - Math.floor(t);
	if (p < 0.52) {
		const k = p / 0.52;
		// Ease-out: the rise decelerates into the top of the step, so the body
		// arrives at the pause rather than bouncing off it.
		return 1 - (1 - k) * (1 - k);
	}
	if (p < 0.74) return 1 - (p - 0.52) / 0.22;
	return 0;
}

/** Which foot is carrying, +1 or −1. Alternates every step, so the sway is a
 *  two-step cycle over a one-step bob — which is exactly the ratio a real gait
 *  has, and the reason the motion never quite repeats where you expect. */
export function stepFoot(t: number): number {
	return Math.floor(t) % 2 === 0 ? 1 : -1;
}

/**
 * A crouched, deliberate advance.
 *
 * `ms` is time since the creep began, not since the scene did — a gait that
 * inherits somebody else's clock starts mid-stride, and a first step taken from
 * halfway through the settle is the one frame that gives the whole thing away.
 */
export function creepPose(base: CameraPose, ms: number, g: Gait = CREEP): CameraPose {
	const t = ms / g.step;
	const k = stepWeight(t);
	return {
		yaw: base.yaw + stepFoot(t) * k * g.sway,
		pitch: base.pitch + k * g.bob,
		viewDistance: base.viewDistance + k * g.lift
	};
}

/**
 * Look along the wall and come back.
 *
 * Not a lerp to a second pose and back — that has a dead moment in the middle
 * where the direction reverses and the velocity is zero, which reads as the
 * camera changing its mind. One sine over the beat has its fastest moment there
 * instead, so the eye sweeps THROUGH the far point and returns, which is what a
 * check actually looks like.
 */
export function peekPose(base: CameraPose, t: number, swing: number): CameraPose {
	return {
		yaw: base.yaw + Math.sin(t * Math.PI * 2) * swing,
		pitch: base.pitch - Math.sin(t * Math.PI) * swing * 0.35,
		viewDistance: base.viewDistance
	};
}

/**
 * The jolt when the line parts.
 *
 * A decaying oscillation rather than a single kick, because a hand that cuts
 * something under tension is not pushed — it is RELEASED, and the arm rings
 * down. Two and a bit cycles inside a fifth of a second is about where that
 * stops reading as a shudder and starts reading as a snap.
 */
export function snapPose(base: CameraPose, t: number, amount: number): CameraPose {
	const decay = Math.pow(1 - Math.min(1, t), 2.4);
	const ring = Math.sin(t * Math.PI * 5.2) * decay * amount;
	return {
		yaw: base.yaw + ring * 0.6,
		pitch: base.pitch - ring,
		viewDistance: base.viewDistance
	};
}

/**
 * Held breath, going out.
 *
 * The insert shot's `breathe()` is a person at rest. This is the same idea for a
 * person who has just done something and is standing in the dark listening: a
 * longer, shallower cycle with a hitch in it, because holding your breath and
 * then letting it go is not a sine either.
 */
export function stilledPose(base: CameraPose, ms: number, amount = 1): CameraPose {
	const slow = Math.sin(ms / 2400) * 0.0045;
	// The hitch: a second, much faster term that is mostly nothing and
	// occasionally a catch. Cheap, and it is the difference between calm and
	// deliberately calm.
	const hitch = Math.pow(Math.max(0, Math.sin(ms / 1700)), 7) * 0.006;
	return {
		yaw: base.yaw + slow * amount,
		pitch: base.pitch + (slow * 0.7 + hitch) * amount,
		viewDistance: base.viewDistance
	};
}
