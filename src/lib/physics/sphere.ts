// ── physics/sphere — globe placement ─────────────────────────────────────────
// Spreads bodies evenly over a sphere, then projects the sphere to the screen so
// it can be spun.
//
// This is `sunflower` one dimension up, and for the same reason: the golden angle
// is the most irrational turn there is, so successive bodies never fall into rows
// however many there are. On a plane that fills a disc; on a sphere — stepping
// height in equal increments while turning by the golden angle each time — it
// covers the surface, because equal bands of height on a sphere have equal area
// (Archimedes). Every body ends up with the same share of the globe.
//
// The sphere's radius has a closed form rather than a search: distance scales
// linearly with radius, so the tightest globe that fits is just
//
//     R = max over pairs of  (rᵢ + rⱼ + margin) / |uᵢ − uⱼ|
//
// over the unit directions — the single most crowded pair decides it, and no
// iteration is involved.
//
// A globe is deliberately NOT collision-free once projected: bodies bunch up at
// the limb and hide each other at the back. That is what a globe looks like, and
// the depth that `project` returns is how a renderer says so — nearer bodies draw
// larger and on top. Resolving those overlaps in 2D would flatten the thing back
// into a map.
//
// Pure: no Svelte, no dependencies, no knowledge of what a body stands for.
import { GOLDEN_ANGLE } from './sunflower.js';

export interface Vec3 {
	x: number;
	y: number;
	/** Toward the viewer. */
	z: number;
}

export interface SphereOpts {
	/** Clear space between two bodies, measured across the sphere's surface. */
	margin?: number;
}

export interface SpherePlacement {
	/** Unit direction per body, index-aligned with the input radii. Spin acts on
	 *  these; the radius only scales them. */
	dirs: Vec3[];
	/** The tightest sphere the bodies fit on. */
	radius: number;
}

/** The i-th of n evenly spread directions on a unit sphere.
 *
 *  Height steps uniformly from pole to pole while the bearing turns by a golden
 *  angle each step. Equal heights carve equal area on a sphere, so uniform height
 *  steps give every body an equal share — the spiral is what stops those shares
 *  from lining up into rows. */
export function fibonacciDir(i: number, n: number): Vec3 {
	// Offset by a half step so no body lands exactly on a pole, where every
	// bearing is the same point and the spiral would degenerate.
	// Steps from just below +1 to just above −1 across the n bodies.
	const y = n === 1 ? 0 : 1 - (2 * i + 1) / n;
	const r = Math.sqrt(Math.max(0, 1 - y * y));
	const t = i * GOLDEN_ANGLE;
	return { x: Math.cos(t) * r, y, z: Math.sin(t) * r };
}

/** The tightest sphere a set of unit directions fits on.
 *
 *  Split out of `packSphere` because it assumes NOTHING about where the
 *  directions came from — even spread, clustered caps, anything. That is what
 *  lets grouping change only the direction generator. */
export function solveRadius(dirs: Vec3[], radii: number[], margin = 0): number {
	// The most crowded pair sets the radius; every other pair then clears by more.
	let radius = 1;
	for (let i = 0; i < dirs.length; i++) {
		for (let j = i + 1; j < dirs.length; j++) {
			const dx = dirs[i].x - dirs[j].x;
			const dy = dirs[i].y - dirs[j].y;
			const dz = dirs[i].z - dirs[j].z;
			const unit = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (unit < 1e-9) continue;
			radius = Math.max(radius, (radii[i] + radii[j] + margin) / unit);
		}
	}
	return radius;
}

/** Spread bodies over the tightest sphere on which none of them overlap.
 *
 *  Deterministic and closed-form: no seed, no iteration, no way to fail to
 *  converge. */
export function packSphere(radii: number[], opts: SphereOpts = {}): SpherePlacement {
	const { margin = 0 } = opts;
	const n = radii.length;
	if (!n) return { dirs: [], radius: 1 };

	const dirs = radii.map((_, i) => fibonacciDir(i, n));
	if (n === 1) return { dirs, radius: Math.max(radii[0], 1) };

	return { dirs, radius: solveRadius(dirs, radii, margin) };
}

