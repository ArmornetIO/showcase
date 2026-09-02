import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Select from './Select.svelte';

const OPTIONS = [
	{ value: 'global', label: 'Global' },
	{ value: 'npm', label: 'NPM' },
	{ value: 'go', label: 'Go Modules' }
];

describe('Select', () => {
	it('renders a <select> element', async () => {
		render(Select, { options: OPTIONS });
		await expect.element(page.locator('select')).toBeInTheDocument();
	});

	it('renders caret SVG', async () => {
		render(Select, { options: OPTIONS });
		await expect.element(page.locator('svg')).toBeInTheDocument();
	});

	it('renders all options', async () => {
		render(Select, { options: OPTIONS, value: 'global' });
		const opts = page.locator('option');
		await expect.element(opts.nth(0)).toBeInTheDocument();
		await expect.element(opts.nth(2)).toBeInTheDocument();
	});

	it('renders placeholder as first disabled option', async () => {
		render(Select, { options: OPTIONS, placeholder: 'Choose scope…', value: '' });
		const first = page.locator('option').nth(0);
		await expect.element(first).toHaveTextContent('Choose scope…');
		await expect.element(first).toBeDisabled();
	});

	it('disabled state applied', async () => {
		render(Select, { options: OPTIONS, disabled: true });
		await expect.element(page.locator('select')).toBeDisabled();
	});

	it('renders optgroups', async () => {
		render(Select, {
			groups: [
				{ group: 'A', options: [{ value: 'a1', label: 'A1' }] },
				{ group: 'B', options: [{ value: 'b1', label: 'B1' }] }
			]
		});
		await expect.element(page.locator('optgroup').nth(0)).toBeInTheDocument();
		await expect.element(page.locator('optgroup').nth(1)).toBeInTheDocument();
	});
});
