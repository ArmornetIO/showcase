// ── Reconnection ─────────────────────────────────────────────────────────────
// Three properties, all of which have been wrong at some point and none of
// which is visible without a stopwatch.
//
// Named net.spec.ts, NOT net.svelte.spec.ts: the second name routes to the
// browser vitest project and launches Chromium. This runs in Node.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The globals must exist BEFORE the module is imported and before any socket is
// constructed: #listenForWake early-returns on `typeof window === 'undefined'`,
// and agentLineURL() reads `location` while building the argument to connect().
vi.stubGlobal('window', new EventTarget());
vi.stubGlobal(
	'document',
	Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState })
);
vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:8080' });

const { TableSocket } = await import('./net.svelte.js');
type Socket = InstanceType<typeof TableSocket>;
type TableView = import('./net.svelte.js').TableView;
type ArmornetAgent = import('showcase').ArmornetAgent;

/** A source that connects, and hands back the agent so a test can answer — or
 *  deliberately not answer — the intents written into it.
 *
 *  The frame handler is captured from `subscribe`'s signature rather than set on
 *  the agent: the module hands bytes to whoever subscribed to the capability,
 *  and nothing is a property on the agent any more. */
function liveSource() {
	const sent: Uint8Array[] = [];
	let deliver: ((type: string, payload: Uint8Array) => void) | null = null;
	const agent = {
		version: 'test',
		connect: () => Promise.resolve({ capabilities: ['io.armornet.breach'] }),
		send: (_cap: string, _type: string, payload: Uint8Array) => {
			sent.push(payload);
			return Promise.resolve();
		},
		on: () => Promise.resolve(),
		off: () => Promise.resolve(),
		close: () => Promise.resolve()
	} as ArmornetAgent;
	/** What the server would have sent back. */
	const answer = (view: Partial<TableView>) =>
		deliver?.(
			'snapshot',
			new TextEncoder().encode(JSON.stringify({ view: { epoch: 'e1', version: 1, ...view } }))
		);
	// The same signature `subscribe` has, so the socket hands its frame handler
	// straight in and `answer` can drive it — exactly as the module would.
	let drop: ((reason: string, cause: 'displaced' | 'closed') => void) | null = null;
	const source = (
		_capability: string,
		_owner: string,
		onFrame: (type: string, payload: Uint8Array) => void,
		onLost: (reason: string, cause: 'displaced' | 'closed') => void
	) => {
		deliver = onFrame;
		drop = onLost;
		return Promise.resolve(agent);
	};
	/** The connection going away under the socket, as the module would report it. */
	const lose = (cause: 'displaced' | 'closed') => drop?.('gone', cause);
	return { source, agent, sent, answer, lose };
}

/** A source that never connects, recording when each attempt was made. */
function failingSource() {
	const at: number[] = [];
	const source = () => {
		at.push(Date.now());
		return Promise.reject(new Error('nothing is listening'));
	};
	/** Milliseconds between consecutive attempts. */
	const gaps = () => at.slice(1).map((t, i) => t - at[i]);
	return { source, at, gaps };
}

/** Lets the fire-and-forget first attempt settle. */
const settle = () => vi.advanceTimersByTimeAsync(0);

/**
 * Walks the retry schedule, letting each attempt fail.
 *
 * `advanceTimersByTimeAsync` rather than the synchronous form, and this is not
 * a style choice: #open() is async, so its rejection → #refused → #retry chain
 * is a promise continuation. Advancing synchronously never flushes it and the
 * next rung is never scheduled, so the test would sit on one attempt forever.
 */
async function walk(steps: number) {
	// To the NEXT timer, not a fixed 31s. A fixed advance long enough to clear
	// the ceiling also clears every rung below it: one 31s step fired 400, 900,
	// 2000, 4000 and 8000 in a single call, because each failure schedules the
	// next one inside the same window. `walk(6)` then meant ten attempts, and
	// the two tests that count rungs were measuring something else entirely.
	for (let i = 0; i < steps; i++) await vi.advanceTimersToNextTimerAsync();
}

