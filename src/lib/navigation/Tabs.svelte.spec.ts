import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Tabs from './Tabs.svelte';

const TABS = [
	{ id: 'a', label: 'Overview' },
	{ id: 'b', label: 'Logs' },
	{ id: 'c', label: 'Config', disabled: true }
];

describe('Tabs', () => {
	it('renders all tabs with role="tab"', async () => {
		render(Tabs, { tabs: TABS, active: 'a' });
		const tabs = page.getByRole('tab');
		expect(await tabs.count()).toBe(3);
	});

	it('active tab has aria-selected=true', async () => {
		render(Tabs, { tabs: TABS, active: 'b' });
		const logTab = page.getByRole('tab', { name: 'Logs' });
		await expect.element(logTab).toHaveAttribute('aria-selected', 'true');
	});

	it('inactive tab has aria-selected=false', async () => {
		render(Tabs, { tabs: TABS, active: 'a' });
		const logTab = page.getByRole('tab', { name: 'Logs' });
		await expect.element(logTab).toHaveAttribute('aria-selected', 'false');
	});

	it('onchange fires with tab id when clicked', async () => {
		let received: string | null = null;
		render(Tabs, { tabs: TABS, active: 'a', onchange: (id) => (received = id) });
		await page.getByRole('tab', { name: 'Logs' }).click();
		expect(received).toBe('b');
	});

	it('disabled tab does not fire onchange', async () => {
		let received: string | null = null;
		render(Tabs, { tabs: TABS, active: 'a', onchange: (id) => (received = id) });
		await page.getByRole('tab', { name: 'Config' }).click();
		expect(received).toBeNull();
	});

	it('tab list container has overflow-x-auto for mobile scroll', async () => {
		render(Tabs, { tabs: TABS, active: 'a' });
		const list = page.getByRole('tablist');
		const overflow = getComputedStyle(list.element() as Element).overflowX;
		expect(overflow).toBe('auto');
	});
});