// ── Territories ─────────────────────────────────────────────────────────────
// Bodies that belong together, placed together — a globe divided into regions
// rather than evenly sown.
//
// `packSphere` cannot do this, and no amount of relaxation can either: getting
// same-group bodies adjacent needs a PERMUTATION of positions, and every
// intermediate state of a swap overlaps (`cluster.ts` records the same finding in
// 2D). Grouping is decided at the seed — by choosing which direction each body
// gets — so the fix is to swap the direction generator and keep everything else.

/** A region of the sphere: a spherical cap, given by where it points and how
 *  wide it opens. */
export interface Cap {
	/** Unit direction to the cap's centre. */
	center: Vec3;
	/** Half-angle, radians. The cap covers everything within this of `center`. */
	alpha: number;
}

export interface ClusterOpts extends SphereOpts {
	/** Share of the sphere's total area the regions may occupy between them.
	 *  The REMAINDER is the empty border that makes a region read as a region, so
	 *  this is the single most important number here — push it up and the regions
	 *  smear into each other at the limb. */
	fraction?: number;
	/** Floor and ceiling on a cap's half-angle, radians. The floor stops a
	 *  one-member region collapsing to a point; the ceiling protects the border. */
	minAlpha?: number;
	maxAlpha?: number;
	/** Where each region points. Defaults to evenly spaced around the equator. */
	centers?: Record<string, Vec3>;
	/** Bearing of the first default centre, radians. */
	phase?: number;
}

export interface ClusterPlacement extends SpherePlacement {
	/** The region each group ended up occupying, in first-appearance order.
	 *  Callers need these to label or tint a territory. */
	caps: Map<string, Cap>;
}

/** The i-th of n directions spread evenly INSIDE a cap of half-angle `alpha`
 *  about `+z`.
 *
 *  `fibonacciDir` with its height range narrowed: stepping the cosine uniformly
 *  from the cap's edge to its centre carves equal area for the same Archimedes
 *  reason, so every member gets an equal share of its own territory, and the
 *  golden angle still keeps them out of rows. */
export function capDir(i: number, n: number, alpha: number): Vec3 {
	const cosA = Math.cos(alpha);
	// Half-step offset so no body lands exactly on the cap's axis.
	const z = n <= 1 ? 1 : 1 - ((2 * i + 1) / (2 * n)) * (1 - cosA);
	const r = Math.sqrt(Math.max(0, 1 - z * z));
	const t = i * GOLDEN_ANGLE;
	return { x: Math.cos(t) * r, y: Math.sin(t) * r, z };
}

/** Rotate a point as if `+z` had been turned to point along `center`.
 *
 *  Rodrigues about the axis `+z × center`. Used to carry a cap built about `+z`
 *  onto wherever its region actually sits. */
export function alignZ(center: Vec3, p: Vec3): Vec3 {
	// v = ẑ × c
	const vx = -center.y;
	const vy = center.x;
	const s2 = vx * vx + vy * vy;
	if (s2 < 1e-18) {
		// Already on the axis. Antipodal needs a half turn; same direction is a
		// no-op. Either way there is no unique rotation axis to build from.
		return center.z >= 0 ? p : { x: p.x, y: -p.y, z: -p.z };
	}
	const k = (1 - center.z) / s2;
	// v × p
	const c1x = vy * p.z;
	const c1y = -vx * p.z;
	const c1z = vx * p.y - vy * p.x;
	// v × (v × p)
	const c2x = vy * c1z;
	const c2y = -vx * c1z;
	const c2z = vx * c1y - vy * c1x;
	return {
		x: p.x + c1x + c2x * k,
		y: p.y + c1y + c2y * k,
		z: p.z + c1z + c2z * k,
	};
}

