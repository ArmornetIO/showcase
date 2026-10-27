// ── physics/walker — a first-person body that walks, steps and falls ─────────
// Quake's player movement (PM_SlideMove / PM_StepSlideMove), in metres, over
// `hull.trace`. Every rule here is one a player has felt in a shooter and would
// notice missing:
//
//  · SLIDE. Hitting a wall keeps the part of the move that runs along it; two
//    walls meeting in a crease send you along their crease. Up to four bumps a
//    step, which is enough for any corner a convex world can make.
//  · STEP. A kerb or a set-back no taller than `stepHeight` is walked up, by
//    trying the move again from that much higher and keeping whichever went
//    further. A 1m plinth is not a step — that one you jump.
//  · GROUND. Standing needs a floor no steeper than `walkableNy` (45°). On
//    anything steeper you are airborne, so gravity and the slide take you down it.
//
// The body is an axis-aligned box (see specs/056 research R1): flat feet stand
// cleanly on a 0.4m ledge, where a capsule would roll off the lip.
//
// `stepWalker` is a pure function of (world, state, input, dt) and is meant to
// be called at a FIXED dt. That is what makes the result independent of the
// frame rate: the caller owns the accumulator, this owns nothing.
//
// Pure: no Svelte, no DOM, no dependencies, no knowledge of what a hull is.
import type { Vec3 } from './sphere.js';
import { trace, type Plane, type World } from './hull.js';

export type WalkerMode = 'ground' | 'air';

export interface WalkerTuning {
	/** Box half-extents. Keep the camera's near plane inside `half.x`. */
	half: Vec3;
	/** Eye height above the feet. */
	eye: number;
	walkSpeed: number;
	runSpeed: number;
	gravity: number;
	jumpSpeed: number;
	stepHeight: number;
	/** Lowest normal.y that still counts as floor. cos 45° ≈ 0.7. */
	walkableNy: number;
	/** How quickly a mid-air wish bends the flight, per second. 0 is ballistic. */
	airControl: number;
}

export const WALKER_DEFAULTS: Readonly<WalkerTuning> = Object.freeze({
	half: { x: 0.4, y: 0.9, z: 0.4 },
	eye: 1.7,
	walkSpeed: 5,
	runSpeed: 11,
	gravity: 22,
	jumpSpeed: 7.5,
	stepHeight: 0.45,
	walkableNy: 0.7,
	airControl: 3
});

/** One step's intent. */
export interface WalkerInput {
	/** −1, 0 or 1 — S/W. */
	forward: number;
	/** −1, 0 or 1 — A/D. */
	strafe: number;
	/** Facing, radians; 0 looks toward −z. The walker never turns itself. */
	yaw: number;
	run: boolean;
	jump: boolean;
}

export interface WalkerState {
	/** Centre of the feet — the bottom face of the box. */
	pos: Vec3;
	vel: Vec3;
	mode: WalkerMode;
	/** The floor stood on, for anything that wants to show it. */
	ground: Plane | null;
	/** Every plane the last step's move ran into — debug draw reads this. */
	touched: Plane[];
}

const tuned = (t?: Partial<WalkerTuning>): WalkerTuning => (t ? { ...WALKER_DEFAULTS, ...t } : WALKER_DEFAULTS);

/** The trace works in box centres; everything else here in feet. One place converts. */
function move(world: World, feet: Vec3, to: Vec3, half: Vec3) {
	const tr = trace(world, { x: feet.x, y: feet.y + half.y, z: feet.z }, { x: to.x, y: to.y + half.y, z: to.z }, half);
	return { ...tr, end: { x: tr.end.x, y: tr.end.y - half.y, z: tr.end.z } };
}

const dot = (a: Vec3, p: Plane) => a.x * p.nx + a.y * p.ny + a.z * p.nz;

/** Remove the part of `v` heading into the plane — a hair more than all of it,
 *  so float error cannot leave the walker grinding into the face it just hit. */
function clipVel(v: Vec3, p: Plane): Vec3 {
	let back = dot(v, p);
	back = back < 0 ? back * 1.001 : back / 1.001;
	return { x: v.x - p.nx * back, y: v.y - p.ny * back, z: v.z - p.nz * back };
}

