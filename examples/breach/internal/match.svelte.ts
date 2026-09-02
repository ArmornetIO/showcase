// ── The match ────────────────────────────────────────────────────────────────
// The whole game as a headless engine: state, rules, resolution, upkeep and the
// demonstrator. No Svelte components, no DOM, no `$lib` — so it runs in Node
// under vitest, and a host is free to render it however it likes.
//
// Instantiated rather than exported as a singleton. Two boards can run two
// matches on one page, which is the entire reason the layout comparison works.
//
// Timers and the demonstrator loop are NOT started by the constructor. They
// live in `start()`, which returns its own teardown — importing this module
// costs nothing and mounting is what makes it move.

import { untrack } from 'svelte';
import {
	CHAIN,
	CORE_ID,
	OUTCOME_COLOR,
	OUTCOME_LABEL,
	ROSTER,
	STRUCTURES,
	TERRITORIES,
	TERRITORY_ORDER,
	canTarget,
	computeOdds,
	klassByKey,
	outcomeFor,
	powerOf,
	roll2d6,
	seededDice,
	scaleEffect,
	seatOrder,
	structureById,
	succeeded,
	type Ability,
	type DiceSource,
	type Faction,
	type Klass,
	type MatchSize,
	type Outcome,
	type Power,
	type Structure,
	type TerritoryKey
} from './rules.js';
import {
	BEATS,
	GARRISON_CAP,
	QUIET_BEATS,
	fxFor,
	wait,
	type ActiveFx,
	type BoardPing,
	type GarrisonUnit,
	type StatusBar
} from './fx.js';
import { OPENING, type Audience, type LogDraft, type LogEntry } from './log.js';
import {
	abilityByKey,
	buildDeck,
	openingHand,
	shuffle,
	type HandCard
} from './deck.js';
import { derivePresence, type PresenceModel, type Seated } from './presence.js';
import { bonus, trackFor, unlockedFor, type Upgrade } from './upgrades.js';
import {
	NO_CINEMA,
	POV_CARDS,
	type CinemaPort,
	type Cut,
	type Lineup,
	type PovBeat
} from './cinema.js';

/**
 * How many cards a seat holds. Four, which is what a seat used to BE — the deck
 * changed where cards come from, not how many you are looking at.
 */
export const HAND_SIZE = 4;

/** The last round. Blue survives to it; red has until it to hold the path. */
export const HORIZON = 12;

/** Ground somebody is standing on that they should not be. */
export interface Foothold {
	structure_id: string;
	seat_key: string;
	persistent: boolean;
	revealed: boolean;
	sleeper: boolean;
	placed_round: number;
	/** A turn was spent working this foothold rather than pushing on — it is
	 *  pre-positioned, and worth +2 on the next step of the chain. */
	staged: boolean;
}

/**
 * A game starts by choosing who you are. The select screen exists to make the
 * class an identity rather than a dropdown — you sit down as somebody, and the
 * deal that follows is what hands you their tools.
 */
export type Stage = 'select' | 'deal' | 'play';

/**
 * Two kinds of "no".
 *
 *   hard    the operation has not reached that far — the chain runs in order,
 *           or it is not your side of the board. Nothing lights up and the card
 *           will not drop. This is a rule, and rules should be un-playable.
 *
 *   sealed  a quarantine is in the way. This one you ARE allowed to try: it is
 *           the defender's move, and a defender's move that silently greys out
 *           a target is a move nobody ever sees work.
 */
export interface Block {
	kind: 'hard' | 'sealed';
	text: string;
}

export interface Roll {
	dice: [number, number];
	total: number;
	hit: boolean;
	outcome: Outcome;
	margin: number;
}

/**
 * The move currently being announced, for whoever is drawing the big version.
 *
 * The beats already existed and already ran identically on every client — a
 * server verdict replays through the same `#stage` as a local one. What was
 * missing was somewhere to SAY it: the entire announcement of a roll was a
 * 0.6rem mono line at the end of the action bar, next to the resolve button.
 * Three seconds of choreography resolving into nine pixels of text.
 *
 * So `#stage` publishes this alongside the effects it already publishes, and a
 * host draws it however big it likes. Nothing here is read back by the engine;
 * removing the overlay changes no rule.
 *
 * FOG. A move by the other side names nobody. `actor`, `card` and `target` are
 * null in that case, not blanked at the last moment by the renderer — the same
 * construction the POV cutaway uses, for the same reason: a fact that never
 * reaches the component cannot be leaked by one.
 */
export interface Verdict {
	/** Bumps per announcement, so a renderer can re-key and restart its own
	 *  animation rather than diffing its way into the next one. */
	id: number;
	faction: Faction;
	/** Null when fogged. */
	actor: string | null;
	seat: string | null;
	card: string | null;
	target: string | null;
	/** The region. Survives the fog — "something happened in The Outlands" is
	 *  exactly what the other side is entitled to know. */
	territory: string;
	/** The card's verb and hue, for the headline. */
	word: string;
	hue: string;
	fogged: boolean;
	/** Ran at a seal: the dice were swatted before they landed. */
	sealed: boolean;
	/** Null while the dice are still in the air, and for a fogged ripple that
	 *  was never told what they said. */
	roll: Roll | null;
	/** Whether there are dice to draw AT ALL — a throw that happened, whether or
	 *  not this seat is allowed the number on it.
	 *
	 *  Distinct from `roll` because `roll` is null for the whole second the dice
	 *  are tumbling, so a renderer cannot use it to decide whether to draw any.
	 *  It used to guess, and fell back to the board's tumbling faces when there
	 *  was no roll — which meant a fogged ripple, where the fog withheld the
	 *  throw entirely, drew two dice showing leftover animation values. The
	 *  other side of the table read that as the dice disagreeing. */
	throws: boolean;
	/** What the announcement is doing right now, straight off the beat clock.
	 *
	 *   cast     the card is named, the squad is moving, no dice yet
	 *   rolling  dice in the air
	 *   settled  the number is known and nothing has been done about it
	 *   done     the consequence has landed
	 */
	stage: 'cast' | 'rolling' | 'settled' | 'done';
}

/** A card in flight. The engine owns the DATA; hit-testing `over` against drawn
 *  geometry is the view's job, because only the view knows where anything is. */
export interface Drag {
	key: string;
	x: number;
	y: number;
	over: string | null;
}

export interface MatchOptions {
	/** Plays first-person cutaways. Omit for a host that cannot. */
	cinema?: CinemaPort;
	/** Seconds on the turn clock. */
	turnMs?: number;
	/**
	 * How the engine spends time.
	 *
	 * A resolution is a PERFORMANCE — dice thrown, a verdict landing, a squad
	 * arriving — and the beats between those moments are what make it one. But
	 * the performance belongs to whoever is watching, and an authoritative
	 * server has nobody watching it: it needs the same state change, now.
	 *
	 * So the waiting is a port. Omit it and the beats play at their written
	 * length; pass `async () => {}` and the identical resolution happens in one
	 * frame, which is what lets a server rule on a card and let four browsers
	 * each play it out at their own tempo.
	 */
	pace?: (ms: number) => Promise<void>;
	/** Whether a player may take a demonstrator's chair mid-match. Off unless the
	 *  table's settings turned it on — see `MatchConfig.takeover`. */
	takeover?: boolean;
	/** Where the offline engine's dice come from. Omit for real ones; pass a
	 *  scripted source to pin a game. */
	dice?: DiceSource;
}

const TURN_TICK = 200;

/** How long a networked click holds the controls while it waits for the board
 *  it asked for. Comfortably longer than a round trip, and short enough that a
 *  server which never answers hands the player their controls back rather than
 *  leaving them greyed out forever. */
const REMOTE_ACK_MS = 5000;

/** What a networked match sends its decisions to. */
export interface RemotePort {
	commit: (cardKey: string, siteID: string) => void;
	endTurn: () => void;
	newMatch: () => void;
}

/** The server's board, as it arrives on the wire. Snake case because that is
 *  what Go sends; mapped into this file's shapes by `applyRemote`. */
/** One building, as the authority sees it for this seat. Mirrors
 *  `breachview.SiteView` — and mirrors it whole, because the fields this client
 *  chose not to read last time are exactly the ones it then got wrong. */
export interface SiteView {
	id: string;
	/** What an attack has to beat right now, after everything. */
	hardening: number;
	base: number;
	held: boolean;
	persistent: boolean;
	staged: boolean;
	sealed: boolean;
	red: number;
	blue: number;
}

export interface RemoteMatchView {
	round: number;
	phase: number;
	/** How many chairs are in play. `phase` indexes the seats at THIS size, so a
	 *  client that ignores it counts a 1v1 round in fours. */
	size: MatchSize;
	seat_key: string;
	active_key: string;
	winner?: string;
	over: boolean;
	your_turn: boolean;
	footholds: Foothold[];
	garrison: Array<{
		uid: string;
		structure_id: string;
		faction: Faction;
		leaves: GarrisonUnit['leaves'];
		shape: GarrisonUnit['shape'];
		hue: string;
		revealed: boolean;
		phase: number;
	}>;
	/** Every building as THIS seat sees it, already fogged, with `hardening`
	 *  computed by the engine that will resolve against it.
	 *
	 *  This field was on the wire for a long time before anything read it, and
	 *  not reading it cost a live bug: the client recomputed the same number from
	 *  its own copy of the rules, the two copies drifted on which chairs count
	 *  toward blue's harden upgrades, and from round 9 of a 1v1 the board showed
	 *  a wall two higher than the server rolled against. A number the authority
	 *  already sent is not a number to derive again. */
	sites?: SiteView[];
	log: LogEntry[];
	heat: Record<TerritoryKey, number>;
	ap: Record<string, number>;
	res: Record<string, number>;
	hardened?: Record<string, number>;
	softened?: Record<string, number>;
	quarantined?: string[];
	expiry?: Record<string, number>;
	chip?: Record<string, number>;
	/** This seat's own move, priced by the server. Absent for a character without
	 *  one. Only the charge count is read: the move itself is generated data both
	 *  sides already hold, and a second copy is a second thing to disagree. */
	power?: { key: string; charges: number };
	/** The cards this seat is holding, by the server's reckoning. Absent for a
	 *  bystander, who holds none.
	 *
	 *  `uid` identifies the COPY and is the server's, not this browser's: two
	 *  copies of one card share a key, so a client minting its own ids could not
	 *  tell which of the two the server just dealt it. Everything else on the
	 *  wire card — the pricing, the legal sites — is recomputed here from data
	 *  both sides already hold, so it is deliberately not read. */
	hand?: Array<{ uid: string; key: string }>;
}

/** What the dice did, as the server tells it. `target` is the number they had to
 *  beat — the one part of a verdict a client cannot recompute, because the
 *  modifiers were the server's. */
export interface RemoteRoll extends Roll {
	target: number;
}

/**
 * One action, after the fact — and already fogged for whoever it was sent to.
 * Mirrors `breachview.Resolution`.
 *
 * A quiet enemy action arrives as `seq`, `faction` and `territory` and nothing
 * else (`FogResolution` in Go): no actor, no card, no building, no dice. So
 * everything else is optional HERE rather than checked at the point of use — a
 * type promising an actor on a payload that withholds one is the fog reaching
 * the client as a crash.
 */
export interface RemoteResolution {
	seq: number;
	faction: Faction;
	territory: TerritoryKey;
	actor_key?: string;
	card_key?: string;
	structure_id?: string;
	/** The quarantine swatted the roll out of the air before it landed. */
	sealed?: boolean;
	roll?: RemoteRoll;
	/** Public whoever threw it — a failed attack, or a seal being rattled. */
	loud?: boolean;
}

/**
 * Everything a resolution's beats need, settled before the first one plays.
 *
 * A plan rather than a read of the board, because a networked verdict arrives
 * with its snapshot ALREADY applied: the foothold is placed and the heat is up
 * by the time the first beat fires, so anything re-read here would animate the
 * aftermath instead of the moment.
 */
interface Beat {
	faction: Faction;
	/** Null when the fog withheld who it was. */
	actor: Klass | null;
	/** Null when the fog withheld what they played. */
	ability: Ability | null;
	/** Where it lands. For a fogged action this is only an ANCHOR in the right
	 *  region — `foggedAnchorId` moves the ripple off it again, which is what
	 *  keeps the withheld building withheld. */
	target: Structure;
	fogged: boolean;
	/** Dice were thrown at a wall, so the long choreography rather than the quiet
	 *  one. */
	attacking: boolean;
	sealed: boolean;
	roll: Roll | null;
	/** Public whoever threw it, so the ripple stops hiding at the verdict. */
	loud: boolean;
	/** The server's seq, present only on a verdict ruled elsewhere. The seal
	 *  animation invents faces to swat, and this is what makes every browser at
	 *  the table invent the SAME ones. */
	swatSeed?: number;
	/** The offline engine's board mutation, fired on the beat the verdict lands.
	 *  Absent on a networked table, where the server already did it. */
	apply?: () => void;
}

/**
 * What a logged move WAS, as values rather than as the sentence about it.
 *
 * Handed to `#played`, which is the one place that decides how much of it a row
 * is allowed to carry. `loud` is the switch: it is the same word `Beat` uses
 * and means the same thing — the move made a noise, so it is public whoever
 * threw it.
 */
