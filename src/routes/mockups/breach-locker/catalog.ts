// ── THE LOCKER · the cosmetic catalogue ──────────────────────────────────────
// What a player can put ON their side, as data. Nothing here knows about the
// screen that draws it: a slot is a place a mark can go, an item is a mark, and
// a lock is the sentence that says how you would come to have one.
//
// The two things worth getting right before any of this is built for real:
//
//   1. `lock` is NOT ownership. It is the price tag — how somebody WOULD get
//      this if they do not have it. Ownership is a separate set (the account's
//      entitlements), which is what makes "grant the alpha players the alpha
//      banner" a row in a table rather than a special case in the renderer. An
//      item can carry a price and still be owned, and then it wears its ribbon
//      and equips like anything else.
//
//   2. Cosmetics never touch the rules. Every item on this page changes a
//      colour, a glyph or a silhouette — none of them changes a die roll, a
//      cost or a target. That is the line that keeps a shop from being a
//      complaint, and it is easier to hold if nothing in this file can express
//      a stat in the first place.

import { EMBLEMS } from '$examples/breach/hud/team-flags.svelte.js';

export type SlotKey =
	| 'emblem'
	| 'banner'
	| 'headwear'
	| 'cardback'
	| 'frame'
	| 'finish'
	| 'killmark';

/**
 * The two things a player owns and can dress: the figure they play, and the
 * cards they play it with.
 *
 * This is the shape the whole screen turns on. A cosmetic is never a free-
 * floating setting — it is a LAYER on a base the game already gave you. The
 * base is real: an operator is a `Klass` off the roster, a card is an `Ability`
 * out of the catalogue, and both are rendered by the game's own components.
 * Everything below only adds to them.
 */
export type Subject = 'operator' | 'card';

export const SUBJECTS: { key: Subject; label: string; base: string }[] = [
	{ key: 'operator', label: 'Operator', base: 'Character' },
	{ key: 'card', label: 'Cards', base: 'Card' }
];

/** Ordered as the rail reads them, grouped inside each subject. */
export const SLOTS: {
	key: SlotKey;
	subject: Subject;
	group: string;
	label: string;
	hint: string;
}[] = [
	{ key: 'headwear', subject: 'operator', group: 'Worn', label: 'Headwear', hint: 'Sits on your figure’s head, on the board and in every roster tile.' },
	{ key: 'banner', subject: 'operator', group: 'Identity', label: 'Banner', hint: 'Your side’s colour, everywhere it flies.' },
	{ key: 'emblem', subject: 'operator', group: 'Identity', label: 'Emblem', hint: 'The mark on your flag — and the centre of your card back.' },
	{ key: 'cardback', subject: 'card', group: 'Deck', label: 'Card back', hint: 'What the table sees while the card is still yours.' },
	{ key: 'frame', subject: 'card', group: 'Deck', label: 'Frame', hint: 'Laid over the printed face. Never touches what the card says.' },
	{ key: 'finish', subject: 'card', group: 'Deck', label: 'Finish', hint: 'How the face catches the light.' },
	{ key: 'killmark', subject: 'card', group: 'Trophy', label: 'Stamp', hint: 'Struck on a card that landed, and on your rows in the feed.' }
];

export const slotsFor = (s: Subject) => SLOTS.filter((x) => x.subject === s);

export type Rarity = 'standard' | 'issued' | 'rare' | 'alpha';

export const RARITY: Record<Rarity, { label: string; tone: string }> = {
	standard: { label: 'Standard', tone: '#64748B' },
	issued: { label: 'Issued', tone: '#38BDF8' },
	rare: { label: 'Rare', tone: '#A78BFA' },
	// Gold, and the only tier with no price anywhere in the catalogue.
	alpha: { label: 'Alpha', tone: '#F5B942' }
};

/** How an unowned item is obtained. `reward` is the shape that matters: it has
 *  no number, so it cannot be bought by anyone, ever — it can only be granted. */
export type Lock =
	| { kind: 'price'; marks: number }
	| { kind: 'reward'; label: string; note: string };

