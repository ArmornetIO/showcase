import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ViewToggle from './ViewToggle.svelte';

const OPTIONS = [{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }];

describe('ViewToggle', () => {
	it('renders all options', async () => {
		render(ViewToggle, { options: OPTIONS, value: 'list', onchange: () => {} });
		await expect.element(page.getByText('List')).toBeInTheDocument();
		await expect.element(page.getByText('Grid')).toBeInTheDocument();
	});

	it('active option has accent styling', async () => {
		render(ViewToggle, { options: OPTIONS, value: 'list', onchange: () => {} });
		await expect.element(page.getByText('List').locator('../..')).toHaveClass(/active|text-\[var\(--accent\)\]/);
	});

	it('onchange fires with selected value', async () => {
		let received: string | null = null;
		render(ViewToggle, { options: OPTIONS, value: 'list', onchange: (v) => (received = v) });
		await page.getByText('Grid').click();
		expect(received).toBe('grid');
	});
});
