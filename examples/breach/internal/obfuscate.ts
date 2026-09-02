// ── Turning readable source into something nobody will read ──────────────────
// Third pure module of the set, after `gait.ts` and `optics.ts`, and the one
// that carries the most of its shot: the Obfuscated Test Fixture's whole beat is
// a block of legible code becoming a block of illegible bytes while you watch.
//
// The card's own text is the spec, and it is unusually specific for a game card:
//
//   "The payload ships as corrupt binary test data. Review reads diffs, and this
//    has no diff worth reading."
//
// Two things follow from that sentence and both are load-bearing.
//
// It resolves to BYTES, not to minified source. A shot that ended on scrunched-up
// JavaScript would be showing you obfuscation, which is a thing a reviewer can
// squint at and eventually read. Hex is a thing a reviewer scrolls past, and that
// difference is the entire card.
//
// And the LENGTH is preserved, character for character, so every glyph on screen
// occupies its position from the first frame to the last. Nothing reflows, so the
// block does not shimmer while it churns — what changes is only what each slot
// SAYS. A cascade that also moves is noise; a cascade that holds still and
// changes underneath you is the thing from the film.

/** What a slot can settle into. Hex, because the payload is binary. */
const HEX = '0123456789abcdef';

/**
 * A stable pseudo-random in [0, 1) from two integers.
 *
 * Deterministic on purpose and not merely for tests: this cascade is played
 * inside a looping preview, and a field that scrambles differently every take is
 * a field you cannot judge a change to. It is also the same reason the dive's
 * streaks are a fixed ring — random per frame is static, not motion.
 */
function noise(a: number, b: number): number {
	let h = (a * 2654435761 + b * 40503 + 0x9e3779b9) >>> 0;
	h ^= h >>> 15;
	h = Math.imul(h, 2246822519) >>> 0;
	h ^= h >>> 13;
	// The final `>>> 0` is not belt and braces. `^` evaluates to a SIGNED 32-bit
	// int, so the line above can hand back a negative number; dividing that gives
	// a negative fraction, and `HEX[Math.floor(negative * 16)]` is `undefined`.
	// The payload rendered as the literal text "undefinedundefined724…".
	return (h >>> 0) / 4294967296;
}

/**
 * The finished payload for a line of source: same length, all bytes.
 *
 * Same length is not cosmetic. `scramble` walks the two strings by index, so a
 * cipher that came out shorter would leave the tail of the plain text showing
 * for ever — the block would half-convert and stop, which reads as the effect
 * being broken rather than as the payload being partial.
 */
export function cipherOf(plain: string, seed: number): string {
	let out = '';
	for (let i = 0; i < plain.length; i++) {
		out += HEX[Math.floor(noise(i, seed) * 16)];
	}
	return out;
}

/** How long one slot spends churning before it settles, as a fraction of the
 *  whole beat. Long enough to see it working, short enough that the block is
 *  not still boiling when the beat ends. */
export const CHURN = 0.14;

/** The fraction of the beat by which every slot has finished. The remainder is
 *  a held frame of the finished payload — a block that is still boiling when the
 *  beat cuts has not been shown to have landed. */
export const SETTLE_BY = 0.9;

/**
 * When slot `i` leaves the source text, as a fraction of the beat.
 *
 * Exported because the alternative is a test that infers "has this settled yet"
 * from the glyph on screen, and that inference is quietly wrong: the source
 * contains `a`, `c`, `d`, `e`, `f` and digits, so a slot mid-churn can land on
 * exactly the byte it will eventually settle to, or on exactly the character it
 * started as. A value-based check reads both as state changes that did not
 * happen. The schedule is the fact; the glyphs are a rendering of it.
 *
 * Scaled so the LAST slot settles at `SETTLE_BY`, not at 1. The first version
 * scaled by `1 - CHURN`, which puts the latest possible settle at exactly 1.0 —
 * so the block's final byte landed on the beat's final frame, which is precisely
 * the thing the scaling was there to avoid. Stating the deadline as a constant
 * makes that arithmetic checkable instead of implied.
 */
export const slotStart = (i: number, seed: number): number =>
	noise(i, seed) * (SETTLE_BY - CHURN);

/**
 * The line part-way through, at progress `t`.
 *
 * Each slot has its own scattered threshold, so the conversion sweeps across the
 * block in no particular direction. That scatter is the difference between this
 * and a wipe: left-to-right reads as TYPING — a person entering text — and the
 * fiction here is the opposite, a thing being transformed in place by something
 * that got to all of it at once.
 *
 * Once a slot has left the plain text it never returns to it. A cascade that
 * flickers back to readable is a cascade the eye reads as a loading state, and
 * the one thing this beat must not look like is something still deciding.
 */
export function scramble(plain: string, cipher: string, t: number, seed: number): string {
	if (t <= 0) return plain;
	if (t >= 1) return cipher;
	let out = '';
	for (let i = 0; i < plain.length; i++) {
		const start = slotStart(i, seed);
		if (t < start) {
			out += plain[i];
			continue;
		}
		const since = (t - start) / CHURN;
		// Epsilon because the schedule is a public promise: a caller that computes
		// `slotStart(i) + CHURN` and asks what that frame looks like must be told
		// the payload. Without it, `(start + CHURN) - start` comes back a hair
		// under `CHURN` in floating point and the boundary frame churns instead.
		if (since >= 1 - 1e-9) {
			out += cipher[i];
			continue;
		}
		// Mid-churn. Quantised so a slot shows a handful of legible intermediate
		// bytes rather than a smear — six steps is enough to read as working.
		out += HEX[Math.floor(noise(i * 31 + Math.floor(since * 6), seed) * 16)];
	}
	return out;
}

/**
 * The source that gets obfuscated.
 *
 * A test fixture rather than anything dramatic, because that is the card: the
 * payload is corrupt binary TEST DATA, and the reason it survives review is that
 * nobody reads a fixture. The lines are the right length to fill a block and
 * plausible enough that a player recognises the shape of them at a glance —
 * which is all they have time to do.
 */
export const FIXTURE = [
	'export const golden = loadFixture(',
	'  "testdata/accounts.golden.bin",',
	'  { strict: true, checksum: false }',
	');'
];
