import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Toggle from './Toggle.svelte';

describe('Toggle', () => {
	it('has role="switch"', async () => {
		render(Toggle, { checked: false, onchange: () => {} });
		await expect.element(page.getByRole('switch')).toBeInTheDocument();
	});

	it('aria-checked reflects checked prop', async () => {
		render(Toggle, { checked: true, onchange: () => {} });
		await expect.element(page.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
	});

	it('meets 44px touch target height', async () => {
		render(Toggle, { checked: false, onchange: () => {} });
		const el = page.getByRole('switch');
		const box = await el.boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
	});

	it('fires onchange with toggled value', async () => {
		let received: boolean | null = null;
		render(Toggle, { checked: false, onchange: (v) => (received = v) });
		await page.getByRole('switch').click();
		expect(received).toBe(true);
	});

	it('disabled state prevents onchange', async () => {
		let received: boolean | null = null;
		render(Toggle, { checked: false, disabled: true, onchange: (v) => (received = v) });
		await page.getByRole('switch').click();
		expect(received).toBeNull();
	});
});
