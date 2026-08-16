// ── physics/orbit — globe camera intro ───────────────────────────────────────
// The globe's camera is nothing but a pose: (yaw, pitch, viewDistance). This is
// the reusable "fly-in" for that camera — an orbit that swings around and over
// the globe like a moon before settling into a resting pose.
//
// Split in two on purpose:
//   • `orbitIntroPose` is PURE — the pose at a normalised progress t∈[0,1]. It is
//     what makes the motion testable without a browser or a clock.
//   • `playOrbitIntro` is the thin rAF driver that steps t over wall-clock and
//     hands each pose back. Turning the feature on is calling it; off is not.
//
// Pure module boundary matches the rest of physics/: no Svelte, no globals beyond
// requestAnimationFrame/performance in the driver.

/** A globe camera pose. `viewDistance` is in globe radii (see physics/sphere). */
export interface CameraPose {
	yaw: number;
	pitch: number;
	viewDistance: number;
}

export interface OrbitIntroConfig {
	/** Pose the orbit decelerates into and holds. */
	rest: CameraPose;
	/** Turns around the globe (yaw sweep) before settling. Default 1.25. */
	turns?: number;
	/** How high the camera lifts up and over the pole mid-orbit, radians. The
	 *  "swing over the top" that reads as an orbit rather than a spin. Default 0.85. */
	arc?: number;
	/** Distance the orbit starts from, globe radii. Default rest.viewDistance + 0.6
	 *  — near-constant, so it circles rather than zooming in from deep space. */
	fromDistance?: number;
	/** Pitch the orbit starts flat at, radians. Default -0.25. */
	fromPitch?: number;
	/** Duration, ms. Default 3200. */
	durationMs?: number;
}

/** A named intro variant — the tunable half of an OrbitIntroConfig (everything
 *  but `rest`, which each globe supplies). Lets the DevCog offer a menu of
 *  distinct fly-ins for one canvas. */
export interface OrbitPreset {
	id: string;
	label: string;
	description: string;
	params: Omit<OrbitIntroConfig, 'rest'>;
}

/** The built-in intro variants, in menu order.
 *
 *  FIRST IS THE DEFAULT — `GlobeDevControls` opens on `ORBIT_PRESETS[0]`, and
 *  `resolve()` above falls back to the same numbers. Keep the two in step: a menu
 *  whose first entry is not what the globe actually plays is a menu that lies. */
export const ORBIT_PRESETS: OrbitPreset[] = [
	{
		id: 'sweep',
		label: 'Low sweep',
		description: 'A fast, flat pass that dips below and rises into place.',
		params: { turns: 0.75, arc: -0.5, fromDistance: 2.9, fromPitch: 0.25, durationMs: 2600 }
	},
	{
		id: 'moon',
		label: 'Moon orbit',
		description: 'Swings 1¼ turns around and up over the pole, like a moon.',
		params: { turns: 1.25, arc: 0.85, fromDistance: 3.2, fromPitch: -0.25, durationMs: 3200 }
	},
	{
		id: 'flyin',
		label: 'Fly-in',
		description: 'A short, mostly-straight dive in from far out.',
		params: { turns: 0.35, arc: 0.15, fromDistance: 6.2, fromPitch: -0.1, durationMs: 2200 }
	},
	{
		id: 'spin',
		label: 'Fast spin',
		description: 'Two and a half quick turns with barely any arc.',
		params: { turns: 2.5, arc: 0.1, fromDistance: 2.7, fromPitch: 0.1, durationMs: 2400 }
	}
];

/** Build a full config for a preset against a globe's resting pose. */
export function orbitConfigFor(preset: OrbitPreset, rest: CameraPose): OrbitIntroConfig {
	return { rest, ...preset.params };
}

const TAU = Math.PI * 2;

interface Resolved {
	fromYaw: number;
	fromPitch: number;
	fromDist: number;
	rest: CameraPose;
	arc: number;
	durationMs: number;
}

