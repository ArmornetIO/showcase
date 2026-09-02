import { describe, it, expect } from 'vitest';
import {
	orbitIntroPose,
	orbitIntroStart,
	cameraLerp,
	cameraApproach,
	divePose,
	diveFraming,
	firstPersonPose,
	SURFACE_DISTANCE,
	ORBIT_PRESETS,
	type OrbitIntroConfig
} from './orbit.js';

const REST = { yaw: 0.6, pitch: 0.35, viewDistance: 2.6 };
const cfg: OrbitIntroConfig = { rest: REST };

describe('orbitIntroPose', () => {
	it('lands exactly on the rest pose at t=1', () => {
		const end = orbitIntroPose(1, cfg);
		expect(end.yaw).toBeCloseTo(REST.yaw, 6);
		expect(end.pitch).toBeCloseTo(REST.pitch, 6);
		expect(end.viewDistance).toBeCloseTo(REST.viewDistance, 6);
	});

	it('starts a whole number of turns back so it settles forward onto rest', () => {
		const start = orbitIntroStart(cfg);
		const turnsBack = (REST.yaw - start.yaw) / (Math.PI * 2);
		expect(turnsBack).toBeCloseTo(0.75, 6); // default turns — the low sweep
	});

	it('starts leaning in and further out, then closes', () => {
		const start = orbitIntroPose(0, cfg);
		// Positive: the default opens already tipped over the surface, not flat on
		// to the equator the way the moon orbit does.
		expect(start.pitch).toBeCloseTo(0.25, 6);
		expect(start.viewDistance).toBeGreaterThan(REST.viewDistance);
	});

	it('DIPS BELOW the resting pitch mid-pass — that is the low sweep', () => {
		// The whole character of the default, and the one property that separates it
		// from every other preset: a negative arc passes UNDER the resting pose and
		// rises into it, so the pass is spent looking across the terrain rather than
		// down onto it. If this ever comes out above rest, the default has silently
		// become an over-the-pole orbit again.
		const mid = orbitIntroPose(0.5, cfg);
		expect(mid.pitch).toBeLessThan(REST.pitch);
	});

	it('still swings up and over the pole when asked for a positive arc', () => {
		// The arc mechanism itself, tested explicitly rather than via the defaults —
		// which is what this used to rely on, and why changing the default broke it.
		const moon: OrbitIntroConfig = { rest: REST, arc: 0.85, fromPitch: -0.25 };
		expect(orbitIntroPose(0.5, moon).pitch).toBeGreaterThan(REST.pitch);
	});

	it('clamps progress outside [0,1]', () => {
		expect(orbitIntroPose(-5, cfg)).toEqual(orbitIntroPose(0, cfg));
		expect(orbitIntroPose(5, cfg)).toEqual(orbitIntroPose(1, cfg));
	});

	it('keeps the preset menu honest — first entry IS the default', () => {
		// GlobeDevControls opens on ORBIT_PRESETS[0] while the globe itself plays
		// `resolve()`'s fallbacks. Let those two drift and the menu shows one intro
		// selected while a different one runs.
		const first = ORBIT_PRESETS[0];
		expect(first.id).toBe('sweep');
		const start = orbitIntroStart({ rest: REST });
		const preset = orbitIntroStart({ rest: REST, ...first.params, fromDistance: undefined });
		expect(start.yaw).toBeCloseTo(preset.yaw, 6);
		expect(start.pitch).toBeCloseTo(preset.pitch, 6);
	});

	it('honours turns / arc / distance overrides', () => {
		const c: OrbitIntroConfig = { rest: REST, turns: 2, arc: 0, fromDistance: 8, fromPitch: 0 };
		const s = orbitIntroPose(0, c);
		expect((REST.yaw - s.yaw) / (Math.PI * 2)).toBeCloseTo(2, 6);
		expect(s.viewDistance).toBeCloseTo(8, 6);
		// arc:0 means no over-the-pole lift — pitch stays on the eased line.
		expect(orbitIntroPose(0.5, c).pitch).toBeLessThanOrEqual(REST.pitch);
	});
});

