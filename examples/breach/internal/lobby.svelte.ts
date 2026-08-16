// ── The lobby ────────────────────────────────────────────────────────────────
// Who is at the table, and how they got the character they got.
//
// The old flow asked one person to pick a chair off a menu, which is a
// single-player affordance wearing a multiplayer game's clothes. A table has
// four seats, two a side; you arrive, you wait for the others, and then the
// characters are ISSUED — by lot, by draft, or by an explicit pick when there is
// nobody to be fair to.
//
// Headless like the rest of `internal/`: no components, no DOM, no transport.
// `join`/`leave` are called by whatever is authoritative — a lobby socket in a
// real deployment, buttons in this example — and the assignment rules do not
// care which.

import { INITIATIVE, ROSTER, type Faction, type Klass } from './rules.js';

/** Who is sitting in a seat. `open` is a seat waiting for somebody. */
export type Occupant =
	| { kind: 'open' }
	| { kind: 'human'; id: string; name: string; ready: boolean }
	| { kind: 'ai'; name: string };

/**
 * How characters get handed out.
 *
 *   lot     Shuffled and dealt. Nobody chose, so nobody can be blamed, and the
 *           table plays a different game every time.
 *   draft   Turn order picks from the side's pool. Slower, but it lets a player
 *           read the table and take the chair the table needs.
 *   pick    Free choice. Honest single-player, and the override a host wants
 *           when they are demonstrating something specific.
 */
export type AssignmentMode = 'lot' | 'draft' | 'pick';

export const ASSIGNMENT_MODES: Array<{ id: AssignmentMode; label: string; blurb: string }> = [
	{ id: 'lot', label: 'By lot', blurb: 'Shuffled and dealt. Nobody chose.' },
	{ id: 'draft', label: 'Draft', blurb: 'Turn order picks from your side.' },
	{ id: 'pick', label: 'Free pick', blurb: 'Choose your own. Single-player override.' }
];

/**
 *   waiting   seats are filling
 *   drafting  draft mode, somebody is on the clock
 *   issuing   the ceremony is playing out — cards being turned over
 *   ready     everyone has a character; the match can start
 */
export type LobbyPhase = 'waiting' | 'drafting' | 'issuing' | 'ready';

export interface LobbySeat {
	/** `R1`, `R2`, `B1`, `B2` — the seat, not the person or the character. */
	id: string;
	side: Faction;
	occupant: Occupant;
	/** The character issued to this seat, once it has been. */
	klassKey: string | null;
}

/** Seats in initiative order, which is also the order a draft runs in. */
const SEAT_ORDER = ROSTER.map((k) => k.seat);

const seatFaction = (seatId: string): Faction =>
	ROSTER.find((k) => k.seat === seatId)?.faction ?? 'red';

/** The characters that can be issued to a side. A seat is red or blue before
 *  anybody sits in it, and a red seat can only ever be a red character. */
export const rosterFor = (side: Faction): Klass[] => ROSTER.filter((k) => k.faction === side);

export interface LobbyOptions {
	/** Which seat the local player takes. */
	you?: string;
	mode?: AssignmentMode;
	/** Milliseconds between cards turning over during issuance. */
	issueStagger?: number;
}

export class BreachLobby {
	seats = $state<LobbySeat[]>(
		SEAT_ORDER.map((id) => ({
			id,
			side: seatFaction(id),
			occupant: { kind: 'open' } as Occupant,
			klassKey: null
		}))
	);
	phase = $state<LobbyPhase>('waiting');
	mode = $state<AssignmentMode>('lot');
	/** Seat the local player occupies. */
	youSeatId = $state('R1');
	/** Whose turn it is to pick, while drafting. */
	draftSeatId = $state<string | null>(null);

	readonly #stagger: number;

	constructor(opts: LobbyOptions = {}) {
		this.youSeatId = opts.you ?? 'R1';
		this.mode = opts.mode ?? 'lot';
		this.#stagger = opts.issueStagger ?? 260;
		this.sit(this.youSeatId, { kind: 'human', id: 'you', name: 'You', ready: false });
	}

	// ── Reads ──────────────────────────────────────────────────────────────────
	readonly you = $derived(this.seats.find((s) => s.id === this.youSeatId));
	readonly yourSide = $derived(this.you?.side ?? 'red');
	readonly filled = $derived(this.seats.filter((s) => s.occupant.kind !== 'open').length);
	readonly everyoneHere = $derived(this.filled === this.seats.length);
	/** Humans who have not pressed ready. AI is always ready. */
	readonly waitingOn = $derived(
		this.seats.filter((s) => s.occupant.kind === 'human' && !s.occupant.ready)
	);
	readonly canStart = $derived(
		this.everyoneHere && this.waitingOn.length === 0 && this.phase === 'waiting'
	);
	/** The character issued to a seat, resolved. */
	klassAt(seatId: string): Klass | null {
		const key = this.seats.find((s) => s.id === seatId)?.klassKey;
		return key ? (ROSTER.find((k) => k.key === key) ?? null) : null;
	}
	/** What is still on the table for a side, mid-draft. */
	poolFor(side: Faction): Klass[] {
		const taken = new Set(this.seats.map((s) => s.klassKey).filter(Boolean));
		return rosterFor(side).filter((k) => !taken.has(k.key));
	}

