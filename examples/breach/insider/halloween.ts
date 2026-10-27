// ── The office, after hours, on the 31st ─────────────────────────────────────
// The same floor as `office.ts` — same stations, same zones, so the server's
// coordinates still hold — with the overheads dead and a party nobody admits
// to throwing laid over it. Everything spooky is a SLOT fill, so a reroll is a
// different party: a desk may grow a pumpkin, a lamp a bat, a chair a guest
// who never went home.
//
// The props that give off light carry it (`MapProp.light`), so a pumpkin
// dropped by a slot lights the cubicle it lands in. Lights are grouped
// (`candle`, `pumpkin`, `cauldron`) so a cue can gutter one kind at a time.
import { cuboid, prism, octagon, panel, type MapDef, type MapProp, type Put } from 'showcase';
import { OFFICE, H, ROOMS, GLAZING, roomCentre } from './office.js';
import type { LocalCue } from './lighting.js';
import { SKIES } from './skies.js';

/** What the party does to you, and only you, as you walk it. */
export const HALLOWEEN_CUES: LocalCue[] = [
	{ zone: 'server', cue: 'flicker_out' },
	{ zone: 'comms', cue: 'blackout' },
	{ zone: 'break', cue: 'candles_gutter' },
	{ station: 'rack_registry', cue: 'blood_red' }
];

/** A round thing at (x, z) in the map's frame. */
const disc = (x: number, z: number, r: number, y0: number, y1: number) =>
	prism(octagon(r, r).map(([e, n]) => [e + x, n - z] as [number, number]), y0, y1);

// The front of a pumpkin is the flat of its widest octagon, at z = +0.15.
const JACK: MapProp = {
	ghost: true,
	solids: [
		disc(0, 0, 0.11, 0, 0.03),
		disc(0, 0, 0.15, 0.03, 0.16),
		disc(0, 0, 0.11, 0.16, 0.2),
		cuboid(-0.012, 0.012, 0.2, 0.25, -0.012, 0.012),
		cuboid(-0.08, -0.03, 0.1, 0.13, 0.14, 0.155),
		cuboid(0.03, 0.08, 0.1, 0.13, 0.14, 0.155),
		cuboid(-0.07, 0.07, 0.05, 0.075, 0.14, 0.155)
	],
	material: ['pumpkin', 'pumpkin', 'pumpkin', 'stem', 'ember', 'ember', 'ember'],
	light: { y: 0.12, z: 0.3, tone: '--palette-orange', radius: 3.5, flicker: 0.35, group: 'pumpkin' }
};

const CHAIR = OFFICE.props['task-chair'];
const DESK = OFFICE.props.desk;
const TABLE = OFFICE.props['conference-table'];

