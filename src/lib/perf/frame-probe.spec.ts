import { describe, it, expect } from 'vitest';
import { frameProbe } from './frame-probe.js';

/** Feed the probe a known sequence of frame deltas. */
function capture(label: string, deltas: number[], scriptMs = 0) {
	frameProbe.arm(label, deltas.length + 1);
	let ts = 1000;
	// The first begin() has no previous timestamp, so it yields no frame — feed one
	// extra to line the counts up.
	frameProbe.begin(ts);
	frameProbe.endScript();
	for (const d of deltas) {
		ts += d;
		frameProbe.begin(ts);
		if (scriptMs) {
			const until = performance.now() + scriptMs;
			while (performance.now() < until) {
				/* burn */
			}
		}
		frameProbe.endScript();
	}
	return frameProbe.stop()!;
}

describe('frameProbe', () => {
	it('costs nothing when it is not armed', () => {
		frameProbe.stop();
		expect(frameProbe.isArmed).toBe(false);
		// The whole point of the design: the hot path is a boolean check, and calling
		// it disarmed must neither throw nor record.
		frameProbe.begin(performance.now());
		frameProbe.endScript();
		expect(frameProbe.isArmed).toBe(false);
	});

	it('reports the DISTRIBUTION, not the mean — a lone hitch survives', () => {
		// The reason this exists rather than an FPS counter. Fifty good frames and
		// one bad one average out to nothing; max has to still show the stall.
		const s = capture('hitch', [...Array(50).fill(16), 120]);
		expect(s.frames).toBe(51);
		expect(s.dt.p50).toBeCloseTo(16, 0);
		expect(s.dt.max).toBeCloseTo(120, 0);
		// And it is counted as exactly one missed frame, not smeared into a rate.
		expect(s.dropped).toBe(1);
	});

	it('counts every frame over the 60Hz budget', () => {
		const s = capture('slow', [10, 12, 20, 30, 8]);
		expect(s.dropped).toBe(2); // 20 and 30
	});

	it('separates our script from the rest of the frame', () => {
		// The split that answers "is it us or is it paint". Long frames with almost
		// no script in them mean the cost is downstream of what we computed.
		const s = capture('paint-bound', [40, 40, 40]);
		expect(s.dt.p50).toBeCloseTo(40, 0);
		expect(s.script.p95).toBeLessThan(5);
		expect(s.scriptShare).toBeLessThan(0.2);
	});

	it('holds no buffers once a capture is over', () => {
		const s = capture('short', [16, 16]);
		expect(s.frames).toBe(2);
		expect(frameProbe.isArmed).toBe(false);
		// Re-reading the finished report must not depend on the buffers.
		expect(frameProbe.format(s)).toContain('short');
	});

	it('says so plainly when there is nothing to report', () => {
		expect(frameProbe.format(null)).toBe('no capture');
	});
});
