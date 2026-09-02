// ── BREACH v2 — the match ────────────────────────────────────────────────────
// The state machine, and the only place an effect is applied. It is a rune class
// for the same reason v1's is: the board is one object with a lot of derived
// readouts, and every component in the app is a pure render over it.
//
// The whole match is a prefix: because a step is only attackable from the one
// before it, red's holdings are ALWAYS `CHAIN[0..depth-1]`. One integer replaces
// v1's foothold map, its persistent/staged/sleeper/revealed flags and its
// three-term leverage rule.

import {
	ALERT_CAP,
	ALERT_DECAY,
	AP,
	CHAIN,
	CHIP_ON_FAIL,
	DICE,
	ORDER,
	ROUNDS,
	SEATS,
	TRUST_CAP,
	hit,
	moveByKey,
	movesOf,
	odds,
	outcomeFor,
	roll2d6,
	rolls,
	scaled,
	stepIndex,
	wall,
	type DiceSource,
	type Faction,
	type Move,
	type Odds,
	type Outcome,
	type SeatKey,
	type Step,
	type Wall
} from './rules.js';

// ── Pace ─────────────────────────────────────────────────────────────────────
// v1 resolved a move in about 900ms of overlapping choreography. v2 takes three
// seconds and does one thing at a time, because the brief for this version is
// that a player should be able to WATCH the game happen to them. Every duration
// in the app is here; nothing else calls setTimeout with a literal.

export const PACE = {
	/** After committing, before the dice leave the hand. */
	windup: 450,
	/** The tumble. Faces keep changing until `lock`. */
	tumble: 1500,
	/** Fraction of the tumble after which the real faces show. */
	lock: 0.72,
	/** The verdict sits on screen before the board moves. */
	verdict: 1100,
	/** The board's change plays, then the turn ends. */
	settle: 700,
	/** A no-roll move still gets a beat, so it reads as a move. */
	quiet: 700,
	/** Between one seat finishing and the next starting. */
	handover: 900,
	/** A bot thinks before it acts. */
	think: 1100
} as const;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type Phase = 'idle' | 'aiming' | 'rolling' | 'verdict' | 'over';

export interface Entry {
	round: number;
	seat: SeatKey;
	text: string;
	outcome?: Outcome;
}

/** What the dice component is showing. Null between resolutions. */
export interface Throw {
	dice: [number, number];
	total: number;
	margin: number;
	outcome: Outcome;
	target: number;
	modifier: number;
}

export interface Options {
	dice?: DiceSource;
	/** Seats the machine plays. Default: both blue chairs. */
	bots?: SeatKey[];
	/** Skip every wait. For tests. */
	instant?: boolean;
}

export class Match {
	round = $state(1);
	/** Index into ORDER. */
	at = $state(0);
	/** Turns taken since the match began — what a seal counts down against. */
	beat = $state(0);
	ap = $state(AP);
	alert = $state(0);
	trust = $state(0);
	/** How many chain steps red holds. Always a prefix of CHAIN. */
	depth = $state(0);

	hardened = $state<Record<string, number>>({});
	damage = $state<Record<string, number>>({});
	/** Step id → the beat at which the seal lifts. */
	sealed = $state<Record<string, number>>({});
	/** Move key → charges spent. */
	spent = $state<Record<string, number>>({});

	phase = $state<Phase>('idle');
	armed = $state<Move | null>(null);
	/** What is being resolved right now — the move, where it was aimed and the
	 *  roll it was committed against. Held separately from `armed` because the
	 *  overlay has to keep printing it after the seat has let go of it. */
	pending = $state<{ move: Move; target: Step | null; odds: Odds | null } | null>(null);
	throw_ = $state<Throw | null>(null);
	feed = $state<Entry[]>([]);
	winner = $state<Faction | null>(null);

	bots = $state<SeatKey[]>(['architect', 'hunter']);

	#dice: DiceSource;
	#instant: boolean;
	/** Guards the resolution: one move is in flight at a time, and the bot loop
	 *  must not start a second one while an animation is still playing. */
	#busy = false;

	constructor(opts: Options = {}) {
		this.#dice = opts.dice ?? DICE;
		this.#instant = opts.instant ?? false;
		if (opts.bots) this.bots = opts.bots;
	}

	// ── Reading the board ──────────────────────────────────────────────────────

