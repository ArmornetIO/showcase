// ── game/map — first-person maps, composed from props ────────────────────────
// A map is DATA: a catalogue of props, a few reusable chunks of them, and a list
// of where each one stands. `composeMap` turns that into the two things a scene
// needs — triangles to draw, batched by material, and hulls to walk against —
// in one pass, so what you see and what you bump into cannot disagree.
//
//  · A PROP is a piece (convex solids, `mesh-studio/pieces`) with a material per
//    solid. Authored in metres in the pieces' own (e, n, h) frame; `cuboid` lets
//    you write it in the map's (x, y, z) instead.
//  · A prop has a KIND, and may carry SLOTS. A slot names a kind, and is filled
//    at compose time by a seeded pick among the props of that kind — so forty
//    desks hold forty different arrangements of mugs, laptops and files, and a
//    reroll is a new seed rather than a new map.
//  · A CHUNK is a named list of placements in its own frame (a cubicle, a pod of
//    cubicles), placed like a prop. Chunks nest.
//
// World frame: y-up metres. A piece's (e, n, h) is (x, −z, y) — the same proper
// rotation the street has always used, so counter-clockwise-from-outside
// survives and the default front face culls correctly.
//
// Pure: no Svelte, no DOM, no GL.
import { box, type Piece } from '../mesh-studio/pieces/pieces.js';
import { meshPiece, PIECE_VERT_FLOATS, type PieceMesh } from '../mesh-studio/pieces/piece-mesh.js';
import { climbableByDefault } from '../mesh-studio/pieces/piece-hulls.js';
import { hullFromFaces, type World } from '../physics/hull.js';
import type { Vec3 } from '../physics/sphere.js';

/** Where something stands in its parent's frame: y-up metres, turned about +y. */
export interface Place {
	x: number;
	y?: number;
	z: number;
	yaw?: number;
	scale?: number;
}

/** A spot on a prop that some other prop of `kind` fills. */
export interface Slot extends Place {
	kind: string;
	/** Chance it is filled at all. Default 1. */
	chance?: number;
	/** Random extra turn, up to ± this many radians. */
	jitter?: number;
}

export interface MapProp {
	/** Convex solids, counter-clockwise from outside, in metres. */
	solids: Piece;
	/** MapMaterial per solid, or one for all of them. */
	material: string | string[];
	/** What fills a slot of the same kind. */
	kind?: string;
	/** Pick weight among its kind. Default 1. */
	weight?: number;
	/** Walked through rather than into: desk clutter. Default false. */
	ghost?: boolean;
	slots?: Slot[];
	/** A light the prop gives off, wherever a slot drops it. */
	light?: MapLight;
}

/** A point light, in its prop's frame. */
export interface MapLight {
	x?: number;
	y: number;
	z?: number;
	tone: Tone;
	/** Metres to dark. */
	radius: number;
	/** How much it gutters, 0 steady to 1 guttering out. */
	flicker?: number;
	/** The name a light cue addresses it by: `candle`, `pumpkin`. */
	group?: string;
}

/** A light as composed: where it ended up. */
export interface PlacedLight {
	x: number;
	y: number;
	z: number;
	tone: Tone;
	radius: number;
	flicker: number;
	group: string;
	/** Per-light phase, so a room of candles does not gutter in step. */
	phase: number;
}

/** A colour is a CSS token, or a mix of two at `t`. */
export type Tone = string | [string, string, number];

export interface MapMaterial {
	face: Tone;
	/** Wireframe colour. No edges when absent. */
	edge?: Tone;
	/** 1 takes the three-band shade, 0 is flat colour (a screen, a lamp). Default 1. */
	lit?: number;
	/** Gives off its own light: drawn at full colour however dark the map is. */
	glow?: boolean;
}

/** A prop or a chunk, somewhere. */
export interface Put extends Place {
	prop?: string;
	chunk?: string;
}

/** Flat rectangles painted at y = 0, in order, under everything. */
export interface FloorLayer {
	material: string;
	/** [x0, x1, z0, z1] */
	rects: [number, number, number, number][];
}

