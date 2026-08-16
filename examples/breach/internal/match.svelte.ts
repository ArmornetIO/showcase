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

import {
	CHAIN,
	CORE_ID,
	INITIATIVE,
	OUTCOME_COLOR,
	OUTCOME_LABEL,
	ROSTER,
	STRUCTURES,
	TERRITORIES,
	TERRITORY_ORDER,
	canTarget,
	computeOdds,
	outcomeFor,
	roll2d6,
	scaleEffect,
	structureById,
	succeeded,
	type Ability,
	type Faction,
	type Klass,
	type Outcome,
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
import { bonus, trackFor, unlockedFor, type Upgrade } from './upgrades.js';
import { NO_CINEMA, POV_CARDS, type CinemaPort, type PovBeat } from './cinema.js';

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
}

const TURN_TICK = 200;

export class BreachMatch {
	// ── Flow ───────────────────────────────────────────────────────────────────
	stage = $state<Stage>('select');
	round = $state(1);
	/** Index into INITIATIVE. */
	phase = $state(0);
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
	activeFx = $state<ActiveFx | null>(null);
	pings = $state<BoardPing[]>([]);
	lastRoll = $state<Roll | null>(null);
	diceSpin = $state(false);
	diceFaces = $state<[number, number]>([1, 1]);
	/** A cutaway is on screen, so the host's chrome should get out of the way. */
	povLive = $state(false);
	turnLeft = $state(30_000);

	readonly turnMs: number;
	#cinema: CinemaPort;
	#fxSeq = 0;
	#unitSeq = 0;
	#pingSeq = 0;
	#logSeq = 0;

	constructor(opts: MatchOptions = {}) {
		this.#cinema = opts.cinema ?? NO_CINEMA;
		this.turnMs = opts.turnMs ?? 30_000;
		this.turnLeft = this.turnMs;
	}

	/** Swap the cinema port after construction — a host mounts its POV component
	 *  after the match exists, and this is how it hands the handle over. */
	setCinema(port: CinemaPort | null) {
		this.#cinema = port ?? NO_CINEMA;
	}

	// ── Derived ────────────────────────────────────────────────────────────────
	readonly seat = $derived<Klass>(ROSTER.find((r) => r.key === this.seatKey) ?? ROSTER[0]);
	readonly activeKlass = $derived<Klass>(
		ROSTER.find((r) => r.key === INITIATIVE[this.phase]) ?? ROSTER[0]
	);
	readonly isMyTurn = $derived(this.activeKlass.key === this.seat.key);

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
	readonly chainNext = $derived(
		CHAIN.find((s) => !this.footholds.some((f) => f.structure_id === s.id))
	);