export interface CosmeticItem {
	key: string;
	slot: SlotKey;
	name: string;
	rarity: Rarity;
	/** Raw SVG, viewBox `0 0 100 100` for headwear and card backs, `0 0 24 24`
	 *  for emblems and kill marks. `currentColor` throughout so one item can fly
	 *  in either side's colour without a second copy of the art. */
	art?: string;
	/** Banner items only. */
	color?: string;
	/** Finish items only — a CSS background laid over the printed face, plus the
	 *  blend mode it is laid on with. A finish is light on a surface, which is a
	 *  gradient and a blend, not geometry. */
	css?: { background: string; blend?: string; opacity?: number };
	/** Absent means everyone has it from their first table. */
	lock?: Lock;
	blurb?: string;
}

// ── Emblems ──────────────────────────────────────────────────────────────────
// The six the game ships with come straight from `team-flags.svelte.ts` rather
// than being redrawn here — a second copy of a flag glyph is a flag that can
// disagree with itself at 14px in the hero stack.
const baseEmblem = (key: keyof typeof EMBLEMS, name: string): CosmeticItem => {
	const e = EMBLEMS[key];
	return {
		key: `emblem.${key}`,
		slot: 'emblem',
		name,
		rarity: 'standard',
		art: `<path d="${e.d}" fill="${e.fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${e.fill ? 0 : 2.4}" stroke-linecap="round" stroke-linejoin="round"/>`
	};
};

