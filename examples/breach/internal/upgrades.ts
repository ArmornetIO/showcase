// ── Upgrades ─────────────────────────────────────────────────────────────────
// What a character becomes over twelve rounds.
//
// Three per seat, unlocked by round rather than bought, so the curve is the same
// for everybody and nobody has to read a shop. They are deliberately drawn from
// FOUR effect kinds and no more — every one is applied in an existing code path,
// so an upgrade is a number that changes something you can already see, not a
// special case somewhere in the resolution.
//
//   roll     added to every roll you make
//   ap       extra action points a round
//   quiet    your actions make less noise
//   harden   your side's buildings stand higher
//
// That uniformity is the point: the icon and the number are the whole
// explanation, which is what lets the HUD show them with no prose at all.
//
// ── The tracks are generated ─────────────────────────────────────────────────
// The twelve upgrades themselves come from `internal/breach/rules.yaml`. What
// stays here is the colour they are drawn in, which no rule reads, and the
// Klass-shaped wrappers the components already call.

import {
	trackFor as trackForKey,
	unlockedFor as unlockedForKey,
	type UpgradeKind
} from './rules.gen.js';
import type { Klass } from './rules.js';

export { UPGRADES, UPGRADE_ROUNDS } from './rules.gen.js';
export type { Upgrade, UpgradeKind } from './rules.gen.js';

/** What each kind does, in the two words a legend can carry. Presentation: the
 *  engine has never heard of a hue. */
export const UPGRADE_KIND: Record<UpgradeKind, { label: string; glyph: string; hue: string }> = {
	roll: { label: 'roll', glyph: 'zap', hue: '#FBBF24' },
	ap: { label: 'action', glyph: 'plus', hue: '#34D399' },
	quiet: { label: 'quiet', glyph: 'eye-off', hue: '#A78BFA' },
	harden: { label: 'wall', glyph: 'shield', hue: '#38BDF8' }
};

// The generated helpers key on a klass key; every caller here holds the whole
// character. Wrapped rather than changing forty call sites — and rather than
// generating a second signature that only this app wants.

/** Every upgrade a seat will ever have, in unlock order. */
export const trackFor = (klass: Klass) => trackForKey(klass.key);

/** The ones that have come online by this round. */
export const unlockedFor = (klass: Klass, round: number) => unlockedForKey(klass.key, round);

/** Total of one effect kind for a seat at a given round. The single place the
 *  rest of the engine asks "what is this seat's bonus", so adding an upgrade
 *  never means touching resolution. */
export function bonus(klass: Klass, round: number, kind: UpgradeKind): number {
	return unlockedFor(klass, round)
		.filter((u) => u.kind === kind)
		.reduce((sum, u) => sum + u.value, 0);
}
