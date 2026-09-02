import { describe, expect, it } from 'vitest';
import { CREEP, creepPose, peekPose, snapPose, stepFoot, stepWeight, stilledPose } from './gait.js';

const REST = { yaw: 1, pitch: 0.3, viewDistance: 1.2 };

describe('stepWeight', () => {
	it('holds at exactly zero for the last quarter of every step', () => {
		// The whole point of the piecewise shape. If this ever becomes "very
		// small" rather than zero, the creep has quietly turned back into a sine
		// and the shot has lost the pause that makes it read as sneaking.
		for (const p of [0.75, 0.8, 0.9, 0.99]) expect(stepWeight(p)).toBe(0);
		for (const cycle of [0, 1, 2, 7]) expect(stepWeight(cycle + 0.85)).toBe(0);
	});

	it('rises to a full step and settles back', () => {
		expect(stepWeight(0)).toBe(0);
		expect(stepWeight(0.52)).toBeCloseTo(1, 5);
		expect(stepWeight(0.26)).toBeGreaterThan(0.5);
		expect(stepWeight(0.63)).toBeCloseTo(0.5, 1);
	});

	it('decelerates into the top of the step rather than accelerating', () => {
		// Ease-out: the first half of the rise covers more ground than the second.
		const early = stepWeight(0.26) - stepWeight(0);
		const late = stepWeight(0.52) - stepWeight(0.26);
		expect(early).toBeGreaterThan(late);
	});
});

describe('stepFoot', () => {
	it('alternates every step, so sway is a two-step cycle over a one-step bob', () => {
		expect(stepFoot(0.2)).toBe(1);
		expect(stepFoot(1.2)).toBe(-1);
		expect(stepFoot(2.2)).toBe(1);
	});
});

describe('creepPose', () => {
	it('leaves the pose untouched during the pause', () => {
		// t = 0.85 of a step is inside the still run, so a body mid-pause must be
		// EXACTLY where the caller put it — any drift here is the camera moving
		// while the character is supposed to be listening.
		const at = creepPose(REST, CREEP.step * 0.85);
		expect(at).toEqual(REST);
	});

	it('swings the opposite way on the next step', () => {
		const first = creepPose(REST, CREEP.step * 0.4).yaw - REST.yaw;
		const second = creepPose(REST, CREEP.step * 1.4).yaw - REST.yaw;
		expect(Math.sign(first)).toBe(-Math.sign(second));
		expect(Math.abs(first)).toBeCloseTo(Math.abs(second), 6);
	});

	it('only ever lifts, never sinks', () => {
		// `SURFACE_DISTANCE` is a hard floor the projector clamps at, so a gait
		// that dipped below the base pose would flatten against it and the bob
		// would go missing on exactly the frames it is largest.
		for (let ms = 0; ms < CREEP.step * 4; ms += 17) {
			expect(creepPose(REST, ms).viewDistance).toBeGreaterThanOrEqual(REST.viewDistance);
		}
	});

	it('stays within the gait it was given', () => {
		for (let ms = 0; ms < CREEP.step * 4; ms += 13) {
			const at = creepPose(REST, ms);
			expect(Math.abs(at.yaw - REST.yaw)).toBeLessThanOrEqual(CREEP.sway + 1e-9);
			expect(at.pitch - REST.pitch).toBeLessThanOrEqual(CREEP.bob + 1e-9);
		}
	});
});

describe('peekPose', () => {
	it('returns to where it started', () => {
		const back = peekPose(REST, 1, 0.06);
		expect(back.yaw).toBeCloseTo(REST.yaw, 9);
		expect(back.pitch).toBeCloseTo(REST.pitch, 9);
	});

	it('sweeps through the far point at its fastest, not its slowest', () => {
		// A lerp out and back has zero velocity in the middle, which reads as the
		// camera changing its mind. One sine over the beat has its maximum there.
		const speed = (t: number) => Math.abs(peekPose(REST, t + 1e-4, 0.06).yaw - peekPose(REST, t, 0.06).yaw);
		expect(speed(0.5)).toBeGreaterThan(speed(0.25));
	});
});

describe('snapPose', () => {
	it('rings down to nothing', () => {
		const end = snapPose(REST, 1, 0.03);
		expect(end.yaw).toBeCloseTo(REST.yaw, 9);
		expect(end.pitch).toBeCloseTo(REST.pitch, 9);
	});

	it('crosses back over the rest pose — a release, not a push', () => {
		const signs = new Set<number>();
		for (let t = 0; t < 1; t += 0.02) {
			const d = snapPose(REST, t, 0.03).pitch - REST.pitch;
			if (Math.abs(d) > 1e-6) signs.add(Math.sign(d));
		}
		expect(signs.size).toBe(2);
	});
});

describe('stilledPose', () => {
	it('never stops moving, and never moves much', () => {
		let moved = 0;
		for (let ms = 0; ms < 12000; ms += 250) {
			const at = stilledPose(REST, ms);
			if (at.yaw !== REST.yaw) moved++;
			expect(Math.abs(at.yaw - REST.yaw)).toBeLessThan(0.01);
			expect(Math.abs(at.pitch - REST.pitch)).toBeLessThan(0.012);
		}
		expect(moved).toBeGreaterThan(40);
	});

	it('scales to nothing when asked for none', () => {
		expect(stilledPose(REST, 4321, 0)).toEqual(REST);
	});
});
