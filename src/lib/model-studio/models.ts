// ── model-studio/models — what the studio can put on its stage ───────────────
// One entry per physical object. Adding a model is adding an entry here; the
// studio draws whatever `build` returns. `blank` is the starting point for a
// new one: an empty stage with the grid, to be filled in as it is worked out.

import { box } from '../mesh-studio/pieces/pieces.js';
import { cut, slab, tube, type Box3, type Model, type Part } from './model-geometry.js';
import { CARTRIDGE_FIT, FOUNDER_MAINTAINER, FOUNDERS, HEAD_COUPLER, PRINT_DROP } from './print-drop.js';
import { CURTAIN_RING, POLE_INSIDE, POLE_RACK, POLE_SCREW, TELESCOPIC_POLE } from './curtain-pole.js';

const BLANK: Model = {
	id: 'blank',
	name: 'New canvas',
	blurb: 'Empty stage — parts are added in models.ts',
	zoom: 4,
	pivot: 0,
	build: () => [],
	stats: []
};

// ── Garage door riser ─────────────────────────────────────────────────────────
// The case for firmware/garage_door: it mounts behind the existing doorbell-
// style wall button, whose own screws run through it into the wall. An
// ESP32-C6 Super Mini and a mini DC SSR ride inside, tapping the same two
// wires. h is out of the wall (0 = wall), n is up the wall, e is across.
//
// The footprint IS the button's, so the riser reads as a thicker button.
const W = 32;
const L = 70;
const WALL = 2;
const E = W / 2;
const N = L / 2;
const SCREW_N = 30; // standard button spacing, 60 mm
const SCREW_R = 1.9; // #6 clearance
const TUBE_R = 4;

// Super Mini: headers ship loose, so it lies flat with wires soldered to its
// pads. Turned across the riser with USB-C at the right wall: the tubes sit on
// the centre line at both ends, so a plug coming up the middle would hit one.
const PCB = { e0: E - WALL - 1 - 22.5, e1: E - WALL - 1, n0: -9, n1: 9, h: WALL, t: 1 };
const PCB_TOP = PCB.h + PCB.t;
const USB_TOP = PCB_TOP + 3.2;
// Measured with its leads: 30 × 25 × 2. The 30 runs up the wall because the
// interior is only 28 across; it lies across the board on the USB-C shell.
const SSR = { w: 25, l: 30, t: 2 };
const RELAY = { n0: -SSR.l / 2, h: USB_TOP };
const DEPTH = Math.ceil(RELAY.h + SSR.t + 1);
const IN = DEPTH - WALL;
const WALL_WIRES: Box3 = [5, 13, 16, 26, -1, WALL + 1];

const bore = (n: number, h0: number, h1: number): Box3 => [-SCREW_R, SCREW_R, n - SCREW_R, n + SCREW_R, h0 - 1, h1 + 1];

