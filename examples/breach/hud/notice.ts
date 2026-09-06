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
// NOTE FOR WHOEVER LANDS THIS: the connection wording below mirrors the ladder
// inside `ConnectionBanner.svelte`. It is duplicated HERE, in the mockup, on
// purpose — the mockup does not get to edit the game. If this design wins, the
// derivation should be lifted out of that component into one exported helper
// that both the banner and this bar call, NOT copied a second time.
import type { TableSocket } from '$examples/breach/net.svelte.js';
import type { BreachMatch } from '$examples/breach/internal/match.svelte.js';

export interface Notice {
	/** Drives the icon and the colour; the bar does not re-derive either. */
	kind: 'over' | 'connection' | 'refusal';
	text: string;
	/** The quiet second line, when there is one worth saying. */
	detail?: string;
	tone: string;
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

	// A local game has no socket and nothing to report. Neither does a healthy
	// one — this is silent until it is not. `waiting` is the second kind of
	// "not": a socket reports that it is open, never that anybody is answering
	// on it, which is the one failure `live` calls healthy.
	if (socket && (!socket.live || socket.waiting)) {
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
			tone: fault ? '#FB7185' : '#FBBF24'
		};
	}

	if (refusal) return { kind: 'refusal', text: refusal, tone: '#FB7185' };

	return null;
}
