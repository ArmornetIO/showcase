import { page } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Select from './Select.svelte';

const OPTIONS = [
	{ value: 'global', label: 'Global' },
	{ value: 'npm', label: 'NPM' },
	{ value: 'go', label: 'Go Modules' }
];

describe('Select', () => {
	it('shows the selected label on the trigger, with the panel closed', async () => {
		render(Select, { options: OPTIONS, value: 'npm', label: 'Scope' });
		await expect.element(page.getByRole('button', { name: 'Scope' })).toHaveTextContent('NPM');
		expect(page.getByRole('menu').elements()).toHaveLength(0);
	});

	it('shows the placeholder when nothing is selected', async () => {
		render(Select, { options: OPTIONS, placeholder: 'Choose scope…', value: '', label: 'Scope' });
		await expect
			.element(page.getByRole('button', { name: 'Scope' }))
			.toHaveTextContent('Choose scope…');
	});

	it('opens on click, marks the current option and fires onchange with the value', async () => {
		const onchange = vi.fn();
		render(Select, { options: OPTIONS, value: 'global', label: 'Scope', onchange });
		await page.getByRole('button', { name: 'Scope' }).click();
		await expect
			.element(page.getByRole('menuitemradio', { name: 'Global' }))
			.toHaveAttribute('aria-checked', 'true');
		await page.getByRole('menuitemradio', { name: 'Go Modules' }).click();
		expect(onchange).toHaveBeenCalledWith('go');
		expect(page.getByRole('menu').elements()).toHaveLength(0);
	});

	it('does not fire onchange when the current option is picked again', async () => {
		const onchange = vi.fn();
		render(Select, { options: OPTIONS, value: 'npm', label: 'Scope', onchange });
		await page.getByRole('button', { name: 'Scope' }).click();
		await page.getByRole('menuitemradio', { name: 'NPM' }).click();
		expect(onchange).not.toHaveBeenCalled();
	});

	it('does not open when disabled', async () => {
		render(Select, { options: OPTIONS, disabled: true, label: 'Scope' });
		await expect.element(page.getByRole('button', { name: 'Scope' })).toBeDisabled();
	});

	it('renders groups as headers above their options', async () => {
		render(Select, {
			label: 'Pick',
			groups: [
				{ group: 'A', options: [{ value: 'a1', label: 'A1' }] },
				{ group: 'B', options: [{ value: 'b1', label: 'B1' }] }
			]
		});
		await page.getByRole('button', { name: 'Pick' }).click();
		await expect.element(page.getByText('A', { exact: true })).toBeInTheDocument();
		expect(page.getByRole('menuitemradio').elements()).toHaveLength(2);
	});

	it('multiple: toggles values, stays open, and shows chips', async () => {
		const onvalues = vi.fn();
		render(Select, { options: OPTIONS, multiple: true, values: ['npm'], label: 'Scope', onvalues });
		await page.getByRole('button', { name: 'Scope' }).click();
		await page.getByRole('menuitemcheckbox', { name: 'Go Modules' }).click();
		expect(onvalues).toHaveBeenLastCalledWith(['npm', 'go']);
		await expect.element(page.getByRole('menu')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Remove Go Modules' })).toBeInTheDocument();
	});

	it('multiple: a chip removes its value', async () => {
		const onvalues = vi.fn();
		render(Select, { options: OPTIONS, multiple: true, values: ['npm', 'go'], onvalues });
		await page.getByRole('button', { name: 'Remove NPM' }).click();
		expect(onvalues).toHaveBeenLastCalledWith(['go']);
	});

	it('searchable: typing filters the rows and Enter takes the best match', async () => {
		const onchange = vi.fn();
		render(Select, { options: OPTIONS, searchable: true, label: 'Scope', onchange });
		const input = page.getByRole('combobox', { name: 'Scope' });
		await input.fill('go');
		expect(page.getByRole('menuitemradio').elements()).toHaveLength(1);
		await input.press('Enter');
		expect(onchange).toHaveBeenCalledWith('go');
	});

	it('creatable: offers the typed text when nothing matches', async () => {
		const onvalues = vi.fn();
		render(Select, { options: OPTIONS, multiple: true, creatable: true, label: 'Scope', onvalues });
		const input = page.getByRole('combobox', { name: 'Scope' });
		await input.fill('crates');
		await expect.element(page.getByText('Add "crates"')).toBeInTheDocument();
		await input.press('Enter');
		expect(onvalues).toHaveBeenLastCalledWith(['crates']);
	});

	it('submits the value with a form via a hidden input', async () => {
		const { container } = render(Select, { options: OPTIONS, value: 'go', name: 'scope' });
		const input = container.querySelector<HTMLInputElement>('input[type=hidden][name=scope]');
		expect(input?.value).toBe('go');
	});
});