// ── The defaults ARE the low sweep ───────────────────────────────────────────
// A globe that opens by climbing over its own pole is showing you the shape of
// the sphere. A low sweep is showing you what is ON it: the camera stays near
// the surface, dips BELOW the resting pitch and rises into place, so the whole
// pass is spent looking across the terrain at the things standing in it rather
// than down at a map of them. On a globe whose subject is its buildings, that is
// the more honest opening — and it is the difference a negative `arc` makes.
//
// Faster and shorter too. Three quarters of a turn instead of a turn and a
// quarter: an intro is a title card, and the second time you see it you want it
// over. The over-the-pole moon orbit is still one preset away.
function resolve(cfg: OrbitIntroConfig): Resolved {
	const turns = cfg.turns ?? 0.75;
	return {
		// Start rotated `turns` back so easing forward lands exactly on rest.yaw.
		fromYaw: cfg.rest.yaw - TAU * turns,
		// POSITIVE, where the moon orbit starts negative: the camera opens already
		// leaning in over the surface rather than flat on to the equator.
		fromPitch: cfg.fromPitch ?? 0.25,
		// Relative to the globe's own resting distance, not the preset's absolute
		// 2.9 — a globe that rests somewhere else should still start a little way
		// out and close in, rather than inheriting a number picked for this one.
		fromDist: cfg.fromDistance ?? cfg.rest.viewDistance + 0.3,
		rest: cfg.rest,
		// Negative: dip UNDER the resting pitch mid-pass and rise into it. This is
		// the whole character of the move.
		arc: cfg.arc ?? -0.5,
		durationMs: cfg.durationMs ?? 2600,
	};
}