const stroke = (d: string, w = 2.2) =>
	`<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const solid = (d: string) => `<path d="${d}" fill="currentColor"/>`;

const EMBLEM_ITEMS: CosmeticItem[] = [
	baseEmblem('chevron', 'Chevron'),
	baseEmblem('bars', 'Bars'),
	baseEmblem('star', 'Star'),
	baseEmblem('ring', 'Ring'),
	baseEmblem('cross', 'Saltire'),
	baseEmblem('wedge', 'Wedge'),
	{
		key: 'emblem.keyhole',
		slot: 'emblem',
		name: 'Keyhole',
		rarity: 'issued',
		art: solid('M12 4a4 4 0 0 1 2.2 7.3L16 20H8l1.8-8.7A4 4 0 0 1 12 4Z'),
		lock: { kind: 'price', marks: 400 },
		blurb: 'For sides that get in without breaking anything.'
	},
	{
		key: 'emblem.eye',
		slot: 'emblem',
		name: 'The Eye',
		rarity: 'issued',
		art:
			stroke('M2.5 12S6.5 6 12 6s9.5 6 9.5 6-4 6-9.5 6-9.5-6-9.5-6Z') +
			solid('M12 9.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z'),
		lock: { kind: 'price', marks: 400 }
	},
	{
		key: 'emblem.skull',
		slot: 'emblem',
		name: 'Deadhand',
		rarity: 'rare',
		art:
			solid('M12 3c4.4 0 7.5 3 7.5 7 0 2.6-1.3 4-2.5 5v3h-10v-3C5.8 14 4.5 12.6 4.5 10c0-4 3.1-7 7.5-7Z') +
			`<circle cx="9" cy="10.5" r="1.9" fill="var(--bg)"/><circle cx="15" cy="10.5" r="1.9" fill="var(--bg)"/>`,
		lock: { kind: 'price', marks: 1200 }
	},
	{
		key: 'emblem.crown',
		slot: 'emblem',
		name: 'Regent',
		rarity: 'rare',
		art: solid('M3 18V7l4.5 4L12 4l4.5 7L21 7v11H3Z'),
		lock: { kind: 'price', marks: 1200 }
	},
	{
		key: 'emblem.zero',
		slot: 'emblem',
		name: 'Patient Zero',
		rarity: 'alpha',
		art:
			stroke('M12 2.6a9.4 9.4 0 1 1 0 18.8 9.4 9.4 0 0 1 0-18.8Z', 2) +
			stroke('M12 7v5l3.2 2', 2) +
			solid('M12 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z'),
		lock: {
			kind: 'reward',
			label: 'Alpha',
			note: 'Sat at one of the first hundred tables. Never sold.'
		},
		blurb: 'The mark of somebody who was here before the game worked.'
	}
];

// ── Banners ──────────────────────────────────────────────────────────────────
// A banner is one colour and that is the whole item. It is also the loudest
// thing you can own: it is not a badge on your seat, it is the hue the enemy
// reads your half of the board in.
const banner = (
	key: string,
	name: string,
	color: string,
	rarity: Rarity,
	lock?: Lock,
	blurb?: string
): CosmeticItem => ({ key: `banner.${key}`, slot: 'banner', name, color, rarity, lock, blurb });

const BANNER_ITEMS: CosmeticItem[] = [
	banner('rose', 'Trespass Rose', '#FB7185', 'standard'),
	banner('sky', 'Watch Blue', '#38BDF8', 'standard'),
	banner('amber', 'Sodium', '#F59E0B', 'standard'),
	banner('lime', 'Signal', '#84CC16', 'standard'),
	banner('violet', 'Nightshift', '#A78BFA', 'issued', { kind: 'price', marks: 250 }),
	banner('teal', 'Coolant', '#2DD4BF', 'issued', { kind: 'price', marks: 250 }),
	banner('magenta', 'Loud', '#F472B6', 'issued', { kind: 'price', marks: 250 }),
	banner('ash', 'Ash', '#94A3B8', 'rare', { kind: 'price', marks: 900 }, 'No hue at all, which is its own statement.'),
	banner('ember', 'Ember', '#FF5A1F', 'rare', { kind: 'price', marks: 900 }),
	banner(
		'gold',
		'First Light',
		'#F5B942',
		'alpha',
		{ kind: 'reward', label: 'Alpha', note: 'Granted with the alpha charter. Never sold.' },
		'Gold reads as a claim in every other game too. That is the point.'
	)
];

// ── Headwear ─────────────────────────────────────────────────────────────────
// Drawn over the operator bust in a 100×100 box; the head sits at (50,44) with
// a radius of about 20, so everything here is cut to that skull.
const HEADWEAR_ITEMS: CosmeticItem[] = [
	{ key: 'hat.none', slot: 'headwear', name: 'Bare', rarity: 'standard', art: '' },
	{
		key: 'hat.beanie',
		slot: 'headwear',
		name: 'Beanie',
		rarity: 'standard',
		art: `<path d="M30 35a20 20 0 0 1 40 0Z" fill="currentColor"/><rect x="27" y="33" width="46" height="7" rx="3.5" fill="currentColor"/>`
	},
	{
		key: 'hat.hardhat',
		slot: 'headwear',
		name: 'Hard Hat',
		rarity: 'standard',
		art: `<path d="M31 37a19 19 0 0 1 38 0Z" fill="currentColor"/><rect x="23" y="35" width="54" height="5" rx="2.5" fill="currentColor"/><path d="M50 19v17" stroke="var(--bg)" stroke-width="2.5"/>`
	},
	{
		key: 'hat.headset',
		slot: 'headwear',
		name: 'Headset',
		rarity: 'standard',
		art: `<path d="M28 46a22 24 0 0 1 44 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="22" y="41" width="10" height="17" rx="5" fill="currentColor"/><rect x="68" y="41" width="10" height="17" rx="5" fill="currentColor"/><path d="M27 57q-6 12 8 13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`
	},
	{
		key: 'hat.beret',
		slot: 'headwear',
		name: 'Beret',
		rarity: 'issued',
		art: `<path d="M28 34c0-15 44-18 44-4 0 8-12 11-24 11S28 39 28 34Z" fill="currentColor"/><circle cx="68" cy="19" r="3.4" fill="currentColor"/>`,
		lock: { kind: 'price', marks: 300 }
	},
	{
		key: 'hat.cap',
		slot: 'headwear',
		name: 'Turned Cap',
		rarity: 'issued',
		art: `<path d="M31 34a19 19 0 0 1 38 0Z" fill="currentColor"/><path d="M31 33H15a4 4 0 0 0 0 8h22Z" fill="currentColor"/>`,
		lock: { kind: 'price', marks: 300 }
	},
	{
		key: 'hat.visor',
		slot: 'headwear',
		name: 'Optic Visor',
		rarity: 'issued',
		art: `<rect x="26" y="36" width="48" height="11" rx="5.5" fill="currentColor"/><path d="M32 41h36" stroke="var(--bg)" stroke-width="2"/>`,
		lock: { kind: 'price', marks: 300 }
	},
	{
		key: 'hat.tophat',
		slot: 'headwear',
		name: 'Top Hat',
		rarity: 'rare',
		art: `<rect x="35" y="3" width="30" height="31" rx="2" fill="currentColor"/><rect x="22" y="30" width="56" height="6" rx="3" fill="currentColor"/><rect x="35" y="23" width="30" height="6" fill="var(--bg)"/>`,
		lock: { kind: 'price', marks: 1100 }
	},
	{
		key: 'hat.horns',
		slot: 'headwear',
		name: 'Horns',
		rarity: 'rare',
		art: `<path d="M35 33c-11-4-13-18-5-24 4 8 6 17 10 23Z" fill="currentColor"/><path d="M65 33c11-4 13-18 5-24-4 8-6 17-10 23Z" fill="currentColor"/>`,
		lock: { kind: 'price', marks: 1100 }
	},
	{
		key: 'hat.crown',
		slot: 'headwear',
		name: 'Table Crown',
		rarity: 'alpha',
		art: `<path d="M30 36V18l10 8 10-12 10 12 10-8v18Z" fill="currentColor"/><circle cx="50" cy="21" r="2.6" fill="var(--bg)"/>`,
		lock: {
			kind: 'reward',
			label: 'Alpha',
			note: 'Won a table during the alpha. Never sold.'
		},
		blurb: 'Everyone at the table can see it. That is the entire feature.'
	},
	{
		key: 'hat.halo',
		slot: 'headwear',
		name: 'Clean Record',
		rarity: 'alpha',
		art: `<ellipse cx="50" cy="16" rx="17" ry="5" fill="none" stroke="currentColor" stroke-width="4"/>`,
		lock: {
			kind: 'reward',
			label: 'Alpha',
			note: 'Closed a match on zero detection. Never sold.'
		}
	}
];

// ── Card backs ───────────────────────────────────────────────────────────────
// Seen by everyone except its owner, which is the whole appeal.
const CARDBACK_ITEMS: CosmeticItem[] = [
	{
		key: 'back.issue',
		slot: 'cardback',
		name: 'Standard Issue',
		rarity: 'standard',
		art: `<rect x="8" y="8" width="84" height="84" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><rect x="20" y="20" width="60" height="60" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>`
	},
	{
		key: 'back.grid',
		slot: 'cardback',
		name: 'Subnet',
		rarity: 'standard',
		art: `<rect x="8" y="8" width="84" height="84" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M8 33h84M8 58h84M33 8v84M58 8v84" stroke="currentColor" stroke-width="1.2" opacity="0.55"/>`
	},
	{
		key: 'back.hazard',
		slot: 'cardback',
		name: 'Hazard',
		rarity: 'issued',
		art: `<rect x="8" y="8" width="84" height="84" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M8 76 76 8M20 88 88 20M8 40 40 8M60 92 92 60" stroke="currentColor" stroke-width="7" opacity="0.45"/>`,
		lock: { kind: 'price', marks: 500 }
	},
	{
		key: 'back.static',
		slot: 'cardback',
		name: 'Carrier Loss',
		rarity: 'rare',
		art: `<rect x="8" y="8" width="84" height="84" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 24h30M52 24h34M14 36h18M40 36h46M14 48h52M74 48h12M14 60h24M46 60h40M14 72h44M66 72h20" stroke="currentColor" stroke-width="4" opacity="0.5"/>`,
		lock: { kind: 'price', marks: 1000 }
	},
	{
		key: 'back.charter',
		slot: 'cardback',
		name: 'The Charter',
		rarity: 'alpha',
		art: `<rect x="8" y="8" width="84" height="84" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M50 26 62 50 50 74 38 50Z" fill="currentColor"/><path d="M22 50h10M68 50h10" stroke="currentColor" stroke-width="3"/>`,
		lock: { kind: 'reward', label: 'Alpha', note: 'Signed the alpha charter. Never sold.' }
	}
];

