import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OverviewDrawer from './OverviewDrawer.svelte';

const base = {
	open: true,
	title: 'ACME Analytics',
	role: 'Monitored vendor',
	accent: '#fca5a5',
	icon: 'shield-alert' as const,
	stats: [
		{ label: 'Assessment', value: 'Not started' },
		{ label: 'Risk score', value: '—' }
	],
	onclose: () => {}
};

describe('OverviewDrawer', () => {
	it('renders title, role and stats when open', async () => {
		render(OverviewDrawer, base);
		await expect.element(page.getByText('ACME Analytics')).toBeInTheDocument();
		await expect.element(page.getByText('Monitored vendor')).toBeInTheDocument();
		await expect.element(page.getByText('Assessment')).toBeInTheDocument();
	});

	it('renders nothing when closed', async () => {
		render(OverviewDrawer, { ...base, open: false });
		expect(await page.getByText('ACME Analytics').count()).toBe(0);
	});

	it('close button fires onclose', async () => {
		let closed = false;
		render(OverviewDrawer, { ...base, onclose: () => (closed = true) });
		await page.getByRole('button', { name: 'Close' }).click();
		expect(closed).toBe(true);
	});

	it('cta fires oncta only when provided', async () => {
		let clicked = false;
		render(OverviewDrawer, { ...base, ctaLabel: 'View full record →', oncta: () => (clicked = true) });
		await page.getByRole('button', { name: /View full record/ }).click();
		expect(clicked).toBe(true);
	});
});
