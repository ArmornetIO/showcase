// ── THE OUTFITTER · the catalogue ────────────────────────────────────────────
// What a player can BE and what they can put on, as data. Brought into the game
// from the mockup, with two things taken out and one put in.
//
//   − cards     a card is a HELD object, not a worn one. Back, frame and stamp
//               move to the deck page; the only reason they ever shared a
//               screen with a hat is that both were bought.
//   − emblems   the chest belongs to the role now. There is one mark on a
//               person and it is the badge, which nobody may buy, paint or
//               reskin — see internal/badge.ts.
//   + builds    the body itself, which used to arrive with the role. This is
//               the whole point of the split: you pick who you are, the game
//               pins one badge on you.
//
// What survives from the mockup unchanged, because it was right:
//
//   1. `lock` is NOT ownership. It is the price tag — how somebody WOULD come
//      to have this. Ownership is a separate set (the account's entitlements),
//      which is what makes "grant the alpha players the alpha crown" a row in a
//      table rather than a special case in the renderer.
//
//   2. An item never CONTAINS its art. It names a `wearable`, and the geometry
//      lives in the library with the rest of the model. Nothing here holds a
//      path, a viewBox or a `d` attribute. A catalogue that can express a
//      drawing will eventually contain one.
//
//   3. Cosmetics never touch the rules. Every item below changes a silhouette
//      or a hue; none changes a die roll, a cost or a target. A build is no
//      exception — `shape` reaches the renderer and nothing else.

import { ANCHORS, SHAPE_NOTE, WEARABLES, type Anchor, type IconName, type Shape } from 'showcase';
import { WARDROBE } from './rules.gen.js';

export type Rarity = 'standard' | 'issued' | 'rare' | 'alpha';

export const RARITY: Record<Rarity, { label: string; tone: string }> = {
	standard: { label: 'Standard', tone: '#64748B' },
	issued: { label: 'Issued', tone: '#38BDF8' },
	rare: { label: 'Rare', tone: '#A78BFA' },
	// Gold, and the only tier with no price anywhere in the catalogue.
	alpha: { label: 'Alpha', tone: '#F5B942' }
};

/** How an unowned item is obtained. `reward` is the shape that matters: it has
 *  no number, so it cannot be bought by anyone, ever — only granted. */
export type Lock =
	| { kind: 'price'; marks: number }
	| { kind: 'reward'; label: string; note: string };

/**
 * A row in the rail.
 *
 * `build` is first because it is the question the others are answered against —
 * a hat is chosen for a head, and which head is now a choice. `trim` is last
 * because it is the only one that is not a thing at all.
 *
 * `chest` is deliberately absent and must stay absent: it is the role badge's
 * anchor, and a category pointing at it would put the one unpurchasable thing
 * in the shop.
 */
export type Category = 'build' | Anchor | 'trim';

export interface Item {
	key: string;
	category: Category;
	/** What this item OCCUPIES. One slot per category here — the three-slot case
	 *  left with the cards. */
	slot: string;
	name: string;
	rarity: Rarity;
	/** Which solid this puts on the figure. Absent for `trim` (a colour, not a
	 *  thing) and for `build` (the body itself, not something on it). */
	wearable?: string;
	/** `build` items only. */
	shape?: Shape;
	/** `trim` items only. */
	color?: string;
	/** Filled from the generated WARDROBE — never written here. See CATALOG. */
	lock?: Lock;
	/** A reward's wording ("Won a table during the alpha"). Presentation only;
	 *  whether an item IS a reward comes from the server's catalogue. */
	rewardNote?: string;
	blurb?: string;
}

const it = (
	key: string,
	category: Category,
	name: string,
	rarity: Rarity,
	extra: Partial<Item> = {}
): Item => ({ key, category, slot: category, name, rarity, wearable: key, ...extra });

/**
 * An item's lock, from the generated catalogue (rules.gen.ts, emitted from
 * internal/breach/wardrobe.go). Prices are NOT typed in this file: the number
 * the outfitter shows is the number the server's purchase charges, and two
 * copies of a price list is how they would stop being the same number.
 */
function lockFor(key: string, note?: string): Lock | undefined {
	const lock = WARDROBE.find((w) => w.key === key)?.lock;
	if (lock?.kind === 'price') return { kind: 'price', marks: lock.marks };
	if (lock?.kind === 'reward') return { kind: 'reward', label: lock.label, note: note ?? '' };
	return undefined;
}

// ── Build ────────────────────────────────────────────────────────────────────
// The four bodies the library draws, offered as a choice for the first time.
//
// They used to arrive attached to a role: taking the Handler took a ghost.
//
// ALL FOUR ARE UNLOCKED and none of them carries a price. The body is the first
// thing a new account is asked to choose, and a picker where half the answers
// are a padlock is not a choice — it is an advertisement on the first screen.
// The tiers below survive as a LABEL only: a Drone still reads as rare, it just
// is not withheld. `SHAPE_NOTE` already writes each one's line and is not
// retyped here — a build described twice is a build that can be described
// wrongly once.
const BUILD: Item[] = (
	[
		['runner', 'Runner', 'standard'],
		['brute', 'Brute', 'standard'],
		['ghost', 'Ghost', 'issued'],
		['drone', 'Drone', 'rare']
	] as const
).map(([shape, name, rarity]) => ({
	key: `build.${shape}`,
	category: 'build' as Category,
	slot: 'build',
	name,
	rarity: rarity as Rarity,
	shape: shape as Shape,
	blurb: SHAPE_NOTE[shape as Shape]
}));

