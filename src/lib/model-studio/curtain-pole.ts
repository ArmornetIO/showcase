// ── model-studio/curtain-pole — a telescoping pole that pushes a curtain ─────
// Pushes a curtain's lead ring along its rod. Nested stages (octagonal where
// only their flats stop them turning, round where a rack keys them) slide on
// two bearing bands each: a collar at an
// inner stage's foot, a lip at the outer stage's mouth. The collar meeting the
// lip is the stop. The bands are the only surfaces that touch.
//
// Drawn standing, the way each stage prints; it hangs level in use. Nested and
// standing, the stages print in place with no supports: each foot is on the
// bed, and the lip is the one overhang (a 45° chamfer in the slicer).
//
// `telescopic-pole` is the full four-stage pole on a tape blade. The `pole-*`
// models are one small telescope each, to try the drives before scaling one.

import { box, prism, type Solid } from '../mesh-studio/pieces/pieces.js';
import type { Knob } from '../backdrop/backdrop-tokens.js';
import { carve, carveHull, cut, grow, rod, tube, within, type Box3, type Plane, type Pt2, type Model, type ModelView, type Part } from './model-geometry.js';

const WALL = 1.6; // PETG, four 0.4 perimeters
const SLIP = 0.4; // bearing clearance, also the print-in-place gap
const BAND = 1.6; // collar / lip stands proud of its tube by this
const BAND_H = 20; // collar and lip length; full extension overlaps both

const EXTEND: Knob = {
	kind: 'param',
	group: 'floor',
	prop: 'extend',
	label: 'Extension',
	hint: '% of full stroke',
	value: 50,
	min: 0,
	max: 100,
	step: 5,
	unit: '%'
};
/** How far out, 0–1. The print export is always collapsed: nested stages
 *  print in place. */
const extension = (view: ModelView, knobs: Knob[]) =>
	view.print ? 0 : Number(knobs.find((k) => 'prop' in k && k.prop === 'extend')?.value ?? 50) / 100;

/** A round tube standing along `h`: sixteen convex wedges, so the bore stays
 *  open. Where a rack keys the stages, they need no flats to stop turning. */
function ring(e: number, n: number, ro: number, ri: number, h0: number, h1: number): Solid[] {
	const pt = (r: number, k: number): [number, number] => [e + r * Math.cos((k * Math.PI) / 8), n + r * Math.sin((k * Math.PI) / 8)];
	return Array.from({ length: 16 }, (_, k) => prism([pt(ro, k), pt(ro, k + 1), pt(ri, k + 1), pt(ri, k)], h0, h1));
}

/** One stage, `ri` its half bore, foot at `h`. Kept in pieces so a drive can
 *  notch the collar or window the wall without touching the rest. Octagonal
 *  (`tube`) unless something else stops it turning. */
function stage(
	e: number,
	ri: number,
	h: number,
	len: number,
	has: { collar: boolean; lip: boolean },
	band = BAND,
	shape: typeof tube = tube
) {
	const ro = ri + WALL;
	const top = h + len;
	return {
		wall: shape(e, 0, ro, ri, h, top),
		collar: has.collar ? shape(e, 0, ro + band, ro, h, h + BAND_H) : [],
		lip: has.lip ? shape(e, 0, ri, ri - band, top - BAND_H, top) : []
	};
}

const holed = (ss: Solid[], hole: Box3) => ss.flatMap((s) => carve(s, hole));

/** A solid drawn in the (e, h) plane, extruded along `n` from n0 to n1. Built
 *  standing, then turned: a turn, never a mirror, so the faces stay
 *  outward-wound. `foot` is counter-clockwise in (e, h). */
function alongN(foot: [number, number][], n0: number, n1: number): Solid {
	const s = prism(foot, -n1, -n0);
	return { faces: s.faces, verts: s.verts.map((v) => ({ e: v.e, n: -v.h, h: v.n })) };
}

/** `rim`, wider than the stage, is what presses an end-stop at full retract. */
function tipCap(e: number, ro: number, top: number, rim = ro): Part {
	return {
		id: 'tip',
		label: 'Tip cap',
		kind: 'cover',
		printed: true,
		size: rim > ro ? `Ø${(2 * rim).toFixed(0)} rim, carriage eye, Ø5 pin` : 'carriage eye, Ø5 pin',
		solids: [
			rod('h', [e, 0], top, top + 4, rim),
			...cut([e - 3, e + 3, -7, 7, top + 4, top + 18], [[e - 4, e + 4, -2.5, 2.5, top + 8, top + 13]])
		]
	};
}

// ── Four stages on a tape blade ───────────────────────────────────────────────
// A steel tape-measure blade runs up the hollow middle from a motor-driven
// reel in the base to the tip cap: rigid enough to push, flexible enough to
// coil, so the drive is never longer than the base.
const POLE = {
	stages: 4,
	len: 300, // assumed: fits a 300 mm Z, the K2's smallest
	bore: 8.4, // innermost half across flats: a 13 mm tape blade, curved, with room
	tape: 13 // assumed: keychain tape, 13 mm × 2 m
};
const TRAVEL = POLE.len - 2 * BAND_H;
const REEL_R = 26; // 2 m of 0.1 mm blade on a Ø20 hub
const BASE_H = 2 * REEL_R + 8;
// Half bore across flats, innermost first.
const STAGE_RI = Array.from({ length: POLE.stages }, (_, k) => POLE.bore + k * (WALL + BAND + SLIP));
const POLE_R = STAGE_RI.at(-1)! + WALL;
const STROKE = (POLE.stages - 1) * TRAVEL;

function telescopicPole(view: ModelView, knobs: Knob[]): Part[] {
	const { exploded } = view;
	const ext = extension(view, knobs);
	const last = POLE.stages - 1;
	// Exploded lays the stages out on the bed beside the base, as printed.
	const at = (k: number) =>
		exploded ? { e: POLE_R + 30 + (last - k) * (2 * POLE_R + 10), h: 0 } : { e: 0, h: BASE_H + (last - k) * ext * TRAVEL };
	const stages = STAGE_RI.map((ri, k): Part => {
		const { e, h } = at(k);
		const s = stage(e, ri, h, POLE.len, { collar: k < last, lip: k > 0 });
		return {
			id: `stage-${POLE.stages - k}`,
			label: `Stage ${POLE.stages - k}${k === last ? ' (base)' : k === 0 ? ' (tip)' : ''}`,
			kind: k % 2 ? 'shell' : 'cover',
			shell: true,
			printed: true,
			size: `Ø${(2 * (ri + WALL)).toFixed(1)} flats × ${POLE.len}`,
			solids: [...s.wall, ...s.collar, ...s.lip]
		};
	});
	const tip = at(0);
	const capH = tip.h + POLE.len;
	const RC = { e: -REEL_R, h: BASE_H / 2 };
	return [
		{
			id: 'base',
			label: 'Base · reel housing',
			kind: 'shell',
			shell: true,
			printed: true,
			size: `${REEL_R * 2 + 30} × 60 × ${BASE_H}, tape slot`,
			solids: cut(
				[-2 * REEL_R - 4, POLE_R + 3, -12, 48, 0, BASE_H],
				[
					[-2 * REEL_R - 2, POLE_R + 1, -10, 46, 2, BASE_H - 2],
					[-2, 4, -POLE.tape / 2 - 1, POLE.tape / 2 + 1, BASE_H - 3, BASE_H + 1]
				]
			)
		},
		...stages,
		tipCap(tip.e, STAGE_RI[0] + WALL, capH),
		{
			id: 'reel',
			label: 'Tape reel',
			kind: 'part',
			size: `Ø${REEL_R * 2}, ${POLE.tape} mm blade × 2 m`,
			solids: [rod('n', [RC.e, RC.h], -POLE.tape / 2 - 1, POLE.tape / 2 + 1, REEL_R)]
		},
		{
			id: 'motor',
			label: 'N20 gear motor',
			kind: 'metal',
			size: '12 × 10 × 34, on the reel shaft',
			solids: [box(RC.e - 6, RC.e + 6, POLE.tape / 2 + 3, POLE.tape / 2 + 37, RC.h - 5, RC.h + 5)]
		},
		...(exploded
			? []
			: [
					{
						id: 'tape',
						label: 'Tape blade',
						kind: 'wire',
						size: `${POLE.tape} wide, reel to tip`,
						solids: [box(0, 0.8, -POLE.tape / 2, POLE.tape / 2, RC.h, capH)]
					} satisfies Part
				])
	];
}

