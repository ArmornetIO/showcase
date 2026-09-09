// ── How the match ended, in one place ────────────────────────────────────────
// Four surfaces say this — the end screen, the seat plate's notice, the
// objective rail, and the spectator strip — and they were each writing their own
// sentence. Two of them wrote it from different ends: the rail keyed its line on
// WHO WON ("payload delivered") while the plate keyed its line on whether YOU
// won, and then handed the loser red's losing sentence. A blue seat that had
// just been overrun read "the horizon passed with the chain unfinished" next to
// "the chain was completed before the horizon" — the two halves of the HUD
// disagreeing about which side had actually happened.
//
// So the split here is the fix, and it is the only rule this file has:
//
//   VERDICT   is about the reader. 'you take it' / 'you lose it'. It is the only
//             thing on this record that flips with the seat.
//   EVENT     is about the BOARD. What happened is what happened, and it reads
//             identically on both sides of the table — which is what makes two
//             surfaces quoting different halves impossible to contradict.
//
// Both come off `winner`. Nothing here derives an event from `won`.
import { CHAIN } from '../internal/rules.js';
import type { Faction } from '../internal/rules.js';
import type { BreachMatch } from '../internal/match.svelte.js';

/** Green for the reader's win, red for their loss — the HUD's own two stops. */
export const WIN_TONE = '#34D399';
export const LOSS_TONE = '#EF4444';

/** The factions' hues, as the rest of the board draws them. Red winning is not
 *  "bad news" in the abstract: it is bad news for blue, and the end screen says
 *  so with the verdict tone rather than by recolouring the faction. */
export const FACTION_TONE: Record<Faction, string> = { red: '#FB7185', blue: '#38BDF8' };

export interface Outcome {
	winner: Faction;
	/** Whether the seat reading this is the one that won. */
	won: boolean;
	/** The verdict, from the reader's chair. Short — it is set in 1.35rem black. */
	verdict: string;
	/** What HAPPENED, from the board's chair. Never keyed on `won`. */
	event: string;
	/** The same fact as a full sentence, for a surface with room for one. */
	sentence: string;
	/** The reader's tone: green when they took it, red when they did not. */
	tone: string;
	/** The winning side's own hue, for naming the side rather than the result. */
	winTone: string;
	/** Round the match ended on, and the horizon it was racing. */
	round: number;
	horizon: number;
	/** Links red actually stood on at the end — the truth, not blue's reading.
	 *  The match is decided, so there is nothing left for the fog to protect. */
	held: number;
	/** How many of those blue had evidence for. The gap between this and `held`
	 *  is the whole game, and the end screen is the first place it is safe to
	 *  show both numbers at once. */
	proven: number;
	total: number;
}

export function outcomeOf(match: BreachMatch): Outcome | null {
	const winner = match.winner;
	if (!winner) return null;

	const won = winner === match.seat.faction;
	const round = match.round;
	const horizon = match.rounds;
	const held = match.chainHeld.length;
	const left = Math.max(0, horizon - round);

	// Red wins by finishing; blue wins by the clock running out. Those are two
	// different events, and neither of them is "somebody lost".
	const event =
		winner === 'red'
			? 'the payload landed before the horizon'
			: 'the horizon passed with the chain unfinished';

	const sentence =
		winner === 'red'
			? `Every link on the payload path was held at once in round ${round}` +
				(left > 0 ? `, with ${left} ${left === 1 ? 'round' : 'rounds'} still on the clock.` : '.')
			: `Round ${horizon} closed with ${held} of ${CHAIN.length} links taken. The estate held.`;

	return {
		winner,
		won,
		verdict: won ? 'you take it' : 'you lose it',
		event,
		sentence,
		tone: won ? WIN_TONE : LOSS_TONE,
		winTone: FACTION_TONE[winner],
		round,
		horizon,
		held,
		// Blue's evidence, and not `chainShown` — that is what THIS seat can see,
		// so a red reader was shown its own perfect knowledge under a label that
		// says "blue could prove". A foothold blue has evidence for is a revealed
		// one, whoever happens to be reading the screen.
		proven: match.footholds.filter(
			(f) => f.revealed && CHAIN.some((s) => s.id === f.structure_id)
		).length,
		total: CHAIN.length
	};
}
