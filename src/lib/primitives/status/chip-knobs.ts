// ── chip-knobs — what the Chip Studio exposes ───────────────────────────────
//
// Declared in the same `Knob` shape the backdrop, character and icon tools use,
// so `BackdropControls` draws this panel too and a renamed prop cannot leave a
// dead control behind. The rule those lists carry holds here unchanged: every
// value declared below is a prop `Chip.svelte` actually reads.
//
// The colour knob is a `choice`, not a `color`. A chip does not take a hex — it
// takes a SEMANTIC name that resolves to a token pair (ink + edge) which the
// theme owns, and a swatch here would invite picking a hue the theme cannot
// honour. Same reasoning the icon studio used for `Icon`'s ink: expose the
// control the component really has, not the one that looks richer.

import type { Knob } from '../../backdrop/backdrop-tokens.js';
import { CHIP_CUTS, CHIP_EDGES, CHIP_LEADS, type ChipColor } from './Chip.svelte';

export const CHIP_COLORS: readonly ChipColor[] = [
	'default',
	'accent',
	'success',
	'warn',
	'error',
	'cyan',
	'blue',
	'critical',
	'get',
	'post',
	'delete',
	'patch'
];

/**
 * What each silhouette MEANS — the footer text in the studio, and the reason
 * this vocabulary is closed.
 *
 * A chip shape that was chosen because it looked good is a shape nobody can
 * apply consistently a month later. Every cut here is 45° off the same box; the
 * only variable is which corners, and each answer has one job.
 */
export const CUT_NOTES: Record<string, string> = {
	square: 'No cut. Inert data — a value, not a state. The safe default in a table.',
	shield: 'Bottom two corners, the crest’s foot. Identity, ownership, provenance.',
	node: 'All four — the mesh node’s octagon. This chip names a thing on the graph.',
	line: 'Top-left and bottom-right. Rotationally symmetric, so it reads as a segment with direction: flow, transition, method.',
	tag: 'A point on the leading edge. The chip hangs off its row rather than floating in it — labels bound to a parent.',
	pill: 'The generic capsule. Kept because it is still in the wild; it is the one option that means nothing.'
};

export interface ChipSettings {
	look: 'ghost' | 'filled';
	color: ChipColor;
	cut: string;
	cutSize: number;
	edge: string;
	lead: string;
	pulse: boolean;
	size: 'sm' | 'md';
}

const BASE: ChipSettings = {
	look: 'ghost',
	color: 'accent',
	cut: 'square',
	cutSize: 6,
	edge: 'hairline',
	lead: 'none',
	pulse: false,
	size: 'sm'
};

export function chipKnobs(): Knob[] {
	return [
		{
			kind: 'choice',
			group: 'colour',
			prop: 'color',
			label: 'Colour',
			hint: 'A semantic name, not a hue — it resolves to an ink/edge pair the theme owns, so a chip re-tints with the theme instead of against it.',
			value: BASE.color,
			options: CHIP_COLORS,
			componentDefault: 'default'
		},
		{
			kind: 'choice',
			group: 'colour',
			prop: 'look',
			label: 'Look',
			hint: 'Whether the tint is painted behind the label. `ghost` is the annotation; `filled` is a category you are meant to scan for.',
			value: BASE.look,
			options: ['ghost', 'filled']
		},
		{
			kind: 'choice',
			group: 'shape',
			prop: 'cut',
			label: 'Silhouette',
			hint: 'Which corners are chamfered. This is the chip’s meaning — see the note under the stage.',
			value: BASE.cut,
			options: CHIP_CUTS
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'cutSize',
			label: 'Cut',
			hint: 'Chamfer depth. Under 3px it reads as a rendering artefact rather than a decision; past 8px on a short chip the cuts meet and eat the label.',
			value: BASE.cutSize,
			min: 2,
			max: 12,
			step: 1,
			unit: 'px'
		},
		{
			kind: 'choice',
			group: 'shape',
			prop: 'edge',
			label: 'Outline',
			hint: 'A closed hairline, HUD corner ticks, or nothing. `bracket` is for dense tables, where one closed box per row stops the rows reading as rows — pair it with `square`, since a tick on a chamfer is a stray dash.',
			value: BASE.edge,
			options: CHIP_EDGES
		},
		{
			kind: 'choice',
			group: 'shape',
			prop: 'size',
			label: 'Size',
			hint: 'Two cuts only. `sm` is the annotation weight with wide tracking; `md` is the categorical tag. A third size is a chip that has become a badge.',
			value: BASE.size,
			options: ['sm', 'md']
		},
		{
			kind: 'choice',
			group: 'light',
			prop: 'lead',
			label: 'Marker',
			hint: '`bar` and `wedge` are painted inside the clip, so they take the silhouette’s chamfer with them; `dot` is the legacy live-signal and the only one that survives at any shape.',
			value: BASE.lead,
			options: CHIP_LEADS
		},
		{
			kind: 'toggle',
			group: 'motion',
			prop: 'pulse',
			label: 'Pulse',
			hint: 'Animates the dot. It also summons one when no marker is set, because every existing call site says `pulse` to mean "this is live".',
			value: BASE.pulse
		}
	];
}

/** The prop a knob writes. Every chip knob is one — nothing here is stage state. */
export function propOf(k: Knob): string {
	if (k.kind === 'color' || k.kind === 'range') return '';
	return k.prop;
}

/** The panel's current reading, over the defaults, as props. */
export function readChipKnobs(knobs: Knob[]): ChipSettings {
	const out = { ...BASE };
	for (const k of knobs) {
		const p = propOf(k);
		if (p) (out as Record<string, unknown>)[p] = k.value;
	}
	return out;
}

/**
 * The usage line, carrying only what has been moved off the COMPONENT's own
 * defaults — so it is a line you can paste, not a dump of every prop.
 *
 * `defaults` is the panel's opening state, which is not the same thing: the
 * studio opens on `accent` so the stage is not a grey rectangle, while the
 * component's default is `default`. A choice that declares `componentDefault`
 * is compared against that instead.
 */
export function chipSnippet(knobs: Knob[], defaults: Knob[], label: string): string {
	const parts: string[] = [];
	for (const k of knobs) {
		const p = propOf(k);
		if (!p) continue;
		const d = defaults.find((x) => propOf(x) === p);
		const omitAt =
			k.kind === 'choice' && k.componentDefault !== undefined ? k.componentDefault : d?.value;
		if (omitAt !== undefined && omitAt === k.value) continue;
		if (typeof k.value === 'boolean') parts.push(k.value ? p : `${p}={false}`);
		else if (typeof k.value === 'number') parts.push(`${p}={${k.value}}`);
		else parts.push(`${p}="${k.value}"`);
	}
	return `<Chip${parts.length ? ' ' + parts.join(' ') : ''}>${label}</Chip>`;
}
