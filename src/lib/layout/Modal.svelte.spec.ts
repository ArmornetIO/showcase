import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Modal from './Modal.svelte';

describe('Modal', () => {
	it('renders as <dialog> element', async () => {
		render(Modal, { open: true, children: () => 'Body' });
		await expect.element(page.locator('dialog')).toBeInTheDocument();
	});

	it('dialog is open when open=true', async () => {
		render(Modal, { open: true, children: () => 'Body' });
		const dialog = page.locator('dialog').element() as HTMLDialogElement;
		expect(dialog.open).toBe(true);
	});

	it('dialog is closed when open=false', async () => {
		render(Modal, { open: false, children: () => 'Body' });
		const dialog = page.locator('dialog').element() as HTMLDialogElement;
		expect(dialog.open).toBe(false);
	});

	it('title renders when provided', async () => {
		render(Modal, { open: true, title: 'Confirm Delete', children: () => 'Sure?' });
		await expect.element(page.getByText('Confirm Delete')).toBeInTheDocument();
	});

	it('close button is present when closable=true', async () => {
		render(Modal, { open: true, closable: true, children: () => 'B', onclose: () => {} });
		await expect.element(page.locator('button[aria-label="Close"]')).toBeInTheDocument();
	});

	it('close button absent when closable=false', async () => {
		render(Modal, { open: true, closable: false, children: () => 'B' });
		await expect.element(page.locator('button[aria-label="Close"]')).not.toBeInTheDocument();
	});

	it('onclose fires when close button clicked', async () => {
		let closed = false;
		render(Modal, { open: true, closable: true, children: () => 'B', onclose: () => (closed = true) });
		await page.locator('button[aria-label="Close"]').click();
		expect(closed).toBe(true);
	});

	it('footer renders when provided', async () => {
		render(Modal, { open: true, children: () => 'Body', footer: () => 'Footer Content' });
		await expect.element(page.getByText('Footer Content')).toBeInTheDocument();
	});

	it('all variants render without throwing', async () => {
		for (const variant of ['default', 'danger', 'warn', 'success'] as const) {
			expect(() => render(Modal, { open: true, variant, children: () => 'B' })).not.toThrow();
		}
	});
});
