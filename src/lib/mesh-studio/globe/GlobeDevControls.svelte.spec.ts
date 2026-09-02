import { page } from 'vitest/browser';
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GlobeDevControls from './GlobeDevControls.svelte';
import { globeRegistry, registerGlobe } from '../../physics/globeRegistry.svelte.js';

const REST = { yaw: 0, pitch: 0, viewDistance: 2.6 };

afterEach(() => {
	globeRegistry.globes.splice(0, globeRegistry.globes.length);
});

describe('GlobeDevControls', () => {
	it('renders nothing until a globe registers, then reacts across modules', async () => {
		render(GlobeDevControls);
		// No globe present → the panel is empty.
		await expect.element(page.getByText('Test Globe')).not.toBeInTheDocument();

		// A globe registers, exactly as a MeshCanvas does on mount.
		const unregister = registerGlobe({
			id: 'test-globe',
			label: 'Test Globe',
			rest: REST,
			play: () => {},
			cancel: () => {}
		});

		// The registry mutation must drive this component to show the globe.
		await expect.element(page.getByText('Test Globe')).toBeInTheDocument();

		// Unregistering hides it again.
		unregister();
		await expect.element(page.getByText('Test Globe')).not.toBeInTheDocument();
	});

	it('play button drives the registered handle', async () => {
		let played = 0;
		render(GlobeDevControls);
		registerGlobe({
			id: 'g2',
			label: 'G2',
			rest: REST,
			play: () => (played += 1),
			cancel: () => {}
		});
		await page.getByRole('button', { name: /Play intro/ }).click();
		expect(played).toBe(1);
	});
});
