// ── THE OUTFITTER · the catalogue ────────────────────────────────────────────
// What a player can put on, as data. Carried over from the Locker's catalogue
// with the economics intact — and with the art taken out.
//
// THE CHANGE THAT MATTERS: an item no longer CONTAINS its art. It names a
// `wearable`, and the geometry lives in `$lib/character/wearables.ts` with the
// rest of the model. The old file held raw SVG strings in a private 100×100
// box; nothing here holds a path, a viewBox or a `d` attribute, and that is the
// whole point of the rewrite. A catalogue that can express a drawing will
// eventually contain one.
//
// What survives unchanged, because it was right:
//
//   1. `lock` is NOT ownership. It is the price tag — how somebody WOULD come
//      to have this. Ownership is a separate set (the account's entitlements),
//      which is what makes "grant the alpha players the alpha crown" a row in a
//      table rather than a special case in the renderer.
//
//   2. Cosmetics never touch the rules. Every item below changes a silhouette
//      or a hue; none changes a die roll, a cost or a target. That line is
//      easier to hold when nothing here can express a stat in the first place.

import { ANCHORS, WEARABLES, type Anchor } from '$lib/character/wearables.js';

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
 * A category in the filter.
 *
 * One per body anchor, plus `trim` — the player's colour, which is the one
 * cosmetic that is not an object at all. Everything else is geometry.
 */
export type Category = Anchor | 'trim';

export interface Item {
	key: string;
	category: Category;
	/**
	 * What this item OCCUPIES, which is not always its category.
	 *
	 * A card is one place on the figure but three things at once — a back, a
	 * frame and a stamp compose onto one slate. Filing them under one category
	 * keeps the filter honest (you are looking at one card), while giving them
	 * separate slots keeps equipping honest (a frame must not evict the back it
	 * sits on). Everything else has exactly one slot per category, so its slot
	 * is its category and nobody has to think about the distinction.
	 */
	slot: string;
	name: string;
	rarity: Rarity;
	/** Which solid this puts on the figure. Absent only for `trim`, which is a
	 *  colour rather than a thing. */
	wearable?: string;
	/** `trim` items only. */
	color?: string;
	lock?: Lock;
	blurb?: string;
}

const it = (
	key: string,
	category: Category,
	name: string,
	rarity: Rarity,
	extra: Partial<Item> = {}
): Item => ({
	key,
	category,
	// `back.charter` → `hand.back`. The prefix already names the kind, so the
	// slot falls out of the key rather than being repeated on every row.
	slot: category === 'hand' ? `hand.${key.split('.')[0]}` : category,
	name,
	rarity,
	wearable: key,
	...extra
});

const price = (marks: number): Lock => ({ kind: 'price', marks });
const alpha = (note: string): Lock => ({ kind: 'reward', label: 'Alpha', note });

// ── Head ─────────────────────────────────────────────────────────────────────
const HEAD: Item[] = [
	it('hat.none', 'crown', 'Bare', 'standard'),
	it('hat.beanie', 'crown', 'Beanie', 'standard'),
	it('hat.hardhat', 'crown', 'Hard Hat', 'standard'),
	it('hat.headset', 'crown', 'Headset', 'standard'),
	it('hat.beret', 'crown', 'Beret', 'issued', { lock: price(300) }),
	it('hat.cap', 'crown', 'Turned Cap', 'issued', { lock: price(300) }),
	it('hat.tophat', 'crown', 'Top Hat', 'rare', { lock: price(1100) }),
	it('hat.horns', 'crown', 'Horns', 'rare', { lock: price(1100) }),
	it('hat.crown', 'crown', 'Table Crown', 'alpha', {
		lock: alpha('Won a table during the alpha. Never sold.'),
		blurb: 'Everyone at the table can see it. That is the entire feature.'
	}),
	it('hat.halo', 'crown', 'Clean Record', 'alpha', {
		lock: alpha('Closed a match on zero detection. Never sold.')
	})
];

// ── Eyes ─────────────────────────────────────────────────────────────────────
const EYES: Item[] = [
	it('hat.visor', 'brow', 'Optic Visor', 'issued', {
		lock: price(300),
		blurb: 'The only worn thing that sits in front of the visor without covering it.'
	})
];

// ── Emblem ───────────────────────────────────────────────────────────────────
// The mark on your chest. Six ship with the game; the rest are earned or bought.
const EMBLEM: Item[] = [
	it('emblem.chevron', 'chest', 'Chevron', 'standard'),
	it('emblem.bars', 'chest', 'Bars', 'standard'),
	it('emblem.star', 'chest', 'Star', 'standard'),
	it('emblem.ring', 'chest', 'Ring', 'standard'),
	it('emblem.cross', 'chest', 'Saltire', 'standard'),
	it('emblem.wedge', 'chest', 'Wedge', 'standard'),
	it('emblem.keyhole', 'chest', 'Keyhole', 'issued', {
		lock: price(400),
		blurb: 'For sides that get in without breaking anything.'
	}),
	it('emblem.eye', 'chest', 'The Eye', 'issued', { lock: price(400) }),
	it('emblem.skull', 'chest', 'Deadhand', 'rare', { lock: price(1200) }),
	it('emblem.crown', 'chest', 'Regent', 'rare', { lock: price(1200) }),
	it('emblem.zero', 'chest', 'Patient Zero', 'alpha', {
		lock: alpha('Sat at one of the first hundred tables. Never sold.'),
		blurb: 'The mark of somebody who was here before the game worked.'
	})
];

