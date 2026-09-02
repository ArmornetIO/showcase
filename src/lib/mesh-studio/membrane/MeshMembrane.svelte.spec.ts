import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MeshMembrane from './MeshMembrane.svelte';

const SAMPLE = {
	registries: [{ id: 'r-npm', label: 'NPM·REG', kind: 'npm' }],
	proxies: [{ id: 'p-npm', label: 'NPM', kind: 'npm', policy: 'block' as const, enabled: true }],
	agents: [{ id: 'a1', label: 'agent-1', status: 'healthy' as const }]
};

describe('MeshMembrane', () => {
	it('shows the dormant empty state when there is no data', async () => {
		render(MeshMembrane, { animate: false, ambient: false });
		await expect.element(page.locator('.membrane-empty')).toBeInTheDocument();
	});

	it('renders the canvas + telemetry when given frontier data', async () => {
		render(MeshMembrane, { ...SAMPLE, animate: false, ambient: false, seen: 128000, blocked: 37, allowed: 127951 });
		await expect.element(page.locator('.membrane')).toBeInTheDocument();
		await expect.element(page.locator('.telemetry')).toBeInTheDocument();
	});

	it('prints the blocked hero counter', async () => {
		render(MeshMembrane, { ...SAMPLE, animate: false, ambient: false, blocked: 37 });
		await expect.element(page.locator('.tm-num--hero')).toHaveText('37');
	});

	it('can hide telemetry', async () => {
		render(MeshMembrane, { ...SAMPLE, animate: false, ambient: false, showTelemetry: false });
		await expect.element(page.locator('.telemetry')).not.toBeInTheDocument();
	});

	it('renders the vendor lane (feeds → vendors → agent) from the vendors prop', async () => {
		render(MeshMembrane, {
			animate: false,
			ambient: false,
			showTelemetry: false,
			vendors: [
				{ id: 'v-approved', label: 'STRIPE', status: 'approved' as const },
				{ id: 'v-critical', label: 'ACME', status: 'critical' as const }
			]
		});
		// Not the empty state — the vendor lane counts as frontier data.
		await expect.element(page.locator('.membrane-empty')).not.toBeInTheDocument();
		await expect.element(page.locator('.membrane')).toBeInTheDocument();
		// Vendor + auto-added threat-feed / vendor-agent labels are drawn on the canvas.
		await expect.element(page.getByText('STRIPE')).toBeInTheDocument();
		await expect.element(page.getByText('THREAT FEEDS')).toBeInTheDocument();
		await expect.element(page.getByText('VENDOR AGENT')).toBeInTheDocument();
	});
});
