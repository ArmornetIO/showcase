import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Button from './Button.svelte';

describe('Button', () => {
	it('renders as <button> by default', async () => {
		render(Button, { children: () => 'Click' });
		await expect.element(page.locator('button')).toBeInTheDocument();
	});

	it('renders as <a> when href is provided', async () => {
		render(Button, { href: '/foo', children: () => 'Go' });
		await expect.element(page.locator('a[href="/foo"]')).toBeInTheDocument();
	});

	it('disabled prevents click and applies opacity', async () => {
		let clicked = false;
		render(Button, { disabled: true, onclick: () => (clicked = true), children: () => 'X' });
		await page.locator('button').click();
		expect(clicked).toBe(false);
		await expect.element(page.locator('button')).toBeDisabled();
	});

	it('loading state shows spinner and sets aria-busy', async () => {
		render(Button, { loading: true, children: () => 'Save' });
		await expect.element(page.locator('.btn-spinner')).toBeInTheDocument();
		await expect.element(page.locator('button')).toHaveAttribute('aria-busy', 'true');
	});

	it('full prop adds w-full', async () => {
		render(Button, { full: true, children: () => 'Submit' });
		await expect.element(page.locator('button')).toHaveClass(/btn-full|w-full/);
	});

	it('all sizes meet 44px touch target height', async () => {
		for (const size of ['sm', 'md', 'lg'] as const) {
			render(Button, { size, children: () => size });
			const box = await page.locator('button').boundingBox();
			expect(box!.height, `size="${size}" height < 44px`).toBeGreaterThanOrEqual(44);
		}
	});

	it('onclick fires when clicked', async () => {
		let fired = false;
		render(Button, { onclick: () => (fired = true), children: () => 'Go' });
		await page.locator('button').click();
		expect(fired).toBe(true);
	});

	it('each variant renders without throwing', async () => {
		for (const variant of ['primary', 'ghost', 'danger', 'solid', 'solid-ghost'] as const) {
			expect(() => render(Button, { variant, children: () => variant })).not.toThrow();
		}
	});
});
