// ── The badge ────────────────────────────────────────────────────────────────
// What a player's ROLE looks like, now that it is no longer what they look
// like.
//
// A `Klass` used to carry `shape` and `color`, so taking the Handler took a
// ghost body and an orange plate: the role WAS the character. That is fine
// while the roster is the cast and wrong the moment a player has a figure of
// their own, because it means the game hands you a face and calls it yours.
//
// So the role collapses to one worn item. **The glyph says which role. The tint
// says which side.** Nothing else on a figure is permitted to be red or blue,
// which is what makes those two hues mean something at a glance across a board
// where every other colour belongs to the person who chose it.
//
// None of the geometry is new: `wearables.ts` already generates a chest-anchored
// badge per entry in `GLYPHS`, extruded thin and measured off the chest of
// whoever is wearing it. This file only says which four, and in what colour.
import type { Faction } from './rules.js';

/**
 * The two hues, and the only two on a figure that are not the player's.
 *
 * They live here rather than beside the side copy in `lobby/sides.ts` because
 * they stopped being editorial: a seat plate, a log row and a table strip all
 * tint a badge now, and a colour three surfaces read is a fact about the game
 * rather than a line of prose about it.
 */
export const SIDE_TONE: Record<Faction, string> = {
	red: '#FB7185',
	blue: '#38BDF8'
};

/**
 * Which mark stands for which role.
 *
 * Authored by hand, and it has to be: `Klass.icon` cannot drive this because
 * `state` and `hunter` are both `radar`, so deriving it would give two roles
 * one badge — the single failure this whole scheme cannot survive.
 *
 * Each mark is the role's actual job rather than a decoration: the Maintainer
 * ends up holding the keys, the Handler's whole hand is a zero-day, the
 * Architect cuts lanes, and the Threat Hunter is looking.
 */
export const ROLE_GLYPH: Record<string, string> = {
	maintainer: 'keyhole',
	state: 'zero',
	architect: 'bars',
	hunter: 'eye'
};

/** Fallback for a klass key with no mark authored — a role nobody can read is
 *  worse than a generic one, so this is a shape rather than nothing. */
const UNKNOWN = 'ring';

/** The wearable key for a role, as `art({ worn })` wants it. */
export function badgeKey(klassKey: string): string {
	return `emblem.${ROLE_GLYPH[klassKey] ?? UNKNOWN}`;
}

/**
 * The badge, ready to hand to `art()`.
 *
 * Returned as a tint entry rather than applied by the renderer because `tints`
 * is how every other per-thing colour on the model is expressed — one mechanism,
 * so the badge cannot drift from the rest of the figure's colour handling.
 *
 * The caller must spread this AFTER the player's own tints. That ordering is
 * the enforcement: a player may key `tints` by any worn item and would otherwise
 * be able to paint their own badge, and a badge a player can recolour is a badge
 * that can lie about which side its wearer is on.
 */
export function badgeFor(
	klassKey: string,
	side: Faction
): { worn: string; tints: Record<string, string> } {
	const worn = badgeKey(klassKey);
	return { worn, tints: { [worn]: SIDE_TONE[side] } };
}

/**
 * Everything a figure is wearing, with the role badge welded on.
 *
 * The one call site every surface drawing a player should use. Taking the
 * player's list and returning a new one — rather than asking each caller to
 * append — is what stops a screen from forgetting: five components draw a
 * `Figure`, and the badge missing from one of them is a player whose role is
 * invisible on exactly the surface somebody was reading.
 */
export function dressed(
	worn: readonly string[],
	klassKey: string | null | undefined,
	side: Faction | null | undefined,
	tints: Record<string, string> = {}
): { worn: string[]; tints: Record<string, string> } {
	if (!klassKey || !side) return { worn: [...worn], tints };
	const badge = badgeFor(klassKey, side);
	// The badge is appended last and its tint spread last, so neither a worn
	// item nor a player tint of the same key can displace it.
	return {
		worn: [...worn.filter((w) => w !== badge.worn), badge.worn],
		tints: { ...tints, ...badge.tints }
	};
}
