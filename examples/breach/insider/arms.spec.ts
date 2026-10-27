import { describe, expect, it } from 'vitest';
import { armBoxes, armModel } from './arms.js';

/** The unit block's point (x, y, z) after the shader's swizzle, through `m`. */
const apply = (m: Float32Array, x: number, y: number, z: number) => [0, 1, 2].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);

describe('armModel', () => {
	it('puts each hand ahead of the eye, below it, on its own side, whichever way you face', () => {
		const eye = { x: 3, y: 1.6, z: -2 };
		for (const [yaw, pitch] of [[0, 0], [1.2, 0.4], [-2.5, -0.6]]) {
			const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
			const right = [Math.cos(yaw), 0, Math.sin(yaw)];
			const up = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)];
			const hands = armBoxes(16 / 9, 0.3, 1, false).filter((b) => b.part === 'hand');
			const sides = hands.map((b) => {
				// The block's far end, y = 2, is `to`.
				const p = apply(armModel(new Float32Array(16), eye, yaw, pitch, b), 0, 2, 0);
				const d = [p[0] - eye.x, p[1] - eye.y, p[2] - eye.z];
				const dot = (v: number[]) => d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
				expect(dot(fwd)).toBeGreaterThan(0.3);
				expect(dot(up)).toBeLessThan(0);
				return Math.sign(dot(right));
			});
			expect(sides).toEqual([1, -1]);
		}
	});

	it('keeps both hands in view on a phone held upright', () => {
		const h = 0.5 * Math.tan(1.15 / 2);
		for (const b of armBoxes(9 / 19.5, 0, 0, false)) if (b.part === 'hand') expect(Math.abs(b.to[0])).toBeLessThan(h * (9 / 19.5));
	});
});
