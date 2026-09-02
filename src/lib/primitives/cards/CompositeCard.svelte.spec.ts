import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CompositeCard from './CompositeCard.svelte';

const ITEMS = [{ label: 'L1', headline: 'H1' }, { label: 'L2', headline: 'H2' }];

describe('CompositeCard', () => {
	it('renders eyebrow, title, description', async () => {
		render(CompositeCard, { eyebrow: 'EYE', title: 'Title', description: 'Desc', items: [] });
		await expect.element(page.getByText('EYE')).toBeInTheDocument();
		await expect.element(page.getByText('Title')).toBeInTheDocument();
		await expect.element(page.getByText('Desc')).toBeInTheDocument();
	});

	it('renders all sidebar items', async () => {
		render(CompositeCard, { eyebrow: 'E', title: 'T', description: 'D', items: ITEMS });
		await expect.element(page.getByText('H1')).toBeInTheDocument();
		await expect.element(page.getByText('H2')).toBeInTheDocument();
	});

	it('item with href renders as <a>', async () => {
		render(CompositeCard, {
			eyebrow: 'E', title: 'T', description: 'D',
			items: [{ label: 'L', headline: 'H', href: '/test' }]
		});
		await expect.element(page.locator('a[href="/test"]')).toBeInTheDocument();
	});

	it('all variants render without throwing', async () => {
		for (const variant of ['accent', 'cyan', 'emerald', 'blue'] as const) {
			expect(() =>
				render(CompositeCard, { eyebrow: 'E', title: 'T', description: 'D', items: [], variant })
			).not.toThrow();
		}
	});
});
