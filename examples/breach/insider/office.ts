// ── The office — cubicles round a server room, offices off looped halls ─────
// The Insider Threat map: what a player walks into.
//
// Everything that varies desk to desk is a SLOT. A desk names where a computer,
// a few items and a chair go, by kind; `composeMap` fills each from the props of
// that kind with the seed. Add a prop with `kind: 'desk-item'` and every desk
// can grow one — nothing else changes.
//
// Frame: y-up metres. Every prop faces +z — a desk's sitter, a rack's front —
// and is turned into place by its yaw.
import { cuboid, prism, octagon, text3d, textWidth, windowWall, windowFrame, type MapDef, type MapProp, type Solid } from 'showcase';
import { OFFICE_DATA } from '../internal/office.gen.js';
import { SKIES } from './skies.js';

export const H = 4.2; // floor to ceiling
const BX = 32; // building half-extents
const BZ = 22;
const T = 0.3; // outer wall
const ROOM = { x: 7, z: 5, t: 0.15, door: 0.8, lintel: 2.2 }; // server room half-extents

/** Tip a solid back by `k` metres per metre of height — a laptop lid. A shear
 *  keeps every face planar, so a convex solid stays one. */
function lean(s: Solid, k: number): Solid {
	const h0 = Math.min(...s.verts.map((v) => v.h));
	return { ...s, verts: s.verts.map((v) => ({ ...v, n: v.n + k * (v.h - h0) })) };
}

