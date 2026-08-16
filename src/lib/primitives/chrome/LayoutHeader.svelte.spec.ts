import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LayoutHeader from './LayoutHeader.svelte';

describe('LayoutHeader', () => {
	it('renders eyebrow text', async () => {
		render(LayoutHeader, { eyebrow: '// OVERVIEW' });
		await expect.element(page.getByText('// OVERVIEW')).toBeInTheDocument();
	});

	it('toggle button starts expanded', async () => {
		render(LayoutHeader, { eyebrow: '// OVERVIEW' });
		await expect.element(page.locator('button[aria-expanded="true"]')).toBeInTheDocument();
	});

	it('click toggle collapses the hero area', async () => {
		render(LayoutHeader, { eyebrow: '// OVERVIEW', title: () => 'Title' });
		await page.locator('button').first().click();
		await expect.element(page.locator('button[aria-expanded="false"]')).toBeInTheDocument();
	});

	it('renders no trail by default', async () => {
		render(LayoutHeader, { eyebrow: '// OVERVIEW' });
		expect(page.locator('nav[aria-label="Breadcrumb"]').query()).toBeNull();
	});

	it('renders ancestors as links on the eyebrow row', async () => {
		render(LayoutHeader, {
			eyebrow: '// RSK-014',
			crumbs: [{ label: 'Risk register', href: '/risk/register' }]
		});
		const crumb = page.getByRole('link', { name: 'Risk register' });
		await expect.element(crumb).toBeInTheDocument();
		await expect.element(crumb).toHaveAttribute('href', '/risk/register');
		// The trail is not the toggle — the eyebrow beside it still is.
		await expect.element(page.locator('button[aria-expanded="true"]')).toBeInTheDocument();
	});
});
