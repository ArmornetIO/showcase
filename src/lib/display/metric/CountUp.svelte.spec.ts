import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CountUp from './CountUp.svelte';

describe('CountUp', () => {
	it('renders a span', async () => {
		render(CountUp, { value: 1000 });
		await expect.element(page.locator('.count-up')).toBeInTheDocument();
	});

	it('shows the final formatted value immediately when animate is false', async () => {
		render(CountUp, { value: 1284, animate: false });
		await expect.element(page.locator('.count-up')).toHaveText('1,284');
	});

	it('applies prefix and suffix', async () => {
		render(CountUp, { value: 82, animate: false, suffix: '%' });
		await expect.element(page.locator('.count-up')).toHaveText('82%');
	});

	it('respects decimals and disabling the separator', async () => {
		render(CountUp, { value: 1234.5, animate: false, decimals: 1, separator: false });
		await expect.element(page.locator('.count-up')).toHaveText('1234.5');
	});

	it('uses monospace by default and drops it when mono is false', async () => {
		render(CountUp, { value: 5, animate: false, mono: false });
		await expect.element(page.locator('.count-up')).toBeInTheDocument();
		await expect.element(page.locator('.count-up--mono')).not.toBeInTheDocument();
	});
});
