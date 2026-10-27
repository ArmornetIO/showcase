import { page, userEvent } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ChipInput from './ChipInput.svelte';

const chipTexts = () =>
	Array.from(document.querySelectorAll('.chip-item')).map((el) => el.textContent?.replace(/[×\d\s]/g, ''));

describe('ChipInput', () => {
	it('adds a chip on Enter', async () => {
		render(ChipInput, { value: [] });
		await page.getByRole('textbox').fill('prod');
		await userEvent.keyboard('{Enter}');
		expect(chipTexts()).toEqual(['prod']);
	});

	it('numbers chips only when sortable — the order is the meaning', () => {
		render(ChipInput, { value: ['a', 'b'], sortable: true });
		expect(Array.from(document.querySelectorAll('.chip-ord')).map((el) => el.textContent)).toEqual(['1', '2']);
	});

	it('moves a focused chip with Alt+arrow and keeps focus for the next press', async () => {
		render(ChipInput, { value: ['upn', 'name', 'mail'], sortable: true });
		(document.querySelectorAll('.chip-item')[2] as HTMLElement).focus();
		await userEvent.keyboard('{Alt>}{ArrowLeft}{ArrowLeft}{/Alt}');
		expect(chipTexts()).toEqual(['mail', 'upn', 'name']);
	});

	it('is not reorderable when disabled', () => {
		render(ChipInput, { value: ['a', 'b'], sortable: true, disabled: true });
		expect(document.querySelector('[draggable="true"]')).toBeNull();
	});
});
