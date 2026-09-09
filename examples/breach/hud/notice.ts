// ── What the bar is saying right now ─────────────────────────────────────────
// The breech's centre column is the one surface that answers "what is going on
// this round". It already said whose turn it is and why a move will not fire;
// a dropped connection and a refused move are the same kind of sentence, so
// they belong in the same two rows rather than in floating panels of their own.
//
// One priority ladder, first match wins, because the rows can only hold one
// thing and "which one" must not be decided by markup order in three separate
// `{#if}` blocks.
//
// The connection rung lives in `socketNotice` below, which `ConnectionBanner`
// also calls. Two surfaces say this — the in-match card and the lobby's banner —
// and they are on screen at different times, so a drift between them would only
// ever be seen by someone who had already lost their connection once.
import type { TableSocket } from '../net.svelte.js';
import type { BreachMatch } from '../internal/match.svelte.js';

export interface Notice {
	/** Drives the icon and the colour; the bar does not re-derive either. */
	kind: 'over' | 'connection' | 'refusal';
	text: string;
	/** The quiet second line, when there is one worth saying. */
	detail?: string;
	tone: string;
}

/** What the banner needs on top of a `Notice`: whether offering a button would
 *  do anything. Nothing is going to happen without one when an eviction never
 *  retries itself, a stalled socket is half a minute from its next attempt, or
 *  a connection nobody is answering will never notice on its own — and nothing
 *  is going to happen WITH one when the table being asked for does not exist. */
export interface SocketNotice extends Notice {
	kind: 'connection';
	retryable: boolean;
}

/**
 * A refusal about the TABLE rather than about a move.
 *
 * These arrive on a socket that is open and healthy: the server answered, and
 * the answer was "not here". That is precisely what made them invisible — the
 * connection is up, `status` is 'live', and the only thing missing is the view
 * this banner reads, so the refusal fell through to "reconnecting" and promised
 * a recovery that was never coming. A table is process memory, so a link that
 * outlived the process is refused identically forever, and a player watching a
 * reconnect spinner has no reason to ever stop watching it.
 *
 * Keyed by CODE and not by "no view has arrived yet", because a click queued
 * during the opening dial is refused in that same window — and telling somebody
 * their table is gone over a mistimed press sends them off to ask for a link
 * they are already holding.
 */
const TABLE_FAULTS: Record<string, { text: string; detail: string; retryable: boolean }> = {
	no_table: {
		text: 'this table is gone',
		// Not a malformed link: it was a good one, to something since reaped or
		// lost with the process it lived in. Saying so is the difference between
		// a player asking for a new link and a player reloading forever.
		detail: 'a table lasts only while somebody is at it — ask for a fresh link',
		retryable: false
	},
	table_full: {
		text: 'this table is full',
		detail: 'every seat is taken — one may open if somebody leaves',
		retryable: true
	}
};

/**
 * The socket, in a sentence — or null when there is nothing to say.
 *
 * A local game has no socket and nothing to report. Neither does a healthy one:
 * this is silent until it is not. `waiting` is the second kind of "not" — a
 * socket reports that it is OPEN, never that anybody is answering on it, which
 * is the one failure `live` calls healthy.
 */
export function socketNotice(socket: TableSocket | null): SocketNotice | null {
	if (!socket || (socket.live && !socket.waiting)) return null;

	const mute = socket.live && socket.waiting;

	// Only connection-level failures belong here. A refused move also lands in
	// `lastError`, and letting that speak for the socket would put "not your
	// turn" where "you are disconnected" should be.
	const fault =
		socket.lastError && ['unreachable', 'evicted'].includes(socket.lastError.code)
			? socket.lastError
			: null;

	// Outranks both. A dead table is not a transport problem and will not become
	// one; it is the answer, and it is the only rung here that tells a player to
	// do something other than wait.
	const table = socket.lastError ? (TABLE_FAULTS[socket.lastError.code] ?? null) : null;

	return {
		kind: 'connection',
		// Two different sentences. "Reconnecting" is a promise that this is about
		// to resolve itself, and after enough failures that promise stops being
		// honest: the socket parks on a long interval, and a player deserves to be
		// told they are waiting on something rather than watching a spinner.
		text: table
			? table.text
			: mute
				? 'the table has not answered'
				: fault
					? fault.message
					: socket.status === 'connecting'
						? 'connecting to the table'
						: 'reconnecting',
		detail: table
			? table.detail
			: mute
				? 'your move may not have landed'
				: fault
					? undefined
					: 'the board you are looking at may be out of date',
		tone: table || fault ? '#FB7185' : '#FBBF24',
		retryable: table ? table.retryable : !!fault || mute
	};
}

export function noticeFor(
	match: BreachMatch,
	socket: TableSocket | null,
	refusal: string | null
): Notice | null {
	if (match.winner) {
		const won = match.winner === match.seat.faction;
		return {
			kind: 'over',
			text: won ? 'you take it' : 'you lose it',
			detail: won
				? 'the payload landed before the horizon'
				: 'the horizon passed with the chain unfinished',
			tone: won ? '#34D399' : '#EF4444'
		};
	}

	// Outranks a refusal: a move rejected because the table never heard it is
	// not the same story as one the table considered and declined.
	const dropped = socketNotice(socket);
	if (dropped) return dropped;

	if (refusal) return { kind: 'refusal', text: refusal, tone: '#FB7185' };

	return null;
}
