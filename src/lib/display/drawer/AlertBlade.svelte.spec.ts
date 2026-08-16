import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AlertBlade from './AlertBlade.svelte';
import { alertBlade } from './alertBlade.svelte.js';

describe('AlertBlade', () => {
	it('has role="alert"', async () => {
		render(AlertBlade, { id: '1', message: 'Done', ondismiss: () => {} });
		await expect.element(page.locator('[role="alert"]')).toBeInTheDocument();
	});

	it('renders message', async () => {
		render(AlertBlade, { id: '1', message: 'Connection lost', ondismiss: () => {} });
		await expect.element(page.getByText('Connection lost')).toBeInTheDocument();
	});

	it('renders title when provided', async () => {
		render(AlertBlade, { id: '1', title: 'Warning', message: 'Disk full', ondismiss: () => {} });
		await expect.element(page.getByText('Warning')).toBeInTheDocument();
	});

	it('action button fires action.onclick', async () => {
		let fired = false;
		render(AlertBlade, {
			id: '1', message: 'Retry?', ondismiss: () => {},
			action: { label: 'Retry', onclick: () => (fired = true) }
		});
		await page.getByText('Retry').click();
		expect(fired).toBe(true);
	});

	it('dismiss button fires ondismiss', async () => {
		let dismissed: string | null = null;
		render(AlertBlade, { id: 'abc', message: 'Hi', ondismiss: (id) => (dismissed = id) });
		await page.locator('button[aria-label="Dismiss"]').click();
		expect(dismissed).toBe('abc');
	});

	it('progress bar present when duration > 0', async () => {
		render(AlertBlade, { id: '1', message: 'Hi', duration: 5000, ondismiss: () => {} });
		await expect.element(page.locator('.blade-progress, [class*="progress"]')).toBeInTheDocument();
	});

	it('progress bar absent when duration=0', async () => {
		render(AlertBlade, { id: '1', message: 'Hi', duration: 0, ondismiss: () => {} });
		await expect.element(page.locator('.blade-progress')).not.toBeInTheDocument();
	});

	it('all variants render without throwing', async () => {
		for (const variant of ['info', 'success', 'warn', 'danger'] as const) {
			expect(() => render(AlertBlade, { id: '1', message: 'M', variant, ondismiss: () => {} }))
				.not.toThrow();
		}
	});

	it('max-width does not exceed viewport - 48px', async () => {
		render(AlertBlade, { id: '1', message: 'M', ondismiss: () => {} });
		const el = page.locator('[role="alert"]').first();
		const box = await el.boundingBox();
		expect(box!.width).toBeLessThanOrEqual(window.innerWidth - 48);
	});
});

describe('alertBlade store', () => {
	beforeEach(() => alertBlade.clear());

	it('show adds an item and returns its id', () => {
		const id = alertBlade.show({ message: 'hi' });
		const item = alertBlade.items.find((b) => b.id === id);
		expect(item?.message).toBe('hi');
		expect(item?.variant).toBe('info');
	});

	it('update patches an item in place, preserving its id', () => {
		const id = alertBlade.show({ message: 'starting', variant: 'info', duration: 0 });
		alertBlade.update(id, { message: 'done', variant: 'success', duration: 4000 });
		const item = alertBlade.items.find((b) => b.id === id);
		expect(item?.id).toBe(id);
		expect(item?.message).toBe('done');
		expect(item?.variant).toBe('success');
		expect(item?.duration).toBe(4000);
	});

	it('update is a no-op for an unknown id', () => {
		alertBlade.show({ message: 'x' });
		const before = alertBlade.items.length;
		alertBlade.update('nope', { message: 'y' });
		expect(alertBlade.items.length).toBe(before);
	});

	it('dismiss removes the item by id', () => {
		const id = alertBlade.show({ message: 'x' });
		alertBlade.dismiss(id);
		expect(alertBlade.items.find((b) => b.id === id)).toBeUndefined();
	});
});
