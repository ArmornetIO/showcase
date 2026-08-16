import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
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
});
