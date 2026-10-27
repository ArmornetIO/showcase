// ── How an office shift ended, from the reader's chair ───────────────────────
// The office's counterpart of hud/outcome.ts. The server says which side won
// and why in its own words (internal/breach/office: clock.go, meeting.go); this
// turns that into what GameOver prints for whoever is reading — the insider
// who got the worm out reads a different line than the clerk who let them.
//
// Pure: no Svelte.
import type { OfficeView } from '../wire.gen.js';
import { FACTION_TONE, LOSS_TONE, WIN_TONE } from '../hud/outcome.js';

export type Side = 'loyal' | 'insider';

/** Every way a shift ends, keyed by the server's reason. A reason this table
 *  has not heard of still ends the match; it just reads plainer. */
const LINES: Record<string, { won: string; lost: string }> = {
	'the clock ran out': { won: 'you held out', lost: 'out of time' },
	"the shift's work got done": { won: 'shift done', lost: 'outworked' },
	'the insider was escorted out': { won: 'caught them', lost: 'walked out' },
	'the insider walked off the job': { won: 'they cracked', lost: 'you walked' },
	'the worm called home': { won: 'worm delivered', lost: 'the worm got out' },
	'nobody was left to stop it': { won: 'unstoppable', lost: 'outnumbered' }
};

/** The office's two sides in the hues the card game gives its own: the insider
 *  is the attacker, so red; the loyal floor is the estate, so blue. */
export const SIDE_TONE: Record<Side, string> = { insider: FACTION_TONE.red, loyal: FACTION_TONE.blue };

export interface ShiftOutcome {
	winner: Side;
	/** The reader's side, or null for somebody only watching. */
	mine: Side | null;
	won: boolean;
	verdict: string;
	/** The server's reason, as the header's claim. */
	claim: string;
	/** The unmask: who it was. Never keyed on `won`. */
	event: string;
	/** How close it came, in the race's own numbers. */
	sentence: string;
	tone: string;
	winTone: string;
	/** Seats that were the insider. */
	insiders: string[];
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * @param steps the worm's milestones, all of them
 * @param who a seat as the room knew it: "handle · job"
 */
export function shiftOutcome(office: OfficeView, steps: number, who: (seat: string) => string): ShiftOutcome | null {
	if (office.phase !== 'over') return null;
	const winner: Side = office.winner === 'insider' ? 'insider' : 'loyal';
	const me = office.reveal.find((r) => r.seatId === office.me?.seatId);
	const mine: Side | null = me ? (me.insider ? 'insider' : 'loyal') : null;
	const won = mine === winner;
	const line = LINES[office.reason];
	const verdict = !mine
		? `${winner} side wins`
		: (line?.[won ? 'won' : 'lost'] ?? (won ? 'you take it' : 'you lose it'));

	const insiders = office.reveal.filter((r) => r.insider).map((r) => r.seatId);
	const event =
		mine === 'insider'
			? 'you were the insider'
			: `${insiders.map(who).join(' and ') || 'nobody'} ${insiders.length > 1 ? 'were' : 'was'} the insider`;

	const worm = `the worm at ${office.wormShown} of ${steps}`;
	const left = clock(Math.ceil(Number(office.leftMs) / 1000));
	const trial = office.lastMeeting;
	const sentence = (() => {
		switch (office.reason) {
			case 'the clock ran out':
				return `The shift ended with ${worm}.`;
			case 'the insider was escorted out': {
				const v = trial ? votesAgainst(trial.votes, trial.escorted) : null;
				return `The room voted them out${v ? `, ${v.for} of ${v.cast}` : ''}, with ${worm} and ${left} still on the clock.`;
			}
			case 'the insider walked off the job':
				return `The insider left the building with ${worm}.`;
			case 'the worm called home':
				return `The worm called home with ${left} still on the clock.`;
			case 'nobody was left to stop it':
				return `Every loyal hand was walked out, with ${worm}.`;
			default:
				return `It ended with ${worm}.`;
		}
	})();

	return {
		winner,
		mine,
		won,
		verdict,
		claim: office.reason,
		event,
		sentence,
		tone: !mine ? SIDE_TONE[winner] : won ? WIN_TONE : LOSS_TONE,
		winTone: SIDE_TONE[winner],
		insiders
	};
}

/** Votes the room cast against `seat` in a meeting, out of all cast. */
export function votesAgainst(votes: Record<string, string>, seat: string): { for: number; cast: number } {
	const all = Object.values(votes);
	return { for: all.filter((v) => v === seat).length, cast: all.length };
}
