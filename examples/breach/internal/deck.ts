// ── The deck ─────────────────────────────────────────────────────────────────
// Where cards come from.
//
// ── The catalogue is generated; the piles are not ────────────────────────────
// This file used to parse `cards.yaml` into a `CATALOGUE` and validate it on
// the way in. That work now happens once, in Go, against the canonical
// `internal/breach/cards.yaml` — a card whose owner does not exist or whose
// kind is a typo fails `make breachgen` rather than failing deep inside a
// resolution in somebody's browser. The catalogue is re-exported below so every
// importer keeps importing what it always imported.
//
// What is still authored here is the PILES: shuffling, dealing, drawing. Those
// belong to the offline demo and to nothing else —
//
//   - On a real table the server owns the deck. Or rather, it will: today it has
//     no hand model at all and checks only that a played card belongs to your
//     character, which is a known gap being closed separately. Either way the
//     pile below is not what a networked game is played from.
//   - `BreachMatch.perform` refuses to resolve once `remote` is set, so nothing
//     here can spend a card on a table that has an authority.
//
// So: read this as demo scaffolding, not as the deck. When the server grows a
// real pile, everything below `Shuffling` deletes.

import { CATALOGUE, type CardDef, type Faction } from './rules.gen.js';

export {
	CATALOGUE,
	abilitiesOf,
	abilityByKey,
	cardByKey,
	catalogueFor,
	powerOf
} from './rules.gen.js';

export type { Ability, CardDef, Power } from './rules.gen.js';

/**
 * One instance of a card, in a hand or a pile.
 *
 * `uid` is not optional and never will be. `CardFan` keys its `{#each}` on the
 * card, and with copies in a deck two cards in one hand share a key — which in
 * Svelte is not a cosmetic problem, it is a crash. Identity belongs to the
 * instance, not to the card type.
 */
export interface HandCard {
	uid: string;
	key: string;
	/** When it arrived, so the fan can animate a mid-turn draw without the
	 *  engine having to run a queue. */
	enteredAt: number;
}

// ── Shuffling ────────────────────────────────────────────────────────────────
// Offline only. See the header.

/** A seeded PRNG. Small, dependency-free, and good enough for a card shuffle —
 *  the requirement is "the same seed deals the same match", not cryptography. */
export function makeRng(seed: number): () => number {
	// mulberry32.
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Fisher–Yates, against an injected source of randomness so a seeded table
 *  deals the same cards twice. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

let uidSeq = 0;
export const mintCard = (key: string): HandCard => ({
	uid: `c${++uidSeq}`,
	key,
	enteredAt: Date.now()
});

/**
 * Build a faction's draw pile.
 *
 * Every copy of every card the side's two seats bring. There is no card held
 * out of it any more: the move that belongs to exactly one character is that
 * character's POWER, and a power was never in the pile to be held out of it.
 */
export function buildDeck(side: Faction, rng: () => number = Math.random): HandCard[] {
	const keys = CATALOGUE.filter((c: CardDef) => c.side === side).flatMap((c: CardDef) =>
		Array.from({ length: c.copies }, () => c.ability.key)
	);
	return shuffle(keys, rng).map(mintCard);
}

/**
 * The opening hand for one seat.
 *
 * Straight off the top. Returns the hand and what is left of the pile, rather
 * than mutating — the engine holds the piles as state and a helper that edits
 * them behind its back is a helper that desynchronises.
 */
export function openingHand(
	klassKey: string,
	pile: HandCard[],
	size: number
): { hand: HandCard[]; pile: HandCard[] } {
	return { hand: pile.slice(0, size), pile: pile.slice(size) };
}