	get seat(): SeatKey {
		return ORDER[this.at];
	}

	get faction(): Faction {
		return SEATS[this.seat].faction;
	}

	get moves(): Move[] {
		return movesOf(this.seat);
	}

	get botTurn(): boolean {
		return this.bots.includes(this.seat);
	}

	/** Read this rather than comparing `phase` directly. Victory can land while
	 *  an animation is being awaited, and TypeScript narrows a field across an
	 *  await as if nothing else could have written it. */
	get over(): boolean {
		return this.phase === 'over';
	}

	/** Red holds it. */
	held(id: string): boolean {
		return stepIndex(id) < this.depth;
	}

	/** The step red is next allowed to attack, or null once the chain is done. */
	get front(): Step | null {
		return this.depth < CHAIN.length ? CHAIN[this.depth] : null;
	}

	isSealed(id: string): boolean {
		return (this.sealed[id] ?? -1) > this.beat;
	}

	wallOf(s: Step): Wall {
		return wall(s, this.hardened[s.id] ?? 0, this.damage[s.id] ?? 0, this.alert);
	}

	/** Every wall gains this from the Alert meter. Shown next to the meter so
	 *  the number is never a surprise inside another number. */
	get alertBonus(): number {
		return this.wallOf(CHAIN[0]).alert;
	}

	charges(m: Move): number {
		return m.uses === undefined ? Infinity : m.uses - (this.spent[m.key] ?? 0);
	}

	/** Why a move cannot be played, in the words shown on the button. Null when
	 *  it can. One function, so the button, the bot and the tests agree. */
	refusal(m: Move): string | null {
		if (this.over) return 'match over';
		if (m.ap > this.ap) return `needs ${m.ap} AP`;
		if (this.charges(m) <= 0) return 'spent';
		switch (m.effect) {
			case 'trust':
				return this.trust >= TRUST_CAP ? 'trust is full' : null;
			case 'cover':
				return this.alert <= 0 ? 'nothing to cover' : null;
			case 'attack': {
				if (!this.front) return 'chain is taken';
				return this.isSealed(this.front.id) ? `${this.front.name} is sealed` : null;
			}
			case 'evict':
				return this.depth === 0 ? 'red holds nothing' : null;
			default:
				return this.targets(m).length ? null : 'no target';
		}
	}

	/** Where a move may be aimed. An attack has exactly one legal target and the
	 *  player never picks it — the chain does. */
	targets(m: Move): Step[] {
		if (m.aim === 'none') return [];
		if (m.aim === 'next') return this.front && !this.isSealed(this.front.id) ? [this.front] : [];
		switch (m.effect) {
			case 'patch':
				return CHAIN.filter((s) => (this.damage[s.id] ?? 0) > 0);
			case 'seal':
				return CHAIN.filter((s) => !this.isSealed(s.id));
			default:
				return [...CHAIN];
		}
	}

	/** The roll, before it is made. Every term the dice will be added to is on
	 *  screen before the player commits — that is the whole of v2's HUD brief. */
	oddsFor(m: Move, target: Step | null): Odds | null {
		if (!rolls(m)) return null;
		const seat = SEATS[m.seat];
		const attacking = m.effect === 'attack';
		return odds({
			skill: seat.skills[m.skill],
			card: m.mod,
			trust: attacking ? this.trust : 0,
			momentum: attacking ? this.depth : 0,
			target: attacking && target ? this.wallOf(target).total : (m.dc ?? 8)
		});
	}

	// ── Playing ────────────────────────────────────────────────────────────────

