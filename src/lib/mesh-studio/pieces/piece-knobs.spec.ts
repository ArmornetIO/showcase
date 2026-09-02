import { describe, expect, it } from 'vitest';
import type { Knob } from '../../backdrop/backdrop-tokens.js';
import {
	INK_TOKEN,
	LAND_TOKEN,
	PIECE_VIEW,
	pieceKnobs,
	readPieceKnobs,
	setPieceAngle
} from './piece-knobs.js';

const DEG = 180 / Math.PI;

/** The knob a test is talking about. Every case here is about one entry, and
 *  finding it by prop is what keeps the assertions from depending on the order
 *  the panel happens to declare them in. */
const param = (knobs: Knob[], prop: string) =>
	knobs.find((k) => k.kind === 'param' && k.prop === prop) as Extract<Knob, { kind: 'param' }>;

describe('pieceKnobs', () => {
	it('seats the ink on the subject and opens at the crest’s own framing', () => {
		// The studio has to open showing what was clicked, at the size it was
		// clicked at — a different view of the right building is still the wrong
		// answer, because the thing under review is how it reads on a card.
		const knobs = pieceKnobs('#FB923C');
		const ink = knobs.find((k) => k.kind === 'color' && k.token === INK_TOKEN);
		expect(ink?.value).toBe('#FB923C');
		const read = readPieceKnobs(knobs);
		expect(read.step).toBe(PIECE_VIEW.step);
		expect(read.viewDistance).toBe(PIECE_VIEW.viewDistance);
		expect(read.lean).toBeCloseTo(PIECE_VIEW.lean, 2);
		expect(read.bearing).toBe(0);
	});

	it('declares nothing that reads back as undefined', () => {
		// The rule the backdrop knob list is written under, checked rather than
		// asserted in a comment: a knob nothing consumes is a control that lies
		// about having an effect.
		const read = readPieceKnobs(pieceKnobs('#5eead4'));
		for (const v of Object.values(read)) expect(v).not.toBeUndefined();
		expect(read.land).toMatch(/^#/);
	});
});

describe('readPieceKnobs', () => {
	it('answers in the units the renderer speaks, not the panel’s', () => {
		// Degrees in the panel because nobody turns a model in radians; radians out
		// because `tangentFrame` takes them. A mix-up here is a building that turns
		// 57× too far and reads as a broken shape rather than a unit bug.
		const knobs = pieceKnobs('#5eead4').map((k) =>
			k.kind === 'param' && k.prop === 'bearing' ? { ...k, value: 90 } : k
		);
		expect(readPieceKnobs(knobs).bearing).toBeCloseTo(Math.PI / 2, 9);
		// Spin stays in degrees a second: the clock advancing it counts seconds.
		const spun = pieceKnobs('#5eead4').map((k) =>
			k.kind === 'param' && k.prop === 'spin' ? { ...k, value: 45 } : k
		);
		expect(readPieceKnobs(spun).spin).toBe(45);
	});

	it('drops the alpha a swatch hands back', () => {
		// A lit facet is opaque. Alpha arriving from the panel's `rgba()` would put
		// the stage through the middle of a solid.
		const knobs = pieceKnobs('#5eead4').map((k) =>
			k.kind === 'color' && k.token === LAND_TOKEN
				? { ...k, value: 'rgba(15, 23, 42, 0.4)' }
				: k
		);
		expect(readPieceKnobs(knobs).land).toBe('#0f172a');
	});
});

describe('setPieceAngle', () => {
	it('wraps the bearing both ways round, so a drag never pins the slider', () => {
		// The doubled modulo. JS `%` keeps the sign of its left operand, so a
		// single one sends a westward drag past -180° to -200° — outside the
		// slider's range, where the thumb pins while the model keeps turning and
		// the panel quietly stops describing the stage.
		const knobs = pieceKnobs('#5eead4');
		const bearingOf = (deg: number) =>
			param(setPieceAngle(knobs, 'bearing', deg / DEG), 'bearing').value;
		expect(bearingOf(200)).toBe(-160);
		expect(bearingOf(-200)).toBe(160);
		expect(bearingOf(540)).toBe(-180);
		for (const deg of [-720, -181, -180, 0, 179, 180, 361, 900]) {
			const v = Number(bearingOf(deg));
			expect(v).toBeGreaterThanOrEqual(-180);
			expect(v).toBeLessThan(180);
		}
	});

	it('clamps the lean instead of wrapping it', () => {
		// The asymmetry is the point: a turntable that stops dead at due west is
		// not a turntable, and a camera that rolls under the floor is a bug.
		const knobs = pieceKnobs('#5eead4');
		const lean = param(knobs, 'lean');
		expect(param(setPieceAngle(knobs, 'lean', 200 / DEG), 'lean').value).toBe(lean.max);
		expect(param(setPieceAngle(knobs, 'lean', -200 / DEG), 'lean').value).toBe(lean.min);
	});

	it('moves only the angle it was asked for', () => {
		// The drag and the sliders write the same list. Anything else shifting
		// underneath is one of them silently winning.
		const knobs = pieceKnobs('#5eead4');
		const next = setPieceAngle(knobs, 'bearing', 1);
		expect(param(next, 'lean').value).toBe(param(knobs, 'lean').value);
		expect(param(next, 'size').value).toBe(param(knobs, 'size').value);
		expect(next.find((k) => k.kind === 'color' && k.token === INK_TOKEN)?.value).toBe('#5eead4');
	});
});
