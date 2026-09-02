// ── What another seat's skill actually means ─────────────────────────────────
// `SKILL_BLURB` in the engine is flavour — "Not being seen doing any of it" is
// a nice line and tells a player nothing they can act on. It never says which
// cards the number governs or what it is worth on the dice.
//
// This supplies that, for ONE remaining caller: the hero stack, which draws the
// other three seats. You cannot see an enemy's hand, so their spread is the only
// read you get on what they are dangerous at — there the number IS the
// information, and one line covers it.
//
// It used to serve your own panel too. It does not any more: see `MyStats`, and
// the size this file had to be for that to work is why.
//
//   `SKILL_DOES`   one clause, grounded in how the catalogue actually splits.
//   `skillChance`  what the rating is worth as a percentage, computed.
//   `rollsOn`      which cards roll on it, read off the catalogue live.
//
// Both of the latter are COMPUTED rather than written down: a hand-typed odds
// figure goes stale the first time somebody rebalances a card.
import { abilitiesOf, oddsAtLeast, powerOf, type Skill } from '../internal/rules.js';

/**
 * The yardstick a rating is measured against.
 *
 * Not picked for being round: `computeOdds` falls back to exactly this when no
 * building is defending, and the softest step of the payload path is hardened to
 * the same number. Any other reference would be a figure this page invented.
 */
export const REFERENCE_DC = 8;

/**
 * What a rating is worth on 2d6 — the odds it clears the reference wall on the
 * skill alone.
 *
 * The roll is flat (2d6 + skill + whatever the card brings, against the wall),
 * so a point of skill is a point off what the dice have to reach. A percentage
 * is the only form of that fact anybody can compare at a glance: `+3` versus
 * `+1` is meaningless until it is 72% versus 42%.
 */
export function skillChance(rating: number): number {
	return oddsAtLeast(REFERENCE_DC - rating + 1);
}

/**
 * The mechanical reading of each skill, in one clause.
 *
 * These were three times this long, and the length was the argument that killed
 * the skills row on your own panel: a stat needing a paragraph is a stat with no
 * decision attached. What survives is the enemy read — "what is this seat
 * dangerous at" — and that question fits on one line.
 *
 * Every claim was checked against the twelve cards in `CATALOGUE` and the four
 * powers. The splits are real and unusually clean.
 */
export const SKILL_DOES: Record<Skill, string> = {
	social: 'Cards that lean on somebody’s trust or signature.',
	tech: 'Cards that change what the artifact is.',
	opsec: 'Cards that act without leaving a name on it.',
	analysis: 'Cards that look rather than act — every recon card in the game.'
};

/** Which of a seat's cards roll on this skill. The card TYPES a character can
 *  ever hold, not their hand: that list is printed in the rulebook, so naming it
 *  for an enemy gives nothing away. Their power counts — it rolls like a card. */
export function rollsOn(klassKey: string, skill: Skill): string[] {
	const names = abilitiesOf(klassKey)
		.filter((a) => a.skill === skill)
		.map((a) => a.name);
	const power = powerOf(klassKey);
	if (power && power.skill === skill) names.push(power.name);
	return names;
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;
