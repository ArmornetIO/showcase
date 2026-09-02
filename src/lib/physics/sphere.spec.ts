import { describe, it, expect } from 'vitest';
import {
	packSphere,
	packSphereClusters,
	fibonacciDir,
	capDir,
	capField,
	capRing,
	capRingYaw,
	alignZ,
	spin,
	project,
	projectPoint,
	tangentFrame,
	faceYawPitch,
	shortestAngle,
	type Vec3
} from './sphere.js';

const len = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);

describe('fibonacciDir', () => {
	it('returns unit directions', () => {
		for (const i of [0, 1, 7, 29]) expect(len(fibonacciDir(i, 30))).toBeCloseTo(1, 6);
	});

	it('never lands exactly on a pole, where the spiral would degenerate', () => {
		for (const n of [1, 2, 12, 50])
			for (let i = 0; i < n; i++) expect(Math.abs(fibonacciDir(i, n).y)).toBeLessThan(1);
	});

	it('spreads over the whole sphere, not one band', () => {
		const ys = Array.from({ length: 50 }, (_, i) => fibonacciDir(i, 50).y);
		expect(Math.min(...ys)).toBeLessThan(-0.9);
		expect(Math.max(...ys)).toBeGreaterThan(0.9);
	});

	it('puts a single body on the equator', () => {
		expect(fibonacciDir(0, 1).y).toBe(0);
	});
});

describe('packSphere', () => {
	it('never overlaps, at any mesh size', () => {
		for (const n of [2, 3, 12, 30, 50]) {
			const radii = Array(n).fill(68.6);
			const { dirs, radius } = packSphere(radii, { margin: 18 });
			let worst = Infinity;
			for (let i = 0; i < n; i++)
				for (let j = i + 1; j < n; j++) {
					const d = Math.hypot(
						(dirs[i].x - dirs[j].x) * radius,
						(dirs[i].y - dirs[j].y) * radius,
						(dirs[i].z - dirs[j].z) * radius,
					);
					worst = Math.min(worst, d - radii[i] - radii[j]);
				}
			expect(worst, `n=${n}`).toBeGreaterThanOrEqual(17.99);
		}
	});

	it('never overlaps with mixed sizes', () => {
		const radii = [146, 68.6, 80.6, 44, 68.6, 146, 68.6, 80.6];
		const { dirs, radius } = packSphere(radii, { margin: 18 });
		for (let i = 0; i < radii.length; i++)
			for (let j = i + 1; j < radii.length; j++) {
				const d = Math.hypot(
					(dirs[i].x - dirs[j].x) * radius,
					(dirs[i].y - dirs[j].y) * radius,
					(dirs[i].z - dirs[j].z) * radius,
				);
				expect(d).toBeGreaterThanOrEqual(radii[i] + radii[j] + 18 - 0.01);
			}
	});

	it('is set by the most crowded pair — the tightest globe that fits', () => {
		// Shrinking it at all must break something, or it wasn't tight.
		const radii = Array(20).fill(68.6);
		const { dirs, radius } = packSphere(radii, { margin: 18 });
		const tight = radius * 0.98;
		let anyOverlap = false;
		for (let i = 0; i < 20 && !anyOverlap; i++)
			for (let j = i + 1; j < 20; j++) {
				const d = Math.hypot(
					(dirs[i].x - dirs[j].x) * tight,
					(dirs[i].y - dirs[j].y) * tight,
					(dirs[i].z - dirs[j].z) * tight,
				);
				if (d < radii[i] + radii[j] + 18) { anyOverlap = true; break; }
			}
		expect(anyOverlap).toBe(true);
	});

	it('grows with √n — a globe has surface to spare', () => {
		const r = (n: number) => packSphere(Array(n).fill(68.6), { margin: 18 }).radius;
		expect(r(48) / r(12)).toBeLessThan(2.6);
	});

	it('is deterministic', () => {
		const key = () =>
			packSphere(Array(20).fill(68.6), { margin: 18 })
				.dirs.map((d) => `${d.x.toFixed(4)},${d.y.toFixed(4)},${d.z.toFixed(4)}`)
				.join(' ');
		expect(key()).toBe(key());
	});

	it('survives an empty mesh', () => {
		expect(packSphere([]).dirs).toEqual([]);
	});
});

