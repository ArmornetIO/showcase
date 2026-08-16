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

import type { Klass } from './rules.js';

export type UpgradeKind = 'roll' | 'ap' | 'quiet' | 'harden';

export interface Upgrade {
	key: string;
	/** Round it comes online. */
	at: number;
	kind: UpgradeKind;
	/** How much. Rendered as the number on the slot. */
	value: number;
	name: string;
	/** Icon name from the library set. */
	icon: string;
	/** The sentence, for a tooltip. Never rendered inline. */
	text: string;
}

/** What each kind does, in the two words a legend can carry. */
export const UPGRADE_KIND: Record<UpgradeKind, { label: string; glyph: string; hue: string }> = {
	roll: { label: 'roll', glyph: 'zap', hue: '#FBBF24' },
	ap: { label: 'action', glyph: 'plus', hue: '#34D399' },
	quiet: { label: 'quiet', glyph: 'eye-off', hue: '#A78BFA' },
	harden: { label: 'wall', glyph: 'shield', hue: '#38BDF8' }
};

/** Rounds the three slots come online. Same for every seat. */
export const UPGRADE_ROUNDS = [3, 6, 9] as const;

export const UPGRADES: Record<string, Upgrade[]> = {
	maintainer: [
		{
			key: 'reviewer',
			at: 3,
			kind: 'roll',
			value: 1,
			name: 'Trusted Reviewer',
			icon: 'check-circle',
			text: 'Two years of good patches. +1 on everything you attempt.'
		},
		{
			key: 'commit',
			at: 6,
			kind: 'quiet',
			value: 2,
			name: 'Commit Rights',
			icon: 'key',
			text: 'You are supposed to be in here now. Your actions make 2 less heat.'
		},
		{
			key: 'release',
			at: 9,
			kind: 'roll',
			value: 2,
			name: 'Release Manager',
			icon: 'package',
			text: 'You sign the tarball. +2 more on everything you attempt.'
		}
	],
	state: [
		{
			key: 'infra',
			at: 3,
			kind: 'quiet',
			value: 3,
			name: 'Clean Infrastructure',
			icon: 'eye-off',
			text: 'Nothing points back. Your actions make 3 less heat.'
		},
		{
			key: 'cover',
			at: 6,
			kind: 'roll',
			value: 2,
			name: 'Deep Cover',
			icon: 'snowflake',
			text: 'Patience is a capability. +2 on everything you attempt.'
		},
		{
			key: 'burst',
			at: 9,
			kind: 'ap',
			value: 1,
			name: 'Burst Capacity',
			icon: 'cpu',
			text: 'The budget finally lands. +1 action point a round.'
		}
	],
	architect: [
		{
			key: 'baseline',
			at: 3,
			kind: 'harden',
			value: 1,
			name: 'Hardened Baseline',
			icon: 'shield',
			text: 'Every building on your side stands 1 higher.'
		},
		{
			key: 'reproducible',
			at: 6,
			kind: 'harden',
			value: 2,
			name: 'Reproducible Builds',
			icon: 'git-merge',
			text: 'Determinism is a wall. 2 more on top of that.'
		},
		{
			key: 'immutable',
			at: 9,
			kind: 'ap',
			value: 1,
			name: 'Immutable Releases',
			icon: 'lock',
			text: 'Nothing ships unreviewed. +1 action point a round.'
		}
	],
	hunter: [
		{
			key: 'net',
			at: 3,
			kind: 'roll',
			value: 1,
			name: 'Wide Net',
			icon: 'radar',
			text: 'More sensors, more coverage. +1 on everything you attempt.'
		},
		{
			key: 'behaviour',
			at: 6,
			kind: 'ap',
			value: 1,
			name: 'Behavioural Baseline',
			icon: 'activity',
			text: 'You know what normal looks like. +1 action point a round.'
		},
		{
			key: 'attribution',
			at: 9,
			kind: 'harden',
			value: 2,
			name: 'Attribution Engine',
			icon: 'fingerprint',
			text: 'Naming them is a defence. Your side stands 2 higher.'
		}
	]
};

/** Every upgrade a seat will ever have, in unlock order. */
export const trackFor = (klass: Klass): Upgrade[] => UPGRADES[klass.key] ?? [];

/** The ones that have come online by this round. */
export const unlockedFor = (klass: Klass, round: number): Upgrade[] =>
	trackFor(klass).filter((u) => round >= u.at);

/** Total of one effect kind for a seat at a given round. The single place the
 *  rest of the engine asks "what is this seat's bonus", so adding an upgrade
 *  never means touching resolution. */
export function bonus(klass: Klass, round: number, kind: UpgradeKind): number {
	return unlockedFor(klass, round)
		.filter((u) => u.kind === kind)
		.reduce((sum, u) => sum + u.value, 0);
}