export const TELESCOPIC_POLE: Model = {
	id: 'telescopic-pole',
	name: 'Telescopic pole',
	blurb: 'Curtain pusher: nested stages driven by a tape blade up the middle',
	tags: ['curtain'],
	zoom: 0.65,
	pivot: 400,
	grid: 120,
	knobs: [EXTEND],
	build: telescopicPole,
	stats: [
		{ label: 'Outer', value: `Ø${(2 * POLE_R).toFixed(1)} mm`, sub: 'across flats, base stage' },
		{ label: 'Collapsed', value: `${BASE_H + POLE.len} mm`, sub: 'base + one stage' },
		{ label: 'Stroke', value: `${STROKE} mm`, sub: `${POLE.stages - 1} × ${TRAVEL}, ${2 * BAND_H} mm overlap left` },
		{ label: 'Wall', value: `${WALL} mm`, sub: `PETG, ${SLIP} slip at each band` }
	]
};

// ── One small telescope, three drives ─────────────────────────────────────────
// Every concept is an outer stage, an inner stage and a foot, small enough to
// print in an hour. What differs is what turns the motor into travel.
const LEN = 120;
const SHORT_TRAVEL = LEN - 2 * BAND_H;
const FOOT = 4;
// Printed gears: module 1 is the finest a 0.4 nozzle holds under load.
const M = 1;
const PITCH = Math.PI * M;
const TOOTH = 2.25 * M;
// A rack shares its flat with a collar or lip, so the bands there stand as
// proud as a tooth, with a land under it.
const RACK_BAND = TOOTH + 0.15;
const RACK_W = 3; // half the face width, rack and pinion alike

/** A spur gear on an axle along `n`, centred on (e, h), with a `bore` for the
 *  shaft: a hub ring and one convex tooth per pitch, since a toothed outline is
 *  not convex. 20° flanks. */
function spur(e: number, h: number, n0: number, n1: number, z: number, bore: number): Solid[] {
	const rp = (M * z) / 2;
	const [rr, rt] = [rp - 1.25 * M, rp + M];
	const pt = (r: number, t: number): [number, number] => [e + r * Math.cos(t), h + r * Math.sin(t)];
	const hub = tube(0, 0, rr, bore, -n1, -n0).map((s) => ({
		faces: s.faces,
		verts: s.verts.map((v) => ({ e: v.e + e, n: -v.h, h: v.n + h }))
	}));
	const teeth = Array.from({ length: z }, (_, i) => {
		const t = (2 * Math.PI * i) / z;
		const [a, b] = [(0.55 * Math.PI) / z, (0.3 * Math.PI) / z];
		return alongN([pt(rr * 0.95, t - a), pt(rr * 0.95, t + a), pt(rt, t + b), pt(rt, t - b)], n0, n1);
	});
	return [...hub, ...teeth];
}

/** Rack teeth on a wall at `e0`, standing out toward `dir`, one per pitch from
 *  h0 to h1. Trapezoids with 20° flanks, so they print standing. */
function rack(e0: number, dir: 1 | -1, h0: number, h1: number): Solid[] {
	const tan = Math.tan((20 * Math.PI) / 180);
	const [root, tip] = [PITCH / 4 + 1.25 * M * tan, PITCH / 4 - M * tan];
	const et = e0 + dir * TOOTH;
	return Array.from({ length: Math.floor((h1 - h0) / PITCH) }, (_, i) => {
		const c = h0 + (i + 0.5) * PITCH;
		const f: [number, number][] = [
			[e0, c - root],
			[et, c - tip],
			[et, c + tip],
			[e0, c + root]
		];
		return alongN(dir > 0 ? f : f.reverse(), -RACK_W, RACK_W);
	});
}

const foot = (e: number, r: number): Part => ({
	id: 'foot',
	label: 'Foot',
	kind: 'shell',
	shell: true,
	printed: true,
	size: `Ø${(2 * r).toFixed(1)} × ${FOOT}, wall bracket later`,
	solids: [rod('h', [e, 0], 0, FOOT, r)]
});

/** Where the base and the two stages stand: assembled, or laid out in a row
 *  on the bed as printed, the outer stage in the middle. */
function layout(exploded: boolean, ext: number, base: number, spacing: number) {
	return exploded
		? { base: -spacing, outer: { e: 0, h: 0 }, inner: { e: spacing, h: 0 } }
		: { base: 0, outer: { e: 0, h: base }, inner: { e: 0, h: base + ext * SHORT_TRAVEL } };
}

// ── A · rack outside ──────────────────────────────────────────────────────────
// Round stages; a rack moulded up the inner one runs through notches in its
// own collar and the outer lip, which is what stops them turning. A stepper
// from an Ender 3 V2 turns the pinion through a window in the wall, in a round
// can on the outer stage that also holds the ESP32-C6 and its TMC2208: the
// pole carries everything, and one USB-C cable feeds it. At full retract the
// tip cap's rim presses one of the V2's end-stops, the zero the stepper counts
// from, so armornet always knows how far out it is.
const A = { ri: 8.4, z: 18 };
// NEMA17 42-40 as in the V2: standard face, M3 holes 31 apart, Ø22 boss, 5 mm
// D-shaft 24 long.
const NEMA = { face: 42.3, len: 40, boss: 11, holes: 15.5, shaft: 24 };
// The mount disc, moulded on the outer stage; the shaft reaches the pinion
// from its far face.
const MOUNT = { n0: 12, t: 8 };
// The can clears the motor's corners. Behind the motor: the Super Mini
// (measured) and a TMC2208 stepstick (standard 15.2 × 20.3), both on the
// USB-C's 5 V; the TMC2208 runs a stepper from 4.75 V, slower than the V2's
// 24 V but plenty for a curtain.
const CAN = { r: 30.5, wall: 1.6, boards: 10 };
// The V2's end-stop: a microswitch in its housing. Assumed; measure it.
const STOP = { l: 20, w: 10, t: 6.5 };

