// ── physics/solver — constraint relaxation for canvas layout ──────────────────
// Packs circular bodies as tightly as a set of hard constraints allows.
//
// This is a POSITIONAL solver, not a simulation. There is no velocity, no mass,
// no timestep and no gravity — a canvas layout is quasi-static, so integrating a
// trajectory would only add an energy budget to tune and jitter to damp. Each
// pass nudges bodies toward where they want to be and then PROJECTS them back
// onto the constraints, which converges to a geometric fixed point.
//
// Why projection rather than forces: a repulsion force falls off with distance
// and settles wherever it balances the attraction, so bodies come to rest at a
// gap that depends on the tuning rather than on their size. Projection has no
// equilibrium to find — it removes exactly the overlap that exists and nothing
// more, so bodies settle at true contact: separation == r₁ + r₂ + margin.
//
// Deterministic: same input, same output. No randomness anywhere — bodies that
// land exactly on top of each other separate along an index-derived bearing
// rather than a random one, so a layout never reshuffles between runs.
//
// Pure: no Svelte, no DOM, no dependencies, and no knowledge of what a body
// stands for. Callers adapt their own shapes into `Body` and read positions back.

export interface Body {
	x: number;
	y: number;
	/** Everything this body occupies, as a radius about its centre. */
	r: number;
	/** 0 = immovable: the hub, or a node the operator placed by hand. Immovable
	 *  bodies never yield, so their neighbours absorb the whole correction. */
	invMass: number;
	/** Bodies sharing a group are drawn toward each other (see `cohesion`), so
	 *  they settle as a clump rather than scattering.
	 *
	 *  This is what stops a hub-and-spoke mesh from reading as a plain circle:
	 *  every spoke of a star has identical constraints, so any solver settles
	 *  them equidistant. Grouping is the asymmetry — and it comes from meaning
	 *  the caller supplies, not from the geometry. */
	group?: string | number;
}

/** A line between two bodies that has to stay readable. No OTHER body may come
 *  within `laneClearance` of it — which is what lets nodes fill inward without
 *  burying the links of the ones behind them. */
export interface Lane {
	i: number;
	j: number;
}

export interface SolveOpts {
	/** Clear space between two bodies at rest. */
	margin?: number;
	/** Clear space either side of a lane — room for the line, its chips and its
	 *  waypoint dots. */
	laneClearance?: number;
	/** Overlap below this is left alone. Without it, bodies at rest trade
	 *  sub-pixel corrections forever and the layout never sleeps. */
	slop?: number;
	/** Fraction of an overlap removed per iteration. 1 = remove it all at once;
	 *  lower converges more smoothly when constraints fight each other. */
	bias?: number;
}

const EPS = 1e-9;

const defaults = { margin: 0, laneClearance: 0, slop: 0.5, bias: 1 };

/** Separation bearing for two bodies at the same point. Derived from the index
 *  pair rather than random, so a degenerate seed still resolves the same way
 *  every run. Irrational multiplier keeps successive pairs from picking the
 *  same direction and re-piling. */
function fallbackNormal(i: number, j: number): { nx: number; ny: number } {
	const a = (i * 2.399963229728653 + j * 0.7853981633974483) % (Math.PI * 2);
	return { nx: Math.cos(a), ny: Math.sin(a) };
}

/** Split a correction between two bodies by inverse mass and apply it. */
function push(a: Body, b: Body, nx: number, ny: number, corr: number): void {
	const im = a.invMass + b.invMass;
	if (im < EPS) return;
	const as = corr * (a.invMass / im);
	const bs = corr * (b.invMass / im);
	a.x -= nx * as;
	a.y -= ny * as;
	b.x += nx * bs;
	b.y += ny * bs;
}

/** Project two overlapping bodies apart. Returns the correction applied. */
function separate(a: Body, b: Body, ai: number, bi: number, o: Required<SolveOpts>): number {
	if (a.invMass + b.invMass < EPS) return 0;
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const target = a.r + b.r + o.margin;
	const d2 = dx * dx + dy * dy;
	if (d2 >= target * target) return 0;

	const d = Math.sqrt(d2);
	const { nx, ny } = d < EPS ? fallbackNormal(ai, bi) : { nx: dx / d, ny: dy / d };
	const pen = target - d;
	if (pen <= o.slop) return 0;

	const corr = (pen - o.slop) * o.bias;
	push(a, b, nx, ny, corr);
	return corr;
}

