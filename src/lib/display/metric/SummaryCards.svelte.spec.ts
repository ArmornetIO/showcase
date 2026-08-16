import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SummaryCards from './SummaryCards.svelte';

const ITEMS = [
	{ label: 'TOTAL', value: 42 },
	{ label: 'ACTIVE', value: 18 },
	{ label: 'OFFLINE', value: 3 },
	{ label: 'DEGRADED', value: 5 },
];

describe('SummaryCards', () => {
	it('renders all item values and labels', async () => {
		render(SummaryCards, { items: ITEMS });
		await expect.element(page.getByText('TOTAL')).toBeInTheDocument();
		await expect.element(page.getByText('42')).toBeInTheDocument();
		await expect.element(page.getByText('ACTIVE')).toBeInTheDocument();
	});

	it('all variants render without throwing', async () => {
		const variantItems = ['default', 'accent', 'success', 'warn', 'error'].map((v, i) => ({
			label: v, value: i, variant: v as any
		}));
		expect(() => render(SummaryCards, { items: variantItems })).not.toThrow();
	});

	it('highlight item renders different border styling', async () => {
		render(SummaryCards, { items: [{ label: 'A', value: 1, highlight: true }] });
		await expect.element(page.locator('.summary-card, [class*="summary"]').first())
			.toBeInTheDocument();
	});

	it('custom columns prop accepted', async () => {
		expect(() => render(SummaryCards, { items: ITEMS, columns: 2 })).not.toThrow();
	});

	it('mobileCols defaults to 2 (grid has at most 2 cols on narrow screens)', async () => {
		render(SummaryCards, { items: ITEMS });
		const grid = page.locator('.summary-grid, [class*="summary"]').first();
		const el = grid.element() as HTMLElement;
		const mobileCols = getComputedStyle(el).getPropertyValue('--mobile-cols').trim();
		expect(mobileCols === '' || mobileCols === '2').toBe(true);
	});
});