describe('cameraLerp', () => {
	const A = { yaw: 0.2, pitch: 0.1, viewDistance: 2.6 };
	const B = { yaw: 1.4, pitch: -0.3, viewDistance: 2.0 };

	it('starts at one end and finishes at the other', () => {
		for (const [t, want] of [
			[0, A],
			[1, B]
		] as const) {
			const p = cameraLerp(A, B, t);
			expect(p.yaw).toBeCloseTo(want.yaw, 9);
			expect(p.pitch).toBeCloseTo(want.pitch, 9);
			expect(p.viewDistance).toBeCloseTo(want.viewDistance, 9);
		}
	});

	it('takes the short way round on yaw', () => {
		// 350° → 10°. Interpolating the raw numbers would unwind 340° the wrong way,
		// which is a full extra turn of the globe to reach a neighbour.
		const from = { ...A, yaw: (350 * Math.PI) / 180 };
		const to = { ...A, yaw: (10 * Math.PI) / 180 };
		const mid = cameraLerp(from, to, 0.5);
		expect(mid.yaw).toBeGreaterThan(from.yaw);
		expect(mid.yaw - from.yaw).toBeLessThanOrEqual(Math.PI);
	});

	it('clamps outside 0..1 rather than overshooting', () => {
		expect(cameraLerp(A, B, -1).yaw).toBeCloseTo(A.yaw, 9);
		expect(cameraLerp(A, B, 2).yaw).toBeCloseTo(B.yaw, 9);
	});
});

describe('cameraApproach', () => {
	const A = { yaw: 0, pitch: 0, viewDistance: 2.6 };
	const B = { yaw: 1.2, pitch: 0.5, viewDistance: 2.0 };

	it('still lands exactly on the target', () => {
		const p = cameraApproach(A, B, 1);
		expect(p.yaw).toBeCloseTo(B.yaw, 9);
		expect(p.pitch).toBeCloseTo(B.pitch, 9);
		expect(p.viewDistance).toBeCloseTo(B.viewDistance, 9);
	});

	it('turns BEFORE it rises and closes', () => {
		// The whole reason this exists rather than cameraLerp: at the quarter mark the
		// globe should be well into its turn while the camera has barely begun to
		// settle. Moving all three together is the diagonal that reads as drift.
		const q = cameraApproach(A, B, 0.25);
		const yawDone = (q.yaw - A.yaw) / (B.yaw - A.yaw);
		const settleDone = (q.pitch - A.pitch) / (B.pitch - A.pitch);
		expect(yawDone).toBeGreaterThan(settleDone + 0.15);
	});

	it('overlaps the two beats instead of stopping between them', () => {
		// A strict sequence would leave yaw finished and settle unstarted somewhere in
		// the middle, which reads as a stutter. Around the seam BOTH must be moving.
		const a = cameraApproach(A, B, 0.42);
		const b = cameraApproach(A, B, 0.52);
		expect(b.yaw).toBeGreaterThan(a.yaw);
		expect(b.pitch).toBeGreaterThan(a.pitch);
	});

	it('never runs backwards on any channel', () => {
		let prev = cameraApproach(A, B, 0);
		for (let t = 0.02; t <= 1.0001; t += 0.02) {
			const p = cameraApproach(A, B, t);
			expect(p.yaw).toBeGreaterThanOrEqual(prev.yaw - 1e-12);
			expect(p.pitch).toBeGreaterThanOrEqual(prev.pitch - 1e-12);
			expect(p.viewDistance).toBeLessThanOrEqual(prev.viewDistance + 1e-12);
			prev = p;
		}
	});
});

describe('firstPersonPose', () => {
	it('stands on the shell and never inside it', () => {
		expect(firstPersonPose({ yaw: 1, pitch: 0 }).viewDistance).toBe(SURFACE_DISTANCE);
		// Below the floor the perspective divide inverts the world through itself,
		// so an over-eager caller must be clamped rather than trusted.
		expect(firstPersonPose({ yaw: 1, pitch: 0 }, { distance: 0.4 }).viewDistance).toBe(
			SURFACE_DISTANCE
		);
	});

	it('lifts the subject off the floor of the frame', () => {
		// A pose that CENTRES a building from the surface puts it under your boots.
		const p = firstPersonPose({ yaw: 0, pitch: 0.1 }, { tilt: 0.28 });
		expect(p.pitch).toBeCloseTo(0.38, 6);
	});
});

