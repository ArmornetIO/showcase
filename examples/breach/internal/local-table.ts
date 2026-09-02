// ── An offline table, hosted by the rules themselves ─────────────────────────
// The last piece of removing the second ruleset.
//
// `BreachMatch.remote` already exists, and it is the whole trick: set it and the
// three methods that change the board — commit, end turn, new match — stop being
// local mutations and become REQUESTS, with the answers arriving as snapshots
// through `applyRemote`. That was built for the server. Nothing about it
// requires the answer to come from one.
//
// So an offline table is a RemotePort backed by cmd/breachwasm: internal/breach,
// compiled for the browser, holding the Match in Go exactly as the server does.
// The client stops being a second implementation of the game and becomes a view
// of the only one, on both paths, and `applyRemote` becomes the single door
// state comes through.
//
// What this deletes, once it is the default: `hardeningOf`, `leverageFor`,
// `attackBlocked`, `oddsFor`, `applyStrike`, `applyRedSupport`, `applyBlue`,
// `applyRecon`, `upkeep`, `dwell`, `surface`, `checkVictory` and `aiChoice` —
// roughly 2,300 lines whose only remaining job is the offline board.

import type { BreachMatch, RemotePort, RemoteResolution } from './match.svelte.js';
import { RulesEngine } from './rules-engine.js';
import type { MatchSize } from './rules.js';

export interface LocalTableOptions {
	size?: MatchSize;
	/** Fixes the deal and every roll. Omit for a different game each time; pass
	 *  one to reproduce a table exactly, which is how a bug report about this
	 *  game becomes something anybody else can look at. */
	seed?: number;
	/** Seats a person is holding. Everything else is played by the engine's own
	 *  demonstrator — the Go one, not a second opinion written here. */
	human?: string[];
	/** Whose projection the screen shows. Defaults to whoever is up, which is
	 *  right for a table nobody is sitting at; a person who has taken a chair
	 *  keeps watching from THEIR chair while the machine plays, exactly as they
	 *  would on a networked table. */
	seat?: string;
}

/** Opens a match in the rules module and returns the port that drives it.
 *
 *  Async only because the module has to be fetched. Everything after that is
 *  synchronous, which matters: the HUD reads the board while it renders. */
export async function openLocalTable(
	match: BreachMatch,
	opts: LocalTableOptions = {}
): Promise<{ port: RemotePort; engine: RulesEngine }> {
	const size = opts.size ?? '2v2';
	const human = opts.human ?? [];
	let seed = opts.seed ?? Date.now() & 0x7fffffff;

	let engine = await RulesEngine.open(size, seed);

	/** Hand the board to whoever is sitting at it.
	 *
	 *  The ACTIVE seat's projection, because a hot-seat table has one screen and
	 *  the person in front of it is whoever took a chair — falling back to the
	 *  active seat when nobody has. It is a real fogged view, not the whole board
	 *  with the fog switched off, so the offline game hides the same things from
	 *  the same seats the networked one does and a bug in the fog is visible
	 *  without standing up a server. */
	const sync = () => {
		match.applyRemote(engine.view(opts.seat ?? engine.state().activeKey));
	};

	/** Plays every machine seat until a person is up, or the match ends.
	 *
	 *  Bounded rather than `while (true)`: a demonstrator that somehow cannot
	 *  move and cannot pass would otherwise lock the tab, and a turn limit is a
	 *  cheaper guarantee than proving it never happens.
	 */
	const runBots = async () => {
		for (let guard = 0; guard < 64; guard++) {
			const state = engine.state();
			if (state.winner || human.includes(state.activeKey)) break;

			const res = engine.aiTurn() as RemoteResolution | null;
			sync();
			// The beats are a replay of something that has already happened —
			// which is why awaiting them here is safe, and why a client that
			// skipped them entirely would still be correct, just silent.
			if (res) await match.playResolution(res);
			else engine.endTurn();
			sync();
		}
	};

	const port: RemotePort = {
		commit: (cardKey, siteID) => {
			const actor = engine.state().activeKey;
			// Deliberately not awaited: `RemotePort.commit` is fire-and-forget on
			// the networked path too, where the answer arrives later on the
			// socket. Keeping the same shape means the match class cannot tell
			// the two apart, which is the entire point of this file.
			void (async () => {
				const res = engine.perform(actor, cardKey, siteID) as RemoteResolution;
				sync();
				await match.playResolution(res);
				sync();
				await runBots();
			})();
		},

		endTurn: () => {
			void (async () => {
				engine.endTurn();
				sync();
				await runBots();
			})();
		},

		newMatch: () => {
			void (async () => {
				// A new seed, so "play again" is a different game. The old engine
				// is dropped rather than reset: the module holds one match, and
				// opening another is what starting over means.
				seed = (seed * 1103515245 + 12345) & 0x7fffffff;
				engine = await RulesEngine.open(size, seed);
				sync();
				await runBots();
			})();
		}
	};

	sync();
	void runBots();

	return { port, engine };
}
