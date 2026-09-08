// ── One colour for "now" ─────────────────────────────────────────────────────
// The three HUD surfaces used to hold three separate opinions about what colour
// the current moment was: the play ticker lit in the armed card's kind-hue, the
// clock lit in the acting seat's hue with its own amber/red ramp, and the seat
// panel lit in YOUR hue with a third copy of that same ramp. Mid-turn a player
// was doing colour arithmetic across 900px of screen, and the three ramps were
// three chances for one of them to drift.
//
// So there is one ladder, here, and every surface derives off it. When it goes
// amber the whole HUD goes amber in the same frame — which is the entire
// tactical-shooter treatment. Valorant and CS do not tell you you are in
// trouble in one widget; they tell you in the chrome.
//
// A pure function rather than a store on purpose: a store is a second source of
// truth that has to be kept in step with the match, and this has none of its own
// state to get wrong. Every caller wraps it in its own `$derived`.
import type { BreachMatch } from '../internal/match.svelte.js';

/** Which rung of the ladder matched. Surfaces branch on this rather than
 *  re-deriving the condition — two places computing "am I in trouble" is the
 *  drift this file exists to prevent. */
export type HudStateKey =
	| 'win'
	| 'loss'
	| 'illegal'
	| 'sealed'
	| 'resolving'
	| 'critical'
	| 'low'
	| 'armed'
	| 'yours'
	| 'idle';

export interface HudState {
	key: HudStateKey;
	color: string;
}

/** The card kinds' own hues. Not in the design system's variant palette — a
 *  card kind is game data, and the chip on the card face wears the same value. */
export const KIND_COLOR: Record<string, string> = {
	strike: '#FB7185',
	implant: '#F472B6',
	recon: '#38BDF8',
	control: '#A78BFA',
	econ: '#FBBF24',
	utility: '#34D399'
};

/** Below this fraction of the turn the clock is CRITICAL; below `LOW` it is
 *  merely worth noticing. Exported because the takeover's low-time re-tint has
 *  to fire on exactly the same threshold the colour does. */
export const CRITICAL_AT = 0.17;
export const LOW_AT = 0.4;

/**
 * First match wins. The order is the argument: a blocked move matters more than
 * a running clock, and the match being over matters more than either.
 */
export function hudState(match: BreachMatch): HudState {
	if (match.winner) {
		return match.winner === match.seat.faction
			? { key: 'win', color: '#34D399' }
			: { key: 'loss', color: '#EF4444' };
	}

	// A refusal outranks the clock: you cannot spend the seconds you have left on
	// a move the engine is going to reject.
	if (match.blockReason?.kind === 'hard') return { key: 'illegal', color: '#FB7185' };
	if (match.blockReason?.kind === 'sealed') return { key: 'sealed', color: '#A78BFA' };

	// A resolution is the game's time, not a player's — so it desaturates rather
	// than taking anybody's colour.
	if (match.busy || match.pending) return { key: 'resolving', color: '#94A3B8' };

	const frac = match.turnLeft / match.turnMs;
	if (match.isMyTurn && frac <= CRITICAL_AT) return { key: 'critical', color: '#EF4444' };
	if (match.isMyTurn && frac <= LOW_AT) return { key: 'low', color: '#FBBF24' };

	if (match.isMyTurn && match.armed) {
		return { key: 'armed', color: KIND_COLOR[match.armed.kind] ?? match.seat.color };
	}
	if (match.isMyTurn) return { key: 'yours', color: match.seat.color };

	// Somebody else's turn still belongs to somebody — muted toward the dim
	// foreground rather than flattened to grey, so the strip keeps saying whose.
	return {
		key: 'idle',
		color: `color-mix(in srgb, ${match.activeKlass.color} 45%, var(--fg-dim))`
	};
}

/**
 * The plate every surface in this HUD sits on — and it is the SAME plate the
 * hero stack and the building stack are cut from.
 *
 * This was a big chamfer and a vertical lit gradient, drawn with a two-layer rim
 * trick so a 1px band of the state colour ran all the way round. Cut and lit
 * like that the bars were a second design system: everything else on screen is a
 * soft-cornered dark card with a hue mixed into one corner and a stripe down its
 * edge, and two grammars on one screen reads as two products, not two panels.
 *
 * So: the rails' radial fill, the rails' radius, the rails' shadow, and the hue
 * carried by a 3px spine instead of a full rim. See `BuildingStack` — the
 * numbers here are lifted from it on purpose, not re-picked.
 */
export const plateFill = (color: string, mix = 22) =>
	`radial-gradient(120% 120% at 14% 30%,
		color-mix(in srgb, ${color} ${mix}%, var(--bg-elev, #0b0f16)) 0%,
		var(--bg-elev, #0b0f16) 64%)`;

/** The rails' resting and lifted shadows. A HUD bar is a lifted card — it floats
 *  over the board — so it takes the second one. */
export const PLATE_SHADOW = '0 6px 16px rgba(0,0,0,0.45)';
export const PLATE_SHADOW_UP = '0 14px 30px rgba(0,0,0,0.55)';

/** The tinted-not-filled treatment every badge in this game wears (the AP gem,
 *  the LINK tab). Used wherever the first pass reached for a solid slab of the
 *  state colour with inverted type on it — one saturated mass per screen is a
 *  HUD, four is a warning label. */
export const gemFill = (color: string) => `color-mix(in srgb, ${color} 26%, var(--bg-elev, #0b0f16))`;
export const gemEdge = (color: string) => `color-mix(in srgb, ${color} 60%, transparent)`;

/** Type inverted onto a saturated block. Near-black rather than the page
 *  background, because the blocks are bright and `--bg` is not dark enough to
 *  hold an edge against them. */
export const ON_ACCENT = '#07090e';
