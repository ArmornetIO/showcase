// ── applyRemote must not subscribe to its own writes ─────────────────────────
// `applyRemote` is the one mutating method a COMPONENT calls from inside an
// $effect, on every snapshot. Reading a field it also writes makes that effect
// depend on its own output — and because each write installs a fresh object
// identity, the value never has to change for it to re-run. Svelte stops it
// with `effect_update_depth_exceeded`, which reaches a player as the client
// locking solid the moment a multiplayer match starts. A solo game is fine,
// because nothing ever calls this.
//
// Named .svelte.spec.ts deliberately: this is the browser project. `$effect` is
// a client-only rune, so the same test in a Node spec would never schedule an
// effect and would pass for the wrong reason.
import { describe, expect, it } from 'vitest';
import { flushSync, untrack } from 'svelte';

import { BreachMatch, type RemoteMatchView } from './match.svelte.js';
import { BreachLobby } from './lobby.svelte.js';
import { DEFAULT_APPEARANCE, type Appearance } from './appearance.js';

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
	it('settles instead of re-triggering itself', () => {
		const match = new BreachMatch();
		let runs = 0;

		const stop = $effect.root(() => {
			$effect(() => {
				runs++;
				// Exactly what Breach.svelte does on every frame from the server,
				// including the power charge that made this loop.
				match.applyRemote(
					snapshot({ power: { key: 'sweep', charges: 2 } } as Partial<RemoteMatchView>)
				);
			});
		});
		flushSync();
		stop();

		// One scheduled pass. A self-subscription shows up here as a number that
		// climbs, so the assertion is deliberately exact — "settles eventually"
		// would pass on a loop that merely ran forty times before giving up.
		expect(runs).toBe(1);
		expect(untrack(() => match.charges).sweep).toBe(2);
	});
});

// The lobby has the same method, called from the same shape — two effects, in
// `Lobby.svelte` and `Breach.svelte` — and it grew the same self-subscription
// the moment seats started carrying an appearance to merge. It reached a player
// as a lobby that froze on filling with bots, opening an invite or joining a
// side: every one of those is the first snapshot in which a seat is dressed.
describe('BreachLobby.applyRemote inside an $effect', () => {
	function seating(appearance?: Appearance) {
		return {
			your_seat: 'R1',
			lobby: {
				phase: 'waiting',
				mode: 'draft',
				size: '2v2',
				seats: [
					{ id: 'R1', side: 'red', appearance, occupant: { kind: 'human', user_id: 'u1' } },
					{ id: 'R2', side: 'red', occupant: { kind: 'open' } }
				]
			}
		};
	}

	it('settles instead of re-triggering itself', () => {
		const lobby = new BreachLobby();
		let runs = 0;

		const stop = $effect.root(() => {
			$effect(() => {
				runs++;
				// A dressed seat is the trigger: with no `appearance` anywhere in
				// the view the merge writes back an equal map and the loop never
				// shows itself, which is why this fixture carries one.
				lobby.applyRemote(seating(DEFAULT_APPEARANCE));
			});
		});
		flushSync();
		stop();

		expect(runs).toBe(1);
	});

	it('keeps a look the view said nothing about', () => {
		// Why the merge exists, and so why the untracked read cannot just become
		// a plain overwrite: a partial view must not undress the rest of table.
		const lobby = new BreachLobby();
		lobby.setLook('B1', DEFAULT_APPEARANCE);
		lobby.applyRemote(seating(DEFAULT_APPEARANCE));

		expect(untrack(() => lobby.looks).B1).toBeDefined();
	});
});