// ── Kill marks ───────────────────────────────────────────────────────────────
// Stamped on your rows in the log feed. The smallest item in the game and the
// one a player looks at most often, because it appears every time they win
// something.
const KILLMARK_ITEMS: CosmeticItem[] = [
	{ key: 'mark.slash', slot: 'killmark', name: 'Slash', rarity: 'standard', art: stroke('M5 19 19 5', 2.6) },
	{ key: 'mark.pin', slot: 'killmark', name: 'Pin', rarity: 'standard', art: solid('M12 3 14 12l6 3-8 1-1 5-1-5-8-1 6-3Z') },
	{
		key: 'mark.tally',
		slot: 'killmark',
		name: 'Tally',
		rarity: 'issued',
		art: stroke('M6 5v14M10 5v14M14 5v14M4 17l14-10', 2.2),
		lock: { kind: 'price', marks: 200 }
	},
	{
		key: 'mark.bolt',
		slot: 'killmark',
		name: 'Discharge',
		rarity: 'rare',
		art: solid('M13 2 5 13h5l-2 9 9-12h-5l3-8Z'),
		lock: { kind: 'price', marks: 800 }
	},
	{
		key: 'mark.seal',
		slot: 'killmark',
		name: 'First Blood',
		rarity: 'alpha',
		art: solid('M12 2.5 21 7v6.5c0 4.4-3.8 7.3-9 8.5-5.2-1.2-9-4.1-9-8.5V7Z'),
		lock: { kind: 'reward', label: 'Alpha', note: 'First recorded breach on a live table. Never sold.' }
	}
];

