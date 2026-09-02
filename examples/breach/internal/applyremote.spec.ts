// ── applyRemote, under an effect ─────────────────────────────────────────────
// `applyRemote` is the one mutating method on the match that a COMPONENT calls
// from inside an $effect, on every snapshot. That makes it the one place where
// reading a field it also writes is fatal rather than untidy: the effect
// subscribes to its own output, and because each write installs a fresh object
// identity the value never has to change for the effect to re-run. Svelte stops
// it with `effect_update_depth_exceeded`, which reaches a player as the client
// locking solid the moment a multiplayer match starts — a solo game is fine,
// because nothing ever calls this.
import { describe, expect, it } from 'vitest';
import { untrack } from 'svelte';

import { BreachMatch, type RemoteMatchView } from './match.svelte.js';

/** A snapshot carrying the fields applyRemote reads. */
function snapshot(over: Partial<RemoteMatchView> = {}): RemoteMatchView {
	return {
		round: 1,
		phase: 0,
		size: '2v2',
		seat_key: 'maintainer',
		active_key: 'maintainer',
		over: false,
		your_turn: true,
		footholds: [],
		garrison: [],
		log: [],
		heat: {} as RemoteMatchView['heat'],
		ap: { maintainer: 3 },
		res: { maintainer: 0 },
		...over
	} as RemoteMatchView;
}

describe('applyRemote inside an $effect', () => {
	// The effect-loop assertion itself lives in applyremote.svelte.spec.ts:
	// `$effect` is a client-only rune and does not run under Node at all, so a
	// version of that test here would pass without ever scheduling anything.
	// What follows is the behaviour the untracked reads must preserve.

	it('keeps other seats’ charges when one seat is told its own', () => {
		// The reason the merge exists at all: a seat is only ever sent its OWN
		// power, so replacing the map would clear everybody else's charges on
		// every snapshot.
		const match = new BreachMatch();
		match.applyRemote(snapshot({ power: { key: 'sweep', charges: 2 } } as Partial<RemoteMatchView>));
		match.applyRemote(
			snapshot({ power: { key: 'harden', charges: 1 } } as Partial<RemoteMatchView>)
		);

		const charges = untrack(() => match.charges);
		expect(charges.sweep).toBe(2);
		expect(charges.harden).toBe(1);
	});

	it('takes the seat’s hand from the snapshot', () => {
		// The server holds the only deck. A browser that kept its own dealt four
		// cards the table had never heard of, and every commit came back
		// "the Maintainer is not holding Earnest Contribution".
		const match = new BreachMatch();
		match.dealTable();
		match.applyRemote(
			snapshot({
				hand: [
					{ uid: 's1', key: 'pressure' },
					{ uid: 's2', key: 'contribution' }
				]
			} as Partial<RemoteMatchView>)
		);

		expect(untrack(() => match.handOf('maintainer')).map((c) => c.uid)).toEqual(['s1', 's2']);
	});

	it('keeps a held card’s arrival time across snapshots', () => {
		// Otherwise every card reads as new on every snapshot and the fan replays
		// the deal each time anybody at the table moves.
		const match = new BreachMatch();
		match.applyRemote(
			snapshot({ hand: [{ uid: 's1', key: 'pressure' }] } as Partial<RemoteMatchView>)
		);
		const first = untrack(() => match.handOf('maintainer'))[0].enteredAt;

		match.applyRemote(
			snapshot({
				hand: [
					{ uid: 's1', key: 'pressure' },
					{ uid: 's2', key: 'divergence' }
				]
			} as Partial<RemoteMatchView>)
		);
		const after = untrack(() => match.handOf('maintainer'));
		expect(after[0].enteredAt).toBe(first);
		expect(after[1].enteredAt).toBeGreaterThanOrEqual(first);
	});

	it('leaves the hand alone for a bystander', () => {
		// A snapshot with no seat in it is a spectator's. It carries no hand, and
		// writing one under the empty key would put cards nowhere.
		const match = new BreachMatch();
		match.dealTable();
		const before = untrack(() => match.handOf('maintainer'));
		match.applyRemote(snapshot({ seat_key: '', hand: undefined } as Partial<RemoteMatchView>));
		expect(untrack(() => match.handOf('maintainer'))).toEqual(before);
	});

	it('keeps the local size when a snapshot omits it', () => {
		// `size` has the same read-write shape, saved only by `??` short-circuiting
		// when the server does send one. A snapshot without it must not reset the
		// table: `phase` indexes the seats at THIS size, so a 1v1 round would
		// start being counted in fours.
		const match = new BreachMatch();
		match.size = '1v1';
		match.applyRemote(snapshot({ size: undefined } as Partial<RemoteMatchView>));
		expect(untrack(() => match.size)).toBe('1v1');
	});
});
