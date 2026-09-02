import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StatCard from './StatCard.svelte';

describe('StatCard', () => {
	it('renders value and label', async () => {
		render(StatCard, { value: '42', label: 'AGENTS' });
		await expect.element(page.getByText('42')).toBeInTheDocument();
		await expect.element(page.getByText('AGENTS')).toBeInTheDocument();
	});

	it('all size variants render without overflow', async () => {
		for (const size of ['sm', 'md', 'md-long', 'lg', 'xl'] as const) {
			render(StatCard, { value: '99', label: 'TOTAL', size });
			const el = page.locator('.stat-card, [class*="stat"]').first();
			const box = await el.boundingBox();
			expect(box!.width).toBeGreaterThan(0);
		}
	});

	it('all variants render without throwing', async () => {
		for (const variant of ['default', 'accent', 'warn', 'error', 'dim'] as const) {
			expect(() => render(StatCard, { value: 1, label: 'L', variant })).not.toThrow();
		}
	});

	it('corner bracket spans are in DOM', async () => {
		render(StatCard, { value: '7', label: 'L' });
		const corners = page.locator('.tl, .br, [class*="corner"]');
		expect(await corners.count()).toBeGreaterThanOrEqual(2);
	});

	it('xl value font-size does not exceed 60px (clamp working)', async () => {
		render(StatCard, { value: '999', label: 'L', size: 'xl' });
		const valueEl = page.locator('.card-value, [class*="value"]').first().element() as HTMLElement;
		const fs = parseFloat(getComputedStyle(valueEl).fontSize);
		expect(fs).toBeLessThanOrEqual(60);
	});
});