// ── Props ─────────────────────────────────────────────────────────────────────
const props: Record<string, MapProp> = {
	// Structure. The walls are baked per size below.
	// An open ceiling: bare deck, steel beams and ducts, shop lights on chains.
	ceiling: { solids: [cuboid(-BX, BX, H, H + 0.2, -BZ, BZ)], material: 'ceiling' },
	beam: {
		ghost: true,
		solids: [
			cuboid(-BX, BX, H - 0.02, H, -0.1, 0.1), // top flange
			cuboid(-BX, BX, H - 0.33, H - 0.02, -0.012, 0.012), // web
			cuboid(-BX, BX, H - 0.35, H - 0.33, -0.1, 0.1) // bottom flange
		],
		material: 'steel'
	},
	duct: { ghost: true, solids: [cuboid(-BX + T, BX - T, H - 0.75, H - 0.35, -0.3, 0.3)], material: 'duct' },
	lamp: {
		ghost: true,
		solids: [
			cuboid(-0.46, -0.44, H - 1.35, H, -0.01, 0.01), // chains
			cuboid(0.44, 0.46, H - 1.35, H, -0.01, 0.01),
			cuboid(-0.62, 0.62, H - 1.4, H - 1.35, -0.11, 0.11), // reflector
			cuboid(-0.58, 0.58, H - 1.41, H - 1.4, -0.06, 0.06) // tubes
		],
		material: ['steel', 'steel', 'shade', 'lamp']
	},

	// The cubicle: three partitions, open to +z.
	partitions: {
		solids: [
			cuboid(-1.3, 1.3, 0, 1.4, -1.3, -1.25),
			cuboid(-1.3, -1.25, 0, 1.4, -1.25, 0.5),
			cuboid(1.25, 1.3, 0, 1.4, -1.25, 0.5)
		],
		material: 'partition'
	},
	desk: {
		solids: [
			cuboid(-1.15, 1.15, 0.72, 0.75, -0.4, 0.4),
			cuboid(-1.15, -1.1, 0, 0.72, -0.38, 0.38),
			cuboid(1.1, 1.15, 0, 0.72, -0.38, 0.38),
			cuboid(-1.1, 1.1, 0.25, 0.72, -0.4, -0.37)
		],
		material: 'desk',
		slots: [
			{ kind: 'desk-computer', x: 0, y: 0.75, z: -0.1, chance: 0.9, jitter: 0.08 },
			{ kind: 'desk-item', x: -0.8, y: 0.75, z: 0.05, chance: 0.75, jitter: 0.6 },
			{ kind: 'desk-item', x: 0.8, y: 0.75, z: 0.1, chance: 0.6, jitter: 0.6 },
			{ kind: 'desk-item', x: -0.5, y: 0.75, z: -0.25, chance: 0.35, jitter: 0.4 },
			{ kind: 'chair', x: 0, y: 0, z: 0.75, chance: 0.95, jitter: 0.5 }
		]
	},

	// kind: chair
	'task-chair': {
		kind: 'chair',
		solids: [
			cuboid(-0.28, 0.28, 0, 0.05, -0.28, 0.28),
			cuboid(-0.03, 0.03, 0.05, 0.42, -0.03, 0.03),
			cuboid(-0.25, 0.25, 0.42, 0.48, -0.25, 0.25),
			cuboid(-0.23, 0.23, 0.5, 1.0, 0.2, 0.25)
		],
		material: 'chair'
	},

	// kind: desk-computer
	desktop: {
		kind: 'desk-computer',
		weight: 2,
		ghost: true,
		solids: [
			cuboid(-0.12, 0.12, 0, 0.015, -0.1, 0.1), // stand foot
			cuboid(-0.02, 0.02, 0.015, 0.2, -0.06, -0.03), // neck
			cuboid(-0.29, 0.29, 0.12, 0.47, -0.04, -0.015), // bezel
			cuboid(-0.27, 0.27, 0.135, 0.455, -0.015, -0.012), // screen
			cuboid(-0.22, 0.22, 0, 0.02, 0.12, 0.27), // keyboard
			cuboid(0.4, 0.6, 0, 0.42, -0.25, 0.15), // tower
			cuboid(0.47, 0.53, 0.36, 0.38, 0.15, 0.155) // power light
		],
		material: ['metal', 'metal', 'metal', 'screen', 'metal', 'metal', 'led']
	},
	laptop: {
		kind: 'desk-computer',
		weight: 2,
		ghost: true,
		solids: [
			cuboid(-0.17, 0.17, 0, 0.018, -0.12, 0.12),
			lean(cuboid(-0.17, 0.17, 0.018, 0.25, -0.13, -0.12), 0.25),
			lean(cuboid(-0.155, 0.155, 0.03, 0.235, -0.12, -0.117), 0.25)
		],
		material: ['metal', 'metal', 'screen']
	},

	// kind: desk-item
	mug: {
		kind: 'desk-item',
		weight: 3,
		ghost: true,
		solids: [prism(octagon(0.04, 0.04), 0, 0.1), cuboid(0.04, 0.065, 0.025, 0.075, -0.008, 0.008)],
		material: 'ceramic'
	},
	files: {
		kind: 'desk-item',
		weight: 2,
		ghost: true,
		solids: [cuboid(-0.12, 0.12, 0, 0.015, -0.16, 0.16), cuboid(-0.105, 0.105, 0.015, 0.04, -0.145, 0.145)],
		material: ['folder', 'paper']
	},
	binder: {
		kind: 'desk-item',
		ghost: true,
		solids: [cuboid(-0.03, 0.03, 0, 0.3, -0.13, 0.13)],
		material: 'folder'
	},
	plant: {
		kind: 'desk-item',
		ghost: true,
		solids: [prism(octagon(0.06, 0.06), 0, 0.1), prism(octagon(0.1, 0.1), 0.1, 0.28)],
		material: ['ceramic', 'leaf']
	},

	// Insider Threat's fixtures: the stations that are not a bay desk or a rack.
	// Placed from office.gen.ts below, so each stands where the server checks a
	// player is standing.
	reception: {
		solids: [
			cuboid(-1.2, 1.2, 1.0, 1.06, -0.4, 0.35), // top
			cuboid(-1.2, 1.2, 0, 1.0, 0.3, 0.35), // front panel
			cuboid(-1.2, -1.15, 0, 1.0, -0.4, 0.3),
			cuboid(1.15, 1.2, 0, 1.0, -0.4, 0.3),
			cuboid(-0.27, 0.27, 1.06, 1.42, -0.22, -0.19), // monitor
			cuboid(-0.25, 0.25, 1.08, 1.4, -0.19, -0.185) // screen
		],
		material: ['desk', 'partition', 'partition', 'partition', 'metal', 'screen']
	},
	'delivery-shelf': {
		solids: [
			cuboid(-0.9, -0.85, 0, 1.8, -0.25, 0.25),
			cuboid(0.85, 0.9, 0, 1.8, -0.25, 0.25),
			cuboid(-0.9, 0.9, 0.4, 0.43, -0.25, 0.25),
			cuboid(-0.9, 0.9, 1.0, 1.03, -0.25, 0.25),
			cuboid(-0.9, 0.9, 1.6, 1.63, -0.25, 0.25),
			cuboid(-0.7, -0.15, 0.43, 0.8, -0.2, 0.2), // parcels
			cuboid(0.1, 0.65, 0.43, 0.7, -0.18, 0.18),
			cuboid(-0.5, 0.25, 1.03, 1.32, -0.2, 0.2)
		],
		material: ['metal', 'metal', 'metal', 'metal', 'metal', 'folder', 'folder', 'folder']
	},
	'comms-cabinets': {
		solids: [
			cuboid(-1.0, -0.05, 0, 2.1, -0.35, 0.35),
			cuboid(0.05, 1.0, 0, 2.1, -0.35, 0.35),
			cuboid(-0.8, -0.6, 1.6, 1.63, 0.35, 0.36),
			cuboid(0.2, 0.8, 1.2, 1.26, 0.35, 0.36),
			cuboid(0.2, 0.8, 0.9, 0.96, 0.35, 0.36)
		],
		material: ['rack', 'rack', 'led', 'port', 'port']
	},
	'coffee-counter': {
		solids: [
			cuboid(-0.8, 0.8, 0, 0.9, -0.3, 0.3),
			cuboid(-0.25, 0.15, 0.9, 1.35, -0.2, 0.15), // the machine
			cuboid(-0.2, 0.1, 1.2, 1.28, 0.15, 0.16),
			prism(octagon(0.04, 0.04), 0.9, 1.0)
		],
		material: ['desk', 'metal', 'led', 'ceramic']
	},

	'conference-table': {
		solids: [
			cuboid(-2.2, 2.2, 0.72, 0.76, -0.55, 0.55),
			cuboid(-1.6, -1.5, 0, 0.72, -0.3, 0.3),
			cuboid(1.5, 1.6, 0, 0.72, -0.3, 0.3)
		],
		material: 'desk',
		// Four a side, every sitter facing the table.
		slots: [-1.5, -0.5, 0.5, 1.5].flatMap((x) => [
			{ kind: 'chair', x, z: 0.95, jitter: 0.15 },
			{ kind: 'chair', x, z: -0.95, yaw: Math.PI, jitter: 0.15 }
		])
	},

	// The server room.
	rack: {
		solids: [cuboid(-0.3, 0.3, 0, 2.0, -0.5, 0.5)],
		material: 'rack',
		slots: Array.from({ length: 10 }, (_, i) => ({ kind: 'rack-unit', x: 0, y: 0.12 + i * 0.18, z: 0.5, chance: 0.8 }))
	},
	'server-1u': {
		kind: 'rack-unit',
		weight: 3,
		ghost: true,
		solids: [cuboid(-0.27, 0.27, 0, 0.08, 0, 0.012), cuboid(0.2, 0.24, 0.03, 0.05, 0.012, 0.016)],
		material: ['unit', 'led']
	},
	'server-2u': {
		kind: 'rack-unit',
		weight: 2,
		ghost: true,
		solids: [
			cuboid(-0.27, 0.27, 0, 0.16, 0, 0.012),
			cuboid(0.2, 0.24, 0.11, 0.13, 0.012, 0.016),
			cuboid(0.2, 0.24, 0.03, 0.05, 0.012, 0.016)
		],
		material: ['unit', 'led', 'led']
	},
	switch: {
		kind: 'rack-unit',
		ghost: true,
		solids: [cuboid(-0.27, 0.27, 0, 0.08, 0, 0.012), cuboid(-0.22, 0.1, 0.025, 0.055, 0.012, 0.016)],
		material: ['unit', 'port']
	}
};

