import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BulkActionBar from './BulkActionBar.svelte';

describe('BulkActionBar', () => {
	it('renders nothing when count is 0', () => {
		render(BulkActionBar, { count: 0, actions: [{ label: 'Assign', onclick: () => {} }] });
		expect(page.getByText('Assign').elements()).toHaveLength(0);
	});

	it('shows the selected count and fires a light action', async () => {
		let assigned = 0;
		render(BulkActionBar, {
			count: 3,
			actions: [{ label: 'Assign', onclick: () => (assigned += 1) }]
		});
		await expect.element(page.getByText('3')).toBeInTheDocument();
		await expect.element(page.getByText('selected')).toBeInTheDocument();
		await page.getByText('Assign').click();
		expect(assigned).toBe(1);
	});

	it('keeps heavy actions hidden until More is opened, then fires them', async () => {
		let removed = 0;
		render(BulkActionBar, {
			count: 2,
			actions: [{ label: 'Assign', onclick: () => {} }],
			moreActions: [{ label: 'Remove…', danger: true, onclick: () => (removed += 1) }]
		});
		// hidden before opening
		expect(page.getByText('Remove…').elements()).toHaveLength(0);
		await page.getByRole('button', { name: 'More' }).click();
		await expect.element(page.getByText('Remove…')).toBeInTheDocument();
		await page.getByText('Remove…').click();
		expect(removed).toBe(1);
	});

	it('fires ondeselect', async () => {
		let cleared = 0;
		render(BulkActionBar, { count: 2, ondeselect: () => (cleared += 1) });
		await page.getByText('Deselect').click();
		expect(cleared).toBe(1);
	});
});