const spooky: Record<string, MapProp> = {
	// The overheads, mostly dead, with something hanging off a few. The ones
	// still on are a slot too, so a reroll lights a different scatter of floor.
	lamp: {
		...OFFICE.props.lamp,
		slots: [
			{ kind: 'lamp-on', x: 0, z: 0, chance: 0.12 },
			{ kind: 'hang', x: -0.9, y: H, z: 0, chance: 0.3, jitter: Math.PI },
			{ kind: 'hang', x: 0.9, y: H, z: 0, chance: 0.2, jitter: Math.PI }
		]
	},
	// A lit tube a hair proud of the dead one, so it draws over it. Its light
	// sits low and short so it pools on the floor under it, about 4m across,
	// rather than washing the whole bay.
	'lamp-on': {
		kind: 'lamp-on',
		ghost: true,
		solids: [cuboid(-0.585, 0.585, H - 1.415, H - 1.4, -0.065, 0.065)],
		material: 'lamp-lit',
		light: { y: 2, tone: ['--fg', '--palette-sky', 0.2], radius: 4.5, flicker: 0.08, group: 'overhead' }
	},
	desk: {
		...DESK,
		slots: [...(DESK.slots ?? []), { kind: 'spooky-desk', x: 0.55, y: 0.75, z: -0.22, chance: 0.45, jitter: 0.5 }]
	},

	// kind: spooky-desk — on a desk, or a party table.
	'jack-o-lantern': { ...JACK, kind: 'spooky-desk', weight: 3 },
	candles: {
		kind: 'spooky-desk',
		weight: 2,
		ghost: true,
		solids: [
			disc(-0.06, 0, 0.022, 0, 0.18),
			disc(0.02, 0.03, 0.022, 0, 0.12),
			disc(0.07, -0.03, 0.022, 0, 0.22),
			cuboid(-0.07, -0.05, 0.18, 0.21, -0.006, 0.006),
			cuboid(0.01, 0.03, 0.12, 0.15, -0.036, -0.024),
			cuboid(0.06, 0.08, 0.22, 0.25, 0.024, 0.036)
		],
		material: ['wax', 'wax', 'wax', 'flame', 'flame', 'flame'],
		light: { y: 0.28, tone: '--palette-amber', radius: 2.5, flicker: 0.6, group: 'candle' }
	},
	skull: {
		kind: 'spooky-desk',
		weight: 2,
		ghost: true,
		solids: [
			cuboid(-0.07, 0.07, 0.03, 0.15, -0.08, 0.07),
			cuboid(-0.05, 0.05, 0, 0.04, -0.02, 0.07),
			cuboid(-0.05, -0.015, 0.08, 0.11, 0.07, 0.075),
			cuboid(0.015, 0.05, 0.08, 0.11, 0.07, 0.075)
		],
		material: ['bone', 'bone', 'socket', 'socket']
	},

	// kind: hang — from the ceiling down, so every solid is below y = 0.
	bat: {
		kind: 'hang',
		weight: 3,
		ghost: true,
		solids: [
			cuboid(-0.003, 0.003, -0.4, 0, -0.003, 0.003),
			cuboid(-0.03, 0.03, -0.5, -0.4, -0.03, 0.03),
			cuboid(-0.24, -0.03, -0.47, -0.45, -0.09, 0.06),
			cuboid(0.03, 0.24, -0.47, -0.45, -0.09, 0.06)
		],
		material: ['thread', 'bat', 'bat', 'bat']
	},
	'paper-ghost': {
		kind: 'hang',
		weight: 2,
		ghost: true,
		solids: [
			cuboid(-0.003, 0.003, -0.35, 0, -0.003, 0.003),
			disc(0, 0, 0.12, -0.5, -0.35),
			disc(0, 0, 0.2, -1.05, -0.5),
			cuboid(-0.07, -0.02, -0.46, -0.41, 0.12, 0.125),
			cuboid(0.02, 0.07, -0.46, -0.41, 0.12, 0.125)
		],
		material: ['thread', 'cloth', 'cloth', 'socket', 'socket']
	},
	streamers: {
		kind: 'hang',
		weight: 3,
		ghost: true,
		solids: [
			cuboid(-0.2, -0.16, -1.1, 0, -0.004, 0.004),
			cuboid(-0.06, -0.02, -0.75, 0, -0.004, 0.004),
			cuboid(0.08, 0.12, -1.3, 0, -0.004, 0.004),
			cuboid(0.22, 0.26, -0.9, 0, -0.004, 0.004)
		],
		material: ['crepe-orange', 'crepe-black', 'crepe-violet', 'crepe-orange']
	},
	spider: {
		kind: 'hang',
		ghost: true,
		solids: [
			cuboid(-0.002, 0.002, -1.6, 0, -0.002, 0.002),
			disc(0, 0, 0.06, -1.72, -1.6),
			cuboid(-0.16, 0.16, -1.67, -1.65, -0.01, 0.01),
			cuboid(-0.01, 0.01, -1.67, -1.65, -0.14, 0.14)
		],
		material: ['thread', 'bat', 'bat', 'bat']
	},

	// kind: spooky-floor — what turns up in an aisle. Solid: you walk round it.
	gravestone: {
		kind: 'spooky-floor',
		weight: 3,
		solids: [
			cuboid(-0.3, 0.3, 0, 0.7, -0.08, 0.08),
			cuboid(-0.22, 0.22, 0.7, 0.8, -0.08, 0.08),
			cuboid(-0.35, 0.35, 0, 0.06, 0.1, 0.9)
		],
		material: ['stone', 'stone', 'dirt']
	},
	cauldron: {
		kind: 'spooky-floor',
		weight: 2,
		solids: [
			disc(0, 0, 0.26, 0.08, 0.2),
			disc(0, 0, 0.36, 0.2, 0.55),
			disc(0, 0, 0.3, 0.55, 0.6),
			disc(0, 0, 0.28, 0.6, 0.61)
		],
		material: ['iron', 'iron', 'iron', 'slime'],
		light: { y: 0.8, tone: '--palette-green', radius: 4.5, flicker: 0.2, group: 'cauldron' }
	},
	coffin: {
		kind: 'spooky-floor',
		weight: 1,
		solids: [
			prism([[-0.18, -0.95], [0.18, -0.95], [0.3, 0.5], [0.2, 0.95], [-0.2, 0.95], [-0.3, 0.5]], 0, 0.42),
			prism([[-0.15, -0.9], [0.15, -0.9], [0.26, 0.48], [0.17, 0.9], [-0.17, 0.9], [-0.26, 0.48]], 0.42, 0.47)
		],
		material: ['coffin', 'coffin-lid']
	},
	'pumpkin-patch': {
		kind: 'spooky-floor',
		weight: 3,
		solids: [],
		material: [],
		slots: [
			{ kind: 'lantern', x: 0, z: 0, scale: 2.4, jitter: 0.6 },
			{ kind: 'lantern', x: 0.6, z: 0.35, scale: 1.6, chance: 0.8, jitter: 0.8 },
			{ kind: 'lantern', x: -0.55, z: 0.4, scale: 1.3, chance: 0.6, jitter: 0.8 }
		]
	},
	lantern: { ...JACK, kind: 'lantern' },

	// kind: chair — mostly empty chairs, sometimes a guest.
	'task-chair': { ...CHAIR, weight: 4 },
	'stayed-late': {
		kind: 'chair',
		solids: [
			...CHAIR.solids,
			cuboid(-0.14, 0.14, 0.48, 0.58, -0.12, 0.16), // pelvis
			cuboid(-0.03, 0.03, 0.58, 0.95, 0.1, 0.16), // spine
			cuboid(-0.14, 0.14, 0.62, 0.9, -0.02, 0.14), // ribs
			cuboid(-0.09, 0.09, 0.9, 1.08, -0.1, 0.06), // skull, slumped forward
			cuboid(-0.12, -0.06, 0.45, 0.52, -0.4, 0.05), // thighs
			cuboid(0.06, 0.12, 0.45, 0.52, -0.4, 0.05),
			cuboid(-0.12, -0.07, 0, 0.47, -0.42, -0.36), // shins
			cuboid(0.07, 0.12, 0, 0.47, -0.42, -0.36),
			cuboid(-0.2, -0.15, 0.48, 0.88, 0, 0.06), // arms, hanging
			cuboid(0.15, 0.2, 0.48, 0.88, 0, 0.06)
		],
		material: [...CHAIR.solids.map((_, i) => (typeof CHAIR.material === 'string' ? CHAIR.material : CHAIR.material[i])), ...Array<string>(10).fill('bone')]
	},

	// The party in the break room.
	'party-table': {
		solids: [
			cuboid(-1.2, 1.2, 0.72, 0.76, -0.45, 0.45),
			cuboid(-1.2, 1.2, 0.25, 0.72, -0.46, -0.44), // the cloth's drop
			cuboid(-1.15, -1.1, 0, 0.72, -0.4, 0.4),
			cuboid(1.1, 1.15, 0, 0.72, -0.4, 0.4),
			disc(0, 0, 0.22, 0.76, 0.86), // punch bowl
			disc(0, 0, 0.2, 0.86, 0.87)
		],
		material: ['cloth-black', 'cloth-black', 'iron', 'iron', 'glass-bowl', 'slime'],
		light: { y: 1.1, tone: '--palette-green', radius: 3, flicker: 0.15, group: 'cauldron' },
		slots: [-0.9, -0.5, 0.5, 0.9].map((x) => ({ kind: 'spooky-desk', x, y: 0.76, z: 0.1, chance: 0.85, jitter: 0.6 }))
	},
	balloons: {
		ghost: true,
		solids: [
			cuboid(-0.003, 0.003, 0, 1.7, -0.003, 0.003),
			disc(-0.12, 0.05, 0.15, 1.7, 2.05),
			disc(0.15, -0.04, 0.15, 1.85, 2.2),
			disc(0.02, 0.18, 0.14, 1.95, 2.28)
		],
		material: ['thread', 'balloon-orange', 'balloon-black', 'balloon-violet']
	},

	// A spot in an aisle that may hold something.
	'party-spot': { solids: [], material: [], slots: [{ kind: 'spooky-floor', x: 0, z: 0, chance: 0.65, jitter: Math.PI }] },

	// The conference room is holding a séance; its chairs are chair slots, so
	// some of the attendees stayed late.
	'conference-table': {
		...TABLE,
		slots: [
			...(TABLE.slots ?? []),
			{ kind: 'seance', x: 0, y: 0.76, z: 0 },
			...[-1.4, -0.7, 0.7, 1.4].map((x, i) => ({ kind: 'spooky-desk', x, y: 0.76, z: i % 2 ? 0.25 : -0.25, chance: 0.8, jitter: 0.6 }))
		]
	},
	// kind: spooky-office — one thing in the middle of a private office. No
	// coffin: turned across a small office it fills it.
	'office-spot': { solids: [], material: [], slots: [{ kind: 'spooky-office', x: 0, z: 0, chance: 0.8, jitter: Math.PI }] }
};
for (const id of ['gravestone', 'cauldron', 'pumpkin-patch']) spooky[`${id}-office`] = { ...spooky[id], kind: 'spooky-office' };
spooky['seance-candles'] = { ...spooky.candles, kind: 'seance' };