/** A circle in the (e, h) plane, counter-clockwise: a footprint for `alongN`. */
const disc = (e: number, h: number, r: number) =>
	Array.from({ length: 16 }, (_, k): [number, number] => [e + r * Math.cos((k * Math.PI) / 8), h + r * Math.sin((k * Math.PI) / 8)]);

/** `ring`, lying along n, centred on (e, h): turned, never mirrored. */
const ringN = (e: number, h: number, ro: number, ri: number, n0: number, n1: number): Solid[] =>
	ring(0, 0, ro, ri, -n1, -n0).map((s) => ({ faces: s.faces, verts: s.verts.map((v) => ({ e: v.e + e, n: -v.h, h: v.n + h })) }));

function rackOutside(view: ModelView, knobs: Knob[]): Part[] {
	const { exploded } = view;
	const roI = A.ri + WALL;
	const riO = roI + RACK_BAND + SLIP;
	const roO = riO + WALL;
	const { base, outer, inner } = layout(exploded, extension(view, knobs), FOOT, 2 * roO + 70);
	const top = outer.h + LEN;
	const rp = (M * A.z) / 2;
	// Pinion centre: one module in from the rack's tips is its pitch line.
	const pe = outer.e + roI + TOOTH - M + rp;
	const ph = top - BAND_H - 12; // its window clears the lip
	const o = stage(outer.e, riO, outer.h, LEN, { collar: false, lip: true }, RACK_BAND, ring);
	const i = stage(inner.e, A.ri, inner.h, LEN, { collar: true, lip: false }, RACK_BAND, ring);
	const key = (e0: number, e1: number, h0: number, h1: number): Box3 => [e0, e1, -RACK_W - SLIP, RACK_W + SLIP, h0, h1];
	// The mount disc, its bore cut back to the stage's, and the motor's boss
	// and four bolts through it. Printed with the stage, it wants a snap-off
	// support under its overhang.
	const half = NEMA.face / 2;
	const face = MOUNT.n0 + MOUNT.t;
	const R = CAN.r + CAN.wall;
	const thru = (e: number, h: number, r: number): Box3 => [e - r, e + r, MOUNT.n0 - 1, face + 1, h - r, h + r];
	const bore = grow(rod('h', [outer.e, 0], outer.h - 1, top + 1, riO), 0);
	const mount = [
		thru(pe, ph, NEMA.boss + 0.3),
		...[-1, 1].flatMap((a) => [-1, 1].map((b) => thru(pe + a * NEMA.holes, ph + b * NEMA.holes, 1.6)))
	].reduce((ss, hole) => holed(ss, hole), carveHull(alongN(disc(pe, ph, R), MOUNT.n0, face), bore));
	// The can, motor face to its cap; the boards stand off the motor's back.
	const back = face + NEMA.len;
	const end = back + CAN.boards;
	const cap = end + (exploded ? 25 : 0);
	const usb: Box3 = [pe - 16, pe - 6, back, back + 7, ph - R - 1, ph - CAN.r + 1];
	// End-stop on the far side, its lever just proud of the mouth.
	const se = outer.e - roO - 1.5;
	const rim = roO + STOP.t + 2;
	// Thumb drive, for proving the mesh and the slide before a motor is picked:
	// the pinion turns on an M3 bolt between two cheeks, their undersides at
	// 45° so they print off the standing stage with nothing under them.
	const stepper = knobs.find((k) => 'prop' in k && k.prop === 'drive')?.value === 'stepper';
	const [ce0, ce1] = [outer.e + riO - 0.3, pe + 5];
	const cheek = (n0: number) =>
		carve(
			alongN(
				[
					[ce0, ph - 6 - (ce1 - ce0)],
					[ce1, ph - 6],
					[ce1, ph + 6],
					[ce0, ph + 6]
				],
				n0,
				n0 + 2
			),
			[pe - 1.6, pe + 1.6, n0 - 1, n0 + 3, ph - 1.6, ph + 1.6]
		);
	const nc = RACK_W + 0.5; // pinion face to cheek: a washer's room
	const thumb: Part[] = [
		{
			id: 'bolt',
			label: 'M3 × 16 bolt + nut',
			kind: 'metal',
			size: 'the axle',
			solids: [
				rod('n', [pe, ph], -nc - 4.4, nc + 2.5, 1.5),
				rod('n', [pe, ph], nc + 2, nc + 5, 2.75),
				box(pe - 2.75, pe + 2.75, -nc - 4.4, -nc - 2, ph - 2.75, ph + 2.75)
			]
		}
	];
	return [
		foot(base, roO + 2),
		{
			id: 'outer',
			label: 'Outer stage',
			kind: 'shell',
			shell: true,
			printed: true,
			size: `Ø${(2 * roO).toFixed(1)} × ${LEN}, notched lip, pinion window, ${stepper ? 'motor mount, end-stop pad' : 'axle cheeks'}`,
			solids: [
				...holed(o.wall, key(outer.e + riO - 1, outer.e + roO + 1, ph - 10, ph + 10)),
				...holed(o.lip, key(outer.e + riO - RACK_BAND - 1, outer.e + riO + 1, top - BAND_H - 1, top + 1)),
				...(stepper
					? [...mount, box(se, outer.e - roO + 1.2, -STOP.w / 2 - 1, STOP.w / 2 + 1, top - STOP.l - 3, top - 2)]
					: [...cheek(nc), ...cheek(-nc - 2)])
			]
		},
		{
			id: 'inner',
			label: 'Inner stage · rack',
			kind: 'cover',
			shell: true,
			printed: true,
			size: `Ø${(2 * roI).toFixed(1)} × ${LEN}, module ${M} rack up one side`,
			solids: [
				...i.wall,
				...holed(i.collar, key(inner.e + roI - 1, inner.e + roI + RACK_BAND + 1, inner.h - 1, inner.h + BAND_H + 1)),
				// A flat backing, so the teeth stand on the curve.
				box(inner.e + roI - 0.6, inner.e + roI, -RACK_W, RACK_W, inner.h + 1, inner.h + LEN - 1),
				...rack(inner.e + roI, 1, inner.h + 1, inner.h + LEN - 1)
			]
		},
		tipCap(inner.e, roI, inner.h + LEN, stepper ? rim : roI),
		{
			id: 'pinion',
			label: 'Pinion',
			kind: 'cover',
			printed: true,
			size: `${A.z}T module ${M}, Ø${2 * rp} pitch, ${stepper ? '5 mm D-bore' : 'Ø3.2 bore'}, prints flat`,
			solids: spur(pe, ph, -RACK_W, RACK_W, A.z, stepper ? 2.5 : 1.6)
		},
		...(!stepper
			? thumb
			: ([
		{
			id: 'stepper',
			label: 'Stepper (from the V2)',
			kind: 'part',
			size: `NEMA17 ${NEMA.face} square × ${NEMA.len}, 5 mm shaft`,
			solids: [
				rod('n', [pe, ph], face - NEMA.shaft, face, 2.5),
				rod('n', [pe, ph], face - 2, face, NEMA.boss),
				box(pe - half, pe + half, face, face + NEMA.len, ph - half, ph + half)
			],
			colors: ['var(--fg-muted)', 'var(--fg-muted)', 'var(--palette-blue)']
		},
		{
			id: 'endstop',
			label: 'End-stop (from the V2)',
			kind: 'part',
			size: `${STOP.l} × ${STOP.w} × ${STOP.t}, pressed by the tip cap at full retract`,
			solids: [
				box(se - STOP.t, se, -STOP.w / 2, STOP.w / 2, top - STOP.l - 1, top - 1),
				box(se - STOP.t + 1, se - 2, -1, 1, top - 1, top + 1.5)
			],
			colors: ['var(--palette-red)', 'var(--fg-muted)']
		},
		{
			id: 'can',
			label: 'Motor can',
			kind: 'shell',
			shell: true,
			printed: true,
			size: `Ø${(2 * R).toFixed(0)} × ${end - face}, stepper and boards inside, USB-C underneath`,
			solids: holed(ringN(pe, ph, R, CAN.r, face, end), usb)
		},
		{
			id: 'can-cap',
			label: 'Can cap',
			kind: 'cover',
			shell: true,
			printed: true,
			size: `Ø${(2 * R).toFixed(0)} × ${CAN.wall}`,
			solids: [alongN(disc(pe, ph, R), cap, cap + CAN.wall)]
		},
		{
			id: 'mini',
			label: 'ESP32-C6 Super Mini',
			kind: 'board',
			size: '22.5 × 18, runs armornet; its USB-C powers everything',
			solids: [
				box(pe - 20, pe - 2, back + 1, back + 2, ph - 22, ph + 0.5),
				box(pe - 15.5, pe - 6.5, back + 2, back + 5.2, ph - 23, ph - 15.6)
			],
			colors: ['var(--palette-emerald)', 'var(--fg-muted)']
		},
		{
			id: 'driver',
			label: 'TMC2208',
			kind: 'board',
			size: '15.2 × 20.3 stepstick, heatsink to the cap',
			solids: [
				box(pe + 2, pe + 17.2, back + 1, back + 2.6, ph - 10.15, ph + 10.15),
				box(pe + 5, pe + 14, back + 2.6, back + 8, ph - 4.5, ph + 4.5)
			],
			colors: ['var(--palette-purple)', 'var(--fg-muted)']
		},
		...(exploded
			? []
			: [
					{
						id: 'leads',
						label: 'End-stop lead',
						kind: 'wire',
						size: '2 wires, end-stop to the can',
						solids: [
							box(se - 4, se - 2, -1, face + 6, top - STOP.l - 2, top - STOP.l),
							box(se - 4, pe - CAN.r + 2, face + 4, face + 6, top - STOP.l - 2, top - STOP.l)
						]
					} satisfies Part
				])
			] satisfies Part[]))
	];
}

