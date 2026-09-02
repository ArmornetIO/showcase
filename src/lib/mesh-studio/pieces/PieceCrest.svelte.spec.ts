import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PieceCrest from './PieceCrest.svelte';
import { ALL_PIECES } from './piece-catalogue.js';

/** The edges are the one near-opaque thing NodePiece draws, so they are what a
 *  test can compare two crests by. Solid-only: the ground ellipses and the seat
 *  wash are the same for every piece. */
const edges = (c: Element) =>
	[...c.querySelectorAll('path[stroke-linejoin="round"]')]
		.map((p) => p.getAttribute('d'))
		.join('|');

describe('PieceCrest', () => {
	it('draws at the requested size and is decorative', async () => {
		const { container } = render(PieceCrest, { piece: 'house', color: '#0ff', size: 64 });
		const svg = container.querySelector('svg')!;
		expect(svg.getAttribute('width')).toBe('64');
		expect(svg.getAttribute('height')).toBe('64');
		// A crest is always beside the name of the thing it depicts, so announcing
		// it repeats the label to a screen reader.
		expect(svg.getAttribute('aria-hidden')).toBe('true');
	});

	// Every building in the catalogue has to actually come out of the crest —
	// this is the census the showcase page renders, and a piece whose geometry
	// culls to nothing there is invisible rather than obviously broken.
	it('draws every piece in the catalogue', async () => {
		for (const key of Object.keys(ALL_PIECES)) {
			const { container } = render(PieceCrest, { piece: key, color: '#0ff' });
			expect(edges(container), `${key} drew no edges`).not.toBe('');
		}
	});

	// The point of the component: the icon IS the catalogue solid, not a glyph
	// picked to stand for it. Three buildings of visibly different shape, so a
	// regression that collapsed the crest to one fixed drawing would still look
	// fine on the page and fail here.
	it('draws each solid as itself, not one shared shape', async () => {
		const drawn = ['house', 'factory', 'beacon'].map(
			(piece) => edges(render(PieceCrest, { piece, color: '#0ff' }).container)
		);
		expect(new Set(drawn).size).toBe(drawn.length);
	});

	// A key off the wire, or a mode whose building has not been drawn yet, must
	// leave a hole rather than a broken svg — `pieceForMode` is explicitly allowed
	// to miss.
	it('renders nothing for a key the catalogue does not have', async () => {
		const { container } = render(PieceCrest, { piece: 'no-such-building', color: '#0ff' });
		expect(container.querySelector('svg')).toBeNull();
	});

	it('dashes its edges only when offline', async () => {
		const on = render(PieceCrest, { piece: 'house', color: '#0ff', offline: true });
		const off = render(PieceCrest, { piece: 'house', color: '#0ff' });
		expect(on.container.querySelector('[stroke-dasharray="2.5 3"]')).not.toBeNull();
		expect(off.container.querySelector('[stroke-dasharray="2.5 3"]')).toBeNull();
	});
});