interface Act {
	by: Klass;
	loud: boolean;
	/** The building. Its territory is what a fogged row keeps. */
	at?: Structure;
	card?: Ability;
	/** Change to `at`'s hardening. Negative is damage. */
	delta?: number;
	outcome?: Outcome;
}

/**
 * How many verdicts may wait behind the one on screen.
 *
 * Beats are moments, not messages. A table moving faster than the cinema would
 * otherwise queue a minute of animation for a board that reached its current
 * state long ago, so the queue is short and the oldest fall off it.
 */
const BEAT_QUEUE_MAX = 3;

export class BreachMatch {
	// ── Flow ───────────────────────────────────────────────────────────────────
	stage = $state<Stage>('select');
	round = $state(1);
	/** Index into `seatOrder`, which is two long at 1v1 and four at 2v2. Never
	 *  into the full roster: that is how a two-handed match handed the player the
	 *  two chairs nobody was sitting in. */
	phase = $state(0);
	/** How many chairs this match is played with. Decided in the lobby, and told
	 *  to a networked table by the server. */
	size = $state<MatchSize>('2v2');
	/** Whose turn the SERVER says it is, and whether that is you. Null on a local
	 *  table, where the phase index is the only answer there is. */
	activeKey = $state<string | null>(null);
	yourTurn = $state<boolean | null>(null);
	/** Whose HUD is on screen — the fog is computed from here. */
	seatKey = $state('maintainer');
	winner = $state<Faction | null>(null);
	auto = $state(false);

	// ── Board ──────────────────────────────────────────────────────────────────
	footholds = $state<Foothold[]>([]);
	heat = $state<Record<TerritoryKey, number>>({
		staging: 0,
		outlands: 0,
		commons: 0,
		foundry: 0,
		marches: 0
	});
	ap = $state<Record<string, number>>({ maintainer: 3, state: 3, architect: 3, hunter: 3 });
	res = $state<Record<string, number>>({ maintainer: 0, state: 0, architect: 2, hunter: 2 });
	/** The authority's own reading of every building, by id, when there is an
	 *  authority. Empty on an offline table, where this client IS the authority
	 *  and the maps below are the state rather than a shadow of it. */
	sites = $state<Record<string, SiteView>>({});
	/** Blue control effects: extra hardening bought with Harden. */
	hardened = $state<Record<string, number>>({});
	/** Red control effects: hardening talked, signed or pressured away. The half
	 *  of an intrusion that never touches a keyboard. */
	softened = $state<Record<string, number>>({});
	quarantined = $state<string[]>([]);
	/** Round each temporary effect lapses on. Without these the board only ever
	 *  ratchets, and a game where nothing expires has no reason to hurry. */
	expiry = $state<Record<string, number>>({});
	/** Damage. Every miss chips 1 off hardening and upkeep repairs 1 a round, so
	 *  a building can be worn down by attacks that all "failed". */
	chip = $state<Record<string, number>>({});
	/** Everyone standing on the board — a squad marches, fights, and STAYS. */
	garrison = $state<GarrisonUnit[]>([]);
	log = $state<LogEntry[]>([...OPENING]);

	// ── The supply ─────────────────────────────────────────────────────────────
	// Cards no longer live on the character — they come out of a pile per side.
	// The engine holds the piles because it is the only thing allowed to move a
	// card between them; `deck.ts` returns new arrays rather than mutating, so a
	// helper can never edit a pile behind the engine's back.

	/** Each side's draw pile, top first. */
	piles = $state<Record<Faction, HandCard[]>>({ red: [], blue: [] });
	/** Spent cards, per side. A pile that runs dry reshuffles this back in. */
	discards = $state<Record<Faction, HandCard[]>>({ red: [], blue: [] });
	/** What each seat is holding, by klass key. */
	hands = $state<Record<string, HandCard[]>>({});

	/**
	 * What is left of each character's own move, keyed by POWER key — the way Go
	 * keys `Match.Charges`.
	 *
	 * A power is the deck's opposite number: it never shuffles, never discards
	 * and cannot land in an ally's hand, because there is no pile for it to be
	 * in. This count is the whole of its bookkeeping, and zero is a real value —
	 * a spent power stays on the sheet, because it is bought back rather than
	 * gone.
	 */
	charges = $state<Record<string, number>>({});

	// ── Selection ──────────────────────────────────────────────────────────────
	selectedId = $state<string | null>(null);
	armedKey = $state<string | null>(null);
	inspectKey = $state<string | null>(null);
	drag = $state<Drag | null>(null);
	/** How many of the hand have arrived from the dispenser. */
	dealtCount = $state(0);

	// ── Presentation ───────────────────────────────────────────────────────────
	/** The input lock. Held for exactly as long as a resolution is SAYING
	 *  something and not one frame longer — see the beat table in fx.ts. */
	busy = $state(false);
	/**
	 * The same lock, for a networked table: an intent is out and the board it
	 * asked for has not come back.
	 *
	 * Kept apart from `busy` because they end differently. `busy` is a
	 * resolution playing out and it clears when the animation does; this clears
	 * when a snapshot lands — or on its own, because a latch that only the
	 * server could release would, on a server that never answers, leave the
	 * player looking at their own controls greyed out with nothing to press.
	 */
	pending = $state(false);
	activeFx = $state<ActiveFx | null>(null);
	pings = $state<BoardPing[]>([]);
	lastRoll = $state<Roll | null>(null);
	diceSpin = $state(false);
	diceFaces = $state<[number, number]>([1, 1]);
	/** The move being announced. Null between resolutions. See `Verdict`. */
	verdict = $state<Verdict | null>(null);
	#verdictSeq = 0;
	/** A cutaway is on screen, so the host's chrome should get out of the way. */
	povLive = $state(false);
	turnLeft = $state(30_000);

	// Initialised here as well as in the constructor: `presence` is a $derived
	// field that reads it, and a class field may not read one that is only
	// assigned later in the constructor.
	readonly turnMs: number = 30_000;
	/**
	 * Whether this table lets a player change chairs.
	 *
	 * A setting, and settled in the lobby — which runs after this object exists,
	 * so it cannot be `readonly`. The constructor seeds it and the setup screen
	 * is the only thing that writes it; nothing does once the board is up, which
	 * is the property that matters and the one a `readonly` was only ever
	 * approximating.
	 */
	takeover = $state(false);
	#cinema: CinemaPort;
	#pace: (ms: number) => Promise<void>;
	#dice: DiceSource | undefined;
	#fxSeq = 0;
	#unitSeq = 0;
	#pingSeq = 0;
	#logSeq = 0;

	constructor(opts: MatchOptions = {}) {
		this.#cinema = opts.cinema ?? NO_CINEMA;
		this.#pace = opts.pace ?? wait;
		this.#dice = opts.dice;
		this.turnMs = opts.turnMs ?? 30_000;
		this.takeover = opts.takeover ?? false;
		this.turnLeft = this.turnMs;
	}

	/** Swap the cinema port after construction — a host mounts its POV component
	 *  after the match exists, and this is how it hands the handle over. */
	setCinema(port: CinemaPort | null) {
		this.#cinema = port ?? NO_CINEMA;
	}

	// ── Derived ────────────────────────────────────────────────────────────────
	readonly seat = $derived<Klass>(ROSTER.find((r) => r.key === this.seatKey) ?? ROSTER[0]);
	/** The chairs in play, in initiative order. Everything that walks the table —
	 *  the clock, upkeep, the deal — walks this and not the roster. */
	readonly seatOrder = $derived(seatOrder(this.size));
	/** The server's answer first: it owns the seating, and a client recomputing
	 *  whose turn it is from an index is a client that can disagree with it. */
	readonly activeKlass = $derived<Klass>(
		ROSTER.find((r) => r.key === (this.activeKey ?? this.seatOrder[this.phase])) ?? ROSTER[0]
	);
	readonly isMyTurn = $derived(this.yourTurn ?? this.activeKlass.key === this.seat.key);

	/** What THIS seat is allowed to know. Red sees its side's work; blue sees
	 *  only what it has turned over. The game lives in the gap between the two. */
	readonly visible = $derived(
		this.footholds.filter((f) => (this.seat.faction === 'red' ? true : f.revealed))
	);
	visibleOn(id: string) {
		return this.visible.find((f) => f.structure_id === id);
	}

	/** The log through the same fog. Rows addressed to the other side never
	 *  render — not dimmed, not redacted-with-a-blur, absent. */
	readonly feed = $derived(
		this.log.filter((e) => e.see === 'all' || e.see === this.seat.faction)
	);

	/** Standing forces through the same fog. Derived rather than stored, so a
	 *  reveal anywhere reveals the people too. */
	readonly visibleGarrison = $derived(
		this.garrison
			.filter(
				(g) =>
					this.seat.faction === 'red' ||
					g.faction === 'blue' ||
					!!this.footholds.find((f) => f.structure_id === g.structureId)?.revealed
			)
			.map((g) => ({ ...g, revealed: true }))
	);

	/** Chain progress as RED knows it, and as BLUE can prove it. */
	readonly chainHeld = $derived(
		CHAIN.filter((s) => this.footholds.some((f) => f.structure_id === s.id))
	);
	readonly chainShown = $derived(CHAIN.filter((s) => this.visibleOn(s.id)));
	/**
	 * The CHEAPEST unheld link, not a required one.
	 *
	 * It reads like a queue and is not: `attackBlocked` stopped enforcing order,
	 * so every link is legal whenever and only the payload is gated. What makes
	 * this one special is `leverageFor` — holding the link before a target is
	 * worth +1..+5 on the roll, so the first unheld rung is where an attack is
	 * most likely to land, and that is all it is.
	 *
	 * Do not present it as "next". The HUD said "step 2 of 5 — take X next" for a
	 * while after the rule was removed, which reinstated the constraint in the one
	 * place a player actually reads: they saw a queue and played a queue. It is
	 * fine as a camera target (see TacticalToolbar) and wrong as an instruction.
	 */
	readonly chainNext = $derived(
		CHAIN.find((s) => !this.footholds.some((f) => f.structure_id === s.id))
	);

	/** The horizon, as a value the HUD can count down to. */
	readonly rounds = HORIZON;

	/**
	 * Presence, read off the FOGGED feed rather than off match state.
	 *
	 * That is the whole safety argument: `feed` has already been filtered for
	 * this seat, so a presence read that walks it cannot surface something the
	 * seat is not allowed to know. One gate, not two.
	 */
	/**
	 * Who is holding each character, keyed by klass key.
	 *
	 * Written by whoever owns the table, because the answer lives in the LOBBY
	 * and the match has never heard of one — a match is a board, and it is the
	 * same board whether four people or four demonstrators are playing it.
	 *
	 * Empty means "not stated", and every chair then reads as a person: a table
	 * that says nothing about its seating gets the behaviour it always had.
	 */
	players = $state<Record<string, Seated>>({});

	/**
	 * Whether the chair on the clock plays itself.
	 *
	 * A fact about the TABLE, not about this browser: it is true on a networked
	 * table too, where the server is the one playing it. Who acts on it is the
	 * caller's business.
	 *
	 * `auto` is the whole-table override — every chair, including yours.
	 */
	readonly activeIsAutomatic = $derived(
		this.auto || this.players[this.activeKlass.key]?.kind === 'ai'
	);

	readonly presence = $derived<PresenceModel>(
		derivePresence({
			seatKey: this.seat.key,
			round: this.round,
			phase: this.phase,
			turnLeft: this.turnLeft,
			turnMs: this.turnMs,
			ap: this.ap,
			feed: this.feed,
			players: this.players
		})
	);

	// ── The hand ───────────────────────────────────────────────────────────────

	/** What a seat is holding. Instances, not card types — two copies of one card
	 *  are two entries with distinct uids, which is what `CardFan` keys on. */
	handOf(seatKey: string): HandCard[] {
		return this.hands[seatKey] ?? [];
	}

	/**
	 * The ability for a card a seat actually holds.
	 *
	 * The hand check is the point: `abilityByKey` alone would happily return a
	 * card that is sitting in the draw pile, and every legality question in the
	 * engine runs through here. Returns undefined for a key the seat does not
	 * hold, which is a routine "no", not an error.
	 */
	inHand(seatKey: string, key: string | null): Ability | undefined {
		if (!key) return undefined;
		if (!this.handOf(seatKey).some((c) => c.key === key)) return undefined;
		return abilityByKey(key);
	}

	/** How many charges are left on a power. */
	chargesOf(powerKey: string): number {
		return this.charges[powerKey] ?? 0;
	}

	/**
	 * The move behind a key, whether it came out of the hand or off the sheet.
	 *
	 * Go's `Playable`, in a language where a `Power` already IS an `Ability`:
	 * everything downstream — the odds, the block reason, the resolution — is
	 * about the MOVE and does not care where the actor came to have it. The one
	 * thing that does is paying for it, and that is settled in `#spend`.
	 */
	moveFor(seatKey: string, key: string | null): Ability | undefined {
		if (!key) return undefined;
		const power = powerOf(seatKey);
		if (power?.key === key) return this.chargesOf(key) > 0 ? power : undefined;
		return this.inHand(seatKey, key);
	}