// ── The card in your hand ────────────────────────────────────────────────────
// One anchor, three kinds of thing that compose onto it: the back carries the
// card body, the frame rings its edge, the stamp is struck on its face. They
// share a category because they share a place on the figure — you are looking
// at one card, not three.
const CARD: Item[] = [
	it('back.issue', 'hand', 'Standard Issue', 'standard'),
	it('back.grid', 'hand', 'Subnet', 'standard'),
	it('back.hazard', 'hand', 'Hazard', 'issued', { lock: price(500) }),
	it('back.static', 'hand', 'Carrier Loss', 'rare', { lock: price(1000) }),
	it('back.charter', 'hand', 'The Charter', 'alpha', {
		lock: alpha('Signed the alpha charter. Never sold.')
	}),
	it('frame.none', 'hand', 'Unframed', 'standard'),
	it('frame.hairline', 'hand', 'Hairline', 'standard'),
	it('frame.rivet', 'hand', 'Riveted', 'issued', { lock: price(450) }),
	it('frame.chamfer', 'hand', 'Chamfer', 'rare', {
		lock: price(1300),
		blurb: 'The HUD’s own cut, borrowed onto a card.'
	}),
	it('stamp.slash', 'hand', 'Slash', 'standard'),
	it('stamp.pin', 'hand', 'Pin', 'issued', { lock: price(200) }),
	it('stamp.seal', 'hand', 'First Blood', 'alpha', {
		lock: alpha('First recorded breach on a live table. Never sold.')
	})
];

// ── Trim ─────────────────────────────────────────────────────────────────────
// The player's colour: what everything worn is painted in. Not an object, so it
// has no wearable — the one honest exception to "everything is geometry", since
// a hue is not a shape.
const trim = (key: string, name: string, color: string, rarity: Rarity, lock?: Lock, blurb?: string): Item => ({
	key: `trim.${key}`,
	category: 'trim',
	name,
	slot: 'trim',
	color,
	rarity,
	lock,
	blurb
});

const TRIM: Item[] = [
	trim('rose', 'Trespass Rose', '#FB7185', 'standard'),
	trim('sky', 'Watch Blue', '#38BDF8', 'standard'),
	trim('amber', 'Sodium', '#F59E0B', 'standard'),
	trim('lime', 'Signal', '#84CC16', 'standard'),
	trim('violet', 'Nightshift', '#A78BFA', 'issued', price(250)),
	trim('teal', 'Coolant', '#2DD4BF', 'issued', price(250)),
	trim('ash', 'Ash', '#94A3B8', 'rare', price(900), 'No hue at all, which is its own statement.'),
	trim('ember', 'Ember', '#FF5A1F', 'rare', price(900)),
	trim(
		'gold',
		'First Light',
		'#F5B942',
		'alpha',
		alpha('Granted with the alpha charter. Never sold.'),
		'Gold reads as a claim in every other game too. That is the point.'
	)
];

export const CATALOG: Item[] = [...HEAD, ...EYES, ...EMBLEM, ...CARD, ...TRIM];

/** The filter's categories, in the order it offers them. Derived from the
 *  anchors the model actually publishes, so a new anchor cannot be added to the
 *  body and forgotten here. */
export const CATEGORIES: { key: Category; label: string; hint: string }[] = [
	...ANCHORS.filter((a) => CATALOG.some((i) => i.category === a.key)).map((a) => ({
		key: a.key as Category,
		label: a.key === 'chest' ? 'Emblem' : a.key === 'hand' ? 'Card' : a.label,
		hint: a.hint
	})),
	{ key: 'trim', label: 'Colour', hint: 'The hue everything you wear is painted in.' }
];

export const inCategory = (c: Category) => CATALOG.filter((i) => i.category === c);

/** The slots a category owns, in catalogue order. One for most things, three
 *  for the card. */
export const slotsOf = (c: Category) => [...new Set(inCategory(c).map((i) => i.slot))];

export const item = (key: string) => CATALOG.find((i) => i.key === key);

/** The default loadout: the first free item in each category. What a brand new
 *  account looks like, and what "Reset" goes back to. */
export const DEFAULT_LOADOUT: Record<string, string> = {
	crown: 'hat.none',
	brow: 'hat.visor',
	chest: 'emblem.wedge',
	'hand.back': 'back.issue',
	'hand.frame': 'frame.none',
	'hand.stamp': 'stamp.slash',
	trim: 'trim.rose'
};

/** Every wearable key in a loadout, for `art({ worn })`. Categories that hold a
 *  colour rather than an object contribute nothing. */
export function wornFrom(loadout: Record<string, string>): string[] {
	return Object.values(loadout)
		.map((k) => item(k)?.wearable)
		.filter((k): k is string => !!k && !!WEARABLES[k]);
}
