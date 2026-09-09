// The regression this file exists for: the end of a match used to be written
// twice, once keyed on the winner and once keyed on whether YOU won, and the two
// sentences contradicted each other for the seat that lost. Every case below
// asserts the same thing from a different chair — the EVENT does not move.
import { describe, expect, it } from 'vitest';
import { BreachMatch } from '../internal/match.svelte.js';
import { CHAIN } from '../internal/rules.js';
import { outcomeOf } from './outcome.js';

function ended(winner: 'red' | 'blue', seat: string, links: number, revealed = 0): BreachMatch {
	const m = new BreachMatch();
	m.seatKey = seat;
	m.round = winner === 'red' ? 9 : 12;
	m.footholds = CHAIN.slice(0, links).map((s, i) => ({
		structure_id: s.id,
		seat_key: 'maintainer',
		persistent: true,
		revealed: i < revealed,
		sleeper: false,
		placed_round: 2,
		staged: false
	}));
	m.winner = winner;
	return m;
}

describe('outcomeOf', () => {
	it('says nothing while the match is live', () => {
		expect(outcomeOf(new BreachMatch())).toBeNull();
	});

	it('reads the same event from both chairs when red takes it', () => {
		const red = outcomeOf(ended('red', 'maintainer', CHAIN.length))!;
		const blue = outcomeOf(ended('red', 'hunter', CHAIN.length))!;
		expect(red.event).toBe(blue.event);
		expect(red.sentence).toBe(blue.sentence);
		expect(red.event).toContain('payload');
	});

	it('reads the same event from both chairs when blue holds', () => {
		const red = outcomeOf(ended('blue', 'maintainer', 3))!;
		const blue = outcomeOf(ended('blue', 'hunter', 3))!;
		expect(red.event).toBe(blue.event);
		expect(blue.event).toContain('horizon');
	});

	it('flips only the verdict with the seat', () => {
		expect(outcomeOf(ended('red', 'maintainer', CHAIN.length))!.verdict).toBe('you take it');
		expect(outcomeOf(ended('red', 'hunter', CHAIN.length))!.verdict).toBe('you lose it');
		expect(outcomeOf(ended('blue', 'hunter', 3))!.verdict).toBe('you take it');
		expect(outcomeOf(ended('blue', 'maintainer', 3))!.verdict).toBe('you lose it');
	});

	// The bug this replaced: `proven` read the CURRENT seat's fogged view, so a
	// red reader was shown its own perfect knowledge under blue's label.
	it('counts blue evidence, not the reader’s view', () => {
		const seen = ended('red', 'maintainer', CHAIN.length, 2);
		expect(outcomeOf(seen)!.proven).toBe(2);
		expect(outcomeOf(seen)!.held).toBe(CHAIN.length);
	});
});
