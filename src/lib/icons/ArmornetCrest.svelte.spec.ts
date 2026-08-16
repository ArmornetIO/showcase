import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ArmornetCrest from './ArmornetCrest.svelte';

describe('ArmornetCrest', () => {
	it('renders a labelled svg at the requested size', async () => {
		render(ArmornetCrest, { size: 96 });
		const svg = page.locator('svg[role="img"]');
		await expect.element(svg).toBeInTheDocument();
		await expect.element(svg).toHaveAttribute('width', '96');
		await expect.element(svg).toHaveAccessibleName('Armornet');
	});

	it('drops the halo underlay and the mesh footprint when turned off', async () => {
		const { container } = render(ArmornetCrest, { glow: false, mesh: false });
		// One <use> only — the crisp mark, with no blurred copy beneath it.
		expect(container.querySelectorAll('use')).toHaveLength(1);
		expect(container.querySelector('[stroke="#7fa79a"]')).toBeNull();
	});

	// The defs are id-referenced, so two crests on a page must not collide.
	it('scopes its mask and halo ids per instance', async () => {
		const a = render(ArmornetCrest, {});
		const b = render(ArmornetCrest, {});
		const maskOf = (c: Element) => c.querySelector('mask')!.id;
		expect(maskOf(a.container)).not.toBe(maskOf(b.container));
	});
});