export const POLE_RACK: Model = {
	id: 'pole-rack',
	name: 'Pole · rack outside',
	blurb: 'One telescope: printed rack and pinion, thumb-turned, or a stepper and the ESP32-C6 in a round can',
	tags: ['curtain'],
	zoom: 2.4,
	pivot: 70,
	knobs: [
		EXTEND,
		{
			kind: 'choice',
			group: 'floor',
			prop: 'drive',
			label: 'Drive',
			hint: 'thumb proves the mesh; stepper is the V2 motor in its can',
			value: 'thumb',
			options: ['thumb', 'stepper']
		}
	],
	build: rackOutside,
	stats: [
		{ label: 'Stroke', value: `${SHORT_TRAVEL} mm`, sub: `one telescope, ${LEN} mm stages` },
		{ label: 'Pole', value: `Ø${(2 * (A.ri + 2 * WALL + RACK_BAND + SLIP)).toFixed(1)} mm`, sub: 'round; the rack keys it' },
		{ label: 'Can', value: `Ø${(2 * (CAN.r + CAN.wall)).toFixed(0)} mm`, sub: 'stepper, ESP32-C6 and TMC2208 inside' },
		{ label: 'Gears', value: `module ${M}`, sub: `${A.z}T pinion, ${(Math.PI * M * A.z).toFixed(1)} mm per motor turn` },
		{ label: 'Power', value: 'USB-C 5 V', sub: 'one 2–3 A charger into the can runs everything' },
		{ label: 'Prints', value: '6', sub: 'stages nested (support under the mount), pinion, foot, tip cap, can, cap' }
	]
};

// ── B · lead screw ────────────────────────────────────────────────────────────
// An N20 in the base turns a printed four-start lead screw up the middle; a
// nut moulded into the inner stage's foot climbs it. Stroke can never beat the
// screw's length, so it scales only as nested threaded tubes.
const B_RI = 8.4;
const B_BASE = 40;
const SCREW_R = 5; // printed Ø10, 2 mm pitch × 4 starts = 8 mm lead

function leadScrew(view: ModelView, knobs: Knob[]): Part[] {
	const { exploded } = view;
	const roI = B_RI + WALL;
	const riO = roI + BAND + SLIP;
	const roO = riO + WALL;
	const { base: b, outer, inner } = layout(exploded, extension(view, knobs), B_BASE, 2 * roO + 30);
	const o = stage(outer.e, riO, outer.h, LEN, { collar: false, lip: true });
	const i = stage(inner.e, B_RI, inner.h, LEN, { collar: true, lip: false });
	const screwTop = B_BASE + SHORT_TRAVEL + 12; // nut still on it at full stroke
	const R = roO + 3;
	const S = SCREW_R + 0.5;
	return [
		{
			id: 'base',
			label: 'Base · motor housing',
			kind: 'shell',
			shell: true,
			printed: true,
			size: `${(2 * R).toFixed(0)} square × ${B_BASE}, screw hole`,
			solids: cut(
				[b - R, b + R, -R, R, 0, B_BASE],
				[
					[b - R + 2, b + R - 2, -R + 2, R - 2, 2, B_BASE - 2],
					[b - S, b + S, -S, S, B_BASE - 3, B_BASE + 1]
				]
			)
		},
		{
			id: 'outer',
			label: 'Outer stage',
			kind: 'shell',
			shell: true,
			printed: true,
			size: `Ø${(2 * roO).toFixed(1)} × ${LEN}`,
			solids: [...o.wall, ...o.lip]
		},
		{
			id: 'inner',
			label: 'Inner stage · nut',
			kind: 'cover',
			shell: true,
			printed: true,
			size: `Ø${(2 * roI).toFixed(1)} × ${LEN}, nut moulded in its foot`,
			solids: [...i.wall, ...i.collar, ...tube(inner.e, 0, B_RI, SCREW_R + 0.4, inner.h, inner.h + 10)]
		},
		tipCap(inner.e, roI, inner.h + LEN),
		{
			id: 'motor',
			label: 'N20 gear motor',
			kind: 'part',
			size: '12 × 10 × 24, shaft up',
			solids: [box(b - 6, b + 6, -5, 5, B_BASE - 30, B_BASE - 6)]
		},
		{
			id: 'screw',
			label: 'Printed lead screw',
			kind: 'cover',
			printed: true,
			size: `Ø${SCREW_R * 2} × ${screwTop - B_BASE + 6}, 4-start 8 mm lead, D-bore on the motor shaft`,
			solids: [
				rod('h', [b, 0], B_BASE - 6, screwTop, SCREW_R - 1),
				...Array.from({ length: Math.floor((screwTop - B_BASE) / 2) }, (_, k) => rod('h', [b, 0], B_BASE + 2 * k, B_BASE + 2 * k + 1, SCREW_R))
			]
		}
	];
}

