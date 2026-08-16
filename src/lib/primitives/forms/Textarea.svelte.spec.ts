import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Textarea from './Textarea.svelte';

describe('Textarea', () => {
	it('renders a <textarea> element', async () => {
		render(Textarea, {});
		await expect.element(page.locator('textarea')).toBeInTheDocument();
	});

	it('font-size is at least 16px (prevents iOS zoom)', async () => {
		render(Textarea, {});
		const el = page.locator('textarea').element() as HTMLTextAreaElement;
		const fs = parseFloat(getComputedStyle(el).fontSize);
		expect(fs).toBeGreaterThanOrEqual(16);
	});

	it('disabled state applied', async () => {
		render(Textarea, { disabled: true });
		await expect.element(page.locator('textarea')).toBeDisabled();
	});
});
