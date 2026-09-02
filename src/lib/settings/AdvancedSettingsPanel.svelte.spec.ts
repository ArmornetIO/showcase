import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AdvancedSettingsPanel from './AdvancedSettingsPanel.svelte';
import { advancedSettings } from './store.svelte.js';

describe('AdvancedSettingsPanel', () => {
	it('opens on the theme group', async () => {
		render(AdvancedSettingsPanel);
		await expect.element(page.getByText('Palette')).toBeInTheDocument();
	});

	it('shows one group at a time', async () => {
		render(AdvancedSettingsPanel);
		// The rail's own buttons are the only thing that swaps the pane; the point
		// of the panel is that the other groups' controls are NOT in the document.
		await expect.element(page.getByText('Radius')).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Corners', exact: true }).click();
		await expect.element(page.getByText('Radius')).toBeInTheDocument();
		await expect.element(page.getByText('Palette')).not.toBeInTheDocument();
	});

	it('writes the store when a value is picked', async () => {
		render(AdvancedSettingsPanel);
		await page.getByRole('button', { name: 'Side nav', exact: true }).click();
		// The right chevron steps to the neighbouring value — plain → graph.
		const stepper = page.getByRole('group', { name: 'Side nav' });
		await stepper.getByRole('button').last().click();
		expect(advancedSettings.navStyle).toBe('graph');
		advancedSettings.reset();
	});
});
