// ── icon-knobs — what the Icon Studio exposes, per mark ─────────────────────
//
// Declared in the SAME `Knob` shape the backdrop and character tools use, so
// `BackdropControls` draws this panel too. The rule those lists carry holds
// here unchanged: a value declared for a mark must be a prop that mark's
// component actually reads. A knob for a prop the component does not have is a
// control that does nothing, and the four variant grids this studio replaced
// drifted for exactly that reason — the page listed `look` variants the
// component had renamed.
//
// TWO DEPARTURES from the backdrop's use of `ColorKnob`, both on purpose:
//
// · The token is a plain identity for the panel to key on, not a CSS custom
//   property. A mark is SVG paint passed in as a prop, so the studio reads the
//   value out rather than writing it to a style attribute — same call the
//   character knobs made.
// · `Icon` has no colour prop at all: it paints in `currentColor`, which is why
//   it drops into a button and inherits. Its ink knob is therefore stage state
//   — `propOf` returns nothing for it, so it never lands in the snippet as a
//   prop the component would reject.

import type { Knob } from '../backdrop/backdrop-tokens.js';
import { CREST_MESH_SHAPES, type CrestMeshShape } from './ArmornetCrestMesh.svelte';
import { CHROME_SHAPES, type ChromeShape } from './ArmornetCrestChrome.svelte';

export const INK_TOKEN = '--icon-ink';
export const COLOR_TOKEN = '--crest-color';
export const MESH_TOKEN = '--crest-mesh';

/** The accent as a literal. A swatch cannot show `var(--accent)`, and the
 *  snippet has to emit something a reader can paste. */
export const ACCENT = '#5eead4';

export type MarkId = 'icon' | 'crest' | 'hub' | 'mesh' | 'chrome';

export interface Mark {
	id: MarkId;
	/** The component's name — the snippet's tag and the export filename's stem. */
	name: string;
	/** Shown in the footer: what this cut is FOR, since they overlap by design. */
	note: string;
	knobs: () => Knob[];
}

const size = (value: number, max: number, hint: string): Knob => ({
	kind: 'param',
	group: 'shape',
	prop: 'size',
	label: 'Size',
	hint,
	value,
	min: 12,
	max,
	step: 1,
	unit: 'px'
});

const glow = (value = true): Knob => ({
	kind: 'toggle',
	group: 'light',
	prop: 'glow',
	label: 'Glow',
	hint: 'A blurred underlay of the whole mark — atmosphere, not structure. It is the first thing to drop when the mark goes on a light field.',
	value
});

const colour = (token: string, label: string, hint: string): Knob => ({
	kind: 'color',
	group: 'colour',
	token,
	label,
	hint,
	value: ACCENT
});

const MESH_HINT =
	'Two-tone placement only. It follows the mark colour until you move it, because the mark is monochrome by design and a second hue in it reads as a rendering fault before it reads as a choice.';