describe('spin', () => {
	it('preserves length — a spin cannot resize the globe', () => {
		const d = fibonacciDir(5, 20);
		expect(len(spin(d, 1.1, 0.4))).toBeCloseTo(1, 6);
	});

	it('does nothing at zero', () => {
		const d = fibonacciDir(5, 20);
		const s = spin(d, 0, 0);
		expect(s.x).toBeCloseTo(d.x, 9);
		expect(s.y).toBeCloseTo(d.y, 9);
		expect(s.z).toBeCloseTo(d.z, 9);
	});

	it('yaw turns about the vertical — height is untouched', () => {
		const d = { x: 1, y: 0.5, z: 0 };
		expect(spin(d, 0.7, 0).y).toBeCloseTo(0.5, 9);
	});

	it('a full turn returns where it started', () => {
		const d = fibonacciDir(3, 9);
		const s = spin(d, Math.PI * 2, 0);
		expect(s.x).toBeCloseTo(d.x, 6);
		expect(s.z).toBeCloseTo(d.z, 6);
	});

	it('brings the back round to the front', () => {
		const back = { x: 0, y: 0, z: -1 };
		expect(spin(back, Math.PI, 0).z).toBeCloseTo(1, 6);
	});
});

/** Everything in this module takes UNIT directions; a test that hand-writes a
 *  vector has to say so, or it is measuring its own typo. */
const unit = (v: Vec3): Vec3 => {
	const m = Math.hypot(v.x, v.y, v.z);
	return { x: v.x / m, y: v.y / m, z: v.z / m };
};

