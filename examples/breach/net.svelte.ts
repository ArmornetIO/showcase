// ── The table connection ─────────────────────────────────────────────────────
// One connection, one table, and a `$state` object the components read.
//
// The transport underneath is a WebAssembly module: the same Go Agent Line client
// every armornet agent runs, compiled for the browser (see wasm.ts, and
// docs/development/browser-wasm-agents.md). This file no longer speaks a
// protocol — it hands intents to an agent and receives fogged views back.
//
// That replaced a bespoke JSON WebSocket which duplicated the protocol the
// server already had. Two implementations of one wire is two implementations of
// the FOG, and the fog is the one thing that must never disagree.
//
// It owns reconnection and the outbound queue, and it owns no rules whatsoever:
// every field on `view` was decided by the server and fogged before it was sent.
// There is no optimistic local mutation anywhere in this file, deliberately —
// an optimistic update is a second implementation of a rule, and the copy that
// disagrees is always the one on the screen.
//
// This lives OUTSIDE `internal/`. That directory is the game and has no
// transport in it, which is the property that lets the rules run in Node under a
// test with no server anywhere.

import { INVITE_PARAM } from './api.js';
import type { RemoteMatchView, RemoteResolution } from './internal/match.svelte.js';
import { CAP_BREACH } from './wasm.js';
// Aliased back to the short names this file has always used. The library
// namespaces them because its barrel is shared with app-ui, where a bare
// `subscribe` says nothing about what is being subscribed to.
import {
	subscribeCapability as subscribe,
	unsubscribeCapability as unsubscribe,
	decodeAgentPayload as decodePayload,
	type ArmornetAgent,
	type LostCause
} from 'showcase';

/** Everything a client may ask for. Mirrors `breach.Intent` in Go. */
export interface Intent {
	op:
		| 'take_seat'
		| 'leave_seat'
		| 'ready'
		| 'unready'
		| 'set_mode'
		| 'set_size'
		| 'fill_ai'
		| 'choose'
		| 'start'
		| 'commit'
		| 'end_turn'
		| 'new_match'
		| 'watch'
		| 'sync';
	seat_id?: string;
	klass_key?: string;
	card_key?: string;
	site_id?: string;
	mode?: 'lot' | 'draft' | 'pick';
	size?: '1v1' | '2v2';
}

/** What the server sends. One envelope with a discriminator — a switch on
 *  `type` is the whole protocol. */
export interface Frame {
	type: 'snapshot' | 'event' | 'error';
	view?: TableView;
	res?: Resolution;
	code?: string;
	message?: string;
}

// The view types are structural on purpose: this file should not have to be
// edited every time the server adds a field to a snapshot.
export interface TableView {
	id: string;
	phase: 'setup' | 'select' | 'playing' | 'complete';
	host_id: string;
	/** Where the table was when this view was built. Monotonic. */
	version: number;
	/** Names the table object. A change means `version` restarted. */
	epoch: string;
	you_id: string;
	you_are_host: boolean;
	your_seat?: string;
	/** Set when this view was sent to somebody WATCHING rather than playing. They
	 *  hold no chair, are in nobody's roster, and every intent they could send
	 *  would be refused — so a client reads this and draws a gallery instead of a
	 *  lobby with every control mysteriously dead. */
	spectating?: boolean;
	members: Array<{ user_id: string; name: string; present: boolean }>;
	lobby: {
		phase: string;
		mode: 'lot' | 'draft' | 'pick';
		size: '1v1' | '2v2';
		seats: Array<{
			id: string;
			side: 'red' | 'blue';
			klass_key?: string;
			occupant: { kind: 'open' | 'human' | 'ai'; user_id?: string; name?: string; ready?: boolean };
		}>;
		draft_seat_id?: string;
		waiting_on: string[];
		filled: number;
		can_start: boolean;
		/** Whether the table is full enough for anybody to take a character. */
		can_choose: boolean;
		your_pool?: Array<{ key: string; name: string }>;
	};
	/** The board, fogged for this recipient. Absent until the match starts. */
	match?: SpectatableMatchView;
}

