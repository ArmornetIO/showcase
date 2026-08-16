import { page } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Checkbox from './Checkbox.svelte';

const box = () => page.locator('input[type="checkbox"]').element() as HTMLInputElement;

describe('Checkbox', () => {
	it('renders its label snippet', async () => {
		render(Checkbox, { children: () => 'HEALTHY' });
		await expect.element(page.getByText('HEALTHY')).toBeInTheDocument();
	});

	it('reflects checked', () => {
		render(Checkbox, { checked: true, children: () => 'on' });
		expect(box().checked).toBe(true);
	});

	it('fires onchange when clicked', async () => {
		const onchange = vi.fn();
		render(Checkbox, { onchange, children: () => 'click me' });
		await page.getByText('click me').click();
		expect(onchange).toHaveBeenCalledTimes(1);
	});

	it('stays silent while disabled — the box must not act when it says it cannot', async () => {
		const onchange = vi.fn();
		render(Checkbox, { disabled: true, onchange, children: () => 'nope' });
		expect(box().disabled).toBe(true);
		expect(onchange).not.toHaveBeenCalled();
	});

	it('sets indeterminate, which has no HTML attribute and must be set as a property', () => {
		render(Checkbox, { indeterminate: true, children: () => 'partial' });
		expect(box().indeterminate).toBe(true);
	});

	it('is not indeterminate by default', () => {
		render(Checkbox, { children: () => 'plain' });
		expect(box().indeterminate).toBe(false);
	});

	it('renders without a label', () => {
		expect(() => render(Checkbox, {})).not.toThrow();
	});

	it('hides the native input, so the styled box is what is seen', () => {
		render(Checkbox, { children: () => 'x' });
		expect(getComputedStyle(box()).opacity).toBe('0');
	});
});
