// ── Doors — leaves that open and shut ────────────────────────────────────────
// A map bakes its door frames; the leaves (`SwingDoor`, office.ts) are left
// out so the scene can turn them on their hinges. E works the door you stand
// at. A shut leaf is solid, to you and to your line of sight; while it swings
// it is already whatever it is swinging to.
//
// Yours alone: a pose on the wire carries no doors, so another player walks
// through the door you shut, and bots always do.
import { composeMap, type MapDef, type World } from 'showcase';
import type { SwingDoor } from './office.js';

/** Seconds a leaf takes to swing. */
export const SWING_S = 0.45;
/** How near a doorway's middle you must stand to work it. */
export const REACH = 1.8;
/** Shut on nobody: inside this of the doorway's middle, it will not close. */
const CLEAR = 0.9;

export interface DoorState {
	door: SwingDoor;
	shut: boolean;
	/** 0 open to 1 shut, easing toward `shut`. */
	at: number;
}

export const doorStates = (doors: SwingDoor[]): DoorState[] => doors.map((door) => ({ door, shut: false, at: 0 }));

export function stepDoors(ds: DoorState[], dt: number) {
	for (const d of ds) d.at = Math.min(1, Math.max(0, d.at + ((d.shut ? 1 : -1) * dt) / SWING_S));
}

/** The door you would work standing at `p`, or null. */
export function doorAt(ds: DoorState[], p: { x: number; z: number }): DoorState | null {
	let best: DoorState | null = null, bd = REACH;
	for (const d of ds) {
		const r = Math.hypot(d.door.x - p.x, d.door.z - p.z);
		if (r < bd) [best, bd] = [d, r];
	}
	return best;
}

/** Shut `d` if open, open it if shut. False when you stand in its way. */
export function toggle(d: DoorState, p: { x: number; z: number }): boolean {
	if (!d.shut && Math.hypot(d.door.x - p.x, d.door.z - p.z) < CLEAR) return false;
	d.shut = !d.shut;
	return true;
}

/** The leaf's model matrix `at` of the way shut: turned on its hinge, in
 *  composeMap's sense of yaw. */
export function leafModel(d: DoorState, out: Float32Array) {
	const yaw = d.door.yaw + d.door.swing * (1 - (1 - d.at) * (1 - d.at));
	const c = Math.cos(yaw), s = Math.sin(yaw);
	out.set([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, d.door.hinge.x, 0, d.door.hinge.z, 1]);
	return out;
}

/** `def` with only `prop` put once, at `at`: to bake one leaf on its own. */
const alone = (def: MapDef, prop: string, at: { x: number; z: number; yaw: number }): MapDef => ({
	...def,
	props: { [prop]: def.props[prop] },
	puts: [{ prop, ...at }],
	floor: undefined,
	grid: undefined
});

/** A leaf's triangles from its hinge, for drawing with `leafModel`. */
export const leafMesh = (def: MapDef, prop: string) => composeMap(alone(def, prop, { x: 0, z: 0, yaw: 0 })).batches;

/** `world` with every shut door's leaf in it. `hulls` caches each door's. */
export function withDoors(world: World, ds: DoorState[], def: MapDef, hulls: Map<SwingDoor, World['hulls']>): World {
	const shut = ds.filter((d) => d.shut);
	if (!shut.length) return world;
	const extra = shut.flatMap(({ door }) => {
		let h = hulls.get(door);
		if (!h) hulls.set(door, (h = composeMap(alone(def, door.prop, { ...door.hinge, yaw: door.yaw + door.swing })).world.hulls));
		return h;
	});
	return { ...world, hulls: [...world.hulls, ...extra] };
}
