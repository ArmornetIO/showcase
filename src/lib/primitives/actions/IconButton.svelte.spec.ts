import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import IconButton from './IconButton.svelte';

describe('IconButton', () => {
	it('has aria-label', async () => {
		render(IconButton, { label: 'Close', icon: 'x' });
		await expect.element(page.locator('button[aria-label="Close"]')).toBeInTheDocument();
	});

	it('meets 44×44px touch target on mobile', async () => {
		render(IconButton, { label: 'Close', icon: 'x' });
		const box = await page.locator('button').boundingBox();
		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);
	});

	it('disabled state is forwarded', async () => {
		render(IconButton, { label: 'Delete', icon: 'trash', disabled: true });
		await expect.element(page.locator('button')).toBeDisabled();
	});

	it('onclick fires when not disabled', async () => {
		let fired = false;
		render(IconButton, { label: 'Go', icon: 'arrow-right', onclick: () => (fired = true) });
		await page.locator('button').click();
		expect(fired).toBe(true);
	});
});
