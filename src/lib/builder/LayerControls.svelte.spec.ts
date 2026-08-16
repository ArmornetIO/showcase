import { page } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LayerControls from './LayerControls.svelte';

describe('LayerControls', () => {
	it('renders two buttons', async () => {
		render(LayerControls, {
			props: {
				visible: true,
				locked: false,
				onToggleVisible: () => {},
				onToggleLocked: () => {}
			}
		});
		const buttons = page.getByRole('button');
		await expect.element(buttons.nth(0)).toBeInTheDocument();
		await expect.element(buttons.nth(1)).toBeInTheDocument();
	});

	it('applies lc-btn--off when visible is false', async () => {
		render(LayerControls, {
			props: {
				visible: false,
				locked: false,
				onToggleVisible: () => {},
				onToggleLocked: () => {}
			}
		});
		const btn = page.getByTitle('Show');
		await expect.element(btn).toHaveClass('lc-btn--off');
	});

	it('applies lc-btn--active when locked is true', async () => {
		render(LayerControls, {
			props: {
				visible: true,
				locked: true,
				onToggleVisible: () => {},
				onToggleLocked: () => {}
			}
		});
		const btn = page.getByTitle('Unlock');
		await expect.element(btn).toHaveClass('lc-btn--active');
	});

	it('calls onToggleVisible when visibility button clicked', async () => {
		const spy = vi.fn();
		render(LayerControls, {
			props: {
				visible: true,
				locked: false,
				onToggleVisible: spy,
				onToggleLocked: () => {}
			}
		});
		await page.getByTitle('Hide').click();
		expect(spy).toHaveBeenCalledOnce();
	});

	it('calls onToggleLocked when lock button clicked', async () => {
		const spy = vi.fn();
		render(LayerControls, {
			props: {
				visible: true,
				locked: false,
				onToggleVisible: () => {},
				onToggleLocked: spy
			}
		});
		await page.getByTitle('Lock').click();
		expect(spy).toHaveBeenCalledOnce();
	});
});