describe('divePose', () => {
	const FROM = { yaw: 0, pitch: 0.2, viewDistance: 2.6 };
	const TO = { yaw: 2.4, pitch: 0.5, viewDistance: SURFACE_DISTANCE };

	it('is pinned at both ends', () => {
		const a = divePose(FROM, TO, 0);
		expect(a.yaw).toBeCloseTo(FROM.yaw, 6);
		expect(a.viewDistance).toBeCloseTo(FROM.viewDistance, 6);
		const b = divePose(FROM, TO, 1);
		expect(b.yaw).toBeCloseTo(TO.yaw, 6);
		expect(b.pitch).toBeCloseTo(TO.pitch, 6);
		expect(b.viewDistance).toBeCloseTo(TO.viewDistance, 6);
	});

	it('turns first and travels after', () => {
		// The whole character of the move. Halfway through, the world should be
		// pointing almost the right way while the eye has barely left orbit —
		// travelling toward something you are not yet facing is a barrel roll.
		const h = divePose(FROM, TO, 0.5);
		const turned = h.yaw / TO.yaw;
		const closed = (FROM.viewDistance - h.viewDistance) / (FROM.viewDistance - TO.viewDistance);
		expect(turned).toBeGreaterThan(0.95);
		expect(closed).toBeLessThan(0.4);
	});

	it('hangs, then rushes', () => {
		// The second half must cover more ground than the first, or it is a slide
		// rather than a dive — and the whole feel of the move is in that asymmetry.
		const mid = divePose(FROM, TO, 0.5).viewDistance;
		const early = FROM.viewDistance - mid;
		const late = mid - TO.viewDistance;
		expect(late).toBeGreaterThan(early);
	});

	it('takes the short way round on yaw', () => {
		// 350° to 10° is 20° apart, not 340° — the long way is a full unwind that
		// every frame of gets right and the whole of gets wrong.
		const from = { yaw: 0.1, pitch: 0, viewDistance: 2.6 };
		const to = { yaw: Math.PI * 2 - 0.1, pitch: 0, viewDistance: SURFACE_DISTANCE };
		expect(divePose(from, to, 0.5).yaw).toBeLessThan(0.1);
	});

	it('never runs backwards on distance', () => {
		let prev = divePose(FROM, TO, 0).viewDistance;
		for (let t = 0.02; t <= 1.0001; t += 0.02) {
			const d = divePose(FROM, TO, t).viewDistance;
			expect(d).toBeLessThanOrEqual(prev + 1e-12);
			prev = d;
		}
	});
});

describe('diveFraming', () => {
	it('is pinned at both ends, overshoot included', () => {
		expect(diveFraming(900, 60, 0)).toBeCloseTo(900, 6);
		// The punch is a half-sine: zero at t=1, so the shot cannot end parked
		// inside its own overshoot.
		expect(diveFraming(900, 60, 1)).toBeCloseTo(60, 6);
	});

	it('punches past the resting frame before settling back', () => {
		const tightest = Math.min(
			...Array.from({ length: 41 }, (_, i) => diveFraming(900, 60, 0.6 + i * 0.01))
		);
		// Past it, but not so far past that the arrival reads as a bounce.
		expect(tightest).toBeLessThan(60);
		expect(tightest).toBeGreaterThan(60 * 0.85);
	});

	it('has the travel finished before the punch fires', () => {
		// The bug this is here to stop coming back: with the travel spread over the
		// whole window the frame is still hundreds of px out when the overshoot
		// runs, and "12% tighter" is 12% tighter than nowhere in particular.
		expect(diveFraming(900, 60, 0.84)).toBeCloseTo(60, 6);
	});

	it('runs backwards for an exit without inventing a new curve', () => {
		// `leave` walks 1−t along the same function, so the pull-out cannot develop
		// a character the dive does not have.
		expect(diveFraming(900, 60, 1 - 0)).toBeCloseTo(60, 6);
		expect(diveFraming(900, 60, 1 - 1)).toBeCloseTo(900, 6);
	});
});
