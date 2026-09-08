// ── The score, in one place ──────────────────────────────────────────────────
// Two surfaces read this — the scoreboard at the top and the lead-change card by
// the battle log — and they must never disagree about who is ahead. A banner
// that fires for a lead the scoreboard is not showing is worse than no banner.
//
// The two numbers are the SAME five links from opposite ends: what red has taken
// and what blue still holds. That is not a presentation trick, it is what
// `match.standing` already computes for each side — a scoreboard whose halves
// are measured in different units is two facts wearing one frame.
import { CHAIN } from '../internal/rules.js';
import type { Faction } from '../internal/rules.js';
import type { BreachMatch } from '../internal/match.svelte.js';

export interface Score {
	/** Links red is standing on. */
	taken: number;
	/** Links blue still holds. */
	held: number;
	/** Null while level — a scoreboard that picks a leader at 2–2 is worse than
	 *  one that admits nobody is ahead. */
	leader: Faction | null;
}

export function scoreOf(match: BreachMatch): Score {
	const taken = match.chainHeld.length;
	const held = CHAIN.length - taken;
	return { taken, held, leader: taken > held ? 'red' : held > taken ? 'blue' : null };
}
