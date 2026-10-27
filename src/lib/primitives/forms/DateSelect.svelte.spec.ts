import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DateSelect from './DateSelect.svelte';

const TODAY = '2026-09-29';

describe('DateSelect', () => {
	it('commits typed text on Enter and emits the output shape', async () => {
		const onchange = vi.fn();
		render(DateSelect, {
			variant: 'input',
			today: TODAY,
			order: 'mdy',
			name: 'due',
			output: { kind: 'pattern', pattern: 'DD.MM.YYYY' },
			onchange
		});
		const field = page.getByRole('textbox');
		await userEvent.fill(field, 'oct 15 2026');
		await userEvent.keyboard('{Enter}');
		expect(onchange).toHaveBeenCalledWith('15.10.2026', '2026-10-15');
		await expect.element(field).toHaveValue('10/15/2026');
		const hidden = document.querySelector('input[name="due"]') as HTMLInputElement;
		expect(hidden.value).toBe('15.10.2026');
	});

	it('disables days before min in the picker', async () => {
		render(DateSelect, { variant: 'picker', today: TODAY, min: TODAY, value: TODAY });
		await page.getByRole('button', { name: 'Sep 29, 2026' }).click();
		await expect.element(page.getByRole('button', { name: 'Sep 28, 2026' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Sep 30, 2026' })).toBeEnabled();
	});

	it('reports a range only once both ends are picked', async () => {
		const onrangechange = vi.fn();
		render(DateSelect, { variant: 'range', today: TODAY, onrangechange });
		await page.getByRole('button', { name: 'Sep 8, 2026' }).click();
		expect(onrangechange).not.toHaveBeenCalled();
		await page.getByRole('button', { name: 'Sep 14, 2026' }).click();
		expect(onrangechange).toHaveBeenCalledWith('2026-09-08', '2026-09-14');
	});
});
