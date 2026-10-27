// ── Your own arms, in the corners of the view ────────────────────────────────
// Without them a first-person walk feels like a floating camera. Two blocks per
// arm, a sleeve in the figure's arm colour and a hand in its plate, placed in
// camera space so they ride the view, then carried to world space so the room's
// lights fall on them. Drawn last over a cleared depth buffer: an arm never
// pokes through the wall you stand against.
//
// Pure: no GL. The colours are `armColors` in figures.ts.

type V3 = [number, number, number];

/** One block from `from` to `to`, `half` wide each side, in camera space:
 *  x right, y up, −z ahead, metres from the eye. */
export interface ArmBox {
	from: V3;
	to: V3;
	half: number;
	part: 'sleeve' | 'hand';
}

/** How far ahead the hands sit, and what share of the view they take. */
const REACH = 0.5;
const SPREAD = 0.55;
const DROP = 0.72;
const HALF_FOV = 1.15 / 2;

/** The blocks for both arms. `phase` runs 0→1 per stride, `amp` is 0 standing,
 *  1 walking, 2 running; `air` lifts them, as a jump pulls the arms up. The
 *  hands are placed by the view's own edges so a phone held upright still
 *  shows both. */
export function armBoxes(aspect: number, phase: number, amp: number, air: boolean): ArmBox[] {
	const h = REACH * Math.tan(HALF_FOV);
	const x = Math.min(0.24, h * aspect * SPREAD);
	const swing = Math.sin(phase * 2 * Math.PI) * 0.06 * amp;
	const bob = -Math.abs(Math.cos(phase * 2 * Math.PI)) * 0.02 * amp + (air ? 0.04 : 0);
	return [1, -1].flatMap((side) => {
		const hand: V3 = [side * x, -h * DROP + bob, -REACH + side * swing];
		const shoulder: V3 = [side * (x + 0.1), hand[1] - 0.2, 0];
		const dir = norm(sub(hand, shoulder));
		const wrist: V3 = [hand[0] - dir[0] * 0.12, hand[1] - dir[1] * 0.12, hand[2] - dir[2] * 0.12];
		return [
			{ from: shoulder, to: wrist, half: 0.045, part: 'sleeve' as const },
			{ from: wrist, to: hand, half: 0.055, part: 'hand' as const }
		];
	});
}

/** The model matrix that puts the unit block (x, z ∈ [−1, 1], y ∈ [0, 2] once
 *  the shader has swizzled it) on `b`, for a camera at `eye` turned by `yaw`
 *  and `pitch` as `view()` turns it. Written into `out`. */
export function armModel(out: Float32Array, eye: { x: number; y: number; z: number }, yaw: number, pitch: number, b: ArmBox): Float32Array {
	const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
	// The camera's right, up and back in the world; right × up = back.
	const R: V3 = [cy, 0, sy], U: V3 = [-sy * sp, cp, cy * sp], B: V3 = [-sy * cp, -sp, cy * cp];
	const world = (v: V3): V3 => [R[0] * v[0] + U[0] * v[1] + B[0] * v[2], R[1] * v[0] + U[1] * v[1] + B[1] * v[2], R[2] * v[0] + U[2] * v[1] + B[2] * v[2]];
	const along = sub(b.to, b.from);
	const len = Math.hypot(...along);
	const a = norm(along);
	// Across and over the arm, a right-handed frame with `a`, so the block's
	// faces stay wound outward.
	const s = norm([-a[2], 0, a[0]]);
	const t: V3 = [s[1] * a[2] - s[2] * a[1], s[2] * a[0] - s[0] * a[2], s[0] * a[1] - s[1] * a[0]];
	const c0 = world(s), c1 = world(a), c2 = world(t), p = world(b.from);
	out.set([
		c0[0] * b.half, c0[1] * b.half, c0[2] * b.half, 0,
		(c1[0] * len) / 2, (c1[1] * len) / 2, (c1[2] * len) / 2, 0,
		c2[0] * b.half, c2[1] * b.half, c2[2] * b.half, 0,
		eye.x + p[0], eye.y + p[1], eye.z + p[2], 1
	]);
	return out;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (v: V3): V3 => {
	const l = Math.hypot(...v) || 1;
	return [v[0] / l, v[1] / l, v[2] / l];
};
