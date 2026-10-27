import { describe, expect, it } from 'vitest';
import { DOCKED, HEAT_S, RESET, COOL_S, beam, stepDrone } from './drone.js';

const run = (d = DOCKED, s: number, dt = 0.1) => {
	for (let t = 0; t < s; t += dt) d = stepDrone(d, dt);
	return d;
};

describe('drone', () => {
	it('cuts out at full heat and stays dark until it cools to RESET', () => {
		const hot = run({ ...DOCKED, out: true }, HEAT_S + 1);
		expect(hot.tripped).toBe(true);
		expect(beam(hot, 0)).toBe(0);
		expect(run(hot, (1 - RESET) * COOL_S - 1).tripped).toBe(true);
		expect(run(hot, (1 - RESET) * COOL_S + 1).tripped).toBe(false);
	});

	it('cools while docked and is dark', () => {
		const d = run({ out: false, heat: 0.5, tripped: false }, 5);
		expect(d.heat).toBeLessThan(0.5);
		expect(beam(d, 0)).toBe(0);
	});

	it('stutters more when hot', () => {
		const drops = (heat: number) => {
			let n = 0;
			for (let t = 0; t < 600; t += 0.03) if (beam({ out: true, heat, tripped: false }, t) < 0.1) n++;
			return n;
		};
		expect(drops(0.95)).toBeGreaterThan(drops(0) * 5);
	});
});
