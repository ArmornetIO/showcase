import { describe, expect, it } from 'vitest';
import { POV_CARDS, povTableProblems } from './cinema.js';
import { SIGNATURES } from './rules.js';

const keys = SIGNATURES.map((s) => s.power.key);

describe('the cutaway table', () => {
	it('gives a shot to every signature power and to nothing else', () => {
		// The rule, asserted rather than asked for in a comment. A cutaway is the
		// most expensive punctuation the board has; the previous table's only
		// defence against a third, fourth and fifth one was a paragraph.
		expect(povTableProblems(keys)).toEqual([]);
	});

	it('covers all four classes', () => {
		expect(keys).toHaveLength(4);
		expect(Object.keys(POV_CARDS).sort()).toEqual([...keys].sort());
	});

	it('keeps the rarity structural — every signature is burned once', () => {
		// This is WHY the table is keyed on signatures. If a power ever stops
		// being single-use, the ceiling of four cutaways a match goes with it and
		// the rule needs rethinking rather than quietly loosening.
		for (const s of SIGNATURES) expect(s.power.uses).toBe(1);
	});

	it('flags a borrowed staging rather than passing it off as a decision', () => {
		// Not an assertion about WHICH cards are drafts — that changes as they get
		// staged. It is an assertion that a draft is distinguishable at all.
		const drafted = Object.values(POV_CARDS).filter((c) => c?.draft);
		const staged = Object.values(POV_CARDS).filter((c) => !c?.draft);
		expect(staged.length).toBeGreaterThan(0);
		for (const c of drafted) expect(c?.shot).toBeTruthy();
	});

	it('gives no two signatures the same staging', () => {
		// The editorial result of doing all four, and worth guarding: a cutaway
		// earns its cost by being unlike the last one you saw. Two classes sharing
		// a staging would make the second one a re-run at the price of a first
		// showing — which is exactly the failure the short table was protecting
		// against, arriving by a different route.
		const shots = Object.values(POV_CARDS).map((c) => c!.shot);
		expect(new Set(shots).size).toBe(shots.length);
	});
});