// ── Frames ───────────────────────────────────────────────────────────────────
// Laid OVER the real `CardFace`, in its own 136×188 box, and that is the whole
// architecture of card cosmetics: the face is the game's component, printed
// from the game's data, and a frame is a sheet of glass in front of it. Nothing
// here can move a number or hide a cost, because nothing here is inside the
// card — which is why a frame can ship without anyone re-reading the rules.
const FRAME_ITEMS: CosmeticItem[] = [
	{ key: 'frame.none', slot: 'frame', name: 'Unframed', rarity: 'standard', art: '' },
	{
		key: 'frame.hairline',
		slot: 'frame',
		name: 'Hairline',
		rarity: 'standard',
		art: `<rect x="4.5" y="4.5" width="127" height="179" rx="8" fill="none" stroke="currentColor" stroke-width="1" opacity="0.75"/>`
	},
	{
		key: 'frame.rivet',
		slot: 'frame',
		name: 'Riveted',
		rarity: 'standard',
		art: `<rect x="5" y="5" width="126" height="178" rx="8" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="124" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="176" r="2.2" fill="currentColor"/><circle cx="124" cy="176" r="2.2" fill="currentColor"/>`
	},
	{
		key: 'frame.bracket',
		slot: 'frame',
		name: 'Bracketed',
		rarity: 'issued',
		art: `<path d="M4 26V10a6 6 0 0 1 6-6h18M108 4h18a6 6 0 0 1 6 6v16M132 162v16a6 6 0 0 1-6 6h-18M28 184H10a6 6 0 0 1-6-6v-16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
		lock: { kind: 'price', marks: 450 }
	},
	{
		key: 'frame.chamfer',
		slot: 'frame',
		name: 'Chamfer',
		rarity: 'rare',
		art: `<path d="M4 22 22 4h92l18 18v144l-18 18H22L4 166Z" fill="none" stroke="currentColor" stroke-width="2" opacity="0.9"/><path d="M9 24 24 9h88l15 15v140l-15 15H24L9 164Z" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.45"/>`,
		lock: { kind: 'price', marks: 1300 },
		blurb: 'The HUD’s own 10px cut, borrowed onto a card.'
	},
	{
		key: 'frame.charter',
		slot: 'frame',
		name: 'Charter Plate',
		rarity: 'alpha',
		art: `<rect x="3.5" y="3.5" width="129" height="181" rx="9" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="8" y="8" width="120" height="172" rx="6" fill="none" stroke="currentColor" stroke-width="0.7" opacity="0.5"/><path d="M68 3 76 11 68 19 60 11Z" fill="currentColor"/><path d="M68 169 76 177 68 185 60 177Z" fill="currentColor"/>`,
		lock: { kind: 'reward', label: 'Alpha', note: 'Signed the alpha charter. Never sold.' }
	}
];

