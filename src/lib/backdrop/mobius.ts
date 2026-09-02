// ── mobius — a sequence on a Möbius strip ───────────────────────────────────
//
// Recovered from showcase/src/lib/roadmap/roadmap-mobius.ts, which moved out to
// the OSS repo in 7c746ae57. The maths is unchanged; only the home is new. It
// is pure — no Svelte, no DOM — so the backdrop can use the same projection the
// roadmap used, rather than a second, subtly different one drawn by eye.
//
// The same ordered reading as the ribbon, folded onto a surface with one side.
//
// ── Why this is more than a shape ─────────────────────────────────────────
// A Möbius strip's boundary is a SINGLE closed curve, and walking it takes two
// laps: after one circuit you are back at the same bearing but on the opposite
// edge, and only after the second do you return to where you started. Laying a
// roadmap along that edge is therefore not decoration — it is a claim about the
// work, that a plan comes back past where it has been before it closes, one
// turn further on. A ring would say the opposite (that you return exactly), and
// a line would say you never come back at all.
//
// ── The parameterisation ──────────────────────────────────────────────────
// The standard surface, with `u` around and `v` across:
//
//     x = (R + v·cos(u/2))·cos(u)
//     y = (R + v·cos(u/2))·sin(u)
//     z =      v·sin(u/2)
//
// The half-angle `u/2` is the whole trick: after u advances by 2π the twist term
// has advanced by only π, so `cos(u/2)` has flipped sign and the point that was
// on the outer edge is now on the inner one. Hold `v` at the band's half-width
// and run `u` from 0 to 4π and you trace that single boundary curve exactly
// once.
//
// Pure: no Svelte, no DOM. It owns its own rotation and projection rather than
// borrowing `physics/sphere`, because those are built for points on a unit
// sphere and a Möbius edge is not on one — reusing them would mean scaling into
// and back out of a space this curve does not live in.

export interface MobiusOptions {
	/** Radius of the strip's centre line. */
	radius?: number;
	/** Half-width of the band. Larger twists more visibly; past ~0.45·radius the
	 *  band self-intersects on screen and stops reading. */
	band?: number;
	/** Rotation about the vertical axis, degrees. */
	yaw?: number;
	/** Tilt toward the viewer, degrees. Near 0 the strip is edge-on and unreadable
	 *  — the default leans it back so the twist is visible. */
	pitch?: number;
	/** Camera distance, in multiples of `radius`. Lower is a stronger perspective. */
	viewDistance?: number;
	/** Where on the edge the first stage sits, degrees of `u`. */
	startAngle?: number;
	/** Samples used to draw the band. Purely cosmetic. */
	segments?: number;
	/** Cross-band rungs drawn. These are what make the twist legible. */
	rungs?: number;
}

export interface MobiusPlacement {
	id: string;
	index: number;
	/** Projected position, world units. */
	x: number;
	y: number;
	/** Depth before projection — negative is away from the viewer. */
	z: number;
	/** 0 = furthest away, 1 = nearest. Drives fade, blur and paint order. */
	depth: number;
	/** Perspective scale at this point: >1 nearer than the centre, <1 further. */
	scale: number;
	/** Position along the edge, radians. Runs 0…4π for one full traversal. */
	u: number;
	/** Which lap — 0 on the first circuit, 1 on the second, i.e. the far edge. */
	lap: 0 | 1;
}

export interface MobiusStroke {
	d: string;
	/** Mean depth of the stroke, 0…1. */
	depth: number;
}

export interface MobiusLayout {
	points: MobiusPlacement[];
	/**
	 * The band's SURFACE, as quads between consecutive cross-sections.
	 *
	 * The edge and the rungs are both strokes — they describe the band's outline
	 * and its ribs, but there is nothing between them to paint. Filling the
	 * surface needs closed geometry, so it is emitted separately rather than
	 * inferred from the rung strings, which are already flattened to path `d`
	 * text by the time a caller sees them.
	 *
	 * Depth-sorted like the edge, so the far half of the band can be drawn
	 * before the near half and genuinely pass behind it.
	 */
	facets: MobiusStroke[];
	/** The single boundary curve, in depth-sorted chunks. */
	edge: MobiusStroke[];
	/** Cross-sections. Drawing these is what stops the projection reading as a
	 *  flat pretzel. */
	rungs: MobiusStroke[];
	extent: { minX: number; minY: number; maxX: number; maxY: number };
}

