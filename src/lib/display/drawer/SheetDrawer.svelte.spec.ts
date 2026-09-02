import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import SheetDrawer from './SheetDrawer.svelte';

const snippet = (text: string) =>
	createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('SheetDrawer', () => {
	it('renders the title, body, actions and footer when open', async () => {
		render(SheetDrawer, {
			open: true,
			title: 'Vendor inventory',
			eyebrow: 'register',
			onclose: () => {},
			children: snippet('body'),
			actions: snippet('rail'),
			footer: snippet('foot')
		});
		await expect.element(page.getByText('Vendor inventory')).toBeInTheDocument();
		await expect.element(page.getByText('register')).toBeInTheDocument();
		await expect.element(page.getByText('body')).toBeInTheDocument();
		await expect.element(page.getByText('rail')).toBeInTheDocument();
		await expect.element(page.getByText('foot')).toBeInTheDocument();
	});

	it('renders nothing when closed', async () => {
		render(SheetDrawer, {
			open: false,
			title: 'Vendor inventory',
			onclose: () => {},
			children: snippet('body')
		});
		expect(await page.getByText('body').count()).toBe(0);
	});

	it('Escape closes a dismissible sheet but not an undismissible one', async () => {
		let closed = 0;
		const { rerender } = render(SheetDrawer, {
			open: true,
			title: 'Vendor inventory',
			onclose: () => (closed += 1),
			children: snippet('body')
		});
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(closed).toBe(1);

		await rerender({ dismissible: false });
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(closed).toBe(1);
	});

	it('close button fires onclose', async () => {
		let closed = false;
		render(SheetDrawer, {
			open: true,
			title: 'Vendor inventory',
			onclose: () => (closed = true),
			children: snippet('body')
		});
		await page.getByRole('button', { name: 'Close' }).click();
		expect(closed).toBe(true);
	});
});