/** The board as it arrives, which for a spectator has no fog in it.
 *
 *  `omniscient` and `hands` are only ever present in a god-admin spectator's
 *  snapshot — a player's payload does not carry them empty, it does not carry
 *  them at all. Optional here for exactly that reason: the type says "you will
 *  not have this unless you are watching". */
export type SpectatableMatchView = RemoteMatchView & {
	omniscient?: boolean;
	/** Every seat's cards, keyed by character. The whole point of god mode, and
	 *  the one thing a player is never sent. */
	hands?: Record<string, SpectatorCard[]>;
	/** Every building's live condition. The board already draws these; the
	 *  gallery reads them as a table, which is the view an operator wants. */
	sites?: SpectatorSite[];
	/** How close the viewpoint seat is to losing, and what that bar measures. */
	standing?: number;
	standing_label?: string;
	/** The payload path, as far as it is held. */
	chain_held?: string[];
};

export interface SpectatorCard {
	key: string;
	name: string;
	ap: number;
	skill: string;
	kind: string;
	playable: boolean;
}

export interface SpectatorSite {
	id: string;
	hardening: number;
	base: number;
	held: boolean;
	sealed: boolean;
	red: number;
	blue: number;
}

/** One action, after the fact, fogged for this recipient.
 *
 *  Declared beside the board's own wire shapes rather than here, for the reason
 *  the header gives: `internal/` is the game and knows nothing about a socket,
 *  so the shapes travel one way and the transport imports them. */
export type Resolution = RemoteResolution;

export type Status = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'closed';

/** Reconnect backoff. Fast enough that a laptop waking up rejoins before the
 *  table notices, slow enough not to hammer a server that is actually down. */
const BACKOFF_MS = [400, 900, 2000, 4000, 8000];

/** The ceiling, reached only once the ladder above is exhausted — about fifteen
 *  seconds of trying. A rolling deploy is tens of seconds; asking again every
 *  half minute after that costs nothing and brings every open tab back on its
 *  own. */
const STALLED_BACKOFF_MS = 30_000;

/**
 * How far each backoff step is spread, either side of its rung.
 *
 * An outage is never one tab's problem: a restart drops every browser at the
 * same instant, and a ladder with no spread brings them all back in step, in
 * one burst, on every rung. The spread costs a player nothing and turns the
 * burst into an arrival.
 */
const RETRY_JITTER = 0.2;

const jittered = (ms: number) =>
	Math.round(ms * (1 - RETRY_JITTER + Math.random() * 2 * RETRY_JITTER));

/**
 * How long the table has to answer a sent intent before the screen says it has
 * not.
 *
 * A socket that is open is not a server that is listening. `send` resolves when
 * the frame reaches the transport, which is a handoff and not an acknowledgement
 * — so a server that stops answering looks, from here, exactly like a game where
 * nobody has moved. Long enough to cover a slow resolution, short enough to
 * beat the player's own "is it broken?".
 */
const ANSWER_MS = 6000;

/** Intents held while offline. A ceiling rather than a rule about who may call:
 *  the drain already collapses to one per op, so this only exists so a caller
 *  in a loop cannot grow an array forever during a long outage. */
const QUEUE_MAX = 24;

/** Failed connects before the screen is told this is not about to fix itself.
 *
 *  A display threshold and nothing else. It deliberately does NOT change the
 *  backoff: what to say to the player and how hard to keep trying are separate
 *  questions, and answering both with one number is what once turned a
 *  five-second outage into a thirty-second one. */
const REFUSALS_BEFORE_HINT = 3;

const encoder = new TextEncoder();

/** Names each socket on the page's share of the connection. */
let tableSeq = 0;

/** How long a click survives a disconnection before it stops being a statement
 *  about the table. Long enough to cover a laptop waking up or one backoff
 *  step, short enough that nothing is played on your behalf out of a board you
 *  have not looked at since. */
const STALE_INTENT_MS = 5000;