// ── Layout ────────────────────────────────────────────────────────────────────
/** A wall over [x0, x1] × [y0, y1] × [z0, z1], in material `prop`. */
function wall(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, prop = 'wall') {
	return { prop, x: (x0 + x1) / 2, y: y0, z: (z0 + z1) / 2, sx: x1 - x0, sy: y1 - y0, sz: z1 - z0 };
}

// ── The glass ─────────────────────────────────────────────────────────────────
// The outer walls are glass floor to near ceiling, 110 floors up: `MapSky`
// draws the city through the gaps. A pier stands wherever an inside wall meets
// the glass, so no partition ends in mid-air against a pane. Each span between
// two piers is a `windowWall` with a `windowFrame` in its hole, authored with
// the room at +z and turned onto its side of the building.
const GLASS = { sill: 0.45, head: 3.55, pier: 0.8, pane: 1.6, t: 0.04 };

/** A span's frame: half-width, panes, and the heights its panes run between —
 *  what a skin needs to stand something on a sill or hang it in a corner. */
export interface Glazing {
	w: number;
	cols: number;
	sill: number;
	head: number;
	/** The mullions' half-thickness. */
	t: number;
}
export const GLAZING: Record<string, Glazing> = {};
const glassProps: Record<string, MapProp> = {};

/** The glass along one outer wall, `from` → `to` along it, broken at `piers`.
 *  `yaw` turns the room (+z) to face in. */
