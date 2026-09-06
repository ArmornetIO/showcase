// ── How big a character draws ────────────────────────────────────────────────
// One number per character, and it is a property OF the character rather than
// of whatever is drawing it. A crest, a chip and a log row are three different
// containers; how big the Maintainer is does not change between them, and every
// surface that has answered this locally has answered it differently.
//
// The problem it solves: `Figure` frames a bust on the DRESSED head — the
// character plus whatever is on it — and scales that frame to fill its box. So
// headwear sizes the person wearing it. A top hat's brim is 1.62 head-widths of
// flat plate, so the Architect gets a frame half again as wide as the
// Maintainer's beanie and is drawn that much smaller beside them, in a row of
// four portraits whose whole job is to be compared.
//
// The fix is to divide the hat back out, and the measurement for that is free:
// ask `art` for the same character with NOTHING on. The ratio between the two
// frames IS the hat, so multiplying by it cancels it exactly — no table, no
// per-character tuning, and a bare figure comes out at 1 because it has nothing
// to cancel. Change a hat, change a build, add a ninth klass: the number
// follows, because it is measured rather than typed.
//
// What is left is every skull drawn at the same size, which is the roster
// convention — four portraits at one weight, differing by face and not by how
// much of the frame they happen to fill.
import { art, type CharacterSkin } from 'showcase';

/**
 * How much of its container a normalised portrait fills.
 *
 * The only knob, and it is a taste one: it moves every portrait together and
 * cannot move one relative to another. It is set so the top-hatted Architect
 * lands where it already sat, because that portrait was the one that looked
 * right — and it looked right precisely because its brim was doing this job by
 * accident.
 */
const FILL = 0.664;

/**
 * What to multiply a figure by so it draws at the same weight as its
 * neighbours.
 *
 * `worn` must be the SAME list handed to `<Figure art={{ worn }}>`. A scale
 * measured against a bare head and applied to a hatted one is the original bug
 * with an extra step.
 */
export function portraitScale(klass: CharacterSkin, worn?: string[]): number {
	const dressed = worn?.length ? art(klass, { worn }).bust.w : 0;
	const bare = art(klass).bust.w;
	return (dressed ? dressed / bare : 1) * FILL;
}