	/** This seat's own move, or null for a character without one. */
	readonly power = $derived<Power | null>(powerOf(this.seat.key) ?? null);
	/** What is left of it. Shown at zero rather than hidden — see `charges`. */
	readonly powerCharges = $derived(this.power ? this.chargesOf(this.power.key) : 0);

	readonly armed = $derived<Ability | null>(this.moveFor(this.seat.key, this.armedKey) ?? null);
	readonly target = $derived(this.selectedId ? structureById(this.selectedId) : undefined);
	readonly inspected = $derived(this.moveFor(this.seat.key, this.inspectKey) ?? null);
	/** How many sites the INSPECTED card could be played on — counted from the
	 *  card being read, not from whatever happens to be armed. */
	readonly inspectedSites = $derived(
		this.inspected
			? STRUCTURES.filter((s) => this.blockedReason(this.inspected!, s)?.kind !== 'hard').length
			: 0
	);

	/**
	 * Which buildings the armed card may be played on. Driven by ARMING, not by
	 * dragging: the moment you pick a card up the board should answer "where can
	 * this go". Sealed sites stay lit — you are allowed to run at a wall, and the
	 * wall working is the defender's whole payoff.
	 */
	readonly aimIds = $derived.by(() => {
		const d = this.drag;
		const a = d ? this.moveFor(this.seat.key, d.key) : this.armed;
		if (!a || this.busy || this.winner || !this.isMyTurn) return [];
		return STRUCTURES.filter((s) => this.blockedReason(a, s)?.kind !== 'hard').map((s) => s.id);
	});

	readonly blockReason = $derived(
		this.armed && this.target ? this.blockedReason(this.armed, this.target) : null
	);
	readonly legalTarget = $derived(
		!!this.armed && !!this.target && this.blockReason?.kind !== 'hard'
	);
	readonly odds = $derived(
		this.armed && this.target ? this.oddsFor(this.seat, this.armed, this.target) : null
	);
	readonly canPay = $derived(!!this.armed && (this.ap[this.seat.key] ?? 0) >= this.armed.ap);
	/** Every precondition on committing, in one place. Including whose turn it is:
	 *  your chair no longer follows the clock into somebody else's, so "it is not
	 *  your go" is a real state the controls have to answer for. */
	readonly ready = $derived(
		!!this.armed &&
			!!this.target &&
			this.legalTarget &&
			this.canPay &&
			this.isMyTurn &&
			!this.busy &&
			!this.pending &&
			!this.winner
	);

	/**
	 * STANDING — how close this seat is to losing, 0–100, where 100 is fine.
	 *
	 * BREACH gives a player no hit points, and inventing some would be a lie: you
	 * are never damaged, you are found out. So the bar is the thing that actually
	 * kills you, and it is a different thing per side —
	 *
	 *   red   the loudest region you are working in. Heat is what gives you away,
	 *         and at 80 a region surfaces whatever is hiding in it.
	 *   blue  how much of the payload path red is standing on. Five steps and the
	 *         estate is gone.
	 *
	 * Same bar, opposite meaning, which is the asymmetry the whole game is about.
	 */
	readonly standing = $derived.by(() => {
		if (this.seat.faction === 'red') {
			return 100 - Math.max(...TERRITORY_ORDER.map((t) => this.heat[t]));
		}
		return 100 - Math.round((this.chainHeld.length / CHAIN.length) * 100);
	});

	/** What the standing bar is measuring, in one word, for the seat reading it. */
	readonly standingLabel = $derived(this.seat.faction === 'red' ? 'exposure' : 'estate');

	/** Which links on the payload path are cut. A sealed building severs the leg
	 *  INTO it and the leg out of it — the board should show both ends. */
	readonly severedLinks = $derived.by(() => {
		const out: Array<{ from: string; to: string }> = [];
		CHAIN.forEach((s, i) => {
			const next = CHAIN[i + 1];
			if (!next) return;
			if (this.quarantined.includes(s.id) || this.quarantined.includes(next.id)) {
				out.push({ from: s.id, to: next.id });
			}
		});
		return out;
	});

	/** Bars are drawn for the payload path, whatever is selected, and anything
	 *  known to be held. Sixteen bars on a spinning globe is wallpaper. */
	readonly boardBars = $derived.by(() => {
		const ids = new Set<string>(CHAIN.map((s) => s.id));
		if (this.selectedId) ids.add(this.selectedId);
		for (const f of this.visible) ids.add(f.structure_id);
		if (this.drag?.over) ids.add(this.drag.over);
		return [...ids]
			.map((id) => structureById(id))
			.filter((s): s is Structure => !!s)
			.map((s) => this.barFor(s));
	});

	/** A ripple has to land somewhere, and for a fogged action it must NOT be the
	 *  building that was touched — that is the fact being withheld. */
	readonly foggedAnchorId = $derived.by(() => {
		const id = this.activeFx?.toId;
		const t = id ? structureById(id)?.territory : null;
		if (!t) return null;
		return STRUCTURES.find((s) => s.territory === t && s.id !== id)?.id ?? id ?? null;
	});

	/**
	 * Where this match's decisions actually get made.
	 *
	 * Null for a local game: the engine below is the authority and mutates
	 * itself. Set for a networked one, and the three methods that CHANGE the
	 * board become requests instead — the server rules, and the answer arrives
	 * as a snapshot through `applyRemote`.
	 *
	 * Deliberately not "send an action and also apply it locally". An optimistic
	 * update is a second implementation of a rule, and the copy that disagrees is
	 * always the one on the screen.
	 */
	remote: RemotePort | null = null;

	#pendingTimer: ReturnType<typeof setTimeout> | null = null;

	/** Verdicts waiting for the one on screen to finish, and the last one played.
	 *  Plain, not `$state`: they order the cinema, and nothing renders them. */
	#beatQueue: RemoteResolution[] = [];
	#playedSeq = 0;

	/** The turn whose clock has already run out, as `round:phase`. Plain, not
	 *  `$state`: it exists to stop an effect firing twice, and a reactive one
	 *  would be a dependency of the effect that writes it. */
	#timedOutOn: string | null = null;

