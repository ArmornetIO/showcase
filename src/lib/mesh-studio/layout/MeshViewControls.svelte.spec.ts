import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MeshViewControls from './MeshViewControls.svelte';

describe('MeshViewControls', () => {
	it('shows the filter count in the button badge', async () => {
		render(MeshViewControls, { layout: 'grouped', count: 3 });
		await expect.element(page.getByRole('button', { name: /View \(3\)/ })).toBeInTheDocument();
	});

	it('omits the badge when count is zero', async () => {
		render(MeshViewControls, { layout: 'grouped', count: 0 });
		const btn = page.getByRole('button', { name: 'View' });
		await expect.element(btn).toBeInTheDocument();
	});

	it('reveals the arrangement picker only after opening', async () => {
		render(MeshViewControls, { layout: 'grouped' });
		// Closed: no arrangement options rendered.
		expect(await page.getByRole('button', { name: 'Grouped' }).count()).toBe(0);
		await page.getByRole('button', { name: /View/ }).click();
		// Open: the five layout options appear.
		await expect.element(page.getByRole('button', { name: 'Grouped' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Globe' })).toBeInTheDocument();
	});
});
