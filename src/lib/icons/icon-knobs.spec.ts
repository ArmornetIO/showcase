import { describe, it, expect } from 'vitest';
import { knobKey, type Knob } from '../backdrop/backdrop-tokens.js';
import { filename, INK_TOKEN, MARKS, readKnobs, snippet } from './icon-knobs.js';

// What is locked down here is the studio's PAPER TRAIL: the snippet under the
// stage and the export filename are the only two things that leave the studio,
// and both are derived from the same knob list the panel draws. A snippet that
// names a prop the component does not take is worse than no snippet — it is a
// line someone pastes into a page that then fails to build.

const move = (knobs: Knob[], key: string, value: string | number | boolean): Knob[] =>
	knobs.map((k) => (knobKey(k) === key ? ({ ...k, value } as Knob) : k));

const mark = (id: string) => MARKS.find((m) => m.id === id)!;

describe('mark declarations', () => {
	it('gives every knob its own key', () => {
		for (const m of MARKS) {
			const keys = m.knobs().map(knobKey);
			expect(new Set(keys).size, m.name).toBe(keys.length);
		}
	});

	it('hands out a fresh list each call', () => {
		// The studio resets by re-calling `knobs()`. A shared array would make
		// Reset a no-op and leak one mark's tuning into the next.
		const a = mark('hub').knobs();
		expect(move(a, 'q:size', 200)).not.toEqual(a);
		expect(mark('hub').knobs()).toEqual(a);
	});
});

describe('readKnobs', () => {
	it('reads the panel over the component defaults', () => {
		const m = mark('hub');
		const s = readKnobs(move(m.knobs(), 'c:look', 'plated'));
		expect(s.look).toBe('plated');
		expect(s.spokes).toBe('full');
	});
});

describe('snippet', () => {


	it('leaves the ink out — Icon has no colour prop', () => {
		const m = mark('icon');
		const base = m.knobs();
		expect(snippet(m, move(base, `t:${INK_TOKEN}`, '#fbbf24'), base)).toBe('<Icon />');
	});
});

describe('filename', () => {
	it('always names the size, and names a switch only when it moved', () => {
		const m = mark('chrome');
		const base = m.knobs();
		expect(filename(m, base, base, 'png')).toBe('armornet-crest-chrome-240.png');
		expect(filename(m, move(base, 'b:glow', false), base, 'svg')).toBe(
			'armornet-crest-chrome-240-no-glow.svg'
		);
	});
});
