// ── BREACH v2 — the whole ruleset ────────────────────────────────────────────
// One file. Every number, every move, every legality check. If a rule is not in
// here it does not exist, and that is the entire design goal of v2: v1's rules
// are spread across a Go engine, a YAML pair, a generated TS mirror and a 2,600
// line client twin, and the two halves have already drifted.
//
// v2 is DELIBERATELY smaller than v1. What was cut, and why, is in README.md.
// The short version: four buildings in a line, four seats, three moves each,
// six rounds, one meter. Nothing is hidden from anybody.

import { oddsAtLeast, roll2d6, DICE, type DiceSource } from '../internal/rules.js';

export { oddsAtLeast, roll2d6, DICE };
export type { DiceSource };

// ── Tuning ───────────────────────────────────────────────────────────────────
// Every balance number in the game, in one block, because a short match is
// tuned by playing it and a number you have to hunt for is a number nobody
// tunes. Nothing else in this file hard-codes a quantity.

export const ROUNDS = 6;
/** Action points per seat per turn. Unspent AP is lost — there is no bank. */
export const AP = 2;
/** Alert is capped, and the cap is what bounds how hard the walls can get. */
export const ALERT_CAP = 12;
/** Every this-many points of Alert adds +1 to every wall on the board. */
export const ALERT_PER_WALL = 4;
/** Alert cools by this much at the top of each round. */
export const ALERT_DECAY = 1;
/** However worn a building gets, an attack still has to beat this. */
export const WALL_FLOOR = 4;
/** Trust rides every red attack. Capped so the Maintainer cannot just farm. */
export const TRUST_CAP = 3;
/** A failed attack still leaves the wall this much worse. */
export const CHIP_ON_FAIL = 1;

// ── Outcome ──────────────────────────────────────────────────────────────────
// Four bands, not five. v1's botch band had its own colour, its own verb and
// three special-case rules, and on most rolls in the game its probability was
// exactly zero. Ties still go to the defender.

export type Outcome = 'fail' | 'partial' | 'clean' | 'critical';

export const outcomeFor = (margin: number): Outcome =>
	margin <= 0 ? 'fail' : margin <= 3 ? 'partial' : margin <= 7 ? 'clean' : 'critical';

export const hit = (o: Outcome) => o !== 'fail';

export const OUTCOME_LABEL: Record<Outcome, string> = {
	fail: 'FAILED',
	partial: 'PARTIAL',
	clean: 'CLEAN',
	critical: 'CRITICAL'
};

export const OUTCOME_COLOR: Record<Outcome, string> = {
	fail: '#94A3B8',
	partial: '#FBBF24',
	clean: '#34D399',
	critical: '#7DD3FC'
};

/** The printed number, scaled by how well the roll went. */
export const scaled = (o: Outcome, base: number): number =>
	o === 'fail' ? 0 : o === 'partial' ? Math.max(1, Math.ceil(base / 2)) : o === 'critical' ? base + 1 : base;

// ── The board ────────────────────────────────────────────────────────────────
// A line of four. There are no territories, no side-buildings and no neutral
// ground: v1 had 18 structures across 5 regions and 13 of them were scenery
// that no win condition ever read.

export interface Step {
	id: string;
	name: string;
	role: string;
	/** The number an attack has to beat before anything modifies it. */
	base: number;
	/** What owning it means, in one line. This is the curriculum. */
	blurb: string;
}

export const CHAIN: Step[] = [
	{
		id: 'forum',
		name: 'Maintainer Circle',
		role: 'Upstream project',
		base: 10,
		blurb: 'Two years of plausible commit history. Get trusted here and the next door opens itself.'
	},
	{
		id: 'archive',
		name: 'The Archive',
		role: 'Source repository',
		base: 12,
		blurb: 'The source of truth. Change what is written here and everything downstream builds it for you.'
	},
	{
		id: 'forge',
		name: 'The Forge',
		role: 'Build runner (CI)',
		base: 14,
		blurb: 'Runs whatever the build script says, with credentials, on a machine nobody watches.'
	},
	{
		id: 'silos',
		name: 'The Silos',
		role: 'Artifact registry',
		base: 16,
		blurb: 'What ships. Reach this and every customer downstream installs your work, signed.'
	}
];

