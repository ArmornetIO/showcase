import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ArmornetCrestMesh, {
	CREST_MESH_SHAPES,
	CREST_MESH_GEOMETRY,
	CRESTLINK_NODES,
	fitTransform,
	outlinePath,
	outlinePoly,
	insetPolygon
} from './ArmornetCrestMesh.svelte';

describe('ArmornetCrestMesh', () => {
	it('renders a labelled svg at the requested size', async () => {
		render(ArmornetCrestMesh, { size: 96 });
		const svg = page.locator('svg[role="img"]');
		await expect.element(svg).toBeInTheDocument();
		await expect.element(svg).toHaveAttribute('width', '96');
		await expect.element(svg).toHaveAccessibleName('Armornet');
	});

	// The ring is the only thing telling a satellite from the hub.
	it('rings the three satellites against one solid hub', async () => {
		const { container } = render(ArmornetCrestMesh, {});
		const circles = [...container.querySelectorAll('circle')];
		expect(circles).toHaveLength(CRESTLINK_NODES.length + 1);
		const solid = circles.filter((c) => c.getAttribute('fill') !== 'none' && c.getAttribute('fill'));
		expect(solid).toHaveLength(1);
	});

	// Filled has to be a KNOCKOUT, not the figure repainted in a background
	// colour — otherwise the inverse only works on the one background it assumed.
	it('inverts by masking the figure out of a solid shield', async () => {
		const { container } = render(ArmornetCrestMesh, { variant: 'filled' });
		const mask = container.querySelector('mask');
		expect(mask).toBeTruthy();
		const body = [...container.querySelectorAll('path')].find((p) => p.hasAttribute('mask'));
		expect(body).toBeTruthy();
		expect(body!.getAttribute('fill')).not.toBe('none');
		// Nothing in the mark paints the figure; it only exists as a hole.
		expect(container.querySelector(`g[id] circle`)).toBeNull();
	});

	// The figure is the product's own control-plane glyph. A shield too tight for
	// it scales the WHOLE thing; nothing inside is ever re-placed to fit.
	it('keeps the satellites identical across every shield', async () => {
		const coords = (shape: (typeof CREST_MESH_SHAPES)[number]) => {
			const { container } = render(ArmornetCrestMesh, { shape });
			return [...container.querySelectorAll('circle')].map(
				(c) => `${c.getAttribute('cx')},${c.getAttribute('cy')},${c.getAttribute('r')}`
			);
		};
		const baseline = coords('crest');
		for (const shape of CREST_MESH_SHAPES) expect(coords(shape)).toEqual(baseline);
	});

	it('places the figure by uniform scale and a vertical shift only', () => {
		for (const shape of CREST_MESH_SHAPES) {
			// One `scale(k)` — never `scale(kx ky)`, which would distort the glyph.
			expect(fitTransform(CREST_MESH_GEOMETRY[shape])).toMatch(
				/^translate\(-?[\d.]+ -?[\d.]+\) scale\([\d.]+\)$/
			);
		}
	});

	// Both walls come off one segment list, so they cannot disagree about the
	// silhouette — that is the whole reason the shapes are segments not strings.
	it('derives the outline and its sampled polygon from the same segments', () => {
		for (const shape of CREST_MESH_SHAPES) {
			const g = CREST_MESH_GEOMETRY[shape];
			expect(outlinePath(g).startsWith(`M${g.start[0]} ${g.start[1]}`)).toBe(true);
			expect(outlinePoly(g).length).toBeGreaterThanOrEqual(g.segs.length);
		}
	});

	it('closes every shield without duplicating its start point', () => {
		for (const shape of CREST_MESH_SHAPES) {
			const poly = outlinePoly(CREST_MESH_GEOMETRY[shape]);
			const last = poly[poly.length - 1];
			expect(`${last[0]},${last[1]}`).not.toBe(`${poly[0][0]},${poly[0][1]}`);
		}
	});

	// The mitre has to sit `t` from BOTH edges, which for a square means the
	// corner moves in by t on each axis — a plain scale would not.
	it('mitres an inset corner to sit t from both edges', () => {
		const square = [
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10]
		] as const;
		expect(insetPolygon(square, 1)).toBe('M1 1 L9 1 L9 9 L1 9 Z');
	});
});