	/** Hold the controls until the answer lands, or until it plainly is not
	 *  going to. */
	#awaitRemote() {
		this.pending = true;
		if (this.#pendingTimer) clearTimeout(this.#pendingTimer);
		this.#pendingTimer = setTimeout(() => {
			this.#pendingTimer = null;
			this.pending = false;
		}, REMOTE_ACK_MS);
	}

	/**
	 * Take the server's board.
	 *
	 * Only the authoritative fields are written. Selection, arming, drag, the
	 * dealt count and whatever effect is on screen are this browser's own
	 * business — the server neither knows nor cares which card you are hovering,
	 * and clobbering them here would yank the card out of a player's hand every
	 * time somebody else moved.
	 *
	 * The hand IS synced, and has to be. It used to be exempt on the reasoning
	 * that "the server deals the same fixed four cards this seat already holds"
	 * — true only while `handFor` returned every card a character owned. The
	 * server now has a real shuffled pile, and a browser that keeps its own is a
	 * second deal: the two agree on nothing but the card names, so every commit
	 * names a card this seat is holding here and not there, and the table
	 * refuses it with "the Maintainer is not holding Earnest Contribution".
	 */
	applyRemote(m: RemoteMatchView) {
		// The answer arrived, whatever it says. Even a board that came back
		// unchanged is the table having heard us.
		if (this.#pendingTimer) clearTimeout(this.#pendingTimer);
		this.#pendingTimer = null;
		this.pending = false;

		this.round = m.round;
		this.phase = m.phase;
		// Untracked, like `charges` below: this method runs inside an $effect, so
		// reading a field it also writes subscribes the effect to its own output.
		this.size = m.size ?? untrack(() => this.size);
		// Taken rather than recomputed. The server indexes its own seating, and a
		// client deriving the same answer from `phase` is a second implementation
		// of the turn order — which at 1v1 disagreed.
		this.activeKey = m.active_key || null;
		this.yourTurn = m.your_turn;
		this.seatKey = m.seat_key;
		this.winner = m.winner ? (m.winner as Faction) : null;
		this.footholds = m.footholds ?? [];
		// The server spells this `structure_id`; the board has always spelled it
		// `structureId`. Mapped rather than renamed on either side, because the
		// wire and the view are allowed to disagree — silently is the problem.
		this.garrison = (m.garrison ?? []).map((g) => ({
			uid: g.uid,
			structureId: g.structure_id,
			faction: g.faction,
			leaves: g.leaves,
			shape: g.shape,
			hue: g.hue,
			revealed: g.revealed,
			phase: g.phase
		})) as GarrisonUnit[];
		// Keyed on arrival rather than searched per read: `hardeningOf` runs once
		// per building per render, and a linear scan of eighteen sites inside a
		// derived is a cost paid on every frame for nothing.
		this.sites = Object.fromEntries((m.sites ?? []).map((s) => [s.id, s]));
		this.log = m.log ?? [];
		this.heat = m.heat;
		this.ap = m.ap;
		this.res = m.res;
		this.hardened = m.hardened ?? {};
		this.softened = m.softened ?? {};
		this.quarantined = m.quarantined ?? [];
		this.expiry = m.expiry ?? {};
		this.chip = m.chip ?? {};
		// Merged, not replaced: a seat is only ever sent its OWN power, and the
		// other chairs' charges are not the server's to clear on its behalf.
		//
		// The read is UNTRACKED, and that is load-bearing. `applyRemote` is called
		// from an $effect, so a plain `{ ...this.charges }` subscribes that effect
		// to `charges` and then writes it — with a fresh object identity every
		// snapshot, so the value never has to change for the effect to re-run.
		// Svelte cuts it off with `effect_update_depth_exceeded`, which presents as
		// the whole client locking solid the moment a match starts.
		if (m.power) {
			const prev = untrack(() => this.charges);
			this.charges = { ...prev, [m.power.key]: m.power.charges };
		}
		// A seat's own cards, from the only deck that counts. Merged rather than
		// replaced for the same reason as `charges`: a seat is sent nobody's hand
		// but its own, and the other chairs' cards are not the server's to clear
		// on its behalf. Untracked for the same reason too — see above.
		if (m.hand && m.seat_key) {
			const prev = untrack(() => this.hands);
			// `enteredAt` is carried over per UID so the fan animates the card that
			// actually just arrived. Rebuilt from scratch every snapshot, the whole
			// hand would read as new and the deal would replay on every move
			// anybody at the table made.
			const held = new Map((prev[m.seat_key] ?? []).map((c) => [c.uid, c.enteredAt]));
			const now = Date.now();
			this.hands = {
				...prev,
				[m.seat_key]: m.hand.map((c) => ({
					uid: c.uid,
					key: c.key,
					enteredAt: held.get(c.uid) ?? now
				}))
			};
			// Same reveal-by-index problem, for a hand that grows after the deal.
			// Only once the ceremony is over — during it the count is the animation
			// and raising it here would throw all four cards at once.
			if (untrack(() => this.stage) === 'play') {
				this.dealtCount = Math.max(untrack(() => this.dealtCount), m.hand.length);
			}
		}
	}

	// ── Reads ──────────────────────────────────────────────────────────────────
	atStructure(id: string, faction: Faction) {
		return this.garrison.filter((g) => g.structureId === id && g.faction === faction);
	}

	hardeningOf(id: string): number {
		const s = structureById(id);
		if (!s) return 0;
		// Take the authority's number when there is one. The local computation
		// below is for the offline table, where nobody else is keeping score —
		// and it stays only until the rules module (cmd/breachwasm) hosts that
		// table too, at which point the whole of the rest of this method goes.
		const sent = this.sites[id];
		if (sent) return sent.hardening;
		// The Architect's passive is a standing wall, not an action — it has to
		// show up in the number a player reads off the sheet. Seated-checked for
		// the same reason as the upgrades below: `#refillAp` hands AP to chairs
		// off `seatOrder`, but an absent Architect that ever holds one would wall
		// the Foundry from outside the match.
		const seatedBlue = this.seatOrder.map(klassByKey).filter((k) => k.faction === 'blue');
		const reproducible =
			seatedBlue.some((k) => k.key === 'architect') &&
			this.ap.architect > 0 &&
			(id === 'forge' || id === 'silos')
				? 2
				: 0;
		// Every blue figure POSTED on the building is worth a point. This is what
		// makes the garrison a board piece rather than a sticker.
		const defenders = this.garrison.filter(
			(g) => g.structureId === id && g.faction === 'blue' && g.leaves === 'garrison'
		).length;
		// Blue's `harden` upgrades are a standing wall across their whole estate,
		// so they show up in the number an attacker reads off the sheet — but
		// only from chairs somebody is in. Summed over the whole ROSTER this
		// handed blue the absent Threat Hunter's Attribution Engine at 1v1: +2 on
		// every blue building from round 9, from a character not in the match,
		// and the server resolved against the lower number the whole time.
		const upgraded =
			TERRITORIES[s.territory].owner === 'blue'
				? seatedBlue.reduce((n, k) => n + bonus(k, this.round, 'harden'), 0)
				: 0;
		// A building never defends at less than 4 — even a fully socially-
		// engineered project still has someone who might read the diff.
		return Math.max(
			4,
			s.hardening +
				(this.hardened[id] ?? 0) +
				reproducible +
				defenders +
				upgraded -
				(this.softened[id] ?? 0) -
				(this.chip[id] ?? 0)
		);
	}

	/**
	 * A building's health bar. `base` is what it stands at when nothing has been
	 * done to it, so the fill reads as condition rather than as an absolute — a
	 * Checkpoint at 13 and a Sandbox at 6 are both "intact", and both look it.
	 */
	barFor(s: Structure): StatusBar {
		const value = this.hardeningOf(s.id);
		const f = this.visibleOn(s.id);
		return {
			id: s.id,
			name: s.name,
			step: s.chain ?? null,
			regionColor: TERRITORIES[s.territory].color,
			region: TERRITORIES[s.territory].name,
			value,
			base: s.hardening,
			held: !!f,
			persistent: !!f?.persistent,
			staged: !!f?.staged,
			sealed: this.quarantined.includes(s.id),
			tone: f ? 'bad' : value < s.hardening ? 'warn' : 'ok',
			red: this.visibleGarrison.filter((g) => g.structureId === s.id && g.faction === 'red')
				.length,
			blue: this.visibleGarrison.filter((g) => g.structureId === s.id && g.faction === 'blue')
				.length
		};
	}

	attackBlocked(actor: Klass, a: Ability, s: Structure): Block | null {
		if (a.kind !== 'strike' && a.kind !== 'implant') return null;
		if (this.quarantined.includes(s.id))
			return { kind: 'sealed', text: `${s.name} is sealed — the roll will be blocked` };
		if (!s.chain) return null;
		const prev = CHAIN.find((c) => c.chain === (s.chain ?? 0) - 1);
		if (!prev) return null; // the first step is always open

		// ── The path no longer runs in order, except at the end ─────────────────
		// It used to: every rung was refused until the one before it was held. That
		// rule was the same rule TWICE, because `leverageFor` already enforces it
		// with dice. Holding the step before is worth +1 to +5 on the attack, which
		// against a wall of 11 is the difference between needing 5+ (83%) and 9+
		// (28%). Order was already the overwhelmingly better line.
		//
		// What the hard gate added on top was the removal of a decision. Red had
		// exactly one legal chain target at any moment, so "where do I attack" was
		// answered by the rulebook rather than by a player, and blue's mirror of
		// that question — where do I defend — collapsed with it. Eighteen buildings
		// on the board and one of them actionable.
		//
		// So rungs 2–4 are open whenever. Jumping ahead is legal, expensive, and
		// leaves you nothing to build the next one from; blue keeps a focal point
		// because the cheap attack is still the next step, but now has to decide
		// whether to cover a flank as well.
		//
		// The PAYLOAD is different in kind and keeps its gate. You may improvise
		// your way through the middle; you may not deliver without owning the
		// chain. It is also the victory move — `checkVictory` wants all five — so
		// the last rung requires the other four rather than merely the one before
		// it, and taking it is the win.
		if (s.chain === CHAIN.length) {
			const missing = CHAIN.filter(
				(c) => c.id !== s.id && !this.footholds.some((f) => f.structure_id === c.id)
			);
			if (missing.length)
				return {
					kind: 'hard',
					text:
						missing.length === 1
							? `take ${missing[0].name} first — the payload needs the whole chain`
							: `${missing.length} steps still to take — the payload needs the whole chain`
				};
		}

		// A held-but-severed upstream step still cuts the line it would have fed.
		if (
			this.footholds.some((f) => f.structure_id === prev.id) &&
			this.quarantined.includes(prev.id)
		)
			return {
				kind: 'sealed',
				text: `the line from ${prev.name} is cut — the roll will be blocked`
			};
		return null;
	}

	blockedReason(a: Ability, s: Structure): Block | null {
		if (!canTarget(a, s, this.seat.faction))
			return { kind: 'hard', text: 'not your side of the board' };
		return this.attackBlocked(this.seat, a, s);
	}

	/**
	 * LEVERAGE — what a foothold is worth once you have it.
	 *
	 * A chain of five independently hard fights is five unrelated fights. A real
	 * intrusion compounds: the ground you already hold is where you attack the
	 * next thing FROM.
	 *
	 *   +1  you hold the previous step at all — you are attacking from inside
	 *   +1  per implant left standing there, to 2 — persistence you can use
	 *   +2  the foothold is STAGED — you spent a turn digging in
	 */
	leverageFor(s: Structure): number {
		if (!s.chain) return 0;
		const prev = CHAIN.find((c) => c.chain === (s.chain ?? 0) - 1);
		if (!prev) return 0;
		const f = this.footholds.find((x) => x.structure_id === prev.id);
		if (!f || this.quarantined.includes(prev.id)) return 0;
		const implants = this.garrison.filter(
			(g) => g.structureId === prev.id && g.faction === 'red' && g.leaves === 'implant'
		).length;
		return 1 + Math.min(2, implants) + (f.staged ? 2 : 0);
	}

	// ── Upgrades ───────────────────────────────────────────────────────────────
	/** What the seated player's track is currently adding to every roll. Exposed
	 *  because the HUD shows the TOTAL skill, not the printed one — a number that
	 *  disagrees with the dice is worse than no number. */
	readonly rollBonus = $derived(bonus(this.seat, this.round, 'roll'));

	/** Action points a seat gets at the top of a round — three, plus track. */
	maxAp(klass: Klass = this.seat): number {
		return 3 + bonus(klass, this.round, 'ap');
	}

	/** The three-slot track for a seat, whatever round it is. */
	track(klass: Klass = this.seat): Upgrade[] {
		return trackFor(klass);
	}

	/** The ones online for a seat right now. */
	unlocked(klass: Klass = this.seat): Upgrade[] {
		return unlockedFor(klass, this.round);
	}

	oddsFor(actor: Klass, a: Ability, t: Structure) {
		const attacking = a.kind === 'strike' || a.kind === 'implant';
		return computeOdds({
			holdMod: attacking && actor.faction === 'red' ? this.leverageFor(t) : 0,
			hardening: attacking ? this.hardeningOf(t.id) : undefined,
			dc: a.dc,
			// The seat's own rating, plus whatever their track has come to be worth.
			skill: actor.skills[a.skill] + bonus(actor, this.round, 'roll'),
			abilityMod: a.mod,
			// Accrued trust rides an attack, not a control — you cannot spend a
			// reputation to make a build more reproducible.
			resourceMod:
				attacking && actor.faction === 'red' ? Math.min(this.res[actor.key] ?? 0, 3) : 0,
			defenceMod: attacking && this.quarantined.includes(t.id) ? 4 : 0
		});
	}

	/** Nothing but a strike or an implant rolls dice. A control is bought, and
	 *  buying one is most of what both sides spend their turns doing. */
	rollsDice(actor: Klass, a: Ability) {
		return actor.faction === 'red' && (a.kind === 'strike' || a.kind === 'implant');
	}

	// ── Lifecycle ──────────────────────────────────────────────────────────────
	/**
	 * Start the clocks. Returns a teardown. Nothing here runs at import, and the
	 * effects are rooted so this works from a class rather than a component.
	 */
	start(): () => void {
		return $effect.root(() => {
			// Reset on every change of turn. Reads phase and round only.
			//
			// The expiry marker is wound back here rather than anywhere else so
			// it can never outlive the clock it guards: both are facts about the
			// turn identified by `round:phase`, and one surviving a change the
			// other did not is how a fresh turn arrives already spent.
			$effect(() => {
				void this.phase;
				void this.round;
				this.#timedOutOn = null;
				this.turnLeft = this.turnMs;
			});

			$effect(() => {
				if (this.stage !== 'play' || this.winner) return;
				const t = setInterval(() => {
					if (this.busy) return;
					this.turnLeft = Math.max(0, this.turnLeft - TURN_TICK);
				}, TURN_TICK);
				return () => clearInterval(t);
			});

			// Out of time.
			//
			// On a networked table only the seat whose turn it is asks. Every
			// browser at the table runs this same clock, so without the guard
			// three of the four ask the server to end a turn that is not theirs
			// and get three refusals across the screen for a turn nobody did
			// anything wrong in. The log line is the server's there too — the
			// next snapshot overwrites `log` wholesale, so a local one is a
			// sentence that flickers and vanishes.
			$effect(() => {
				if (this.turnLeft > 0 || this.busy || this.winner || this.stage !== 'play') return;
				if (this.remote && !this.isMyTurn) return;
				// A turn runs out once. Locally that is free — `endTurn` moves the
				// phase and the clock resets before this could run again — but a
				// networked turn ends only when the SERVER says so, which may be
				// never if it refuses. Without the marker the clock would sit at
				// zero re-asking for the same turn for as long as the table was
				// up.
				const turn = `${this.round}:${this.phase}`;
				if (this.#timedOutOn === turn) return;
				this.#timedOutOn = turn;
				const out = this.activeKlass;
				if (!this.remote) {
					// The clock is the one thing on the board everybody watches, so a
					// chair running it out is public whoever's chair it was. No card
					// and no building: nothing was played.
					this.#played(
						'all',
						{ by: out, loud: true },
						{
							when: `R${this.round}`,
							title: 'out of time',
							subject: `${out.name} — out of time`,
							icon: 'clock',
							tone: 'warn',
							qualifiers: ['turn passed', `${this.ap[out.key] ?? 0} AP unspent`]
						}
					);
				}
				this.endTurn();
			});

			// Out of action points. A short beat first so the last card's result is
			// read before the board moves on.
			//
			// Same rule as the clock above: a spent seat is spent on every screen
			// at the table, and only the player sitting in it may say so.
			$effect(() => {
				if (this.busy || this.winner || this.stage !== 'play') return;
				if (this.remote && !this.isMyTurn) return;
				if ((this.ap[this.activeKlass.key] ?? 0) > 0) return;
				const id = setTimeout(() => this.endTurn(), 900);
				return () => clearTimeout(id);
			});

			$effect(() => {
				if (!this.diceSpin) return;
				const t = setInterval(() => {
					this.diceFaces = [
						1 + Math.floor(Math.random() * 6),
						1 + Math.floor(Math.random() * 6)
					];
				}, 70);
				return () => clearInterval(t);
			});

			// The demonstrator, re-armed on every phase change. Per CHAIR: it plays
			// the seats nobody is in and leaves the rest alone, so nobody has to
			// switch it on and it never plays over a person.
			//
			// Never on a networked table. The server plays its own empty chairs, and
			// a browser doing it as well is two authorities on one turn.
			//
			// `stage` is load-bearing now that the gate is the SEATING: that is known
			// while the lobby is still open, and without this the demonstrator would
			// start playing a match nobody had entered.
			//
			// `phase` is read even though the gate already depends on it: two
			// automatic chairs in a row leave the gate at `true`, and an effect
			// whose dependency did not change does not re-run.
			$effect(() => {
				if (this.stage !== 'play' || this.remote || this.busy || this.winner) return;
				if (!this.activeIsAutomatic) return;
				void this.phase;
				const id = setTimeout(() => void this.aiTurn(), 900);
				return () => clearTimeout(id);
			});
		});
	}

	/**
	 * Take a chair and deal. The cards are fired one at a time from the dispenser
	 * — 130ms apart, fast enough to read as one motion and slow enough that you
	 * watch each card land somewhere different.
	 */
	async takeSeat(key: string) {
		this.seatKey = key;
		this.phase = Math.max(0, this.seatOrder.indexOf(key));
		this.armedKey = null;
		this.inspectKey = null;
		this.dealtCount = 0;
		this.stage = 'deal';
		// Only an offline table deals itself. On a networked one the cards are
		// already here — the snapshot that said "playing" carried them — and
		// shuffling a second deck over the top is the desync this whole path was
		// built around: the animation would throw four cards the server has never
		// heard of, and every one of them refused on commit.
		if (!this.remote) this.dealTable();
		await this.#pace(280);
		const hand = this.handOf(key);
		for (let i = 0; i < hand.length; i++) {
			this.dealtCount = i + 1;
			await this.#pace(130);
		}
		await this.#pace(420);
		// The fan reveals by index, so a ceremony that ran before the server's
		// cards landed would leave them dealt and permanently off-screen. Ending
		// on the hand as it stands now costs an offline table nothing.
		this.dealtCount = Math.max(this.dealtCount, this.handOf(key).length);
		this.stage = 'play';
	}

	/**
	 * Build both piles and deal every chair.
	 *
	 * Every seated hand is dealt, not just yours: the demonstrator plays the
	 * others and it has to be drawing from the same finite pile you are, or "the
	 * deck ran out" is a rule that applies to one player.
	 *
	 * PUBLIC because `takeSeat` is a local ceremony — the animated deal a browser
	 * plays for itself — and the authoritative server skips it entirely, setting
	 * `stage` and starting the clock directly. It still has to deal, so the deal
	 * cannot be welded to the animation.
	 */
	dealTable() {
		const piles: Record<Faction, HandCard[]> = { red: buildDeck('red'), blue: buildDeck('blue') };
		const hands: Record<string, HandCard[]> = {};
		const charges: Record<string, number> = {};
		for (const seatKey of this.seatOrder) {
			const side = klassByKey(seatKey).faction;
			const dealt = openingHand(seatKey, piles[side], HAND_SIZE);
			hands[seatKey] = dealt.hand;
			piles[side] = dealt.pile;
			// Dealt with the hand although it is not in it: a power is issued with
			// the chair, and a chair nobody is sitting in has no charges to spend.
			const power = powerOf(seatKey);
			if (power) charges[power.key] = power.uses;
		}
		this.piles = piles;
		this.discards = { red: [], blue: [] };
		this.hands = hands;
		this.charges = charges;
	}

	/**
	 * Pay for a move.
	 *
	 * The only place the two kinds of move differ. A card leaves the hand for the
	 * discard and a replacement is drawn; a power burns a charge and stays where
	 * it is, which is the promise the discard pile used to break.
	 */
	#spend(seatKey: string, key: string) {
		const power = powerOf(seatKey);
		if (power?.key === key) {
			this.charges = { ...this.charges, [key]: Math.max(0, this.chargesOf(key) - 1) };
			return;
		}
		this.#spendCard(seatKey, key);
	}

	/**
	 * Spend a card: out of the hand, into its side's discard, and draw a
	 * replacement. Called on every commit, which is what keeps a hand at four
	 * without the caller having to remember to refill it.
	 */
	#spendCard(seatKey: string, key: string) {
		const side = klassByKey(seatKey).faction;
		const hand = this.handOf(seatKey);
		const i = hand.findIndex((c) => c.key === key);
		if (i < 0) return;
		const [spent] = hand.splice(i, 1);
		this.hands = { ...this.hands, [seatKey]: [...hand] };
		this.discards = { ...this.discards, [side]: [...this.discards[side], spent] };
		this.#drawTo(seatKey, HAND_SIZE);
	}

	/**
	 * Draw a seat back up to `size`.
	 *
	 * A dry pile reshuffles the discard rather than ending the game — running out
	 * of cards is not one of the two ways BREACH is meant to end.
	 */
	#drawTo(seatKey: string, size: number) {
		const side = klassByKey(seatKey).faction;
		let pile = [...this.piles[side]];
		let discard = [...this.discards[side]];
		const hand = [...this.handOf(seatKey)];

		while (hand.length < size) {
			if (!pile.length) {
				if (!discard.length) break; // both empty — play on with a short hand
				pile = shuffle(discard);
				discard = [];
			}
			hand.push(pile.shift()!);
		}

		this.hands = { ...this.hands, [seatKey]: hand };
		this.piles = { ...this.piles, [side]: pile };
		this.discards = { ...this.discards, [side]: discard };
	}

	/** Re-deal on a seat swap so a switched chair still gets its hand thrown to
	 *  it rather than appearing fully formed. */
	switchSeat(key: string) {
		if (this.busy) return;
		void this.takeSeat(key);
	}

	/**
	 * Sit down in a chair the demonstrator is playing.
	 *
	 * A SWAP, not a second chair: the seat you got up from becomes automatic in
	 * the same breath. One person is one player, and a chair left holding nobody
	 * would sit on the clock until it timed out, every round, forever.
	 *
	 * Nothing here pauses anything. The demonstrator's gate is `players`, so the
	 * chair stops playing itself because it is no longer a chair that plays
	 * itself — and the one you left starts, for the same reason.
	 *
	 * Refused, and each refusal is a different question:
	 *
	 *   - the table's settings did not offer it
	 *   - the server owns the seating, and a client moving itself is a lie
	 *   - a resolution is playing out
	 *   - THE CHAIR IS SOMEBODY'S. A person is not a chair you can take, and an
	 *     unstated chair is refused too: "nobody said" is not "nobody is there".
	 */
	claim(klassKey: string): boolean {
		if (!this.takeover || this.remote || this.busy || this.winner) return false;
		if (klassKey === this.seatKey) return false;
		if (this.players[klassKey]?.kind !== 'ai') return false;

		const you = this.players[this.seatKey];
		this.players = {
			...this.players,
			[klassKey]: { name: you?.name ?? 'you', kind: 'human' },
			[this.seatKey]: { name: `${this.seat.seat} · demonstrator`, kind: 'ai' }
		};
		this.seatKey = klassKey;
		// Everything below is aimed at a board from the other chair's point of
		// view, and none of it survives the move.
		this.armedKey = null;
		this.inspectKey = null;
		this.selectedId = null;
		this.lastRoll = null;
		return true;
	}

	/** Back to round one with an empty board. Everything a match accumulates
	 *  lives in these values, which is the argument for keeping them together. */
	newMatch() {
		if (this.remote) {
			this.remote.newMatch();
			return;
		}
		this.busy = false;
		this.activeFx = null;
		// A scene left running would hold the camera seized into the next match.
		this.#cinema.cut();
		this.povLive = false;
		// An announcement left up would headline the last match's roll over an
		// empty board.
		this.verdict = null;
		this.winner = null;
		this.auto = false;
		this.round = 1;
		this.phase = 0;
		this.#beatQueue = [];
		this.#playedSeq = 0;
		this.footholds = [];
		this.heat = { staging: 0, outlands: 0, commons: 0, foundry: 0, marches: 0 };
		this.#refillAp();
		this.res = { maintainer: 0, state: 0, architect: 2, hunter: 2 };
		this.sites = {};
		this.hardened = {};
		this.softened = {};
		this.quarantined = [];
		this.expiry = {};
		this.chip = {};
		this.log = [...OPENING];
		this.selectedId = null;
		this.armedKey = null;
		this.inspectKey = null;
		this.lastRoll = null;
		this.dealtCount = 0;
		this.garrison = [];
		// Fresh piles, fresh hands. A deck carried over from the last match is the
		// one accumulated value that would survive "new match".
		this.piles = { red: [], blue: [] };
		this.discards = { red: [], blue: [] };
		this.hands = {};
		this.charges = {};
		this.stage = 'select';
	}

	// ── Board mutation ─────────────────────────────────────────────────────────
	/**
	 * One-shot markers. Discovering something, cleaning something out and an
	 * implant burrowing all happen OUTSIDE a card's resolve animation, and each
	 * is a thing the player needs to see happen at a place.
	 */
	ping(structureId: string, kind: BoardPing['kind']) {
		const p = { id: `p${this.#pingSeq++}`, structureId, kind, at: performance.now() };
		this.pings = [...this.pings, p];
		setTimeout(() => (this.pings = this.pings.filter((x) => x.id !== p.id)), 1600);
	}

	/**
	 * Leave something behind — but only for the cards that should. An action card
	 * sends its squad, the squad does the job, and the squad withdraws. A combat
	 * card leaves an implant or a garrison, and that is a piece with a life.
	 *
	 * Returns how many actually took position, the way `rout` returns how many
	 * fell. A blue figure IS a point of hardening, so the caller that logs the
	 * wall going up has to report what fit rather than what was sent —
	 * `GARRISON_CAP` eats the remainder, and a feed printing +3 when two arrived
	 * misstates the number an attacker has to beat.
	 */
	deploy(actor: Klass, a: Ability, structureId: string, count: number): number {
		const fx = fxFor(a.key, actor.faction);
		if (fx.leaves === 'nothing' || count <= 0) return 0;
		const mine = this.atStructure(structureId, actor.faction);
		const room = Math.max(0, GARRISON_CAP - mine.length);
		const n = Math.min(count, room);
		if (n <= 0) return 0;
		this.garrison = [
			...this.garrison,
			...Array.from({ length: n }, () => ({
				uid: `u${this.#unitSeq++}`,
				structureId,
				faction: actor.faction,
				leaves: fx.leaves as 'implant' | 'garrison',
				shape: fx.squad.shape,
				hue: fx.hue,
				revealed: actor.faction === 'blue',
				phase: (this.#unitSeq * 137) % 360
			}))
		];
		return n;
	}

	/** Take units off a building. Returns how many actually fell. */
	rout(structureId: string, faction: Faction, n: number, kind?: 'implant' | 'garrison'): number {
		const doomed = this.atStructure(structureId, faction)
			.filter((g) => !kind || g.leaves === kind)
			.slice(0, n)
			.map((g) => g.uid);
		if (!doomed.length) return 0;
		this.garrison = this.garrison.filter((g) => !doomed.includes(g.uid));
		return doomed.length;
	}

	/** Its own prefix, so a played row can never collide with a seeded one. */
	push(see: Audience, e: LogDraft) {
		// A draft may say `actor: null` to mean "deliberately unattributed". The
		// stored row spells that as ABSENT — presence tests `row.actor` for
		// truthiness, and a null that survives into the log is a field that reads
		// as attributed to nobody rather than as unattributed.
		const { actor, ...rest } = e;
		// Untracked, and load-bearing: this is a read-modify-write of `log`, and
		// an effect that logs would otherwise take a dependency on the very
		// state it just wrote — it re-runs, logs again, and the page dies with
		// `effect_update_depth_exceeded`. Writing a line is never a reason for
		// the writer to run again.
		const previous = untrack(() => this.log);
		this.log = [
			{ ...rest, ...(actor ? { actor } : {}), see, id: `play-${this.#logSeq++}` },
			...previous
		].slice(0, 40);
	}

	/**
	 * A row somebody DID — attributed, and fogged on the way in.
	 *
	 * `hidden = fogged && !loud` is `#stage`'s rule, restated once here instead
	 * of at every push site. Two copies of the fog rule drifting apart is a leak
	 * that reads as the fog merely being generous, and it is silent.
	 *
	 * Everything withheld is withheld by never being SET. `where` survives
	 * regardless — the region is exactly what the defender is owed and no more —
	 * and the building, the card and what they moved go together, because a
	 * delta hanging off a region nobody may name is a number with nothing to
	 * attach to.
	 */
	#played(see: Audience, act: Act, e: LogDraft) {
		const hidden = act.by.faction !== this.seat.faction && !act.loud;
		this.push(see, {
			...e,
			round: this.round,
			...(act.at ? { where: act.at.territory } : {}),
			...(hidden
				? {}
				: {
						actor: act.by.key,
						// Who may know WHO. Closed to the actor's own side unless the move
						// announced itself, which is the same threshold the board uses.
						actorSee: act.loud ? ('all' as const) : act.by.faction,
						...(act.card ? { card: act.card.key } : {}),
						...(act.at ? { structure: act.at.id } : {}),
						// Tested against `undefined`, not for truth: zero is a real
						// answer. "Ran at the wall and moved it nothing" is a different
						// row from "never touched the wall", and a truthiness check
						// collapses the two into the same silence.
						...(act.delta !== undefined ? { delta: act.delta } : {}),
						...(act.outcome ? { outcome: act.outcome } : {})
					})
		});
	}

	/** What a red action looks like from the other side of the table: a number
	 *  moved and nobody can say why. This is the only thing blue is owed. */
	pushHeatTell(t: TerritoryKey, added: number) {
		if (added <= 0) return;
		// Attributed to nobody on purpose, and that is the whole row: a territory
		// and a number. `where` is set anyway, because "somebody was in the
		// Commons" is the tell.
		this.push('blue', {
			round: this.round,
			where: t,
			when: `R${this.round}`,
			title: 'detection rose in',
			subject: TERRITORIES[t].name,
			icon: 'activity',
			tone: 'warn',
			qualifiers: [`+${added}`, 'cause unknown']
		});
	}

	/** Where an action comes FROM on the map. A vector with no origin is a colour
	 *  appearing on a building; with one it is a move. */
	originFor(faction: Faction, t: Structure): string | null {
		const first = faction === 'blue' ? 'keep' : this.lastHeldId();
		if (first && first !== t.id) return first;
		// A squad that spawns on top of the building it is attacking never reads
		// as having gone anywhere.
		const neighbour = STRUCTURES.find((s) => s.territory === t.territory && s.id !== t.id);
		return neighbour?.id ?? CORE_ID;
	}

	lastHeldId(): string | null {
		const held = CHAIN.filter((s) => this.footholds.some((f) => f.structure_id === s.id));
		return held.length ? held[held.length - 1].id : null;
	}

	// ── Resolution ─────────────────────────────────────────────────────────────
	resolve() {
		if (this.remote) {
			// The server decides. It needs the card and the place; everything else
			// it already knows better than this browser does.
			if (!this.ready) return;
			this.remote.commit(this.armedKey!, this.selectedId!);
			this.#awaitRemote();
			return;
		}
		if (!this.ready) return;
		void this.perform(this.seat, this.armed!, this.target!);
	}

	/**
	 * One resolution, played out rather than applied. The state change is the
	 * same either way — what the beats buy is that the player watches it happen
	 * to a place on a map instead of noticing a number is different.
	 *
	 * `actor` is separate from the seat being VIEWED, because when the other
	 * three chairs play themselves the fog has to be computed between the two.
	 */
	async perform(actor: Klass, a: Ability, t: Structure, dice?: [number, number]) {
		// On a networked table this method is a PERFORMANCE, never a decision. The
		// server has already ruled, and `dice` carries the faces it ruled with —
		// so dice present is a replay and is welcome, dice absent is somebody
		// asking this browser to decide a game it does not own. Refuse it here
		// rather than trusting every call site to route through `resolve`: one of
		// them did not, and the result was a foothold that existed in one browser
		// and nowhere else.
		if (this.remote && !dice) return;
		this.armedKey = null;
		this.ap[actor.key] -= a.ap;
		// The card leaves the hand as it is played, and a replacement is drawn
		// immediately — a seat is always looking at four, so "what can I do" never
		// depends on remembering to refill.
		this.#spend(actor.key, a.key);

		const attacking = this.rollsDice(actor, a);
		// Fog rule: an action by the other side is never SHOWN, only felt.
		const fogged = actor.faction !== this.seat.faction;
		const plan = { faction: actor.faction, actor, ability: a, target: t, fogged, attacking };

		// Ran at a seal. The card is spent, the squad goes, the dice fly — and the
		// barrier swats them out of the air before they can land on anything.
		if (this.attackBlocked(actor, a, t)?.kind === 'sealed') {
			await this.#stage({
				...plan,
				sealed: true,
				roll: null,
				loud: true,
				apply: () => this.applySeal(actor, a, t)
			});
			return;
		}

		const o = this.oddsFor(actor, a, t);
		const r = dice ? { dice, total: dice[0] + dice[1] } : roll2d6(this.#dice);
		const total = r.total + o.modifier;
		const margin = total - o.target;
		const outcome = outcomeFor(margin);
		const hit = succeeded(outcome);

		await this.#stage({
			...plan,
			sealed: false,
			roll: { dice: r.dice, total, hit, outcome, margin },
			// An attack that FAILED is public whoever threw it — walls make a noise.
			loud: attacking && !hit,
			apply: () => {
				if (attacking) {
					this.applyStrike(actor, a, t, o.target, total, outcome);
					return;
				}
				// They arrive and they stay — but only if the attempt worked. How many
				// FIT is the number blue's log has to quote, so it is carried down
				// rather than recomputed from a squad size the cap may have trimmed.
				const placed = hit
					? this.deploy(actor, a, t.id, fxFor(a.key, actor.faction).squad.count)
					: 0;
				if (actor.faction === 'blue') this.applyBlue(actor, a, t.id, outcome, placed);
				else this.applyRedSupport(actor, a, t.id, outcome);
			}
		});
	}

	/**
	 * Play a verdict decided somewhere else.
	 *
	 * The snapshot carrying this resolution is applied BEFORE the beats run — the
	 * foothold is already placed, the heat is already up — so everything the
	 * animation shows comes off `res` and none of it off the board.
	 */
	async playResolution(res: RemoteResolution) {
		// Seq is the server's order and the only one there is. A fresh match
		// restarts it at 1, which is also how a client that watched the last one
		// knows to stop refusing everything.
		if (res.seq === 1) this.#playedSeq = 0;
		if (res.seq <= this.#playedSeq) return;
		if (this.busy) {
			// Behind the one on screen, never interleaved with it — two resolutions
			// sharing `activeFx` is one animation wearing the other's dice.
			if (this.#beatQueue.length >= BEAT_QUEUE_MAX) this.#beatQueue.shift();
			this.#beatQueue.push(res);
			return;
		}
		this.#playedSeq = res.seq;
		const beat = this.#beatFor(res);
		if (beat) await this.#stage(beat);
		const next = this.#beatQueue.shift();
		if (next) await this.playResolution(next);
	}

	/** A server verdict, as beats. Null for a region this board does not have,
	 *  which is a server this client is too old to draw. */
	#beatFor(res: RemoteResolution): Beat | null {
		const actor = res.actor_key ? klassByKey(res.actor_key) : null;
		const ability = (res.card_key ? abilityByKey(res.card_key) : undefined) ?? null;
		// A fogged action names no building, so the ripple hangs on an arbitrary one
		// in the right region and `foggedAnchorId` moves it off that one again.
		const target =
			(res.structure_id ? structureById(res.structure_id) : undefined) ??
			STRUCTURES.find((s) => s.territory === res.territory);
		if (!target) return null;
		return {
			faction: res.faction,
			actor,
			ability,
			target,
			fogged: res.faction !== this.seat.faction,
			attacking: !!actor && !!ability && this.rollsDice(actor, ability),
			sealed: !!res.sealed,
			roll: res.roll ?? null,
			loud: !!res.loud,
			swatSeed: res.seq
		};
	}

	/**
	 * The shortlist Attribution is choosing between, and who it lands on.
	 *
	 * Suspects are the whole opposing side rather than only the one holding the
	 * ground, because a lineup of one is not a lineup — the beat is about a set
	 * of candidates being narrowed, and narrowing from a single candidate is a
	 * label, not a search.
	 *
	 * `seat_key` is a klass key (see where footholds are placed), so it indexes
	 * the roster directly. A foothold whose owner is not on the roster, or no
	 * foothold at all, gives a lineup with no answer — the caller decides whether
	 * that is stageable.
	 */
	#lineupFor(structureId: string): Lineup | undefined {
		const held = this.visibleOn(structureId);
		const suspects = ROSTER.filter((k) => k.faction !== this.seat.faction);
		if (!suspects.length) return undefined;
		const answer = held ? suspects.findIndex((k) => k.key === held.seat_key) : -1;
		return { suspects, answer };
	}

	/**
	 * The beats, and only the beats.
	 *
	 * Split out of `perform` so a verdict ruled on somewhere else can be played
	 * through the same cinema. Nothing here reads the board — every value it shows
	 * was settled in the `Beat` before the first frame, which is what lets it run
	 * AFTER a state change instead of around one.
	 */
	async #stage(b: Beat) {
		this.busy = true;
		const fx = fxFor(b.ability?.key ?? '', b.faction);
		const beats = b.attacking ? BEATS : QUIET_BEATS;
		// The dice are rolled into the middle of the REGION rather than thrown at
		// the house, so the renderer is told what the area is.
		const arena = STRUCTURES.filter((s) => s.territory === b.target.territory).map((s) => s.id);

		// A POV of the OTHER side's operator would hand the viewing seat the actor,
		// the building and the card in one shot — everything the fog rule exists to
		// withhold. So a fogged beat has no cutaway by construction rather than by
		// a check: it was never told any of it either.
		const pov = !b.fogged && b.actor && b.ability ? { who: b.actor, card: b.ability } : null;
		const cut: Cut | undefined = pov ? POV_CARDS[pov.card.key] : undefined;
		const povAt: PovBeat | undefined = cut?.at;
		const povFrom = povAt ? this.originFor(b.faction, b.target) : null;

		// Who the shot might name, when the shot's act is naming somebody.
		//
		// Built here rather than in the overlay because it is a BOARD fact — the
		// foothold standing on that building, and whose it is — and an overlay that
		// went looking for it would be a renderer reading state, which is the thing
		// `Beat` exists to stop. Absent when nothing is standing there: the shot
		// then has a shortlist and no answer, and says so.
		const lineup = cut?.shot === 'unmask' ? this.#lineupFor(b.target.id) : undefined;

		const povOpen = async () => {
			if (!pov) return;
			this.povLive = true;
			await this.#cinema.enter({
				fromId: povFrom,
				structureId: b.target.id,
				actor: pov.who.name,
				seat: pov.who.seat,
				subject: b.target.name,
				origin: povFrom ? structureById(povFrom)?.name : undefined,
				card: pov.card.name,
				word: fx.word,
				hue: fx.hue,
				power: fx.power,
				powerLabel: fx.powerLabel,
				skin: pov.who,
				lineup,
				shot: cut?.shot ?? 'insert'
			});
		};

		/** Always safe to call. In a `finally` because a scene cut short must
		 *  still give the HUD back: chrome left buried under a scrim is an
		 *  unrecoverable page. */
		const povClose = async () => {
			if (!this.povLive) return;
			try {
				await this.#cinema.leave();
			} finally {
				this.povLive = false;
			}
		};

		if (povAt === 'prelude') {
			await povOpen();
			await this.#cinema.hold();
			await povClose();
		} else if (povAt === 'full') {
			// Opened and left open. Everything below plays out underneath the visor.
			await povOpen();
		}

		// An action by the other side that made no noise at all is not even a
		// ripple. One whose card we were not told IS a ripple by definition — the
		// server chose to send it, and that is the whole of what we were sent.
		// The announcement, opened on the same clock as the effects below.
		//
		// `hidden` is the BOARD's fog rule, not a second one: `activeFx` below
		// un-fogs itself at the verdict beat when the move was loud, so a wall that
		// made a noise is public whoever threw it. Two renderers of one beat
		// disagreeing about what is secret is the bug this mirrors its way out of —
		// and the leak is silent, because it looks like the fog simply being
		// generous.
		//
		// Everything withheld is withheld by never being SENT. A fact that does not
		// reach the component cannot be leaked by one.
		const hidden = b.fogged && !b.loud;
		this.verdict = {
			id: ++this.#verdictSeq,
			faction: b.faction,
			actor: hidden ? null : (b.actor?.name ?? null),
			seat: hidden ? null : (b.actor?.seat ?? null),
			card: hidden ? null : (b.ability?.name ?? null),
			target: hidden ? null : b.target.name,
			territory: b.target.territory,
			word: hidden ? '' : fx.word,
			hue: fx.hue,
			fogged: hidden,
			sealed: b.sealed,
			roll: null,
			// The throw either reached this client or the fog ate it. Settled once,
			// here, from the beat — never re-derived by a renderer holding `roll`,
			// which is null mid-tumble for a throw that very much happened.
			throws: !!b.roll,
			stage: 'cast'
		};

		const showFx = !b.fogged || !b.ability || b.ability.noise > 0;
		this.activeFx = showFx
			? {
					id: ++this.#fxSeq,
					fromId: this.originFor(b.faction, b.target),
					toId: b.target.id,
					fx,
					fogged: b.fogged,
					outcome: 'pending',
					beats,
					startedAt: performance.now()
				}
			: null;

		if (b.sealed) {
			if (this.activeFx) {
				this.activeFx = {
					...this.activeFx,
					sealed: true,
					// Faces to swat out of the air. The throw was never made, so these
					// decide nothing and are never read back — but two people at one
					// table must still watch the same numbers get swatted, so a
					// networked seal seeds them off the server's seq rather than off
					// this browser's RNG.
					roll: {
						dice: roll2d6(
							b.swatSeed === undefined ? this.#dice : seededDice(b.swatSeed)
						).dice,
						total: 0,
						color: '#A78BFA'
					},
					arenaIds: arena
				};
			}
			await this.#pace(beats.diceStart);
			this.diceSpin = true;
			this.#say({ stage: 'rolling' });
			await this.#pace(beats.diceSettle - beats.diceStart);
			this.diceSpin = false;
			this.lastRoll = null;
			// No roll to show and none coming: the seal is the whole verdict.
			this.#say({ stage: 'done' });
			b.apply?.();
			await this.#pace(beats.unlock - beats.diceSettle);
			await povClose();
			this.activeFx = null;
			this.verdict = null;
			this.busy = false;
			return;
		}

		// Split at `arrive` so the scene can open with the squad already standing
		// at the building and the dice still in the hand.
		await this.#pace(beats.arrive);
		if (povAt === 'roll') await povOpen();
		await this.#pace(beats.diceStart - beats.arrive);
		this.lastRoll = null;
		if (this.activeFx && b.roll) {
			this.activeFx = {
				...this.activeFx,
				roll: { dice: b.roll.dice, total: b.roll.total, color: OUTCOME_COLOR[b.roll.outcome] },
				arenaIds: arena
			};
		}
		// Nothing to land on when the fog took the dice. The ripple keeps the same
		// clock and says nothing, which is the point.
		this.diceSpin = !!b.roll;
		this.#say({ stage: 'rolling' });
		await this.#pace(beats.diceSettle - beats.diceStart);
		this.diceSpin = false;
		if (b.roll) {
			this.diceFaces = b.roll.dice;
			this.lastRoll = b.roll;
		}
		// The number, the instant it is known — and a beat before anything is done
		// about it. That gap is the whole reason the announcement is worth
		// watching, and it is already in the beat table (`diceSettle` → `verdict`).
		//
		// A hidden move's dice stay hidden.
		this.#say({ stage: 'settled', roll: hidden ? null : b.roll });

		// The number is known and nothing has been done about it yet.
		if (povAt === 'verdict') await povOpen();

		await this.#pace(Math.max(0, beats.verdict - beats.diceSettle));
		this.activeFx = this.activeFx
			? {
					...this.activeFx,
					// A beat with no verdict in it — a fogged ripple — ends without
					// claiming one either way.
					outcome: b.roll ? (b.roll.hit ? 'breach' : 'ward') : 'done',
					fogged: b.loud ? false : this.activeFx.fogged
				}
			: null;

		this.#say({ stage: 'done' });

		await this.#pace(Math.max(0, beats.after - beats.verdict));
		b.apply?.();

		await this.#pace(Math.max(0, beats.unlock - beats.after));
		await povClose();
		this.activeFx = null;
		this.verdict = null;
		this.busy = false;
	}

	/** Advance the announcement without restating it. A patch rather than a
	 *  rebuild so `id` survives — a renderer keyed on it would otherwise restart
	 *  its entrance animation three times per resolution. */
	#say(patch: Partial<Verdict>) {
		if (!this.verdict) return;
		this.verdict = { ...this.verdict, ...patch };
	}

	/** Rattling a sealed door is the loudest thing you can do and the least
	 *  productive. */
	applySeal(actor: Klass, a: Ability, t: Structure) {
		const noise = (a.noise + 1) * 6;
		this.heat[t.territory] = Math.min(100, this.heat[t.territory] + noise);
		this.ping(t.id, 'sealed');
		// The loudest thing on the board, so nothing about it is withheld.
		this.#played(
			'all',
			{ by: actor, loud: true, at: t, card: a },
			{
				when: `R${this.round} · ${a.name}`,
				title: 'blocked',
				subject: `${t.name} — the seal held`,
				icon: 'lock',
				tone: 'ok',
				major: true,
				qualifiers: ['no roll', `${a.ap} AP wasted`, `+${noise} detection`]
			}
		);
	}

	applyStrike(
		actor: Klass,
		a: Ability,
		target: Structure,
		targetNumber: number,
		total: number,
		outcome: Outcome
	) {
		const hit = succeeded(outcome);
		const t = target.territory;
		// A botch is loud in a way even a failure is not — you did not just miss,
		// you tripped something on the way in.
		const raw = hit ? a.noise : outcome === 'botch' ? a.noise * 3 : a.noise * 2;
		// `quiet` upgrades come off the noise, never below nothing — a seat that
		// has learned to be careful is not thereby invisible.
		const added = Math.max(0, raw - bonus(actor, this.round, 'quiet'));
		this.heat[t] = Math.min(100, this.heat[t] + added * 6);
		const squad = fxFor(a.key, actor.faction).squad.count;

		// Who is left standing. A win puts the attackers on the building and takes
		// a defender off it; a loss costs the attacker a body and leaves the wall
		// worn. Either way somebody stays there.
		if (hit) {
			// A critical drives off two: the difference between getting in and
			// getting in without anybody left to write it up.
			const routed = this.rout(target.id, 'blue', outcome === 'critical' ? 2 : 1, 'garrison');
			this.deploy(actor, a, target.id, squad);
			if (routed) {
				// A hit is quiet by definition — nobody was there to write it up — so
				// this row keeps the fog even though the whole table gets it. Every
				// defender off the wall is a point off the hardening.
				this.#played(
					'all',
					{ by: actor, loud: false, at: target, card: a, delta: -routed, outcome },
					{
						when: `R${this.round}`,
						title: 'driven off',
						subject: `${target.name} — 1 defender`,
						icon: 'users',
						tone: 'warn',
						qualifiers: [`hardening ${this.hardeningOf(target.id)}`]
					}
				);
			}
		} else {
			this.deploy(actor, a, target.id, Math.max(0, squad - 1));
		}

		if (hit) {
			const already = this.footholds.find((f) => f.structure_id === target.id);
			if (already) {
				// ── Capitalising ────────────────────────────────────────────────
				// You are already in. Attacking again is not taking it twice, it is
				// spending a turn DEEPENING it. That is the choice a foothold is
				// supposed to create: push on now at the odds you have, or work this
				// one and push on at better ones.
				this.footholds = this.footholds.map((f) =>
					f.structure_id === target.id ? { ...f, persistent: true, staged: true } : f
				);
				const next = CHAIN.find((c) => c.chain === (target.chain ?? 0) + 1);
				// A region past 80 has stopped keeping secrets, which is the same
				// threshold that widens the audience — so `loud` and `see` move
				// together here rather than being two separate judgements.
				const heard = this.heat[t] >= 80;
				this.#played(
					heard ? 'all' : actor.faction,
					{ by: actor, loud: heard, at: target, card: a, outcome },
					{
						when: `R${this.round} · ${a.name}`,
						title: 'dug in at',
						subject: target.name,
						icon: 'flame',
						tone: 'bad',
						major: true,
						qualifiers: [
							OUTCOME_LABEL[outcome].toLowerCase(),
							'persistent · staged',
							next ? `${next.name} +2` : 'ready for the core'
						]
					}
				);
				this.ping(target.id, 'tick');
				this.checkVictory();
				return;
			}
			this.footholds = [
				...this.footholds,
				{
					structure_id: target.id,
					seat_key: actor.key,
					// A partial gets you in and nothing more.
					persistent: outcome === 'clean' || outcome === 'critical',
					// Heat is what gives you away. A quiet hit is one nobody logged.
					revealed: this.heat[t] >= 80,
					sleeper: a.key === 'sleeper',
					placed_round: this.round,
					staged: false
				}
			];
			const seen = this.heat[t] >= 80;
			this.#played(
				seen ? 'all' : actor.faction,
				{ by: actor, loud: seen, at: target, card: a, outcome },
				{
					when: `R${this.round} · ${a.name}`,
					title: 'held',
					subject: target.name,
					icon: outcome === 'critical' ? 'flame' : 'zap',
					tone: 'bad',
					major: outcome === 'critical',
					qualifiers: [
						OUTCOME_LABEL[outcome].toLowerCase(),
						`roll ${total} vs ${targetNumber}`,
						outcome === 'partial' ? 'dislodgeable' : 'persistent',
						`+${added * 6} heat`
					]
				}
			);
			if (!seen) this.pushHeatTell(t, added * 6);
		} else {
			// The wall held, and took a hit doing it. A botch does not even manage
			// that — you came apart on the approach.
			const dealt = outcome === 'botch' ? 0 : 1;
			if (dealt) this.chip[target.id] = (this.chip[target.id] ?? 0) + dealt;
			if (outcome === 'botch') this.rout(target.id, actor.faction, 1);
			// Walls make a noise. This is the one attack row that is public whoever
			// threw it, and `#stage` already un-fogs its verdict on the same rule.
			this.#played(
				'all',
				{ by: actor, loud: true, at: target, card: a, delta: -dealt, outcome },
				{
					when: `R${this.round} · ${this.seat.faction === actor.faction ? a.name : 'contact'}`,
					title: outcome === 'botch' ? 'came apart at' : 'repelled at',
					subject: target.name,
					icon: 'shield',
					tone: 'ok',
					major: outcome === 'botch',
					qualifiers: [
						OUTCOME_LABEL[outcome].toLowerCase(),
						`roll ${total} vs ${targetNumber}`,
						dealt
							? `−1 hardening → ${this.hardeningOf(target.id)}`
							: 'the wall was not touched',
						`+${added * 6} detection`
					]
				}
			);
		}
		this.checkVictory();
	}

	/** Red's quiet turns. No dice, no foothold — they change the number the NEXT
	 *  roll is made against, which is how the real thing works. */
	applyRedSupport(actor: Klass, a: Ability, id: string, outcome: Outcome) {
		const s = structureById(id);
		if (!s) return;
		const base = Math.abs(fxFor(a.key, actor.faction).power);
		const got = scaleEffect(outcome, base);

		if (!got) {
			// Being caught trying is worse than not trying.
			const noise = outcome === 'botch' ? a.noise * 3 + 6 : a.noise * 3;
			this.heat[s.territory] = Math.min(100, this.heat[s.territory] + noise);
			this.#played(
				'red',
				{ by: actor, loud: false, at: s, card: a, outcome },
				{
					when: `R${this.round} · ${a.name}`,
					title: outcome === 'botch' ? 'blew it at' : 'got nowhere at',
					subject: s.name,
					icon: 'x',
					tone: 'warn',
					qualifiers: [OUTCOME_LABEL[outcome].toLowerCase(), `+${noise} heat`]
				}
			);
			this.pushHeatTell(s.territory, noise);
			return;
		}

		if (a.key === 'contribution') {
			this.res[actor.key] += got;
			// No delta: reputation is not a wall. Nothing on the building moved.
			this.#played(
				'red',
				{ by: actor, loud: false, at: s, card: a, outcome },
				{
					when: `R${this.round} · ${a.name}`,
					title: 'contributed to',
					subject: s.name,
					icon: 'check',
					tone: 'info',
					qualifiers: [
						OUTCOME_LABEL[outcome].toLowerCase(),
						`+${got} REP`,
						'indistinguishable from help'
					]
				}
			);
			return;
		}

		this.softened[id] = (this.softened[id] ?? 0) + got;
		this.expiry[`soft:${id}`] = this.round + 2;
		this.heat[s.territory] = Math.min(100, this.heat[s.territory] + a.noise * 6);
		this.#played(
			'red',
			{ by: actor, loud: false, at: s, card: a, delta: -got, outcome },
			{
				when: `R${this.round} · ${a.name}`,
				title: 'weakened',
				subject: s.name,
				icon: 'wrench',
				tone: 'warn',
				qualifiers: [
					OUTCOME_LABEL[outcome].toLowerCase(),
					`−${got} hardening`,
					`now ${this.hardeningOf(id)}`,
					'2 rounds'
				]
			}
		);
		this.pushHeatTell(s.territory, a.noise * 6);
	}

	/** `placed` is what `deploy` got onto the wall a moment ago — the honest +N
	 *  for a Harden, which the card's printed number is not once the garrison cap
	 *  has taken a bite out of it. */
	applyBlue(actor: Klass, a: Ability, id: string, outcome: Outcome, placed = 0) {
		const s = structureById(id);
		if (!s) return;
		const base = Math.abs(fxFor(a.key, actor.faction).power);
		const got = scaleEffect(outcome, base);

		if (!got) {
			// Blue's failures are quiet, and that is their own problem.
			this.#played(
				'blue',
				{ by: actor, loud: false, at: s, card: a, outcome },
				{
					when: `R${this.round} · ${a.name}`,
					title: outcome === 'botch' ? 'went wrong at' : 'achieved nothing at',
					subject: s.name,
					icon: 'x',
					tone: 'warn',
					qualifiers: [OUTCOME_LABEL[outcome].toLowerCase(), 'AP spent']
				}
			);
			return;
		}
		if (a.key === 'harden') {
			// No separate bookkeeping: the +3 IS the three figures that just took up
			// position, and they are on the board where red can go and remove them.
			this.#played(
				'blue',
				{ by: actor, loud: false, at: s, card: a, delta: placed, outcome },
				{
					when: `R${this.round} · Harden`,
					title: 'reinforced',
					subject: s.name,
					icon: 'shield',
					tone: 'ok',
					qualifiers: [
						`hardening ${this.hardeningOf(id)}`,
						`${this.atStructure(id, 'blue').length} on the wall`
					]
				}
			);
			return;
		}
		if (a.key === 'segment' && id === 'beacon') {
			// Sinkholing the callback. Everything red planted is still planted — it
			// just cannot phone home, and a thing that has stopped behaving normally
			// is a thing you can finally see.
			this.quarantined = [...new Set([...this.quarantined, id])];
			this.expiry[`quar:${id}`] = this.round + 2;
			const exposed = this.footholds.filter((f) => !f.revealed).length;
			this.footholds = this.footholds.map((f) => ({ ...f, revealed: true }));
			// Everything red planted just announced itself. Nothing left to withhold.
			this.#played(
				'all',
				{ by: actor, loud: true, at: s, card: a, outcome },
				{
					when: `R${this.round} · Segment`,
					title: 'sinkholed —',
					subject: 'the Relay Beacon',
					icon: 'radio',
					tone: 'ok',
					major: true,
					qualifiers: [`${exposed} implant${exposed === 1 ? '' : 's'} went dark and showed`]
				}
			);
			return;
		}
		if (a.key === 'attribute' && id === 'personas') {
			// Burning the identity where it was made. The Maintainer's passive is
			// trust it spent two years accruing; this is the card that spends it.
			this.res.maintainer = 0;
			this.rout('personas', 'red', GARRISON_CAP);
			this.#played(
				'all',
				{ by: actor, loud: true, at: s, card: a, outcome },
				{
					when: `R${this.round} · Attribution`,
					title: 'burned the identity at',
					subject: s.name,
					icon: 'fingerprint',
					tone: 'ok',
					major: true,
					qualifiers: ['REP reset to 0', 'the persona cannot be worn twice']
				}
			);
			return;
		}
		if (a.key === 'quarantine') {
			this.quarantined = [...new Set([...this.quarantined, id])];
			this.expiry[`quar:${id}`] = this.round + got;
			this.ping(id, 'sealed');
			// A sealed building is visible from outside — red can see the door shut.
			this.#played(
				'all',
				{ by: actor, loud: true, at: s, card: a, outcome },
				{
					when: `R${this.round} · Quarantine`,
					title: 'sealed',
					subject: s.name,
					icon: 'lock',
					tone: 'warn',
					qualifiers: [
						OUTCOME_LABEL[outcome].toLowerCase(),
						`${got} round${got === 1 ? '' : 's'}`,
						'chain cannot advance through it'
					]
				}
			);
			return;
		}

		// Recon: sweep a territory, diff an artifact, attest a chain. Each turns
		// hidden state into shared state — the only currency blue has.
		const scope =
			a.key === 'sweep'
				? STRUCTURES.filter((x) => x.territory === s.territory).map((x) => x.id)
				: [id];
		// A partial look finds one thing; a clean one finds everything in scope.
		const candidates = this.footholds.filter(
			(f) => scope.includes(f.structure_id) && !f.revealed && !(a.key === 'sweep' && f.sleeper)
		);
		const found = outcome === 'partial' ? candidates.slice(0, 1) : candidates;
		this.footholds = this.footholds.map((f) =>
			found.some((g) => g.structure_id === f.structure_id) ? { ...f, revealed: true } : f
		);
		for (const f of found) this.ping(f.structure_id, 'reveal');

		// The code review. This is the counter to an implant, and the reason the
		// implant is allowed to sit there indefinitely: it stays until somebody
		// actually reads the tree. How MUCH of the tree you got through is the roll.
		const deep = a.key !== 'sweep' && (outcome === 'clean' || outcome === 'critical');
		let pulled = 0;
		for (const sid of scope) {
			const implants = this.garrison.filter(
				(g) => g.structureId === sid && g.faction === 'red' && g.leaves === 'implant'
			);
			if (!implants.length) continue;
			const take = deep ? implants.length : 1;
			const gone = this.rout(sid, 'red', take, 'implant');
			if (gone) this.ping(sid, 'cleared');
			pulled += gone;
		}
		if (pulled) {
			this.#played(
				'all',
				{ by: actor, loud: true, at: s, card: a, outcome },
				{
					when: `R${this.round} · ${a.name}`,
					title: 'pulled out of the tree',
					subject: `${pulled} implant${pulled === 1 ? '' : 's'}`,
					icon: 'trash',
					tone: 'ok',
					major: true,
					qualifiers: [deep ? 'read in full' : 'one found on a pass']
				}
			);
		}
		// A reveal is public — that is what makes it worth anything. A sweep that
		// found nothing is blue's own business.
		this.#played(
			found.length ? 'all' : 'blue',
			{ by: actor, loud: found.length > 0, at: s, card: a, outcome },
			{
				when: `R${this.round} · ${a.name}`,
				title: found.length ? 'uncovered' : 'found nothing at',
				subject: found.length
					? found.map((f) => structureById(f.structure_id)?.name).join(', ')
					: a.key === 'sweep'
						? TERRITORIES[s.territory].name
						: s.name,
				icon: found.length ? 'eye' : 'search',
				tone: found.length ? 'bad' : 'info',
				major: found.length > 0,
				qualifiers: found.length
					? [OUTCOME_LABEL[outcome].toLowerCase(), 'foothold revealed']
					: [OUTCOME_LABEL[outcome].toLowerCase(), 'sleepers are inert, not absent']
			}
		);
	}

	// ── Turn ───────────────────────────────────────────────────────────────────
	endTurn() {
		if (this.remote) {
			if (this.pending) return;
			this.remote.endTurn();
			this.#awaitRemote();
			return;
		}
		if (this.busy || this.winner) return;
		this.armedKey = null;
		this.lastRoll = null;
		const order = this.seatOrder;
		const next = (this.phase + 1) % order.length;
		if (next === 0) this.upkeep();
		this.phase = next;
		// Hot seat: the HUD follows the turn only into a chair somebody at this
		// machine has to play. Into an automatic one it does not — you stay where
		// you are and watch, which is both how AUTO demonstrates a fog-of-war game
		// to one person and how a solo table stops handing you the demonstrator's
		// hand and expecting you to play it.
		if (!this.activeIsAutomatic) this.seatKey = order[next];
	}

	/** Action points as a round opens: three a chair, plus whatever the track has
	 *  bought. Only for chairs IN PLAY — the two a 1v1 leaves in the box are not
	 *  at the table, and funding them is what put them on the clock. */
	#refillAp() {
		const ap: Record<string, number> = {};
		for (const key of this.seatOrder) ap[key] = 3 + bonus(klassByKey(key), this.round, 'ap');
		this.ap = ap;
	}

	/**
	 * Start of round. Everything here is a clock the players do not have to wind:
	 * AP refills, temporary effects lapse, detection cools, and a region that has
	 * gone loud enough gives up whatever is hiding in it.
	 */
	upkeep() {
		this.round += 1;
		this.#refillAp();
		// Trust accrues to whoever spent the round being useful.
		this.res.maintainer += 1;

		for (const [k, until] of Object.entries(this.expiry)) {
			if (this.round < until) continue;
			const [kind, id] = k.split(':');
			if (kind === 'soft') delete this.softened[id];
			if (kind === 'quar') {
				this.quarantined = this.quarantined.filter((q) => q !== id);
				// The seal lapses and the people manning it stand down with it.
				this.rout(id, 'blue', GARRISON_CAP, 'garrison');
			}
			delete this.expiry[k];
		}

		// Detection decays. Without this red can never go quiet again, and a game
		// where nothing cools is a game with one strategy in it.
		for (const t of TERRITORY_ORDER) this.heat[t] = Math.max(0, this.heat[t] - 4);

		// Repairs. Wearing a building down means keeping the pressure ON it rather
		// than chipping at everything once.
		for (const id of Object.keys(this.chip)) {
			this.chip[id] -= 1;
			if (this.chip[id] <= 0) delete this.chip[id];
		}

		// ── Dwell ────────────────────────────────────────────────────────────────
		// What an implant DOES while nobody deals with it. Left alone it burrows.
		// This is the whole reason cleanup is a move — an implant you ignore is not
		// neutral, it is compounding. A sealed building is the exception: nothing
		// gets in or out, including the implant's own callback.
		const burrowing = this.garrison.filter(
			(g) =>
				g.faction === 'red' &&
				g.leaves === 'implant' &&
				!this.quarantined.includes(g.structureId)
		);
		const bySite = new Map<string, number>();
		for (const g of burrowing) bySite.set(g.structureId, (bySite.get(g.structureId) ?? 0) + 1);
		for (const [sid, n] of bySite) {
			const s = structureById(sid);
			if (!s) continue;
			this.chip[sid] = (this.chip[sid] ?? 0) + n;
			this.heat[s.territory] = Math.min(100, this.heat[s.territory] + n * 2);
			this.ping(sid, 'tick');
			// Nobody played this — an implant left alone does it by itself — so it
			// goes through `push` unattributed rather than through `#played`. The
			// audience IS the fog here: a foothold nobody has found stays red's
			// business, and once it is revealed the building was already public.
			this.push(
				this.footholds.find((f) => f.structure_id === sid)?.revealed ? 'all' : 'red',
				{
					round: this.round,
					where: s.territory,
					structure: sid,
					delta: -n,
					when: `R${this.round}`,
					title: 'burrowed deeper into',
					subject: s.name,
					icon: 'flame',
					tone: 'bad',
					qualifiers: [
						`${n} implant${n === 1 ? '' : 's'}`,
						`−${n} hardening → ${this.hardeningOf(sid)}`
					]
				}
			);
		}
		// Blue is told a number moved, not what moved it.
		for (const [sid, n] of bySite) {
			const s = structureById(sid);
			if (s && !this.footholds.find((f) => f.structure_id === sid)?.revealed) {
				this.pushHeatTell(s.territory, n * 2);
			}
		}

		// A region loud enough stops keeping secrets — the automation that makes
		// noise matter without blue having to spend a card on a hunch.
		for (const t of TERRITORY_ORDER) {
			if (this.heat[t] < 80) continue;
			const ids = STRUCTURES.filter((s) => s.territory === t).map((s) => s.id);
			const out = this.footholds.filter(
				(f) => ids.includes(f.structure_id) && !f.revealed && !f.sleeper
			);
			if (!out.length) continue;
			this.footholds = this.footholds.map((f) =>
				out.some((g) => g.structure_id === f.structure_id) ? { ...f, revealed: true } : f
			);
			for (const f of out) this.ping(f.structure_id, 'reveal');
			// A region gave somebody up and never says who — `where` and nothing
			// sharper is the entire content of the row.
			this.push('all', {
				round: this.round,
				where: t,
				when: `R${this.round}`,
				title: 'surfaced in',
				subject: TERRITORIES[t].name,
				icon: 'eye',
				tone: 'bad',
				major: true,
				qualifiers: [`detection ${this.heat[t]}`, `${out.length} exposed`]
			});
		}

		this.push('all', {
			round: this.round,
			when: `R${this.round}`,
			title: 'round opened',
			subject: `Round ${this.round}`,
			icon: 'clock',
			tone: 'info',
			qualifiers: ['3 AP each', `${HORIZON - this.round} rounds to the horizon`]
		});
		this.checkVictory();
	}

	checkVictory() {
		if (this.winner) return;
		if (CHAIN.every((s) => this.footholds.some((f) => f.structure_id === s.id))) {
			this.winner = 'red';
			this.push('all', {
				round: this.round,
				when: `R${this.round}`,
				title: 'payload delivered to',
				subject: 'PROTECTED CORE',
				icon: 'flame',
				tone: 'bad',
				major: true,
				qualifiers: ['every step of the path held']
			});
			this.auto = false;
			return;
		}
		if (this.round > HORIZON) {
			this.winner = 'blue';
			this.push('all', {
				round: this.round,
				when: `R${this.round}`,
				title: 'horizon reached —',
				subject: 'the estate held',
				icon: 'shield',
				tone: 'ok',
				major: true,
				qualifiers: ['the path was never completed']
			});
			this.auto = false;
		}
	}

	// ── The other three chairs ─────────────────────────────────────────────────
	// Not an opponent — a demonstrator. It plays the line the game is trying to
	// teach: red softens a target it cannot yet beat and strikes when the odds
	// turn, blue sweeps whatever region is loudest and otherwise builds walls.
	aiChoice(actor: Klass): { a: Ability; t: Structure } | null {
		const power = powerOf(actor.key);
		const afford = [
			...this.handOf(actor.key).map((c) => abilityByKey(c.key)),
			// Its own move, while a charge is left. Omitting it left the
			// demonstrator playing a smaller game than the seat opposite it.
			power && this.chargesOf(power.key) > 0 ? power : undefined
		].filter((x): x is Ability => !!x && x.ap <= (this.ap[actor.key] ?? 0));
		if (!afford.length) return null;
		// The demonstrator plays the same rules — including the chain order, which
		// is why watching it is worth anything. And it does not run at walls it
		// can see.
		const legal = (x: Ability, s: Structure) =>
			canTarget(x, s, actor.faction) && !this.attackBlocked(actor, x, s);
		const goal =
			CHAIN.find((s) => !this.footholds.some((f) => f.structure_id === s.id)) ?? CHAIN[0];

		if (actor.faction === 'red') {
			const strike = afford.find(
				(x) => (x.kind === 'strike' || x.kind === 'implant') && legal(x, goal)
			);
			if (strike) {
				const o = this.oddsFor(actor, strike, goal);
				// Take the shot when it is worth taking; otherwise spend the turn
				// making it worth taking. That threshold is the whole personality.
				if (o.chance >= 0.45) return { a: strike, t: goal };
			}
			const soften = afford.find((x) => x.kind === 'control' && legal(x, goal));
			if (soften && !this.softened[goal.id]) return { a: soften, t: goal };
			const econ = afford.find((x) => x.kind === 'econ');
			if (econ) return { a: econ, t: structureById('forum') ?? goal };
			return strike ? { a: strike, t: goal } : null;
		}

		// Blue takes the shot when it is worth taking: once red is holding ground,
		// sinkholing the relay exposes the lot, which is worth more than another
		// point of wall.
		const held = this.footholds.length;
		const segment = afford.find((x) => x.key === 'segment');
		const beacon = structureById('beacon');
		if (segment && beacon && held >= 2 && !this.quarantined.includes('beacon')) {
			return { a: segment, t: beacon };
		}

		const hottest = TERRITORY_ORDER.filter((t) => TERRITORIES[t].owner !== 'red').reduce((x, y) =>
			this.heat[x] >= this.heat[y] ? x : y
		);
		const sweep = afford.find((x) => x.key === 'sweep');
		if (sweep && this.heat[hottest] >= 35) {
			const anchor = STRUCTURES.find((s) => s.territory === hottest && legal(sweep, s));
			if (anchor) return { a: sweep, t: anchor };
		}
		const harden = afford.find((x) => x.key === 'harden');
		if (harden && legal(harden, goal)) return { a: harden, t: goal };
		const any = afford.find((x) => legal(x, goal));
		if (any) return { a: any, t: goal };
		// Nothing legal at the goal — take whatever the first legal pairing is.
		for (const x of afford) {
			const t = STRUCTURES.find((s) => legal(x, s));
			if (t) return { a: x, t };
		}
		return null;
	}

	async aiTurn() {
		const actor = this.activeKlass;
		const pick = this.aiChoice(actor);
		if (!pick) {
			this.endTurn();
			return;
		}
		// Show what it is aiming at before it fires — an AI that resolves instantly
		// is indistinguishable from a bug.
		this.selectedId = pick.t.id;
		await this.#pace(420);
		await this.perform(actor, pick.a, pick.t);
		await this.#pace(260);
		this.endTurn();
	}
}