describe('project', () => {
	it('draws nearer bodies bigger', () => {
		const near = project({ x: 0, y: 0, z: 1 }, 100);
		const far = project({ x: 0, y: 0, z: -1 }, 100);
		expect(near.scale).toBeGreaterThan(far.scale);
	});

	it('reports which face a body is on', () => {
		expect(project({ x: 0, y: 0, z: 1 }, 100).front).toBe(true);
		expect(project({ x: 0, y: 0, z: -1 }, 100).front).toBe(false);
	});

	it('gives depth that sorts back-to-front', () => {
		const pts = [1, -1, 0.5].map((z) => project({ x: 0, y: 0, z }, 100));
		const sorted = [...pts].sort((a, b) => a.depth - b.depth);
		expect(sorted.map((p) => p.depth)).toEqual([-1, 0.5, 1]);
	});

	it('keeps the camera outside the globe however close it is asked to go', () => {
		// A view distance inside the sphere would invert or explode the projection.
		const p = project({ x: 0, y: 0, z: 1 }, 100, 0.1);
		expect(Number.isFinite(p.scale)).toBe(true);
		expect(p.scale).toBeGreaterThan(0);
	});

	it('leaves the centre of the globe at the centre of the view', () => {
		const p = project({ x: 0, y: 0, z: 0 }, 100);
		expect(p.x).toBe(0);
		expect(p.y).toBe(0);
	});

	it('lifts a point off the shell without moving the camera', () => {
		// The lift has to be a lift, not a zoom. Passing it through `radius` instead
		// would carry the camera out with it (viewDistance is in globe radii), and
		// the result is EXACTLY a uniform scale-up of the whole scene — no extra
		// parallax anywhere, which is the one thing a wall standing up needs.
		//
		// So: on the limb, where nothing is nearer the eye, a lift is worth exactly
		// its own factor and matches the zoom. Toward the viewer it is worth MORE,
		// and that surplus is the wall leaning out of the sphere at you.
		const lift = 0.2;
		const limb: Vec3 = { x: 1, y: 0, z: 0 };
		expect(project(limb, 100, 2.6, lift).x / project(limb, 100).x).toBeCloseTo(1 + lift, 6);
		expect(project(limb, 100 * (1 + lift)).x / project(limb, 100).x).toBeCloseTo(1 + lift, 6);

		const near: Vec3 = { x: 0.6, y: 0, z: 0.8 };
		expect(project(near, 100, 2.6, lift).x / project(near, 100).x).toBeGreaterThan(1 + lift);
		// The zoom, by contrast, gains nothing beyond its own factor anywhere.
		expect(project(near, 100 * (1 + lift)).x / project(near, 100).x).toBeCloseTo(1 + lift, 6);
	});

	it('keeps depth and facing with the direction, not the height', () => {
		// A wall is in front of the globe exactly when the ground under it is, so
		// the depth sort must not care how tall the wall is.
		const dir: Vec3 = { x: 0, y: 0.6, z: 0.8 };
		const flat = project(dir, 100);
		const raised = project(dir, 100, 2.6, 0.3);
		expect(raised.depth).toBe(flat.depth);
		expect(raised.front).toBe(flat.front);
	});

	it('gives a solid at the limb its height, and one facing us its growth', () => {
		// The two ends of the same story. On the limb you see a piece side-on: "up"
		// is a real screen displacement pointing away from the globe's centre.
		const limb = tangentFrame({ x: 1, y: 0, z: 0 }, 600, { step: 30 });
		expect(limb.u.x).toBeGreaterThan(10);
		expect(Math.abs(limb.u.y)).toBeLessThan(1);

		// Facing the viewer you see it from overhead: "up" comes straight at you and
		// has nowhere to go on screen. All that is left to say the piece has height
		// is that its top is nearer, and so wider. THIS is the degenerate case the
		// lean exists for.
		const front = tangentFrame({ x: 0, y: 0, z: 1 }, 600, { step: 30 });
		expect(Math.hypot(front.u.x, front.u.y)).toBeLessThan(0.001);
		expect(front.grow).toBeGreaterThan(1);
	});

	it('leans a piece facing the viewer far enough to show a side', () => {
		// The fix for the case above: 25° of lean has to turn "no screen height at
		// all" into a band of side you can actually read a roof shape against.
		const lean = (25 * Math.PI) / 180;
		const front = tangentFrame({ x: 0, y: 0, z: 1 }, 600, { step: 30, lean });
		// Up now travels UP the screen (negative y), by about sin(25°) of a step.
		expect(front.u.y).toBeLessThan(-10);
		expect(Math.abs(front.u.x)).toBeLessThan(0.001);
	});

	it('applies the SAME lean wherever the piece sits', () => {
		// The property the whole approach rests on, and the reason the lean is
		// camera-space: a lean that varied with position would be a rotation that
		// changes as the globe turns, so every piece would visibly stand up and lie
		// back as it swept past the centre.
		//
		// "Same" means one fixed rotation about screen-right — NOT that every piece
		// tips by the same visible angle. A piece whose up already points along the
		// rotation axis barely moves, and that is correct: it is at the limb, seen
		// side-on, and needs no help. So the invariants are the two that define such
		// a rotation: the screen-right component is untouched, and the turn in the
		// remaining plane is `lean` exactly, everywhere.
		const lean = (25 * Math.PI) / 180;
		const spots = [
			{ x: 0, y: 0, z: 1 },
			{ x: 0.7, y: 0.2, z: 0.68 },
			{ x: 0, y: 0.9, z: 0.44 },
			{ x: -0.6, y: -0.5, z: 0.62 }
		].map(unit);
		for (const s of spots) {
			const a = tangentFrame(s, 600, { step: 30 }).axis.u;
			const b = tangentFrame(s, 600, { step: 30, lean }).axis.u;
			expect(b.x).toBeCloseTo(a.x, 6);
			expect(Math.hypot(b.y, b.z)).toBeCloseTo(Math.hypot(a.y, a.z), 6);
			// The turn in the y–z plane, unwrapped. It carries "toward the viewer"
			// round to "up the screen", which is the direction that reveals a side.
			let turn = Math.atan2(b.z, b.y) - Math.atan2(a.z, a.y);
			if (turn > Math.PI) turn -= 2 * Math.PI;
			if (turn < -Math.PI) turn += 2 * Math.PI;
			expect(turn).toBeCloseTo(lean, 6);
		}
	});

	it('turns a piece in place on its bearing, without moving where it stands', () => {
		// The distinction the option exists for. Moving `d` to turn a building
		// walks it round the globe — it turns, drifts off centre and foreshortens
		// at once, so two buildings can never be compared from one angle. Bearing
		// holds the spot and spins the frame in it.
		const at = { x: 0, y: 0, z: 1 };
		const plain = tangentFrame(at, 600, { step: 30, lean: 0.4 });
		const turned = tangentFrame(at, 600, { step: 30, lean: 0.4, bearing: Math.PI / 2 });
		// Up is untouched — a turn about the vertical cannot tip the building over,
		// and that is what stops the review turning into a wobble.
		expect(turned.axis.u.x).toBeCloseTo(plain.axis.u.x, 6);
		expect(turned.axis.u.y).toBeCloseTo(plain.axis.u.y, 6);
		expect(turned.axis.u.z).toBeCloseTo(plain.axis.u.z, 6);
		// A quarter turn takes east onto north exactly.
		expect(turned.axis.e.x).toBeCloseTo(plain.axis.n.x, 6);
		expect(turned.axis.e.y).toBeCloseTo(plain.axis.n.y, 6);
		expect(turned.axis.e.z).toBeCloseTo(plain.axis.n.z, 6);
	});

	it('leaves the frame alone at bearing 0, and orthonormal at any other', () => {
		const at = unit({ x: 0.3, y: 0.5, z: 0.81 });
		const opts = { step: 20, lean: 0.4 };
		const none = tangentFrame(at, 600, opts);
		const zero = tangentFrame(at, 600, { ...opts, bearing: 0 });
		expect(zero.axis.e.x).toBeCloseTo(none.axis.e.x, 9);
		expect(zero.grow).toBeCloseTo(none.grow, 9);

		const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
		for (const bearing of [0.7, -2.1, Math.PI]) {
			const { e, n, u } = tangentFrame(at, 600, { ...opts, bearing }).axis;
			for (const v of [e, n, u]) expect(dot(v, v)).toBeCloseTo(1, 6);
			expect(dot(e, n)).toBeCloseTo(0, 6);
			expect(dot(e, u)).toBeCloseTo(0, 6);
			// Still right-handed after the turn, or culling starts drawing insides.
			expect(e.y * n.z - e.z * n.y).toBeCloseTo(u.x, 6);
		}
	});

	it('keeps the frame orthonormal, so face windings mean what they say', () => {
		// Culling and shading are both a cross product in these coordinates. A frame
		// that is not orthonormal makes that cross product something other than the
		// normal, and solids start showing their insides.
		const f = tangentFrame(unit({ x: 0.3, y: 0.5, z: 0.81 }), 600, { step: 20, lean: 0.4 });
		const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
		const { e, n, u } = f.axis;
		for (const v of [e, n, u]) expect(dot(v, v)).toBeCloseTo(1, 6);
		expect(dot(e, n)).toBeCloseTo(0, 6);
		expect(dot(e, u)).toBeCloseTo(0, 6);
		expect(dot(n, u)).toBeCloseTo(0, 6);
		// Right-handed: e × n = u.
		expect(e.y * n.z - e.z * n.y).toBeCloseTo(u.x, 6);
		expect(e.z * n.x - e.x * n.z).toBeCloseTo(u.y, 6);
		expect(e.x * n.y - e.y * n.x).toBeCloseTo(u.z, 6);
	});

	it('places a point off the sphere at the distance it actually sits', () => {
		// projectPoint is just project in other coordinates — a point one radius
		// out on the limb must land exactly where a lift of 1 puts it.
		const limb: Vec3 = { x: 1, y: 0, z: 0 };
		const viaLift = project(limb, 100, 2.6, 1);
		const viaPoint = projectPoint({ x: 200, y: 0, z: 0 }, 100, 2.6);
		expect(viaPoint.x).toBeCloseTo(viaLift.x, 6);
		expect(viaPoint.y).toBeCloseTo(viaLift.y, 6);
	});

	it('survives a lift tall enough to reach the camera', () => {
		// At viewDistance 2.6 a lift of 1.6 puts the near pole level with the eye,
		// where an unclamped perspective divide flips the point behind the viewer.
		const p = project({ x: 0, y: 0, z: 1 }, 100, 2.6, 2);
		expect(Number.isFinite(p.scale)).toBe(true);
		expect(p.scale).toBeGreaterThan(0);
	});
});

