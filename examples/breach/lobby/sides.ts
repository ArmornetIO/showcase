// ── The two sides, as copy ───────────────────────────────────────────────────
// `rules.ts` knows a faction is `red` or `blue` and nothing else about it,
// which is correct — the rules do not need a tagline. This is the editorial
// half, kept beside the screens that show it so the picker, the select screen
// and the table strip cannot describe the same side three different ways.

// The tone is no longer kept here. It is the colour of every role badge on the
// board, which makes it a fact rather than a line of copy — `internal/badge.ts`
// owns it, and this file reads it so a side cannot be one red in the picker and
// another on a chest.
import { SIDE_TONE } from '../internal/badge.js';
import type { Faction } from '../internal/rules.js';

export const SIDES: Record<Faction, { label: string; call: string; tone: string; blurb: string }> = {
	red: {
		label: 'Red',
		call: 'Get in. Stay in.',
		tone: SIDE_TONE.red,
		blurb: 'Moves first. Every plan has to survive a blue turn in the middle of it.'
	},
	blue: {
		label: 'Blue',
		call: 'Assume it already happened.',
		tone: SIDE_TONE.blue,
		blurb: 'Answers. Cannot see the attacker — only the ground they have to cross.'
	}
};

/** Where a seat sits in the turn order, said in words. The seat id is the only
 *  place `R1` is ever printed; everywhere else it is "acts first". */
export const ORDINAL = ['first', 'second', 'third', 'fourth'];