export const POLE_SCREW: Model = {
	id: 'pole-screw',
	name: 'Pole · lead screw',
	blurb: 'One telescope: printed lead screw up the middle, nut in the inner stage',
	tags: ['curtain'],
	zoom: 2.6,
	pivot: 90,
	knobs: [EXTEND],
	build: leadScrew,
	stats: [
		{ label: 'Stroke', value: `${SHORT_TRAVEL} mm`, sub: `one telescope, ${LEN} mm stages` },
		{ label: 'Screw', value: `Ø${SCREW_R * 2}`, sub: 'printed standing, 4 starts × 2 mm pitch' },
		{ label: 'Speed', value: '~13 mm/s', sub: 'N20 at 100 rpm; its gearbox holds the load' }
	]
};

// ── C · motor rides inside ────────────────────────────────────────────────────
// The rack is moulded inside the outer stage; an N20 rides in the inner
// stage's foot, its pinion out through a slot to mesh. Nothing shows from
// outside, but the motor's cable rides along, and the stages are assembled
// (motor in from the inner's foot, inner in from the outer's foot), not
// printed in place.
const C_RI = 12; // an N20 and its pinion across the bore
const C_Z = 14;

function motorInside(view: ModelView, knobs: Knob[]): Part[] {
	const { exploded } = view;
	const roI = C_RI + WALL;
	const riO = roI + RACK_BAND + SLIP;
	const roO = riO + WALL;
	const { base, outer, inner } = layout(exploded, extension(view, knobs), FOOT, 2 * roO + 30);
	const rp = (M * C_Z) / 2;
	const ph = inner.h + BAND_H / 2;
	const pe = inner.e + riO - TOOTH + M - rp;
	const o = stage(outer.e, riO, outer.h, LEN, { collar: false, lip: true }, RACK_BAND, ring);
	const i = stage(inner.e, C_RI, inner.h, LEN, { collar: true, lip: false }, RACK_BAND, ring);
	const slot: Box3 = [inner.e + C_RI - 1, inner.e + roI + RACK_BAND + 1, -RACK_W - 1, RACK_W + 1, inner.h - 1, inner.h + BAND_H + 1];
	return [
		foot(base, roO + 2),
		{
			id: 'outer',
			label: 'Outer stage · rack inside',
			kind: 'shell',
			shell: true,
			printed: true,
			size: `Ø${(2 * roO).toFixed(1)} × ${LEN}, rack inside one flat`,
			solids: [...o.wall, ...o.lip, ...rack(outer.e + riO + 0.01, -1, outer.h + 2, outer.h + LEN - BAND_H)]
		},
		{
			id: 'inner',
			label: 'Inner stage',
			kind: 'cover',
			shell: true,
			printed: true,
			size: `Ø${(2 * roI).toFixed(1)} × ${LEN}, pinion slot through foot and collar`,
			solids: [...holed(i.wall, slot), ...holed(i.collar, slot)]
		},
		tipCap(inner.e, roI, inner.h + LEN),
		...(exploded
			? []
			: [
					{
						id: 'pinion',
						label: 'Pinion',
						kind: 'cover',
						printed: true,
						size: `${C_Z}T module ${M}`,
						solids: spur(pe, ph, -RACK_W, RACK_W, C_Z, 1.6)
					} satisfies Part,
					{
						id: 'motor',
						label: 'N20 gear motor',
						kind: 'part',
						size: 'rides in the inner foot, shaft across',
						solids: [box(inner.e - 1, inner.e + 9, -10, -3.5, ph - 6, ph + 6), box(inner.e - 1, inner.e + 9, -10, 2, ph + 6, ph + 36)]
					} satisfies Part
				])
	];
}

export const POLE_INSIDE: Model = {
	id: 'pole-inside',
	name: 'Pole · motor inside',
	blurb: 'One telescope: N20 rides in the inner stage, rack inside the outer',
	tags: ['curtain'],
	zoom: 2.6,
	pivot: 70,
	knobs: [EXTEND],
	build: motorInside,
	stats: [
		{ label: 'Stroke', value: `${SHORT_TRAVEL} mm`, sub: `one telescope, ${LEN} mm stages` },
		{ label: 'Gears', value: `module ${M}`, sub: `${C_Z}T pinion, rack inside the outer` },
		{ label: 'Assembly', value: 'not in place', sub: 'motor goes in before the inner stage does' }
	]
};

// ── Ring ──────────────────────────────────────────────────────────────────────
// No pole, no pod: a fat curtain ring that drives itself along the rod, and is
// the curtain's first ring (hook loop underneath). Everything but the motor
// and the boards is printed, and each half is one print. It rolls the way a
// ball mouse does: rows of little balls printed in place in sockets in the
// bore's liner, each socket's lip narrower than its ball, so the ball stands
// proud onto the rod and can't fall out. Rows run along the rod all round it,
// off the seam. With nothing sprung, the bore is printed to the rod: pick its
// size. Underneath, a printed wheel in an O-ring tyre drives, on a worm-gear
// N20 lying along the rod in the floor; the O-ring's squeeze is the grip. The
// Super Mini and the driver lie on top, over the rod; USB-C comes out the end
// face. The rod runs along e.
const RING = {
	rods: { '3/4"': 9.525, '1"': 12.7, '1-1/8"': 14.29 } as Record<string, number>,
	wheel: 4, // printed drive wheel, Ø8
	ball: 2, // printed, Ø4
	pitch: 5, // ball to ball along a row
	rows: [30, 90, 150, 210, 330], // round the rod, off the seam; the drive has 270
	gap: 0.3, // print-in-place clearance, ball to socket
	clear: 0.6, // rod to liner: a ball sunk to stay caught still reaches the rod
	liner: 5, // deep enough to hold a ball
	R: 35, // outside
	wall: 1.6,
	half: 24, // half its length: the Super Mini and the driver lie end to end on the tray
	H: 60 // the rod's height on the stage
};

/** A solid drawn in the (n, h) plane, extruded along `e`: turned, never mirrored. */
function alongE(foot: [number, number][], e0: number, e1: number): Solid {
	const s = prism(foot, e0, e1);
	return { faces: s.faces, verts: s.verts.map((v) => ({ e: v.h, n: v.e, h: v.n })) };
}

