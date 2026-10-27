// ── What a player LOOKS LIKE ─────────────────────────────────────────────────
// The one shape every surface that draws a person reads, and the one the
// outfitter writes. It is small, and it is keys: the wardrobe names a
// `wearable` and the geometry lives in the library, so nothing here is art and
// a saved character is a few hundred bytes.
//
// WHY IT IS ITS OWN TYPE and not just "the outfitter's state". Four seats are
// drawn on the versus screen and only one of them is being edited. The other
// three arrive off the wire from people whose outfitter this client will never
// run. A render path that could only draw the local editor's state would be a
// render path that cannot draw anybody else, which is most of the screen.
//
// WHAT IS NOT IN HERE: the badge. A role is not part of what a player chose —
// it is pinned on at `resolve()` from the seat they hold, which is the only way
// a client that can describe itself is stopped from describing itself as blue.
import { DEFAULT_ART, type ArtOpts, type CharacterSkin } from 'showcase';
import { dressed } from './badge.js';
import type { Faction } from './rules.js';
import { CATEGORIES, DEFAULT_LOADOUT, inCategory, item, shapeFrom, wornFrom } from './wardrobe.js';

export interface Appearance {
	/** Wardrobe item keys, by slot — including `build`, which names the body. */
	loadout: Record<string, string>;
	/** The four material broadcasts. `null` means "whatever the figure already
	 *  is", which is not the same as a colour: a default hex here would repaint
	 *  every character the moment this type was introduced. */
	suit: string;
	plate: string | null;
	lamp: string | null;
	/** Per-thing overrides, keyed by body tag or worn item key. Sparse, so an
	 *  absent key means "the material decides" and clearing is a delete. */
	tints: Record<string, string>;
	/** The one cosmetic a player types instead of picking. */
	callsign: string;
}

export const DEFAULT_APPEARANCE: Appearance = {
	loadout: { ...DEFAULT_LOADOUT },
	suit: DEFAULT_ART.suit,
	plate: null,
	lamp: null,
	tints: {},
	callsign: ''
};

/** A fallback hue for a figure whose player has chosen no plate. Slate rather
 *  than a side colour: red and blue are the badge's, and a body that borrowed
 *  one would be a body that looks like a badge. */
const UNPAINTED = '#94A3B8';

/**
 * A figure, ready to draw: the skin `Figure` wants and the art options that
 * dress it.
 *
 * `klassKey` and `side` come from the SEAT, never from the appearance — that
 * separation is the whole design. Pass them and the role badge is welded on;
 * pass neither (a player standing in the lobby holding no chair) and the figure
 * draws bare, which is the honest picture of somebody who has not taken a role.
 */
export function resolve(
	look: Appearance,
	who: { key: string; name: string },
	klassKey?: string | null,
	side?: Faction | null
): { skin: CharacterSkin; art: ArtOpts } {
	const { worn, tints } = dressed(wornFrom(look.loadout), klassKey, side, look.tints);
	return {
		skin: {
			key: who.key,
			name: look.callsign || who.name,
			color: look.plate ?? UNPAINTED,
			shape: shapeFrom(look.loadout)
		},
		art: {
			worn,
			tints,
			suit: look.suit,
			// `undefined` is not a colour — it tells `art()` to keep following the
			// plate, which is how a visor stays tied to the body it is set into.
			lamp: look.lamp ?? undefined,
			trim: trimOf(look)
		}
	};
}

/**
 * An outfit dealt to somebody who has never chosen one.
 *
 * A lobby of four identical default figures reads as four copies of nobody, so
 * anyone with no stored character is dressed from the catalogue instead. Two
 * rules make that safe:
 *
 *   DETERMINISTIC. The same seed always deals the same outfit, and the seed is
 *   something every client already agrees on — a player's id, a bot's name. So
 *   three screens drawing a fourth player who has never dressed all draw the
 *   same person without a word crossing the wire.
 *
 *   FREE ITEMS ONLY. Only what ships with the game (no `lock`) can be dealt. A
 *   random look that put a paid hat on someone would be a hat the server strips
 *   off them the moment they touch the outfitter.
 *
 * Plate stays unpainted: the variety is in the body, the headwear and the trim,
 * and a random plate colour lands on red or blue often enough to read as a side.
 */
export function randomLook(seed: string): Appearance {
	const rand = rng(seed);
	const loadout: Record<string, string> = { ...DEFAULT_LOADOUT };
	for (const { key } of CATEGORIES) {
		const free = inCategory(key).filter((i) => !i.lock);
		if (free.length) loadout[key] = free[Math.floor(rand() * free.length)].key;
	}
	return { ...DEFAULT_APPEARANCE, loadout };
}

/** FNV-1a into mulberry32 — a seeded stream, which `Math.random` is not. */
function rng(seed: string): () => number {
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
	return () => {
		h = (h + 0x6d2b79f5) | 0;
		let t = Math.imul(h ^ (h >>> 15), 1 | h);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** The hue everything worn is painted in. */
export function trimOf(look: Appearance): string {
	return item(look.loadout.trim)?.color ?? '#FB7185';
}

/** Whether two appearances differ, for deciding if a change is worth putting on
 *  the wire. Cheap and exact: the shape is JSON by construction. */
export function same(a: Appearance, b: Appearance): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}
