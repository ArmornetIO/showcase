import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FilterToolbar from './FilterToolbar.svelte';

describe('FilterToolbar', () => {
	it('renders result count with the correct noun', async () => {
		render(FilterToolbar, { resultCount: 3, noun: 'vendor' });
		await expect.element(page.getByText('3')).toBeInTheDocument();
		await expect.element(page.getByText('vendors')).toBeInTheDocument();
	});

	it('uses the singular noun when count is 1', async () => {
		render(FilterToolbar, { resultCount: 1, noun: 'vendor' });
		await expect.element(page.getByText('vendor', { exact: true })).toBeInTheDocument();
	});

	it('shows active-filter note and fires onreset from Clear all', async () => {
		let reset = 0;
		render(FilterToolbar, { resultCount: 5, activeFilters: 2, onreset: () => (reset += 1) });
		await expect.element(page.getByText('2 filters active')).toBeInTheDocument();
		await page.getByText('Clear all').click();
		expect(reset).toBe(1);
	});

	it('hides Clear all when no filters are active', async () => {
		render(FilterToolbar, { resultCount: 5, activeFilters: 0, onreset: () => {} });
		expect(page.getByText('Clear all').elements()).toHaveLength(0);
	});
});
