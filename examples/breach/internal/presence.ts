// ── Player presence ──────────────────────────────────────────────────────────
// Who else is at this table, and — the part a roster list cannot say — where
// they are POINTED.
//
// The whole module is one pure function. It takes a snapshot and returns a
// model; it holds no state, touches no DOM, and imports nothing that needs a
// browser. That is not tidiness for its own sake: presence is the one read in
// this game that could hand a seat something it has not earned, so it has to be
// checkable in isolation, in Node, without mounting a globe.
//
// ── The fog argument ─────────────────────────────────────────────────────────
// Presence is derived from the LOG, and only ever from the fogged view of it
// (`feed`). Nothing here consults `footholds`, `garrison`, or any other raw
// board state. That is deliberate and it is the entire safety case:
//
//   * the log already decides, per row, which side may read it;
//   * a row the viewing seat cannot read is not in `feed` at all — not dimmed,
//     absent — so it contributes no trace, no pressure, and no tell;
//   * rows that DO cross the line (the heat tells) carry `where` and no
//     `actor`, so they land as anonymous pressure on a region.
//
// So there is exactly one gate, and it is the one the game already trusts. Add
// a second source here and that argument collapses — if you need presence to
// know something new, teach the LOG to say it, with an audience attached.
//
// The resolution rule that falls out of this: a trace names a TERRITORY, never
// a structure. Which region somebody has been working in is the tell blue is
// owed; which building is the thing red is spending the whole match hiding.

import { audienceAllows, type LogEntry, type LogTone } from './log.js';
import {
	INITIATIVE,
	ROSTER,
	TERRITORY_ORDER,
	klassByKey,
	type Faction,
	type Klass,
	type TerritoryKey
} from './rules.js';

/** How the viewing seat stands to another seat. Three cases, because in 2v2 an
 *  ally is a different kind of fact from an enemy and the view must be able to
 *  paint them differently without re-deriving factions. */
export type PresenceRelation = 'self' | 'ally' | 'enemy';

/** How many rounds back a trail reaches before a trace is forgotten. Short on
 *  purpose: a twelve-round game whose trails never fade ends up with every
 *  region marked by everyone, which is the same as marking nothing. */
export const MEMORY_ROUNDS = 4;

/** Action points a seat is issued each turn. Presence renders "what they have
 *  left to spend on you", which needs the ceiling as well as the count. */
export const AP_PER_TURN = 3;

/** One sighting: a seat, in a region, on a round. */
export interface PresenceTrace {
	territory: TerritoryKey;
	round: number;
	/** 1 for this round, fading to 0 at the edge of memory. */
	weight: number;
	/** Severity as the log meant it, so a renderer can tell a win from a miss. */
	tone: LogTone;
}

/** Who is holding a chair. The kind travels with the name because a
 *  demonstrator has a name too — "R1 · demonstrator" — and a reader that has to
 *  recognise a chair by its label is a reader that will get it wrong. */
export interface Seated {
	name: string;
	/** `ai` is the demonstrator — the chair plays itself. */
	kind: 'human' | 'ai';
}

/** One seat, as this viewer is allowed to see them. */
export interface SeatPresence {
	key: string;
	/** Table position, e.g. `R1`. */
	seat: string;
	/** The CHARACTER — "The Maintainer". A role, not a person: it is issued by
	 *  the lobby and changes between matches. */
	name: string;
	/** The PERSON holding that character, when one is known. Null in a local
	 *  game, where there is nobody else to name, and for a chair the
	 *  demonstrator is playing. A roster answers "who is at this table", and
	 *  that question is about people. */
	player: string | null;
	/** Nobody is sitting here — the demonstrator plays this chair. True for an
	 *  unclaimed seat and false for one a person is holding; false is also what a
	 *  local game with no seating information says, which is the old behaviour. */
	automatic: boolean;
	color: string;
	icon: string;
	faction: Faction;
	relation: PresenceRelation;
	/** Acting right now. */
	active: boolean;
	ap: number;
	apMax: number;
	/** Index into INITIATIVE — their fixed chair. */
	initiative: number;
	/** Chairs until they act. 0 is now, 1 is next. The interleave (R1→B1→R2→B2)
	 *  is invisible in a list and obvious once this is a number. */
	order: number;
	/** Where they have been working, newest first, as far as this seat can
	 *  prove. Empty means they have shown this viewer nothing — which for an
	 *  enemy is the normal state and is itself worth drawing. */
	trail: PresenceTrace[];
	/** The region they are most recently known to have touched. */
	focus: TerritoryKey | null;
	/** Rounds since they last surfaced. `null` when they never have. */
	quietFor: number | null;
	/** 0–1. How loudly they are present: recency of the trail, lifted while it
	 *  is their turn. Renderers use it for opacity and scale so a seat that has
	 *  gone quiet visibly recedes instead of sitting there at full strength. */
	intensity: number;
}