/** PM_SlideMove: move for `dt`, sliding off whatever is hit. */
function slideMove(world: World, pos: Vec3, vel: Vec3, dt: number, half: Vec3) {
	let p = pos;
	let v = vel;
	let time = dt;
	const planes: Plane[] = [];
	for (let bump = 0; bump < 4; bump++) {
		const tr = move(world, p, { x: p.x + v.x * time, y: p.y + v.y * time, z: p.z + v.z * time }, half);
		p = tr.end;
		if (!tr.plane) break;
		planes.push(tr.plane);
		time -= time * tr.fraction;

		// Find the one plane whose clip does not drive into any of the others.
		let next: Vec3 | null = null;
		for (const a of planes) {
			const c = clipVel(v, a);
			if (planes.every((b) => b === a || dot(c, b) >= -1e-9)) {
				next = c;
				break;
			}
		}
		if (!next && planes.length === 2) {
			// A crease: the only way on is along the line where the two meet.
			const [a, b] = planes;
			const cx = a.ny * b.nz - a.nz * b.ny, cy = a.nz * b.nx - a.nx * b.nz, cz = a.nx * b.ny - a.ny * b.nx;
			const len = Math.hypot(cx, cy, cz) || 1;
			const s = (v.x * cx + v.y * cy + v.z * cz) / (len * len);
			next = { x: cx * s, y: cy * s, z: cz * s };
		}
		v = next ?? { x: 0, y: 0, z: 0 };
		if (!next || (v.x * vel.x + v.y * vel.y + v.z * vel.z) <= 0) {
			// Turned back on itself — a wedge. Stop rather than jitter.
			v = { x: 0, y: 0, z: 0 };
			break;
		}
	}
	return { pos: p, vel: v, planes };
}

/** A floor under the feet within `reach`, or null. */
function floor(world: World, pos: Vec3, reach: number, t: WalkerTuning) {
	const tr = move(world, pos, { x: pos.x, y: pos.y - reach, z: pos.z }, t.half);
	return tr.plane && tr.plane.ny >= t.walkableNy ? tr : null;
}

const flatDist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

/** A walker standing at `feet`. Nudged straight up if that is inside a solid. */
export function spawnWalker(world: World, feet: Vec3, tuning?: Partial<WalkerTuning>): WalkerState {
	const t = tuned(tuning);
	let pos = feet;
	for (let i = 0; i < 200 && move(world, pos, pos, t.half).startSolid; i++) pos = { ...pos, y: pos.y + 0.1 };
	return { pos, vel: { x: 0, y: 0, z: 0 }, mode: 'air', ground: null, touched: [] };
}

/** Advance one fixed step. Returns a new state; `state` and `world` are untouched. */
export function stepWalker(
	world: World,
	state: WalkerState,
	input: WalkerInput,
	dt: number,
	tuning?: Partial<WalkerTuning>
): WalkerState {
	const t = tuned(tuning);
	const sy = Math.sin(input.yaw), cy = Math.cos(input.yaw);
	let wx = input.forward * sy + input.strafe * cy;
	let wz = -input.forward * cy + input.strafe * sy;
	const wl = Math.hypot(wx, wz);
	if (wl > 0) {
		wx /= wl;
		wz /= wl;
	}
	const speed = input.run ? t.runSpeed : t.walkSpeed;

	let vel: Vec3;
	let grounded = state.mode === 'ground';
	if (grounded) {
		// Instant response on the ground, as every shooter does it: a walk that has
		// to accelerate reads as ice at eye height.
		vel = { x: wx * speed, y: 0, z: wz * speed };
		if (input.jump) {
			vel.y = t.jumpSpeed;
			grounded = false;
		}
	} else {
		const k = wl > 0 ? Math.min(1, t.airControl * dt) : 0;
		vel = {
			x: state.vel.x + (wx * speed - state.vel.x) * k,
			y: state.vel.y - t.gravity * dt,
			z: state.vel.z + (wz * speed - state.vel.z) * k
		};
	}

	let res = slideMove(world, state.pos, vel, dt, t.half);
	if (grounded && res.planes.length) {
		// PM_StepSlideMove: try the same move from a step higher, then settle.
		const up = move(world, state.pos, { ...state.pos, y: state.pos.y + t.stepHeight }, t.half);
		const raised = slideMove(world, up.end, vel, dt, t.half);
		const down = move(world, raised.pos, { ...raised.pos, y: state.pos.y - 0.02 }, t.half);
		const landed = down.plane && down.plane.ny >= t.walkableNy;
		if (landed && flatDist(down.end, state.pos) > flatDist(res.pos, state.pos) + 1e-6)
			res = { pos: down.end, vel: { ...raised.vel, y: 0 }, planes: raised.planes };
	}

	// Settle: glue to a floor within a step below when we were walking (stairs
	// down, ramps), or just within a hair when falling.
	const reach = grounded ? t.stepHeight + 0.02 : 0.02;
	// Walking up a ramp clips velocity upward, so "still on the ground" cannot be
	// read off vel.y — only a jump (which cleared `grounded`) may leave the floor.
	// Airborne, the bound is a little above zero because the clip's overbounce
	// turns a landing into a hair of upward speed; with `<= 0` a falling walker
	// lands, bounces 1mm/s, and never counts as standing again.
	const f = grounded || res.vel.y <= 0.1 ? floor(world, res.pos, reach, t) : null;
	if (f) {
		return { pos: f.end, vel: { ...res.vel, y: 0 }, mode: 'ground', ground: f.plane, touched: res.planes };
	}
	return { pos: res.pos, vel: res.vel, mode: 'air', ground: null, touched: res.planes };
}

/** Where the camera goes. */
export function walkerEye(state: WalkerState, tuning?: Partial<WalkerTuning>): Vec3 {
	return { x: state.pos.x, y: state.pos.y + tuned(tuning).eye, z: state.pos.z };
}