	// ── Seating ────────────────────────────────────────────────────────────────
	sit(seatId: string, occupant: Occupant) {
		this.seats = this.seats.map((s) => (s.id === seatId ? { ...s, occupant } : s));
	}

	leave(seatId: string) {
		this.sit(seatId, { kind: 'open' });
	}

	/** Move the local player to a different chair. Only meaningful before the
	 *  characters go out — after that the seat IS the character. */
	moveTo(seatId: string) {
		if (this.phase !== 'waiting') return;
		const here = this.you;
		if (!here || here.id === seatId) return;
		const target = this.seats.find((s) => s.id === seatId);
		if (!target || target.occupant.kind !== 'open') return;
		this.leave(here.id);
		this.youSeatId = seatId;
		this.sit(seatId, { kind: 'human', id: 'you', name: 'You', ready: false });
	}

	toggleReady() {
		const here = this.you;
		if (!here || here.occupant.kind !== 'human') return;
		this.sit(here.id, { ...here.occupant, ready: !here.occupant.ready });
	}

	/** Fill every empty chair with the demonstrator. What a single player does
	 *  instead of waiting for three strangers. */
	fillWithAI() {
		for (const seat of this.seats) {
			if (seat.occupant.kind !== 'open') continue;
			this.sit(seat.id, { kind: 'ai', name: `${seat.id} · demonstrator` });
		}
	}

	// ── Issuance ───────────────────────────────────────────────────────────────
	/**
	 * Hand out the characters. Resolves once every seat has one, so a host can
	 * `await` it and then start the match.
	 *
	 * `pick` and `draft` need a human decision, so they hand control back and the
	 * view drives `choose()`; `lot` runs to completion on its own.
	 */
	async issue(): Promise<void> {
		if (this.phase !== 'waiting') return;

		if (this.mode === 'pick') {
			// Nothing to allocate — the player takes what they want and the other
			// three seats get whatever is left on their side.
			this.phase = 'drafting';
			this.draftSeatId = this.youSeatId;
			return;
		}

		if (this.mode === 'draft') {
			this.phase = 'drafting';
			this.draftSeatId = this.#nextDrafter();
			this.#autoDraft();
			return;
		}

		// By lot. Each side's characters are shuffled into that side's seats, then
		// turned over one at a time — the stagger is the whole ceremony.
		this.phase = 'issuing';
		const assignment = new Map<string, string>();
		for (const side of ['red', 'blue'] as Faction[]) {
			const pool = shuffle(rosterFor(side).map((k) => k.key));
			const seats = this.seats.filter((s) => s.side === side);
			seats.forEach((seat, i) => assignment.set(seat.id, pool[i]));
		}
		for (const seatId of SEAT_ORDER) {
			await sleep(this.#stagger);
			this.#assign(seatId, assignment.get(seatId)!);
		}
		this.phase = 'ready';
	}

	/** A human taking a character, in `draft` or `pick`. */
	choose(klassKey: string) {
		const seatId = this.draftSeatId;
		if (!seatId || (this.phase !== 'drafting' && this.phase !== 'issuing')) return;
		const seat = this.seats.find((s) => s.id === seatId);
		const klass = ROSTER.find((k) => k.key === klassKey);
		if (!seat || !klass || klass.faction !== seat.side) return;
		if (this.seats.some((s) => s.klassKey === klassKey)) return;
		this.#assign(seatId, klassKey);

		if (this.mode === 'pick') {
			// One human choice, then everything else falls out of it.
			this.#fillRemainingByLot();
			this.phase = 'ready';
			this.draftSeatId = null;
			return;
		}
		this.draftSeatId = this.#nextDrafter();
		if (!this.draftSeatId) {
			this.phase = 'ready';
			return;
		}
		this.#autoDraft();
	}

	/** Back to an empty table. */
	reset() {
		this.seats = this.seats.map((s) => ({ ...s, klassKey: null }));
		this.phase = 'waiting';
		this.draftSeatId = null;
	}

	// ── Internals ──────────────────────────────────────────────────────────────
	#assign(seatId: string, klassKey: string) {
		this.seats = this.seats.map((s) => (s.id === seatId ? { ...s, klassKey } : s));
	}

	#nextDrafter(): string | null {
		return SEAT_ORDER.find((id) => !this.seats.find((s) => s.id === id)?.klassKey) ?? null;
	}

	/** An AI on the clock takes the first thing on its side and moves on. Runs
	 *  until it reaches a human or the table is full. */
	#autoDraft() {
		while (this.draftSeatId) {
			const seat = this.seats.find((s) => s.id === this.draftSeatId);
			if (!seat || seat.occupant.kind === 'human') return;
			const pick = this.poolFor(seat.side)[0];
			if (!pick) return;
			this.#assign(seat.id, pick.key);
			this.draftSeatId = this.#nextDrafter();
		}
		this.phase = 'ready';
	}

	#fillRemainingByLot() {
		for (const side of ['red', 'blue'] as Faction[]) {
			const pool = shuffle(this.poolFor(side).map((k) => k.key));
			const seats = this.seats.filter((s) => s.side === side && !s.klassKey);
			seats.forEach((seat, i) => {
				if (pool[i]) this.#assign(seat.id, pool[i]);
			});
		}
	}
}

/** Fisher–Yates. Its own function so the draw is testable in isolation. */
function shuffle<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Initiative order, re-exported so a view can lay the table out in turn order
 *  without importing the rules directly. */
export { INITIATIVE };