/** One region, and who is leaning on it. */
export interface TerritoryPressure {
	territory: TerritoryKey;
	/** Summed trace weight, normalised 0–1 across the board. */
	total: number;
	/** Attributed weight, per seat key. */
	bySeat: Record<string, number>;
	/** Weight from rows that named a region but no actor — the tells. Drawing
	 *  this separately is what keeps "somebody is in the Commons" from being
	 *  rendered as "the Hunter is in the Commons". */
	anonymous: number;
	/** Sides demonstrably working here. */
	factions: Faction[];
	/** Both sides are. The Outlands is supposed to look like this and currently
	 *  looks like everywhere else. */
	contested: boolean;
}

/** Everything the presence renderers read. */
export interface PresenceModel {
	round: number;
	phase: number;
	activeKey: string;
	/** 0–1 of the turn clock remaining. */
	clock: number;
	/** The viewing seat. */
	self: SeatPresence;
	/** All four, in INITIATIVE order — including the viewer. A renderer that
	 *  wants the other three filters; one drawing a table wants all four, and
	 *  ordering by initiative rather than by roster is what makes a ring work. */
	seats: SeatPresence[];
	/** By territory, in TERRITORY_ORDER. */
	pressure: TerritoryPressure[];
	/** True once anything at all has been seen. Renderers use it to stay silent
	 *  on round one rather than drawing an empty apparatus. */
	anySighting: boolean;
}

/**
 * The snapshot presence is computed from.
 *
 * `feed` is the contract. It must be the FOG-GATED log — `match.feed`, never
 * `match.log`. The type cannot enforce that, so the name and this sentence are
 * doing the work: everything downstream assumes every row here is a row this
 * seat is allowed to read.
 */
export interface PresenceInput {
	seatKey: string;
	round: number;
	phase: number;
	turnLeft: number;
	turnMs: number;
	ap: Record<string, number>;
	feed: LogEntry[];
	/** Who is holding each character, keyed by klass key.
	 *
	 *  Optional, and empty is the correct answer for a local game. It is NOT fog
	 *  material: the lobby's seating is sent to everybody at the table and always
	 *  was — who is playing is the one thing a roster is FOR. The fog is about
	 *  what they are doing, and none of that comes from here. */
	players?: Record<string, Seated>;
}

/** Recency fade. Linear, so a trace from this round is 1 and one at the edge of
 *  memory is ~0 — and anything older contributes nothing at all. */
function decay(round: number, now: number): number {
	const age = now - round;
	if (age < 0 || age >= MEMORY_ROUNDS) return 0;
	return 1 - age / MEMORY_ROUNDS;
}

function relationOf(viewer: Klass, other: Klass): PresenceRelation {
	if (viewer.key === other.key) return 'self';
	return viewer.faction === other.faction ? 'ally' : 'enemy';
}

/**
 * Read presence off a match snapshot.
 *
 * Pure. Same input, same model — which is what lets a test assert the fog rule
 * directly: build a feed, ask for blue's model, and check that red's quiet work
 * produced an anonymous region and not a named seat.
 */
