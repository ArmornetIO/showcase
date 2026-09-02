// ── character-knobs — what the Character Studio exposes ─────────────────────
//
// Declared in the SAME `Knob` shape the backdrop tools use, so
// `BackdropControls` draws this panel too and there is no second control panel
// to keep in step. The backdrop knob list's rule holds here unchanged: a value
// declared here must be a value something actually reads. Every entry below is
// read by `art()` on the next render.
//
// ONE DEPARTURE, on purpose. A `ColorKnob` names a CSS custom property, because
// a backdrop is painted by CSS. A character is not — it is SVG paths whose
// fills are computed per facet from the lit colour — so the token here is a
// plain identity for the panel to key on, and the studio reads the value out
// rather than writing it to a style attribute. Emitting these as CSS would be
// declaring variables nothing reads, which is the failure the rule exists to
// prevent, only inverted.

import { splitColor, type Knob } from '../backdrop/backdrop-tokens.js';
import { CLIP_DEFAULTS, type ClipOpts } from './poses.js';
import { DEFAULT_ART } from './render.js';

export const PLATE_TOKEN = '--character-plate';
export const SUIT_TOKEN = '--character-suit';

/** Radians on the wire, degrees in the panel — nobody turns a model in
 *  radians, and a slider labelled `0.62` is a slider nobody moves on purpose. */
const DEG = 180 / Math.PI;

export function characterKnobs(plate: string): Knob[] {
	return [
		{
			kind: 'color',
			group: 'colour',
			token: PLATE_TOKEN,
			label: 'Plate',
			hint: 'Boots, chest, pauldrons, hood — and the visor, which is this colour mixed toward white. The character’s identity: it is the only hue on the model.',
			value: plate
		},
		{
			kind: 'color',
			group: 'colour',
			token: SUIT_TOKEN,
			label: 'Suit',
			hint: 'The body, shared by all four characters. Keep it neutral: the moment the suit competes with the plate, four figures stop reading as one squad.',
			value: DEFAULT_ART.suit
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'yaw',
			label: 'Yaw',
			hint: 'Turn about the vertical. Straight on hides the visor’s own plane; past about 60° the face band starts to leave the silhouette.',
			value: Math.round(DEFAULT_ART.yaw * DEG),
			min: -180,
			max: 180,
			step: 1,
			unit: '°'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'pitch',
			label: 'Pitch',
			hint: 'Camera tilt. Positive looks down at the figure; negative looks up, which reads as heroic and loses the top of the head.',
			value: Math.round(DEFAULT_ART.pitch * DEG),
			min: -40,
			max: 60,
			step: 1,
			unit: '°'
		},
		{
			kind: 'param',
			group: 'motion',
			prop: 'speed',
			label: 'Speed',
			hint: 'Cycles per second. A walk under about 0.6 reads as wading; over about 2 it reads as a run the legs are not long enough for.',
			value: 1,
			min: 0.1,
			max: 3,
			step: 0.05,
			unit: '×'
		},
		{
			kind: 'param',
			group: 'motion',
			prop: 'stride',
			label: 'Stride',
			hint: 'Peak leg swing. The legs pivot at the hip and have no knee, so past about 35° the feet start to skate.',
			value: Math.round(CLIP_DEFAULTS.stride * DEG),
			min: 0,
			max: 45,
			step: 1,
			unit: '°'
		},
		{
			kind: 'param',
			group: 'motion',
			prop: 'swing',
			label: 'Arm swing',
			hint: 'Peak arm swing, opposed to the leg on the same side. Keep it under the stride — arms matching the legs is a march, not a walk.',
			value: Math.round(CLIP_DEFAULTS.swing * DEG),
			min: 0,
			max: 45,
			step: 1,
			unit: '°'
		},
		{
			kind: 'param',
			group: 'motion',
			prop: 'bob',
			label: 'Bob',
			hint: 'How far the body drops on each footfall — twice per cycle, which is what stops a walk looking like a skate.',
			value: Math.round(CLIP_DEFAULTS.bob * 1000),
			min: 0,
			max: 120,
			step: 1
		}
	];
}

/** Pull the four values back out in the units `art()` wants. Colours arrive as
 *  `rgba()` from the panel's swatch; the renderer speaks `#rrggbb`, and alpha
 *  on a lit facet would mean the ground showing through a solid. */
export function readKnobs(knobs: Knob[]) {
	const val = (test: (k: Knob) => boolean) => knobs.find(test);
	const color = (token: string, fallback: string) => {
		const k = val((x) => x.kind === 'color' && x.token === token);
		return k ? splitColor(String(k.value)).hex : fallback;
	};
	const num = (prop: string, fallback: number) => {
		const k = val((x) => x.kind === 'param' && x.prop === prop);
		return k ? Number(k.value) / DEG : fallback;
	};
	/** Raw, in whatever unit the knob is labelled in. */
	const raw = (prop: string, fallback: number) => {
		const k = val((x) => x.kind === 'param' && x.prop === prop);
		return k ? Number(k.value) : fallback;
	};
	const clip: ClipOpts = {
		stride: raw('stride', CLIP_DEFAULTS.stride * DEG) / DEG,
		swing: raw('swing', CLIP_DEFAULTS.swing * DEG) / DEG,
		// Declared in thousandths: a build unit is the whole figure's height, so
		// the useful range of a body drop is 0.00–0.12 and a slider stepping in
		// hundredths of that has four usable positions.
		bob: raw('bob', CLIP_DEFAULTS.bob * 1000) / 1000
	};
	return {
		plate: color(PLATE_TOKEN, '#F472B6'),
		suit: color(SUIT_TOKEN, DEFAULT_ART.suit),
		yaw: num('yaw', DEFAULT_ART.yaw),
		pitch: num('pitch', DEFAULT_ART.pitch),
		speed: raw('speed', 1),
		clip
	};
}

/** Write an angle back into the list, for drag-to-turn on the stage. The panel
 *  and the drag have to move the SAME value or one of them silently wins. */
export function setAngle(knobs: Knob[], prop: 'yaw' | 'pitch', radians: number): Knob[] {
	return knobs.map((k) => {
		if (k.kind !== 'param' || k.prop !== prop) return k;
		const deg = Math.max(k.min, Math.min(k.max, Math.round(radians * DEG)));
		return { ...k, value: deg };
	});
}