export interface MapDef {
	id: string;
	label: string;
	/** Loadable from the dev tools only — never offered to a player. */
	dev?: boolean;
	materials: Record<string, MapMaterial>;
	props: Record<string, MapProp>;
	chunks?: Record<string, Put[]>;
	puts: Put[];
	floor?: FloorLayer[];
	grid?: { step: number; material: string };
	spawn: { x: number; y: number; z: number; yaw?: number };
	/** The walls that keep a walker in, on x and z. */
	bounds: { x0: number; x1: number; z0: number; z1: number };
	/** Named spots, for "where am I" readouts. */
	landmarks?: { label: string; x: number; z: number }[];
	/** How lit the map is with no prop light near: 1 (the default) is daylight,
	 *  where prop lights add nothing worth drawing. */
	ambient?: number;
	/** The worlds outside the windows, drawn by `game/sky-gl` wherever nothing
	 *  of the map stands in front of it. A match draws one, picked by its
	 *  `scenery`, so every seat sees the same. None: the fog colour. */
	sky?: MapSky[];
}

/** What lies past the glass. Ray-marched, not modelled: the map never holds a
 *  triangle of it. The tones read per view:
 *
 *  · `city`  — towers and streets `altitude` metres down. `facade` the towers,
 *              `windows` their lights, `street` lamps and traffic.
 *  · `brick` — a neighbour's wall across a narrow gap, the alley falling away
 *              below and a strip of sky above. `facade` the brick, `windows`
 *              its lit windows, `street` our own light spilling onto it.
 *  · `hall`  — more office, a corridor round ours. `facade` its walls,
 *              `windows` its doors, carpet and signs, `street` its lamps,
 *              `zenith` the dark its far end goes to. */
export interface MapSky {
	view?: 'city' | 'brick' | 'hall';
	altitude: number;
	/** A different city for a different seed. */
	seed?: number;
	zenith: Tone;
	horizon: Tone;
	/** The air over the far city, and the glow on the horizon. */
	haze: Tone;
	facade: Tone;
	windows: [Tone, Tone, Tone];
	street: Tone;
	/** Share of windows lit, 0..1. */
	lit: number;
	/** The hour shown, 0–24, or `adaptive` to follow the player's own clock.
	 *  Default 21. */
	time?: number | 'adaptive';
	/** `hall`: its ceiling, metres. Default 4.2. */
	ceiling?: number;
	/** What the sky turns to with the sun up. Without it every hour is night. */
	day?: { zenith: Tone; horizon: Tone; haze: Tone; facade: Tone; sun: Tone };
	/** How much the glass softens the view: 0 clear, 1 frosted. Default 0.5. */
	glass?: number;
	/** `yaw` as the camera's (0 looks −z), `el` and `size` in radians. */
	moon?: { tone: Tone; yaw: number; el: number; size: number };
	/** Bats across the moon, windows guttering, lightning far off. */
	haunted?: boolean;
}

/** Every triangle of one material, in world space, in the `PieceMesh` vertex
 *  layout with an identity model — (x, −z, y), world normal, h/maxH. */
export interface Batch {
	material: string;
	tris: Float32Array;
	edges: Float32Array;
}

export interface ComposedMap {
	def: MapDef;
	world: World;
	batches: Batch[];
	floor: { material: string; tris: Float32Array }[];
	grid: Float32Array | null;
	/** Solid faces by what a walker makes of them. Walls are left out. */
	overlay: { walkable: Float32Array; climbable: Float32Array };
	lights: PlacedLight[];
	/** How many props were placed, slot fills included. */
	placed: number;
}

/** A box written in the map's frame: x right, y up, z toward the viewer. */
export function cuboid(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
	return box(x0, x1, -z1, -z0, y0, y1);
}

/** Small, fast, seedable. A map is the same map for the same seed everywhere. */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A placement resolved to world space: where a put's own frame sits. Not
 *  `Frame`: the barrel already exports a `Frame` component. */
export interface MapFrame {
	x: number;
	y: number;
	z: number;
	yaw: number;
	scale: number;
}