/** `count` centres spaced evenly around the equator.
 *
 *  The equator rather than anywhere else because `spin` yaws about Y: regions on
 *  the equator become a CAROUSEL, each turning to face the viewer in turn, and
 *  the yaw that faces region k is exactly `-phase + 2πk/count`. That closed form
 *  is what lets a script say "now look at this one" without solving anything. */
export function capRing(count: number, phase = 0): Vec3[] {
	return Array.from({ length: count }, (_, k) => {
		const a = phase - (k * 2 * Math.PI) / count;
		return { x: Math.sin(a), y: 0, z: Math.cos(a) };
	});
}

/** The yaw that turns region `k` of a `capRing` to face the viewer. */
export function capRingYaw(k: number, count: number, phase = 0): number {
	return -phase + (k * 2 * Math.PI) / count;
}

/** Spread bodies over a sphere so that bodies sharing a group land together.
 *
 *  Same closed-form radius as `packSphere` — only the directions differ. Each
 *  group gets a cap sized by its share of the population, so a bigger region is
 *  visibly bigger without becoming denser. */
export function packSphereClusters(
	radii: number[],
	groups: string[],
	opts: ClusterOpts = {},
): ClusterPlacement {
	const {
		margin = 0,
		fraction = 0.5,
		minAlpha = (24 * Math.PI) / 180,
		maxAlpha = (48 * Math.PI) / 180,
		centers,
		phase = 0,
	} = opts;
	const n = radii.length;
	if (!n) return { dirs: [], radius: 1, caps: new Map() };

	// First-appearance order, so the caller controls which region sits where by
	// the order it hands bodies over.
	const order: string[] = [];
	const members = new Map<string, number[]>();
	groups.forEach((g, i) => {
		if (!members.has(g)) {
			members.set(g, []);
			order.push(g);
		}
		members.get(g)!.push(i);
	});

	const ring = capRing(order.length, phase);
	const caps = new Map<string, Cap>();
	const dirs: Vec3[] = new Array(n);

	order.forEach((g, k) => {
		const idx = members.get(g)!;
		// Equal density across regions: cap area ∝ member count. A cap of
		// half-angle α covers 2π(1−cos α) of the sphere's 4π.
		const share = (fraction * idx.length) / n;
		const raw = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * share)));
		const alpha = Math.max(minAlpha, Math.min(maxAlpha, raw));
		const center = centers?.[g] ?? ring[k];
		caps.set(g, { center, alpha });
		idx.forEach((bodyIndex, j) => {
			dirs[bodyIndex] = alignZ(center, capDir(j, idx.length, alpha));
		});
	});

	if (n === 1) return { dirs, radius: Math.max(radii[0], 1), caps };
	return { dirs, radius: solveRadius(dirs, radii, margin), caps };
}

/** `count` directions filling a cap — for the anonymous mass that shares a
 *  region with the bodies that got named. Separate from `packSphereClusters`
 *  because this lot must never enter the radius solve: they carry no footprint,
 *  and 600² pairs on every re-derive would cost more than the whole scene. */
export function capField(count: number, cap: Cap, widen = 0): Vec3[] {
	return Array.from({ length: count }, (_, i) =>
		alignZ(cap.center, capDir(i, count, cap.alpha + widen)),
	);
}

// ── Standing on the surface ─────────────────────────────────────────────────
// Everything above places bodies ON the sphere and projects them to points. A
// body that is a SOLID — a piece standing on the globe rather than a marker
// lying on it — needs one thing more: which way is up, and which way is along
// the surface, AT ITS OWN SPOT. Both vary across the globe and change every
// spin, and neither is knowable from the projected point alone.

/** Project an arbitrary point NEAR the globe — one that need not sit on it.
 *
 *  Every point in space is some direction at some distance, and `project`
 *  already takes exactly that pair, so this is a change of coordinates rather
 *  than a second projection. It is what lets a caller build in ordinary 3D
 *  around the sphere (a corner of a roof, a point part-way up a mast) instead of
 *  having to express everything as a direction plus a lift. */
