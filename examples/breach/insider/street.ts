// ── Main Street — the settlement's buildings either side of a road ───────────
// Dev-only: the physics proving ground the walker was built on, kept for testing
// against real buildings. Players get the office.
//
// The pieces are authored to be looked DOWN on at 40px from a globe; here they
// stand at 7 metres per node radius, so ≤14m buildings at eye height.
import { ALL_PIECES, type MapDef } from 'showcase';

const S = 7;
const ROAD = 4; // half-width
const WALK = 3; // sidewalk width
const LOT = 18; // spacing along the street
const W = 70; // half-extent of the ground
const LEFT = ['house', 'keep', 'archive', 'forum', 'court', 'mill', 'checkpoint'];
const RIGHT = ['bastion', 'observatory', 'precinct', 'silos', 'forge', 'pavilion', 'redoubt'];

const lots = [...LEFT.map((p, i) => [p, i, -1] as const), ...RIGHT.map((p, i) => [p, i, 1] as const)].map(
	([piece, i, side]) => ({
		piece,
		x: side * (ROAD + WALK + S),
		z: (i - 3) * LOT,
		// Front (+z before turning) faces the road: left side turns to +x, right to −x.
		yaw: (-side * Math.PI) / 2
	})
);

const dashes: [number, number, number, number][] = [];
for (let z = -W; z < W; z += 6) dashes.push([-0.12, 0.12, z, z + 3]);

export const STREET: MapDef = {
	id: 'street',
	label: 'Main Street',
	dev: true,
	materials: {
		ground: { face: '--bg-elev', lit: 0 },
		grid: { face: '--border', lit: 0 },
		walk: { face: ['--bg-elev', '--border-strong', 0.5], lit: 0 },
		road: { face: ['--bg', '--bg-elev', 0.4], lit: 0 },
		dash: { face: ['--border-strong', '--accent', 0.5], lit: 0 },
		building: { face: ['--border-strong', '--accent', 0.35], edge: '--accent' }
	},
	props: Object.fromEntries(lots.map((l) => [l.piece, { solids: ALL_PIECES[l.piece], material: 'building' }])),
	puts: lots.map((l) => ({ prop: l.piece, x: l.x, z: l.z, yaw: l.yaw, scale: S })),
	floor: [
		{ material: 'ground', rects: [[-W, W, -W, W]] },
		{ material: 'walk', rects: [[-ROAD - WALK, -ROAD, -W, W], [ROAD, ROAD + WALK, -W, W]] },
		{ material: 'road', rects: [[-ROAD, ROAD, -W, W]] },
		{ material: 'dash', rects: dashes }
	],
	grid: { step: 5, material: 'grid' },
	spawn: { x: 0, y: 0, z: LOT * 3.5 },
	bounds: { x0: -W + 1, x1: W - 1, z0: -W + 1, z1: W - 1 },
	landmarks: lots.map((l) => ({ label: l.piece, x: l.x, z: l.z }))
};