function glassRun(along: 'x' | 'z', at: number, from: number, to: number, piers: number[], yaw: number) {
	const stops = [from, ...piers.sort((a, b) => a - b), to];
	return stops.slice(1).flatMap((b, i) => {
		const a = stops[i];
		const w = (b - a) / 2;
		const ow = w - GLASS.pier / 2;
		const key = w.toFixed(2);
		const { sill, head, t } = GLASS;
		// The frame's sill a hair above the wall's, so the two tops never fight.
		const lo = sill + 0.02, hi = head - 2 * t;
		const cols = Math.max(1, Math.round((2 * ow) / GLASS.pane));
		glassProps[`glass-wall-${key}`] ??= { solids: windowWall(w, H, ow, sill, head, T / 2), material: 'wall' };
		if (!glassProps[`glass-frame-${key}`]) {
			glassProps[`glass-frame-${key}`] = { ghost: true, solids: windowFrame(ow - 2 * t, (hi - lo) / 2, (hi + lo) / 2, cols, 1, t), material: 'mullion' };
			GLAZING[`glass-frame-${key}`] = { w: ow - 2 * t, cols, sill: lo, head: hi, t };
		}
		const mid = (a + b) / 2;
		const p = along === 'x' ? { x: mid, z: at } : { x: at, z: mid };
		return [
			{ prop: `glass-wall-${key}`, ...p, yaw },
			{ prop: `glass-frame-${key}`, ...p, yaw }
		];
	});
}

const outerGlass = [
	...glassRun('x', -BZ + T / 2, -BX, BX, [-21.2, -14, -6, 6, 14, 21.2], 0),
	...glassRun('x', BZ - T / 2, -BX, BX, [-22, -10, 10, 22], Math.PI),
	...glassRun('z', -BX + T / 2, -BZ + T, BZ - T, [-13, -9, 13], Math.PI / 2),
	...glassRun('z', BX - T / 2, -BZ + T, BZ - T, [-14, -9, 13], -Math.PI / 2)
];
const { x: RX, z: RZ, t: RT, door: D, lintel: L } = ROOM;
const room = [
	...[-1, 1].flatMap((side) => {
		const z0 = side < 0 ? -RZ - RT : RZ;
		return [
			wall(-RX, -D, 0, H, z0, z0 + RT, 'glass'),
			wall(D, RX, 0, H, z0, z0 + RT, 'glass'),
			wall(-D, D, L, H, z0, z0 + RT, 'glass')
		];
	}),
	wall(-RX - RT, -RX, 0, H, -RZ - RT, RZ + RT, 'glass'),
	wall(RX, RX + RT, 0, H, -RZ - RT, RZ + RT, 'glass')
];

// ── Rooms and hallways ───────────────────────────────────────────────────────
// A trident, prongs north: the lobby is the handle, the bullpen round the
// server room the crossbar, three hallways run north from it and a fourth
// joins their tips, so each pair of prongs loops round a block of offices.
// Every wall and doorway sits between lamp rows (a multiple of 4m, ±2) or
// clear of them, so no shop light hangs through a wall.
const W = 0.15; // interior wall
const DOOR = 0.8; // doorway half-width
const NB = -BZ + T; // inside face of the north wall
const SB = BZ - T;
const WB = -BX + T;
const EB = BX - T;
const HALL = { tip: [-18, -15.6], prong: 1.2, side: [18.8, 21.2], mouth: -9 }; // the hallways
const SOUTH = 13; // the rooms along the front wall start here

const [TIP_N, TIP_S] = HALL.tip;
const [SIDE_IN, SIDE_OUT] = HALL.side;
const P = HALL.prong;
const M = HALL.mouth;

/** Every named room: its sign, its minimap label, and — for a private office —
 *  where Halloween puts something in the middle of the floor. */
export interface Room {
	name: string;
	rect: [x0: number, x1: number, z0: number, z1: number];
	office?: boolean;
}
export const ROOMS: Room[] = [
	{ name: 'CEO', rect: [-SIDE_OUT, -14, NB, TIP_N], office: true },
	{ name: 'Finance', rect: [-14, -6, NB, TIP_N], office: true },
	{ name: 'Conference', rect: [-6, 6, NB, TIP_N] },
	{ name: 'Legal', rect: [6, 14, NB, TIP_N], office: true },
	{ name: 'HR', rect: [14, SIDE_OUT, NB, TIP_N], office: true },
	{ name: 'Security', rect: [-SIDE_IN, -10, TIP_S, M], office: true },
	{ name: 'Product', rect: [-10, -P, TIP_S, M], office: true },
	{ name: 'Design', rect: [P, 10, TIP_S, M], office: true },
	{ name: 'IT', rect: [10, SIDE_IN, TIP_S, M], office: true },
	{ name: 'Comms', rect: [WB, -SIDE_OUT, NB, -13] },
	{ name: 'Sales', rect: [WB, -SIDE_OUT, -13, M], office: true },
	{ name: 'Marketing', rect: [SIDE_OUT, EB, NB, -14], office: true },
	{ name: 'Support', rect: [SIDE_OUT, EB, -14, M], office: true },
	{ name: 'Shipping', rect: [WB, -22, SOUTH, SB], office: true },
	{ name: 'Facilities', rect: [-22, -10, SOUTH, SB], office: true },
	{ name: 'Lobby', rect: [-10, 10, SOUTH, SB] },
	{ name: 'Records', rect: [10, 22, SOUTH, SB], office: true },
	{ name: 'Break room', rect: [22, EB, SOUTH, SB] },
	{ name: 'Server room', rect: [-RX, RX, -RZ, RZ] }
];
export const roomCentre = ({ rect: [x0, x1, z0, z1] }: Room) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2 });