const angle = (a: Vec3, b: Vec3) =>
	Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)));

describe('capDir', () => {
	it('returns unit directions', () => {
		for (const i of [0, 1, 7, 29]) expect(len(capDir(i, 30, 0.6))).toBeCloseTo(1, 6);
	});

	it('keeps every body inside the cap it was given', () => {
		const alpha = 0.7;
		for (const n of [1, 2, 9, 40])
			for (let i = 0; i < n; i++)
				expect(
					angle({ x: 0, y: 0, z: 1 }, capDir(i, n, alpha)),
					`n=${n} i=${i}`
				).toBeLessThanOrEqual(alpha + 1e-9);
	});

	it('fills the cap rather than hugging its axis', () => {
		// A generator that piled everything at the centre would still pass the
		// containment test above, and would not read as a territory.
		const alpha = 0.7;
		const outer = Array.from({ length: 30 }, (_, i) =>
			angle({ x: 0, y: 0, z: 1 }, capDir(i, 30, alpha))
		);
		expect(Math.max(...outer)).toBeGreaterThan(alpha * 0.9);
	});
});

describe('alignZ', () => {
	it('carries +z onto the centre it is given', () => {
		for (const c of capRing(3, 0.6)) {
			const moved = alignZ(c, { x: 0, y: 0, z: 1 });
			expect(moved.x).toBeCloseTo(c.x, 9);
			expect(moved.y).toBeCloseTo(c.y, 9);
			expect(moved.z).toBeCloseTo(c.z, 9);
		}
	});

	it('is a rotation — lengths and angles survive it', () => {
		const c = { x: 0.6, y: -0.48, z: 0.64 };
		const a = capDir(2, 9, 0.5);
		const b = capDir(5, 9, 0.5);
		expect(len(alignZ(c, a))).toBeCloseTo(1, 9);
		expect(angle(alignZ(c, a), alignZ(c, b))).toBeCloseTo(angle(a, b), 9);
	});

	it('handles the two degenerate axes without producing NaN', () => {
		// ẑ × c vanishes when c is ±ẑ, so there is no rotation axis to build from.
		const same = alignZ({ x: 0, y: 0, z: 1 }, { x: 0.3, y: 0.4, z: 0.866 });
		expect(same.z).toBeCloseTo(0.866, 9);
		const flipped = alignZ({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 });
		expect(flipped.z).toBeCloseTo(-1, 9);
		expect(Number.isNaN(flipped.x)).toBe(false);
	});
});