/** Closest point to (px,py) on the segment a→b, and how far along it that is. */
function closestOnSegment(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
): { x: number; y: number } {
	const dx = bx - ax;
	const dy = by - ay;
	const len2 = dx * dx + dy * dy;
	if (len2 < EPS) return { x: ax, y: ay };
	let t = ((px - ax) * dx + (py - ay) * dy) / len2;
	t = t < 0 ? 0 : t > 1 ? 1 : t;
	return { x: ax + dx * t, y: ay + dy * t };
}

/** Push a body off a lane it is sitting on. The lane's own endpoints are exempt —
 *  a line is allowed to touch the things it connects. Only the intruder moves:
 *  the lane belongs to two other bodies and dragging it around to dodge a third
 *  would just relocate the problem. */
function clearLane(bodies: Body[], lane: Lane, k: number, o: Required<SolveOpts>): number {
	if (k === lane.i || k === lane.j) return 0;
	const body = bodies[k];
	if (body.invMass < EPS) return 0;
	const a = bodies[lane.i];
	const b = bodies[lane.j];

	const c = closestOnSegment(body.x, body.y, a.x, a.y, b.x, b.y);
	const dx = body.x - c.x;
	const dy = body.y - c.y;
	const target = body.r + o.laneClearance;
	const d2 = dx * dx + dy * dy;
	if (d2 >= target * target) return 0;

	const d = Math.sqrt(d2);
	const { nx, ny } = d < EPS ? fallbackNormal(lane.i, k) : { nx: dx / d, ny: dy / d };
	const pen = target - d;
	if (pen <= o.slop) return 0;

	const corr = (pen - o.slop) * o.bias;
	body.x += nx * corr;
	body.y += ny * corr;
	return corr;
}

/** One relaxation pass: project every violated constraint once, in a stable
 *  order. Returns the largest correction applied — near zero means settled.
 *
 *  Brute-force O(n²) on purpose. A canvas mesh is tens of bodies, where a
 *  spatial hash costs more to rebuild each pass than the pair loop it saves.
 *  Revisit above ~200 bodies, where the crossover actually is. */
export function relax(bodies: Body[], lanes: Lane[] = [], opts: SolveOpts = {}): number {
	const o = { ...defaults, ...opts };
	let worst = 0;
	for (let i = 0; i < bodies.length; i++) {
		for (let j = i + 1; j < bodies.length; j++) {
			worst = Math.max(worst, separate(bodies[i], bodies[j], i, j, o));
		}
	}
	for (const lane of lanes) {
		for (let k = 0; k < bodies.length; k++) {
			worst = Math.max(worst, clearLane(bodies, lane, k, o));
		}
	}
	return worst;
}

export interface PackOpts extends SolveOpts {
	/** What the bodies are drawn toward. */
	center: { x: number; y: number };
	/** Relaxation iterations per pull pass. */
	iterations?: number;
	/** Backstop on total passes. Convergence normally ends the run well before
	 *  this; it exists so a pathological input can't spin. */
	maxPasses?: number;
	/** How far a body is drawn inward per pass, before the constraints answer.
	 *  Defaults to a stride scaled to how far the bodies actually sit from the
	 *  centre — a fixed stride either crawls on a big mesh or overshoots on a
	 *  small one. Halves whenever a pass makes no ground, so the run ends up
	 *  taking fine steps into a tight packing. */
	pull?: number;
	/** Progress below this ends a stride; corrections below it are settled. */
	sleep?: number;
	/** How hard same-`group` bodies are drawn together, relative to the inward
	 *  pull. 0 = off (a plain radial packing). ~0.6 clusters visibly while the
	 *  hub still governs the overall shape; above ~1 the groups dominate and the
	 *  mesh stops reading as centred on its hub. */
	cohesion?: number;
}

/** Mean position of each group. Pinned bodies count: a group's members should be
 *  drawn toward one it can no longer move, not pretend it isn't there. */
