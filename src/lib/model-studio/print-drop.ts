// ── model-studio/print-drop — a bed of BREACH figures, rolled at posted odds ──
// A drop is a run of physical figures with a rarity ladder and supply caps,
// opened like a loot box: the FIGURE's tier is rolled first at the posted odds,
// then one slot is filled at that tier and the rest at or below it. Rolling
// items independently and taking the max would quietly raise every posted
// number, since five slots each get a chance at the top tier.
//
// The printer holds four spools — red, black, white, gray — so colour rarity
// is a COLOURWAY: which of the four goes on suit, plate and trim. Red is the
// scarce one. Every figure on every plate prints from the same four, so a bed
// never needs a spool swap. Lenses — visor, glasses, thrust pad — are always
// white: it is the one spool an LED behind it can shine through.

import { CHARACTERS, type CharacterSkin } from '../character/characters.js';
import { figureParts } from '../character/render.js';
import { printable, scaleTo } from '../character/export.js';
import { measure } from '../character/builds.js';
import { ccw } from '../character/solids.js';
import { box, prism, type Solid } from '../mesh-studio/pieces/pieces.js';
import type { Knob } from '../backdrop/backdrop-tokens.js';
import {
	boxHole,
	carveHull,
	cut,
	grow,
	layers,
	rod,
	slab,
	type Box3,
	type Model,
	type ModelView,
	type Part,
	type Plane,
	type Pt2,
	within
} from './model-geometry.js';

export type Tier = 'standard' | 'issued' | 'rare' | 'classified' | 'covert' | 'alpha';
type SlotKey = 'head' | 'eyes' | 'colors';
type Spool = 'red' | 'black' | 'white' | 'gray';
type Colourway = { suit: Spool; plate: Spool; trim: Spool };
type PoolItem = { key: string; name: string; tier: Tier; wearable?: string; way?: Colourway };
type Pool = { slot: SlotKey; label: string; items: PoolItem[] };
type TierRow = { key: Tier; label: string; odds: number; cap: number | null };
type Roll = { character_key: string; tier: Tier; picks: Record<SlotKey, string> };

export const TIERS: TierRow[] = [
	{ key: 'standard', label: 'Standard', odds: 0.6, cap: null },
	{ key: 'issued', label: 'Issued', odds: 0.24, cap: null },
	{ key: 'rare', label: 'Rare', odds: 0.1, cap: null },
	{ key: 'classified', label: 'Classified', odds: 0.045, cap: 60 },
	{ key: 'covert', label: 'Covert', odds: 0.012, cap: 20 },
	{ key: 'alpha', label: 'Alpha', odds: 0.003, cap: 5 }
];
const RANK = Object.fromEntries(TIERS.map((t, i) => [t.key, i])) as Record<Tier, number>;
const tierOf = (k: Tier) => TIERS[RANK[k]];

// The loaded spools. Hex because they are filament, not theme.
const SPOOLS: Record<Spool, string> = { red: '#C8102E', black: '#232326', white: '#ECEBE6', gray: '#8A8E95' };
const way = (suit: Spool, plate: Spool, trim: Spool): Colourway => ({ suit, plate, trim });

const POOLS: Pool[] = [
	{
		slot: 'head',
		label: 'Head',
		items: [
			{ key: 'hat.none', name: 'Bare', tier: 'standard', wearable: 'hat.none' },
			{ key: 'hat.headset', name: 'Headset', tier: 'standard', wearable: 'hat.headset' },
			{ key: 'hat.beanie', name: 'Beanie', tier: 'standard', wearable: 'hat.beanie' },
			{ key: 'hat.hardhat', name: 'Hard Hat', tier: 'standard', wearable: 'hat.hardhat' },
			{ key: 'hat.beret', name: 'Beret', tier: 'issued', wearable: 'hat.beret' },
			{ key: 'hat.cap', name: 'Turned Cap', tier: 'issued', wearable: 'hat.cap' },
			{ key: 'hat.tophat', name: 'Top Hat', tier: 'rare', wearable: 'hat.tophat' },
			{ key: 'hat.horns', name: 'Horns', tier: 'classified', wearable: 'hat.horns' },
			{ key: 'hat.halo', name: 'Clean Record', tier: 'covert', wearable: 'hat.halo' },
			{ key: 'hat.crown', name: 'Table Crown', tier: 'alpha', wearable: 'hat.crown' }
		]
	},
	{
		slot: 'eyes',
		label: 'Eyes',
		items: [
			{ key: 'eyes.none', name: 'Bare visor', tier: 'standard' },
			{ key: 'hat.visor', name: 'Optic Visor', tier: 'issued', wearable: 'hat.visor' }
		]
	},
	{
		slot: 'colors',
		label: 'Colours',
		// suit · plate · trim. No red below Issued; all-red only at Alpha.
		items: [
			{ key: 'cw.graphite', name: 'Graphite', tier: 'standard', way: way('gray', 'black', 'black') },
			{ key: 'cw.bone', name: 'Bone', tier: 'standard', way: way('white', 'gray', 'gray') },
			{ key: 'cw.slate', name: 'Slate', tier: 'standard', way: way('gray', 'white', 'white') },
			{ key: 'cw.ink', name: 'Ink', tier: 'issued', way: way('black', 'gray', 'white') },
			{ key: 'cw.signal', name: 'Signal', tier: 'issued', way: way('gray', 'black', 'red') },
			{ key: 'cw.redline', name: 'Redline', tier: 'rare', way: way('gray', 'red', 'black') },
			{ key: 'cw.inverse', name: 'Inverse', tier: 'classified', way: way('black', 'white', 'red') },
			{ key: 'cw.phantom', name: 'Phantom', tier: 'covert', way: way('white', 'red', 'red') },
			{ key: 'cw.blackout', name: 'Blackout', tier: 'alpha', way: way('black', 'red', 'red') }
		]
	}
];
const itemOf = (slot: SlotKey, key: string) => POOLS.find((p) => p.slot === slot)!.items.find((i) => i.key === key)!;

const BED_MM = 256;
// Pitch is the base plus a brim gap; a figure is ~0.6× as wide as it is tall.
const pitch = (h: number) => h * 0.6 + 8;

