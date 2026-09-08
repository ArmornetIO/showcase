// ── new_match, on a table somebody else is also sitting at ───────────────────
// `newMatch` used to be one method doing two jobs: on a hosted table it sent
// the intent and returned, and NOTHING ever put the client back to `select`.
// The server drops the match and reopens the lobby; the browser stayed on the
// finished board, and because `stage` was still `play` the effect that enters a
// match refused the next one — so the table restarted without its players.
//
// The reset therefore hangs off the SNAPSHOT (Breach.svelte), not off the
// click: three of the four screens never made one. That wiring is an `$effect`
// and cannot run under Node — what is pinned here is the contract it depends
// on, which is that the two halves are separately callable.
import { describe, expect, it } from 'vitest';
import { untrack } from 'svelte';

import { BreachMatch, type RemotePort } from './match.svelte.js';

/** A port that records the requests made of it and answers nothing, which is
 *  what a socket does: the answer arrives later, as a snapshot. */
function recordingPort(): RemotePort & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		commit: () => calls.push('commit'),
		endTurn: () => calls.push('end_turn'),
		newMatch: () => calls.push('new_match')
	};
}

describe('new match on a hosted table', () => {
	it('asks the server rather than emptying the board itself', () => {
		const match = new BreachMatch();
		const port = recordingPort();
		match.remote = port;
		match.stage = 'play';
		match.winner = 'red';

		match.newMatch();

		expect(port.calls).toEqual(['new_match']);
		// Still on the finished match, deliberately: the server has not answered
		// yet, and the client is not the authority on a table four people share.
		expect(untrack(() => match.stage)).toBe('play');
	});

	it('leaves the finished match when the reset arrives', () => {
		const match = new BreachMatch();
		match.remote = recordingPort();
		match.stage = 'play';
		match.winner = 'red';
		match.round = 4;

		match.reset();

		// `select` is what the effect that enters a match tests for. Left on
		// `play`, the next match never opens on this screen.
		expect(untrack(() => match.stage)).toBe('select');
		expect(untrack(() => match.winner)).toBe(null);
		expect(untrack(() => match.round)).toBe(1);
	});

	it('does not send a second request when the reset runs', () => {
		// The reset is driven by every snapshot, so a `reset` that went back
		// through `newMatch` would ask for a new match on every frame.
		const match = new BreachMatch();
		const port = recordingPort();
		match.remote = port;
		match.stage = 'play';

		match.reset();

		expect(port.calls).toEqual([]);
	});
});