describe('capRing', () => {
	it('spaces the regions evenly and puts them on the equator', () => {
		const ring = capRing(3, 0.6);
		for (const c of ring) {
			expect(len(c)).toBeCloseTo(1, 9);
			expect(c.y).toBeCloseTo(0, 9);
		}
		expect(angle(ring[0], ring[1])).toBeCloseTo((2 * Math.PI) / 3, 6);
		expect(angle(ring[1], ring[2])).toBeCloseTo((2 * Math.PI) / 3, 6);
	});

	it('reports the yaw that turns each region to face the viewer', () => {
		// The whole point of putting the ring on the equator: `spin` yaws about Y,
		// so "look at region k" has a closed form and a script can just say it.
		const ring = capRing(3, 0.6);
		ring.forEach((c, k) => {
			const faced = spin(c, capRingYaw(k, 3, 0.6), 0);
			expect(faced.z, `k=${k}`).toBeCloseTo(1, 6);
		});
	});
});

describe('packSphereClusters', () => {
	const groups = ['dev', 'dev', 'build', 'runtime', 'build', 'runtime', 'dev', 'runtime'];
	const radii = groups.map(() => 50);

	it('lands every body inside its own region', () => {
		const { dirs, caps } = packSphereClusters(radii, groups, { margin: 18 });
		groups.forEach((g, i) => {
			const cap = caps.get(g)!;
			expect(angle(cap.center, dirs[i]), `${g}[${i}]`).toBeLessThanOrEqual(cap.alpha + 1e-9);
		});
	});

	it('leaves an empty border between neighbouring regions', () => {
		// What makes a group read AS a group is that the space between beats the
		// space within. If adjacent caps touch, the territories smear at the limb.
		const { caps } = packSphereClusters(radii, groups, { margin: 18 });
		const list = [...caps.values()];
		for (let i = 0; i < list.length; i++)
			for (let j = i + 1; j < list.length; j++) {
				const gap = angle(list[i].center, list[j].center) - list[i].alpha - list[j].alpha;
				expect(gap, `${i}-${j}`).toBeGreaterThan(0.2);
			}
	});

	it('sizes a region by its population, not evenly', () => {
		const lopsided = ['a', 'a', 'a', 'a', 'a', 'a', 'b', 'c'];
		const { caps } = packSphereClusters(
			lopsided.map(() => 50),
			lopsided,
			{ minAlpha: 0 }
		);
		expect(caps.get('a')!.alpha).toBeGreaterThan(caps.get('b')!.alpha);
		expect(caps.get('b')!.alpha).toBeCloseTo(caps.get('c')!.alpha, 9);
	});

	it('never overlaps — the radius solve still holds under clustering', () => {
		const { dirs, radius } = packSphereClusters(radii, groups, { margin: 18 });
		for (let i = 0; i < radii.length; i++)
			for (let j = i + 1; j < radii.length; j++) {
				const d = Math.hypot(
					(dirs[i].x - dirs[j].x) * radius,
					(dirs[i].y - dirs[j].y) * radius,
					(dirs[i].z - dirs[j].z) * radius
				);
				expect(d).toBeGreaterThanOrEqual(radii[i] + radii[j] + 18 - 0.01);
			}
	});

	it('needs a bigger globe than an even spread, because the space is not all usable', () => {
		const even = packSphere(radii, { margin: 18 }).radius;
		const grouped = packSphereClusters(radii, groups, { margin: 18 }).radius;
		expect(grouped).toBeGreaterThan(even);
		expect(grouped).toBeLessThan(even * 2);
	});

	it('orders regions by first appearance, so the caller decides which sits where', () => {
		const { caps } = packSphereClusters(radii, groups, {});
		expect([...caps.keys()]).toEqual(['dev', 'build', 'runtime']);
	});

	it('honours explicit centres', () => {
		const centers = { dev: { x: 0, y: 1, z: 0 } };
		const { caps } = packSphereClusters(radii, groups, { centers });
		expect(caps.get('dev')!.center.y).toBe(1);
	});

	it('is deterministic', () => {
		const key = () =>
			packSphereClusters(radii, groups, { margin: 18 })
				.dirs.map((d) => `${d.x.toFixed(4)},${d.y.toFixed(4)},${d.z.toFixed(4)}`)
				.join(' ');
		expect(key()).toBe(key());
	});

	it('survives an empty mesh and a single body', () => {
		expect(packSphereClusters([], []).dirs).toEqual([]);
		expect(packSphereClusters([40], ['solo']).dirs).toHaveLength(1);
	});
});

