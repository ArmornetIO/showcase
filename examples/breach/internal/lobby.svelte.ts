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

import {
	INITIATIVE,
	ROSTER,
	klassByKey,
	seatOrder,
	type Faction,
	type Klass,
	type MatchSize
} from './rules.js';

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

/** Server lobby phase → the one this file speaks. */
const REMOTE_PHASE: Record<string, LobbyPhase> = {
	waiting: 'waiting',
	drafting: 'drafting',
	issuing: 'issuing',
	issued: 'ready'
};

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
	/** How many chairs are in play. Held here as well as expressed in `seats`,
	 *  because the MATCH needs the answer and it never sees a seat: `phase`
	 *  indexes the chairs at this size, and a 1v1 played as a 2v2 deals its cards
	 *  to two people who are not there. */
	size = $state<MatchSize>('2v2');
	/** Seat the local player occupies, or `''` before they have chosen a side.
	 *  Empty is the honest starting value: arriving at a table is not the same
	 *  as sitting down at it, and pre-seating everybody at R1 was what made the
	 *  old lobby a menu you were already standing in the middle of. */
	youSeatId = $state('');
	/** Whose turn it is to pick, while drafting. */
	draftSeatId = $state<string | null>(null);

	readonly #stagger: number;

	constructor(opts: LobbyOptions = {}) {
		this.mode = opts.mode ?? 'lot';
		this.#stagger = opts.issueStagger ?? 260;
		// `you` is now an opt-in for tests and for the old single-screen demo. The
		// flow proper starts unseated and asks for a side.
		if (opts.you) {
			this.youSeatId = opts.you;
			this.sit(opts.you, { kind: 'human', id: 'you', name: 'You', ready: false });
		}
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
	/** Ready to ISSUE — everybody is seated and everybody has pressed ready.
	 *  A local-game notion: on a networked table the server issues on its own the
	 *  moment this becomes true, so nothing has to ask for it. */
	readonly canStart = $derived(
		this.everyoneHere && this.waitingOn.length === 0 && this.phase === 'waiting'
	);

	/**
	 * The server's answer to "may the match begin", or null in a local game.
	 *
	 * Kept rather than re-derived, because the two questions look identical and
	 * are not: locally the primary button ISSUES characters, and on a networked
	 * table issuance is automatic and `start` is the separate, later op that
	 * needs them already out. Deriving one from the other is what made the
	 * button send `start` at the exact moment the server could only refuse it —
	 * "the characters are not out yet", every time.
	 */
	remoteCanStart = $state<boolean | null>(null);

	/** Whether the primary button should be live, whichever kind of table this
	 *  is. The server wins when there is one. */
	readonly startable = $derived(this.remoteCanStart ?? this.canStart);

	// ── Sides ──────────────────────────────────────────────────────────────────
	// A player picks a TEAM, not a chair. The seat is a consequence: R1/R2 are
	// red and B1/B2 are blue before anybody sits in them, so "join red" is
	// exactly "take the first free red seat" and there is no new server intent
	// to invent — `take_seat` already says everything. Which also means the
	// team's capacity is not a rule anybody has to write down: it is how many
	// seats that side has.

	/** Whether the local player holds a chair at all. False for a spectator, and
	 *  for anybody who has arrived but not yet chosen a side. */
	readonly seated = $derived(!!this.youSeatId && !!this.you);

	seatsOn(side: Faction): LobbySeat[] {
		return this.seats.filter((s) => s.side === side);
	}
	openSeatsOn(side: Faction): LobbySeat[] {
		return this.seatsOn(side).filter((s) => s.occupant.kind === 'open');
	}
	/** How many of a side's chairs are taken, and how many there are. */
	countOn(side: Faction): { taken: number; total: number } {
		const all = this.seatsOn(side);
		return { taken: all.filter((s) => s.occupant.kind !== 'open').length, total: all.length };
	}
	/** The chair a player joining this side would land in, or null when the side
	 *  is full — which is the only reason to refuse the choice. */
	firstOpenSeatOn(side: Faction): string | null {
		return this.openSeatsOn(side)[0]?.id ?? null;
	}

	/**
	 * May characters be chosen yet?
	 *
	 * The gate the whole screen turns on: NOBODY picks until the table is full,
	 * either because the last player arrived or because the host filled the rest
	 * with demonstrators. Letting the first arrival pick would hand them the
	 * whole side's roster while three people who have not turned up yet get
	 * whatever is left — which is not a draft, it is a race.
	 */
	/** The server's answer to the same question, when there is a server. Kept
	 *  rather than re-derived for the reason `remoteCanStart` is: the rule is
	 *  enforced there, so a client deriving its own is a second implementation
	 *  that will offer a control the server then refuses.
	 *
	 *  Declared BEFORE the `$derived` that reads it — a class field initialiser
	 *  runs in source order, and a derived reading a later field sees it
	 *  uninitialised. */
	remoteCanChoose = $state<boolean | null>(null);

	readonly canChoose = $derived(this.remoteCanChoose ?? this.everyoneHere);

	/** Why picking is not open yet, said out loud. A disabled roster with no
	 *  explanation is the worst version of this screen. */
	readonly blockedBecause = $derived.by(() => {
		if (this.everyoneHere) return null;
		const missing = this.seats.length - this.filled;
		return `${missing} ${missing === 1 ? 'seat' : 'seats'} still open`;
	});
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

	/**
	 * Take the server's seating.
	 *
	 * The one method in this file that does not decide anything — it copies. A
	 * networked table's rules live on the server, so the local object stops being
	 * the authority and becomes the shape the components already know how to
	 * read. That is the whole trick: `Lobby.svelte` never learns there is a
	 * network, because the thing it renders did not change.
	 */
	applyRemote(view: {
		your_seat?: string;
		lobby: {
			phase: string;
			mode: string;
			size?: string;
			draft_seat_id?: string;
			seats: Array<{
				id: string;
				side: string;
				klass_key?: string;
				occupant: { kind: string; user_id?: string; name?: string; ready?: boolean };
			}>;
			/** Whether the host may start. Decided server-side and sent to
			 *  everybody, so a client can explain itself ("waiting for the host")
			 *  rather than just disabling a button. */
			can_start?: boolean;
			/** Whether the table is full enough for anybody to take a character.
			 *  Decided server-side, for the same reason `can_start` is. */
			can_choose?: boolean;
		};
	}) {
		const mine = view.your_seat ?? '';
		this.seats = view.lobby.seats.map((s) => ({
			id: s.id,
			side: s.side as Faction,
			klassKey: s.klass_key ?? null,
			occupant:
				s.occupant.kind === 'human'
					? {
							kind: 'human' as const,
							id: s.occupant.user_id ?? '',
							// Your own chair says "You", which is what the seat plate is
							// built around; everybody else gets their name.
							name: s.id === mine ? 'You' : (s.occupant.name ?? 'Player'),
							ready: !!s.occupant.ready
						}
					: s.occupant.kind === 'ai'
						? { kind: 'ai' as const, name: s.occupant.name ?? `${s.id} · demonstrator` }
						: { kind: 'open' as const }
		}));
		// The two vocabularies are not the same word for the same state: the
		// server calls the end of the ceremony `issued`, this file has always
		// called it `ready`. Mapped explicitly rather than cast, because a cast
		// here compiles and then silently fails to match any branch — which
		// renders a lobby stuck one screen behind the table.
		this.phase = REMOTE_PHASE[view.lobby.phase] ?? 'waiting';
		this.mode = view.lobby.mode as AssignmentMode;
		this.size = view.lobby.size === '1v1' ? '1v1' : '2v2';
		this.draftSeatId = view.lobby.draft_seat_id ?? null;
		// The server computes this so two clients cannot disagree about whether
		// the host may start — and so nobody has to re-implement the rule that
		// makes the difference between issuing and starting.
		this.remoteCanStart = view.lobby.can_start ?? false;
		this.remoteCanChoose = view.lobby.can_choose ?? false;
		// A spectator holds no chair, and pointing this at a real seat would
		// quietly hand them somebody else's.
		this.youSeatId = mine;
	}

	// ── Seating ────────────────────────────────────────────────────────────────
	sit(seatId: string, occupant: Occupant) {
		this.seats = this.seats.map((s) => (s.id === seatId ? { ...s, occupant } : s));
	}

	leave(seatId: string) {
		this.sit(seatId, { kind: 'open' });
	}

	/**
	 * Join a side. Returns the seat taken, or null when the side is full.
	 *
	 * The one entry point a player uses to get into the game. It resolves to a
	 * chair here rather than in a component so a networked table can send the
	 * same decision as `take_seat` and a local one can apply it directly — the
	 * rule about which chairs a side owns lives in exactly one place either way.
	 */
	joinSide(side: Faction): string | null {
		if (this.phase !== 'waiting') return null;
		const seatId = this.firstOpenSeatOn(side);
		if (!seatId) return null;
		const here = this.you;
		if (here) this.leave(here.id);
		this.youSeatId = seatId;
		this.sit(seatId, { kind: 'human', id: 'you', name: 'You', ready: false });
		return seatId;
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

	/** How characters get handed out. A method rather than a bare assignment so
	 *  that a networked table can route the choice to whoever is authoritative —
	 *  the host, in a room — instead of every browser deciding for itself. */
	setMode(mode: AssignmentMode) {
		if (this.phase !== 'waiting') return;
		this.mode = mode;
	}

	/**
	 * How many chairs are in play, for a LOCAL table.
	 *
	 * Rebuilds the seating rather than hiding rows, because every count on the
	 * new screens — how many a side has open, whether the table is full, whether
	 * anybody may pick — reads `seats`. A 1v1 that kept four seats and drew two
	 * would be a table permanently two players short of letting anyone choose.
	 *
	 * A networked table never calls this: the server sends its own seating and
	 * `applyRemote` overwrites whatever is here.
	 */
	setSize(size: MatchSize) {
		if (this.phase !== 'waiting') return;
		this.size = size;
		const keys = seatOrder(size);
		const wanted = new Set(keys.map((k) => klassByKey(k).seat));
		const held = new Map(this.seats.map((s) => [s.id, s]));
		this.seats = SEAT_ORDER.filter((id) => wanted.has(id)).map(
			(id) =>
				held.get(id) ?? {
					id,
					side: seatFaction(id),
					occupant: { kind: 'open' } as Occupant,
					klassKey: null
				}
		);
		// Somebody sitting in a chair that just stopped existing is standing up.
		if (this.youSeatId && !wanted.has(this.youSeatId)) this.youSeatId = '';
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
