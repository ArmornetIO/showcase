// ── family-knobs — what each standalone backdrop actually exposes ───────────
//
// The Möbius backdrop has had a generated control panel since it was built:
// `defaultKnobs()` declares every custom property it reads, and
// `BackdropControls` draws that list. The five standalone families never got
// one. They were written with real, tunable inputs — Ash Drift's grain scale,
// Long Scan's hatch angle, Current Field's particle count — and every one of
// them was unreachable: `Backdrop.svelte` typed the family map as
// `Component<Record<string, never>>`, so no caller could pass a prop even if it
// wanted to, and the custom properties each family read were declared NOWHERE —
// they existed only as `var()` fallbacks inside the component, so no theme
// could reach them either. The studio's answer was to render a family as a
// picture and hide the rails.
//
// This file is the missing half. One declaration per family, in the same shape
// the Möbius knobs use, so the SAME control panel draws both and a family is
// edited the way a composition is.
//
// THE RULE that keeps this honest: a value declared here must be a value the
// component actually reads, and every token named here is now a real token in
// `tokens.css`. A knob with no reader is a slider that does nothing, which is
// worse than no slider — and it is the exact failure the Möbius list's header
// warns about. The token names are PREFIXED PER FAMILY (`--ash-*`, `--scan-*`,
// `--strata-*`, `--isoline-*`, `--field-*`) because Ash Drift and Drift Strata
// both used to read `--backdrop-tint` at different alphas, which meant tuning
// one silently retuned the other the moment both were on screen.

import type { Knob } from './backdrop-tokens.js';
import type { FamilyId } from './backdrops.js';

/**
 * The ground is declared per family because every family paints it, but it only
 * has an effect on the BOTTOM layer of a stack: `Backdrop` forces the layers
 * above it transparent, or the top one would simply cover everything below.
 */
function ground(): Knob {
	return {
		kind: 'color',
		group: 'colour',
		token: '--backdrop-ground',
		label: 'Ground',
		hint: 'The plate everything is painted on. Only the bottom layer of a stack paints it — the ones above are forced transparent so they can show through.',
		value: 'rgba(6, 7, 11, 1)'
	};
}

/**
 * Every family's knobs, in panel order: colour first, then the parameters that
 * change the geometry, then the ones that change the motion.
 *
 * Values here MUST match each component's own defaults, for the reason the
 * Möbius list states: a mismatch shows up immediately as a control that reads
 * as pre-modified the moment the studio opens.
 */
