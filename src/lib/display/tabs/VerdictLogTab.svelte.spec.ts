import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import VerdictLogTab from './VerdictLogTab.svelte';

describe('VerdictLogTab', () => {
	it('renders tallies and entries', async () => {
		render(VerdictLogTab, {
			stats: { total: 142, denied: 8, permitted: 134 },
			entries: [
				{
					id: 'i1',
					verdict: 'denied',
					source: 'go',
					target: 'rsc.io/quote@v1.5.2',
					reason: 'policy',
					ts: '2s ago'
				}
			]
		});
		await expect.element(page.getByText('142')).toBeInTheDocument();
		await expect.element(page.getByText('rsc.io/quote@v1.5.2')).toBeInTheDocument();
	});

	it('shows the empty state when there are no entries', async () => {
		render(VerdictLogTab, { stats: { total: 0, denied: 0, permitted: 0 }, entries: [] });
		await expect.element(page.getByText('Nothing recorded.')).toBeInTheDocument();
	});

	it('lets the host rename the verdict tallies', async () => {
		// The library says denied/permitted; a host may say blocked/allowed.
		render(VerdictLogTab, {
			stats: { total: 1, denied: 1, permitted: 0 },
			entries: [],
			deniedLabel: 'blocked',
			permittedLabel: 'allowed'
		});
		await expect.element(page.getByText('blocked')).toBeInTheDocument();
		await expect.element(page.getByText('allowed')).toBeInTheDocument();
	});

	it('filter chip fires onfilter', async () => {
		let picked = '';
		render(VerdictLogTab, {
			stats: { total: 0, denied: 0, permitted: 0 },
			filters: [{ id: 'denied', label: 'Denied' }],
			onfilter: (id: string) => (picked = id)
		});
		await page.getByText('Denied').click();
		expect(picked).toBe('denied');
	});
});