export function projectPoint(q: Vec3, radius: number, viewDistance = 2.6): Projection {
	const m = Math.hypot(q.x, q.y, q.z);
	if (m < 1e-9) return { x: 0, y: 0, scale: 1, depth: 0, front: true };
	return project(
		{ x: q.x / m, y: q.y / m, z: q.z / m },
		radius,
		viewDistance,
		m / radius - 1,
	);
}

/** The local frame at a point on the globe, ready for a renderer that knows
 *  nothing about spheres.
 *
 *  Two different quantities, deliberately kept apart:
 *   · `e`/`n`/`u` are SCREEN displacements — how far one `step` along each axis
 *     moves the projected point. POSITIONS come from these.
 *   · `axis` holds the same three as unit directions in world space, where +z is
 *     toward the viewer and +x/+y are screen right/down. ORIENTATION comes from
 *     these: which faces are turned toward us, and how lit they are.
 *
 *  Mixing them would be wrong — one is scaled by `step` and bent by perspective,
 *  the other is neither — so a caller places a vertex with `e`/`n`/`u` and
 *  judges a normal with `axis`. */
export interface TangentFrame {
	/** East along the surface — perpendicular to the globe's axis. */
	e: { x: number; y: number };
	/** North along the surface, completing a right-handed frame with `u`. */
	n: { x: number; y: number };
	/** Up off the surface. Radial unless the frame is leaned. */
	u: { x: number; y: number };
	/** The three axes as unit world directions. */
	axis: { e: Vec3; n: Vec3; u: Vec3 };
	/** How much wider one `step` of surface reads one `step` HIGHER up.
	 *
	 *  The frame is otherwise affine, and an affine frame has no perspective in
	 *  it — the top of a solid would project exactly as wide as its base. That is
	 *  wrong everywhere and most wrong at the sub-viewer point, where a piece is
	 *  seen from directly overhead: `u` collapses to nothing there, and this ratio
	 *  is the ONLY thing left saying the roof is nearer than the floor. Scale a
	 *  vertex's tangential offsets by it, in proportion to its height. */
	grow: number;
}

/** The tangent frame at an ALREADY-SPUN direction.
 *
 *  Measured rather than differentiated: each axis is projected as an actual
 *  displaced point, `step` away. That keeps the frame exact at the size things
 *  are actually drawn at — a true derivative is only exact in the limit, and
 *  under perspective a solid a whole node-radius tall does not obey it. So pass
 *  the size of the thing being built as `step`, and its geometry lands where the
 *  projection would have put it.
 *
 *  `lean` tips the frame back toward the viewer, in radians, and it is the one
 *  dishonest number here. It exists because a radial frame has a DEGENERATE
 *  POINT: a solid at the centre of the visible disc stands straight at the
 *  camera, `u` projects to nothing, and you see its roof and no more. That is
 *  geometrically correct and useless — it is exactly where the eye is, and a
 *  house and a factory look identical from directly above.
 *
 *  It is applied in CAMERA space (a rotation about screen-right), and that
 *  choice is the whole point: a lean that varied with where the piece sits —
 *  strong at the centre, absent at the limb — would be a rotation that changes
 *  as the globe turns, so every piece would visibly stand up and lie back as it
 *  swept past. A constant camera-space offset adds no motion at all. Under a
 *  spin the pieces just turn with the globe, exactly as they did before. */
export interface FrameOpts {
	viewDistance?: number;
	/** The size of the thing being built, in the globe's own px. */
	step?: number;
	/** Radians the frame tips back toward the viewer. */
	lean?: number;
	/** How far off the shell the frame sits, in globe radii — the ground under
	 *  it, when the globe has terrain. Without it a piece is framed at sea level
	 *  and stands in the air above its own hill. */
	lift?: number;
	/** Radians the frame turns about its OWN up axis — which way the building
	 *  faces, not where it stands.
	 *
	 *  Distinct from moving `d`, and the distinction is the whole point: moving
	 *  the direction walks the piece around the globe, so it turns and drifts off
	 *  centre and foreshortens all at once. This holds the piece where it is and
	 *  spins it in place, which is the only way to compare two buildings from the
	 *  same bearing — the review the catalogue is authored against. */
	bearing?: number;
}

