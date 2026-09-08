import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import Tooltip from './Tooltip.svelte';

describe('Tooltip', () => {
	it('does not show tooltip initially', async () => {
		render(Tooltip, { content: 'Help text', children: () => 'Trigger' });
		await expect.element(page.locator('[role="tooltip"]')).not.toBeInTheDocument();
	});

	it('shows tooltip on mouseenter', async () => {
		render(Tooltip, { content: 'Help text', children: () => 'Trigger' });
		await page.locator('span').hover();
		await expect.element(page.locator('[role="tooltip"]')).toBeInTheDocument();
		await expect.element(page.getByText('Help text')).toBeInTheDocument();
	});

	it('hides tooltip on mouseleave', async () => {
		render(Tooltip, { content: 'Help text', children: () => 'Trigger' });
		await page.locator('span').hover();
		await page.locator('body').hover();
		await expect.element(page.locator('[role="tooltip"]')).not.toBeInTheDocument();
	});

	it('all four placements render without overlap error', async () => {
		for (const placement of ['top', 'bottom', 'left', 'right'] as const) {
			expect(() => render(Tooltip, { content: 'T', placement, children: () => 'T' }))
				.not.toThrow();
		}
	});

	it('points the trigger at the panel while it is open', async () => {
		const { container } = render(Tooltip, {
			content: 'Help text',
			children: createRawSnippet(() => ({ render: () => '<button>Trigger</button>' }))
		});
		const trigger = container.querySelector('button') as HTMLElement;

		// Nothing to describe until there is a panel to describe it with.
		expect(trigger.getAttribute('aria-describedby')).toBeNull();

		await page.getByRole('button', { name: 'Trigger' }).hover();

		// On the TRIGGER, not the wrapper: the wrapper is role="none", so an
		// attribute there is not in the accessibility tree at all.
		const id = trigger.getAttribute('aria-describedby');
		expect(id).toBeTruthy();
		// For an icon-only trigger — an info dot — this is the entire label.
		expect(document.getElementById(id!)?.getAttribute('role')).toBe('tooltip');
	});

	it('Escape dismisses the tooltip and does not let the key travel further', async () => {
		render(Tooltip, { content: 'Help text', children: () => 'Trigger' });
		await page.locator('span').hover();
		await expect.element(page.locator('[role="tooltip"]')).toBeInTheDocument();

		// A panel around this tooltip listens on window for its own Escape. If the
		// key gets past us, reading an info dot inside the dev console closes the
		// whole console — which is exactly what used to happen.
		let escaped = false;
		const spy = () => (escaped = true);
		window.addEventListener('keydown', spy);
		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		window.removeEventListener('keydown', spy);

		await expect.element(page.locator('[role="tooltip"]')).not.toBeInTheDocument();
		expect(escaped).toBe(false);
	});

	it('lets every other key through untouched', async () => {
		render(Tooltip, { content: 'Help text', children: () => 'Trigger' });
		await page.locator('span').hover();

		let seen = '';
		const spy = (e: KeyboardEvent) => (seen = e.key);
		window.addEventListener('keydown', spy);
		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
		window.removeEventListener('keydown', spy);

		expect(seen).toBe('a');
		await expect.element(page.locator('[role="tooltip"]')).toBeInTheDocument();
	});
});