export interface TableEvents {
	/** A resolution landed. The state that produced it is already applied. */
	onEvent?: (res: Resolution) => void;
	onError?: (code: string, message: string) => void;
}

export interface TableOptions extends TableEvents {
	/** Watch instead of playing.
	 *
	 *  A spectator sends exactly one intent — `watch` — and then never sends
	 *  another: the server has not seated them, so every other op would be
	 *  refused for not being at the table. What comes back is the board with the
	 *  fog lifted, which is why the server admits god admins only. */
	spectate?: boolean;
	/** Where this socket's agent comes from.
	 *
	 *  Defaults to the page's one lease, which is the answer for every caller
	 *  today. It is a parameter because the lease is a page singleton with a
	 *  second consumer coming — a live assessment claims the same one — so which
	 *  agent a session holds is a question worth being able to answer per
	 *  session rather than per module. */
	agent?: AgentSource;
}

/** Claims one capability on the page's connection.
 *
 *  Deliberately the exact shape of `subscribe`, so the default is that function
 *  itself rather than a closure wrapping it — a seam whose signature differs
 *  from the thing it stands in for is a seam that tests something else. */
export type AgentSource = (
	capability: string,
	owner: string,
	onFrame: (type: string, payload: Uint8Array) => void,
	onLost: (reason: string, cause: LostCause) => void
) => Promise<ArmornetAgent>;

export class TableSocket {
	/** Everything the UI renders. Null until the first snapshot. */
	view = $state<TableView | null>(null);
	status = $state<Status>('idle');
	/** The last refusal, for the UI to show and then forget. */
	lastError = $state<{ code: string; message: string } | null>(null);
	/**
	 * An intent went out and the table has not answered.
	 *
	 *  The one failure `status` cannot describe. A socket reports that it is
	 *  open, not that anybody is listening on the other end of it — so a server
	 *  that stops answering leaves `status` on `live` forever and the player
	 *  looking at a board that will never move again, with nothing on screen
	 *  admitting it. This is that admission.
	 */
	waiting = $state(false);

	readonly tableID: string;

	#agent: ArmornetAgent | null = null;
	#attempt = 0;
	#closing = false;
	/** An open is in flight. Guards `retry()` racing a pending backoff. */
	#opening = false;
	/** The version and epoch of the view on screen. See #apply. */
	#version = 0;
	#epoch = '';
	/** Closed by the host and finished with. Distinguishes "the socket is down"
	 *  from "this socket is over", so a network wake-up cannot resurrect one the
	 *  page has already let go of. */
	#disposed = false;
	/** Removes the wake-up listeners, when there are any. */
	#unwake: (() => void) | null = null;
	/** This socket's name on the page's agent lease. Unique per instance rather
	 *  than per table: two sockets on the SAME table still cannot share the
	 *  module's callbacks. */
	readonly #claim = `breach:${tableSeq++}`;
	/** True once the server has accepted this connection AND said what is at the
	 *  table. The UI routes clicks here only when it is true — sending an intent
	 *  into a connection that never opened is a click that vanishes with no
	 *  error anywhere.
	 *
	 *  The view is half the condition, not decoration. `status` flips the moment
	 *  the socket opens, which is BEFORE the first snapshot lands, and a click
	 *  routed in that window is a statement about a board this browser has never
	 *  seen. Intents formed in it are queued instead, and drain a moment later
	 *  against the table that actually exists. */
	readonly live = $derived(this.status === 'live' && this.view !== null);

