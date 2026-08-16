import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ActionBar from './ActionBar.svelte';

describe('ActionBar', () => {
	it('renders each action as a button', async () => {
		const actions = [
			{ label: 'Save', onclick: () => {} },
			{ label: 'Cancel', onclick: () => {} }
		];
		render(ActionBar, { actions });
		await expect.element(page.getByText('Save')).toBeInTheDocument();
		await expect.element(page.getByText('Cancel')).toBeInTheDocument();
	});

	it('action onclick fires', async () => {
		let fired = false;
		render(ActionBar, { actions: [{ label: 'Go', onclick: () => (fired = true) }] });
		await page.getByText('Go').click();
		expect(fired).toBe(true);
	});
});