describe('TableSocket reconnection', () => {
	let socket: Socket | null = null;

	beforeEach(() => {
		vi.useFakeTimers();
		// The ladder is spread ±20% so a restart does not bring every tab back in
		// one burst. Pinned to the middle of that spread here rather than widened
		// into tolerances: these tests are about WHICH rung is used, and a range
		// wide enough to hold the jitter is wide enough to hide a wrong rung.
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
	});
	afterEach(() => {
		socket?.close();
		socket = null;
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	// The regression this was written for. The delays used to be capped by the
	// same counter that drove the on-screen hint, so the ladder stopped at its
	// third rung — 4000 and 8000 were unreachable — and a server down for five
	// seconds cost the player thirty.
	it('walks the whole ladder before parking at the ceiling', async () => {
		const { source, gaps } = failingSource();
		socket = new TableSocket('T1', { agent: source });
		socket.connect();
		await settle();
		await walk(6);

		expect(gaps()).toEqual([400, 900, 2000, 4000, 8000, 30_000]);
	});

	// The other side of the same regression: the hint is a display threshold and
	// must not touch timing. If these two are ever collapsed into one counter
	// again, this fails on the delay while the first test fails on the ladder.
	it('shows the hint without changing the backoff', async () => {
		const { source, gaps } = failingSource();
		socket = new TableSocket('T1', { agent: source });
		socket.connect();
		await settle();

		// `connect()` IS the first attempt, so settling it is already refusal
		// one. The hint is due on the third.
		expect(socket.lastError).toBeNull();

		await walk(1);
		expect(socket.lastError).toBeNull();

		await walk(1);
		expect(socket.lastError?.code).toBe('unreachable');

		// The rungs AFTER the hint are still the ladder's, not the ceiling's —
		// which is the whole regression: a hint that shortens the ladder costs a
		// player thirty seconds for a five-second outage.
		await walk(2);
		expect(gaps()).toEqual([400, 900, 2000, 4000]);
	});

	// A restart drops every open tab at the same instant. Without a spread they
	// all come back on the same millisecond, on every rung.
	it('spreads each retry either side of its rung', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
		const { source, gaps } = failingSource();
		socket = new TableSocket('T1', { agent: source });
		socket.connect();
		await settle();
		await walk(2);

		// The bottom of the spread: each rung itself, less 20%.
		expect(gaps().slice(0, 2)).toEqual([320, 720]);
	});

	// The failure a socket cannot report about itself. `status` says the
	// connection is open; it never says anybody is answering on it.
	it('says so when the table takes an intent and never answers', async () => {
		const { source } = liveSource();
		socket = new TableSocket('T1', { agent: source });
		socket.connect();
		await settle();

		socket.send({ op: 'end_turn' });
		await settle();
		expect(socket.waiting).toBe(false);

		await vi.advanceTimersByTimeAsync(6500);
		expect(socket.waiting).toBe(true);
	});

	it('stops saying so the moment a view arrives', async () => {
		const { source, answer } = liveSource();
		socket = new TableSocket('T1', { agent: source });
		socket.connect();
		await settle();

		socket.send({ op: 'end_turn' });
		await vi.advanceTimersByTimeAsync(6500);
		expect(socket.waiting).toBe(true);

		answer({ version: 2 });
		expect(socket.waiting).toBe(false);
	});

	// Not a rule about who may call `send` — the drain already collapses the
	// queue to one per op. A ceiling so a caller in a loop cannot grow an array
	// for the length of an outage.
	it('caps what it holds while offline', () => {
		const { source } = failingSource();
		socket = new TableSocket('T1', { agent: source });
		for (let i = 0; i < 200; i++) socket.send({ op: 'end_turn' });

		expect(socket.queued).toBeLessThanOrEqual(24);
	});

	// The destructive one. An evicted socket that still listened would take the
	// agent back off the session that just won it the next time the network
	// blinked, and the two would trade it every time the wifi twitched.
	it('does not wake an evicted socket', async () => {
		// Collected rather than assigned to a `let`: a variable only ever written
		// inside a callback is still `null` as far as the checker walks the code,
		// and calling it is then a call on `never`.
		const evict: Array<(takenBy: string, cause: 'displaced' | 'closed') => void> = [];
		const claims: number[] = [];
		socket = new TableSocket('T1', {
			agent: (_capability, _owner, _onFrame, onLost) => {
				claims.push(Date.now());
				evict.push(onLost);
				return Promise.reject(new Error('nothing is listening'));
			}
		});
		socket.connect();
		await settle();

		const before = claims.length;
		evict[0]?.('breach:99', 'displaced');
		window.dispatchEvent(new Event('online'));
		await settle();

		expect(claims.length).toBe(before);
		expect(socket.lastError?.code).toBe('evicted');
	});

	// The other half of that callback, and the opposite answer.
	//
	// A dropped socket and a stolen capability arrive through ONE callback, so
	// a socket that cannot tell them apart has to be wrong about one of them.
	// This was wrong about this one: a close was treated as an eviction, which
	// parked the socket permanently and told the player another session had
	// taken the connection — for a server that had merely restarted.
	it('reconnects when the connection closes, rather than parking', async () => {
		const lost: Array<(reason: string, cause: 'displaced' | 'closed') => void> = [];
		const claims: number[] = [];
		socket = new TableSocket('T1', {
			agent: (_capability, _owner, _onFrame, onLost) => {
				claims.push(Date.now());
				lost.push(onLost);
				return Promise.reject(new Error('nothing is listening'));
			}
		});
		socket.connect();
		await settle();

		const before = claims.length;
		lost[0]?.('the socket closed', 'closed');
		await vi.advanceTimersByTimeAsync(2000);

		expect(claims.length).toBeGreaterThan(before);
		expect(socket.lastError?.code).not.toBe('evicted');
	});

	// The browser knows the network came back before the timer does. Without
	// this the player waits out the rest of a thirty-second park for a machine
	// that is already online.
	it('reconnects immediately when the network returns', async () => {
		const { source, at } = failingSource();
		socket = new TableSocket('T1', { agent: source });
		socket.connect();
		await settle();
		await walk(6); // parked on the 30s ceiling

		const before = at.length;
		window.dispatchEvent(new Event('online'));
		await settle(); // no timer advance at all

		expect(at.length).toBe(before + 1);
	});

	// A socket the page has let go of stays gone. Resurrecting one would leave
	// a connection nobody owns holding the page's single agent lease.
	it('does not resurrect a closed socket', async () => {
		const { source, at } = failingSource();
		socket = new TableSocket('T1', { agent: source });
		socket.connect();
		await settle();

		socket.close();
		const before = at.length;
		window.dispatchEvent(new Event('online'));
		await settle();

		expect(at.length).toBe(before);
		expect(socket.status).toBe('closed');
	});
});

// ── Attempt tokens ───────────────────────────────────────────────────────────
// A resend must not be a second move.
//
// The controls hand themselves back on a timeout, so a player on a slow
// round-trip clicks again — and both clicks are legitimately in-turn, because
// playing a card does not end a turn. Nothing about identity or turn order can
// separate them; only sending both under one token can.

/** The parsed envelopes a source has been handed. */
const envelopes = (sent: Uint8Array[]) =>
	sent.map((p) => JSON.parse(new TextDecoder().decode(p)) as {
		intent: { op: string };
		attempt?: string;
	});

describe('TableSocket attempt tokens', () => {
	let socket: Socket | null = null;

	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		socket?.close();
		socket = null;
		vi.useRealTimers();
	});

	/** A live socket that has been told what is at the table. */
	async function liveSocket() {
		const src = liveSource();
		const s = new TableSocket('T1', { agent: src.source });
		s.connect();
		await settle();
		src.answer({});
		await settle();
		src.sent.length = 0; // drop the sync that opened the connection
		return { socket: s, ...src };
	}

	// The real shape of the bug: the controls hand themselves back after ~5s and
	// the player clicks again. Both clicks are legitimately in-turn, so only one
	// token can separate them.
	//
	// The waits are the test. An earlier version fired both commits as adjacent
	// synchronous statements, and it passed for a reason that had nothing to do
	// with the mechanism — `#write` had not yet resumed past its `await`, so the
	// code that used to destroy the token had not run. It reported green while
	// deduplication was dead in every real click.
	it('sends the same token for an identical click the table has not answered', async () => {
		const t = await liveSocket();
		socket = t.socket;

		t.socket.commit('lotl', 'forum');
		await settle();
		await vi.advanceTimersByTimeAsync(6000);
		t.socket.commit('lotl', 'forum');
		await settle();

		const [first, second] = envelopes(t.sent);
		expect(first.attempt).toBeTruthy();
		expect(second.attempt).toBe(first.attempt);
	});

	it('sends a new token once the table has answered', async () => {
		const t = await liveSocket();
		socket = t.socket;

		t.socket.commit('lotl', 'forum');
		await settle();
		// Version 2, not 1: `liveSocket` already applied version 1, and a repeat
		// is rejected as stale. Answering with the same number would leave this
		// asserting nothing about answers.
		t.answer({ version: 2 });
		await settle();
		t.socket.commit('lotl', 'forum');
		await settle();

		const [first, second] = envelopes(t.sent);
		expect(first.attempt).toBeTruthy();
		expect(second.attempt).not.toBe(first.attempt);
	});

	// A drop is not an answer. Reusing a token the server already took is
	// harmless — it replies with the recorded result — while minting a fresh one
	// plays the move a second time.
	it('keeps the token across a dropped connection', async () => {
		const t = await liveSocket();
		socket = t.socket;

		t.socket.commit('lotl', 'forum');
		await settle();
		const [first] = envelopes(t.sent);

		t.lose('closed');
		await settle();
		await walk(2); // let the backoff reconnect

		t.socket.commit('lotl', 'forum');
		await settle();

		const resent = envelopes(t.sent).filter((e) => e.intent.op === 'commit');
		expect(resent.length).toBeGreaterThan(1);
		expect(resent[resent.length - 1].attempt).toBe(first.attempt);
	});

	// The same card at a different building is a different click, and must not
	// be swallowed by the one still in flight.
	it('sends a new token when any field of the intent differs', async () => {
		const t = await liveSocket();
		socket = t.socket;

		t.socket.commit('lotl', 'forum');
		t.socket.commit('lotl', 'archive');

		const [first, second] = envelopes(t.sent);
		expect(second.attempt).not.toBe(first.attempt);
	});

	// Re-announcing on reconnect is meant to run every time: deduplicating it
	// would leave a resumed socket unsubscribed.
	it('sends the reconnect announce untokened', async () => {
		const src = liveSource();
		socket = new TableSocket('T1', { agent: src.source });
		socket.connect();
		await settle();

		const [announce] = envelopes(src.sent);
		expect(announce.intent.op).toBe('sync');
		expect(announce.attempt).toBeFalsy();
	});
});
