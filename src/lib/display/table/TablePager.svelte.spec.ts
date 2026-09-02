import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TablePager, { pageWindow } from './TablePager.svelte';

describe('pageWindow', () => {
	it('lists every page when total <= 7', () => {
		expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
	});

	it('windows around the current page with gaps', () => {
		expect(pageWindow(6, 10)).toEqual([1, 'gap', 5, 6, 7, 'gap', 10]);
	});

	it('collapses only the trailing side near the start', () => {
		expect(pageWindow(1, 10)).toEqual([1, 2, 'gap', 10]);
	});
});

describe('TablePager', () => {
	it('renders the current range and total', async () => {
		render(TablePager, { page: 1, pageSize: 10, total: 14 });
		await expect.element(page.getByText('1–10')).toBeInTheDocument();
		await expect.element(page.getByText('of 14')).toBeInTheDocument();
	});

	it('advances the range when Next is clicked', async () => {
		render(TablePager, { pageSize: 10, total: 14 });
		await page.getByRole('button', { name: 'Next page' }).click();
		await expect.element(page.getByText('11–14')).toBeInTheDocument();
	});

	it('omits page buttons for a single page', async () => {
		render(TablePager, { pageSize: 10, total: 7 });
		expect(page.getByRole('button', { name: 'Next page' }).elements()).toHaveLength(0);
	});
});