/** `ring`, lying along e, centred on (n, h). */
const ringE = (n: number, h: number, ro: number, ri: number, e0: number, e1: number): Solid[] =>
	ring(0, 0, ro, ri, e0, e1).map((s) => ({ faces: s.faces, verts: s.verts.map((v) => ({ e: v.h, n: v.e + n, h: v.n + h })) }));

/** A ball: a globe of `seg` meridians and `bands` bands, each face wound to
 *  look out, so it stays one convex solid. */
function sphere(e: number, n: number, h: number, r: number, seg = 10, bands = 6): Solid {
	const verts = [{ e, n, h: h - r }];
	for (let i = 1; i < bands; i++) {
		const lat = -Math.PI / 2 + (Math.PI * i) / bands;
		for (let j = 0; j < seg; j++) {
			const lon = (2 * Math.PI * j) / seg;
			verts.push({ e: e + r * Math.cos(lat) * Math.cos(lon), n: n + r * Math.cos(lat) * Math.sin(lon), h: h + r * Math.sin(lat) });
		}
	}
	verts.push({ e, n, h: h + r });
	const p = (i: number, j: number) => 1 + (i - 1) * seg + (j % seg);
	const top = verts.length - 1;
	const faces: number[][] = [];
	for (let j = 0; j < seg; j++) {
		faces.push([0, p(1, j + 1), p(1, j)]);
		for (let i = 1; i < bands - 1; i++) faces.push([p(i, j), p(i, j + 1), p(i + 1, j + 1), p(i + 1, j)]);
		faces.push([top, p(bands - 1, j), p(bands - 1, j + 1)]);
	}
	return { verts, faces };
}

/** `s` turned by `a` about the e axis, then moved to (n, h): turned, never mirrored. */
const turnE = (s: Solid, a: number, n: number, h: number): Solid => ({
	faces: s.faces,
	verts: s.verts.map((v) => ({
		e: v.e,
		n: n + v.n * Math.cos(a) - v.h * Math.sin(a),
		h: h + v.n * Math.sin(a) + v.h * Math.cos(a)
	}))
});

