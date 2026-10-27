// The same ending read from three chairs: the unmask and the side that won do
// not move, only the verdict does.
import { describe, expect, it } from 'vitest';
import { newOfficeMe, newOfficeMeeting, newOfficeView, type OfficeView } from '../wire.gen.js';
import { shiftOutcome, votesAgainst } from './shift.js';

const reveal = [
	{ seatId: 'a', klassKey: 'architect', insider: false },
	{ seatId: 'b', klassKey: 'architect', insider: true }
];

function ended(winner: string, reason: string, me?: string): OfficeView {
	return newOfficeView({
		phase: 'over',
		winner,
		reason,
		reveal,
		wormShown: 2,
		leftMs: 90_000,
		me: me ? newOfficeMe({ seatId: me }) : undefined,
		lastMeeting: newOfficeMeeting({ escorted: 'b', votes: { a: 'b', c: 'b', d: 'skip' } })
	});
}

const who = (s: string) => `seat ${s}`;

describe('shiftOutcome', () => {
	it('says nothing while the shift runs', () => {
		expect(shiftOutcome(newOfficeView({ phase: 'playing' }), 5, who)).toBeNull();
	});

	it('reads the same ending differently from each side', () => {
		const loyal = shiftOutcome(ended('loyal', 'the insider was escorted out', 'a'), 5, who)!;
		const insider = shiftOutcome(ended('loyal', 'the insider was escorted out', 'b'), 5, who)!;
		const watcher = shiftOutcome(ended('loyal', 'the insider was escorted out'), 5, who)!;
		expect([loyal.verdict, insider.verdict, watcher.verdict]).toEqual(['caught them', 'walked out', 'loyal side wins']);
		expect([loyal.won, insider.won, watcher.won]).toEqual([true, false, false]);
		expect(loyal.winTone).toBe(insider.winTone);
		expect(loyal.event).toBe('seat b was the insider');
		expect(insider.event).toBe('you were the insider');
		expect(loyal.sentence).toBe('The room voted them out, 2 of 3, with the worm at 2 of 5 and 1:30 still on the clock.');
	});

	it('falls back for a reason it has not heard of', () => {
		expect(shiftOutcome(ended('insider', 'a new way to lose', 'b'), 5, who)!.verdict).toBe('you take it');
	});
});

describe('votesAgainst', () => {
	it('counts skips as cast but not against', () => {
		expect(votesAgainst({ a: 'b', c: 'skip' }, 'b')).toEqual({ for: 1, cast: 2 });
	});
});
