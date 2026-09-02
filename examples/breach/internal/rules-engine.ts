// ── The rules, as the engine that resolves them ──────────────────────────────
// A typed façade over cmd/breachwasm — internal/breach compiled for the browser.
//
// This exists to end a duplication, not to add a layer. The client needed rules
// locally for two things the server cannot do for it: quote the odds BEFORE a
// move is committed, and run a match when there is no server (the standalone
// table, the solo demo). So it grew a second engine in TypeScript, and the two
// drifted — at 1v1 from round 9 the board showed a wall two higher than the
// server resolved against, because one summed blue's harden upgrades over
// seated chairs and the other over the whole roster. `make breachgen` could
// never have caught it: it emits DATA and says so in its own header.
//
// The shape is a SERVER IN THE PAGE. The Match lives in Go; this side sends a
// verb and receives the same fogged projection the real server sends. So an
// offline table stops being a second implementation of the game and becomes a
// second host for the one implementation — and `applyRemote` becomes the single
// door state comes through, networked or not.

import { loadWasmModule } from 'showcase';
import type { RemoteMatchView } from './match.svelte.js';
import type { MatchSize } from './rules.js';

/** Served from the root of whichever app hosts this, beside the transport
 *  module — see `build-breach-rules-wasm`. Root-relative for the same reason
 *  `/armornet.wasm` is: the game is mounted under a prefix and this file is not
 *  part of that bundle. */
const WASM_URL = '/breach-rules.wasm';

/** Everything the module publishes. Every call is SYNCHRONOUS — the HUD reads a
 *  wall's hardening inside a `$derived` while it renders, and a promise cannot
 *  be awaited there. Only `load()` is async, and only once. */
interface RulesModule {
	version: string;
	open(size: MatchSize, seed: number): { size: MatchSize };
	view(klassKey: string): string;
	hardening(siteId: string): number;
	odds(actorKey: string, playKey: string, siteId: string): string;
	perform(actorKey: string, playKey: string, siteId: string): string;
	endTurn(): void;
	aiTurn(): string | null;
	state(): string;
}

/** The un-fogged frame a page needs to drive itself. Nothing here is hidden
 *  from anyone at any table, which is why it is not behind a seat key. */
export interface EngineState {
	round: number;
	phase: number;
	size: MatchSize;
	activeKey: string;
	seatOrder: string[];
	winner: string;
}

export class RulesEngine {
	#mod: RulesModule;

	private constructor(mod: RulesModule) {
		this.#mod = mod;
	}

	/** Loads the module and opens a match on it.
	 *
	 *  The seed is explicit rather than drawn from the clock, so a table is
	 *  reproducible: the same seed plays the same match. That is what lets a
	 *  vector generated against the server be replayed here and compared row for
	 *  row, which is the only way to know the engines agree. */
	static async open(size: MatchSize, seed: number): Promise<RulesEngine> {
		const mod = await loadWasmModule<RulesModule>(WASM_URL, 'breachRules');
		mod.open(size, seed);
		return new RulesEngine(mod);
	}

	get version(): string {
		return this.#mod.version;
	}

	/** The board as one chair sees it — the same shape, field for field, that
	 *  arrives over the Agent Line from a real table. The fog runs in Go on both paths;
	 *  locally that is not security, it is so there is one decoder. */
	view(klassKey: string): RemoteMatchView {
		return JSON.parse(this.#mod.view(klassKey)) as RemoteMatchView;
	}

	/** The number this whole module was written for. */
	hardening(siteId: string): number {
		return this.#mod.hardening(siteId);
	}

	odds(actorKey: string, playKey: string, siteId: string): unknown {
		return JSON.parse(this.#mod.odds(actorKey, playKey, siteId));
	}

	perform(actorKey: string, playKey: string, siteId: string): unknown {
		return JSON.parse(this.#mod.perform(actorKey, playKey, siteId));
	}

	endTurn(): void {
		this.#mod.endTurn();
	}

	/** Plays the seat that is up; null when it has nothing to do.
	 *
	 *  The demonstrator belongs to the ruleset, not to the client. The client's
	 *  own copy of it picked from a different pool than the server's and passed
	 *  in positions the server played — the same class of divergence as the
	 *  hardening bug, and it reached more people, because most players meet this
	 *  game by watching it play itself. */
	aiTurn(): unknown | null {
		const res = this.#mod.aiTurn();
		return res === null || res === undefined ? null : JSON.parse(res);
	}

	state(): EngineState {
		return JSON.parse(this.#mod.state()) as EngineState;
	}
}