export const stepAt = (i: number): Step => CHAIN[i];
export const stepIndex = (id: string): number => CHAIN.findIndex((s) => s.id === id);

// ── The seats ────────────────────────────────────────────────────────────────

export type Faction = 'red' | 'blue';
export type Skill = 'social' | 'tech' | 'opsec' | 'analysis';

export const SKILL_LABEL: Record<Skill, string> = {
	social: 'SOC',
	tech: 'TEC',
	opsec: 'OPS',
	analysis: 'ANA'
};

export interface Seat {
	key: SeatKey;
	name: string;
	role: string;
	faction: Faction;
	color: string;
	tagline: string;
	skills: Record<Skill, number>;
}

export type SeatKey = 'maintainer' | 'architect' | 'handler' | 'hunter';

/** Fixed initiative: red, blue, red, blue. The order never changes, so nobody
 *  has to learn it — it is just the order the four panels are drawn in. */
export const ORDER: SeatKey[] = ['maintainer', 'architect', 'handler', 'hunter'];

export const SEATS: Record<SeatKey, Seat> = {
	maintainer: {
		key: 'maintainer',
		name: 'The Maintainer',
		role: 'Patient insider',
		faction: 'red',
		color: '#F87171',
		tagline: 'Get trusted, then use it.',
		skills: { social: 3, tech: 1, opsec: 1, analysis: 0 }
	},
	architect: {
		key: 'architect',
		name: 'The Architect',
		role: 'Platform owner',
		faction: 'blue',
		color: '#60A5FA',
		tagline: 'Make the ground refuse to carry them.',
		skills: { social: 0, tech: 3, opsec: 1, analysis: 2 }
	},
	handler: {
		key: 'handler',
		name: 'The Handler',
		role: 'Operator',
		faction: 'red',
		color: '#FB923C',
		tagline: 'Big capability, bought loudly.',
		skills: { social: -1, tech: 3, opsec: 3, analysis: 1 }
	},
	hunter: {
		key: 'hunter',
		name: 'The Threat Hunter',
		role: 'Defender',
		faction: 'blue',
		color: '#22D3EE',
		tagline: 'Find it, price it, undo it.',
		skills: { social: 0, tech: 1, opsec: 1, analysis: 4 }
	}
};

export const factionOf = (k: SeatKey): Faction => SEATS[k].faction;

// ── The moves ────────────────────────────────────────────────────────────────
// Three per seat, printed on the seat, always available. There is no deck, no
// hand, no discard and no shuffle: a player's whole option set is the three
// buttons in front of them, and it never changes. That single cut removes more
// rules than everything else in this file put together.
//
// `effect` is a tag the match switches on. Every tag is implemented in
// match.svelte.ts and nowhere else, and each card's `text` says exactly what its
// tag does — v1 shipped a rulebook section called "Where the print lies".

export type Effect =
	| 'trust' // +1 Trust, no roll
	| 'cover' // −2 Alert, no roll
	| 'seal' // this step is shut until your next turn, no roll
	| 'soften' // damage a wall from a distance
	| 'attack' // take the step
	| 'harden' // raise a wall
	| 'patch' // repair damage
	| 'evict' // remove red's deepest foothold
	| 'sweep' // raise Alert
	| 'attribute'; // zero red's Trust, raise Alert

export type Aim = 'none' | 'next' | 'any';

