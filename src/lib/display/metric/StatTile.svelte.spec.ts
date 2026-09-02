import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StatTile from './StatTile.svelte';

describe('StatTile', () => {
	it('renders label and value', async () => {
		render(StatTile, { label: 'LATENCY', value: '24ms' });
		await expect.element(page.getByText('LATENCY')).toBeInTheDocument();
		await expect.element(page.getByText('24ms')).toBeInTheDocument();
	});

	it('sub renders when provided', async () => {
		render(StatTile, { label: 'L', value: 'V', sub: '+12%', subVariant: 'up' });
		await expect.element(page.getByText('+12%')).toBeInTheDocument();
	});

	it('all sub variants render without throwing', async () => {
		for (const subVariant of ['up', 'down', 'neutral'] as const) {
			expect(() => render(StatTile, { label: 'L', value: 'V', sub: 'S', subVariant }))
				.not.toThrow();
		}
	});

	it('value font-size is in rem (not raw px)', async () => {
		render(StatTile, { label: 'L', value: 'V' });
		const valueEl = page.locator('.tile-value, [class*="value"]').first().element() as HTMLElement;
		const fs = parseFloat(getComputedStyle(valueEl).fontSize);
		expect(fs).toBeGreaterThan(0);
		expect(fs).toBeLessThan(50);
	});
});
