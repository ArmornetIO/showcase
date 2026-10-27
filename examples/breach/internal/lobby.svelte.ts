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

import { untrack } from 'svelte';
import {
	INITIATIVE,
	ROSTER,
	asSide,
	isOffice,
	klassByKey,
	seatOrder,
	type Faction,
	type Klass,
	type MatchSize
} from './rules.js';
import { botName } from './names.js';
import { DEFAULT_APPEARANCE, randomLook, same, type Appearance } from './appearance.js';

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
/** Every character, as it would play for a side. Any of them may sit in any
 *  chair; the chair decides the kit. */
export const rosterFor = (side: Faction): Klass[] => ROSTER.map((k) => asSide(k, side));

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
	/** Draft, and no screen offers anything else — see `AgentSelect`. The other
	 *  two modes are still here because a HOST may set them (`setMode` routes to
	 *  the server, which has always allowed all three); what changed is that the
	 *  character screen stopped asking a question whose other answers skip the
	 *  one interesting minute of the lobby. */
	mode = $state<AssignmentMode>('draft');
	/** How many chairs are in play. Held here as well as expressed in `seats`,
	 *  because the MATCH needs the answer and it never sees a seat: `phase`
	 *  indexes the chairs at this size, and a 1v1 played as a 2v2 deals its cards
	 *  to two people who are not there. */
	size = $state<MatchSize>('2v2');
	/** Which game the table plays. Set by the host before the table opens and
	 *  fixed once it has — a networked table takes the server's word for it. */
	variant = $state<'ctf' | 'insider_threat'>('ctf');
	/** Seat the local player occupies, or `''` before they have chosen a side.
	 *  Empty is the honest starting value: arriving at a table is not the same
	 *  as sitting down at it, and pre-seating everybody at R1 was what made the
	 *  old lobby a menu you were already standing in the middle of. */
	youSeatId = $state('');
	/** Whose turn it is to pick, while drafting. */
	draftSeatId = $state<string | null>(null);

	/**
	 * What each seat LOOKS LIKE, by seat id.
	 *
	 * Held beside `seats` rather than inside a `LobbySeat` because the two
	 * change on completely different clocks: seating changes when somebody
	 * arrives or is dealt a character, and an appearance changes every time
	 * anybody moves a colour slider. Folding it in would rebuild the whole seat
	 * array — and re-key every `{#each}` reading it — on each keystroke of
	 * somebody else's callsign.
	 *
	 * Keyed by SEAT and not by person, because the seat is what the versus
	 * ranks draw and what the server already names in every message. A player
	 * who moves chairs brings their look with them the way they brought their
	 * role: it is re-sent, not re-derived.
	 */
	looks = $state<Record<string, Appearance>>({});

	/** How a seat is dressed. A seat whose occupant never chose a look is dealt
	 *  one — see `randomLook` — rather than drawn in the default, because four
	 *  identical figures is a line-up of nobody. An empty chair draws nothing. */
	lookAt(seatId: string): Appearance {
		const look = this.looks[seatId];
		if (look) return look;
		const seat = this.seats.find((s) => s.id === seatId);
		return seat ? this.dealtLook(seat) : DEFAULT_APPEARANCE;
	}

	/**
	 * The outfit a seat's occupant is dealt when they have none of their own.
	 *
	 * Seeded by WHO, not by chair, so a person keeps their look when they move:
	 * a player's id, a bot's name. The one exception is the local stand-in
	 * `'you'`, which every offline player shares — seeded by that alone it would
	 * deal everybody who ever plays offline the same outfit, so it takes this
	 * table's salt instead. Nobody else ever draws it, so nothing has to agree.
	 */
	dealtLook(seat: LobbySeat): Appearance {
		const o = seat.occupant;
		if (o.kind === 'open') return DEFAULT_APPEARANCE;
		const seed = o.kind === 'ai' ? `ai:${o.name}:${seat.id}` : o.id === 'you' ? `you:${this.#salt}` : `u:${o.id}`;
		return randomLook(seed);
	}

	readonly #salt = Math.random().toString(36).slice(2);

	/** Adopt an appearance for a seat — the local player's, or one that arrived
	 *  off the wire. The whole map is replaced so the change is a single rune
	 *  write rather than a mutation nothing is watching. */
	setLook(seatId: string, look: Appearance) {
		if (!seatId) return;
		this.looks = { ...this.looks, [seatId]: look };
	}

	/**
	 * Called when the server describes YOUR OWN seat's appearance differently
	 * from the last one it described.
	 *
	 * Two arrivals matter and they are the same event: the stored character put
	 * back on at the join, and the resolved one handed back after an item this
	 * client claimed turned out not to be owned. The host uses it to re-`load`
	 * the outfitter, so the editor never disagrees with the figure everybody
	 * else is looking at.
	 *
	 * Guarded on CHANGE rather than fired on every view, because a seat view
	 * arrives for every move anybody makes — re-loading the editor on each one
	 * would reset a half-finished colour under the player's hand.
	 */
	onyourlook?: (look: Appearance) => void;

	/** The last appearance the server gave for your seat. Compared against, not
	 *  rendered: `looks` is what draws. */
	#lastYours: Appearance | null = null;

	readonly #stagger: number;

	constructor(opts: LobbyOptions = {}) {
		this.mode = opts.mode ?? 'draft';
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
	 * The chair a person can actually SIT in on this side — an empty one, or a
	 * demonstrator's if that is all there is.
	 *
	 * Distinct from `firstOpenSeatOn`, which answers "is there an empty chair"
	 * and is the right question for counting and for gating. This one answers
	 * "can this person join", and after a host presses `play with bots` those
	 * two stop agreeing: every chair is occupied and none of them is held by a
	 * person. Asking the first question at a join site is what left an invited
	 * player standing at a full table with no way in.
	 *
	 * Open chairs come first so a fill never costs somebody their seat while a
	 * genuinely empty one is going spare.
	 */
	firstTakeableSeatOn(side: Faction): string | null {
		const open = this.openSeatsOn(side)[0];
		if (open) return open.id;
		return this.seatsOn(side).find((s) => s.occupant.kind === 'ai')?.id ?? null;
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
		const seat = this.seats.find((s) => s.id === seatId);
		const k = seat?.klassKey ? ROSTER.find((r) => r.key === seat.klassKey) : undefined;
		return seat && k ? asSide(k, seat.side) : null;
	}
	/** What is still on the table for a side, mid-draft. */
	poolFor(side: Faction): Klass[] {
		// Eight coworkers share four characters: nothing is ever taken.
		if (isOffice(this.size)) return [...ROSTER];
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
		config?: { variant?: 'ctf' | 'insider_threat' };
		lobby: {
			phase: string;
			mode: string;
			size?: string;
			draft_seat_id?: string;
			seats: Array<{
				id: string;
				side: string;
				klass_key?: string;
				/** What this seat is wearing. Server-resolved: it has already been
				 *  checked against the account's entitlements, so a client that
				 *  claimed the alpha crown it does not own arrives here without it. */
				appearance?: Appearance;
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
		this.seats = view.lobby.seats.map((s, i) => ({
			id: s.id,
			// The server's office chairs have no side; 'red' is the placeholder
			// `setSize` gives them, which every seat lookup here filters on.
			side: (s.side || 'red') as Faction,
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
						? { kind: 'ai' as const, name: s.occupant.name ?? botName(i) }
						: { kind: 'open' as const }
		}));
		// Only seats the server actually described. A seat it said nothing about
		// keeps the look it had, which is what stops a partial view undressing
		// somebody mid-lobby.
		//
		// `untrack` is load-bearing. Both callers run this inside an `$effect`,
		// so reading `looks` here to merge into it makes that effect depend on
		// the state this line then writes — `effect_update_depth_exceeded` the
		// moment any seat arrives carrying an appearance, which is every fill,
		// every invite and every join. The input is `view`; this object's own
		// state is never one.
		const looks = { ...untrack(() => this.looks) };
		for (const s of view.lobby.seats) if (s.appearance) looks[s.id] = s.appearance;
		this.looks = looks;
		// Your own seat, back from the server: either the character it had stored
		// for you, or the one it resolved after filtering a claim. Either way it
		// is the truth and the editor has to be told.
		const yours = mine ? looks[mine] : undefined;
		if (yours && !(this.#lastYours && same(this.#lastYours, yours))) {
			this.#lastYours = yours;
			this.onyourlook?.(yours);
		}
		// The two vocabularies are not the same word for the same state: the
		// server calls the end of the ceremony `issued`, this file has always
		// called it `ready`. Mapped explicitly rather than cast, because a cast
		// here compiles and then silently fails to match any branch — which
		// renders a lobby stuck one screen behind the table.
		this.phase = REMOTE_PHASE[view.lobby.phase] ?? 'waiting';
		this.mode = view.lobby.mode as AssignmentMode;
		this.size = (view.lobby.size as MatchSize) || '2v2';
		this.variant = view.config?.variant ?? 'ctf';
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
		// Same reason as `pickSide`: a local host who filled with bots and then
		// wanted the other side found every chair on it occupied by one.
		const seatId = this.firstTakeableSeatOn(side);
		if (!seatId) return null;
		const here = this.you;
		if (here) {
			// A trade, not an eviction — mirrors `Lobby.TakeSeat` on the server.
			// Vacating into an open chair would drop the table below full and
			// close the character gate on everybody because one person moved.
			const target = this.seats.find((s) => s.id === seatId);
			if (target?.occupant.kind === 'ai') this.sit(here.id, target.occupant);
			else this.leave(here.id);
		}
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
		const sitting = this.seats.filter((s) => s.occupant.kind !== 'open');
		const wasYou = this.seats.findIndex((s) => s.id === this.youSeatId);
		this.size = size;
		// An office table is neutral chairs, P1…Pn. A seat's side is never read
		// there; 'red' is only what keeps the shared seating code typed.
		const ids = isOffice(size)
			? Array.from({ length: Number(size[0]) }, (_, i) => `P${i + 1}`)
			: SEAT_ORDER.filter((id) => new Set(seatOrder(size).map((k) => klassByKey(k).seat)).has(id));
		const held = new Map(this.seats.map((s) => [s.id, s]));
		const sameShape = ids.every((id) => held.has(id)) && isOffice(size) === this.seats.some((s) => s.id === 'P1');
		if (sameShape) {
			this.seats = ids.map((id) => held.get(id)!);
		} else {
			// A different kind of table: everybody keeps a chair, in order, as far
			// as the new table goes — mirrors `Table.resize` on the server.
			this.seats = ids.map((id, i) => ({
				id,
				side: isOffice(size) ? 'red' : seatFaction(id),
				occupant: sitting[i]?.occupant ?? ({ kind: 'open' } as Occupant),
				klassKey: null
			}));
			const you = sitting.findIndex((s) => s.id === (wasYou >= 0 ? this.youSeatId : ''));
			this.youSeatId = you >= 0 && you < ids.length ? ids[you] : '';
			return;
		}
		// Somebody sitting in a chair that just stopped existing is standing up.
		if (this.youSeatId && !ids.includes(this.youSeatId)) this.youSeatId = '';
	}

	/** Whether this is an office table — Insider Threat's neutral chairs. */
	get office(): boolean {
		return isOffice(this.size);
	}

	toggleReady() {
		const here = this.you;
		if (!here || here.occupant.kind !== 'human') return;
		this.sit(here.id, { ...here.occupant, ready: !here.occupant.ready });
	}

	/** Fill every empty chair with the demonstrator. What a single player does
	 *  instead of waiting for three strangers.
	 *
	 *  Named by seat INDEX rather than at random: four chairs that rolled the
	 *  same word would read as one player, and the index is the only thing here
	 *  that can see the other three. */
	fillWithAI() {
		this.seats.forEach((seat, i) => {
			if (seat.occupant.kind !== 'open') return;
			this.sit(seat.id, { kind: 'ai', name: botName(i) });
		});
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

		// By lot. Every character is shuffled across every chair — any of them may
		// land on either side — then turned over one at a time; the stagger is the
		// whole ceremony.
		this.phase = 'issuing';
		const assignment = new Map<string, string>();
		const pool = shuffle(ROSTER.map((k) => k.key));
		// `% length`: an office of eight shares the four characters.
		this.seats.forEach((seat, i) => assignment.set(seat.id, pool[i % pool.length]));
		for (const seat of this.seats) {
			await sleep(this.#stagger);
			this.#assign(seat.id, assignment.get(seat.id)!);
		}
		this.phase = 'ready';
	}

	/** A human taking a character, in `draft` or `pick`. */
	choose(klassKey: string) {
		const seatId = this.draftSeatId;
		if (!seatId || (this.phase !== 'drafting' && this.phase !== 'issuing')) return;
		const seat = this.seats.find((s) => s.id === seatId);
		const klass = ROSTER.find((k) => k.key === klassKey);
		if (!seat || !klass) return;
		if (!isOffice(this.size) && this.seats.some((s) => s.klassKey === klassKey)) return;
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

	/** The seats are kept in turn order at every size, so the next drafter is
	 *  simply the first without a character. */
	#nextDrafter(): string | null {
		return this.seats.find((s) => !s.klassKey)?.id ?? null;
	}

	/** An AI on the clock takes the first thing on its side and moves on. Runs
	 *  until it reaches a human or the table is full. */
	#autoDraft() {
		while (this.draftSeatId) {
			const seat = this.seats.find((s) => s.id === this.draftSeatId);
			if (!seat || seat.occupant.kind === 'human') return;
			// At random: a demonstrator taking the top of an office's pool every
			// time would put eight Maintainers in the building.
			const pool = this.poolFor(seat.side);
			const pick = pool[Math.floor(Math.random() * pool.length)];
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