// ── The glass ─────────────────────────────────────────────────────────────────
// Every pane of the outer glass may hold something on its sill — the party's
// lanterns looking out — and a web in a top corner. Both are slots on the
// office's own frames, so a reroll redecorates the windows too.

/** One thread from `a` to `b`, in a pane's plane (e right, h up). */
function strand([ax, ay]: [number, number], [bx, by]: [number, number], w = 0.004) {
	const l = Math.hypot(bx - ax, by - ay) || 1;
	const nx = (-(by - ay) / l) * w, ny = ((bx - ax) / l) * w;
	return panel(
		[
			[ax - nx, ay - ny],
			[bx - nx, by - ny],
			[bx + nx, by + ny],
			[ax + nx, ay + ny]
		],
		0.003
	);
}

/** A web in a pane's top-left corner, at the origin, spun down and right:
 *  spokes out of the corner, two rings of thread across them. */
const WEB: MapProp = (() => {
	const R = 0.55;
	const spokes = [0.05, 0.4, 0.8, 1.2, 1.52].map((a) => [Math.cos(a), -Math.sin(a)] as [number, number]);
	const ring = (r: number) => spokes.slice(1).map((s, i) => strand([spokes[i][0] * r, spokes[i][1] * r], [s[0] * r, s[1] * r]));
	const solids = [...spokes.map(([x, y]) => strand([0, 0], [x * R, y * R])), ...ring(R * 0.45), ...ring(R * 0.8)];
	return { kind: 'web', ghost: true, solids, material: 'web' };
})();

