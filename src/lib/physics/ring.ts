// ── physics/ring — analytic ring placement ───────────────────────────────────
// Places a set of differently-sized bodies on a ring around a centre so that no
// two touch, and the ring is no larger than it has to be.
//
// Closed-form, so it needs no seed and cannot fail to converge — which is what
// makes it the SEED for `packInward`, whose job is then only to draw that ring
// in toward the centre. Starting a solver from a known-good layout beats asking
// it to untangle a pile.
//
// The naive version — a fixed ring radius and a uniform 360/n slot per node —
// fails twice over: the ring doesn't grow as nodes are added, and it hands a
// fanned-out agent (which can claim 100px+) the same slot as a 44px leaf. Both
// show up as overlap.
//
// So: each node declares the radius it needs, and the ring radius is SOLVED for.
// Seen from the centre, a node of radius Rᵢ on a ring of radius R subtends
// 2·asin(Rᵢ/R). Those wedges must fit in a full turn:
//
//     Σ 2·asin(Rᵢ/R) ≤ 2π
//
// The left side falls monotonically as R grows, so the smallest R that fits is a
// bisection away — no iteration to a fixed point, no simulation, no jitter. Then
// each node is placed at its own cumulative angle rather than an even slot, so a
// big node takes the room it needs and its neighbours simply start later.
//
// Pure: no Svelte, no reactivity, no dependencies.

export interface RingOpts {
	/** Clear space between adjacent nodes on the ring. */
	margin?: number;
	/** Radius of the hub at the centre — nodes must clear it. */
	hubR?: number;
	/** Clear space between the hub and the ring. */
	hubMargin?: number;
	/** Bearing the first node sits at, in degrees. -90 = straight up. */
	startAngle?: number;
}

const TAU = Math.PI * 2;

/** Half-angle subtended by a node of radius `r` on a ring of radius `R`.
 *  Saturates at π/2 when the node is too big for the ring, which keeps the sum
 *  monotonic (and the bisection well-behaved) instead of yielding NaN. */
function halfAngle(r: number, R: number): number {
	return Math.asin(Math.min(1, r / R));
}

function totalAngle(radii: number[], R: number, margin: number): number {
	let sum = 0;
	for (const r of radii) sum += 2 * halfAngle(r + margin / 2, R);
	return sum;
}

/** The smallest ring radius on which every node fits without touching.
 *
 *  Bounded below by the largest node (a ring smaller than that can't hold it at
 *  all) and by the hub it has to clear; bounded above by doubling until it fits,
 *  which always terminates because the wedge sum → 0 as R → ∞. */
export function solveRingRadius(radii: number[], opts: RingOpts = {}): number {
	const { margin = 0, hubR = 0, hubMargin = 0 } = opts;
	if (!radii.length) return Math.max(hubR + hubMargin, 1);

	const maxR = Math.max(...radii);
	// Floors: hold the biggest node, and clear the hub.
	const floor = Math.max(maxR + margin, hubR + hubMargin + maxR);

	if (totalAngle(radii, floor, margin) <= TAU) return floor;

	let lo = floor;
	let hi = floor * 2;
	// Grow until it fits. The cap is a runaway guard, not an expected path.
	for (let i = 0; i < 64 && totalAngle(radii, hi, margin) > TAU; i++) {
		lo = hi;
		hi *= 2;
	}
	// ~40 halvings resolves far below a pixel for any ring a screen could hold.
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (totalAngle(radii, mid, margin) > TAU) lo = mid;
		else hi = mid;
	}
	return hi;
}

export interface RingPlacement {
	radius: number;
	/** Bearing per node, in radians, index-aligned with the input radii. */
	angles: number[];
	/** Offset from the ring centre, index-aligned. */
	points: { x: number; y: number }[];
}

/** Solve the ring and place every node on it.
 *
 *  Each node gets the angle it actually subtends, walked cumulatively, so sizes
 *  never collide. Whatever turn is left over is shared out evenly between the
 *  gaps — with one large node the ring is set by that node, and spreading the
 *  slack keeps everyone else from bunching up on the far side.
 *
 *  Deterministic: same input, same output. No randomness, no previous state. */
export function packRing(radii: number[], opts: RingOpts = {}): RingPlacement {
	const { margin = 0, startAngle = -90 } = opts;
	const radius = solveRingRadius(radii, opts);
	const angles: number[] = [];
	const points: { x: number; y: number }[] = [];
	if (!radii.length) return { radius, angles, points };

	const used = totalAngle(radii, radius, margin);
	const gap = Math.max(0, TAU - used) / radii.length;

	// Walk the cumulative angle, but back off by the first node's half-wedge so the
	// bearing lands on that NODE rather than on the leading edge of its wedge —
	// otherwise the whole ring rotates by half a node, and by a different amount as
	// the first node changes size.
	let cursor = (startAngle * Math.PI) / 180 - halfAngle(radii[0] + margin / 2, radius);
	for (const r of radii) {
		const half = halfAngle(r + margin / 2, radius);
		cursor += half;
		angles.push(cursor);
		points.push({ x: Math.cos(cursor) * radius, y: Math.sin(cursor) * radius });
		cursor += half + gap;
	}
	return { radius, angles, points };
}