export interface Move {
	key: string;
	name: string;
	seat: SeatKey;
	effect: Effect;
	/** What the player must click after arming this. */
	aim: Aim;
	ap: number;
	/** Added to the roll. */
	mod: number;
	skill: Skill;
	/** What the roll is measured against when no wall is defending. Absent on an
	 *  attack, where the wall IS the number, and on a move that never rolls. */
	dc?: number;
	/** The size of the effect before the outcome scales it. */
	power: number;
	/** Alert this makes by being ATTEMPTED, hit or miss — red is heard trying.
	 *  Negative cools. Blue's two Alert gains are earned by succeeding instead,
	 *  so they are scaled by the outcome and printed on the move, not here. */
	alert: number;
	/** Charges for the whole match. Absent means unlimited. */
	uses?: number;
	text: string;
}

export const MOVES: Move[] = [
	// ── Red: the Maintainer ────────────────────────────────────────────────────
	{
		key: 'contribution',
		name: 'Earnest Contribution',
		seat: 'maintainer',
		effect: 'trust',
		aim: 'none',
		ap: 1,
		mod: 0,
		skill: 'social',
		power: 1,
		alert: 0,
		text: 'No roll. +1 TRUST, up to 3. Trust adds to every red attack for the rest of the match.'
	},
	{
		key: 'pressure',
		name: 'Co-maintainer Pressure',
		seat: 'maintainer',
		effect: 'soften',
		aim: 'any',
		ap: 1,
		mod: 0,
		skill: 'social',
		dc: 8,
		power: 2,
		alert: 1,
		text: 'Wear down any building on the chain, even one you cannot reach yet. 2 damage, and it stays.'
	},
	{
		key: 'fixture',
		name: 'Obfuscated Fixture',
		seat: 'maintainer',
		effect: 'attack',
		aim: 'next',
		ap: 2,
		mod: 3,
		skill: 'social',
		power: 1,
		alert: 2,
		text: 'Take the next step, hidden in a change nobody reads closely. +3 to the roll.'
	},

	// ── Red: the Handler ───────────────────────────────────────────────────────
	{
		key: 'cover',
		name: 'Cover Tracks',
		seat: 'handler',
		effect: 'cover',
		aim: 'none',
		ap: 1,
		mod: 0,
		skill: 'opsec',
		power: 2,
		alert: -2,
		text: 'No roll. −2 ALERT. A turn spent being quiet is a turn not spent advancing.'
	},
	{
		key: 'lotl',
		name: 'Living off the Land',
		seat: 'handler',
		effect: 'attack',
		aim: 'next',
		ap: 2,
		mod: 0,
		skill: 'opsec',
		power: 1,
		alert: 0,
		text: 'Take the next step using only what is already installed there. No bonus, and no ALERT at all.'
	},
	{
		key: 'zeroday',
		name: 'Zero-Day Reserve',
		seat: 'handler',
		effect: 'attack',
		aim: 'next',
		ap: 2,
		mod: 5,
		skill: 'tech',
		power: 1,
		alert: 3,
		uses: 1,
		text: 'Once a match. +5 to the roll and +3 ALERT. Burning it is the loudest thing red can do.'
	},

	// ── Blue: the Architect ────────────────────────────────────────────────────
	{
		key: 'harden',
		name: 'Harden',
		seat: 'architect',
		effect: 'harden',
		aim: 'any',
		ap: 1,
		mod: 0,
		skill: 'tech',
		dc: 6,
		power: 2,
		alert: 0,
		text: 'Raise one wall. Partial +1, clean +2, critical +3, and it stays up for the match.'
	},
	{
		key: 'segment',
		name: 'Segment',
		seat: 'architect',
		effect: 'seal',
		aim: 'any',
		ap: 1,
		mod: 0,
		skill: 'tech',
		power: 1,
		alert: 0,
		text: 'No roll. Shut one building until your next turn. Nothing red throws at it can land.'
	},
	{
		key: 'rebuild',
		name: 'Rebuild From Source',
		seat: 'architect',
		effect: 'evict',
		aim: 'none',
		ap: 2,
		mod: 0,
		skill: 'tech',
		dc: 9,
		power: 1,
		alert: 0,
		text: 'Rebuild the deepest building red holds. Red loses it, and everything past it with it.'
	},

	// ── Blue: the Threat Hunter ────────────────────────────────────────────────
	{
		key: 'sweep',
		name: 'Sweep',
		seat: 'hunter',
		effect: 'sweep',
		aim: 'none',
		ap: 1,
		mod: 0,
		skill: 'analysis',
		dc: 7,
		power: 2,
		alert: 0,
		text: 'Comb the logs. On a hit, +2 ALERT — and every 4 ALERT is +1 on every wall on the board.'
	},
	{
		key: 'patch',
		name: 'Patch',
		seat: 'hunter',
		effect: 'patch',
		aim: 'any',
		ap: 1,
		mod: 0,
		skill: 'analysis',
		dc: 6,
		power: 2,
		alert: 0,
		text: 'Repair 2 damage on one building. Red has to wear it down again.'
	},
	{
		key: 'attribute',
		name: 'Attribution',
		seat: 'hunter',
		effect: 'attribute',
		aim: 'none',
		ap: 2,
		mod: 0,
		skill: 'analysis',
		dc: 9,
		power: 1,
		alert: 0,
		text: 'Name the persona. Red’s TRUST drops to 0 and ALERT climbs 2. The insider has to start again.'
	}
];