export const MARKS: Mark[] = [
	{
		id: 'icon',
		name: 'Icon',
		note: 'The UI set. One weight, 24 box, currentColor — it belongs in a button.',
		knobs: () => [
			colour(
				INK_TOKEN,
				'Ink',
				'Stage colour only. `Icon` paints in `currentColor` and has no colour prop, which is the whole reason it inherits correctly inside a button.'
			),
			// Opens far above any size an icon actually ships at: the stage is for
			// looking at the drawing, and the sizes it IS used at are the row of
			// real 12–32px cuts on the page behind this.
			size(240, 512, 'Below 16 the two-pixel details in the denser glyphs fuse.'),
			{
				kind: 'param',
				group: 'shape',
				prop: 'strokeWidth',
				label: 'Stroke',
				hint: 'Line weight. 1.5 is the set’s own; under 1 it thins out against a dark field, over 2 the counters in `search` and `key` start to close.',
				value: 1.5,
				min: 0.5,
				max: 3,
				step: 0.1
			}
		]
	},
	{
		id: 'crest',
		name: 'ArmornetCrest',
		note: 'The full brand mark — double wall, solid A, punched nodes.',
		knobs: () => [
			colour(COLOR_TOKEN, 'Colour', 'The whole mark. Monochrome by design.'),
			colour(MESH_TOKEN, 'Mesh', MESH_HINT),
			size(96, 320, 'The mark is drawn in its native 617 box and scaled, so it holds anywhere.'),
			{
				kind: 'toggle',
				group: 'shape',
				prop: 'mesh',
				label: 'Inner mesh',
				hint: 'Crossbar down to the centre dot, then out to the feet. Drop it below ~32px — it silts up the A’s counter.',
				value: true
			},
			glow()
		]
	},
	{
		id: 'hub',
		name: 'ArmornetCrestHub',
		note: 'Hub-and-spoke: a filled hub, spokes, ringed satellites on the A’s five points.',
		knobs: () => [
			colour(COLOR_TOKEN, 'Colour', 'The whole mark.'),
			size(96, 320, 'Tethers go below ~32px, glow below ~48px.'),
			{
				kind: 'choice',
				group: 'shape',
				prop: 'look',
				label: 'Look',
				hint: 'How the letter separates itself from the mesh. `plated` leans on opacity — prefer the other two for one-colour reproduction.',
				value: 'hollow',
				options: ['hollow', 'weight', 'plated']
			},
			{
				kind: 'choice',
				group: 'shape',
				prop: 'spokes',
				label: 'Spokes',
				hint: 'Which spokes leave the hub, on top of the bar it always sits on. `bar` keeps the A’s counter open.',
				value: 'full',
				options: ['full', 'stem', 'bar']
			},
			{
				kind: 'toggle',
				group: 'shape',
				prop: 'tethers',
				label: 'Tethers',
				hint: 'The struts binding the A to the shield wall — traced like a circuit, one jog each. Drop them below ~32px.',
				value: true
			},
			glow()
		]
	},
	{
		id: 'mesh',
		name: 'ArmornetCrestMesh',
		note: 'The console’s own mesh centre, cut into a shield.',
		knobs: () => [
			colour(COLOR_TOKEN, 'Colour', 'The whole mark.'),
			colour(MESH_TOKEN, 'Mesh', MESH_HINT),
			size(96, 320, 'Inner wall goes below ~32px.'),
			{
				kind: 'choice',
				group: 'shape',
				prop: 'shape',
				label: 'Shield',
				hint: 'Which outline the crestlink figure is cut into. The figure never moves — a tight shield scales the whole of it.',
				value: 'crest',
				options: CREST_MESH_SHAPES
			},
			{
				kind: 'choice',
				group: 'shape',
				prop: 'variant',
				label: 'Variant',
				hint: 'Filled inverts the mark — a solid shield with the figure punched through to whatever is behind, so the inverse needs no second asset.',
				value: 'outline',
				options: ['outline', 'filled']
			},
			{
				kind: 'toggle',
				group: 'shape',
				prop: 'innerWall',
				label: 'Inner wall',
				hint: 'The hairline inside the shield. Without it the outer wall reads as a sticker outline.',
				value: true
			},
			glow()
		]
	},
	{
		id: 'chrome',
		name: 'ArmornetCrestChrome',
		note: 'Presentation art — gradients and a cast shadow. Not a UI icon; it muddies below ~48px.',
		knobs: () => [
			{
				kind: 'choice',
				group: 'shape',
				prop: 'shape',
				label: 'Shield',
				hint: 'Which silhouette to forge. `traced` is the hand-traced shield carrying the A; every other option is a shield from ArmornetCrestMesh carrying the crestlink figure. The two move together — the A was traced to that one silhouette.',
				value: 'keyed',
				componentDefault: 'traced',
				options: CHROME_SHAPES
			},
			size(
				240,
				320,
				'Hero and splash sizes. It carries gradients, so it will not reproduce in one colour.'
			),
			{
				kind: 'param',
				group: 'shape',
				prop: 'breakout',
				label: 'Breakout',
				hint: 'How far the A grows PAST the shield. At 1 the apex crosses the crown and the mark reads as overlaid on the shield rather than contained by it.',
				value: 0,
				min: 0,
				max: 1,
				step: 0.02
			},
			{
				kind: 'toggle',
				group: 'shape',
				prop: 'tethers',
				label: 'Tethers',
				hint: 'Struts tying every joint out to the wall — the A stops floating in the field and becomes structure the shield carries.',
				value: false
			},
			glow(),
			{
				kind: 'param',
				group: 'light',
				prop: 'bloom',
				label: 'Bloom',
				hint: 'Bloom strength. Ignored while Glow is off.',
				value: 1,
				min: 0,
				max: 1,
				step: 0.02
			},
			{
				kind: 'toggle',
				group: 'light',
				prop: 'traces',
				label: 'Traces',
				hint: 'Circuitry etched into the glass. Drop it below ~64px — it turns to noise.',
				value: true
			},
			{
				kind: 'toggle',
				group: 'light',
				prop: 'rim',
				label: 'Rim',
				hint: 'The second border floating inside the frame.',
				value: true
			},
			{
				kind: 'toggle',
				group: 'light',
				prop: 'emboss',
				label: 'Emboss',
				hint: 'Cast shadow seating the A into the glass.',
				value: true
			}
		]
	}
];

