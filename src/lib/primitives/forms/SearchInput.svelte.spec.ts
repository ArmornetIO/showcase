import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SearchInput from './SearchInput.svelte';

describe('SearchInput', () => {
	it('renders an input with search semantics', async () => {
		render(SearchInput, {});
		await expect.element(page.locator('input')).toBeInTheDocument();
	});

	it('font-size is at least 16px (prevents iOS zoom)', async () => {
		render(SearchInput, {});
		const input = page.locator('input').element() as HTMLInputElement;
		const fs = parseFloat(getComputedStyle(input).fontSize);
		expect(fs).toBeGreaterThanOrEqual(16);
	});
});