spooky['sill-lantern'] = { ...JACK, kind: 'sill', weight: 3 };
spooky['sill-candles'] = { ...spooky.candles, kind: 'sill', weight: 2 };
spooky['sill-skull'] = { ...spooky.skull, kind: 'sill' };
spooky.web = WEB;
for (const [id, g] of Object.entries(GLAZING)) {
	const half = g.w / g.cols;
	const pane = (i: number) => -g.w + half * (2 * i + 1);
	spooky[id] = {
		...OFFICE.props[id],
		slots: Array.from({ length: g.cols }, (_, i) => [
			// On the sill, a little into the room, grinning at it.
			{ kind: 'sill', x: pane(i), y: g.sill, z: 0.06, chance: 0.16, jitter: 0.5 },
			{ kind: 'web', x: pane(i) - half + g.t, y: g.head, z: 0.01, chance: 0.12 },
			// The other corner: turned half round, the web spins down and left.
			{ kind: 'web', x: pane(i) + half - g.t, y: g.head, z: -0.01, yaw: Math.PI, chance: 0.08 }
		]).flat()
	};
}

/** Open bullpen floor between the pods (office.ts PODS_X / PODS_Z): never a
 *  hallway, where a coffin turned across would block it. */
const AISLES_X = [-20.4, -10.2, 10.2, 20.4];
const AISLES_Z = [0, 9.5];