// ── Finishes ─────────────────────────────────────────────────────────────────
// Light on the surface, so: a gradient and a blend mode, not geometry.
const FINISH_ITEMS: CosmeticItem[] = [
	{ key: 'finish.matte', slot: 'finish', name: 'Matte', rarity: 'standard' },
	{
		key: 'finish.gloss',
		slot: 'finish',
		name: 'Gloss',
		rarity: 'standard',
		css: {
			background: 'linear-gradient(118deg, rgb(255 255 255 / 0.22) 0%, transparent 34%, transparent 62%, rgb(255 255 255 / 0.1) 100%)',
			blend: 'screen'
		}
	},
	{
		key: 'finish.scanline',
		slot: 'finish',
		name: 'Scanline',
		rarity: 'issued',
		css: {
			background: 'repeating-linear-gradient(0deg, rgb(0 0 0 / 0.34) 0 1px, transparent 1px 3px)',
			blend: 'multiply'
		},
		lock: { kind: 'price', marks: 350 }
	},
	{
		key: 'finish.holo',
		slot: 'finish',
		name: 'Holographic',
		rarity: 'rare',
		css: {
			background:
				'conic-gradient(from 210deg at 30% 20%, #F472B6, #FBBF24, #34D399, #38BDF8, #A78BFA, #F472B6)',
			// `overlay` rather than `color-dodge`: dodge lifts the blacks until the
			// card is a colour field with numbers somewhere in it, and a finish
			// that costs you the cost is not a cosmetic.
			blend: 'overlay',
			opacity: 0.4
		},
		lock: { kind: 'price', marks: 1500 },
		blurb: 'The one item everybody at the table notices without being told to.'
	},
	{
		key: 'finish.foil',
		slot: 'finish',
		name: 'First Foil',
		rarity: 'alpha',
		css: {
			background:
				'linear-gradient(128deg, transparent 12%, rgb(245 185 66 / 0.85) 38%, rgb(255 244 214 / 0.95) 48%, rgb(245 185 66 / 0.85) 58%, transparent 84%)',
			blend: 'screen',
			opacity: 0.55
		},
		lock: { kind: 'reward', label: 'Alpha', note: 'Pressed for the alpha charter. Never sold.' }
	}
];

export const CATALOG: CosmeticItem[] = [
	...EMBLEM_ITEMS,
	...BANNER_ITEMS,
	...HEADWEAR_ITEMS,
	...CARDBACK_ITEMS,
	...FRAME_ITEMS,
	...FINISH_ITEMS,
	...KILLMARK_ITEMS
];

export const bySlot = (slot: SlotKey) => CATALOG.filter((i) => i.slot === slot);

export const item = (key: string) => CATALOG.find((i) => i.key === key);

/** The default loadout: the first free item in each slot. What a brand new
 *  account looks like, and the thing "Reset" goes back to. */
export const DEFAULT_LOADOUT: Record<SlotKey, string> = {
	emblem: 'emblem.wedge',
	banner: 'banner.rose',
	headwear: 'hat.none',
	cardback: 'back.issue',
	frame: 'frame.none',
	finish: 'finish.matte',
	killmark: 'mark.slash'
};
