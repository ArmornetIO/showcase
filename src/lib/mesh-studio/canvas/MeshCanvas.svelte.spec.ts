import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MeshCanvas from './MeshCanvas.svelte';
import type { StudioNode } from '../studio.types.js';

// Two agents per area plus the crest — enough that a territory has an inside and
// an outside, which is the only thing clustering can be judged on.
const AREAS: Record<string, string> = {
	'dev-1': 'develop',
	'dev-2': 'develop',
	'build-1': 'build',
	'build-2': 'build',
	'run-1': 'runtime',
	'run-2': 'runtime'
};

const NODES: StudioNode[] = [
	{ id: 'hub', type: 'control-plane', state: 'healthy', label: 'Core', x: 0, y: 0, r: 42 },
	...Object.keys(AREAS).map((id) => ({
		id,
		type: 'proxy' as const,
		state: 'healthy' as const,
		label: id,
		x: 0,
		y: 0,
		r: 22
	}))
];

const NAMES: Record<string, { name: string; color: string }> = {
	develop: { name: 'Development', color: '#34D399' },
	build: { name: 'Build & Registry', color: '#38BDF8' },
	runtime: { name: 'Runtime & Network', color: '#818CF8' }
};

const base = {
	nodes: NODES,
	hubId: 'hub',
	groupKeyOf: (n: StudioNode) => AREAS[n.id] ?? 'runtime',
	territoryOf: (k: string) => NAMES[k] ?? null
};

describe('MeshCanvas territories', () => {
	it('names each region on the globe once territories are on', async () => {
		render(MeshCanvas, { ...base, layout: 'globe', globeTerritories: true });

		// Names are drawn on the rim of every region whose centre faces the viewer.
		// At rest that is never all three, so assert the set is non-empty and that
		// whatever is shown is a real territory rather than a group key.
		const shown = await page
			.getByText(/DEVELOPMENT|BUILD & REGISTRY|RUNTIME & NETWORK/)
			.elements();
		expect(shown.length).toBeGreaterThan(0);
	});

	it('draws no captions when the globe is sown evenly', async () => {
		// Same data, clustering off — the nodes still have group keys, but without
		// territories there are no regions to name.
		render(MeshCanvas, { ...base, layout: 'globe' });
		await expect.element(page.getByText('DEVELOPMENT')).not.toBeInTheDocument();
	});

	it('drops the captions when the arrangement leaves the globe', async () => {
		// A planar layout groups by proximity on its own; caps are a property of the
		// sphere, so they must not survive the switch.
		render(MeshCanvas, { ...base, layout: 'grouped', globeTerritories: true });
		await expect.element(page.getByText('DEVELOPMENT')).not.toBeInTheDocument();
	});
});
