import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NodeDrawer from './NodeDrawer.svelte';
import type { MeshNodeType } from './NodeDrawer.svelte';

const BASE = {
	open: true, type: 'control-plane' as MeshNodeType, icon: 'CP',
	title: 'Armornet Core',
	nodeId: 'ctrl.plane.01', nodeState: 'healthy' as const,
	onclose: () => {},
};

describe('NodeDrawer', () => {
	it('has role="dialog" with aria-modal', async () => {
		render(NodeDrawer, BASE);
		await expect.element(page.locator('[role="dialog"][aria-modal="true"]')).toBeInTheDocument();
	});

	it('is-open class present when open=true', async () => {
		render(NodeDrawer, BASE);
		await expect.element(page.locator('.drawer.is-open')).toBeInTheDocument();
	});

	it('is-open class absent when open=false', async () => {
		render(NodeDrawer, { ...BASE, open: false });
		await expect.element(page.locator('.is-open')).not.toBeInTheDocument();
	});

	it('title renders, with node state in place of the old eyebrow', async () => {
		render(NodeDrawer, BASE);
		await expect.element(page.getByText('Armornet Core')).toBeInTheDocument();
		await expect.element(page.getByText('HEALTHY')).toBeInTheDocument();
	});

	it('node state chip tracks nodeState and appears exactly once', async () => {
		render(NodeDrawer, { ...BASE, nodeState: 'degraded' as const });
		await expect.element(page.getByText('DEGRADED')).toBeInTheDocument();
		// The metadata-row duplicate is gone — status is stated once, above the title.
		expect(page.getByText('DEGRADED').elements()).toHaveLength(1);
	});

	it('onclose fires when close button clicked', async () => {
		let closed = false;
		render(NodeDrawer, { ...BASE, onclose: () => (closed = true) });
		await page.locator('button[aria-label="Close"]').click();
		expect(closed).toBe(true);
	});

	it('all mesh node types render without throwing', async () => {
		const types: MeshNodeType[] = ['control-plane', 'agentic', 'proxy', 'daemon'];
		for (const type of types) {
			expect(() => render(NodeDrawer, { ...BASE, type })).not.toThrow();
		}
	});

	it('control-plane shows Agents and Push Queue tabs', async () => {
		render(NodeDrawer, { ...BASE, type: 'control-plane' });
		await expect.element(page.getByRole('tab', { name: 'Agents' })).toBeInTheDocument();
		await expect.element(page.getByRole('tab', { name: 'Push Queue' })).toBeInTheDocument();
	});

	it('agentic shows Queries and Tools tabs', async () => {
		render(NodeDrawer, { ...BASE, type: 'agentic' });
		await expect.element(page.getByRole('tab', { name: 'Queries' })).toBeInTheDocument();
		await expect.element(page.getByRole('tab', { name: 'Tools' })).toBeInTheDocument();
	});

	it('proxy shows Intercepts and Block Log tabs', async () => {
		render(NodeDrawer, { ...BASE, type: 'proxy' });
		await expect.element(page.getByRole('tab', { name: 'Intercepts' })).toBeInTheDocument();
		await expect.element(page.getByRole('tab', { name: 'Block Log' })).toBeInTheDocument();
	});

	it('daemon shows Task Log tab', async () => {
		render(NodeDrawer, { ...BASE, type: 'daemon' });
		await expect.element(page.getByRole('tab', { name: 'Task Log' })).toBeInTheDocument();
	});

	it('tab buttons render with role="tab"', async () => {
		render(NodeDrawer, BASE);
		const tabs = page.getByRole('tab');
		expect(await tabs.count()).toBeGreaterThanOrEqual(4);
	});

	it('degraded nodeState renders with correct status', async () => {
		render(NodeDrawer, { ...BASE, nodeState: 'degraded' });
		await expect.element(page.getByText('DEGRADED')).toBeInTheDocument();
	});
});