// ── Head ─────────────────────────────────────────────────────────────────────
const HEAD: Item[] = [
	it('hat.none', 'crown', 'Bare', 'standard'),
	it('hat.beanie', 'crown', 'Beanie', 'standard'),
	it('hat.hardhat', 'crown', 'Hard Hat', 'standard'),
	it('hat.headset', 'crown', 'Headset', 'standard'),
	it('hat.beret', 'crown', 'Beret', 'issued'),
	it('hat.cap', 'crown', 'Turned Cap', 'issued'),
	it('hat.tophat', 'crown', 'Top Hat', 'rare'),
	it('hat.horns', 'crown', 'Horns', 'rare'),
	it('hat.crown', 'crown', 'Table Crown', 'alpha', {
		rewardNote: 'Won a table during the alpha. Never sold.',
		blurb: 'Everyone at the table can see it. That is the entire feature.'
	}),
	it('hat.halo', 'crown', 'Clean Record', 'alpha', {
		rewardNote: 'Closed a match on zero detection. Never sold.'
	})
];

// ── Eyes ─────────────────────────────────────────────────────────────────────
const EYES: Item[] = [
	it('hat.visor', 'brow', 'Optic Visor', 'issued', {
		blurb: 'The only worn thing that sits in front of the visor without covering it.'
	})
];

// ── Trim ─────────────────────────────────────────────────────────────────────
// The player's colour: what everything worn is painted in. Not an object, so it
// has no wearable — the one honest exception to "everything is geometry", since
// a hue is not a shape.
const trim = (
	key: string,
	name: string,
	color: string,
	rarity: Rarity,
	rewardNote?: string,
	blurb?: string
): Item => ({ key: `trim.${key}`, category: 'trim', name, slot: 'trim', color, rarity, rewardNote, blurb });

const TRIM: Item[] = [
	trim('rose', 'Trespass Rose', '#FB7185', 'standard'),
	trim('sky', 'Watch Blue', '#38BDF8', 'standard'),
	trim('amber', 'Sodium', '#F59E0B', 'standard'),
	trim('lime', 'Signal', '#84CC16', 'standard'),
	trim('violet', 'Nightshift', '#A78BFA', 'issued'),
	trim('teal', 'Coolant', '#2DD4BF', 'issued'),
	trim('ash', 'Ash', '#94A3B8', 'rare', undefined, 'No hue at all, which is its own statement.'),
	trim('ember', 'Ember', '#FF5A1F', 'rare'),
	trim(
		'gold',
		'First Light',
		'#F5B942',
		'alpha',
		'Granted with the alpha charter. Never sold.',
		'Gold reads as a claim in every other game too. That is the point.'
	)
];

export const CATALOG: Item[] = [...BUILD, ...HEAD, ...EYES, ...TRIM].map((i) => ({
	...i,
	lock: lockFor(i.key, i.rewardNote)
}));

/** The rail's icon per category. The rail is the only navigation now, so a
 *  category with no icon is a category nobody can reach. */
const ICON: Record<Category, IconName> = {
	build: 'user',
	crown: 'shapes',
	brow: 'eye',
	shoulders: 'layers',
	back: 'flag',
	chest: 'shield',
	hand: 'hand',
	trim: 'palette'
};

/**
 * The rail's rows, in the order it offers them.
 *
 * Anchors are still filtered by whether the catalogue has anything for them —
 * `shoulders` and `back` are real anchors on the model with no items authored,
 * and a rail row that opens onto an empty grid is worse than an absent one. Add
 * geometry for them and they appear here on their own.
 */
export const CATEGORIES: { key: Category; label: string; hint: string; icon: IconName }[] = [
	{
		key: 'build',
		label: 'Build',
		hint: 'The body you play. Everything else is chosen for it.',
		icon: ICON.build
	},
	...ANCHORS.filter((a) => a.key !== 'chest' && CATALOG.some((i) => i.category === a.key)).map(
		(a) => ({ key: a.key as Category, label: a.label, hint: a.hint, icon: ICON[a.key] })
	),
	{
		key: 'trim',
		label: 'Colour',
		hint: 'The hue everything you wear is painted in.',
		icon: ICON.trim
	}
];

export const inCategory = (c: Category) => CATALOG.filter((i) => i.category === c);

export const item = (key: string) => CATALOG.find((i) => i.key === key);

/** The default loadout: the first free item in each category. What a brand new
 *  account looks like, and what "Reset" goes back to. */
export const DEFAULT_LOADOUT: Record<string, string> = {
	build: 'build.runner',
	crown: 'hat.none',
	brow: 'hat.visor',
	trim: 'trim.rose'
};

/** Every wearable key in a loadout, for `art({ worn })`. Categories that hold a
 *  colour or a body rather than an object contribute nothing. */
export function wornFrom(loadout: Record<string, string>): string[] {
	return Object.values(loadout)
		.map((k) => item(k)?.wearable)
		.filter((k): k is string => !!k && !!WEARABLES[k]);
}

/** The build a loadout names. Falls back rather than throwing: a saved
 *  character naming a build that has since been renamed must still stand up. */
export function shapeFrom(loadout: Record<string, string>): Shape {
	return item(loadout.build)?.shape ?? 'runner';
}