const party: Put[] = [
	...AISLES_X.flatMap((x) => AISLES_Z.map((z) => ({ prop: 'party-spot', x, z }))),
	// The break room: a table along the wall, out of the meeting's way.
	{ prop: 'party-table', x: 26.5, z: 14 },
	{ prop: 'balloons', x: 23.2, z: 14 },
	{ prop: 'balloons', x: 30.6, z: 15.5, yaw: 1 },
	{ prop: 'cauldron', x: 31, z: 18 },
	// The lobby: a graveyard either side of the door.
	...[-1, 1].flatMap((side) => [
		{ prop: 'gravestone', x: side * 8.6, z: 14.5, yaw: side * 0.15 },
		{ prop: 'gravestone', x: side * 8.4, z: 17, yaw: -side * 0.1 },
		{ prop: 'gravestone', x: side * 8.8, z: 19.5, yaw: side * 0.2 },
		{ prop: 'pumpkin-patch', x: side * 2, z: 21 }
	]),
	{ prop: 'balloons', x: -1.5, z: 13.5 },
	// Something waiting in the middle of each private office big enough to walk round it.
	...ROOMS.filter((r) => r.office && r.rect[3] - r.rect[2] >= 6).map((r) => ({ prop: 'office-spot', ...roomCentre(r) }))
];

export const HALLOWEEN: MapDef = {
	...OFFICE,
	id: 'office-halloween',
	label: 'Office',
	dev: false,
	ambient: 0.2,
	sky: [SKIES.haunted],
	materials: {
		...OFFICE.materials,
		lamp: { face: ['--fg', '--bg', 0.25], lit: 0 },
		'lamp-lit': { face: ['--fg', '--palette-sky', 0.2], lit: 0, glow: true },
		'sign-text': { face: '--palette-orange', lit: 0, glow: true },
		pumpkin: { face: ['--palette-orange', '--bg', 0.25] },
		stem: { face: ['--palette-green', '--bg', 0.5] },
		ember: { face: '--palette-yellow', lit: 0, glow: true },
		flame: { face: ['--palette-yellow', '--fg', 0.3], lit: 0, glow: true },
		slime: { face: '--palette-green', lit: 0, glow: true },
		wax: { face: ['--fg', '--palette-amber', 0.15] },
		bone: { face: ['--fg', '--palette-amber', 0.12] },
		socket: { face: '--bg', lit: 0 },
		thread: { face: '--fg-dim', lit: 0 },
		bat: { face: ['--bg', '--palette-zinc', 0.2] },
		cloth: { face: ['--fg', '--bg', 0.1] },
		'cloth-black': { face: ['--bg', '--palette-purple', 0.2] },
		'crepe-orange': { face: '--palette-orange' },
		'crepe-black': { face: ['--bg', '--palette-zinc', 0.25] },
		'crepe-violet': { face: '--palette-violet' },
		'balloon-orange': { face: '--palette-orange' },
		'balloon-black': { face: ['--bg', '--palette-zinc', 0.3] },
		'balloon-violet': { face: '--palette-purple' },
		stone: { face: ['--palette-zinc', '--bg', 0.35], edge: '--border-strong' },
		dirt: { face: ['--palette-amber', '--bg', 0.8] },
		iron: { face: ['--bg', '--palette-zinc', 0.35], edge: '--border-strong' },
		coffin: { face: ['--palette-red', '--bg', 0.75], edge: '--border-strong' },
		'coffin-lid': { face: ['--palette-red', '--bg', 0.65] },
		'glass-bowl': { face: ['--palette-green', '--bg', 0.6] },
		web: { face: ['--fg', '--bg', 0.35], lit: 0 }
	},
	props: { ...OFFICE.props, ...spooky },
	puts: [...OFFICE.puts, ...party]
};
