import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ArmornetCrestHub from './ArmornetCrestHub.svelte';

describe('ArmornetCrestHub', () => {
	it('renders a labelled svg at the requested size', async () => {
		render(ArmornetCrestHub, { size: 96 });
		const svg = page.locator('svg[role="img"]');
		await expect.element(svg).toBeInTheDocument();
		await expect.element(svg).toHaveAttribute('width', '96');
		await expect.element(svg).toHaveAccessibleName('Armornet');
	});

	it('draws five satellites, the hub, and four shield landings', async () => {
		const { container } = render(ArmornetCrestHub, {});
		expect(container.querySelectorAll('circle')).toHaveLength(10);
	});

	it('drops the tethers and their landings when unbound', async () => {
		const { container } = render(ArmornetCrestHub, { tethers: false });
		expect(container.querySelectorAll('circle')).toHaveLength(6);
	});

	// 'bar' keeps the counter open, 'stem' adds the apex spoke, 'full' adds both feet.
	it('varies the hub edge count with the spokes prop', async () => {
		const segments = (spokes: 'full' | 'stem' | 'bar') => {
			const { container } = render(ArmornetCrestHub, { spokes });
			// The hub edges are the last <path> in the mark; count its subpaths.
			const paths = container.querySelectorAll('path');
			return (paths[paths.length - 1].getAttribute('d')?.match(/M/g) ?? []).length;
		};
		expect(segments('bar')).toBe(2);
		expect(segments('stem')).toBe(3);
		expect(segments('full')).toBe(5);
	});
});