/** A doorway's door: which room it opens into, what it is made of, and which
 *  jamb it hangs on, in the door's own frame (−1 is its left looking in). */
interface Door {
	at: number;
	room: string;
	leaf: 'wood' | 'glass';
	hinge?: 1 | -1;
}
/** Every doorway `run` cuts, in world terms: a door goes in it, a sign over it. */
const doorways: { x: number; z: number; yaw: number; room: string; leaf: Door['leaf']; hinge: 1 | -1 }[] = [];

/** A wall along x at z = `at` (axis 'x'), or along z at x = `at`, from `a` to
 *  `b`, with a doorway under a lintel at each door. `into` is the side the
 *  rooms are on, +1 toward +z (axis 'x') or +x (axis 'z'). */
function run(axis: 'x' | 'z', at: number, a: number, b: number, doors: Door[] = [], into: 1 | -1 = 1, prop = 'wall') {
	const seg = (s0: number, s1: number, y0: number) =>
		axis === 'x' ? wall(s0, s1, y0, H, at - W / 2, at + W / 2, prop) : wall(at - W / 2, at + W / 2, y0, H, s0, s1, prop);
	const out = [];
	let s = a;
	for (const d of [...doors].sort((p, q) => p.at - q.at)) {
		out.push(seg(s, d.at - DOOR, 0), seg(d.at - DOOR, d.at + DOOR, L));
		s = d.at + DOOR;
		// A door's own frame has the room at +z; turned so that +z is `into`.
		const yaw = axis === 'x' ? (into > 0 ? 0 : Math.PI) : into * (Math.PI / 2);
		doorways.push({ ...(axis === 'x' ? { x: d.at, z: at } : { x: at, z: d.at }), yaw, room: d.room, leaf: d.leaf, hinge: d.hinge ?? -1 });
	}
	out.push(seg(s, b, 0));
	return out;
}
const wood = (at: number, room: string, hinge?: 1 | -1): Door => ({ at, room, leaf: 'wood', hinge });
const glazed = (at: number, room: string, hinge?: 1 | -1): Door => ({ at, room, leaf: 'glass', hinge });

const interior = [
	// North row: offices either side of a conference room, doors onto the tip
	// hall. The conference doors hang on their outer jambs, clear of the table.
	...run('x', TIP_N, -SIDE_OUT, SIDE_OUT, [
		wood(-17.6, 'CEO'), wood(-10, 'Finance'), glazed(-3, 'Conference', 1), glazed(3, 'Conference', -1), wood(10, 'Legal'), wood(17.6, 'HR')
	], -1),
	...[-14, -6, 6, 14].flatMap((x) => run('z', x, NB, TIP_N)),
	// The two loops: a block of two offices between each pair of prongs, doors
	// onto the tip hall, glass onto the bullpen.
	...run('x', TIP_S, -SIDE_IN, -P, [glazed(-14.4, 'Security'), glazed(-5.6, 'Product')]),
	...run('x', TIP_S, P, SIDE_IN, [glazed(5.6, 'Design'), glazed(14.4, 'IT')]),
	...[-1, 1].flatMap((s) => [
		...run('x', M, s < 0 ? -SIDE_IN : P, s < 0 ? -P : SIDE_IN, [], 1, 'glass'),
		...run('z', s * P, TIP_S, M),
		...run('z', s * 10, TIP_S, M),
		...run('z', s * SIDE_IN, TIP_S, M)
	]),
	// The wings outside the outer prongs: the comms closet and an office west,
	// two offices east.
	...run('z', -SIDE_OUT, NB, M, [wood(-16.8, 'Comms'), wood(-11, 'Sales')], -1),
	...run('x', -13, WB, -SIDE_OUT),
	...run('x', M, WB, -SIDE_OUT, [], 1, 'glass'),
	...run('z', SIDE_OUT, NB, M, [wood(-16.8, 'Marketing'), wood(-11.5, 'Support')]),
	...run('x', -14, SIDE_OUT, EB),
	...run('x', M, SIDE_OUT, EB, [], 1, 'glass'),
	// The front: two offices, the lobby, an office and the break room.
	...run('x', SOUTH, WB, -10, [wood(-26.85, 'Shipping'), wood(-16, 'Facilities')]),
	...run('x', SOUTH, -10, -4),
	...run('x', SOUTH, 4, 10),
	...run('x', SOUTH, 10, 22, [wood(16, 'Records')]),
	...run('x', SOUTH, 22, EB, [glazed(24.5, 'Break room'), glazed(30, 'Break room', 1)]),
	...[-22, -10, 10, 22].flatMap((x) => run('z', x, SOUTH, SB))
];
// The server room's walls are its own (`room` above); its doors are not.
doorways.push(
	{ x: 0, z: -RZ - RT / 2, yaw: 0, room: 'Server room', leaf: 'glass', hinge: -1 },
	{ x: 0, z: RZ + RT / 2, yaw: Math.PI, room: 'Server room', leaf: 'glass', hinge: -1 }
);

