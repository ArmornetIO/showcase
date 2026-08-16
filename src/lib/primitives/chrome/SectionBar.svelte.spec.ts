import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SectionBar from './SectionBar.svelte';

describe('SectionBar', () => {
	it('renders the label', async () => {
		render(SectionBar, { label: 'OVERVIEW' });
		await expect.element(page.getByText('OVERVIEW')).toBeInTheDocument();
	});

	it('includes a decorative line element', async () => {
		render(SectionBar, { label: 'OVERVIEW' });
		const children = page.locator('div > span');
		expect(await children.count()).toBeGreaterThanOrEqual(2);
	});
});
