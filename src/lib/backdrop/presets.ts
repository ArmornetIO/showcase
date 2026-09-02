// ── presets — the named backdrop compositions ───────────────────────────────
//
// One list, so the studio, the builder and the app shell all resolve the same
// names. It lived on the studio page while there was only one consumer; the
// moment a second could ask for "mr robot" by name, a private map on a route
// became the wrong home for it.
//
// Two shapes are accepted on purpose:
//
//   BackdropPreset  a composition AND its palette — the art-directed vibes,
//                   where the colours are half the design.
//   StripSpec[]     a bare arrangement that keeps whatever palette is loaded —
//                   the earlier hand-tuned ones, which never had an opinion
//                   about colour and should not be made to invent one.

import {
	mrRobotStrips,
	ribbonStrips,
	seedStrips,
	siliconValleyStrips,
	spiderVerseStrips,
	spiralStrips,
	tonysStrips,
	type BackdropPreset,
	type StripSpec
} from './strips.js';

export type PresetId =
	| 'mr robot'
	| 'silicon valley'
	| 'spider-verse'
	| 'tonys'
	| 'spiral'
	| 'ribbon'
	| 'scatter';

export const PRESETS: Record<PresetId, () => StripSpec[] | BackdropPreset> = {
	'mr robot': mrRobotStrips,
	'silicon valley': siliconValleyStrips,
	'spider-verse': spiderVerseStrips,
	tonys: tonysStrips,
	spiral: spiralStrips,
	ribbon: ribbonStrips,
	scatter: () => seedStrips(3)
};

/** Every id, in menu order. The builder's enum options come from here. */
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

/**
 * Resolve a preset to its two halves, whichever shape it was authored in.
 *
 * A bare array reports `tokens: null` rather than an empty object, so a caller
 * can tell "this preset has no palette" apart from "this preset's palette
 * happens to be empty" — the first should leave the current colours alone.
 */
export function resolvePreset(id: PresetId): {
	strips: StripSpec[];
	tokens: Record<string, string> | null;
	rainbow: boolean | null;
	rainbowSpeed: number | null;
} {
	const out = PRESETS[id]();
	if (Array.isArray(out)) return { strips: out, tokens: null, rainbow: null, rainbowSpeed: null };
	return {
		strips: out.strips,
		tokens: out.tokens,
		rainbow: out.rainbow,
		rainbowSpeed: out.rainbowSpeed
	};
}