/** easeInOutCubic — accelerate out of the far orbit, decelerate into rest. */
function ease(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The camera pose at normalised progress `t` (clamped to [0,1]). Pure. */
export function orbitIntroPose(t: number, cfg: OrbitIntroConfig): CameraPose {
	const r = resolve(cfg);
	const e = ease(Math.max(0, Math.min(1, t)));
	return {
		yaw: lerp(r.fromYaw, r.rest.yaw, e),
		// Sine bump: 0 at both ends, peak mid-orbit — lifts the camera up and over
		// the pole, then it settles onto the eased rest pitch.
		pitch: lerp(r.fromPitch, r.rest.pitch, e) + r.arc * Math.sin(Math.PI * e),
		viewDistance: lerp(r.fromDist, r.rest.viewDistance, e),
	};
}

/** The pose the orbit begins from (t=0). Set the camera to this before playing so
 *  the first painted frame is already the far pose, with no flash of `rest`. */
export function orbitIntroStart(cfg: OrbitIntroConfig): CameraPose {
	return orbitIntroPose(0, cfg);
}

/** Drive the orbit intro with requestAnimationFrame, calling `onFrame` with each
 *  pose until it completes or the returned cancel is invoked (e.g. the user grabs
 *  the globe and takes over). Returns a cancel function. */
// ── Flying to a point ────────────────────────────────────────────────────────
// The intro above is a scripted path with a shape of its own. This is the other
// motion a globe camera needs: get from wherever the operator left it to a pose
// somebody just asked for, and do it in a way that reads as the globe TURNING
// rather than as a cut.

/** Ease in and out. Symmetric, and flat at both ends — a globe that starts and
 *  stops at speed reads as a jump-cut no matter how long the tween is, because
 *  what the eye reads as motion is the acceleration, not the travel. */
function easeInOut(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** The pose a fraction of the way from one to another.
 *
 *  Yaw takes the SHORT way round. It is an angle on a circle, so tweening the raw
 *  numbers can unwind most of a full turn to reach a neighbour a few degrees
 *  away — every frame of it correct, and the whole of it wrong. Pitch and
 *  distance are ordinary quantities with no wrap, so they interpolate plainly. */
export function cameraLerp(from: CameraPose, to: CameraPose, t: number): CameraPose {
	const k = easeInOut(Math.max(0, Math.min(1, t)));
	const TAU = Math.PI * 2;
	let d = (to.yaw - from.yaw) % TAU;
	if (d > Math.PI) d -= TAU;
	if (d < -Math.PI) d += TAU;
	return {
		yaw: from.yaw + d * k,
		pitch: from.pitch + (to.pitch - from.pitch) * k,
		viewDistance: from.viewDistance + (to.viewDistance - from.viewDistance) * k,
	};
}

/** An APPROACH: swing round to the subject, then rise and close on it.
 *
 *  `cameraLerp` moves every channel together, which is right for a correction and
 *  wrong for an arrival — all three at once is a single diagonal the eye reads as
 *  drift, and you cannot tell afterwards what the camera did. Staggering them
 *  into two overlapping beats gives the move a grammar: first the globe TURNS
 *  (yaw, the big legible one that says which way the world went), then the camera
 *  RISES and CLOSES onto what it found (pitch and distance).
 *
 *  The beats overlap by design. Run strictly in sequence and the camera visibly
 *  stops halfway, which reads as a stutter; overlapped, the second is already
 *  underway as the first settles and the whole thing lands as one gesture. */
export function cameraApproach(from: CameraPose, to: CameraPose, t: number): CameraPose {
	const c = Math.max(0, Math.min(1, t));
	// Yaw owns the first two thirds, the settle the last seven tenths — so they
	// share the middle third rather than meeting at a seam.
	const yawK = easeInOut(Math.min(1, c / 0.65));
	const settleK = easeInOut(Math.max(0, (c - 0.3) / 0.7));
	const TAU = Math.PI * 2;
	let d = (to.yaw - from.yaw) % TAU;
	if (d > Math.PI) d -= TAU;
	if (d < -Math.PI) d += TAU;
	return {
		yaw: from.yaw + d * yawK,
		pitch: from.pitch + (to.pitch - from.pitch) * settleK,
		viewDistance: from.viewDistance + (to.viewDistance - from.viewDistance) * settleK,
	};
}

/** Fly the camera from one pose to another. Returns a cancel.
 *
 *  Cancelling matters more here than in the intro: the operator can grab the
 *  globe mid-flight, and a tween that keeps writing poses after that fights the
 *  drag. The caller is expected to cancel on any input that owns the camera. */
export function playCameraTo(
	from: CameraPose,
	to: CameraPose,
	onFrame: (pose: CameraPose) => void,
	opts: {
		durationMs?: number;
		onDone?: () => void;
		/** Stagger the channels into turn-then-settle (see `cameraApproach`) rather
		 *  than moving them together. */
		approach?: boolean;
	} = {},
): () => void {
	const { durationMs = 900, onDone, approach = false } = opts;
	const at = approach ? cameraApproach : cameraLerp;
	let raf = 0;
	let start: number | null = null;
	let cancelled = false;

	const step = (now: number) => {
		if (cancelled) return;
		if (start === null) start = now;
		const t = Math.min(1, (now - start) / Math.max(1, durationMs));
		onFrame(at(from, to, t));
		if (t < 1) raf = requestAnimationFrame(step);
		else onDone?.();
	};

	raf = requestAnimationFrame(step);
	return () => {
		cancelled = true;
		cancelAnimationFrame(raf);
	};
}

// ── Standing in it ───────────────────────────────────────────────────────────
// Everything above moves the camera AROUND the globe. First person is those same
// three numbers taken to their limit, and nothing else: `viewDistance` is in
// globe radii, so 1 is the shell itself and the numbers below it are inside the
// rock. Walk the eye down to just above the surface and the projection already
// does the work — the perspective divide that reads as ROUNDNESS from three radii
// out reads as STANDING ON IT from one, because it is the same divide with the
// near ground filling the frame.
//
// So there is no first-person camera here, and there should not be one. There is
// a pose, it is a pose the globe could always hold, and every existing tween
// (`cameraLerp`, `playCameraTo`) moves to and from it unchanged.

/** Nearest the eye may stand, in globe radii.
 *
 *  Not a taste — `project` clamps its denominator at 1.2, because below that the
 *  camera is inside the sphere and the divide inverts the world through itself.
 *  This is that floor, named, so a caller asking to stand on the surface and the
 *  renderer deciding what the surface is cannot drift apart. */
export const SURFACE_DISTANCE = 1.2;

export interface FirstPersonOpts {
	/** Radians added to the facing pitch. Small and POSITIVE lifts the subject off
	 *  the bottom of the frame — from the surface, a pose that centres a thing puts
	 *  it under your feet. */
	tilt?: number;
	/** Globe radii. Clamped up to `SURFACE_DISTANCE`; there is nowhere nearer. */
	distance?: number;
}

/**
 * The pose that stands the camera on the shell, facing a direction already solved
 * by `faceYawPitch`.
 *
 * Deliberately takes the SOLVED facing rather than the direction: the caller owns
 * the spin (axial tilt, whatever pitch clamp it enforces), and a pure function
 * that re-derived those would have to be told about them.
 */
export function firstPersonPose(
	facing: { yaw: number; pitch: number },
	opts: FirstPersonOpts = {},
): CameraPose {
	return {
		yaw: facing.yaw,
		pitch: facing.pitch + (opts.tilt ?? 0),
		viewDistance: Math.max(SURFACE_DISTANCE, opts.distance ?? SURFACE_DISTANCE),
	};
}

/** Hangs, then falls. 0→1, flat at the start and pinned at both ends.
 *
 *  The two terms are doing different jobs and neither works alone. The cube is
 *  the RUSH — almost nothing happens for the first third, which is what makes the
 *  second half feel like speed instead of like a constant slide. The sixth-power
 *  term is the LANDING: it is already ~1 by the time the cube gets going, so all
 *  it contributes is a decelerating tail that stops the arrival being a wall.
 *  Weighted 82/18 because much more settle and the dive reads as a lift descent. */
function fall(t: number): number {
	const c = Math.max(0, Math.min(1, t));
	return Math.pow(c, 3) * 0.82 + (1 - Math.pow(1 - c, 6)) * 0.18;
}

/**
 * The DIVE — the camera going from wherever it is into a body on the surface.
 *
 * `cameraApproach` staggers its channels to read as a considered arrival; this
 * staggers them to read as being FIRED at something. The turn happens almost
 * immediately and is over in the first 45%, so the subject is dead ahead long
 * before you reach it and the rest of the move is unmistakably travel toward a
 * thing you are already looking at. Then the distance collapses on `fall`.
 *
 * Turn-then-travel is also the only ordering that survives a long yaw. Move both
 * together from the far side of the globe and the world swings past the eye while
 * the eye is closing on it, which is not a dive — it is a barrel roll.
 */
export function divePose(from: CameraPose, to: CameraPose, t: number): CameraPose {
	const c = Math.max(0, Math.min(1, t));
	const turnK = 1 - Math.pow(1 - Math.min(1, c / 0.45), 3);
	const fallK = fall(c);
	const TAU = Math.PI * 2;
	let d = (to.yaw - from.yaw) % TAU;
	if (d > Math.PI) d -= TAU;
	if (d < -Math.PI) d += TAU;
	return {
		yaw: from.yaw + d * turnK,
		pitch: from.pitch + (to.pitch - from.pitch) * turnK,
		viewDistance: from.viewDistance + (to.viewDistance - from.viewDistance) * fallK,
	};
}

/**
 * The framing radius during a dive — the 2D half of the same gesture.
 *
 * The globe pose cannot carry the whole move on its own, because it bottoms out:
 * `SURFACE_DISTANCE` is a hard floor and the last stretch of a dive has no room
 * left in it. The canvas zoom has no such floor, so it is where the punch lives —
 * it overshoots ~12% past the resting frame just before the end and springs back,
 * which is the beat that reads as ARRIVING rather than as stopping.
 *
 * Returns a radius in world px, for `CanvasCamera.fitRect` with `duration: 0` —
 * the caller is driving every frame, so a camera with an easing of its own would
 * be a second animation fighting this one.
 */
export function diveFraming(wide: number, tight: number, t: number): number {
	const c = Math.max(0, Math.min(1, t));
	// The travel finishes EARLY — `fall` is run over the first 84% — and the last
	// sixth is spent on the overshoot alone. That split is what makes the punch a
	// punch: run the travel over the whole window and the frame is still a long way
	// out when the overshoot fires, so "12% past the resting frame" lands 12% past
	// somewhere that is not the resting frame and the beat does nothing at all.
	const r = wide + (tight - wide) * fall(Math.min(1, c / 0.84));
	// A half-sine over that last sixth: zero at both ends, so a dive cut short can
	// never leave the camera parked inside its own overshoot.
	const punch = c < 0.84 ? 0 : Math.sin(((c - 0.84) / 0.16) * Math.PI) * 0.12;
	return Math.max(1, r * (1 - punch));
}

export function playOrbitIntro(
	cfg: OrbitIntroConfig,
	onFrame: (pose: CameraPose) => void,
	onDone?: () => void,
): () => void {
	const { durationMs } = resolve(cfg);
	let raf = 0;
	let start: number | null = null;
	let cancelled = false;

	const step = (now: number) => {
		if (start === null) start = now;
		const t = Math.min(1, (now - start) / durationMs);
		onFrame(orbitIntroPose(t, cfg));
		if (t < 1 && !cancelled) {
			raf = requestAnimationFrame(step);
		} else if (!cancelled) {
			onDone?.();
		}
	};

	raf = requestAnimationFrame(step);
	return () => {
		cancelled = true;
		cancelAnimationFrame(raf);
	};
}
