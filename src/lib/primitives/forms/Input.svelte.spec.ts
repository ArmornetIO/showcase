import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Input from './Input.svelte';

describe('Input', () => {
	it('renders an <input> element', async () => {
		render(Input, {});
		await expect.element(page.locator('input')).toBeInTheDocument();
	});

	it('placeholder is forwarded', async () => {
		render(Input, { placeholder: 'Search…' });
		await expect.element(page.locator('input')).toHaveAttribute('placeholder', 'Search…');
	});

	it('disabled state applied', async () => {
		render(Input, { disabled: true });
		await expect.element(page.locator('input')).toBeDisabled();
	});

	it('font-size is at least 16px (prevents iOS zoom)', async () => {
		render(Input, {});
		const input = page.locator('input').element() as HTMLInputElement;
		const fs = parseFloat(getComputedStyle(input).fontSize);
		expect(fs).toBeGreaterThanOrEqual(16);
	});

	it('has w-full class', async () => {
		render(Input, {});
		await expect.element(page.locator('input')).toHaveClass(/w-full/);
	});

	it('type prop is forwarded', async () => {
		render(Input, { type: 'password' });
		await expect.element(page.locator('input')).toHaveAttribute('type', 'password');
	});
});