	readonly armed = $derived<Ability | null>(
		this.seat.abilities.find((a) => a.key === this.armedKey) ?? null
	);
	readonly target = $derived(this.selectedId ? structureById(this.selectedId) : undefined);
	readonly inspected = $derived(
		this.seat.abilities.find((a) => a.key === this.inspectKey) ?? null
	);
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
		const a = d ? this.seat.abilities.find((x) => x.key === d.key) : this.armed;
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
	/** Every precondition on committing, in one place. */
	readonly ready = $derived(
		!!this.armed && !!this.target && this.legalTarget && this.canPay && !this.busy && !this.winner
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

	// ── Reads ──────────────────────────────────────────────────────────────────
	atStructure(id: string, faction: Faction) {
		return this.garrison.filter((g) => g.structureId === id && g.faction === faction);
	}

	hardeningOf(id: string): number {
		const s = structureById(id);
		if (!s) return 0;
		// The Architect's passive is a standing wall, not an action — it has to
		// show up in the number a player reads off the sheet.
		const reproducible = this.ap.architect > 0 && (id === 'forge' || id === 'silos') ? 2 : 0;
		// Every blue figure POSTED on the building is worth a point. This is what
		// makes the garrison a board piece rather than a sticker.
		const defenders = this.garrison.filter(
			(g) => g.structureId === id && g.faction === 'blue' && g.leaves === 'garrison'
		).length;
		// Blue's `harden` upgrades are a standing wall across their whole estate,
		// so they show up in the number an attacker reads off the sheet.
		const upgraded =
			TERRITORIES[s.territory].owner === 'blue'
				? ROSTER.filter((k) => k.faction === 'blue').reduce(
						(n, k) => n + bonus(k, this.round, 'harden'),
						0
					)
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
		if (!this.footholds.some((f) => f.structure_id === prev.id))
			return { kind: 'hard', text: `take ${prev.name} first — the chain runs in order` };
		if (this.quarantined.includes(prev.id))
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
			$effect(() => {
				void this.phase;
				void this.round;
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
			$effect(() => {
				if (this.turnLeft > 0 || this.busy || this.winner || this.stage !== 'play') return;
				const out = this.activeKlass;
				this.push('all', {
					when: `R${this.round}`,
					title: 'out of time',
					subject: `${out.name} — out of time`,
					icon: 'clock',
					tone: 'warn',
					qualifiers: ['turn passed', `${this.ap[out.key] ?? 0} AP unspent`]
				});
				this.endTurn();
			});

			// Out of action points. A short beat first so the last card's result is
			// read before the board moves on.
			$effect(() => {
				if (this.busy || this.winner || this.stage !== 'play') return;
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

			// The demonstrator, re-armed on every phase change.
			$effect(() => {
				if (!this.auto || this.busy || this.winner) return;
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
		this.phase = Math.max(0, INITIATIVE.indexOf(key));
		this.armedKey = null;
		this.inspectKey = null;
		this.dealtCount = 0;
		this.stage = 'deal';
		await wait(280);
		const hand = ROSTER.find((r) => r.key === key)?.abilities ?? [];
		for (let i = 0; i < hand.length; i++) {
			this.dealtCount = i + 1;
			await wait(130);
		}
		await wait(420);
		this.stage = 'play';
	}

	/** Re-deal on a seat swap so a switched chair still gets its hand thrown to
	 *  it rather than appearing fully formed. */
	switchSeat(key: string) {
		if (this.busy) return;
		void this.takeSeat(key);
	}

	/** Back to round one with an empty board. Everything a match accumulates
	 *  lives in these values, which is the argument for keeping them together. */
	newMatch() {
		this.busy = false;
		this.activeFx = null;
		// A scene left running would hold the camera seized into the next match.
		this.#cinema.cut();
		this.povLive = false;
		this.winner = null;
		this.auto = false;
		this.round = 1;
		this.phase = 0;
		this.footholds = [];
		this.heat = { staging: 0, outlands: 0, commons: 0, foundry: 0, marches: 0 };
		this.ap = { maintainer: 3, state: 3, architect: 3, hunter: 3 };
		this.res = { maintainer: 0, state: 0, architect: 2, hunter: 2 };
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
	 */
	deploy(actor: Klass, a: Ability, structureId: string, count: number) {
		const fx = fxFor(a.key, actor.faction);
		if (fx.leaves === 'nothing' || count <= 0) return;
		const mine = this.atStructure(structureId, actor.faction);
		const room = Math.max(0, GARRISON_CAP - mine.length);
		const n = Math.min(count, room);
		if (n <= 0) return;
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
		this.log = [{ ...e, see, id: `play-${this.#logSeq++}` }, ...this.log].slice(0, 40);
	}

	/** What a red action looks like from the other side of the table: a number
	 *  moved and nobody can say why. This is the only thing blue is owed. */
	pushHeatTell(t: TerritoryKey, added: number) {
		if (added <= 0) return;
		this.push('blue', {
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
	originFor(actor: Klass, t: Structure): string | null {
		const first = actor.faction === 'blue' ? 'keep' : this.lastHeldId();
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
	async perform(actor: Klass, a: Ability, t: Structure) {
		this.busy = true;
		this.armedKey = null;
		this.ap[actor.key] -= a.ap;

		const attacking = this.rollsDice(actor, a);
		const beats = attacking ? BEATS : QUIET_BEATS;
		// Fog rule: an action by the other side is never SHOWN, only felt — and if
		// it made no noise at all, not even a ripple.
		const fogged = actor.faction !== this.seat.faction;

		// A POV of the OTHER side's operator would hand the viewing seat the
		// actor, the building and the card in one shot — everything the fog rule
		// exists to withhold — so the scene is simply not played.
		const povAt: PovBeat | undefined = fogged ? undefined : POV_CARDS[a.key];
		const povFrom = povAt ? this.originFor(actor, t) : null;

		const povOpen = async () => {
			const pov = fxFor(a.key, actor.faction);
			this.povLive = true;
			await this.#cinema.enter({
				fromId: povFrom,
				structureId: t.id,
				actor: actor.name,
				seat: actor.seat,
				subject: t.name,
				origin: povFrom ? structureById(povFrom)?.name : undefined,
				card: a.name,
				word: pov.word,
				hue: pov.hue,
				shape: pov.squad.shape
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

		const showFx = !fogged || a.noise > 0;
		this.activeFx = showFx
			? {
					id: ++this.#fxSeq,
					fromId: this.originFor(actor, t),
					toId: t.id,
					fx: fxFor(a.key, actor.faction),
					fogged,
					outcome: 'pending',
					beats,
					startedAt: performance.now()
				}
			: null;

		// Ran at a seal. The card is spent, the squad goes, the dice fly — and the
		// barrier swats them out of the air before they can land on anything.
		const seal = this.attackBlocked(actor, a, t);
		if (seal?.kind === 'sealed') {
			if (this.activeFx) {
				this.activeFx = {
					...this.activeFx,
					sealed: true,
					roll: { dice: roll2d6().dice, total: 0, color: '#A78BFA' },
					arenaIds: STRUCTURES.filter((s) => s.territory === t.territory).map((s) => s.id)
				};
			}
			await wait(beats.diceStart);
			this.diceSpin = true;
			await wait(beats.diceSettle - beats.diceStart);
			this.diceSpin = false;
			this.lastRoll = null;
			// Rattling a sealed door is the loudest thing you can do and the least
			// productive.
			this.heat[t.territory] = Math.min(100, this.heat[t.territory] + (a.noise + 1) * 6);
			this.ping(t.id, 'sealed');
			this.push('all', {
				when: `R${this.round} · ${a.name}`,
				title: 'blocked',
				subject: `${t.name} — the seal held`,
				icon: 'lock',
				tone: 'ok',
				major: true,
				qualifiers: ['no roll', `${a.ap} AP wasted`, `+${(a.noise + 1) * 6} detection`]
			});
			await wait(beats.unlock - beats.diceSettle);
			await povClose();
			this.activeFx = null;
			this.busy = false;
			return;
		}

		const o = this.oddsFor(actor, a, t);
		const r = roll2d6();
		const total = r.total + o.modifier;
		const margin = total - o.target;
		const outcome = outcomeFor(margin);
		const hit = succeeded(outcome);

		// Split at `arrive` so the scene can open with the squad already standing
		// at the building and the dice still in the hand.
		await wait(beats.arrive);
		if (povAt === 'roll') await povOpen();
		await wait(beats.diceStart - beats.arrive);
		this.lastRoll = null;
		if (this.activeFx) {
			this.activeFx = {
				...this.activeFx,
				roll: { dice: r.dice, total, color: OUTCOME_COLOR[outcome] },
				// Rolled into the middle of the REGION, not at the house.
				arenaIds: STRUCTURES.filter((s) => s.territory === t.territory).map((s) => s.id)
			};
		}
		this.diceSpin = true;
		await wait(beats.diceSettle - beats.diceStart);
		this.diceSpin = false;
		this.diceFaces = r.dice;
		this.lastRoll = { dice: r.dice, total, hit, outcome, margin };

		// The number is known and nothing has been done about it yet.
		if (povAt === 'verdict') await povOpen();

		if (!attacking) {
			await wait(Math.max(0, beats.verdict - beats.diceSettle));
			this.activeFx = this.activeFx
				? { ...this.activeFx, outcome: hit ? 'breach' : 'ward' }
				: null;
			await wait(Math.max(0, beats.after - beats.verdict));
			// They arrive and they stay — but only if the attempt worked.
			if (hit) this.deploy(actor, a, t.id, fxFor(a.key, actor.faction).squad.count);
			if (actor.faction === 'blue') this.applyBlue(actor, a, t.id, outcome);
			else this.applyRedSupport(actor, a, t.id, outcome);
			await wait(beats.unlock - beats.after);
			await povClose();
			this.activeFx = null;
			this.busy = false;
			return;
		}

		await wait(beats.verdict - beats.diceSettle);
		// An attack that FAILED is public whoever threw it — walls make a noise.
		this.activeFx = this.activeFx
			? {
					...this.activeFx,
					outcome: hit ? 'breach' : 'ward',
					fogged: hit ? this.activeFx.fogged : false
				}
			: null;

		await wait(beats.after - beats.verdict);
		this.applyStrike(actor, a, t, o.target, total, outcome);

		await wait(beats.unlock - beats.after);
		await povClose();
		this.activeFx = null;
		this.busy = false;
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
				this.push('all', {
					when: `R${this.round}`,
					title: 'driven off',
					subject: `${target.name} — 1 defender`,
					icon: 'users',
					tone: 'warn',
					qualifiers: [`hardening ${this.hardeningOf(target.id)}`]
				});
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
				this.push(this.heat[t] >= 80 ? 'all' : actor.faction, {
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
				});
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
			this.push(seen ? 'all' : actor.faction, {
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
			});
			if (!seen) this.pushHeatTell(t, added * 6);
		} else {
			// The wall held, and took a hit doing it. A botch does not even manage
			// that — you came apart on the approach.
			const dealt = outcome === 'botch' ? 0 : 1;
			if (dealt) this.chip[target.id] = (this.chip[target.id] ?? 0) + dealt;
			if (outcome === 'botch') this.rout(target.id, actor.faction, 1);
			this.push('all', {
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
			});
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
			this.push('red', {
				when: `R${this.round} · ${a.name}`,
				title: outcome === 'botch' ? 'blew it at' : 'got nowhere at',
				subject: s.name,
				icon: 'x',
				tone: 'warn',
				qualifiers: [OUTCOME_LABEL[outcome].toLowerCase(), `+${noise} heat`]
			});
			this.pushHeatTell(s.territory, noise);
			return;
		}

		if (a.key === 'contribution') {
			this.res[actor.key] += got;
			this.push('red', {
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
			});
			return;
		}

		this.softened[id] = (this.softened[id] ?? 0) + got;
		this.expiry[`soft:${id}`] = this.round + 2;
		this.heat[s.territory] = Math.min(100, this.heat[s.territory] + a.noise * 6);
		this.push('red', {
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
		});
		this.pushHeatTell(s.territory, a.noise * 6);
	}

	applyBlue(actor: Klass, a: Ability, id: string, outcome: Outcome) {
		const s = structureById(id);
		if (!s) return;
		const base = Math.abs(fxFor(a.key, actor.faction).power);
		const got = scaleEffect(outcome, base);

		if (!got) {
			// Blue's failures are quiet, and that is their own problem.
			this.push('blue', {
				when: `R${this.round} · ${a.name}`,
				title: outcome === 'botch' ? 'went wrong at' : 'achieved nothing at',
				subject: s.name,
				icon: 'x',
				tone: 'warn',
				qualifiers: [OUTCOME_LABEL[outcome].toLowerCase(), 'AP spent']
			});
			return;
		}
		if (a.key === 'harden') {
			// No separate bookkeeping: the +3 IS the three figures that just took up
			// position, and they are on the board where red can go and remove them.
			this.push('blue', {
				when: `R${this.round} · Harden`,
				title: 'reinforced',
				subject: s.name,
				icon: 'shield',
				tone: 'ok',
				qualifiers: [
					`hardening ${this.hardeningOf(id)}`,
					`${this.atStructure(id, 'blue').length} on the wall`
				]
			});
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
			this.push('all', {
				when: `R${this.round} · Segment`,
				title: 'sinkholed —',
				subject: 'the Relay Beacon',
				icon: 'radio',
				tone: 'ok',
				major: true,
				qualifiers: [`${exposed} implant${exposed === 1 ? '' : 's'} went dark and showed`]
			});
			return;
		}
		if (a.key === 'attribute' && id === 'personas') {
			// Burning the identity where it was made. The Maintainer's passive is
			// trust it spent two years accruing; this is the card that spends it.
			this.res.maintainer = 0;
			this.rout('personas', 'red', GARRISON_CAP);
			this.push('all', {
				when: `R${this.round} · Attribution`,
				title: 'burned the identity at',
				subject: s.name,
				icon: 'fingerprint',
				tone: 'ok',
				major: true,
				qualifiers: ['REP reset to 0', 'the persona cannot be worn twice']
			});
			return;
		}
		if (a.key === 'quarantine') {
			this.quarantined = [...new Set([...this.quarantined, id])];
			this.expiry[`quar:${id}`] = this.round + got;
			this.ping(id, 'sealed');
			// A sealed building is visible from outside — red can see the door shut.
			this.push('all', {
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
			});
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
			this.push('all', {
				when: `R${this.round} · ${a.name}`,
				title: 'pulled out of the tree',
				subject: `${pulled} implant${pulled === 1 ? '' : 's'}`,
				icon: 'trash',
				tone: 'ok',
				major: true,
				qualifiers: [deep ? 'read in full' : 'one found on a pass']
			});
		}
		// A reveal is public — that is what makes it worth anything. A sweep that
		// found nothing is blue's own business.
		this.push(found.length ? 'all' : 'blue', {
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
		});
	}

	// ── Turn ───────────────────────────────────────────────────────────────────
	endTurn() {
		if (this.busy || this.winner) return;
		this.armedKey = null;
		this.lastRoll = null;
		const next = (this.phase + 1) % INITIATIVE.length;
		if (next === 0) this.upkeep();
		this.phase = next;
		// Hot seat: the HUD follows the turn. Under AUTO it does not — you stay in
		// your chair and watch the other three play, which is the only way a
		// fog-of-war game can be demonstrated to one person.
		if (!this.auto) this.seatKey = INITIATIVE[next];
	}

	/**
	 * Start of round. Everything here is a clock the players do not have to wind:
	 * AP refills, temporary effects lapse, detection cools, and a region that has
	 * gone loud enough gives up whatever is hiding in it.
	 */
	upkeep() {
		this.round += 1;
		// Three a round, plus whatever the seat's track has bought them.
		for (const klass of ROSTER) {
			this.ap[klass.key] = 3 + bonus(klass, this.round, 'ap');
		}
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
			this.push(
				this.footholds.find((f) => f.structure_id === sid)?.revealed ? 'all' : 'red',
				{
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
			this.push('all', {
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
			when: `R${this.round}`,
			title: 'round opened',
			subject: `Round ${this.round}`,
			icon: 'clock',
			tone: 'info',
			qualifiers: ['3 AP each', `${12 - this.round} rounds to the horizon`]
		});
		this.checkVictory();
	}

	checkVictory() {
		if (this.winner) return;
		if (CHAIN.every((s) => this.footholds.some((f) => f.structure_id === s.id))) {
			this.winner = 'red';
			this.push('all', {
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
		if (this.round > 12) {
			this.winner = 'blue';
			this.push('all', {
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
		const afford = actor.abilities.filter((x) => x.ap <= (this.ap[actor.key] ?? 0));
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
		await wait(420);
		await this.perform(actor, pick.a, pick.t);
		await wait(260);
		this.endTurn();
	}
}