const DEFAULTS: Required<MobiusOptions> = {
	radius: 420,
	band: 150,
	yaw: -28,
	pitch: 58,
	viewDistance: 3.4,
	startAngle: -90,
	segments: 240,
	rungs: 48,
};

interface Vec3 {
	x: number;
	y: number;
	z: number;
}

/** Surface point at (u, v). `v` = ±band gives the two edges — which are the same
 *  curve, 2π apart in u. */
function surface(u: number, v: number, radius: number): Vec3 {
	const half = Math.cos(u / 2);
	const r = radius + v * half;
	return { x: r * Math.cos(u), y: r * Math.sin(u), z: v * Math.sin(u / 2) };
}

/** Yaw about the vertical, then pitch toward the viewer. Order matters: pitching
 *  first would tilt the axis the yaw then spins about, and the strip would wobble
 *  rather than turn. */
function rotate(p: Vec3, yawDeg: number, pitchDeg: number): Vec3 {
	const yaw = (yawDeg * Math.PI) / 180;
	const pitch = (pitchDeg * Math.PI) / 180;
	const cy = Math.cos(yaw);
	const sy = Math.sin(yaw);
	const x1 = p.x * cy + p.z * sy;
	const z1 = -p.x * sy + p.z * cy;
	const cp = Math.cos(pitch);
	const sp = Math.sin(pitch);
	return { x: x1, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
}

/** Perspective divide about a camera `viewDistance` radii away. */
function project(p: Vec3, radius: number, viewDistance: number) {
	const k = Math.max(1.2, viewDistance) * radius;
	// Clamped so a point that swings behind the camera cannot invert the sign of
	// the scale and turn the far half of the strip inside out.
	const s = k / Math.max(k * 0.25, k - p.z);
	return { x: p.x * s, y: p.y * s, s };
}

/**
 * Place a sequence along the strip's single boundary curve and build the band
 * around it.
 *
 * Stages are spread over the FULL 4π traversal, so a roadmap of n stages puts
 * n/2 on each edge and the second half runs back past the first — the property
 * that makes the shape mean something here.
 */
export function mobiusLayout(ids: string[], opts: MobiusOptions = {}): MobiusLayout {
	const o = { ...DEFAULTS, ...opts };
	const start = (o.startAngle * Math.PI) / 180;
	const TAU2 = Math.PI * 4;

	const raw = ids.map((id, index) => {
		// Open spacing (i/n rather than i/(n-1)): the curve is closed, so the last
		// stage must not land on top of the first.
		const u = start + (index / Math.max(1, ids.length)) * TAU2;
		const p = rotate(surface(u, o.band, o.radius), o.yaw, o.pitch);
		const pr = project(p, o.radius, o.viewDistance);
		return { id, index, u, world: p, proj: pr };
	});

	// Depth is normalised across the range the SURFACE actually spans, not the
	// range the nodes happen to sit in.
	//
	// Normalising against the nodes is the obvious thing and it is wrong twice
	// over: a handful of stages can easily miss the extremes, which stretches
	// their fade to full contrast over a shallow slice; and the band is then
	// shaded against a range it does not share, so rungs at the true back come out
	// with depth < 0 and vanish while nodes beside them read as mid-distance. The
	// two have to be measured against the same ruler.
	let zMin = Infinity;
	let zMax = -Infinity;
	for (let i = 0; i <= o.segments; i++) {
		const u = start + (i / o.segments) * TAU2;
		for (const v of [-o.band, o.band]) {
			const z = rotate(surface(u, v, o.radius), o.yaw, o.pitch).z;
			zMin = Math.min(zMin, z);
			zMax = Math.max(zMax, z);
		}
	}
	const span = zMax - zMin || 1;

	const points: MobiusPlacement[] = raw.map((p) => ({
		id: p.id,
		index: p.index,
		x: p.proj.x,
		y: p.proj.y,
		z: p.world.z,
		depth: (p.world.z - zMin) / span,
		scale: p.proj.s,
		u: p.u,
		// Past u = 2π the twist has flipped and the curve is running back along the
		// opposite edge.
		lap: ((p.u - start) % TAU2) >= Math.PI * 2 ? 1 : 0,
	}));

	// ── The band ──────────────────────────────────────────────────────────────
	const edge: MobiusStroke[] = [];
	const CHUNK = 6;
	let run: { x: number; y: number }[] = [];
	let runZ: number[] = [];
	const flush = () => {
		if (run.length > 1) {
			edge.push({
				d: run.map((q, i) => `${i ? 'L' : 'M'}${fx(q.x)},${fx(q.y)}`).join(''),
				depth: (runZ.reduce((a, b) => a + b, 0) / runZ.length - zMin) / span,
			});
		}
		// Carry the last point into the next chunk so the runs join instead of
		// leaving a gap at every seam.
		run = run.length ? [run[run.length - 1]] : [];
		runZ = runZ.length ? [runZ[runZ.length - 1]] : [];
	};

	for (let i = 0; i <= o.segments; i++) {
		const u = start + (i / o.segments) * TAU2;
		const p = rotate(surface(u, o.band, o.radius), o.yaw, o.pitch);
		const pr = project(p, o.radius, o.viewDistance);
		run.push({ x: pr.x, y: pr.y });
		runZ.push(p.z);
		if (run.length > CHUNK) flush();
	}
	flush();

	const rungs: MobiusStroke[] = [];
	for (let i = 0; i < o.rungs; i++) {
		const u = start + (i / o.rungs) * Math.PI * 2;
		const a = rotate(surface(u, -o.band, o.radius), o.yaw, o.pitch);
		const b = rotate(surface(u, o.band, o.radius), o.yaw, o.pitch);
		const pa = project(a, o.radius, o.viewDistance);
		const pb = project(b, o.radius, o.viewDistance);
		rungs.push({
			d: `M${fx(pa.x)},${fx(pa.y)} L${fx(pb.x)},${fx(pb.y)}`,
			depth: ((a.z + b.z) / 2 - zMin) / span,
		});
	}

	// ── The surface ───────────────────────────────────────────────────────────
	// One quad per gap between cross-sections, walked over the same 2π the rungs
	// use so the facets line up with the ribs rather than straddling them.
	const facets: MobiusStroke[] = [];
	for (let i = 0; i < o.rungs; i++) {
		const u0 = start + (i / o.rungs) * Math.PI * 2;
		const u1 = start + ((i + 1) / o.rungs) * Math.PI * 2;
		const corners = [
			rotate(surface(u0, -o.band, o.radius), o.yaw, o.pitch),
			rotate(surface(u0, o.band, o.radius), o.yaw, o.pitch),
			rotate(surface(u1, o.band, o.radius), o.yaw, o.pitch),
			rotate(surface(u1, -o.band, o.radius), o.yaw, o.pitch),
		];
		const pts = corners.map((c) => project(c, o.radius, o.viewDistance));
		facets.push({
			d: `M${fx(pts[0].x)},${fx(pts[0].y)}L${fx(pts[1].x)},${fx(pts[1].y)}L${fx(pts[2].x)},${fx(pts[2].y)}L${fx(pts[3].x)},${fx(pts[3].y)}Z`,
			depth: (corners.reduce((sum, c) => sum + c.z, 0) / 4 - zMin) / span,
		});
	}
	// Far facets first, so the near half of the band paints over the far half.
	facets.sort((a, b) => a.depth - b.depth);

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i <= o.segments; i++) {
		const u = start + (i / o.segments) * TAU2;
		const pr = project(rotate(surface(u, o.band, o.radius), o.yaw, o.pitch), o.radius, o.viewDistance);
		minX = Math.min(minX, pr.x);
		maxX = Math.max(maxX, pr.x);
		minY = Math.min(minY, pr.y);
		maxY = Math.max(maxY, pr.y);
	}
	if (!Number.isFinite(minX)) {
		minX = minY = -o.radius;
		maxX = maxY = o.radius;
	}

	return { points, edge, rungs, facets, extent: { minX, minY, maxX, maxY } };
}

function fx(n: number): number {
	return Math.round(n * 10) / 10;
}