// ── Roll ──────────────────────────────────────────────────────────────────────
// Seeded so a bed can be re-derived from its seed: the drop page can publish the
// seed beside the bed and anyone can check the roll was not hand-picked.
function mulberry32(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const pick = <T>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

function rollTier(r: () => number, spent: Record<Tier, number>): Tier {
	let x = r();
	let t: Tier = 'standard';
	for (const row of TIERS) {
		if (x < row.odds) {
			t = row.key;
			break;
		}
		x -= row.odds;
	}
	// A sold-out tier falls through to the next one down, never up.
	while (tierOf(t).cap !== null && spent[t] >= tierOf(t).cap!) t = TIERS[RANK[t] - 1].key;
	return t;
}

function rollFigure(r: () => number, spent: Record<Tier, number>): Roll {
	const tier = rollTier(r, spent);
	spent[tier]++;
	const carrier = pick(
		r,
		POOLS.filter((p) => p.items.some((i) => i.tier === tier))
	).slot;
	const picks = {} as Record<SlotKey, string>;
	for (const p of POOLS) {
		const pool =
			p.slot === carrier
				? p.items.filter((i) => i.tier === tier)
				: // Below the rolled tier, commons dominate: each step down doubles the weight.
					p.items.filter((i) => RANK[i.tier] <= RANK[tier]).flatMap((i) => Array(2 ** (5 - RANK[i.tier])).fill(i));
		picks[p.slot] = pick(r, pool).key;
	}
	return { character_key: pick(r, CHARACTERS).key, tier, picks };
}

/** What earlier beds have already minted, per tier — the supply caps burn
 *  against it. Six beds of 25, from a fixed seed, stand in for the ledger. */
const MINTED: Record<Tier, number> = (() => {
	const r = mulberry32(42);
	const spent = Object.fromEntries(TIERS.map((t) => [t.key, 0])) as Record<Tier, number>;
	for (let n = 0; n < 6 * 25; n++) rollFigure(r, spent);
	return spent;
})();
const MINTED_TOTAL = Object.values(MINTED).reduce((a, b) => a + b, 0);

function rollBed(seed: number, slots: number): Roll[] {
	const r = mulberry32(seed);
	const spent = { ...MINTED };
	return Array.from({ length: slots }, () => rollFigure(r, spent));
}

// ── Geometry ──────────────────────────────────────────────────────────────────

// ── The lit head ──────────────────────────────────────────────────────────────
// A wired figure carries one 5 mm addressable RGB diode (PL9823 / WS2812 THT)
// on its leads. A straight shaft runs up from the foot — through one leg, or
// the centre peg on a hovering build — into a hollow chamber behind the eyes:
// push the diode up from below, after printing, and the white visor in front
// of the chamber glows. 5 V, GND and data come back down the same shaft.
// ponytail: the diode's 5.8 mm flange sets the shaft; below ~100 mm a leg's
// walls go under 1 mm, so print lit figures at 100 mm or more.
const CH = 6.2;
// White left in front of the chamber: thin enough to glow, thick enough to print.
const GLOW = 1.2;

type Bounds = { e0: number; e1: number; n0: number; n1: number; h0: number; h1: number };
const bounds = (s: Solid): Bounds => {
	const [es, ns, hs] = (['e', 'n', 'h'] as const).map((k) => s.verts.map((v) => v[k]));
	return { e0: Math.min(...es), e1: Math.max(...es), n0: Math.min(...ns), n1: Math.max(...ns), h0: Math.min(...hs), h1: Math.max(...hs) };
};

type OnBed = {
	solids: Solid[];
	colors: string[];
	/** Wired only: where the shaft leaves the foot, and the holes x-ray draws.
	 *  Holes are cut into `solids` only when printing. */
	wire?: { e: number; n: number; holes: Solid[] };
	/** Wired only: the heights where the layer colour changes, and to what. */
	changes?: { h: number; color: string }[];
	/** Wired in the head only: the board's place, the cavity. */
	brain?: Brain;
	/** Wired in the head only: the three pieces it prints as, each with the
	 *  colour changes up its own height. */
	prints?: Record<Print, { solids: Solid[]; colors: string[]; changes: { h: number; color: string }[] }>;
	/** The cartridge's one spool: the head's, where its plate shows. */
	sledColor?: string;
};

type Print = 'base' | 'body' | 'head';

// ── The brain ─────────────────────────────────────────────────────────────────
// A figure wired in the head carries the ESP32-C6 Super Mini there, with the
// relay on it, in a cartridge that slides into a slot in the back of the head
// and clicks home on two arms. Its back plate is the head's back, the USB-C
// window in it, so it charges assembled. The board and relay sit as they do in
// the garage riser, whose print fitted first time: the USB-C a millimetre
// proud of the board, its face on the plate's inside, in the riser's window.
//
// The figure prints in four: base, body, head and cartridge. The head lifts
// off the body so its underside prints on the plate rather than overhanging
// the chest; a plug on the body fills a mouth in the head's underside, and the
// slot's floor is its top. The leads run down the plug, neck and torso, fork
// at the hips and leave through the soles, for sensors yet to come. The diode
// sits in the cavity and lights the visor.
const WALL = 2;
// The plug's height, under the slot's floor.
const PLUG = 4;
// How deep each boot stands in the base.
const RIM = 1.6;
// Three 26 AWG leads with room to pull them round the fork.
const LEAD = 4;
// The cartridge: its floor, and the click — an arm each side reaching in from
// the plate, a 45°-ramped bump on its tip that snaps into a groove in the
// slot's wall. A firm pull on the plate, by the USB-C window, undoes it.
const SLED_FLOOR = 2;
const ARM = { l: 10, t: 1.2, bump: 0.8 };
// A window sash's track: a tongue along each side of the floor runs under a
// lip in the slot's wall, so the cartridge cannot lift once in.
const TRACK = { t: 1.2, lip: 1.5 };
// The cover sits in a recess round the slot's mouth, flush with the head's
// back, the USB-C window through it. Tighter than FIT so it stays put; it
// pries off from the window.
const COVER = { t: 1.2, rim: 1.5, press: 0.1 };

type Cartridge = {
	/** Cut into the host: the slot and its track, the arms' grooves, the
	 *  cover's recess. */
	holes: Plane[][];
	/** The holes open to the outside, which the stage cuts. */
	seen: Plane[][];
	/** Home in the slot: `back` is the host's back face, `floor` the slot's. */
	sled: Solid[];
	cover: Solid[];
	back: number;
	floor: number;
	plate: Box3;
	/** The slot's front and top, which the host walls in, and the lips' top. */
	front: number;
	top: number;
	lip: number;
	mini: Box3;
	usb: Box3;
	relay: Box3;
};

type Brain = {
	holes: Plane[][];
	/** The holes open to the outside. The stage cuts only these: a hole sealed
	 *  inside the print — the mouth, a lead run — shows its walls through
	 *  whatever the sort draws in front of it. */
	seen: Plane[][];
	leads: Solid[];
	/** Stands on the body's shoulders, filling the head's mouth. Printed with
	 *  the body. */
	plug: Solid[];
	cart: Cartridge;
	cavity: Box3;
};

/** The ESP32 + relay cartridge for a host whose back face is at `B`, centred
 *  on `cx`, the slot's floor at `floor`. `lead`, a lead's radius, notches the
 *  cartridge's floor open to the front where a lead rises under the board. */
function cartridge(cx: number, B: number, floor: number, lead = 0): Cartridge {
	// The stack, up from the slot's floor and in from the plate's inside face.
	const inner = B - COVER.t - WALL;
	const deck = floor + SLED_FLOOR;
	const [pcbTop, usbTop] = [deck + MINI.t, deck + MINI.t + MINI.usb.t];
	const pcbFront = inner - 1 - MINI.l;
	// The relay lies across the board on the USB-C shell, its end half a
	// millimetre short of the board's, as in the riser.
	const relay: Box3 = [cx - SSR.w / 2, cx + SSR.w / 2, inner - 1.5 - SSR.l, inner - 1.5, usbTop, usbTop + SSR.t];
	// The riser's USB-C notch: 13 wide, 2 mm clear below and above the shell,
	// room for the plug's overmould to seat it. Through plate and cover.
	const window: Box3 = [cx - 6.5, cx + 6.5, inner - 1, B + 1, pcbTop - 2, usbTop + 2];
	// Wide enough for the relay to pass, a fit each side of the plate's fit.
	const pe = SSR.w / 2 + FIT;
	const [e0, e1] = [cx - pe - FIT, cx + pe + FIT];
	const front = relay[2] - 2 * FIT;
	const top = window[5] + 1.5 + FIT;
	const plate: Box3 = [cx - pe, cx + pe, inner, B - COVER.t, floor, top - FIT];

	// The sled: a floor under the board, a rail each side of it and a stop in
	// front, the plate behind, and an arm each side of the floor reaching in
	// from the plate, clear of it so it can flex.
	const fw = MINI.w / 2 + FIT + SKIN;
	const stop = pcbFront - POCKET - SKIN;
	const rail = pcbTop + 0.8;
	const notch: Box3[] = lead ? [[cx - lead - FIT, cx + lead + FIT, stop - 1, pcbFront + lead + FIT, floor - 1, rail + 1]] : [];
	// Under the relay, which lies across the arms' tops.
	const armTop = usbTop - 0.6;
	const tip = inner - ARM.l;
	const bumps = ([1, -1] as const).map((s) => {
		const out = cx + s * pe;
		return prism(ccw([[out, tip], [out + s * ARM.bump, tip + ARM.bump], [out, tip + 2 * ARM.bump]]), floor, armTop);
	});
	// The tongues stop short of the arms, which sweep the slot's back to the
	// tip on the way in: the lips stop there too.
	const tongue = floor + TRACK.t;
	const lip = tongue + FIT + TRACK.lip;
	const sled = [
		...cut([cx - fw, cx + fw, stop, inner, floor, deck], notch),
		...slab(cx - pe, cx - fw, stop, tip - 1, floor, tongue),
		...slab(cx + fw, cx + pe, stop, tip - 1, floor, tongue),
		...slab(cx - fw, cx - fw + SKIN, stop + SKIN, inner, deck, rail),
		...slab(cx + fw - SKIN, cx + fw, stop + SKIN, inner, deck, rail),
		...cut([cx - fw, cx + fw, stop, stop + SKIN, deck, rail], notch),
		...cut(plate, [window]),
		...slab(cx + pe - ARM.t, cx + pe, tip, inner, floor, armTop),
		...slab(cx - pe, cx - pe + ARM.t, tip, inner, floor, armTop),
		...bumps
	];

	// The slot less its lips, as the convex boxes that union to it: the
	// tongues' channel, the board's run between the lips, the relay's over
	// them, and the arms' sweep at the back.
	const slot = [
		[e0, e1, front, B + 1, floor, tongue + FIT],
		[cx - fw - FIT, cx + fw + FIT, front, B + 1, floor, top],
		[e0, e1, front, B + 1, lip, top],
		[e0, e1, tip - FIT, B + 1, floor, top]
	].map((b) => boxHole(b as Box3));
	const r = COVER.rim;
	const recess = boxHole([e0 - r, e1 + r, B - COVER.t, B + 1, floor - r, top + r]);
	const p = COVER.press;
	const cover = cut([e0 - r + p, e1 + r - p, B - COVER.t, B, floor - r + p, top + r - p], [window]);
	const seen = [...slot, recess];
	return {
		holes: [...seen, ...bumps.map((s) => grow(s, FIT))],
		seen,
		sled,
		cover,
		back: B,
		floor,
		plate,
		front,
		top,
		lip,
		mini: [cx - MINI.w / 2, cx + MINI.w / 2, pcbFront, inner - 1, deck, pcbTop],
		usb: [cx - MINI.usb.w / 2, cx + MINI.usb.w / 2, inner - MINI.usb.l, inner, pcbTop, usbTop],
		relay
	};
}

/** The cavity, mouth, plug, cartridge and lead run for a head `head` on a
 *  torso `torso`, legs `legE` either side of `cx`, soles at `h0`. */
function brain(head: Bounds, torso: Bounds, cx: number, cn: number, legE: number, h0: number): Brain {
	const B = head.n1;
	// The flat of the head's back is 0.66 of its width (the lump's 0.34 cut):
	// WALL in from it keeps each side clear of the chamfer behind it.
	const O = 0.66 * ((head.e1 - head.e0) / 2) - WALL - 0.2;
	const jaw = head.h0;
	const floor = jaw + PLUG;
	const top = head.h1 - 2.5;
	const r = LEAD / 2;
	const cart = cartridge(cx, B, floor, r);
	// The mouth takes a board-sized plug, a fit all round, centred on the torso
	// so the plug stands on its flat top.
	const tn = (torso.n0 + torso.n1) / 2;
	const ml = MINI.l / 2 + FIT;
	const mouth: Box3 = [cx - MINI.w / 2 - FIT, cx + MINI.w / 2 + FIT, tn - ml, tn + ml, jaw, floor];
	// One round run: up each leg from the sole, across the hips, up the middle,
	// forward under the jaw, and up through the plug into the slot on the
	// board's front edge — half under the board, because at 100 mm a whole
	// run in front of it breaks out of the plug. The cartridge's floor is
	// notched open to the front there, so it slides out past the leads. A tall
	// head puts the board behind the shaft: then straight up.
	const up = (e: number, n: number, h0: number, h1: number) => rod('h', [e, n], h0, h1, r);
	const fork = torso.h0 + 2 + r;
	const ns = Math.min(cn, cart.mini[2]);
	// The jog's ridge a millimetre under the jaw, inside the torso.
	const jog = jaw - 1 - r * 1.45;
	const leads: Solid[] = [
		...(ns < cn
			? [up(cx, cn, fork, jog), rod('n', [cx, jog], ns, cn, r), up(cx, ns, jog, floor + 0.01)]
			: [up(cx, cn, fork, floor + 0.01)]),
		rod('e', [cn, fork], cx - legE, cx + legE, r),
		up(cx - legE, cn, h0 - 1, fork),
		up(cx + legE, cn, h0 - 1, fork)
	];
	const runs = leads.map((s) => grow(s, 0));
	// The roof is a 45° gable, peak at `top`, eaves O below it: nothing over
	// the cavity overhangs past 45°, so a slicer has nothing to support inside
	// a head no support could be picked out of.
	const S = Math.SQRT1_2;
	const gable = (apex: number): Plane[] => [
		{ e: S, n: 0, h: S, d: S * (cx + apex) },
		{ e: -S, n: 0, h: S, d: S * (apex - cx) }
	];
	// Its floor over the lips, which it would otherwise cut away.
	const cavity: Box3 = [cx - O, cx + O, head.n0 + WALL, B - WALL, cart.lip, top];
	const holes: Plane[][] = [...cart.holes, [...boxHole(cavity), ...gable(top)], boxHole(mouth), ...runs];
	// The mouth less a fit all round; its top is the slot's floor.
	const plug = cut([mouth[0] + FIT, mouth[1] - FIT, mouth[2] + FIT, mouth[3] - FIT, jaw, floor]).flatMap((s) =>
		runs.reduce<Solid[]>((acc, h) => acc.flatMap((x) => carveHull(x, h)), [s])
	);
	return {
		holes,
		seen: cart.seen,
		leads,
		plug,
		cart,
		cavity
	};
}

// ── The eyes ──────────────────────────────────────────────────────────────────
// The eye skin is a diamond grille: a window cut through each face of the
// visor that looks forward, and two sets of 45° bars laid back in it. Every
// edge of every hole leans 45°, so the upright head prints them with nothing
// to bridge; and a few dozen bars laid in slice clean where hundreds of holes
// carved out left the slicer a heap of slivers.
export const HOLE = 1.2; // a diamond's side
// Square to the bars; sliced, each is 0.85 across — two lines of a 0.4 nozzle.
export const BAR = 0.6;

/** The grille in the face over footprint edge `p`→`q` (wound as the solid is,
 *  so its inside is on the left), between heights `h0` and `h1`, `skin`
 *  deep: the window to cut, and the bars to lay back in it. */
function grille(p: { e: number; n: number }, q: { e: number; n: number }, h0: number, h1: number, skin: number) {
	const L = Math.hypot(q.e - p.e, q.n - p.n);
	const u = { e: (q.e - p.e) / L, n: (q.n - p.n) / L };
	// Across the face, in from it, up: a turn of the prism's own axes, never a
	// mirror, so every face stays outward-wound.
	const plate = (foot: Pt2[], y0: number, y1: number): Solid => {
		const s = prism(foot, -y1, -y0);
		return { faces: s.faces, verts: s.verts.map((v) => ({ e: p.e + v.e * u.e + v.h * u.n, n: p.n + v.e * u.n - v.h * u.e, h: v.n })) };
	};
	const win: Pt2[] = [[skin, h0], [L - skin, h0], [L - skin, h1], [skin, h1]];
	// Bars square to x + z and to x − z, centred on the window.
	const [cx, cz] = [L / 2, (h0 + h1) / 2];
	const step = (HOLE + BAR) * Math.SQRT2;
	const w = BAR / Math.SQRT2;
	const bars = ([1, -1] as const).flatMap((s) => {
		const c0 = cx + s * cz;
		const cs = win.map(([x, z]) => x + s * z);
		const [k0, k1] = [Math.floor((Math.min(...cs) - w - c0) / step), Math.ceil((Math.max(...cs) + w - c0) / step)];
		return Array.from({ length: k1 - k0 + 1 }, (_, i) => {
			const c = c0 + (k0 + i) * step;
			return within(within(win, 1, s, c + w), -1, -s, w - c);
		});
	});
	return {
		hole: grow(plate(win, -1, skin + 0.01), 0),
		bars: bars.filter((f) => f.length >= 3).map((f) => plate(f, 0, skin))
	};
}

/** One rolled figure as printed: posed, given its peg and base, scaled to
 *  `mm` tall and stood on the plate at (e, n). Each solid keeps its spool. */
function figureOnBed(
	b: Pick<Roll, 'character_key' | 'picks'>,
	mm: number,
	e: number,
	n: number,
	{ extra = [] as string[], h0 = 0, lit = false as false | 'foot' | 'head', print = false } = {}
): OnBed {
	const skin = CHARACTERS.find((c) => c.key === b.character_key) as CharacterSkin;
	const w = itemOf('colors', b.picks.colors).way!;
	const worn = [
		...(['head', 'eyes', 'colors'] as SlotKey[]).map((s) => itemOf(s, b.picks[s]).wearable).filter((x): x is string => !!x),
		...extra
	];
	const a = measure(skin.shape);
	const items = printable(
		figureParts({ ...skin, color: SPOOLS[w.plate] }, { worn, suit: SPOOLS[w.suit], trim: SPOOLS[w.trim], lamp: SPOOLS.white }),
		a,
		SPOOLS.black
	);
	const k = scaleTo(items, mm);
	const floor = Math.min(...items.flatMap((p) => p.solid.verts.map((v) => v.h)));
	const [E, N, H] = [(x: number) => e + x * k, (y: number) => n + y * k, (z: number) => h0 + (z - floor) * k];
	const solids = items.map((p) => ({ faces: p.solid.faces, verts: p.solid.verts.map((v) => ({ e: E(v.e), n: N(v.n), h: H(v.h) })) }));
	const colors = items.map((p) => p.color);
	if (!lit) return { solids, colors };

	const [cx, ce] = [E(0), E(a.legs ? a.legE : 0)];
	const part = (name: string) => bounds(solids[items.findIndex((p) => p.name === name)]);
	// The chamber is the visor itself, GLOW in from its front, its angled
	// cheeks and its floor, run back to the shaft or to the cavity in a head
	// that has one. Its ceiling climbs at 45° from the visor's top rather than
	// hanging flat over the light.
	const iVisor = items.findIndex((p) => p.name === 'visor');
	const lens = solids[iVisor];
	const visor = bounds(lens);
	const [front, top] = [visor.n0 + GLOW, visor.h1 - GLOW];
	const head = lit === 'head' ? brain(part('head'), part('torso'), cx, N(0), a.legE * k, h0) : undefined;
	// The faces that look forward: the front and the two cheeks either side of
	// it, as edges of the visor's floor ring.
	const ring = lens.verts.slice(0, lens.verts.length / 2);
	const faces = ring
		.map((p, i) => [p, ring[(i + 1) % ring.length]] as const)
		.filter(([p, q]) => (q.e - p.e) / Math.hypot(q.e - p.e, q.n - p.n) > 0.3);
	// A head with a cavity is lit through a grille across all three, so its
	// chamber runs back past the cheeks: no window opens onto solid.
	const cheeks = Math.max(...faces.flatMap((f) => f.map((v) => v.n)));
	const rear = head ? Math.max(head.cavity[2], cheeks) + 0.01 : N(0) + CH / 2;
	const lamp: Plane[] = [
		...grow(lens, -GLOW).filter((p) => p.n < 0.3 && p.h < 0.5),
		{ e: 0, n: 1, h: 0, d: rear },
		{ e: 0, n: -Math.SQRT1_2, h: Math.SQRT1_2, d: Math.SQRT1_2 * (top - front) }
	];
	// What x-ray draws for it.
	const half = (visor.e1 - visor.e0) / 2 - GLOW;
	const chamber: Box3 = [cx - half, cx + half, front, rear, visor.h0 + GLOW, top];
	const eyes = head ? faces.map(([p, q]) => grille(p, q, visor.h0 + GLOW, top, GLOW)) : [];
	const shaft = rod('h', [ce, N(0)], h0 - 1, top, CH / 2);
	const holes: Plane[][] = [grow(shaft, 0), lamp];
	// Under the base, a groove from each sole's run out to its back edge: the
	// leads leave behind the figure rather than under the base it stands on.
	const back = part('base').n1;
	const ducts = head ? [-1, 1].map((s) => rod('n', [cx + s * a.legE * k, h0 - 0.8], N(0), back + 1, LEAD / 2)) : [];
	const wire = { e: ce, n: N(0), holes: [...(head ? [...head.leads, ...ducts] : [shaft]), ...slab(...chamber)] };
	// The head's open holes are the point of it, so the stage cuts those too;
	// a sealed one, or the founders' shaft, would cost the sort its order.
	const hulls = head ? [...(print ? head.holes : head.seen), lamp, ...eyes.map((g) => g.hole)] : print ? holes : [];

	// A head-wired figure stands in its base rather than on it: the base grows
	// a RIM-deep rim with a socket per boot, each the boot's own octagon a fit
	// larger, so the base is a print of its own and the body drops in.
	const iBase = items.findIndex((p) => p.name === 'base');
	const boots = items.flatMap((p, i) => (p.name === 'boot' ? [solids[i]] : []));
	const sole = Math.min(...boots.map((s) => bounds(s).h0));
	if (head) {
		const s = solids[iBase];
		const mid = (bounds(s).h0 + bounds(s).h1) / 2;
		solids[iBase] = { faces: s.faces, verts: s.verts.map((v) => (v.h > mid ? { ...v, h: sole + RIM } : v)) };
	}
	const sockets: Plane[][] =
		head && print
			? [
					...boots.map((s) => [
						...grow(s, FIT).filter((p) => Math.abs(p.h) < 0.5),
						{ e: 0, n: 0, h: -1, d: -sole },
						{ e: 0, n: 0, h: 1, d: sole + RIM + 1 }
					]),
					...ducts.map((s) => grow(s, 0))
				]
			: [];
	const carved = (s: Solid, hs: Plane[][]) => hs.reduce<Solid[]>((acc, h) => acc.flatMap((x) => carveHull(x, h)), [s]);
	// Neither the plug nor the grille's bars are carved: the lead run is cut
	// into the plug already and the mouth it fills would take it whole; the
	// bars are laid into the windows the carving opens.
	const bored = [
		...solids.flatMap((s, i) => carved(s, i === iBase ? [...hulls, ...sockets] : hulls).map((x) => ({ s: x, i }))),
		...(head && print ? head.plug.map((s) => ({ s, i: -1 })) : []),
		...eyes.flatMap((g) => g.bars.map((s) => ({ s, i: iVisor })))
	];

	// Colour by layer: every layer one spool, so the CFS swaps only where a
	// band starts or ends — a handful a figure, not several a layer. The bands
	// are the boots, the hover pad, the visor and the hat; whatever else shares
	// their layers takes their colour, and the suit fills the rest.
	const bands = items.flatMap((p, i) => (BANDS.test(p.name ?? '') ? [{ ...bounds(solids[i]), color: p.color }] : []));
	// A split figure is also cut at the jaw, where the head lifts off.
	const jaw = head ? part('head').h0 : Infinity;
	const cuts = [...new Set([...bands.flatMap((b) => [b.h0, b.h1]), ...(head ? [jaw] : [])])].sort((x, y) => x - y);
	const colorAt = (h: number) => bands.find((b) => h > b.h0 && h < b.h1)?.color ?? SPOOLS[w.suit];
	const pieces = bored.flatMap(({ s, i }) => layers(s, cuts).map((x) => ({ s: x, i })));
	const crown = Math.max(...pieces.map(({ s }) => bounds(s).h1));
	// The changes between `lo` and `hi`, measured up from `lo` when that is a
	// print's own floor.
	const flips = (lo: number, hi: number, at = 0) =>
		cuts
			.filter((c) => c > lo + 0.01 && c < hi - 0.01 && colorAt(c - 0.01) !== colorAt(c + 0.01))
			.map((c) => ({ h: c - at, color: colorAt(c + 0.01) }));
	// A slab thinner than a layer is a part sunk a hair into the band above
	// it (the foot disc into the boots); it prints with what is under it.
	const colorOf = ({ h0, h1 }: Bounds) => colorAt(h1 - h0 < 0.25 ? h0 - 0.01 : (h0 + h1) / 2);
	// The base of a split figure is a print of its own, so one spool.
	const colored = pieces.map(({ s, i }) => (head && i === iBase ? items[iBase].color : colorOf(bounds(s))));
	const whole = { solids: pieces.map(({ s }) => s), colors: colored, wire, changes: flips(-Infinity, crown), brain: head };
	if (!head) return whole;

	// The plug (i = -1) stands above the jaw but rides on the body.
	const which = ({ s, i }: (typeof pieces)[number]): Print =>
		i === iBase ? 'base' : i >= 0 && bounds(s).h0 >= jaw - 0.01 ? 'head' : 'body';
	const group = (p: Print, changes: { h: number; color: string }[]) => {
		const at = pieces.flatMap((x, j) => (which(x) === p ? [j] : []));
		return { solids: at.map((j) => pieces[j].s), colors: at.map((j) => colored[j]), changes };
	};
	return {
		...whole,
		prints: { base: group('base', []), body: group('body', flips(sole, jaw, sole)), head: group('head', flips(jaw, crown, jaw)) },
		sledColor: colorAt((head.cart.plate[4] + head.cart.plate[5]) / 2)
	};
}

const BANDS = /^(boot|pad|visor|hat\.(?!visor))/;

/** The holes inside a lit figure or its base, drawn as solids for x-ray. Never
 *  printed: the export leaves anything without `printed` out. */
const channel = (id: string, label: string, solids: Solid[]): Part => ({
	id: `${id}-channel`,
	label: `${label} · Channel`,
	kind: 'wire',
	size: 'holes, never printed',
	solids
});

export interface DropParams {
	height: number;
	seed: number;
}

function bedParts({ height, seed }: DropParams): Part[] {
	const per = Math.floor(BED_MM / pitch(height));
	const step = BED_MM / per;
	const half = BED_MM / 2;
	const bed = rollBed(seed, per * per);
	return [
		{
			id: 'plate',
			label: 'Build plate',
			kind: 'metal',
			size: `${BED_MM} × ${BED_MM}, textured PEI`,
			// Everything stands on it, so it is ordered as the floor of the scene
			// rather than diced for the face sort — 1,800 fewer paths a frame.
			side: { axis: 'h', sign: -1, layer: 1 },
			solids: [box(-half, half, -half, half, -2, 0)]
		},
		...bed.map((b, i): Part => {
			const e = -half + step * (i % per) + step / 2;
			// Row 0 at the back, so slot 1 is top-left the way a slicer numbers it.
			const n = half - step * Math.floor(i / per) - step / 2;
			const skin = CHARACTERS.find((c) => c.key === b.character_key)!;
			return {
				id: `slot-${i}`,
				label: `${i + 1} · ${skin.name.replace('The ', '')}`,
				kind: 'part',
				printed: true,
				size: `${tierOf(b.tier).label} · ${itemOf('colors', b.picks.colors).name}`,
				...figureOnBed(b, height, e, n)
			};
		})
	];
}

function bedStats({ height, seed }: DropParams) {
	const per = Math.floor(BED_MM / pitch(height));
	const bed = rollBed(seed, per * per);
	const best = bed.reduce<Tier>((m, b) => (RANK[b.tier] > RANK[m] ? b.tier : m), 'standard');
	const alphaCap = tierOf('alpha').cap!;
	return [
		{ label: 'Minted', value: String(MINTED_TOTAL), sub: '6 beds' },
		{ label: 'On this bed', value: String(per * per), sub: `${per}×${per} at ${height} mm` },
		{ label: 'Best on bed', value: tierOf(best).label, sub: `seed ${seed}` },
		{ label: 'Alpha left', value: `${alphaCap - MINTED.alpha} / ${alphaCap}`, sub: 'never reprinted' }
	];
}

const read = (knobs: Knob[]): DropParams => {
	const val = (prop: string) => knobs.find((k) => 'prop' in k && k.prop === prop)?.value;
	return { height: Number(val('height') ?? 60), seed: Number(val('seed') ?? 1) };
};

export const PRINT_DROP: Model = {
	id: 'print-drop',
	name: 'Print drop',
	blurb: 'A bed of BREACH figures rolled at the posted odds, on a 256 mm plate',
	zoom: 2.2,
	pivot: 0,
	grid: 0,
	knobs: [
		{
			kind: 'choice',
			group: 'floor',
			prop: 'height',
			label: 'Figure height',
			hint: 'mm, base to crown — sets how many fit the plate',
			value: '60',
			options: ['40', '60', '80']
		},
		{ kind: 'param', group: 'floor', prop: 'seed', label: 'Seed', hint: 'Every seed is one roll of the bed', value: 1, min: 1, max: 999, step: 1 }
	],
	build: (_view, knobs) => bedParts(read(knobs)),
	stats: (knobs) => bedStats(read(knobs))
};

// ── Founders edition ──────────────────────────────────────────────────────────
// Outside the drop: never rolled, never in the odds. Each founder gets a box set
// of all four characters on one trophy base, and every set prints on a single
// plate. Every slot takes the top of its pool, so a new top-tier item upgrades
// the set with no edit here. The logo plate takes the chest the role badge
// normally holds. Sets are numbered, not named: this library is public.
const FOUNDER_SETS = 4;
const MAXED = Object.fromEntries(
	POOLS.map((p) => [p.slot, p.items.reduce((m, i) => (RANK[i.tier] >= RANK[m.tier] ? i : m)).key])
) as Record<SlotKey, string>;
// A lit figure prints colour-by-layer, and glasses share their layers with the
// face: no one spool per layer can draw them, so it wears the bare visor.
const LIT: Record<SlotKey, string> = { ...MAXED, eyes: 'eyes.none' };

type Mount = 'fused' | 'pegged';

// ── The wired sled ────────────────────────────────────────────────────────────
// Every founder base carries the garage riser's ESP32-C6 Super Mini on a sled
// printed apart, slid into a slot in the base's back edge like an SD card. The
// USB-C mouth sits flush with the sled's back plate, so a cable plugs straight
// in: the wired edition, powered and flashed from behind.
const MINI = { w: 18, l: 22.5, t: 1, usb: { w: 9, l: 7.4, t: 3.2 } };
// The garage riser's mini DC SSR, measured with its leads.
const SSR = { w: 25, l: 30, t: 2 };
const SKIN = 1.2;
const SLED = { w: MINI.w + 2 * SKIN, l: MINI.l + 2 * SKIN, t: SKIN + MINI.t + MINI.usb.t + 0.8 };
// ponytail: one clearance for every printer; tune per printer if the sled binds or rattles.
const FIT = 0.3;
// The Maintainer's board pocket, stop to plate, over the board and its USB-C
// overhang. The riser never stopped the board's far end, so 22.5 was never
// tested lengthwise: printed trays took the board's width but came up short,
// 1 mm at FIT alone and a millimetre or two more at FIT + 1. The slack sits at
// the stop, so the board still seats its USB-C against the plate, in the
// window. Calipers on the real board, end to end over the USB-C, settle it.
const POCKET = FIT + 3;
const SLOT = { w: SLED.w + 2 * FIT, l: SLED.l + FIT, t: SLED.t + FIT, floor: SKIN };
const PLINTH = Math.ceil(SLOT.floor + SLOT.t + 2);
const mm = (x: number) => Number(x.toFixed(1));

/** A base `w` × `d` centred on (e, n) with the sled slot in its back edge, the
 *  sled in it — pulled `out` mm clear of the slot — and the board it carries.
 *  A tunnel runs from the slot's far end to under each of `feet`, and rises
 *  there to meet the lead channel coming down through the figure. */
function sledBase(
	id: string,
	label: string,
	size: string,
	e: number,
	n: number,
	w: number,
	d: number,
	out: number,
	feet: { e: number; n: number }[],
	xray = false
): Part[] {
	const back = n + d / 2;
	const slot: Box3 = [e - SLOT.w / 2, e + SLOT.w / 2, back - SLOT.l, back + 1, SLOT.floor, SLOT.floor + SLOT.t];
	const [lo, hi] = [SLOT.floor, SLOT.floor + CH];
	const row = feet.length ? feet[0].n : n;
	const fe = feet.map((f) => f.e);
	const tunnels: Box3[] = feet.length
		? [
				[e - CH / 2, e + CH / 2, row - CH / 2, back - SLOT.l + 1, lo, hi],
				[Math.min(e, ...fe) - CH / 2, Math.max(e, ...fe) + CH / 2, row - CH / 2, row + CH / 2, lo, hi],
				...feet.map((f): Box3 => [f.e - CH / 2, f.e + CH / 2, f.n - CH / 2, f.n + CH / 2, lo, PLINTH + 1])
			]
		: [];
	// Four segments rather than one slab: faces the size of the figures
	// standing on them keep the painter's sort honest.
	const plinth = Array.from({ length: 4 }, (_, j) => {
		const e0 = e - w / 2 + (j * w) / 4;
		return cut([e0, e0 + w / 4, n - d / 2, n + d / 2, 0, PLINTH], [slot, ...tunnels]);
	}).flat();
	const [e0, e1, n1] = [e - SLED.w / 2, e + SLED.w / 2, back + out];
	const n0 = n1 - SLED.l;
	const deck = SLOT.floor + SKIN;
	const top = deck + MINI.t;
	const rail = top + 0.8;
	const window: Box3 = [e - MINI.usb.w / 2 - FIT, e + MINI.usb.w / 2 + FIT, n1 - SKIN - 1, n1 + 1, top - FIT, top + MINI.usb.t + FIT];
	const sled = [
		...slab(e0, e1, n0, n1, SLOT.floor, deck),
		...slab(e0, e0 + SKIN, n0, n1 - SKIN, deck, rail),
		...slab(e1 - SKIN, e1, n0, n1 - SKIN, deck, rail),
		// The front stop, notched where the LED leads come in off the tunnel.
		...cut([e0 + SKIN, e1 - SKIN, n0, n0 + SKIN, deck, rail], [[e - CH / 2, e + CH / 2, n0 - 1, n0 + SKIN + 1, deck, rail + 1]]),
		...cut([e0, e1, n1 - SKIN, n1, deck, SLOT.floor + SLED.t], [window])
	];
	return [
		{ id: `${id}-base`, label: `${label} · Base`, kind: 'part', printed: true, size, solids: plinth, colors: plinth.map(() => SPOOLS.black) },
		{
			id: `${id}-sled`,
			label: `${label} · Sled`,
			kind: 'part',
			printed: true,
			size: `${mm(SLED.w)} × ${mm(SLED.l)} × ${mm(SLED.t)}, ${FIT} fit`,
			solids: sled,
			// The base's spool: one plate, no swaps.
			colors: sled.map(() => SPOOLS.black)
		},
		{
			id: `${id}-mini`,
			label: `${label} · ESP32-C6 Super Mini`,
			kind: 'board',
			size: `${MINI.l} × ${MINI.w} × ${MINI.t}, USB-C to the back`,
			solids: slab(e - MINI.w / 2, e + MINI.w / 2, n1 - SKIN - MINI.l, n1 - SKIN, deck, top)
		},
		{
			id: `${id}-usb`,
			label: `${label} · USB-C`,
			kind: 'metal',
			size: 'flush with the sled plate',
			solids: [box(e - MINI.usb.w / 2, e + MINI.usb.w / 2, n1 - MINI.usb.l, n1, top, top + MINI.usb.t)]
		},
		...(xray && tunnels.length ? [channel(`${id}-base`, `${label} · Base`, tunnels.flatMap((t) => slab(...t)))] : [])
	];
}

/** The tallest figure for which four sets fit one plate. Fused, a set is one
 *  object — figures standing on their base. Pegged, each figure needs its own
 *  footprint beside the base, which costs about half the height. */
// ponytail: footprint ratios are estimates; measure `figureParts` before slicing for real.
function planFounders(bedMM: number, mount: Mount) {
	for (let h = 200; h >= 20; h--) {
		const fw = pitch(h);
		const base = { w: 2.4 * h + 16, d: Math.max(0.45 * h + 12, SLOT.l + 8) };
		const block =
			mount === 'fused' ? { w: base.w + 8, d: base.d + 8 } : { w: Math.max(4 * fw, base.w + 8), d: fw + base.d + 8 };
		for (const [cols, rows] of [
			[1, 4],
			[2, 2],
			[4, 1]
		])
			if (cols * block.w <= bedMM && rows * block.d <= bedMM) return { h, fw, base, block, cols, rows };
	}
	return null;
}

const readFounders = (knobs: Knob[]) => {
	const val = (prop: string) => knobs.find((k) => 'prop' in k && k.prop === prop)?.value;
	return { bed: Number(val('bed') ?? 256), mount: (val('mount') ?? 'fused') as Mount };
};

const plate = (bed: number): Part => ({
	id: 'plate',
	label: 'Build plate',
	kind: 'metal',
	size: `${bed} × ${bed}, textured PEI`,
	side: { axis: 'h', sign: -1, layer: 1 },
	solids: [box(-bed / 2, bed / 2, -bed / 2, bed / 2, -2, 0)]
});

function founderParts({ exploded, xray = false, print = false }: ModelView, knobs: Knob[]): Part[] {
	const { bed, mount } = readFounders(knobs);
	const plan = planFounders(bed, mount);
	if (!plan) return [plate(bed)];
	const { h, fw, base, block, cols, rows } = plan;
	// One part per printed piece — each set's base and each of its figures — so
	// a single figure can be hidden, picked out or exported on its own.
	const sets = Array.from({ length: FOUNDER_SETS }, (_, i): Part[] => {
		const cx = -(cols * block.w) / 2 + (i % cols) * block.w + block.w / 2;
		const cy = (rows * block.d) / 2 - Math.floor(i / cols) * block.d - block.d / 2;
		const fused = mount === 'fused';
		// Fused: the four stand on the plinth. Pegged: the plinth sits at the back
		// of the block and the figures print in a row in front of it.
		const plinthN = fused ? cy : cy + block.d / 2 - 4 - base.d / 2;
		const figN = fused ? cy : plinthN - base.d / 2 - 4 - fw / 2;
		const span = fused ? base.w / 4 : fw;
		const figs = CHARACTERS.map((c, j) =>
			figureOnBed({ character_key: c.key, picks: LIT }, h, cx + (j - 1.5) * span, figN, {
				extra: ['emblem.logo'],
				h0: fused ? PLINTH : 0,
				lit: 'foot',
				print
			})
		);
		// Where each figure's leads come out once it stands on the base — the
		// fused spot, whichever way it printed.
		const feet = figs.map((f, j) => ({ e: cx + (j - 1.5) * (base.w / 4) + (f.wire!.e - (cx + (j - 1.5) * span)), n: plinthN }));
		const set = `Set ${i + 1}`;
		const size = `${Math.round(base.w)} × ${Math.round(base.d)} × ${PLINTH}, Employee Nº ${i + 1}`;
		return [
			...sledBase(`set-${i + 1}`, set, size, cx, plinthN, base.w, base.d, exploded ? 30 : 0, feet, xray),
			...CHARACTERS.flatMap((c, j): Part[] => {
				const id = `set-${i + 1}-${c.key}`;
				const label = `${set} · ${c.name.replace('The ', '')}`;
				const { solids, colors, wire } = figs[j];
				return [
					{ id, label, kind: 'part', printed: true, size: `${h} mm, maxed`, solids, colors },
					...(xray ? [channel(id, label, wire!.holes)] : [])
				];
			})
		];
	});
	return [plate(bed), ...sets.flat()];
}

export const FOUNDERS: Model = {
	id: 'founders',
	name: 'Founders',
	blurb: 'Four box sets, maxed loadout, one plate — never rolled, never reprinted',
	zoom: 2.2,
	pivot: 0,
	grid: 0,
	knobs: [
		{ kind: 'choice', group: 'floor', prop: 'bed', label: 'Printer', hint: '256 · X1 / P1, 350 · XL / H2D', value: '256', options: ['256', '350'] },
		{
			kind: 'choice',
			group: 'floor',
			prop: 'mount',
			label: 'Mount',
			hint: 'Fused to the base, or printed apart and pegged',
			value: 'fused',
			options: ['fused', 'pegged']
		}
	],
	build: founderParts,
	stats: (knobs) => {
		const { bed, mount } = readFounders(knobs);
		const plan = planFounders(bed, mount);
		if (!plan) return [{ label: 'Fit', value: 'None', sub: 'four sets do not fit this plate' }];
		return [
			{ label: 'Figure height', value: `${plan.h} mm`, sub: 'tallest that fits four sets' },
			{ label: 'Base', value: `${Math.round(plan.base.w)}×${Math.round(plan.base.d)}`, sub: `mm, ${PLINTH} mm plinth` },
			{ label: 'Sets', value: String(FOUNDER_SETS), sub: `${FOUNDER_SETS * CHARACTERS.length} figures, one plate` },
			{ label: 'Loadout', value: 'Maxed', sub: 'top of every pool + logo plate' },
			{ label: 'Sled', value: 'Wired', sub: 'ESP32-C6 Super Mini, USB-C out the back' },
			{ label: 'LED', value: '5 mm', sub: 'one per figure, pushed up from the foot' }
		];
	}
};

// ── Maintainer one-off ────────────────────────────────────────────────────────
// The founders loadout for one figure alone: the Maintainer, maxed, with its
// board and relay in its head. Four prints — head, body, base and cartridge —
// and a bought board.
const MAINTAINER = CHARACTERS.find((c) => c.key === 'maintainer')!;

const maintainerFigure = (h: number, print = false) =>
	figureOnBed({ character_key: MAINTAINER.key, picks: LIT }, h, 0, 0, { extra: ['emblem.logo'], lit: 'head', print });

const shift = (ss: Solid[], de: number, dh: number) =>
	ss.map((s) => ({ faces: s.faces, verts: s.verts.map((v) => ({ ...v, e: v.e + de, h: v.h + dh })) }));

/** A cartridge's prints and, under x-ray, what it carries. Printed, the sled
 *  stands on its plate and the cover lies on its face, in front of `bedN`; on
 *  stage `home` puts them in their host, and exploded they pull out its back. */
function cartParts(id: string, label: string, c: Cartridge, color: string, view: ModelView, bedN: number, home: (ss: Solid[]) => Solid[]): Part[] {
	const { exploded, xray = false, print = false } = view;
	const GAP = 6;
	const pull = (ss: Solid[], d: number) =>
		exploded ? ss.map((s) => ({ faces: s.faces, verts: s.verts.map((v) => ({ ...v, n: v.n + d })) })) : ss;
	const hs = (ss: Solid[]) => ss.flatMap((s) => s.verts.map((v) => v.h));
	const [s0, s1, k0, k1] = [Math.min(...hs(c.sled)), Math.max(...hs(c.sled)), Math.min(...hs(c.cover)), Math.max(...hs(c.cover))];
	const sledN = bedN - GAP - (s1 - s0);
	const coverN = sledN - GAP - (k1 - k0);
	// A turn about east, never a mirror.
	const onBack = (ss: Solid[], face: number, h0: number, n0: number) =>
		ss.map((s) => ({ faces: s.faces, verts: s.verts.map((v) => ({ e: v.e, n: n0 + v.h - h0, h: face - v.n })) }));
	const printed = (pid: string, plabel: string, size: string, solids: Solid[]): Part => ({
		id: `${id}-${pid}`,
		label: `${label} · ${plabel}`,
		kind: 'part',
		printed: true,
		size,
		solids,
		colors: solids.map(() => color)
	});
	const span = (x: Box3) => `${mm(x[1] - x[0])} × ${mm(x[3] - x[2])} × ${mm(x[5] - x[4])}`;
	// The board lies inside the host, which the stage draws whole: only x-ray,
	// with the host ghosted, can show it without the sort guessing.
	const inside = (x: Box3) => home(pull(slab(...x), 25));
	const p = c.plate;
	return [
		printed(
			'sled',
			'Cartridge',
			`${mm(p[1] - p[0])} × ${mm(p[5] - p[4])} plate, on a track, clicks in`,
			print ? onBack(c.sled, c.back - COVER.t, s0, sledN) : home(pull(c.sled, 25))
		),
		printed(
			'cover',
			'Cover',
			`${COVER.t} mm, presses in over the slot, USB-C through`,
			print ? onBack(c.cover, c.back, k0, coverN) : home(pull(c.cover, 40))
		),
		...(xray
			? [
					{ id: `${id}-mini`, label: `${label} · ESP32-C6 Super Mini`, kind: 'board', size: span(c.mini), solids: inside(c.mini) } as Part,
					{ id: `${id}-usb`, label: `${label} · USB-C`, kind: 'metal', size: 'face on the plate, in its window', solids: inside(c.usb) } as Part,
					{ id: `${id}-relay`, label: `${label} · Mini DC SSR`, kind: 'part', size: span(c.relay), solids: inside(c.relay) } as Part
				]
			: [])
	];
}

export const FOUNDER_MAINTAINER: Model = {
	id: 'founder-maintainer',
	name: 'Founder · Maintainer',
	blurb: 'The Maintainer alone, maxed, its board in a head that lifts off',
	zoom: 3,
	pivot: 30,
	grid: 0,
	knobs: [
		{
			kind: 'choice',
			group: 'floor',
			prop: 'height',
			label: 'Figure height',
			// Scale here, never in the slicer: the slicer would scale the board's
			// pocket and the USB-C window off the board they were measured for.
			// 120 is the floor: at 100 the head is 25 across its flat back and 33
			// deep, and the relay's 30 × 25 tray breaks out of its face (spec:
			// every option fits it, front sealed).
			hint: 'mm, base to crown — 120 sits on a desk',
			value: '120',
			options: ['120', '160']
		}
	],
	build: (view, knobs) => {
		const { exploded, xray = false, print = false } = view;
		const h = Number(read(knobs).height);
		const { wire, brain, prints, sledColor } = maintainerFigure(h, print);
		const [b, p] = [brain!, prints!];
		const box3 = (ss: Solid[]) => bounds({ verts: ss.flatMap((s) => s.verts), faces: [] });
		const [base, body, head] = [box3(p.base.solids), box3(p.body.solids), box3(p.head.solids)];
		// Printed side by side, each on its own floor — the head on its jaw, the
		// body on its soles. On stage they stack, or pull apart up the stack.
		const GAP = 6;
		const at: Record<Print, [de: number, dh: number]> = print
			? { base: [body.e0 - GAP - base.e1, -base.h0], body: [0, -body.h0], head: [body.e1 + GAP - head.e0, -head.h0] }
			: { base: [0, 0], body: [0, exploded ? 15 : 0], head: [0, exploded ? 40 : 0] };
		const piece = (id: Print, label: string, size: string): Part => ({
			id: `maintainer-${id}`,
			label: `Maintainer · ${label}`,
			kind: 'part',
			printed: true,
			size,
			solids: shift(p[id].solids, ...at[id]),
			colors: p[id].colors
		});
		return [
			plate(256),
			piece('head', 'Head', `${mm(head.h1 - head.h0)} mm, on its jaw, lifts off`),
			piece('body', 'Body', `${h} mm assembled, maxed`),
			piece('base', 'Base', `${RIM} mm boot sockets, ${FIT} fit`),
			...cartParts('maintainer', 'Maintainer', b.cart, sledColor!, view, body.n0, (ss) => shift(ss, ...at.head)),
			...(xray ? [channel('maintainer', 'Maintainer', shift(wire!.holes, ...at.body))] : [])
		];
	},
	stats: (knobs) => {
		const h = Number(read(knobs).height);
		const { brain, prints } = maintainerFigure(h);
		const c = brain!.cavity;
		const { body, head } = prints!;
		const spool = (x: string) => Object.entries(SPOOLS).find(([, hex]) => hex === x)?.[0] ?? x;
		const list = (xs: { h: number; color: string }[]) => xs.map((x) => `${spool(x.color)} at ${mm(x.h)}`).join(', ') || 'none';
		return [
			{ label: 'Figure height', value: `${h} mm`, sub: MAINTAINER.name },
			{ label: 'Prints', value: '5', sub: 'head on its jaw, body on its soles, base flat, cartridge on its plate, cover on its face' },
			{ label: 'Colour changes', value: String(body.changes.length + head.changes.length), sub: `body: ${list(body.changes)} · head: ${list(head.changes)}` },
			{ label: 'Brain', value: `${mm(c[1] - c[0])}×${mm(c[3] - c[2])}×${mm(c[5] - c[4])}`, sub: 'mm cavity over the cartridge, for sensors' },
			{ label: 'Cartridge', value: 'Clicks in', sub: `ESP32-C6 + SSR, slides in the back on a track; two arms, ${ARM.bump} mm bumps, ${FIT} fit` },
			{ label: 'USB-C', value: 'Back', sub: "through plate and cover, the riser's 13 × 7.2 window — charges assembled" },
			{ label: 'Leads', value: `${LEAD} mm`, sub: 'plug to hips, out both soles and the base' }
		];
	}
};

// ── Cartridge fit test ────────────────────────────────────────────────────────
// The Maintainer's cartridge and its slot exactly as the head cuts it, walled
// in a block and open on top as the head's cavity leaves it: the drawer, its
// track and its click print in minutes, so the fit is tuned here and the head
// printed once. The cover is left off; it plays no part in the fit.
export const CARTRIDGE_FIT: Model = {
	id: 'cartridge-fit',
	name: 'Cartridge · fit test',
	tags: ['Latch', 'Drawer'],
	blurb: "The Maintainer head's drawer and slot in a block: print it, tune the fit, then the head",
	zoom: 5,
	pivot: 8,
	build: (view) => {
		const c = cartridge(0, 0, WALL + COVER.rim);
		const half = SSR.w / 2 + 2 * FIT;
		const [e1, h1] = [half + COVER.rim + WALL, c.top + COVER.rim + WALL];
		const open = boxHole([-half, half, c.front, -WALL, c.lip, h1 + 1]);
		const host = [...c.holes, open].reduce<Solid[]>((acc, h) => acc.flatMap((s) => carveHull(s, h)), slab(-e1, e1, c.front - WALL, 0, 0, h1));
		return [
			{ id: 'block', label: 'Block', kind: 'part', printed: true, size: `${mm(2 * e1)} × ${mm(WALL - c.front)} × ${mm(h1)}, upright as the head`, solids: host, colors: host.map(() => SPOOLS.black) },
			...cartParts('fit', 'Fit test', c, SPOOLS.black, view, c.front - WALL, (ss) => ss).filter((p) => p.id !== 'fit-cover')
		];
	},
	stats: [
		{ label: 'Prints', value: '2', sub: 'block upright as the head, cartridge on its plate' },
		{ label: 'Fit', value: `${FIT} mm`, sub: `slide fit; board pocket +${mm(POCKET - FIT)} mm` },
		{ label: 'Track', value: `${TRACK.lip} mm lips`, sub: `over ${TRACK.t} mm tongues: the cartridge cannot lift` },
		{ label: 'Click', value: `${ARM.bump} mm bumps`, sub: `on ${ARM.l} mm arms` }
	]
};

// ── Head coupler ──────────────────────────────────────────────────────────────
// A sleeve two Maintainer heads slide into from either end. Its inside is the
// head's own outline at the jaw plus a fit; a solid strip round the middle
// stops each head and carries a 1/4"-20 thread in every flat face, SmallRig's
// screw, so a phone clamp or an arm screws straight on. Above and below the
// strip every outside face carries the visor's diamond grille, laid in exactly
// as the eyes are. It reaches up each head only to the USB-C window's sill, so
// both still charge coupled.
const SLEEVE = {
	// The window's sill is 5 above the jaw.
	depth: 4.8,
	// The visor's skin, so the grille is the eyes' to the bar.
	wall: GLOW,
	// The strip: the thread's length in from the outside face, and solid
	// left above and below its hole.
	strip: { thread: 7, pad: 2 },
	// Each end opens this much wider for this far: a lead-in, and room for
	// the elephant's foot on a head printed on its jaw.
	flare: { by: 0.3, t: 0.6 },
	// Solid left round each grille, top and bottom.
	band: 0.8
};

// 1/4"-20 UNC, the internal thread's basic minor diameter.
const UNC = { pitch: 25.4 / 20, major: 6.35, minor: 6.35 - 1.0825 * (25.4 / 20) };

/** An internal 1/4"-20 thread entering a wall at `c` along `a` (inward, level),
 *  `len` deep, its axis at height `hc`, the bore `rb` to its flats: a helix of
 *  wedges, each a turn of a 60° ridge reaching from the bore wall past the
 *  teardrop's roof, so the top of every turn is fused to the wall too. */
function thread(c: { e: number; n: number }, a: { e: number; n: number }, hc: number, rb: number, len: number): Solid[] {
	const P = UNC.pitch;
	const rc = rb - (UNC.major - UNC.minor) / 2;
	// A 1/8 pitch flat between ridges at the bore, a 60° flank in to the crest.
	const w0 = (7 * P) / 16;
	const w1 = w0 - (rb - rc) * Math.tan(Math.PI / 6);
	const out = (rb / Math.cos(Math.PI / 16)) * Math.SQRT2 + 0.2;
	// Axial across, radial out: a turn of the prism's axes, so it stays wound.
	const foot = ccw([[-w0, out], [w0, out], [w0, rb], [w1, rc], [-w1, rc], [-w0, rb]]);
	const u = { e: -a.n, n: a.e };
	const N = 24;
	return Array.from({ length: Math.floor(((len - 2 * w0) * N) / P) - 1 }, (_, i) => {
		const k = i + Math.ceil((w0 * N) / P);
		const s = prism(foot, 0, 1);
		return {
			faces: s.faces,
			verts: s.verts.map((v) => {
				const th = ((k + v.h) * 2 * Math.PI) / N;
				const t = v.e + (P * (k + v.h)) / N;
				const r = v.n * Math.cos(th);
				return { e: c.e + t * a.e + r * u.e, n: c.n + t * a.n + r * u.n, h: hc + v.n * Math.sin(th) };
			})
		};
	});
}

const cross = (o: Pt2, a: Pt2, b: Pt2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** The convex hull of `pts`, counter-clockwise, collinear points dropped. */
function hull(pts: Pt2[]): Pt2[] {
	const ps = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const half = (xs: Pt2[]) =>
		xs.reduce<Pt2[]>((h, p) => {
			while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 1e-4) h.pop();
			return [...h, p];
		}, []);
	const [lo, up] = [half(ps), half(ps.reverse())];
	return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** Convex, counter-clockwise `poly` with every edge moved out `d`. */
function offset(poly: Pt2[], d: number): Pt2[] {
	const line = (i: number) => {
		const [p, q] = [poly[i], poly[(i + 1) % poly.length]];
		const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
		const [x, y] = [(q[1] - p[1]) / L, (p[0] - q[0]) / L];
		return { x, y, c: x * p[0] + y * p[1] + d };
	};
	return poly.map((_, i) => {
		const [a, b] = [line((i + poly.length - 1) % poly.length), line(i)];
		const det = a.x * b.y - a.y * b.x;
		return [(a.c * b.y - b.c * a.y) / det, (a.x * b.c - b.x * a.c) / det];
	});
}

const readSleeve = (knobs: Knob[]) => {
	const h = Number(read(knobs).height);
	const fit = Number(knobs.find((k) => 'prop' in k && k.prop === 'fit')?.value ?? 0.15);
	const head = maintainerFigure(h).prints!.head;
	const jaw = Math.min(...head.solids.flatMap((s) => s.verts.map((v) => v.h)));
	const foot = hull(head.solids.flatMap((s) => s.verts.filter((v) => v.h <= jaw + SLEEVE.depth + 0.01).map((v): Pt2 => [v.e, v.n])));
	const span = (p: Pt2[], k: 0 | 1) => mm(Math.max(...p.map((x) => x[k])) - Math.min(...p.map((x) => x[k])));
	// The bore lies down as `rod`'s teardrop: 1/cos(π/16) below its axis, √2
	// that above, to its roof's ridge.
	const rb = UNC.major / 2 + Number(knobs.find((k) => 'prop' in k && k.prop === 'thread')?.value ?? 0.2);
	const R = rb / Math.cos(Math.PI / 16);
	const { pad } = SLEEVE.strip;
	const strip = 2 * pad + R * (1 + Math.SQRT2);
	return { fit, head, jaw, foot, span, rb, hc: SLEEVE.depth + pad + R, strip, tall: 2 * SLEEVE.depth + strip };
};

export const HEAD_COUPLER: Model = {
	id: 'head-coupler',
	name: 'Head coupler',
	tags: ['Fit test'],
	blurb: 'A grilled sleeve two Maintainer heads slide into, a 1/4"-20 thread in each face',
	zoom: 3.5,
	pivot: SLEEVE.depth,
	knobs: [
		{ ...FOUNDER_MAINTAINER.knobs![0], hint: 'mm, the figure the heads were printed for' },
		{
			kind: 'choice',
			group: 'floor',
			prop: 'fit',
			label: 'Fit',
			// ponytail: per side over the head, tuned by printing one.
			hint: 'mm clear per side round the head — smaller grips harder',
			value: '0.15',
			options: ['0.1', '0.15', '0.2', '0.25']
		},
		{
			kind: 'choice',
			group: 'floor',
			prop: 'thread',
			label: 'Thread fit',
			// ponytail: radial clearance on a printed 1/4"-20; tuned by printing one.
			hint: 'mm added to the thread all round — larger if the screw binds',
			value: '0.2',
			options: ['0.1', '0.2', '0.3']
		}
	],
	build: ({ exploded, print = false }, knobs) => {
		const { fit, head, jaw, foot, span, rb, hc, strip, tall } = readSleeve(knobs);
		const { depth, wall, flare, band } = SLEEVE;
		const len = SLEEVE.strip.thread;
		const [inner, outer] = [offset(foot, fit), offset(foot, fit + wall)];
		const ring = (a: Pt2[], b: Pt2[], h0: number, h1: number) =>
			a.map((_, i) => {
				const j = (i + 1) % a.length;
				return prism(ccw([a[i], a[j], b[j], b[i]]), h0, h1);
			});
		const walls = [
			...ring(outer, offset(foot, fit + flare.by), 0, flare.t),
			...ring(outer, inner, flare.t, tall - flare.t),
			...ring(outer, offset(foot, fit + flare.by), tall - flare.t, tall),
			...ring(inner, offset(foot, fit + wall - len), depth, depth + strip)
		];
		const edges = outer.map((p, i) => [p, outer[(i + 1) % outer.length]] as const);
		const long = ([p, q]: readonly [Pt2, Pt2]) => Math.hypot(q[0] - p[0], q[1] - p[1]);
		// A grille each side of the strip on every face long enough to hold one.
		const grilles = edges.flatMap(([p, q]) => {
			if (long([p, q]) < 2 * wall + 2 * HOLE) return [];
			const [a, b] = [{ e: p[0], n: p[1] }, { e: q[0], n: q[1] }];
			return [grille(a, b, band, depth, wall), grille(a, b, depth + strip, tall - band, wall)];
		});
		// A thread centred in each of the four flat faces, square to it.
		const taps = [...edges].sort((x, y) => long(y) - long(x)).slice(0, 4).map(([p, q]) => {
			const L = long([p, q]);
			const a = { e: -(q[1] - p[1]) / L, n: (q[0] - p[0]) / L };
			const c = { e: (p[0] + q[0]) / 2, n: (p[1] + q[1]) / 2 };
			const axis = Math.abs(a.e) > Math.abs(a.n) ? 'e' : 'n';
			const [x0, x1] = axis === 'e' ? [c.e - a.e, c.e + a.e * (len + 1)] : [c.n - a.n, c.n + a.n * (len + 1)];
			const bore = rod(axis, [axis === 'e' ? c.n : c.e, hc], Math.min(x0, x1), Math.max(x0, x1), rb);
			return { hole: grow(bore, 0), ridge: thread(c, a, hc, rb, len) };
		});
		const sleeve = [
			...[...grilles, ...taps].reduce<Solid[]>((acc, g) => acc.flatMap((s) => carveHull(s, g.hole)), walls),
			...grilles.flatMap((g) => g.bars),
			...taps.flatMap((t) => t.ridge)
		];
		const part: Part = {
			id: 'sleeve',
			label: 'Sleeve',
			kind: 'part',
			printed: true,
			shell: true,
			size: `${span(outer, 0)} × ${span(outer, 1)} × ${mm(tall)}, ${fit} fit, on its end`,
			solids: sleeve,
			colors: sleeve.map(() => SPOOLS.black)
		};
		if (print) return [part];
		// The heads it couples, for the eye: one on top, one turned over beneath.
		const lift = exploded ? 20 : 0;
		const top = head.solids.map((s) => ({ faces: s.faces, verts: s.verts.map((v) => ({ ...v, h: v.h - jaw + depth + strip + lift })) }));
		const under = head.solids.map((s) => ({ faces: s.faces, verts: s.verts.map((v) => ({ e: -v.e, n: v.n, h: jaw - v.h + depth - lift })) }));
		const ctx = (id: string, label: string, solids: Solid[]): Part => ({ id, label, kind: 'part', size: 'printed already', solids, colors: head.colors });
		return [part, ctx('head-top', 'Head · top', top), ctx('head-under', 'Head · under', under)];
	},
	stats: (knobs) => {
		const { fit, foot, span, strip, tall } = readSleeve(knobs);
		const inner = offset(foot, fit);
		return [
			{ label: 'Inside', value: `${span(inner, 0)}×${span(inner, 1)}`, sub: `mm, the head at its jaw + ${fit} a side` },
			{ label: 'Height', value: `${mm(tall)} mm`, sub: `${SLEEVE.depth} up each head, a ${mm(strip)} strip between` },
			{ label: 'Mounts', value: '4 × 1/4"-20', sub: `SmallRig's screw, printed, ${SLEEVE.strip.thread} mm deep, one per flat face` },
			{ label: 'Wall', value: `${SLEEVE.wall} mm`, sub: `the visor's diamond grille, ${HOLE} mm cells` },
			{ label: 'Prints', value: '1', sub: 'on its end, no supports' }
		];
	}
};
