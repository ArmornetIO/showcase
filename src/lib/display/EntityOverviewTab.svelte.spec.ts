import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EntityOverviewTab from './EntityOverviewTab.svelte';

describe('EntityOverviewTab', () => {
	it('renders kv stats', async () => {
		render(EntityOverviewTab, {
			stats: [
				{ label: 'Uptime', value: '3h 12m' },
				{ label: 'Version', value: '0.9.2' }
			]
		});
		await expect.element(page.getByText('Uptime')).toBeInTheDocument();
		await expect.element(page.getByText('3h 12m')).toBeInTheDocument();
	});

	it('renders highlights with a count badge', async () => {
		render(EntityOverviewTab, {
			stats: [],
			highlights: [{ label: 'Go proxy', detail: '312 calls', count: 3, countLabel: 'denied' }]
		});
		await expect.element(page.getByText('Go proxy')).toBeInTheDocument();
		await expect.element(page.getByText('3 denied')).toBeInTheDocument();
	});

	it('omits the count badge at zero', async () => {
		// A zero badge reads as a problem; absence is the honest rendering.
		render(EntityOverviewTab, {
			stats: [],
			highlights: [{ label: 'Quiet tool', count: 0, countLabel: 'denied' }]
		});
		await expect.element(page.getByText('Quiet tool')).toBeInTheDocument();
		await expect.element(page.getByText('0 denied')).not.toBeInTheDocument();
	});

	it('renders a credential and masks it when asked', async () => {
		render(EntityOverviewTab, {
			stats: [],
			credentials: [
				{ label: 'Client ID', value: 'agent:org_demo:a3f9c812', copyable: true },
				{ label: 'Secret', value: 'hunter2', masked: true }
			]
		});
		await expect.element(page.getByText('agent:org_demo:a3f9c812')).toBeInTheDocument();
		await expect.element(page.getByText('hunter2')).not.toBeInTheDocument();
	});

	it('copy button reports which credential was copied', async () => {
		let copied = '';
		render(EntityOverviewTab, {
			stats: [],
			credentials: [{ label: 'Client ID', value: 'agent:org:1', copyable: true }],
			oncopy: (label: string) => (copied = label)
		});
		await page.locator('button[aria-label="Copy Client ID"]').click();
		expect(copied).toBe('Client ID');
	});

	it('fires onaction for a credential action', async () => {
		let acted = '';
		render(EntityOverviewTab, {
			stats: [],
			credentials: [{ label: 'Secret', value: '', masked: true, actionLabel: 'Rotate' }],
			onaction: (label: string) => (acted = label)
		});
		await page.getByText('Rotate').click();
		expect(acted).toBe('Secret');
	});
});