function garageRiser({ exploded }: { exploded: boolean }): Part[] {
	const lift = exploded ? 22 : 0;
	const face = DEPTH + lift;
	return [
		{
			id: 'back',
			label: 'Back plate',
			kind: 'shell',
			shell: true,
			size: `${W} × ${L} × ${WALL}, wall-wire hole`,
			side: { axis: 'h', sign: -1, layer: 1 },
			solids: cut([-E, E, -N, N, 0, WALL], [WALL_WIRES, bore(-SCREW_N, 0, WALL), bore(SCREW_N, 0, WALL)])
		},
		{
			id: 'tubes',
			label: 'Screw tubes',
			kind: 'shell',
			shell: true,
			size: `Ø${TUBE_R * 2}, Ø${SCREW_R * 2} bore, ${SCREW_N * 2} apart`,
			solids: [-SCREW_N, SCREW_N].flatMap((n) => tube(0, n, TUBE_R, SCREW_R, WALL, DEPTH))
		},
		{
			id: 'wall-bottom',
			label: 'Bottom wall',
			kind: 'shell',
			shell: true,
			size: `${W} × ${IN}`,
			side: { axis: 'n', sign: -1, layer: 1 },
			solids: slab(-E, E, -N, -N + WALL, WALL, DEPTH)
		},
		{
			id: 'wall-top',
			label: 'Top wall',
			kind: 'shell',
			shell: true,
			size: `${W} × ${IN}`,
			side: { axis: 'n', sign: 1, layer: 1 },
			solids: slab(-E, E, N - WALL, N, WALL, DEPTH)
		},
		{
			id: 'wall-left',
			label: 'Left wall',
			kind: 'shell',
			shell: true,
			size: `${L - 2 * WALL} × ${IN}`,
			side: { axis: 'e', sign: -1, layer: 1 },
			solids: slab(-E, -E + WALL, -N + WALL, N - WALL, WALL, DEPTH)
		},
		{
			id: 'wall-right',
			label: 'Right wall',
			kind: 'shell',
			shell: true,
			size: 'USB-C notch, 13 wide',
			side: { axis: 'e', sign: 1, layer: 1 },
			solids: cut([E - WALL, E, -N + WALL, N - WALL, WALL, DEPTH], [[E - WALL - 1, E + 1, -6.5, 6.5, WALL - 1, DEPTH + 1]])
		},
		{
			id: 'face',
			label: 'Face plate',
			kind: 'cover',
			shell: true,
			size: `${W} × ${L} × ${WALL}, 5 mm wire pass-through`,
			side: { axis: 'h', sign: 1, layer: 1 },
			// The doorbell's two wires come up the middle to its own terminals; it
			// covers the hole once mounted.
			solids: cut(
				[-E, E, -N, N, face, face + WALL],
				[[-2.5, 2.5, -2.5, 2.5, -100, 100], bore(-SCREW_N, face, face + WALL), bore(SCREW_N, face, face + WALL)]
			)
		},
		{
			id: 'pcb',
			label: 'ESP32-C6 Super Mini',
			kind: 'board',
			size: '22.5 × 18 × 1, flat',
			solids: slab(PCB.e0, PCB.e1, PCB.n0, PCB.n1, PCB.h, PCB_TOP)
		},
		{
			id: 'chip',
			label: 'C6FH4 + antenna',
			kind: 'chip',
			size: 'QFN 5 × 5, ceramic antenna',
			solids: [
				box(PCB.e1 - 13, PCB.e1 - 8, -2.5, 2.5, PCB_TOP, PCB_TOP + 0.9),
				box(PCB.e0 + 0.5, PCB.e0 + 3, -4, 4, PCB_TOP, PCB_TOP + 1.2)
			]
		},
		{
			id: 'usb',
			label: 'USB-C',
			kind: 'metal',
			size: '9 × 7.4 × 3.2',
			solids: [box(PCB.e1 - 6.4, PCB.e1 + 1, -4.5, 4.5, PCB_TOP, USB_TOP)]
		},
		{
			id: 'ssr',
			label: 'Mini DC SSR',
			kind: 'part',
			size: `${SSR.l} × ${SSR.w} × ${SSR.t}, with leads`,
			solids: slab(-SSR.w / 2, SSR.w / 2, RELAY.n0, RELAY.n0 + SSR.l, RELAY.h, RELAY.h + SSR.t)
		},
		{
			id: 'wire',
			label: 'GPIO 19 / GND leads',
			kind: 'wire',
			size: 'soldered to the pads',
			solids: [box(PCB.e0 + 4, PCB.e0 + 4.7, PCB.n1 - 1, PCB.n1 - 0.3, PCB_TOP, RELAY.h + SSR.t / 2)]
		}
	];
}

const GARAGE_RISER: Model = {
	id: 'garage-riser',
	name: 'Garage riser',
	blurb: 'Mounts behind the wall button; ESP32-C6 + SSR inside',
	zoom: 5.5,
	pivot: DEPTH / 2,
	build: garageRiser,
	stats: [
		{ label: 'Footprint', value: `${W} × ${L}`, sub: 'mm, same as the button' },
		{ label: 'Depth', value: `${DEPTH + WALL} mm`, sub: 'button stands this far proud' },
		{ label: 'Wall', value: `${WALL} mm`, sub: 'PETG, 0.4 nozzle' },
		{ label: 'Screws', value: `${SCREW_N * 2} mm`, sub: "button's own, through to the wall" }
	]
};

export const MODELS: Model[] = [BLANK, GARAGE_RISER, PRINT_DROP, FOUNDERS, FOUNDER_MAINTAINER, CARTRIDGE_FIT, HEAD_COUPLER, TELESCOPIC_POLE, POLE_RACK, POLE_SCREW, POLE_INSIDE, CURTAIN_RING];