/**
 * Every prop any mark can be given, resolved.
 *
 * One flat record rather than a union per mark: each mark reads only the fields
 * its component takes, and a typed bag keeps the studio's call sites checked —
 * spreading a `Record<string, unknown>` onto `<ArmornetCrestHub>` would have
 * put `look: string` where a three-value union is expected and lost exactly the
 * check that catches a renamed option.
 */
export interface MarkSettings {
	size: number;
	strokeWidth: number;
	ink: string;
	color: string;
	meshColor: string;
	mesh: boolean;
	glow: boolean;
	tethers: boolean;
	innerWall: boolean;
	traces: boolean;
	rim: boolean;
	emboss: boolean;
	bloom: number;
	breakout: number;
	look: 'hollow' | 'weight' | 'plated';
	spokes: 'full' | 'stem' | 'bar';
	/**
	 * Both shield-bearing marks write `shape`. Knobs are rebuilt per mark and
	 * `readKnobs` only overlays the active one's, so they never collide at
	 * runtime — the field just has to be typed as the wider of the two.
	 */
	shape: ChromeShape;
	variant: 'outline' | 'filled';
}

const BASE: MarkSettings = {
	size: 96,
	strokeWidth: 1.5,
	ink: ACCENT,
	color: ACCENT,
	meshColor: ACCENT,
	mesh: true,
	glow: true,
	tethers: true,
	innerWall: true,
	traces: true,
	rim: true,
	emboss: true,
	bloom: 1,
	breakout: 0,
	look: 'hollow',
	spokes: 'full',
	shape: 'crest',
	variant: 'outline'
};

/** The prop a knob writes, or `''` when it is stage state rather than a prop. */
export function propOf(k: Knob): string {
	if (k.kind === 'color') {
		if (k.token === COLOR_TOKEN) return 'color';
		if (k.token === MESH_TOKEN) return 'meshColor';
		return '';
	}
	return k.kind === 'range' ? '' : k.prop;
}

/** The panel's current reading, over the defaults, as props. */
export function readKnobs(knobs: Knob[]): MarkSettings {
	const out = { ...BASE };
	for (const k of knobs) {
		if (k.kind === 'color' && k.token === INK_TOKEN) out.ink = k.value;
		const p = propOf(k);
		if (p) (out as Record<string, unknown>)[p] = k.value;
	}
	return out;
}

/**
 * The usage line, carrying only what has been moved off the component's own
 * defaults — so it is a line you can paste, not a dump of every prop.
 */
export function snippet(mark: Mark, knobs: Knob[], defaults: Knob[]): string {
	const parts: string[] = [];
	for (const k of knobs) {
		const p = propOf(k);
		if (!p) continue;
		const d = defaults.find((x) => propOf(x) === p);
		// A choice may declare the component's own default; that, not the panel's
		// opening value, is what makes a prop safe to leave out of the line.
		const omitAt = k.kind === 'choice' && k.componentDefault !== undefined ? k.componentDefault : d?.value;
		if (omitAt !== undefined && omitAt === k.value) continue;
		if (typeof k.value === 'boolean') parts.push(k.value ? p : `${p}={false}`);
		else if (typeof k.value === 'number') parts.push(`${p}={${k.value}}`);
		else parts.push(`${p}="${k.value}"`);
	}
	return `<${mark.name}${parts.length ? ' ' + parts.join(' ') : ''} />`;
}

/** `armornet-crest-hub-96-look-weight.svg` — a deck full of exports that names
 *  itself, rather than crest-1, crest-2. */
export function filename(mark: Mark, knobs: Knob[], defaults: Knob[], ext: string): string {
	const stem = mark.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
	const bits: string[] = [];
	for (const k of knobs) {
		const p = propOf(k);
		if (!p || k.kind === 'color') continue;
		const d = defaults.find((x) => propOf(x) === p);
		if (p === 'size') {
			bits.push(String(k.value));
			continue;
		}
		if (d && d.value === k.value) continue;
		bits.push(typeof k.value === 'boolean' ? (k.value ? p : `no-${p}`) : `${p}-${k.value}`);
	}
	return `${stem}${bits.length ? '-' + bits.join('-') : ''}.${ext}`;
}