const JAMB = DOOR - 0.05; // the jamb's inner face

/** A doorway's frame, in the doorway's frame: the wall runs along x, the room is +z. */
function doorFrame(leaf: Door['leaf']): MapProp {
	const j = JAMB, r = W / 2 + 0.01;
	return {
		solids: [cuboid(-DOOR, -j, 0, L, -r, r), cuboid(j, DOOR, 0, L, -r, r), cuboid(-DOOR, DOOR, L - 0.05, L, -r, r)],
		material: leaf === 'wood' ? 'trim' : 'metal'
	};
}

/** A door's leaf standing open, from its hinge: it runs +z into the room, flat
 *  against the jamb, its thickness on the jamb's side of the hinge. */
function doorLeaf(leaf: Door['leaf'], hinge: 1 | -1): MapProp {
	const t = 0.045;
	const [x0, x1] = hinge < 0 ? [0, t] : [-t, 0];
	const z0 = 0, z1 = 2 * JAMB;
	if (leaf === 'wood')
		return {
			solids: [cuboid(x0, x1, 0.01, L - 0.06, z0, z1), cuboid(x0 - 0.04, x1 + 0.04, 0.98, 1.03, z1 - 0.15, z1 - 0.07)],
			material: ['wood', 'metal']
		};
	return {
		solids: [
			cuboid(x0, x1, 0.01, 0.15, z0, z1), // kick rail
			cuboid(x0, x1, L - 0.18, L - 0.06, z0, z1),
			cuboid(x0, x1, 0.15, L - 0.18, z0, z0 + 0.06), // stiles
			cuboid(x0, x1, 0.15, L - 0.18, z1 - 0.06, z1),
			cuboid(x0 + 0.01, x1 - 0.01, 0.15, L - 0.18, z0 + 0.06, z1 - 0.06), // the pane
			cuboid(x0 - 0.05, x1 + 0.05, 0.8, 1.3, z1 - 0.16, z1 - 0.12) // pull bar
		],
		material: ['metal', 'metal', 'metal', 'metal', 'glass', 'metal']
	};
}

/** A leaf the scene swings rather than bakes, so it can open and shut. */
export interface SwingDoor {
	/** The leaf's prop, in `props`. */
	prop: string;
	/** The doorway's middle, where a player reaches for it. */
	x: number;
	z: number;
	/** The hinge, and the leaf's turn there standing open. */
	hinge: { x: number; z: number };
	yaw: number;
	/** The turn from open to shut. */
	swing: number;
}

/** A room's name over its door, on the hallway face of the lintel. Authored
 *  facing +z and turned to face out, so the hallway side is +z here. */
const SIGN = { size: 0.16, y: 2.45, pad: 0.1 };
function sign(name: string): MapProp {
	const w = textWidth(name, SIGN.size) / 2 + SIGN.pad;
	const z = W / 2;
	const letters = text3d(name, { size: SIGN.size, y: SIGN.y - SIGN.size / 2, z: z + 0.02 });
	return {
		ghost: true,
		solids: [cuboid(-w, w, SIGN.y - 0.17, SIGN.y + 0.17, z, z + 0.02), ...letters],
		material: ['sign', ...letters.map(() => 'sign-text')]
	};
}

const doorProps: Record<string, MapProp> = {};
const doorPuts = doorways.flatMap((d) => {
	const frame = `door-frame-${d.leaf}`;
	const plate = `sign-${d.room}`;
	doorProps[frame] ??= doorFrame(d.leaf);
	doorProps[`door-${d.leaf}-${d.hinge}`] ??= doorLeaf(d.leaf, d.hinge);
	doorProps[plate] ??= sign(d.room);
	return [
		{ prop: frame, x: d.x, z: d.z, yaw: d.yaw },
		{ prop: plate, x: d.x, z: d.z, yaw: d.yaw + Math.PI }
	];
});