export const movesOf = (seat: SeatKey): Move[] => MOVES.filter((m) => m.seat === seat);
export const moveByKey = (key: string): Move => MOVES.find((m) => m.key === key)!;

/** A move that never touches the dice. Half of v2's moves are deliberately
 *  certain: the dice should decide the big swings, not the housekeeping. */
export const rolls = (m: Move): boolean => m.effect !== 'trust' && m.effect !== 'cover' && m.effect !== 'seal';

// ── The roll ─────────────────────────────────────────────────────────────────
// Four terms, and all four are on screen before the player commits. v1's red
// attack had sixteen atomic inputs, eight of which were compressed into a bare
// "vs 13" with no decomposition anywhere in the interface.

export interface Odds {
	skill: number;
	/** The move's own bonus. */
	card: number;
	/** Red's accrued trust, on an attack. Zero on everything else. */
	trust: number;
	/** +1 per step already held. The whole of v1's leverage rule, said once. */
	momentum: number;
	modifier: number;
	/** The number to beat. */
	target: number;
	/** What the dice alone have to reach. Ties go to the defender. */
	needed: number;
	neededClean: number;
	chance: number;
	chanceClean: number;
}

export function odds(parts: {
	skill: number;
	card: number;
	trust?: number;
	momentum?: number;
	target: number;
}): Odds {
	const trust = parts.trust ?? 0;
	const momentum = parts.momentum ?? 0;
	const modifier = parts.skill + parts.card + trust + momentum;
	const needed = parts.target - modifier + 1;
	return {
		skill: parts.skill,
		card: parts.card,
		trust,
		momentum,
		modifier,
		target: parts.target,
		needed,
		neededClean: needed + 3,
		chance: oddsAtLeast(needed),
		chanceClean: oddsAtLeast(needed + 3)
	};
}

// ── The wall ─────────────────────────────────────────────────────────────────
// One sum, four named terms, and the player can see all of them. v1 kept three
// parallel maps (`Hardened`, `Softened`, `Chip`) for what the UI only ever
// showed as one number, and one of the three was never written by anything.

export interface Wall {
	base: number;
	hardened: number;
	damage: number;
	alert: number;
	total: number;
}

export function wall(s: Step, hardened: number, damage: number, alert: number): Wall {
	const fromAlert = Math.floor(alert / ALERT_PER_WALL);
	const raw = s.base + hardened - damage + fromAlert;
	return {
		base: s.base,
		hardened,
		damage,
		alert: fromAlert,
		total: Math.max(WALL_FLOOR, raw)
	};
}

export const pct = (n: number): string => `${Math.round(n * 100)}%`;
