// ── backdrop-tokens — every knob the horizon backdrop exposes ───────────────
//
// One declaration per custom property, so the control panel is generated from
// the same list the component reads. A knob that exists in only one of those
// two places is the bug this file prevents.
//
// Colours are kept as `rgba()` strings rather than hex, because ALPHA IS THE
// POINT down here: the whole backdrop is faint layers, and a control that can
// only speak opaque hex would flatten the one property that matters most. The
// existing SwatchBar marks translucent tokens with an `α` and warns that
// picking will drop transparency — honest, but not usable for this. So a
// backdrop colour control is a swatch for the hue PLUS a slider for the alpha,
// and the two recombine into `rgba()`.

/** Which toolbar popover a knob belongs to. */
export type KnobGroup = 'colour' | 'floor' | 'shape' | 'motion' | 'light';

export interface ColorKnob {
	kind: 'color';
	group: KnobGroup;
	token: string;
	label: string;
	hint: string;
	value: string;
}

export interface RangeKnob {
	kind: 'range';
	group: KnobGroup;
	token: string;
	label: string;
	hint: string;
	value: number;
	min: number;
	max: number;
	step: number;
	/** Appended to the value when written to CSS, e.g. `px`. */
	unit?: string;
}

/** Not a CSS variable — a component prop on HorizonBackdrop. */
export type PropName = 'count' | 'traffic' | 'band' | 'yaw' | 'pitch' | 'rungs' | 'belt' | 'period';

export interface CountKnob {
	kind: 'count';
	group: KnobGroup;
	prop: PropName;
	label: string;
	hint: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	unit?: string;
}

/**
 * A numeric prop on a STANDALONE FAMILY — Ash Drift's `scale`, Current Field's
 * `density`.
 *
 * Separate from `CountKnob` rather than folded into it because the two address
 * different components: `CountKnob.prop` is one of the Möbius backdrop's eight
 * named props and is typed to them, while a family prop is whatever that family
 * happens to expose. Widening `PropName` to `string` to share one kind would
 * have cost the Möbius side its only compile-time check, which is the check
 * that matters — that list is the one a refactor renames.
 */
export interface ParamKnob {
	kind: 'param';
	group: KnobGroup;
	/** The component prop's name, spread onto the family by `Backdrop`. */
	prop: string;
	label: string;
	hint: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	unit?: string;
}

/**
 * A boolean prop — `glow`, `tethers`, `innerWall`.
 *
 * Numbers and colours were enough while everything this panel drew was a
 * backdrop. A mark is mostly switches, and a studio that could not declare one
 * would have had to hand-write its own panel — the second control panel this
 * file exists to prevent.
 */
export interface ToggleKnob {
	kind: 'toggle';
	group: KnobGroup;
	prop: string;
	label: string;
	hint: string;
	value: boolean;
}

/** A prop with a fixed set of named values — `look`, `spokes`, `chords`. */
export interface ChoiceKnob {
	kind: 'choice';
	group: KnobGroup;
	prop: string;
	label: string;
	hint: string;
	value: string;
	options: readonly string[];
	/**
	 * The COMPONENT's own default, when the panel deliberately opens on something
	 * else. Without it a snippet omits any prop still sitting at the panel's
	 * opening value, so a studio that opens on a non-default silhouette emits a
	 * paste line that renders a different mark than the one on screen.
	 */
	componentDefault?: string;
}

export type Knob = ColorKnob | RangeKnob | CountKnob | ParamKnob | ToggleKnob | ChoiceKnob;

/**
 * A knob's identity, independent of its value.
 *
 * Every consumer needs this — the control panel keys its rows on it, `set`
 * finds the row to replace, `isChanged` finds the matching default — and three
 * hand-rolled copies of the same ternary is how a fourth kind gets missed.
 */
export function knobKey(k: Knob): string {
	if (k.kind === 'count') return `p:${k.prop}`;
	if (k.kind === 'param') return `q:${k.prop}`;
	if (k.kind === 'toggle') return `b:${k.prop}`;
	if (k.kind === 'choice') return `c:${k.prop}`;
	return `t:${k.token}`;
}

/**
 * The defaults here MUST match tokens.css. They are the panel's starting point,
 * not a second source of truth — a mismatch shows up immediately as a control
 * that appears pre-modified on first load.
 */
