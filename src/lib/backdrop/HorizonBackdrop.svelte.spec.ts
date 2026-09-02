import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HorizonBackdrop from './HorizonBackdrop.svelte';
import { PRESET_IDS, resolvePreset } from './presets.js';

// The backdrop is decoration, so there is nothing to assert about its content.
// What IS worth locking down is the contract the builder and the app shell now
// depend on: that a preset name resolves to strips, that the count is what the
// composition says, and that the palette a vibe carries is applied to the
// component's own wrapper rather than escaping to :root.

describe('HorizonBackdrop', () => {
	it('renders a strip per spec for a named preset', async () => {
		const { container } = render(HorizonBackdrop, { preset: 'mr robot' });
		const expected = resolvePreset('mr robot').strips.length;
		expect(container.querySelectorAll('.strip-host')).toHaveLength(expected);
	});

	it('draws the two floor planes', async () => {
		const { container } = render(HorizonBackdrop, { preset: 'mr robot' });
		expect(container.querySelectorAll('.plane')).toHaveLength(2);
	});

	it('scopes a preset palette to its own wrapper, not :root', async () => {
		const { container } = render(HorizonBackdrop, { preset: 'spider-verse' });
		const root = container.querySelector('.backdrop') as HTMLElement;
		// The vibe's own strip colour, on the element — and nowhere else.
		expect(root.style.getPropertyValue('--backdrop-strip')).not.toBe('');
		expect(document.documentElement.style.getPropertyValue('--backdrop-strip')).toBe('');
	});

	it('draws a ghost pass only for presets that ask for one', async () => {
		const withGhost = render(HorizonBackdrop, { preset: 'spider-verse' });
		expect(withGhost.container.querySelectorAll('.strip-host.ghost').length).toBeGreaterThan(0);

		const without = render(HorizonBackdrop, { preset: 'mr robot' });
		expect(without.container.querySelectorAll('.strip-host.ghost')).toHaveLength(0);
	});

	it('lets an explicit strips array win over a preset', async () => {
		const one = resolvePreset('mr robot').strips.slice(0, 1);
		const { container } = render(HorizonBackdrop, { preset: 'spider-verse', strips: one });
		// spider-verse has five strips and a ghost pass; the array has one and none.
		expect(container.querySelectorAll('.strip-host')).toHaveLength(1);
	});

	it('every registered preset resolves to at least one strip', () => {
		for (const id of PRESET_IDS) {
			expect(resolvePreset(id).strips.length).toBeGreaterThan(0);
		}
	});
});