describe('capField', () => {
	it('stays inside its region, widened by the amount asked for', () => {
		const cap = { center: capRing(3, 0.6)[1], alpha: 0.7 };
		const pts = capField(200, cap, 0.07);
		expect(pts).toHaveLength(200);
		for (const p of pts)
			expect(angle(cap.center, p)).toBeLessThanOrEqual(cap.alpha + 0.07 + 1e-9);
	});
});

describe('faceYawPitch', () => {
	it('lands ANY direction dead on the viewer', () => {
		// The whole contract, and the only one worth testing: whatever the solver
		// returns, spinning by it must put the point at +z. Checked against `spin`
		// itself rather than against the algebra, because the two being consistent
		// is exactly the property that matters — a solver that inverts a different
		// spin than the renderer uses is correct and useless.
		for (let i = 0; i < 200; i++) {
			const d = fibonacciDir(i, 200);
			const { yaw, pitch } = faceYawPitch(d);
			const s = spin(d, yaw, pitch);
			expect(s.z).toBeCloseTo(1, 9);
			expect(s.x).toBeCloseTo(0, 9);
			expect(s.y).toBeCloseTo(0, 9);
		}
	});

	it('handles the poles, where every yaw is equally right', () => {
		for (const d of [
			{ x: 0, y: 1, z: 0 },
			{ x: 0, y: -1, z: 0 }
		]) {
			const { yaw, pitch } = faceYawPitch(d);
			expect(Number.isFinite(yaw)).toBe(true);
			const s = spin(d, yaw, pitch);
			expect(s.z).toBeCloseTo(1, 9);
		}
	});

	it('lifts the subject off centre when the pitch is nudged', () => {
		// The framing trick the focus flight leans on: adding to the pitch moves the
		// node UP the screen, one radian to one unit, so a building stops being seen
		// from directly overhead. If this sign ever flips, the camera would tuck the
		// subject below the middle and show its roof again.
		const d = fibonacciDir(7, 40);
		const { yaw, pitch } = faceYawPitch(d);
		const lifted = spin(d, yaw, pitch + 0.2);
		expect(lifted.y).toBeLessThan(0);
		expect(lifted.y).toBeCloseTo(-0.2, 1);
	});
});

describe('shortestAngle', () => {
	it('goes the short way round the circle', () => {
		const TAU = Math.PI * 2;
		// 350° → 10° is 20° forward, not 340° back.
		expect(shortestAngle((350 * Math.PI) / 180, (10 * Math.PI) / 180)).toBeCloseTo(
			(370 * Math.PI) / 180,
			9
		);
		// Never travels more than half a turn, from anywhere to anywhere.
		for (let i = 0; i < 100; i++) {
			const a = (i / 100) * TAU * 3 - TAU;
			const b = ((i * 7) % 100) / 100 * TAU * 3 - TAU;
			expect(Math.abs(shortestAngle(a, b) - a)).toBeLessThanOrEqual(Math.PI + 1e-9);
		}
	});

	it('is equivalent to the target modulo a full turn', () => {
		const TAU = Math.PI * 2;
		for (let i = 0; i < 50; i++) {
			const a = i * 0.37;
			const b = i * -0.91;
			const out = shortestAngle(a, b);
			const diff = Math.abs(((out - b) % TAU) + TAU) % TAU;
			expect(Math.min(diff, TAU - diff)).toBeCloseTo(0, 9);
		}
	});
});