	/** Consecutive refusals. Distinguishes "the connection dropped" from "the
	 *  server refused us", which look identical from a browser but mean
	 *  opposite things. */
	#refusals = 0;
	/** Intents written before the agent connected. A click during a reconnect is
	 *  still a click — but only for a moment, and only once.
	 *
	 *  Both qualifiers are bought with pain. An unbounded replay turns a slow
	 *  connect into a burst: four impatient presses of one button arrive as four
	 *  intents against a table that has since moved on, and the player watches
	 *  four identical refusals scroll past for something they asked for once.
	 *  Stamped so a stale intent can be dropped rather than replayed against a
	 *  board it was never formed against. */
	#queue: Array<{ intent: Intent; attempt: string; at: number }> = [];
	/**
	 * Mints attempt tokens: a random prefix, then a counter.
	 *
	 * The prefix is random rather than the socket's `#claim`, and that is the
	 * whole point. `#claim` counts from zero in module scope, so it restarts on
	 * every page load — while the id the server deduplicates against is
	 * deliberately STABLE across a refresh, because a refresh is meant to be a
	 * non-event. Numbered tokens would therefore replay the same names at a
	 * server that still remembers them, and the first few clicks after every F5
	 * would be answered from the cache: nothing happens, no error, the board
	 * simply does not move.
	 *
	 * A fresh namespace per socket makes a reload a new conversation, which is
	 * what it is.
	 */
	readonly #attemptRun = Math.random().toString(36).slice(2, 10);
	#attemptSeq = 0;
	/**
	 * The last intent sent and the token it went under, until the table answers.
	 *
	 * This is what makes a second click a RESEND rather than a second move. The
	 * controls hand themselves back on a timeout (see `waiting`), so a player on
	 * a slow round-trip clicks again — and both clicks are legitimately in-turn,
	 * because playing a card does not end a turn. Nothing about identity or turn
	 * order can separate them; only sending both under one token can.
	 *
	 * Cleared the moment anything comes back, so the NEXT click is a new move
	 * even if it asks for exactly the same thing. Two deliberate plays of one
	 * card are two moves, and a player who is looking at the result of the first
	 * has already been answered.
	 */
	#inFlight: { key: string; attempt: string } | null = null;
	/** Runs out when a sent intent has gone unanswered. See `waiting`. */
	#answerTimer: ReturnType<typeof setTimeout> | null = null;
	readonly #events: TableEvents;
	/** Watching rather than playing. Fixed at construction: a connection cannot
	 *  become a spectator, or stop being one, without the server re-deciding who
	 *  it is — so it is not something a client gets to toggle. */
	readonly #spectate: boolean;
	/** See TableOptions.agent. */
	readonly #source: AgentSource;

	constructor(tableID: string, options: TableOptions = {}) {
		this.tableID = tableID;
		this.#events = options;
		this.#spectate = options.spectate ?? false;
		this.#source = options.agent ?? subscribe;
	}

	// ── Reads ──────────────────────────────────────────────────────────────────
	/** Watching rather than playing — asked for locally, and CONFIRMED by the
	 *  server, which is the half that matters. A view without `spectating` on it
	 *  is a player's view however this socket was constructed. */
	readonly spectating = $derived(this.view?.spectating ?? false);
	readonly isHost = $derived(this.view?.you_are_host ?? false);
	readonly seat = $derived(
		this.view?.lobby.seats.find((s) => s.id === this.view?.your_seat) ?? null
	);
	readonly present = $derived(this.view?.members.filter((m) => m.present).length ?? 0);
	/** How many clicks are being held for the next connection. */
	get queued(): number {
		return this.#queue.length;
	}

