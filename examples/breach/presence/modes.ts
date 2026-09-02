// ── Presence render modes ────────────────────────────────────────────────────
// The catalogue. One row per way of drawing the other three seats, and nothing
// else — no components, no state, no DOM. `PlayerPresence` owns the id →
// component map; keeping it out of here is what stops the cycle (a mode
// component wants these types, and this file would want that component).
//
// Modes COMPOSE. They are not a radio group: the ring answers "when", the limb
// markers answer "where", and the point of running both is that those are
// different questions. The only constraint is the layer each one draws into.

import type { IconName } from 'showcase';

/** Where a mode draws, which decides what it is handed and what it may assume.
 *
 *  `panel`  — HUD furniture, laid out in the left column. Normal flow, no
 *             anchors, safe to grow.
 *  `stage`  — screen space over the canvas. Knows the globe's box and nothing
 *             about individual buildings, so it survives the globe spinning.
 *  `world`  — pinned to the board itself. Handed live territory anchors,
 *             re-sampled every frame; must tolerate an anchor vanishing when a
 *             region rotates to the far side. */
export type PresenceLayer = 'panel' | 'stage' | 'world';

export type PresenceRenderMode =
	| 'roster'
	| 'ring'
	| 'limb'
	| 'trails'
	| 'contested'
	| 'cameras';

export interface PresenceModeDef {
	id: PresenceRenderMode;
	/** Short name, for the toggle. */
	name: string;
	/** What it answers, in the fewest words that are still true. */
	blurb: string;
	icon: IconName;
	layer: PresenceLayer;
	/** On by default. The default set is deliberately not "everything": six
	 *  presence treatments at once is a christmas tree, and the board still has a
	 *  game on it. */
	default: boolean;
}

export const PRESENCE_MODES: PresenceModeDef[] = [
	{
		id: 'roster',
		name: 'Roster',
		blurb: 'Who is at the table, and whose turn is burning.',
		icon: 'users',
		layer: 'panel',
		default: true
	},
	{
		id: 'ring',
		name: 'Initiative ring',
		blurb: 'When they act — the R/B/R/B interleave, as a clock.',
		icon: 'clock',
		layer: 'stage',
		default: true
	},
	{
		id: 'limb',
		name: 'Standing at the limb',
		blurb: 'Where they sit, and what they just reached for.',
		icon: 'radar',
		layer: 'stage',
		default: true
	},
	{
		id: 'trails',
		name: 'Attention trails',
		blurb: 'Where their hands keep going back to.',
		icon: 'fingerprint',
		layer: 'world',
		default: false
	},
	{
		id: 'contested',
		name: 'Contested ground',
		blurb: 'Which regions are being fought over, by how many sides.',
		icon: 'layers',
		layer: 'world',
		default: false
	},
	{
		id: 'cameras',
		name: 'Seat cameras',
		blurb: 'Stand on their ground. Their GROUND — never their knowledge.',
		icon: 'eye',
		layer: 'panel',
		default: false
	}
];

export const DEFAULT_MODES: PresenceRenderMode[] = PRESENCE_MODES.filter((m) => m.default).map(
	(m) => m.id
);

export const modeById = (id: PresenceRenderMode): PresenceModeDef =>
	PRESENCE_MODES.find((m) => m.id === id) ?? PRESENCE_MODES[0];
