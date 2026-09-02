import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import IconToolbar from './IconToolbar.svelte';
import type { IconToolbarItem } from './IconToolbar.svelte';

describe('IconToolbar', () => {
	it('renders button items with their labels', async () => {
		const items: IconToolbarItem[] = [
			{ icon: 'users', label: 'Assignees', onclick: () => {} },
			{ divider: true },
			{ icon: 'share-2', label: 'Share', onclick: () => {} }
		];
		render(IconToolbar, { items });
		await expect.element(page.getByLabelText('Assignees')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Share')).toBeInTheDocument();
	});

	it('a menu item is a dropdown trigger, not a plain button', async () => {
		const items: IconToolbarItem[] = [
			{
				icon: 'clipboard-check',
				label: 'Verdict',
				menu: [
					{ label: 'Approve', icon: 'check', onclick: () => {} },
					{ label: 'Flag', icon: 'flag', onclick: () => {} }
				]
			}
		];
		render(IconToolbar, { items });
		const trigger = page.getByLabelText('Verdict');
		await expect.element(trigger).toHaveAttribute('aria-haspopup', 'menu');
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('opening a menu reveals its items and fires onclick', async () => {
		let picked = '';
		const items: IconToolbarItem[] = [
			{
				icon: 'clipboard-check',
				label: 'Verdict',
				menu: [
					{ label: 'Approve', icon: 'check', selected: true, onclick: () => (picked = 'approve') },
					{ label: 'Flag', icon: 'flag', onclick: () => (picked = 'flag') }
				]
			}
		];
		render(IconToolbar, { items });
		await page.getByLabelText('Verdict').click();
		const approve = page.getByRole('menuitemradio', { name: 'Approve' });
		await expect.element(approve).toHaveAttribute('aria-checked', 'true');
		await page.getByRole('menuitemradio', { name: 'Flag' }).click();
		expect(picked).toBe('flag');
	});
});
