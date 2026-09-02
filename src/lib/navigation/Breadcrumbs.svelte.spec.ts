import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Breadcrumbs from './Breadcrumbs.svelte';

const ITEMS = [
	{ label: 'Home', href: '/' },
	{ label: 'Vendors', href: '/vendors' },
	{ label: 'Acme Corp' }
];

describe('Breadcrumbs', () => {
	it('has aria-label="Breadcrumb" on <nav>', async () => {
		render(Breadcrumbs, { items: ITEMS });
		await expect.element(page.locator('nav[aria-label="Breadcrumb"]')).toBeInTheDocument();
	});

	it('renders all labels', async () => {
		render(Breadcrumbs, { items: ITEMS });
		for (const item of ITEMS) {
			await expect.element(page.getByText(item.label)).toBeInTheDocument();
		}
	});

	it('intermediate items with href render as links', async () => {
		render(Breadcrumbs, { items: ITEMS });
		await expect.element(page.locator('a[href="/vendors"]')).toBeInTheDocument();
		await expect.element(page.locator('a[href="/"]')).toBeInTheDocument();
	});

	it('last item renders as plain text (not a link)', async () => {
		render(Breadcrumbs, { items: ITEMS });
		const lastLink = page.locator('a', { hasText: 'Acme Corp' });
		await expect.element(lastLink).not.toBeInTheDocument();
	});

	it('custom separator is rendered', async () => {
		render(Breadcrumbs, { items: ITEMS, separator: '>' });
		await expect.element(page.getByText('>').first()).toBeInTheDocument();
	});

	it('breadcrumb list scrolls horizontally on overflow (overflow-x: auto)', async () => {
		render(Breadcrumbs, { items: ITEMS });
		const ol = page.locator('ol');
		const overflow = getComputedStyle(ol.element() as Element).overflowX;
		expect(overflow).toBe('auto');
	});
});
