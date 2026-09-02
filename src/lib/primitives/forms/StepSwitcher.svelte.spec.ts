import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StepSwitcher from './StepSwitcher.svelte';
import type { ChoiceOption } from './choice.types.js';

const OPTIONS: ChoiceOption[] = [
	{ value: 'low', label: 'Low' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'high', label: 'High' }
];

describe('StepSwitcher', () => {
	it('renders the selected option label', async () => {
		render(StepSwitcher, { options: OPTIONS, value: 'medium', onpick: () => {} });
		await expect.element(page.getByRole('button', { name: 'Option: Medium' })).toBeInTheDocument();
	});

	it('falls back to the first option when the value is unknown', async () => {
		render(StepSwitcher, { options: OPTIONS, value: 'nope', onpick: () => {} });
		await expect.element(page.getByRole('button', { name: 'Option: Low' })).toBeInTheDocument();
	});

	it('opens the menu when the value is clicked', async () => {
		render(StepSwitcher, { options: OPTIONS, value: 'low', onpick: () => {} });
		await page.getByRole('button', { name: 'Option: Low' }).click();
		await expect.element(page.getByRole('menu')).toBeInTheDocument();
	});

	it('picks from the menu', async () => {
		let picked: string | null = null;
		render(StepSwitcher, { options: OPTIONS, value: 'low', onpick: (v) => (picked = v) });
		await page.getByRole('button', { name: 'Option: Low' }).click();
		await page.getByRole('menuitem', { name: 'High' }).click();
		expect(picked).toBe('high');
	});

	it('arrow keys step without opening the menu', async () => {
		let picked: string | null = null;
		render(StepSwitcher, { options: OPTIONS, value: 'low', onpick: (v) => (picked = v) });
		const value = page.getByRole('button', { name: 'Option: Low' });
		await value.click({ position: { x: 0, y: 0 } });
		await value.element().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
		expect(picked).toBe('medium');
	});

	// The disabled chevron is what tells a keyboard-free user they are at the end
	// of a scale — wrapping would silently jump from critical back to low.
	it('clamps at the ends when wrap is off', async () => {
		let picked: string | null = null;
		render(StepSwitcher, { options: OPTIONS, value: 'low', onpick: (v) => (picked = v) });
		const value = page.getByRole('button', { name: 'Option: Low' });
		await value.element().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
		expect(picked).toBeNull();
	});

	it('comes around at the ends when wrap is on', async () => {
		let picked: string | null = null;
		render(StepSwitcher, { options: OPTIONS, value: 'low', wrap: true, onpick: (v) => (picked = v) });
		const value = page.getByRole('button', { name: 'Option: Low' });
		await value.element().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
		expect(picked).toBe('high');
	});
});
