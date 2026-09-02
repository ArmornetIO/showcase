// ── Seating ──────────────────────────────────────────────────────────────────
// Where a seat SITS, as opposed to where it is currently reaching.
//
// Two facts, both deliberately static and both derived from public information
// only. Nothing here consults the match: a seat's chair does not move because
// of something it did, and if it did, the chair would itself be a tell.

import type { SeatPresence } from '../internal/presence.js';
import type { Faction, TerritoryKey } from '../internal/rules.js';

/**
 * The ground a seat stands on.
 *
 * Public by construction — every one of these is readable off the character
 * sheet in the lobby before a card is played. Red's two are on red's own
 * ground; blue's two are on the parts of the estate their passives name (the
 * Architect holds the Forge and the Silos, the Hunter sweeps the runtime).
 *
 * This must stay a table of PUBLIC facts. The moment it is derived from
 * anything live it stops being a seating chart and becomes an intelligence
 * feed.
 */
export const HOME_OF: Record<string, TerritoryKey> = {
	maintainer: 'staging',
	state: 'staging',
	architect: 'foundry',
	hunter: 'marches'
};

export const homeOf = (key: string): TerritoryKey => HOME_OF[key] ?? 'outlands';

/**
 * Where a seat stands on the globe's limb, in radians (screen convention: 0 is
 * right, angles increase clockwise because y points down).
 *
 * Red takes the left limb, blue the right, so the two sides face each other
 * across the world with the player's own dais below. Within a side the two
 * seats sit above and below the horizontal.
 *
 * The positions are fixed in SCREEN space and never rotate with the globe.
 * That is the whole decision: the other players are not ON the world, they are
 * sitting around it looking at it, the same as you. A marker that spun away
 * with the terrain would say the opposite.
 */
export function limbAngle(seat: SeatPresence, seats: SeatPresence[]): number {
	const side: Faction = seat.faction;
	const kin = seats.filter((s) => s.faction === side);
	const i = kin.findIndex((s) => s.key === seat.key);
	const base = side === 'red' ? Math.PI : 0;
	// Spread the side's seats around its horizontal, centred. Two per side today;
	// the formula holds for more without a second table to keep in sync.
	const span = 0.62;
	const t = kin.length > 1 ? i / (kin.length - 1) - 0.5 : 0;
	return base + t * span * (side === 'red' ? -1 : 1);
}

/** Point on a circle, in the stage's coordinates. */
export const onCircle = (cx: number, cy: number, r: number, angle: number) => ({
	x: cx + Math.cos(angle) * r,
	y: cy + Math.sin(angle) * r
});
