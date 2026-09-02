import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import IncidentDrawer from './IncidentDrawer.svelte';

const incident = {
	ecosystem: 'pip',
	package: 'requestz',
	version: '2.31.0',
	threatType: 'malware',
	threatScore: 9.4,
	cve: 'CVE-2024-99821',
	description: 'Typosquat shipping an obfuscated payload.',
	recommendation: 'Purge from caches and rotate credentials.',
	agents: ['agent-7f3a', 'agent-19bd'],
	firstSeen: '4h ago',
	lastSeen: '38m ago',
	count: 2
};

describe('IncidentDrawer', () => {
	it('renders the package, score and blast radius when open', async () => {
		render(IncidentDrawer, { open: true, incident, onclose: () => {}, severityLabel: 'CRITICAL' });
		await expect.element(page.getByText('requestz')).toBeInTheDocument();
		await expect.element(page.getByText('9.4')).toBeInTheDocument();
		await expect.element(page.getByText('agent-7f3a')).toBeInTheDocument();
		await expect.element(page.getByText('CVE-2024-99821')).toBeInTheDocument();
	});

	it('renders nothing when closed', async () => {
		render(IncidentDrawer, { open: false, incident, onclose: () => {} });
		expect(await page.getByText('requestz').count()).toBe(0);
	});

	it('close button fires onclose', async () => {
		let closed = false;
		render(IncidentDrawer, { open: true, incident, onclose: () => (closed = true) });
		await page.getByRole('button', { name: 'Close' }).click();
		expect(closed).toBe(true);
	});
});