/** Every door, hung on its jamb at the room face of the wall. Shut, the leaf
 *  turns a quarter toward the far jamb. */
export const DOORS: SwingDoor[] = doorways.map((d) => {
	const c = Math.cos(d.yaw), s = Math.sin(d.yaw);
	const hx = d.hinge * JAMB, hz = W / 2;
	return {
		prop: `door-${d.leaf}-${d.hinge}`,
		x: d.x,
		z: d.z,
		hinge: { x: d.x + c * hx + s * hz, z: d.z - s * hx + c * hz },
		yaw: d.yaw,
		swing: d.hinge < 0 ? Math.PI / 2 : -Math.PI / 2
	};
});

/** A desk in each private office, the sitter facing the door: yaw 0 sits
 *  them on the +z side, looking −z. */
const officeDesks = [
	...[-17.6, -10, 10, 17.6].map((x) => ({ prop: 'desk', x, z: NB + 1.6, yaw: Math.PI })),
	...[-14.4, -5.6, 5.6, 14.4].map((x) => ({ prop: 'desk', x, z: M - 1.6 })),
	{ prop: 'desk', x: -26.5, z: M - 1.6 },
	{ prop: 'desk', x: 26.5, z: -14 - 1.6 },
	{ prop: 'desk', x: 26.5, z: M - 1.6 },
	...[-26.85, -16, 16].map((x) => ({ prop: 'desk', x, z: SB - 1.6 }))
];

const RACKS = 14;
const racks = [-1, 1].flatMap((side) =>
	Array.from({ length: RACKS }, (_, i) => ({
		prop: 'rack',
		x: (i - (RACKS - 1) / 2) * 0.65,
		z: side * 2.2,
		// Fronts face the cold aisle down the middle.
		yaw: side < 0 ? 0 : Math.PI
	}))
);

const PODS_X = [-25.5, -15.3, 15.3, 25.5];
const PODS_Z = [-4, 4];
/** Clear floor round the server room, so it reads as the middle of the building. */
const CLEAR = { x: 9, z: 7 };
/** The open areas Insider Threat plays in — lobby, break room, comms closet —
 *  read from office.gen.ts, so a desk is never standing where the server says
 *  the lobby is. A pod's footprint is ±3.9 by ±2.6. */
const OPEN = OFFICE_DATA.zones.filter((z) => z.key === 'lobby' || z.key === 'break' || z.key === 'comms').map((z) => z.rect);
const inOpen = (x: number, z: number) => OPEN.some((r) => x + 3.9 > r.x0 && x - 3.9 < r.x1 && z + 2.6 > r.z0 && z - 2.6 < r.z1);
const pods = PODS_Z.flatMap((z, row) =>
	PODS_X.flatMap((x, col) =>
		(Math.abs(x) - 3.9 < CLEAR.x && Math.abs(z) - 2.6 < CLEAR.z) || inOpen(x, z)
			? []
			: [{ chunk: 'pod', x, z, label: `bay ${'ABCDE'[row]}${col + 1}` }]
	)
);

/** Which fixture stands at each kind of station, nudged toward the wall it
 *  backs onto (dz) and turned to face the room. Bay desks and racks are
 *  already on the floor. */
const FIXTURES: Record<string, { prop: string; dz: number; yaw: number }> = {
	desk: { prop: 'reception', dz: 0, yaw: 0 },
	delivery_shelf: { prop: 'delivery-shelf', dz: 0.8, yaw: Math.PI },
	comms_closet: { prop: 'comms-cabinets', dz: -1.6, yaw: 0 },
	kitchen: { prop: 'coffee-counter', dz: 1.1, yaw: Math.PI }
};
const fixtures = OFFICE_DATA.stations.flatMap((s) => {
	const f = FIXTURES[s.kind];
	return f ? [{ prop: f.prop, x: s.x, z: s.z + f.dz, yaw: f.yaw }] : [];
});

const lamps: { prop: string; x: number; z: number }[] = [];
for (let x = -28; x <= 28; x += 4) for (let z = -20; z <= 20; z += 4) lamps.push({ prop: 'lamp', x, z });
// Beams between the lamp rows; the ducts run either side of the server room.
const overhead = [
	...Array.from({ length: 10 }, (_, i) => ({ prop: 'beam', x: 0, z: -18 + i * 4 })),
	{ prop: 'duct', x: 0, z: -RZ - 2 },
	{ prop: 'duct', x: 0, z: RZ + 2 }
];

