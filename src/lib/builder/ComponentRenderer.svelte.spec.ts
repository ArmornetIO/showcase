/**
 * Renders every placeable component through the dispatcher, with the props the
 * palette would drop it with.
 *
 * `renderer-coverage.spec.ts` proves a branch EXISTS for each id; this proves
 * the branch WORKS — that the group renderer mounts, the prop coercion survives
 * registry defaults, and nothing falls through to the unknown-component box.
 */
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ComponentRenderer from './ComponentRenderer.svelte';
import { REGISTRY, type ComponentMeta } from './registry.js';

/** The prop bag the palette hands a freshly dropped component. */
function defaults(meta: ComponentMeta): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, def] of Object.entries(meta.props)) out[k] = def.default;
	return out;
}

const placeable = REGISTRY.filter((r) => r.placeable);

describe('ComponentRenderer', () => {
	it.each(placeable.map((meta) => [meta.id, meta] as const))(
		'renders %s with registry defaults',
		async (_id, meta) => {
			const { container } = render(ComponentRenderer, {
				props: {
					componentId: meta.id,
					props: defaults(meta),
					w: meta.defaultW,
					h: meta.defaultH
				}
			});

			expect(container.textContent ?? '').not.toContain('Unknown:');
			expect(container.querySelector('.unknown')).toBeNull();
		}
	);

	it('falls back to the unknown box for an id nothing renders', async () => {
		const { container } = render(ComponentRenderer, {
			props: { componentId: 'NotAComponent', props: {}, w: 0, h: 0 }
		});

		expect(container.querySelector('.unknown')).not.toBeNull();
	});

	it('applies style overrides to the wrapper', async () => {
		const { container } = render(ComponentRenderer, {
			props: {
				componentId: 'Chip',
				props: {},
				w: 0,
				h: 0,
				styleOverrides: { '--accent': 'rgb(1, 2, 3)' }
			}
		});

		const wrapper = container.querySelector('.cr-wrapper') as HTMLElement | null;
		expect(wrapper?.getAttribute('style')).toBe('--accent:rgb(1, 2, 3)');
	});
});
