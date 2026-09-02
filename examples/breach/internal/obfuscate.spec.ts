import { describe, expect, it } from 'vitest';
import { CHURN, FIXTURE, SETTLE_BY, cipherOf, scramble, slotStart } from './obfuscate.js';

const PLAIN = FIXTURE[0];
const SEED = 7;
const CIPHER = cipherOf(PLAIN, SEED);

describe('cipherOf', () => {
	it('preserves length exactly', () => {
		// `scramble` walks both strings by index. A shorter cipher leaves the tail
		// of the source showing for ever, which reads as a broken effect rather
		// than as a partial payload.
		for (const line of FIXTURE) expect(cipherOf(line, 3)).toHaveLength(line.length);
	});

	it('is bytes, not scrunched-up source', () => {
		// The card ships CORRUPT BINARY TEST DATA. Minified source is something a
		// reviewer can squint at; hex is something they scroll past, and that is
		// the whole card.
		expect(CIPHER).toMatch(/^[0-9a-f]*$/);
	});

	it('is stable for a seed and varies between seeds', () => {
		expect(cipherOf(PLAIN, SEED)).toBe(CIPHER);
		expect(cipherOf(PLAIN, SEED + 1)).not.toBe(CIPHER);
	});
});

describe('scramble', () => {
	it('starts as the source and ends as the payload', () => {
		expect(scramble(PLAIN, CIPHER, 0, SEED)).toBe(PLAIN);
		expect(scramble(PLAIN, CIPHER, 1, SEED)).toBe(CIPHER);
		expect(scramble(PLAIN, CIPHER, 1.5, SEED)).toBe(CIPHER);
		expect(scramble(PLAIN, CIPHER, -0.2, SEED)).toBe(PLAIN);
	});

	it('holds every glyph in its slot', () => {
		// Nothing reflows, ever. A block that changes width while it churns
		// shimmers, and then the cascade is noise instead of the thing from the
		// film — which holds still and changes underneath you.
		for (let t = 0; t <= 1; t += 0.02) {
			expect(scramble(PLAIN, CIPHER, t, SEED)).toHaveLength(PLAIN.length);
		}
	});

	it('settles fully before the beat ends, not on its last frame', () => {
		// The whole block is finished by `SETTLE_BY`, leaving a held frame of the
		// payload. A cascade still boiling when the beat cuts has not been shown
		// to have landed.
		expect(scramble(PLAIN, CIPHER, SETTLE_BY, SEED)).toBe(CIPHER);
		for (let i = 0; i < PLAIN.length; i++) {
			expect(slotStart(i, SEED) + CHURN).toBeLessThanOrEqual(SETTLE_BY + 1e-9);
		}
	});

	it('follows the slot schedule exactly', () => {
		// Checked against `slotStart` rather than against what the glyph looks
		// like. The source contains a, c, d, e, f and digits, so a churning slot
		// can land on exactly the byte it will settle to or on exactly the
		// character it started as — a value-based test reads both as transitions
		// that never happened, and the first version of this test failed on
		// precisely that.
		for (let i = 0; i < PLAIN.length; i++) {
			const start = slotStart(i, SEED);
			expect(scramble(PLAIN, CIPHER, Math.max(0.001, start - 0.01), SEED)[i]).toBe(PLAIN[i]);
			expect(scramble(PLAIN, CIPHER, start + CHURN + 0.001, SEED)[i]).toBe(CIPHER[i]);
		}
	});

	it('never lets a settled slot go back to being readable', () => {
		// The failure this guards is a cascade that flickers back to source, which
		// the eye reads as a loading state — the one thing this beat must not look
		// like is something still deciding.
		for (let i = 0; i < PLAIN.length; i++) {
			const settled = slotStart(i, SEED) + CHURN;
			for (let t = settled; t <= 1; t += 0.01) {
				expect(scramble(PLAIN, CIPHER, t, SEED)[i]).toBe(CIPHER[i]);
			}
		}
	});

	it('converts in scattered order, not as a wipe', () => {
		// Left-to-right reads as TYPING — a person entering text — and the fiction
		// is the opposite: something got to all of it at once.
		const mid = scramble(PLAIN, CIPHER, 0.5, SEED);
		const changed: number[] = [];
		for (let i = 0; i < PLAIN.length; i++) if (mid[i] !== PLAIN[i]) changed.push(i);
		expect(changed.length).toBeGreaterThan(3);
		expect(changed.length).toBeLessThan(PLAIN.length);
		// A wipe would have every changed index below every unchanged one.
		const lastChanged = changed[changed.length - 1];
		const firstUnchanged = [...Array(PLAIN.length).keys()].find((i) => mid[i] === PLAIN[i]);
		expect(lastChanged).toBeGreaterThan(firstUnchanged!);
	});

	it('is the same cascade every take', () => {
		// It plays inside a looping preview. A field that scrambles differently
		// each time is a field nobody can judge a change to.
		const a = scramble(PLAIN, CIPHER, 0.42, SEED);
		const b = scramble(PLAIN, CIPHER, 0.42, SEED);
		expect(a).toBe(b);
	});
});
