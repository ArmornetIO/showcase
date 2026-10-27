// ── The drone — a cheap light that follows you round the dark ─────────────────
// It comes out of your chest by itself when you walk into the dark, and goes
// back when you walk into light; F sends it out or calls it in by hand. Out,
// it hovers up and to the right, its beam on wherever you look. It is a bad
// drone: the lamp heats while it is on, stutters more the hotter it runs, and
// at full heat cuts out until it has cooled.
// Nobody else sees it yet: a pose on the wire carries no drone.
//
// Pure: the scene steps it and reads it once a frame.
import type { PlacedLight } from 'showcase';
import type { Lighting } from './lighting.js';

/** Seconds of beam from cold to cut-out, and from cut-out back to cold. */
export const HEAT_S = 40;
export const COOL_S = 20;
/** The heat a cut-out lamp must fall to before it will light again. */
export const RESET = 0.3;

export interface Drone {
	/** Sent out: F toggles it. */
	out: boolean;
	/** 0 cold, 1 cut out. */
	heat: number;
	/** Cut out by the heat, and not yet cooled to RESET. */
	tripped: boolean;
}

export const DOCKED: Drone = { out: false, heat: 0, tripped: false };

/** `d`, `dt` seconds on: heating while the beam is on, cooling while it is not. */
export function stepDrone(d: Drone, dt: number): Drone {
	const burning = d.out && !d.tripped;
	const heat = Math.min(1, Math.max(0, d.heat + (burning ? dt / HEAT_S : -dt / COOL_S)));
	return { ...d, heat, tripped: heat >= 1 || (d.tripped && heat > RESET) };
}

/** 0..1, stable for a given n. */
const hash = (n: number) => {
	const s = Math.sin(n * 12.9898) * 43758.5453;
	return s - Math.floor(s);
};

/** How bright the beam is at `t` seconds: 0 when it is off or cut out. Every
 *  0.7s window may be a stutter, and a hot lamp has more of them; inside one
 *  the bulb drops out in 60ms flecks, like a loose battery. */
export function beam(d: Drone, t: number): number {
	if (!d.out || d.tripped) return 0;
	const stutters = hash(Math.floor(t / 0.7)) < 0.04 + d.heat * d.heat * 0.6;
	const dropped = stutters && hash(Math.floor(t / 0.06) + 0.5) < 0.55;
	return (dropped ? 0.06 : 1) * (1 - d.heat * 0.3);
}

/** Below this much light at your eye, the drone comes out by itself. */
export const DARK = 0.35;

/** How lit `p` is: the ambient as the cues leave it, plus each prop light's
 *  banded falloff, the way the shader adds them (map-gl.ts). */
export function lightLevel(lights: readonly PlacedLight[], L: Lighting, p: { x: number; y: number; z: number }): number {
	let sum = L.ambient;
	for (const l of lights) {
		const f = Math.max(0, 1 - Math.hypot(l.x - p.x, l.y - p.y, l.z - p.z) / l.radius);
		sum += (Math.ceil(f * f * 4) / 4) * L.light(l.group) * (1 - l.flicker * 0.5);
	}
	return sum;
}

/** Where the drone hovers for an eye at `eye` looking along `yaw`: a metre
 *  out, half a metre right, a little up, bobbing. Docked, it is in your chest. */
export function droneGoal(d: Drone, eye: { x: number; y: number; z: number }, yaw: number, t: number) {
	if (!d.out) return { x: eye.x, y: eye.y - 0.4, z: eye.z };
	const sy = Math.sin(yaw), cy = Math.cos(yaw);
	return { x: eye.x + sy * 1 + cy * 0.5, y: eye.y + 0.3 + Math.sin(t * 2.1) * 0.04, z: eye.z - cy * 1 + sy * 0.5 };
}