	// ── Lifecycle ──────────────────────────────────────────────────────────────
	connect(): void {
		if (this.#agent) return;
		this.#closing = false;
		this.#listenForWake();
		void this.#open();
	}

	/** The browser knows things the backoff does not.
	 *
	 *  `online` fires when the machine regains a network, and a tab becoming
	 *  visible is usually a laptop lid that just opened. Both mean the reason we
	 *  were waiting has probably just gone away — and sitting out the rest of a
	 *  thirty-second timer after being TOLD that is the difference between a
	 *  game that comes back when you do and one that comes back half a minute
	 *  later.
	 *
	 *  It only ever shortens a wait. A pending timer is left alone rather than
	 *  cancelled, because `#opening` already makes the loser of that race a
	 *  no-op, and a cancelled timer would need replacing if this attempt failed
	 *  too. */
	#listenForWake(): void {
		if (this.#unwake || typeof window === 'undefined') return;

		const wake = () => {
			// Not while it is working, not while an attempt is in flight, and
			// never for a socket the host has finished with.
			if (this.#disposed || this.#closing || this.#opening || this.#agent) return;
			// Back to the top of the ladder: this is a new situation, not the
			// continuation of the one we were backing off from.
			this.#attempt = 0;
			void this.#open();
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') wake();
		};

		window.addEventListener('online', wake);
		document.addEventListener('visibilitychange', onVisible);
		this.#unwake = () => {
			window.removeEventListener('online', wake);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}

	/** Stops listening for a network wake-up. */
	#stopListening(): void {
		this.#unwake?.();
		this.#unwake = null;
	}

	close(): void {
		this.#closing = true;
		this.#disposed = true;
		this.#stopListening();
		// Disposed, not dropped: there is nothing left to retry with, so the
		// token goes too.
		this.#answered();
		const agent = this.#agent;
		this.#agent = null;
		this.status = 'closed';
		unsubscribe(CAP_BREACH, this.#claim);
		void agent?.close();
	}

	async #open(): Promise<void> {
		// One attempt at a time. `retry()` can be pressed while a backoff timer
		// is still pending, and two overlapping opens would leave the loser's
		// agent wired to callbacks nobody owns.
		if (this.#opening || this.#agent) return;
		this.#opening = true;
		this.status = this.#attempt === 0 ? 'connecting' : 'reconnecting';

		try {
			// The connection is the page's, opened once for every capability it
			// speaks; this only claims breach's share of it. The table id is no
			// longer part of the handshake — it rides on every intent instead,
			// because one connection now carries sessions the handshake cannot
			// name.
			const agent = await this.#source(
				CAP_BREACH,
				this.#claim,
				(type, payload) => this.#frame(type, payload),
				(why, cause) => this.#lost(why, cause)
			);
			if (this.#closing) return;
			this.#agent = agent;
			// Deliberately NOT `agent.onClose = …`. The agent is the page's one
			// shared object and the registry owns that slot; assigning it here
			// overwrote the registry's own handler, so a close reached nobody
			// else, the registry never cleared its state, and the next connect
			// handed back a promise holding a dead agent. A close arrives
			// through `onLost` with cause `closed` instead.

			this.#attempt = 0;
			this.#refusals = 0;
			this.status = 'live';
			// Say who is here, and get back what is true.
			//
			// Both branches are the same idea: the transport treats the first
			// intent as the arrival, so a client that sends nothing is a client the
			// server has never seated and whose screen keeps showing whatever it
			// last believed. That is not a cosmetic drift — a browser rendering its
			// own local seating for a table the server had never seated it at let
			// `fill empty seats` fill the chair the player was apparently sitting
			// in. Re-sent on every reconnect, deliberately: the membership and the
			// subscription both live on the connection that was just replaced.
			// Untokened, deliberately. This one is MEANT to run again on every
			// reconnect — it re-announces the member and re-subscribes the
			// connection — so deduplicating it would leave a resumed socket
			// unsubscribed and staring at a board nobody is sending it.
			void this.#write({ op: this.#spectate ? 'watch' : 'sync' }, '');
			for (const q of this.#drainQueue()) void this.#write(q.intent, q.attempt);
		} catch (err) {
			this.#agent = null;
			if (this.#closing) return;
			this.#refused(err instanceof Error ? err.message : String(err));
		} finally {
			this.#opening = false;
		}
	}

	/** One inbound frame on the breach capability.
	 *
	 *  The module hands over bytes and a type and decodes nothing, so the switch
	 *  that used to live in three separate callbacks lives here — which is what
	 *  lets a second capability exist without the module growing a third. */
	#frame(type: string, payload: Uint8Array): void {
		switch (type) {
			case 'snapshot':
				this.#apply(decodePayload<{ view: TableView }>(payload).view);
				return;
			case 'event': {
				const frame = decodePayload<{ view: TableView; res: Resolution }>(payload);
				// State first, then the beat — the board animates FROM the new
				// truth, and a client that ignores the animation is still correct.
				//
				// The beat is played only if the state came with it. A resolution
				// belonging to a view we have already moved past is an animation
				// of something that has since been overtaken.
				if (!this.#apply(frame.view)) return;
				if (frame.res) this.#events.onEvent?.(frame.res);
				return;
			}
			case 'error': {
				const { code, message } = decodePayload<{ code: string; message: string }>(payload);
				// A refusal is an answer. The watchdog asks whether anybody is on
				// the other end, and "no" is a reply from somebody — and it
				// finishes the move, so the next click is a new one.
				this.#answered();
				this.lastError = { code: code || 'illegal', message };
				this.#events.onError?.(this.lastError.code, this.lastError.message);
				return;
			}
			default:
				// An unknown type is a server that has moved on. Ignoring it is
				// correct: every frame this protocol sends carries whole state, so
				// the next one this client understands repairs whatever it missed.
				return;
		}
	}

	/** The page's breach capability went to somebody else, or the connection
	 *  closed under it. */
	#lost(why: string, cause: LostCause): void {
		this.#agent = null;
		this.#stopExpecting();
		// A dropped socket is the ordinary case, and coming back is the entire
		// point of the ladder. Only a DISPLACEMENT is terminal.
		//
		// One callback, two situations, opposite answers. Treating a close as an
		// eviction leaves a player staring at "another session took the
		// connection" because a server restarted; treating an eviction as a
		// close makes two sessions trade the capability forever.
		if (cause === 'closed') {
			if (this.#closing) return;
			this.#retry(why);
			return;
		}
		this.#closing = true;
		// Stop listening, or the next time the network blinks this socket would
		// wake up and take the capability straight back off the session that
		// just won it — the two would trade it every time the wifi twitched.
		this.#stopListening();
		this.status = 'closed';
		this.lastError = { code: 'evicted', message: why };
		this.#events.onError?.(this.lastError.code, this.lastError.message);
	}

	/** Takes a view if it is newer than the one on screen.
	 *
	 *  Views are built per recipient, and the server releases the table's lock
	 *  between applying a move and reading the table to broadcast it — so two
	 *  moves in flight can be BUILT in one order and arrive in the other. A
	 *  60Hz game would paper over that within a frame. Here the next view may be
	 *  minutes away, so an older one accepted second sits on screen until
	 *  somebody moves again, showing a board that has already been played past.
	 *
	 *  Epoch is the reset. The registry is in memory: a restart, or a swept and
	 *  reopened table, means a new counter starting at zero, and a client still
	 *  holding a version from the old one would refuse every frame the new table
	 *  sent — the same freeze, arrived at from the other direction.
	 *
	 *  Returns whether the view was taken. */
	#apply(view: TableView | undefined): boolean {
		if (!view) return false;
		// Any view at all is the table answering — including one this socket then
		// refuses as stale. Somebody is on the other end, which is the only thing
		// the watchdog was asking.
		//
		// It also ends the in-flight move, and that is coarser than it should be:
		// a view built for somebody ELSE's turn clears a token this client is
		// still waiting on, so a retry after that point mints a new one. Closing
		// it properly needs the server to echo the attempt back on the frame it
		// answers with, so a client can tell its own answer from the table's
		// weather. Until then this is the safe side of the trade — a token held
		// too briefly costs a double-play only when two things go wrong at once,
		// while a token held too long would swallow moves routinely.
		this.#answered();
		if (view.epoch !== this.#epoch) {
			this.#epoch = view.epoch;
			this.#version = view.version;
			this.view = view;
			return true;
		}
		// Not `<`: a repeat of the version we already hold is the same state, so
		// re-rendering it is work with no answer attached.
		if (view.version <= this.#version) return false;
		this.#version = view.version;
		this.view = view;
		return true;
	}

	/** A connection that never opened may have been refused, or the server may
	 *  simply be gone — and a browser cannot tell those apart. The WebSocket API
	 *  reports a failed handshake with no status code, on purpose, so a 403 from
	 *  the origin check and a machine that is not listening arrive here as the
	 *  same error.
	 *
	 *  So this never gives up. It slows down and says so.
	 *
	 *  Giving up on the third failure — which is what it used to do, roughly
	 *  three seconds in — meant a rolling deploy killed every open tab
	 *  permanently, and the only cure was a player thinking to reload the page. */
	#refused(detail: string): void {
		this.#refusals++;
		if (this.#refusals === REFUSALS_BEFORE_HINT) {
			this.lastError = {
				code: 'unreachable',
				message:
					'cannot reach this table — the server may be restarting, or your session may have expired. still trying'
			};
			this.#events.onError?.(this.lastError.code, this.lastError.message);
		}
		this.#retry(detail);
	}

	/** Ask again now instead of waiting out the backoff.
	 *
	 *  Once the retry interval has stretched to half a minute, a player who can
	 *  see the server is back should not have to sit through the rest of it. */
	retry(): void {
		if (this.#disposed) return;
		this.#attempt = 0;
		this.#refusals = 0;
		this.lastError = null;
		this.#closing = false;
		// An eviction stopped listening; asking again is asking to be woken
		// again.
		this.#listenForWake();
		void this.#open();
	}

	#retry(_why: string): void {
		this.status = 'reconnecting';
		// The whole ladder first, and only then the ceiling.
		//
		// Parking early is a trap worth naming: telling the SCREEN this looks
		// like an outage and telling the SOCKET to slow down are different
		// decisions, and tying them together meant three failures — 3.3 seconds
		// — jumped straight to a thirty-second wait. The last two rungs were
		// unreachable, and a server that was down for five seconds cost the
		// player thirty. The hint still shows at three; the backoff keeps its
		// own counsel until the ladder runs out, at ~15s.
		this.#stopExpecting();
		const attempt = this.#attempt++;
		const rung = attempt < BACKOFF_MS.length ? BACKOFF_MS[attempt] : STALLED_BACKOFF_MS;
		const delay = jittered(rung);
		setTimeout(() => {
			if (!this.#closing) void this.#open();
		}, delay);
	}

	// ── Writes ─────────────────────────────────────────────────────────────────
	// Thin by design. Each is one intent, and the server's answer is a new view.

	send(intent: Intent): void {
		const attempt = this.#attemptFor(intent);
		if (this.#agent && this.status === 'live') {
			void this.#write(intent, attempt);
			return;
		}
		// Oldest out first: what a player asked for most recently is the thing
		// they still mean, and the drain would have dropped the rest anyway.
		if (this.#queue.length >= QUEUE_MAX) this.#queue.shift();
		this.#queue.push({ intent, attempt, at: Date.now() });
	}

	/**
	 * The token this intent travels under.
	 *
	 * Identical to the one still in flight when the intent is identical, and new
	 * otherwise. "Identical" is every field a player chose — the same card at the
	 * same building is the same click; the same card at a DIFFERENT building is a
	 * different one, and must not be swallowed.
	 */
	#attemptFor(intent: Intent): string {
		const key = JSON.stringify(intent);
		if (this.#inFlight?.key === key) return this.#inFlight.attempt;
		const attempt = `${this.#attemptRun}/${++this.#attemptSeq}`;
		this.#inFlight = { key, attempt };
		return attempt;
	}

	/** Start the clock on an answer. Every intent is answered with a view — that
	 *  is the whole protocol — so silence is always a fault, never a turn nobody
	 *  has taken yet. */
	#expectAnswer(): void {
		this.#stopExpecting();
		this.#answerTimer = setTimeout(() => {
			this.#answerTimer = null;
			// Only while the socket still claims to be up. Once it does not, the
			// banner is already saying something truer than this would.
			if (!this.#closing && this.status === 'live') this.waiting = true;
		}, ANSWER_MS);
	}

	/** Stop waiting for an answer. Says nothing about whether one arrived — this
	 *  is also how `#expectAnswer` resets the clock before each send. */
	#stopExpecting(): void {
		if (this.#answerTimer) clearTimeout(this.#answerTimer);
		this.#answerTimer = null;
		this.waiting = false;
	}

	/**
	 * The table answered.
	 *
	 * Separate from `#stopExpecting` for a reason worth stating, because
	 * collapsing the two is exactly the bug this had: `#expectAnswer` calls
	 * `#stopExpecting` as its timer reset, and `#write` calls `#expectAnswer`
	 * after its `await` — so a token cleared in there survives one microtask
	 * rather than one round trip, and every retry carries a fresh one. The
	 * deduplication then never fires, which is the whole mechanism gone while
	 * looking present.
	 *
	 * A DROP is not an answer either, deliberately. If the socket dies with a
	 * move outstanding, the retry must reuse its token: reusing one the server
	 * already took is harmless — it replies with the recorded result and the
	 * player sees the right outcome — whereas minting a new one plays the move
	 * twice.
	 */
	#answered(): void {
		this.#stopExpecting();
		this.#inFlight = null;
	}

	/**
	 * What of the queue is still worth sending.
	 *
	 *  Two rules, and both exist because an intent is a statement about a board
	 *  the client could see at the time:
	 *
	 *  - one per op. Pressing a button four times is one intention, not four,
	 *    and the server answers each one separately — so the extras can only
	 *    ever arrive as duplicate refusals.
	 *  - and only if it is fresh. After a long reconnect the table has been
	 *    played on by three other people; a `start` formed against the lobby you
	 *    remember is not a statement about the lobby that exists. Dropping it is
	 *    better than firing it, because the snapshot that lands a moment later
	 *    shows the truth and the player can ask again.
	 */
	#drainQueue(): Array<{ intent: Intent; attempt: string }> {
		const queued = this.#queue.splice(0);
		const fresh = queued.filter((q) => Date.now() - q.at <= STALE_INTENT_MS);
		// Last of each op wins: it is the one the player most recently meant. It
		// keeps the token it was queued under, so a reconnect that replays it
		// alongside a copy the server already took is answered rather than run
		// twice.
		const latest = new Map<Intent['op'], { intent: Intent; attempt: string }>();
		for (const q of fresh) latest.set(q.intent.op, { intent: q.intent, attempt: q.attempt });
		return [...latest.values()];
	}

	takeSeat(seatID: string) {
		this.send({ op: 'take_seat', seat_id: seatID });
	}
	leaveSeat() {
		this.send({ op: 'leave_seat' });
	}
	setReady(ready: boolean) {
		this.send({ op: ready ? 'ready' : 'unready' });
	}
	setMode(mode: Intent['mode']) {
		this.send({ op: 'set_mode', mode });
	}
	fillAI() {
		this.send({ op: 'fill_ai' });
	}
	choose(klassKey: string) {
		this.send({ op: 'choose', klass_key: klassKey });
	}
	start() {
		this.send({ op: 'start' });
	}
	commit(cardKey: string, siteID: string) {
		this.send({ op: 'commit', card_key: cardKey, site_id: siteID });
	}
	endTurn() {
		this.send({ op: 'end_turn' });
	}
	newMatch() {
		this.send({ op: 'new_match' });
	}

	async #write(intent: Intent, attempt: string): Promise<void> {
		try {
			await this.#agent?.send(
				CAP_BREACH,
				'intent',
				// `attempt` rides the envelope beside `table_id`, never inside the
				// intent: whether a delivery is a repeat is a fact about this
				// socket, and the rules have no field for it.
				encoder.encode(JSON.stringify({ table_id: this.tableID, intent, attempt }))
			);
			// Sent is not answered. `send` resolves when the transport has the
			// frame, so this is the only place that can notice a server which
			// took the intent and said nothing back.
			this.#expectAnswer();
		} catch (err) {
			// The agent refuses an undeclared capability or a dead connection
			// locally, which is a real refusal and belongs on screen rather than
			// in the console.
			this.lastError = { code: 'illegal', message: err instanceof Error ? err.message : String(err) };
			this.#events.onError?.(this.lastError.code, this.lastError.message);
		}
	}
}

/** The table this page was opened for, if it was opened from a link. */
export function tableFromLocation(): string | null {
	return new URLSearchParams(location.search).get(INVITE_PARAM);
}