export const ROOT: MapFrame = { x: 0, y: 0, z: 0, yaw: 0, scale: 1 };

/** `p`, given in frame `f`, in `f`'s parent's terms. Exported so an editor
 *  flattening chunks lands every put exactly where `composeMap` would. */
export function within(f: MapFrame, p: Place): MapFrame {
	const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
	const px = p.x * f.scale, pz = p.z * f.scale;
	return {
		x: f.x + c * px + s * pz,
		y: f.y + (p.y ?? 0) * f.scale,
		z: f.z - s * px + c * pz,
		yaw: f.yaw + (p.yaw ?? 0),
		scale: f.scale * (p.scale ?? 1)
	};
}

/** Chunks inside chunks and props inside slots inside props: past this the
 *  definition is cyclic, not deep. */
const MAX_DEPTH = 8;

const meshes = new WeakMap<MapProp, { material: string; mesh: PieceMesh; solids: Piece }[]>();

/** A prop's solids grouped by material and flattened, once per prop. */
function groups(prop: MapProp) {
	const hit = meshes.get(prop);
	if (hit) return hit;
	const by = new Map<string, Piece>();
	prop.solids.forEach((s, i) => {
		const m = typeof prop.material === 'string' ? prop.material : prop.material[i];
		by.set(m, [...(by.get(m) ?? []), s]);
	});
	const out = [...by].map(([material, solids]) => ({ material, mesh: meshPiece(solids), solids }));
	meshes.set(prop, out);
	return out;
}