export const FAMILY_KNOBS: Record<FamilyId, Knob[]> = {
	'ash-drift': [
		ground(),
		{
			kind: 'color',
			group: 'colour',
			token: '--ash-tint',
			label: 'Near pool',
			hint: 'The upper-left glow. Very low alpha by design — this is air, not a light.',
			value: 'rgba(94, 234, 212, 0.05)'
		},
		{
			kind: 'color',
			group: 'colour',
			token: '--ash-tint-2',
			label: 'Far pool',
			hint: 'The lower-right counterweight, so the plate is not flat.',
			value: 'rgba(126, 150, 142, 0.04)'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'scale',
			label: 'Grain scale',
			hint: 'Coarse tile size. The fine layer is always a quarter of it — the 4:1 ratio is what makes the two layers beat against each other.',
			value: 180,
			min: 60,
			max: 420,
			step: 10,
			unit: 'px'
		},
		{
			kind: 'range',
			group: 'shape',
			token: '--ash-grain',
			label: 'Grain strength',
			hint: 'Opacity of the coarse layer; the fine one runs at half this.',
			value: 0.5,
			min: 0,
			max: 1,
			step: 0.02
		},
		{
			kind: 'range',
			group: 'motion',
			token: '--ash-drift',
			label: 'Drift period',
			hint: 'Seconds for one pass. LOWER IS FASTER. The counter-drifting layer runs at 1.55× this, and the ratio is why the interference never repeats.',
			value: 90,
			min: 10,
			max: 300,
			step: 5,
			unit: 's'
		}
	],

	'long-scan': [
		ground(),
		{
			kind: 'color',
			group: 'colour',
			token: '--backdrop-line',
			label: 'Hatching',
			hint: 'The milled plate. Faint by design — it exists for the sweep to rake across.',
			value: 'rgba(126, 150, 142, 0.07)'
		},
		{
			kind: 'color',
			group: 'colour',
			token: '--scan-sweep',
			label: 'Raking light',
			hint: 'The one moving thing in this backdrop. Screen-blended, so alpha here is the whole effect.',
			value: 'rgba(94, 234, 212, 0.06)'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'angle',
			label: 'Hatch angle',
			hint: 'Direction of the milling. The sweep always crosses horizontally, so an angle near 0 makes the light travel ALONG the grooves and catch nothing.',
			value: 17,
			min: -90,
			max: 90,
			step: 1,
			unit: '°'
		},
		{
			kind: 'range',
			group: 'motion',
			token: '--scan-sweep-period',
			label: 'Sweep period',
			hint: 'Seconds for the light to cross. Long on purpose — at 40s you notice it once and then stop seeing it, which is the point.',
			value: 40,
			min: 5,
			max: 180,
			step: 1,
			unit: 's'
		}
	],

	'drift-strata': [
		ground(),
		{
			kind: 'color',
			group: 'colour',
			token: '--strata-tint',
			label: 'Leading blob',
			hint: 'The first field in each band. Screen-blended through the slab.',
			value: 'rgba(94, 234, 212, 0.16)'
		},
		{
			kind: 'color',
			group: 'colour',
			token: '--strata-tint-2',
			label: 'Trailing blob',
			hint: 'The second field. Keeping the two hues close reads as one atmosphere; far apart reads as two lights.',
			value: 'rgba(126, 150, 142, 0.13)'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'count',
			label: 'Bands',
			hint: 'Three reads as strata, six as noise. Each band costs one blurred layer.',
			value: 4,
			min: 1,
			max: 8,
			step: 1
		},
		{
			kind: 'range',
			group: 'shape',
			token: '--strata-grain',
			label: 'Tooth',
			hint: 'The unblurred grain over each slab. This is what stops a blur reading as a smear — at 0 it does.',
			value: 0.4,
			min: 0,
			max: 1,
			step: 0.02
		},
		{
			kind: 'param',
			group: 'motion',
			prop: 'speed',
			label: 'Drift rate',
			hint: 'Multiplies every band. The far/near spread is kept — the whole point is that the layers move at DIFFERENT speeds — so this scales the set rather than flattening it.',
			value: 1,
			min: 0.2,
			max: 4,
			step: 0.1,
			unit: '×'
		}
	],

	'isoline-terrain': [
		ground(),
		{
			kind: 'color',
			group: 'colour',
			token: '--isoline-peak',
			label: 'Peaks',
			hint: 'Contours above the 0.72 depth line. Retinting this moves the light source and nothing else.',
			value: 'rgba(94, 234, 212, 0.5)'
		},
		{
			kind: 'color',
			group: 'colour',
			token: '--isoline-line',
			label: 'Lowlands',
			hint: 'Everything below the accent threshold — the bulk of the survey.',
			value: 'rgba(126, 150, 142, 0.28)'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'levels',
			label: 'Iso-levels',
			hint: 'More is busier, not deeper. Each level is a full marching-squares pass, traced once at load.',
			value: 8,
			min: 2,
			max: 20,
			step: 1
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'seed',
			label: 'Landscape',
			hint: 'A different terrain of the same character. Deterministic — the same seed always traces the same survey.',
			value: 7,
			min: 1,
			max: 99,
			step: 1
		},
		{
			kind: 'range',
			group: 'motion',
			token: '--isoline-flow-period',
			label: 'Tick period',
			hint: 'Seconds for a tick to crawl one contour. Only six paths ever animate, capped deliberately — every animated path repaints its tile.',
			value: 26,
			min: 4,
			max: 120,
			step: 1,
			unit: 's'
		}
	],

	'current-field': [
		ground(),
		{
			kind: 'color',
			group: 'colour',
			token: '--field-ink',
			label: 'Ink',
			hint: 'The 88% of trails that are not accented. Read live from the host at mount.',
			value: 'rgba(126, 150, 142, 0.5)'
		},
		{
			kind: 'color',
			group: 'colour',
			token: '--field-accent',
			label: 'Accent ink',
			hint: 'The one-in-eight trail that carries the theme colour through the field.',
			value: 'rgba(94, 234, 212, 0.55)'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'density',
			label: 'Particles',
			hint: 'Past ~400 it muddies, and the component clamps there. This is the per-frame cost — the only backdrop where that sentence is literal.',
			value: 220,
			min: 20,
			max: 400,
			step: 10
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'turn',
			label: 'Turbulence',
			hint: 'THE chaos knob, in multiples of π. At 2 everything drifts together; higher folds the same smooth field through itself until neighbours run opposite ways. Raises disorder without ever putting a corner in a trail — reach for this before Flow rate.',
			value: 6,
			min: 2,
			max: 12,
			step: 0.5
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'swirl',
			label: 'Swirl scale',
			hint: 'Spatial frequency. LOWER IS BIGGER — a particle stays inside one swirl longer, which is what reads as a current. Past ~0.003 the cells are shorter than a trail and the ink goes to fuzz.',
			value: 0.0011,
			min: 0.0004,
			max: 0.003,
			step: 0.0001
		},
		{
			kind: 'param',
			group: 'motion',
			prop: 'churn',
			label: 'Field churn',
			hint: 'How fast the current itself rewrites — the third noise axis, not the particles. Zero freezes the field into a fixed pattern the ink just traces.',
			value: 0.00012,
			min: 0,
			max: 0.0006,
			step: 0.00002
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'decay',
			label: 'Trail decay',
			hint: 'How fast old ink fades. This IS the image: lower and trails smear forever, higher and they read as dashes rather than current.',
			value: 0.035,
			min: 0.005,
			max: 0.2,
			step: 0.005
		},
		{
			kind: 'param',
			group: 'motion',
			prop: 'speed',
			label: 'Flow rate',
			hint: 'Pixels per step. The flow field itself is unchanged — this is how fast a particle walks it.',
			value: 0.9,
			min: 0.1,
			max: 4,
			step: 0.1
		}
	],
	'shear-weave': [
		ground(),
		{
			kind: 'color',
			group: 'colour',
			token: '--shear-pool',
			label: 'Pool',
			hint: 'The diagonal wash of accent this family was built around. Alpha well under 0.1 — it is light in the panel, not a fill on it.',
			value: 'rgba(94, 234, 212, 0.055)'
		},
		{
			kind: 'color',
			group: 'colour',
			token: '--shear-line',
			label: 'Lattice',
			hint: 'One thread. Both sets take it, so the weave never reads as two different materials crossing.',
			value: 'rgba(94, 234, 212, 0.05)'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'gap',
			label: 'Thread spacing',
			hint: 'Distance between threads. Under ~14px the two sets fuse into flat tone and the moiré is gone.',
			value: 26,
			min: 14,
			max: 90,
			step: 2,
			unit: 'px'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'angle',
			label: 'Bias',
			hint: 'Angle of the first set. The second sits 74° off it — off-square on purpose, since 90° reads as graph paper.',
			value: 22,
			min: 0,
			max: 90,
			step: 1,
			unit: '°'
		},
		{
			kind: 'range',
			group: 'shape',
			token: '--shear-weave',
			label: 'Thread strength',
			hint: 'Opacity of both line sets. The pool underneath is unaffected.',
			value: 0.6,
			min: 0,
			max: 1,
			step: 0.02
		},
		{
			kind: 'range',
			group: 'motion',
			token: '--shear-period',
			label: 'Shear period',
			hint: 'Seconds for one thread of travel. LOWER IS FASTER. The second set runs at 1.42× this, and that ratio is why the moiré never repeats.',
			value: 34,
			min: 8,
			max: 180,
			step: 2,
			unit: 's'
		}
	]
};

/** A fresh, mutable copy — the studio edits these in place. */
export function familyKnobs(id: FamilyId): Knob[] {
	return FAMILY_KNOBS[id].map((k) => ({ ...k }));
}