function groupCentroids(bodies: Body[]): Map<string | number, { x: number; y: number; n: number }> {
	const out = new Map<string | number, { x: number; y: number; n: number }>();
	for (const b of bodies) {
		if (b.group === undefined) continue;
		const c = out.get(b.group);
		if (c) {
			c.x += b.x;
			c.y += b.y;
			c.n++;
		} else out.set(b.group, { x: b.x, y: b.y, n: 1 });
	}
	for (const c of out.values()) {
		c.x /= c.n;
		c.y /= c.n;
	}
	return out;
}

/** Total distance the movable bodies sit from the centre — the quantity the pull
 *  is trying to minimise, and so the measure of whether a pass made progress. */
function radialSum(bodies: Body[], cx: number, cy: number): number {
	let sum = 0;
	for (const b of bodies) {
		if (b.invMass < EPS) continue;
		sum += Math.hypot(b.x - cx, b.y - cy);
	}
	return sum;
}

/** Pack bodies inward around `center`, as close as the constraints allow.
 *
 *  A ring is the wrong answer once a mesh grows: every node sits at one radius,
 *  so the radius grows with the count and the middle is left empty. Pulling
 *  inward instead lets nodes fill that space — and because each lane must stay
 *  clear, the ones that move in have to sit off their neighbours' lines, so the
 *  packing settles into interleaved shells on its own rather than by being told
 *  how many shells to make.
 *
 *  Expects a feasible seed (see `packRing`): it starts from a valid layout and
 *  keeps it valid, which converges far more reliably than untangling a pile.
 *
 *  Mutates `bodies` in place. */
export function packInward(bodies: Body[], lanes: Lane[], opts: PackOpts): void {
	const { center, iterations = 8, maxPasses = 600, sleep = 0.05 } = opts;
	// Nothing can move, so there is nothing to solve. Worth checking: a mesh that
	// polls re-runs this constantly, and once every node is placed and pinned the
	// whole pass is a no-op that still costs every pair test.
	if (!bodies.some((b) => b.invMass > EPS)) return;

	const dynamic = bodies.filter((b) => b.invMass > EPS).length;
	// Scale the opening stride to the ground that has to be covered. A stride fixed
	// in pixels silently caps how far the packing can travel: on a large mesh the
	// bodies simply run out of steps before they reach anything to collide with,
	// and the result looks like the constraints are binding when they aren't.
	let step =
		opts.pull ??
		Math.max(2, (radialSum(bodies, center.x, center.y) / Math.max(1, dynamic)) / 20);

	const cohesion = opts.cohesion ?? 0;

	for (let p = 0; p < maxPasses && step > 0.25; p++) {
		const before = radialSum(bodies, center.x, center.y);
		for (const b of bodies) {
			if (b.invMass < EPS) continue;
			const dx = center.x - b.x;
			const dy = center.y - b.y;
			const d = Math.hypot(dx, dy);
			if (d < EPS) continue;
			const s = Math.min(step, d);
			b.x += (dx / d) * s;
			b.y += (dy / d) * s;
		}

		// Draw each group toward its own centre of mass. Recomputed per pass, so a
		// clump that has started forming pulls the rest of its group in after it.
		if (cohesion > 0) {
			const centroids = groupCentroids(bodies);
			for (const b of bodies) {
				if (b.invMass < EPS || b.group === undefined) continue;
				const c = centroids.get(b.group);
				if (!c || c.n < 2) continue;
				const dx = c.x - b.x;
				const dy = c.y - b.y;
				const d = Math.hypot(dx, dy);
				if (d < EPS) continue;
				const s = Math.min(step * cohesion, d);
				b.x += (dx / d) * s;
				b.y += (dy / d) * s;
			}
		}

		for (let i = 0; i < iterations; i++) relax(bodies, lanes, opts);

		// The constraints gave back everything this stride took: the packing is as
		// tight as this stride can find. Halve it and probe for the smaller gaps —
		// which is what lets bodies trickle into gaps a coarse stride steps over.
		if (before - radialSum(bodies, center.x, center.y) < sleep) step /= 2;
	}

	// The pull leaves residual overlap the last pass hadn't finished projecting
	// out. Relax alone until it settles — no pull, so this can only improve.
	for (let i = 0; i < iterations * 8; i++) {
		if (relax(bodies, lanes, opts) < sleep) break;
	}
}