export function composeMap(def: MapDef, seed = 1): ComposedMap {
	const rand = rng(seed);
	const byKind = new Map<string, [string, MapProp][]>();
	for (const [id, p] of Object.entries(def.props))
		if (p.kind) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), [id, p]]);

	const tris = new Map<string, number[]>();
	const edges = new Map<string, number[]>();
	const overlay = { walkable: [] as number[], climbable: [] as number[] };
	const hulls: World['hulls'] = [];
	const lights: PlacedLight[] = [];
	let placed = 0;

	function pick(kind: string): MapProp | null {
		const options = byKind.get(kind);
		if (!options) return null;
		let r = rand() * options.reduce((t, [, p]) => t + (p.weight ?? 1), 0);
		for (const [, p] of options) if ((r -= p.weight ?? 1) < 0) return p;
		return options[options.length - 1][1];
	}

	function emit(prop: MapProp, f: MapFrame, depth: number) {
		if (depth > MAX_DEPTH) throw new Error(`map ${def.id}: nesting deeper than ${MAX_DEPTH} — a chunk or slot contains itself`);
		placed++;
		const c = Math.cos(f.yaw), s = Math.sin(f.yaw), k = f.scale;
		if (prop.light) {
			const l = prop.light, at = within(f, { x: l.x ?? 0, y: l.y, z: l.z ?? 0 });
			lights.push({ x: at.x, y: at.y, z: at.z, tone: l.tone, radius: l.radius * k, flicker: l.flicker ?? 0, group: l.group ?? '', phase: rand() * 100 });
		}
		// Piece (e, n, h) → world (x, y, z), then back out as the identity-model
		// layout (x, −z, y) the shader maps through.
		const wx = (e: number, n: number) => f.x + k * (c * e - s * n);
		const wz = (e: number, n: number) => f.z + k * (-s * e - c * n);
		const nx = (e: number, n: number) => c * e - s * n;
		const nz = (e: number, n: number) => -s * e - c * n;
		const out = (into: number[], b: Float32Array) => {
			for (let i = 0; i < b.length; i += PIECE_VERT_FLOATS) {
				const e = b[i], n = b[i + 1], h = b[i + 2];
				const ne = b[i + 3], nn = b[i + 4], nh = b[i + 5];
				into.push(wx(e, n), -wz(e, n), f.y + k * h, nx(ne, nn), -nz(ne, nn), nh, b[i + 6]);
			}
		};
		for (const g of groups(prop)) {
			if (!tris.has(g.material)) tris.set(g.material, []);
			if (!edges.has(g.material)) edges.set(g.material, []);
			out(tris.get(g.material)!, g.mesh.verts);
			out(edges.get(g.material)!, g.mesh.edges);
			if (prop.ghost) continue;
			const scratch: number[] = [];
			out(scratch, g.mesh.verts);
			for (let t = 0; t < scratch.length; t += PIECE_VERT_FLOATS * 3) {
				const ny = scratch[t + 5];
				const into = ny >= 0.7 ? overlay.walkable : climbableByDefault(ny) ? overlay.climbable : null;
				if (into) for (let j = 0; j < PIECE_VERT_FLOATS * 3; j++) into.push(scratch[t + j]);
			}
			for (const solid of g.solids) {
				const verts: Vec3[] = solid.verts.map((v) => ({ x: wx(v.e, v.n), y: f.y + k * v.h, z: wz(v.e, v.n) }));
				const climbable = solid.faces.map((face) => {
					const [a, b, cc] = face.map((i) => verts[i]);
					const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
					const vx = cc.x - a.x, vy = cc.y - a.y, vz = cc.z - a.z;
					const ny = uz * vx - ux * vz;
					const len = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx) || 1;
					return climbableByDefault(ny / len);
				});
				hulls.push(hullFromFaces(verts, solid.faces, climbable));
			}
		}
		for (const slot of prop.slots ?? []) {
			if (rand() >= (slot.chance ?? 1)) continue;
			const fill = pick(slot.kind);
			if (!fill) continue;
			const turn = slot.jitter ? (rand() * 2 - 1) * slot.jitter : 0;
			emit(fill, within(f, { ...slot, yaw: (slot.yaw ?? 0) + turn }), depth + 1);
		}
	}

	function put(p: Put, parent: MapFrame, depth: number) {
		if (depth > MAX_DEPTH) throw new Error(`map ${def.id}: nesting deeper than ${MAX_DEPTH} — a chunk contains itself`);
		const f = within(parent, p);
		if (p.chunk) {
			const chunk = def.chunks?.[p.chunk];
			if (!chunk) throw new Error(`map ${def.id}: no chunk "${p.chunk}"`);
			for (const q of chunk) put(q, f, depth + 1);
		}
		if (p.prop) {
			const prop = def.props[p.prop];
			if (!prop) throw new Error(`map ${def.id}: no prop "${p.prop}"`);
			emit(prop, f, depth);
		}
	}

	for (const p of def.puts) put(p, ROOT, 0);

	const b = def.bounds;
	return {
		def,
		world: {
			hulls,
			groundY: 0,
			bounds: { min: { x: b.x0, y: 0, z: b.z0 }, max: { x: b.x1, y: 0, z: b.z1 } }
		},
		batches: [...tris].map(([material, t]) => ({
			material,
			tris: new Float32Array(t),
			edges: new Float32Array(edges.get(material) ?? [])
		})),
		floor: (def.floor ?? []).map((l) => ({ material: l.material, tris: flat(l.rects) })),
		grid: def.grid ? gridLines(b, def.grid.step) : null,
		overlay: { walkable: new Float32Array(overlay.walkable), climbable: new Float32Array(overlay.climbable) },
		lights,
		placed
	};
}

function flat(rects: [number, number, number, number][]): Float32Array {
	const out: number[] = [];
	for (const [x0, x1, z0, z1] of rects)
		for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]])
			out.push(x, -z, 0, 0, 0, 1, 0);
	return new Float32Array(out);
}

function gridLines(b: MapDef['bounds'], step: number): Float32Array {
	const out: number[] = [];
	for (let x = Math.ceil(b.x0 / step) * step; x <= b.x1; x += step)
		out.push(x, -b.z0, 0, 0, 0, 1, 0, x, -b.z1, 0, 0, 0, 1, 0);
	for (let z = Math.ceil(b.z0 / step) * step; z <= b.z1; z += step)
		out.push(b.x0, -z, 0, 0, 0, 1, 0, b.x1, -z, 0, 0, 0, 1, 0);
	return new Float32Array(out);
}