export function derivePresence(input: PresenceInput): PresenceModel {
	const viewer = klassByKey(input.seatKey);

	// ── Walk the feed once ─────────────────────────────────────────────────────
	// Newest first, which is how the log stores it. Two buckets fall out: traces
	// that name somebody, and weight that does not.
	const traces = new Map<string, PresenceTrace[]>();
	const anonymous = new Map<TerritoryKey, number>();

	for (const row of input.feed) {
		if (!row.where) continue;
		const round = row.round ?? input.round;
		const weight = decay(round, input.round);
		if (weight <= 0) continue;

		// Reading a row and being told who wrote it are two different permissions.
		// A repelled attack reaches the whole table while the attacker does not,
		// so a row this viewer may read but not attribute degrades to anonymous
		// pressure rather than being dropped — the region still moved, and that
		// much is true for everyone.
		const named = row.actor && audienceAllows(row.actorSee ?? 'all', viewer.faction);

		if (!named) {
			anonymous.set(row.where, (anonymous.get(row.where) ?? 0) + weight);
			continue;
		}
		const list = traces.get(row.actor!) ?? [];
		// One trace per seat per region per round. A resolution pushes several
		// rows and they are all the same sighting — without this a loud turn
		// reads as a seat standing somewhere four times over.
		if (!list.some((t) => t.territory === row.where && t.round === round)) {
			list.push({ territory: row.where, round, weight, tone: row.tone });
		}
		traces.set(row.actor!, list);
	}

	// ── Seats ──────────────────────────────────────────────────────────────────
	const seats: SeatPresence[] = INITIATIVE.map((key, initiative) => {
		const klass = ROSTER.find((r) => r.key === key) ?? ROSTER[0];
		const trail = (traces.get(key) ?? []).slice(0, 8);
		const active = INITIATIVE[input.phase] === key;
		const recent = trail[0]?.weight ?? 0;

		return {
			key,
			seat: klass.seat,
			name: klass.name,
			player: input.players?.[key]?.name ?? null,
			automatic: (input.players?.[key]?.kind ?? 'human') === 'ai',
			color: klass.color,
			icon: klass.icon,
			faction: klass.faction,
			relation: relationOf(viewer, klass),
			active,
			ap: input.ap[key] ?? 0,
			apMax: AP_PER_TURN,
			initiative,
			order: (initiative - input.phase + INITIATIVE.length) % INITIATIVE.length,
			trail,
			focus: trail[0]?.territory ?? null,
			quietFor: trail.length ? input.round - trail[0].round : null,
			// A seat mid-turn is present whatever their history says — they are
			// demonstrably here, you are watching the clock run on them.
			intensity: active ? 1 : Math.min(1, recent)
		};
	});

	// ── Pressure ───────────────────────────────────────────────────────────────
	const raw = TERRITORY_ORDER.map((territory) => {
		const bySeat: Record<string, number> = {};
		const factions = new Set<Faction>();

		for (const seat of seats) {
			const w = seat.trail
				.filter((t) => t.territory === territory)
				.reduce((sum, t) => sum + t.weight, 0);
			if (w <= 0) continue;
			bySeat[seat.key] = w;
			factions.add(seat.faction);
		}

		const anon = anonymous.get(territory) ?? 0;
		const attributed = Object.values(bySeat).reduce((a, b) => a + b, 0);
		return {
			territory,
			total: attributed + anon,
			bySeat,
			anonymous: anon,
			factions: [...factions],
			// Anonymous weight alone cannot prove a contest — one unattributed
			// tell is one side being noticed, not two sides colliding.
			contested: factions.size > 1
		};
	});

	// Normalise against the loudest region rather than an absolute, so the board
	// reads the same in round two as in round eleven: pressure is a comparison
	// between regions, not a units-of-noise measurement.
	const peak = Math.max(...raw.map((p) => p.total), 0);
	const pressure: TerritoryPressure[] = raw.map((p) => ({
		...p,
		total: peak > 0 ? p.total / peak : 0
	}));

	return {
		round: input.round,
		phase: input.phase,
		activeKey: INITIATIVE[input.phase] ?? INITIATIVE[0],
		clock: input.turnMs > 0 ? Math.max(0, Math.min(1, input.turnLeft / input.turnMs)) : 0,
		self: seats.find((s) => s.key === viewer.key) ?? seats[0],
		seats,
		pressure,
		anySighting: traces.size > 0 || anonymous.size > 0
	};
}