function curtainRing({ exploded, print = false }: ModelView, knobs: Knob[]): Part[] {
	const { rods, wheel, ball, pitch, rows, gap, clear, liner, R, wall, half } = RING;
	// Printed, the halves are built with the rod's centre line on the bed.
	const H = print ? 0 : RING.H;
	const size = String(knobs.find((k) => 'prop' in k && k.prop === 'rod')?.value ?? '1"');
	const rr = rods[size] ?? rods['1"'];
	const bore = rr + clear;
	const lift = exploded && !print ? 25 : 0;
	const deg = Math.PI / 180;
	const d = rr + wheel; // rod centre to the drive wheel's
	// Anything built on top of the rod (its centre at 0) and turned round it to
	// angle `a`: 90° is on top, 0° the room side.
	const at = (s: Solid, a: number, h: number) => turnE(s, (a - 90) * deg, 0, h);
	// The balls, built on top against the rod, then turned to their rows. Each
	// socket is the ball grown by its clearance. The ball's centre sits `sink`
	// inside the liner's face, deep enough that the socket's mouth is narrower
	// than the ball, which still stands proud to bear on the rod.
	const sink = Math.sqrt((ball + gap) ** 2 - ball ** 2) + 0.15;
	const along = Array.from({ length: Math.floor((2 * half - 6) / pitch) + 1 }, (_, i) => -half + 3 + i * pitch);
	const balls = rows.flatMap((a) =>
		along.map((e) => {
			const h = H + (a < 180 ? lift : 0);
			const b = sphere(e, 0, bore + sink, ball);
			return { up: a < 180, ball: at(b, a, h), socket: [grow(at(b, a, h), gap)] };
		})
	);
	const drive = at(alongN(disc(0, d, wheel), -2, 2), 270, H);
	// Shell: outer wall, bore liner and end faces, each halved at the rod's
	// centre line; wedges 0–7 are the top half.
	// The outside is a diamond grille, the BREACH figures' eye skin a size up: a
	// window in each face of the outer wall, a rib left between faces, and two
	// sets of 45° bars laid back in it. Every edge leans 45° whichever way the
	// face stands on the bed, so nothing bridges, and bars laid in slice clean
	// where hundreds of carved holes leave slivers. The two faces the hook
	// loop hangs between stay solid.
	const GRILLE = { hole: 2, bar: 0.6, rib: 1.2 }; // the eyes: 1.2 and 0.6
	const face = Math.PI / 16; // half a face's angle
	const [fIn, fOut] = [(R - wall) * Math.cos(face), R * Math.cos(face)];
	const winN = (R - wall) * Math.sin(face) - GRILLE.rib;
	const win: Pt2[] = [
		[-half + GRILLE.rib, -winN],
		[half - GRILLE.rib, -winN],
		[half - GRILLE.rib, winN],
		[-half + GRILLE.rib, winN]
	];
	const step = (GRILLE.hole + GRILLE.bar) * Math.SQRT2;
	const bw = GRILLE.bar / Math.SQRT2;
	const bars = ([1, -1] as const).flatMap((s) => {
		const cs = win.map(([x, z]) => x + s * z);
		const [k0, k1] = [Math.floor((Math.min(...cs) - bw) / step), Math.ceil((Math.max(...cs) + bw) / step)];
		return Array.from({ length: k1 - k0 + 1 }, (_, i) => within(within(win, 1, s, (k0 + i) * step + bw), -1, -s, bw - (k0 + i) * step)).filter(
			(f) => f.length >= 3
		);
	});
	const outerFace = (s: Solid, k: number, h: number) => {
		if (k === 11 || k === 12) return [s];
		const a = (k + 0.5) * 22.5;
		return [
			...carveHull(s, grow(at(prism(win, fIn - 1, fOut + 1), a, h), 0)),
			...bars.map((f) => at(prism(f, fIn, fOut), a, h))
		];
	};
	// Two cores, upper and lower, part at the rod's centre line; two covers,
	// front and back, clip over both, the way a laptop's shell does. Each cover
	// is the grilled outer wall alone, its ends caught between the cores' end
	// faces. Split square to the cores' seam, each cover clips to both cores,
	// so fitting the covers is what locks the ring shut round the rod: tabs
	// inside a cover's top and bottom edges snap under short rails on the cores
	// by each end face, clear of the boards' headroom and the motor. Printed
	// apart, the cores lie on their seam faces and the covers stand on their
	// ends, so nothing needs support.
	const ri = R - wall;
	const sideN = (side: number, a: number, b: number): [number, number] => (side > 0 ? [a, b] : [-b, -a]);
	const span = (h: number, s: number, a: number, b: number): [number, number] => (s > 0 ? [h + a, h + b] : [h - b, h - a]);
	const CLIP = [-half + 2.5, half - 2.5]; // the clips' places along the rod
	const HOOK_E = 14; // the hook loop's post, clear of the motor
	const coverGap = exploded && !print ? 15 : 0;
	const moveN = (s: Solid, dn: number): Solid => ({ faces: s.faces, verts: s.verts.map((v) => ({ ...v, n: v.n + dn })) });
	// Faces 12–15 and 0–3 look to the room; 4–11 to the wall.
	const cover = (front: boolean) => {
		const f = front ? 1 : -1;
		const faces = ringE(0, H, R, ri, -half, half).flatMap((w, k) => ((k >= 12 || k < 4) === front ? outerFace(w, k, H) : []));
		const tabs = [1, -1].flatMap((s) =>
			CLIP.flatMap((e) => [
				box(e - 1.5, e + 1.5, ...sideN(f, 3.3, 4.5), ...span(H, s, ri - 3.6, ri)),
				box(e - 1.5, e + 1.5, ...sideN(f, 2.4, 3.3), ...span(H, s, ri - 3.6, ri - 3.1))
			])
		);
		// Where the two meet underneath, a notch for the hook loop's post.
		const notch: Box3 = [HOOK_E - 3.5, HOOK_E + 3.5, -2, 2, H - R - 1, H - ri + 1];
		return holed([...faces, ...tabs], notch).map((s) => moveN(s, f * coverGap));
	};
	// The core: the ball liner, the end faces, the rails the covers clip
	// under, and on top a tray the boards sit on.
	const core = (top: boolean, h: number) => {
		const s = top ? 1 : -1;
		const half8 = (ss: Solid[]) => (top ? ss.slice(0, 8) : ss.slice(8));
		return [
			...half8(ringE(0, h, bore + liner, bore, -half, half)),
			...half8(ringE(0, h, R, bore, -half - wall, -half)),
			...half8(ringE(0, h, R, bore, half, half + wall)),
			...CLIP.map((e) => box(Math.max(-half, e - 2.5), Math.min(half, e + 2.5), -3, 3, ...span(h, s, ri - 3, ri - 1.8))),
			...(top ? [box(-half, half, -13, 13, h + TRAY - 1.4, h + TRAY), ...holder(h + TRAY)] : [])
		];
	};
	// The Super Mini drops into a pocket and a frame clips over it. The pocket
	// is the BREACH cartridge sled's, which fits the real board: the board flat
	// on the floor between rails a fit off each side and 0.8 proud of it, its
	// USB-C against the end face in its window, and 3.3 of slack at the far
	// stop, since trays cut to the nominal 22.5 came up short. Nothing has to
	// grip the board's length, so the slack does no harm. The frame, printed
	// apart, bears on the board's two long edges and hooks under a ridge down
	// the outside of each rail; its middle is open, every pad free for leads,
	// and the cover is ~9 mm above. The driver sits beyond the stop.
	const TRAY = 22; // the tray's top, above the rod's centre
	const MINI = { w: 18, l: 22.5, t: 1, usb: { w: 9, l: 7.4, t: 3.2 }, fit: 0.3, slack: 3.3 };
	const pcb0 = -half + 1; // the board's USB end; its USB-C stands a millimetre past it, at the end face
	const stop = pcb0 + MINI.l + MINI.slack;
	const DRV: [number, number] = [stop + 2.6, stop + 18.6];
	const rail = [MINI.w / 2 + MINI.fit, MINI.w / 2 + MINI.fit + 1.2] as const; // inner, outer
	const holder = (t: number) => [
		...[-1, 1].flatMap((side) => [
			box(pcb0, stop, ...sideN(side, ...rail), t, t + MINI.t + 0.8),
			// The ridge the frame's hooks catch under.
			box(pcb0 + 3, stop - 3, ...sideN(side, rail[1], rail[1] + 0.6), t + 1.2, t + MINI.t + 0.8),
			box(...DRV, ...sideN(side, 6.5, 8.5), t, t + 1)
		]),
		box(stop, stop + 1.6, -rail[1], rail[1], t, t + MINI.t + 0.8)
	];
	// The frame, as clipped on over a board on a tray topped at `t`. It bears
	// only where nothing is soldered: across the USB-C shell at one end and on
	// the board's last 2 mm between the pad rows at the other. Its sides stand
	// on the rails, outside the board's edge pads.
	const clipFrame = (t: number) => {
		const top1 = t + MINI.t + MINI.usb.t + 1.25;
		const top0 = top1 - 1.2; // just on the USB-C shell
		const tip: [number, number] = [pcb0 + MINI.l - 2, pcb0 + MINI.l - 0.2];
		return [
			...[-1, 1].flatMap((side) => [
				box(pcb0 - 0.5, stop - 1, ...sideN(side, ...rail), t + MINI.t + 0.8, top1),
				...[pcb0 + 6, stop - 6].flatMap((e) => [
					box(e - 2, e + 2, ...sideN(side, rail[1] + 0.7, rail[1] + 1.9), t + 0.4, top1),
					box(e - 2, e + 2, ...sideN(side, rail[1] + 0.1, rail[1] + 0.7), t + 0.4, t + 1.1),
					box(e - 2, e + 2, ...sideN(side, rail[1], rail[1] + 0.7), top0, top1)
				])
			]),
			box(pcb0 - 0.5, pcb0 + 6, -rail[1], rail[1], top0, top1),
			box(...tip, -rail[1], rail[1], top0, top1),
			box(...tip, -6, 6, t + MINI.t + 0.05, top0)
		];
	};
	// The worm gearbox sits beside the drive wheel; the motor lies along the
	// floor.
	const gearbox: Box3 = [-7, 7, 3, 13, H - d - 6, H - d + 3];
	const hollow = (ss: Solid[], holes: Plane[][]) => holes.reduce((acc, p) => acc.flatMap((s) => carveHull(s, p)), ss);
	// The boards lie on top, over the rod; the Super Mini's USB-C goes out
	// through the end face.
	// The cartridge's USB-C window: 13 wide, 2 clear below and above the shell.
	const usb: Box3 = [-half - wall - 1, -half + 0.01, -6.5, 6.5, H + lift + TRAY + MINI.t - 2, H + lift + TRAY + MINI.t + MINI.usb.t + 2];
	const up = balls.filter((b) => b.up);
	const down = balls.filter((b) => !b.up);
	const upperCore = holed(
		hollow(
			core(true, H + lift),
			up.flatMap((b) => b.socket)
		),
		usb
	);
	const lowerCore = holed(
		hollow(core(false, H), [
			...down.flatMap((b) => b.socket),
			grow(at(box(-wheel - 1, wheel + 1, -3, 3, rr - 1, d + wheel + 1), 270, H), 0)
		]),
		[gearbox[0] - 0.5, gearbox[1] + 0.5, gearbox[2] - 0.5, gearbox[3] + 0.5, gearbox[4] - 0.5, gearbox[5] + 1]
	);
	// One print per core: the core in its own colour, the balls printed in
	// place in it.
	const withBalls = (coreSolids: Solid[], set: typeof balls) => ({
		solids: [...coreSolids, ...set.map((b) => b.ball)],
		colors: [...Array(coreSolids.length).fill('var(--palette-slate-l)'), ...Array(set.length).fill('var(--palette-blue)')]
	});
	// The loop the curtain's first hook goes through, on a post down from the
	// lower core's liner, out between the covers.
	const hook = [
		box(HOOK_E - 3, HOOK_E + 3, -1.5, 1.5, H - R - 0.5, H - bore - liner + 0.5),
		...cut([HOOK_E - 3, HOOK_E + 3, -6, 6, H - R - 10, H - R + 0.5], [[HOOK_E - 4, HOOK_E + 4, -2.5, 2.5, H - R - 7, H - R - 2]])
	];
	const parts: Part[] = [
		{
			id: 'rod',
			label: 'Curtain rod',
			kind: 'metal',
			size: `${size}, Ø${(2 * rr).toFixed(1)}`,
			solids: [alongE(disc(0, H, rr), -120, 120)]
		},
		{
			id: 'upper-core',
			label: 'Upper core',
			kind: 'shell',
			shell: true,
			printed: true,
			size: `${up.length} balls printed in place, board tray, clip rails, USB-C in its end face`,
			...withBalls(upperCore, up)
		},
		{
			id: 'lower-core',
			label: 'Lower core',
			kind: 'shell',
			shell: true,
			printed: true,
			size: `${down.length} balls printed in place, motor bay, clip rails, hook loop`,
			...withBalls([...lowerCore, ...hook], down)
		},
		{
			id: 'front-cover',
			label: 'Front cover',
			kind: 'cover',
			shell: true,
			printed: true,
			size: `Ø${2 * R} × ${2 * half} grille, the room side; clips to both cores`,
			solids: cover(true)
		},
		{
			id: 'back-cover',
			label: 'Back cover',
			kind: 'cover',
			shell: true,
			printed: true,
			size: `Ø${2 * R} × ${2 * half} grille, the wall side; clips to both cores`,
			solids: cover(false)
		},
		{
			id: 'drive',
			label: 'Drive wheel',
			kind: 'cover',
			printed: true,
			size: `Ø${2 * wheel}, printed, O-ring tyre, D-bore on the motor shaft`,
			solids: [drive]
		},
		{
			id: 'motor',
			label: 'Worm N20',
			kind: 'part',
			size: 'lies along the rod, its shaft out sideways to the drive wheel',
			solids: [box(...gearbox), box(-18, 7, -5, 5, H - d - 14, H - d - 6)],
			colors: ['var(--fg-muted)', 'var(--palette-blue)']
		},
		{
			id: 'esp-frame',
			label: 'ESP clip frame',
			kind: 'cover',
			printed: true,
			size: 'bears on the USB-C shell and the board’s far end, hooks under the rails; pads left free',
			solids: clipFrame(H + lift + TRAY + (exploded && !print ? 12 : 0))
		},
		{
			id: 'mini',
			label: 'ESP32-C6 Super Mini',
			kind: 'board',
			size: '22.5 × 18, runs armornet; drops into the tray, USB-C out the end face',
			solids: [
				box(pcb0, pcb0 + MINI.l, -MINI.w / 2, MINI.w / 2, H + lift + TRAY, H + lift + TRAY + MINI.t),
				box(
					pcb0 - 1,
					pcb0 - 1 + MINI.usb.l,
					-MINI.usb.w / 2,
					MINI.usb.w / 2,
					H + lift + TRAY + MINI.t,
					H + lift + TRAY + MINI.t + MINI.usb.t
				)
			],
			colors: ['var(--palette-emerald)', 'var(--fg-muted)']
		},
		{
			id: 'driver',
			label: 'Motor driver',
			kind: 'board',
			size: '16 × 18, on the tray beside the Super Mini',
			solids: [
				box(...DRV, -9, 9, H + lift + TRAY + 1, H + lift + TRAY + 2.6),
				box(DRV[0] + 3.5, DRV[1] - 3.5, -4.5, 4.5, H + lift + TRAY + 2.6, H + lift + TRAY + 8)
			],
			colors: ['var(--palette-purple)', 'var(--fg-muted)']
		},
		{
			id: 'rings',
			label: 'Curtain rings (for scale)',
			kind: 'metal',
			size: 'the rest of the curtain',
			solids: [32, 46, 60].flatMap((e) => ringE(0, H, rr + 6, rr + 3, e, e + 3))
		}
	];
	if (!print) return parts;
	// On the bed: the cores on their seam faces, the lower one turned over
	// beside the upper; each cover stood on its end alongside its core, a turn
	// about n; the drive wheel flat in front.
	const byId = (id: string) => parts.find((p) => p.id === id)!;
	const onEnd = (p: Part, e: number, n: number): Part => ({
		...p,
		solids: p.solids.map((s) => ({ faces: s.faces, verts: s.verts.map((v) => ({ e: v.h + e, n: v.n + n, h: half - v.e })) }))
	});
	return [
		byId('upper-core'),
		{ ...byId('lower-core'), solids: byId('lower-core').solids.map((s) => turnE(s, Math.PI, 2 * R + 10, 0)) },
		onEnd(byId('front-cover'), half + wall + 10 + R, 0),
		onEnd(byId('back-cover'), half + wall + 10 + R, 2 * R + 10 + R),
		{ ...byId('drive'), solids: [prism(disc(0, -R - 12, wheel), 0, 4)] },
		// The frame upside down, its flat top on the bed and its hooks up.
		{ ...byId('esp-frame'), solids: clipFrame(0).map((s) => turnE(s, Math.PI, -R - 30, MINI.t + MINI.usb.t + 1.25)) }
	];
}

