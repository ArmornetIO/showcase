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
 *  a connection nobody is answering will never notice on its own. */
export interface SocketNotice extends Notice {
	kind: 'connection';
	retryable: boolean;
}

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

	return {
		kind: 'connection',
		// Two different sentences. "Reconnecting" is a promise that this is about
		// to resolve itself, and after enough failures that promise stops being
		// honest: the socket parks on a long interval, and a player deserves to be
		// told they are waiting on something rather than watching a spinner.
		text: mute
			? 'the table has not answered'
			: fault
				? fault.message
				: socket.status === 'connecting'
					? 'connecting to the table'
					: 'reconnecting',
		detail: mute
			? 'your move may not have landed'
			: fault
				? undefined
				: 'the board you are looking at may be out of date',
		tone: fault ? '#FB7185' : '#FBBF24',
		retryable: !!fault || mute
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