export function defaultKnobs(): Knob[] {
	return [
		// ── Colour ──────────────────────────────────────────────────────────
		{
			kind: 'color',
			group: 'colour',
			token: '--backdrop-strip',
			label: 'Möbius strip',
			hint: 'Multiplied twice more downstream — a depth fade, then layer opacity — so it starts higher than what you see.',
			value: 'rgba(150, 178, 170, 0.5)'
		},
		{
			kind: 'color',
			group: 'colour',
			token: '--backdrop-traveller',
			label: 'Traveller',
			hint: 'The one thing down here meant to be noticed, and the only glowing element.',
			value: 'rgba(94, 234, 212, 0.75)'
		},
		{
			kind: 'color',
			group: 'colour',
			token: '--backdrop-line',
			label: 'Floor ruling',
			hint: 'The static grid. Faint by design — it is texture, not a drawn grid.',
			value: 'rgba(126, 150, 142, 0.07)'
		},

		// ── Floor ───────────────────────────────────────────────────────────
		{
			kind: 'range',
			group: 'floor',
			token: '--backdrop-strength',
			label: 'Layer opacity',
			hint: 'The whole backdrop. Set to 0 to switch it off without touching markup.',
			value: 1,
			min: 0,
			max: 1,
			step: 0.05
		},
		{
			kind: 'range',
			group: 'floor',
			token: '--backdrop-cell',
			label: 'Cell size',
			hint: 'At 64px you count the squares; at 34px you do not.',
			value: 34,
			min: 12,
			max: 96,
			step: 2,
			unit: 'px'
		},

		// ── Shape — the actual Möbius parameters ────────────────────────────
		{
			kind: 'count',
			group: 'shape',
			prop: 'band',
			label: 'Band width',
			hint: 'Half-width of the strip. Past ~190 the band self-intersects on screen and stops reading.',
			value: 150,
			min: 40,
			max: 190,
			step: 5
		},
		{
			kind: 'count',
			group: 'shape',
			prop: 'pitch',
			label: 'Pitch',
			hint: 'Tilt toward the viewer. Near 0 the strip is edge-on and unreadable.',
			value: 59,
			min: 10,
			max: 85,
			step: 1,
			unit: '°'
		},
		{
			kind: 'count',
			group: 'shape',
			prop: 'yaw',
			label: 'Yaw',
			hint: 'Rotation about the vertical axis.',
			value: 0,
			min: -90,
			max: 90,
			step: 1,
			unit: '°'
		},
		{
			kind: 'count',
			group: 'shape',
			prop: 'rungs',
			label: 'Slats',
			hint: 'Cross-sections. These are what make the twist legible — and what the belt motion runs along.',
			value: 30,
			min: 6,
			max: 80,
			step: 1
		},
		{
			kind: 'count',
			group: 'shape',
			prop: 'count',
			label: 'Strips',
			hint: 'Two reads as composition, five as noise. Ignored on the studio stage.',
			value: 3,
			min: 0,
			max: 6
		},

		// ── Motion ──────────────────────────────────────────────────────────
		{
			kind: 'count',
			group: 'motion',
			prop: 'belt',
			label: 'Belt speed',
			hint: 'Seconds per dash cycle. LOWER IS FASTER — 1s is a conveyor, 8s is a drift.',
			value: 4.4,
			min: 0.4,
			max: 10,
			step: 0.2,
			unit: 's'
		},
		{
			kind: 'count',
			group: 'motion',
			prop: 'period',
			label: 'Traveller lap',
			hint: 'Seconds for a full two-lap traversal. A different clock from the belt: a traveller crosses the whole strip.',
			value: 39,
			min: 4,
			max: 90,
			step: 1,
			unit: 's'
		},
		{
			kind: 'count',
			group: 'motion',
			prop: 'traffic',
			label: 'Travellers',
			hint: 'Per strip.',
			value: 2,
			min: 0,
			max: 6
		}
	];
}

// ── rgba ⇄ (hex, alpha) ────────────────────────────────────────────────────
// `<input type="color">` speaks opaque hex only, so every colour knob is split
// on the way into the control and rejoined on the way out.

export function splitColor(value: string): { hex: string; alpha: number } {
	const m = value.trim().match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/i);
	if (m) {
		const h = (n: string) =>
			Math.max(0, Math.min(255, Math.round(Number(n))))
				.toString(16)
				.padStart(2, '0');
		return { hex: `#${h(m[1])}${h(m[2])}${h(m[3])}`, alpha: m[4] === undefined ? 1 : Number(m[4]) };
	}
	const hex3 = value.trim().match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
	if (hex3) return { hex: `#${hex3[1]}${hex3[1]}${hex3[2]}${hex3[2]}${hex3[3]}${hex3[3]}`, alpha: 1 };
	if (/^#[0-9a-f]{6}$/i.test(value.trim())) return { hex: value.trim(), alpha: 1 };
	return { hex: '#888888', alpha: 1 };
}

export function joinColor(hex: string, alpha: number): string {
	const m = hex.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	if (!m) return hex;
	const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
	// Trim the alpha so the emitted CSS is readable rather than `0.7500000001`.
	const a = Math.round(alpha * 100) / 100;
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** The knobs as a style attribute the backdrop's host can carry. */
export function toCss(knobs: Knob[]): string {
	return knobs
		.filter((k): k is ColorKnob | RangeKnob => k.kind === 'color' || k.kind === 'range')
		.map((k) => `${k.token}: ${k.kind === 'range' ? `${k.value}${k.unit ?? ''}` : k.value}`)
		.join('; ');
}

/** The knobs that are component props rather than CSS, ready to spread. */
export function toProps(knobs: Knob[]): Record<PropName, number> {
	const out = {} as Record<PropName, number>;
	for (const k of knobs) if (k.kind === 'count') out[k.prop] = k.value;
	return out;
}

/** The same, for a standalone family's own props. */
export function toParams(knobs: Knob[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const k of knobs) if (k.kind === 'param') out[k.prop] = k.value;
	return out;
}

/**
 * True when a knob has been moved off the value its defaults ship.
 *
 * `defaults` is a parameter because family knobs have their own baselines —
 * comparing an Ash Drift knob against the Möbius list would find no match and
 * silently report "unchanged" for everything.
 */
export function isChanged(k: Knob, defaults: Knob[] = defaultKnobs()): boolean {
	const d = defaults.find((x) => knobKey(x) === knobKey(k));
	return !!d && d.value !== k.value;
}