export const CURTAIN_RING: Model = {
	id: 'curtain-ring',
	name: 'Curtain ring',
	blurb: 'A fat curtain ring that drives itself along the rod and pulls the curtain',
	tags: ['curtain'],
	zoom: 4,
	pivot: RING.H,
	grid: 80,
	knobs: [
		{
			kind: 'choice',
			group: 'floor',
			prop: 'rod',
			label: 'Rod',
			hint: 'the bore is printed to it',
			value: '1"',
			options: Object.keys(RING.rods)
		}
	],
	build: curtainRing,
	stats: [
		{ label: 'Rods', value: Object.keys(RING.rods).join(' · '), sub: 'print the one you have' },
		{ label: 'Ring', value: `Ø${2 * RING.R} × ${2 * (RING.half + RING.wall)}`, sub: 'mm, round × long' },
		{
			label: 'Balls',
			value: String(RING.rows.length * (Math.floor((2 * RING.half - 6) / RING.pitch) + 1)),
			sub: `Ø${2 * RING.ball}, printed in place in ${RING.rows.length} rows; 1 drive wheel underneath`
		},
		{ label: 'Power', value: 'USB-C', sub: 'a cable from its end face for now' },
		{ label: 'Prints', value: '5', sub: 'two cores, balls in place; two clip-on grille covers, on end; the drive wheel' },
		{ label: 'Bought', value: '4', sub: 'worm N20, ESP32-C6, motor driver, one O-ring' }
	]
};

