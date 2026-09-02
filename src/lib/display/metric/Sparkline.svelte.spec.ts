import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Sparkline from './Sparkline.svelte';

describe('Sparkline', () => {
	it('renders an SVG element', async () => {
		render(Sparkline, { data: [1, 5, 3, 8, 2] });
		await expect.element(page.locator('svg')).toBeInTheDocument();
	});

	it('renders a wrapper div with correct height', async () => {
		render(Sparkline, { data: [1, 5, 3] });
		const wrap = page.locator('.sparkline-wrap');
		await expect.element(wrap).toBeInTheDocument();
		await expect.element(wrap).toHaveAttribute('style', /height/);
	});

	it('renders without throwing on empty data', async () => {
		expect(() => render(Sparkline, { data: [] })).not.toThrow();
	});

	it('renders without throwing on single point', async () => {
		expect(() => render(Sparkline, { data: [42] })).not.toThrow();
	});
});