export function tangentFrame(d: Vec3, radius: number, opts: FrameOpts = {}): TangentFrame {
	const { viewDistance = 2.6, step = 1, lean = 0, lift = 0, bearing = 0 } = opts;
	// East: along the surface, square to the globe's axis. At the poles every
	// bearing is the same point and there is no east — any fixed one will do.
	let ex = d.z;
	let ez = -d.x;
	let len = Math.hypot(ex, ez);
	if (len < 1e-9) {
		ex = 1;
		ez = 0;
		len = 1;
	}
	let east: Vec3 = { x: ex / len, y: 0, z: ez / len };
	// north = u × e, which makes (e, n, u) right-handed — so a face wound
	// counter-clockwise seen from outside has an outward normal under the usual
	// cross product, and a renderer can cull and shade without a special case.
	let north: Vec3 = {
		x: d.y * east.z - d.z * east.y,
		y: d.z * east.x - d.x * east.z,
		z: d.x * east.y - d.y * east.x,
	};
	let up: Vec3 = d;
	if (bearing) {
		// In the tangent plane, so `up` is untouched and the frame stays
		// orthonormal — a turn about the vertical cannot tip the building over.
		// Applied BEFORE the lean: bearing is a property of the piece and lean is
		// a property of the camera, and swapping them makes the turn wobble,
		// because the axis would then be the tipped up rather than the real one.
		const c = Math.cos(bearing);
		const s = Math.sin(bearing);
		const e0 = east;
		east = { x: e0.x * c + north.x * s, y: e0.y * c + north.y * s, z: e0.z * c + north.z * s };
		north = { x: north.x * c - e0.x * s, y: north.y * c - e0.y * s, z: north.z * c - e0.z * s };
	}
	if (lean) {
		// About +x — screen right — carrying "toward the viewer" up the screen, so
		// a piece is seen from slightly above and in front rather than plan-on.
		// Rotating all three axes together keeps the frame orthonormal, which is
		// what keeps the cross-product normals honest.
		const c = Math.cos(lean);
		const s = Math.sin(lean);
		const tip = (v: Vec3): Vec3 => ({ x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c });
		east = tip(east);
		north = tip(north);
		up = tip(up);
	}
	// The point itself, in world space — everything below is measured from it.
	const R = radius * (1 + lift);
	const at: Vec3 = { x: d.x * R, y: d.y * R, z: d.z * R };
	const base = projectPoint(at, radius, viewDistance);
	const along = (axis: Vec3) => {
		const p = projectPoint(
			{ x: at.x + axis.x * step, y: at.y + axis.y * step, z: at.z + axis.z * step },
			radius,
			viewDistance,
		);
		return { x: p.x - base.x, y: p.y - base.y, scale: p.scale };
	};
	const u = along(up);
	return {
		e: along(east),
		n: along(north),
		u: { x: u.x, y: u.y },
		axis: { e: east, n: north, u: up },
		grow: u.scale / base.scale,
	};
}

/** The spin that turns a direction to face the viewer head-on.
 *
 *  The inverse of `spin`, solved rather than searched. Wanting `spin(d, yaw,
 *  pitch)` to land on +z is two equations, and yaw-then-pitch decouples them:
 *  yaw only has to cancel the direction's x, and once it has, the point sits in
 *  the y/z plane at distance `hypot(x, z)` from the axis, which is exactly the
 *  lever pitch works on. So each falls out of one `atan2` and there is no
 *  iteration, no ambiguity, and no pose the globe cannot reach.
 *
 *  Note what it does NOT return: a roll. There isn't one — `spin` cannot roll the
 *  globe, which is the property that keeps north up however the operator drags,
 *  and the reason "face this node" has exactly one answer instead of a family. */
