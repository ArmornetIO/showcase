import { describe, expect, it } from 'vitest';
import { lensDrift, lockSettle, ripple, sifting } from './optics.js';

const REST = { yaw: 1, pitch: 0.3, viewDistance: 1.5 };

describe('sifting', () => {
	it('always finishes on the answer', () => {
		// The property the whole beat rests on. If this can miss, the landing
		// stops meaning anything the first time a player sees it miss.
		for (let count = 2; count <= 8; count++) {
			for (let answer = 0; answer < count; answer++) {
				expect(sifting(1, count, answer)).toBe(answer);
			}
		}
	});

	it('stays on the answer once settled', () => {
		// `t` can overshoot 1 — a caller holding the beat open runs progress past
		// the end — and a spinner that resumes after landing is a spinner that
		// changed its mind.
		for (const t of [1, 1.4, 3]) expect(sifting(t, 4, 2)).toBe(2);
	});

	it('never reverses', () => {
		// It passes over the answer repeatedly on the way, which is what cycling
		// IS. What must not happen is the index going backwards — a search that
		// backs up reads as changing its mind. Checked as forward-by-one-modulo
		// rather than as a rising number, since the index wraps by design.
		const count = 4;
		let prev = sifting(0, count, 3);
		for (let t = 0; t <= 1; t += 0.002) {
			const now = sifting(t, count, 3);
			if (now !== prev) expect(now).toBe((prev + 1) % count);
			prev = now;
		}
	});

	it('decelerates — more changes early than late', () => {
		const changes = (a: number, b: number) => {
			let n = 0;
			let prev = sifting(a, 4, 3);
			for (let t = a; t <= b; t += 0.002) {
				const now = sifting(t, 4, 3);
				if (now !== prev) n++;
				prev = now;
			}
			return n;
		};
		expect(changes(0, 0.4)).toBeGreaterThan(changes(0.6, 1));
	});

	it('survives a single candidate without dividing by zero', () => {
		expect(sifting(0.5, 1, 0)).toBe(0);
		expect(sifting(0.5, 0, 0)).toBe(0);
	});
});

describe('lockSettle', () => {
	it('starts at nothing and ends pinned at one', () => {
		expect(lockSettle(0)).toBeCloseTo(0, 6);
		expect(lockSettle(1)).toBe(1);
		expect(lockSettle(1.6)).toBe(1);
	});

	it('overshoots, but not into a bounce', () => {
		let peak = 0;
		for (let t = 0; t <= 1; t += 0.005) peak = Math.max(peak, lockSettle(t));
		expect(peak).toBeGreaterThan(1);
		expect(peak).toBeLessThan(1.12);
	});
});

describe('lensDrift', () => {
	it('is the least still of the idle cameras, and still small', () => {
		let peak = 0;
		for (let ms = 0; ms < 20000; ms += 23) {
			peak = Math.max(peak, Math.abs(lensDrift(REST, ms).yaw - REST.yaw));
		}
		// Bigger than the blackout's held breath (0.01) — a long lens magnifies
		// the hand — and nowhere near enough to read as the camera being moved.
		expect(peak).toBeGreaterThan(0.01);
		expect(peak).toBeLessThan(0.02);
	});

	it('carries a fast term as well as a slow one', () => {
		// Two slow sines read as a boat. The tremor is what says "long lens".
		const at = (ms: number) => lensDrift(REST, ms).yaw;
		let fast = 0;
		for (let ms = 0; ms < 2000; ms += 10) fast = Math.max(fast, Math.abs(at(ms + 10) - at(ms)));
		expect(fast).toBeGreaterThan(0.0002);
	});

	it('never touches the distance — this shot does not approach', () => {
		for (let ms = 0; ms < 8000; ms += 91) {
			expect(lensDrift(REST, ms).viewDistance).toBe(REST.viewDistance);
		}
	});

	it('scales to nothing when asked for none', () => {
		const at = lensDrift(REST, 1234, 0);
		expect(at.yaw).toBe(REST.yaw);
	});
});

describe('ripple', () => {
	it('holds every ring at zero until its turn', () => {
		// Rings are spaced in TIME, so the outer ones have not left yet.
		expect(ripple(0, 1, 1000, 4)).toBe(0);
		expect(ripple(100, 3, 1000, 4)).toBe(0);
	});

	it('runs each ring from the target outward and repeats', () => {
		expect(ripple(500, 0, 1000, 4)).toBeCloseTo(0.5, 6);
		expect(ripple(1500, 0, 1000, 4)).toBeCloseTo(0.5, 6);
	});

	it('spaces the rings evenly behind each other', () => {
		const a = ripple(2000, 0, 1000, 4);
		const b = ripple(2000, 1, 1000, 4);
		expect(((a - b) % 1 + 1) % 1).toBeCloseTo(0.25, 6);
	});
});