// A placement's scale is uniform, so a wall cannot be one unit box stretched per
// put; each is its own prop.
const wallProps: Record<string, MapProp> = {};
const wallPuts = [...room, ...interior].map((w, i) => {
	const id = `${w.prop}-${i}`;
	wallProps[id] = {
		solids: [cuboid(-w.sx / 2, w.sx / 2, 0, w.sy, -w.sz / 2, w.sz / 2)],
		material: w.prop
	};
	return { prop: id, x: w.x, y: w.y, z: w.z };
});

export const OFFICE: MapDef = {
	id: 'office',
	label: 'Office · plain',
	dev: true,
	sky: [SKIES.city, SKIES.brick, SKIES.hall],
	materials: {
		carpet: { face: ['--bg-elev', '--palette-slate', 0.12], lit: 0 },
		tile: { face: ['--bg-elev', '--border-strong', 0.45], lit: 0 },
		grid: { face: '--border', lit: 0 },
		wall: { face: ['--border-strong', '--bg-elev', 0.55], edge: '--border-strong' },
		glass: { face: ['--palette-sky', '--bg', 0.78], edge: '--palette-sky' },
		ceiling: { face: ['--bg', '--palette-zinc', 0.3] },
		steel: { face: ['--bg', '--palette-zinc', 0.45], edge: '--border-strong' },
		duct: { face: ['--palette-zinc', '--bg', 0.35], edge: '--border-strong' },
		shade: { face: ['--palette-zinc', '--bg', 0.5], edge: '--border-strong' },
		lamp: { face: ['--fg', '--palette-amber', 0.1], lit: 0, glow: true },
		partition: { face: ['--border-strong', '--palette-slate', 0.3], edge: '--border' },
		desk: { face: ['--palette-amber', '--bg', 0.6], edge: '--border-strong' },
		chair: { face: ['--palette-zinc', '--bg', 0.55] },
		metal: { face: ['--palette-zinc', '--bg', 0.45], edge: '--border-strong' },
		screen: { face: ['--accent', '--bg', 0.35], lit: 0, glow: true },
		ceramic: { face: ['--fg', '--bg', 0.2] },
		paper: { face: ['--fg', '--bg', 0.3] },
		folder: { face: ['--palette-amber', '--bg', 0.3] },
		leaf: { face: ['--palette-emerald', '--bg', 0.35] },
		rack: { face: ['--bg', '--palette-zinc', 0.3], edge: '--accent' },
		unit: { face: ['--palette-zinc', '--bg', 0.6] },
		led: { face: '--palette-emerald', lit: 0, glow: true },
		port: { face: '--palette-amber', lit: 0, glow: true },
		wood: { face: ['--palette-amber', '--bg', 0.45], edge: '--border-strong' },
		trim: { face: ['--palette-amber', '--bg', 0.7], edge: '--border-strong' },
		sign: { face: ['--bg', '--palette-zinc', 0.25], edge: '--border-strong' },
		'sign-text': { face: '--fg', lit: 0, glow: true },
		mullion: { face: ['--palette-zinc', '--bg', 0.7], edge: '--border-strong' }
	},
	props: { ...props, ...wallProps, ...glassProps, ...doorProps },
	chunks: {
		// A desk, its partitions, and the chair the desk's slot brings.
		cubicle: [{ prop: 'partitions', x: 0, z: 0 }, { prop: 'desk', x: 0, z: -0.85 }],
		// Six cubicles, two rows back to back, opening onto the aisles either side.
		pod: [-2.6, 0, 2.6].flatMap((x) => [
			{ chunk: 'cubicle', x, z: -1.3, yaw: Math.PI },
			{ chunk: 'cubicle', x, z: 1.3 }
		])
	},
	puts: [
		{ prop: 'ceiling', x: 0, z: 0 },
		...wallPuts,
		...outerGlass,
		...lamps,
		...overhead,
		...racks,
		...fixtures,
		...officeDesks,
		...doorPuts,
		{ prop: 'conference-table', x: 0, z: (NB + TIP_N) / 2 },
		...pods.map(({ chunk, x, z }) => ({ chunk, x, z }))
	],
	floor: [
		{ material: 'carpet', rects: [[-BX, BX, -BZ, BZ]] },
		{ material: 'tile', rects: [[-RX, RX, -RZ, RZ]] }
	],
	grid: { step: 2, material: 'grid' },
	spawn: { x: 0, y: 0, z: BZ - 2 },
	bounds: { x0: -BX + T, x1: BX - T, z0: -BZ + T, z1: BZ - T },
	landmarks: [
		...ROOMS.map((r) => ({ label: r.name.toLowerCase(), ...roomCentre(r) })),
		...pods.map((p) => ({ label: p.label, x: p.x, z: p.z })),
		...OFFICE_DATA.stations.map((s) => ({ label: s.name.toLowerCase(), x: s.x, z: s.z }))
	]
};