	arm(m: Move) {
		if (this.#busy || this.refusal(m)) return;
		if (this.armed?.key === m.key) {
			this.armed = null;
			this.phase = 'idle';
			return;
		}
		this.armed = m;
		this.phase = m.aim === 'any' ? 'aiming' : 'idle';
		if (m.aim !== 'any') void this.commit(this.targets(m)[0] ?? null);
	}

	cancel() {
		if (this.#busy) return;
		this.armed = null;
		this.phase = 'idle';
	}

	/** The one path a move takes. Nothing else mutates the board. */
	async commit(target: Step | null): Promise<void> {
		const m = this.armed;
		if (!m || this.#busy || this.refusal(m)) return;
		if (m.aim === 'any' && (!target || !this.targets(m).some((s) => s.id === target.id))) return;

		this.#busy = true;
		this.ap -= m.ap;
		if (m.uses !== undefined) this.spent = { ...this.spent, [m.key]: (this.spent[m.key] ?? 0) + 1 };
		this.armed = null;
		this.pending = { move: m, target, odds: this.oddsFor(m, target) };

		// Red is heard for TRYING. Applied before the dice, because whether it
		// worked has nothing to do with whether it was loud.
		if (m.alert) this.bumpAlert(m.alert);

		let outcome: Outcome = 'clean';
		if (rolls(m)) {
			const o = this.pending.odds!;
			this.phase = 'rolling';
			this.throw_ = null;
			await this.wait(PACE.windup);
			const { dice, total } = roll2d6(this.#dice);
			const margin = total + o.modifier - o.target;
			outcome = outcomeFor(margin);
			this.throw_ = { dice, total, margin, outcome, target: o.target, modifier: o.modifier };
			await this.wait(PACE.tumble);
			this.phase = 'verdict';
			await this.wait(PACE.verdict);
		} else {
			this.phase = 'verdict';
			await this.wait(PACE.quiet);
		}

		this.apply(m, target, outcome);
		await this.wait(PACE.settle);

		this.throw_ = null;
		this.pending = null;
		this.phase = 'idle';
		this.#busy = false;

		if (this.checkWin()) return;
		if (this.ap <= 0) void this.endTurn();
	}

	/** Every effect in the game. Twelve moves, ten tags, one switch. */
	private apply(m: Move, target: Step | null, o: Outcome) {
		const seat = SEATS[m.seat];
		const say = (text: string, outcome?: Outcome) => this.log(m.seat, text, outcome);
		const t = target;

		switch (m.effect) {
			case 'trust':
				this.trust = Math.min(TRUST_CAP, this.trust + 1);
				say(`banks goodwill upstream — TRUST ${this.trust}`);
				return;

			case 'cover':
				say(`goes quiet — ALERT ${this.alert}`);
				return;

			case 'seal':
				if (!t) return;
				this.sealed = { ...this.sealed, [t.id]: this.beat + ORDER.length };
				say(`seals ${t.name}. Nothing lands there until ${seat.name} moves again.`);
				return;

			case 'soften': {
				if (!t) return;
				const n = scaled(o, m.power);
				if (!n) return say(`leans on ${t.name} and is brushed off.`, o);
				this.hurt(t.id, n);
				return say(`wears ${t.name} down — ${n} damage.`, o);
			}

			case 'attack': {
				if (!t) return;
				if (!hit(o)) {
					this.hurt(t.id, CHIP_ON_FAIL);
					return say(`is turned back at ${t.name}. The wall is ${CHIP_ON_FAIL} worse for it.`, o);
				}
				this.depth = stepIndex(t.id) + 1;
				const last = this.depth === CHAIN.length;
				return say(last ? `takes ${t.name}. The chain is red's.` : `takes ${t.name}.`, o);
			}

			case 'harden': {
				if (!t) return;
				const n = scaled(o, m.power);
				if (!n) return say(`cannot get the change through on ${t.name}.`, o);
				this.hardened = { ...this.hardened, [t.id]: (this.hardened[t.id] ?? 0) + n };
				return say(`raises ${t.name} by ${n}.`, o);
			}

			case 'patch': {
				if (!t) return;
				const n = scaled(o, m.power);
				if (!n) return say(`patches nothing on ${t.name}.`, o);
				this.damage = { ...this.damage, [t.id]: Math.max(0, (this.damage[t.id] ?? 0) - n) };
				return say(`repairs ${n} damage on ${t.name}.`, o);
			}

			case 'evict': {
				if (!hit(o)) return say(`rebuilds, and red is still inside.`, o);
				const lost = CHAIN[this.depth - 1];
				this.depth = Math.max(0, this.depth - 1);
				return say(`rebuilds ${lost.name} from source. Red is out.`, o);
			}

			case 'sweep': {
				const n = scaled(o, m.power);
				if (!n) return say(`sweeps, and the logs are clean.`, o);
				this.bumpAlert(n);
				return say(`finds traces — ALERT ${this.alert}.`, o);
			}

			case 'attribute': {
				if (!hit(o)) return say(`cannot put a name to it.`, o);
				this.trust = 0;
				this.bumpAlert(scaled(o, 2));
				return say(`names the persona. Red's TRUST is 0, ALERT ${this.alert}.`, o);
			}
		}
	}

	private hurt(id: string, n: number) {
		this.damage = { ...this.damage, [id]: (this.damage[id] ?? 0) + n };
	}

	private bumpAlert(n: number) {
		this.alert = Math.max(0, Math.min(ALERT_CAP, this.alert + n));
	}

	// ── The clock ──────────────────────────────────────────────────────────────

	async endTurn(): Promise<void> {
		if (this.over) return;
		this.armed = null;
		await this.wait(PACE.handover);
		if (this.over) return;

		this.beat += 1;
		this.at = (this.at + 1) % ORDER.length;
		this.ap = AP;

		if (this.at === 0) {
			if (this.round >= ROUNDS) {
				this.finish('blue');
				return;
			}
			this.round += 1;
			this.alert = Math.max(0, this.alert - ALERT_DECAY);
			this.log(this.seat, `— round ${this.round} —`);
		}
		void this.maybeBot();
	}

	private checkWin(): boolean {
		if (this.depth >= CHAIN.length) {
			this.finish('red');
			return true;
		}
		return false;
	}

	private finish(f: Faction) {
		this.winner = f;
		this.phase = 'over';
		this.log(
			this.seat,
			f === 'red'
				? 'RED holds the whole chain. Everything downstream ships their code.'
				: `BLUE held for ${ROUNDS} rounds. Red got ${this.depth} of ${CHAIN.length}.`
		);
	}

	private log(seat: SeatKey, text: string, outcome?: Outcome) {
		this.feed = [...this.feed, { round: this.round, seat, text, outcome }];
	}

	private wait(ms: number) {
		return this.#instant ? Promise.resolve() : sleep(ms);
	}

	// ── The machine's seats ────────────────────────────────────────────────────
	// Not an opponent — a demonstrator. It plays the obvious move so that one
	// person can sit down and see a match happen, which is the only reason it
	// exists. Anything cleverer belongs in a version that has a lobby.

	async maybeBot(): Promise<void> {
		while (this.botTurn && !this.over) {
			await this.wait(PACE.think);
			if (!this.botTurn || this.over) return;
			const choice = this.botMove();
			if (!choice) {
				await this.endTurn();
				return;
			}
			this.armed = choice.move;
			await this.commit(choice.target);
			if (this.ap <= 0) return; // endTurn already queued by commit
		}
	}

	private botMove(): { move: Move; target: Step | null } | null {
		const playable = this.moves.filter((m) => !this.refusal(m));
		if (!playable.length) return null;

		const pick = (key: string) => playable.find((m) => m.key === key);
		const front = this.front;

		if (this.faction === 'blue') {
			// Get red out first, then shore up whatever they are standing in front of.
			const evict = pick('rebuild');
			if (evict && this.depth >= 2) return { move: evict, target: null };
			const attr = pick('attribute');
			if (attr && this.trust >= TRUST_CAP) return { move: attr, target: null };
			const patch = pick('patch');
			if (patch && front && (this.damage[front.id] ?? 0) >= 2) return { move: patch, target: front };
			const seal = pick('segment');
			if (seal && front && this.depth >= CHAIN.length - 1) return { move: seal, target: front };
			const harden = pick('harden');
			if (harden && front) return { move: harden, target: front };
			const sweep = pick('sweep');
			if (sweep) return { move: sweep, target: null };
		} else {
			const zero = pick('zeroday');
			if (zero && this.depth >= CHAIN.length - 1) return { move: zero, target: null };
			const strike = pick('fixture') ?? pick('lotl');
			if (strike && front) {
				const o = this.oddsFor(strike, front)!;
				if (o.chance >= 0.5) return { move: strike, target: front };
			}
			const trust = pick('contribution');
			if (trust) return { move: trust, target: null };
			const soften = pick('pressure');
			if (soften && front) return { move: soften, target: front };
			if (strike && front) return { move: strike, target: front };
			const cover = pick('cover');
			if (cover) return { move: cover, target: null };
		}
		const any = playable[0];
		return { move: any, target: this.targets(any)[0] ?? null };
	}

	/** Kicks the match off. Called once, by the root component. */
	start() {
		this.log(this.seat, `— round 1 —`);
		void this.maybeBot();
	}
}

export { moveByKey };