export function faceYawPitch(d: Vec3): { yaw: number; pitch: number } {
	// Distance from the globe's axis. After the yaw below this is the whole of the
	// point's z, which is what makes the pitch term this simple.
	const r = Math.hypot(d.x, d.z);
	// Degenerate at the poles: every yaw puts a pole on the axis, so any is right.
	// Keeping the current yaw would be kinder, but this is pure — the caller
	// animates along the shortest arc anyway, so 0 costs nothing.
	if (r < 1e-9) return { yaw: 0, pitch: d.y >= 0 ? Math.PI / 2 : -Math.PI / 2 };
	return { yaw: Math.atan2(-d.x, d.z), pitch: Math.atan2(d.y, r) };
}

/** The equivalent of `b` nearest to `a`, going the short way round.
 *
 *  Yaw is an angle on a circle, so 350° and 10° are 20° apart, not 340°. Tweening
 *  the raw numbers takes the long way round — the globe unwinds most of a full
 *  turn to reach a neighbour a few degrees away, which reads as a bug even though
 *  every frame of it is correct. */
export function shortestAngle(a: number, b: number): number {
	const TAU = Math.PI * 2;
	let delta = (b - a) % TAU;
	if (delta > Math.PI) delta -= TAU;
	if (delta < -Math.PI) delta += TAU;
	return a + delta;
}

/** Spin a direction: `yaw` turns the globe about its axis, `pitch` tips it
 *  toward or away from the viewer. Radians. Yaw first, so pitch stays relative to
 *  the viewer and the globe never rolls — the same way a real one is handled. */
export function spin(d: Vec3, yaw: number, pitch: number): Vec3 {
	const cy = Math.cos(yaw);
	const sy = Math.sin(yaw);
	const x1 = d.x * cy + d.z * sy;
	const z1 = -d.x * sy + d.z * cy;
	const cp = Math.cos(pitch);
	const sp = Math.sin(pitch);
	return { x: x1, y: d.y * cp - z1 * sp, z: d.y * sp + z1 * cp };
}

export interface Projection {
	/** Screen offset from the globe's centre. */
	x: number;
	y: number;
	/** Size multiplier — nearer bodies are bigger. Also the right factor for a
	 *  renderer to fade or thin distant chrome by. */
	scale: number;
	/** Toward the viewer. Sorting bodies by this ascending and drawing in that
	 *  order is the whole of hidden-surface removal for a globe. */
	depth: number;
	/** False when the body is round the back. Callers may still draw it — dimmed,
	 *  or not at all; that is a design choice, not a geometric one. */
	front: boolean;
}

/** Project a spun point on the globe to the screen.
 *
 *  Perspective rather than orthographic, because the near-far size difference is
 *  most of what reads as roundness — flat scaling looks like a disc of dots.
 *  `viewDistance` is in globe radii: smaller exaggerates the effect. Below ~1.2
 *  the camera is inside the globe, so it is clamped.
 *
 *  `lift` raises the point OFF the shell, in globe radii, without moving the
 *  camera — the camera stays exactly where `radius` put it. That separation is
 *  the whole of "3D on the globe": anything standing on the surface (a wall, a
 *  tower, an orbit) is the same unit direction projected at a bigger radius, so
 *  it shares the bodies' vanishing point instead of being faked in screen space.
 *  Passing it into `radius` instead would dolly the camera out with the wall and
 *  the lift would cancel itself. */
export function project(p: Vec3, radius: number, viewDistance = 2.6, lift = 0): Projection {
	const d = Math.max(1.2, viewDistance) * radius;
	const r = radius * (1 + lift);
	// Clamp the denominator: a tall enough lift puts a near point level with or
	// past the camera, where the perspective divide blows up and then flips the
	// point behind the viewer. Capping it pins the geometry to a huge-but-finite
	// scale rather than turning it inside out.
	const scale = d / Math.max(d * 0.05, d - p.z * r);
	return {
		x: p.x * r * scale,
		y: p.y * r * scale,
		scale,
		// Depth and facing belong to the DIRECTION, not to how high above the
		// surface the point sits — a wall is in front of the globe exactly when
		// the ground it stands on is.
		depth: p.z,
		front: p.z >= 0,
	};
}
