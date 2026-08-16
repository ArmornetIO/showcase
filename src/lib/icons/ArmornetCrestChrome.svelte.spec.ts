import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ArmornetCrestChrome from './ArmornetCrestChrome.svelte';

describe('ArmornetCrestChrome', () => {
	it('renders a labelled svg at the requested size', async () => {
		render(ArmornetCrestChrome, { size: 192 });
		const svg = page.locator('svg[role="img"]');
		await expect.element(svg).toBeInTheDocument();
		await expect.element(svg).toHaveAttribute('width', '192');
		await expect.element(svg).toHaveAccessibleName('Armornet');
	});

	// Each of these is a prop the showcase rig drives from a switch, so each one
	// has to actually drop its geometry — not just fade to something invisible.
	it('drops the traces, the rim and the cast shadow when turned off', async () => {
		const { container } = render(ArmornetCrestChrome, {
			traces: false,
			rim: false,
			emboss: false
		});
		expect(container.querySelector('[stroke="#12726c"]')).toBeNull();
		expect(container.querySelector('[stroke-width="1.1"]')).toBeNull();
		expect(container.querySelector('g[filter]')).toBeNull();
	});

	it('drops every bloom layer at glow=false and at bloom=0', async () => {
		for (const props of [{ glow: false }, { bloom: 0 }]) {
			const { container } = render(ArmornetCrestChrome, props);
			expect(container.querySelector('ellipse')).toBeNull();
			expect(container.querySelector('g[filter*="soft"]')).toBeNull();
		}
	});

	it('adds wall struts only when tethered', async () => {
		const off = render(ArmornetCrestChrome, {});
		const on = render(ArmornetCrestChrome, { tethers: true });
		expect(off.container.querySelector('[fill*="strut"]')).toBeNull();
		// five joints, five struts
		expect(on.container.querySelectorAll('[fill*="strut"]')).toHaveLength(5);
	});

	// Breakout pushes the apex past y=0, so the box has to grow with it or the
	// bloom gets guillotined. The shield must NOT move at breakout 0.
	it('grows viewBox headroom with breakout and leaves it alone at 0', async () => {
		const at0 = render(ArmornetCrestChrome, { breakout: 0 });
		const at1 = render(ArmornetCrestChrome, { breakout: 1 });
		const vb = (c: Element) => c.querySelector('svg')!.getAttribute('viewBox');
		expect(vb(at0.container)).toBe('0 0 200 220');
		expect(vb(at1.container)).toBe('0 -16 200 236');
	});

	// The defs are id-referenced, so two crests on a page must not collide.
	it('scopes its gradient ids per instance', async () => {
		const a = render(ArmornetCrestChrome, {});
		const b = render(ArmornetCrestChrome, {});
		const firstGradient = (c: Element) => c.querySelector('linearGradient')!.id;
		expect(firstGradient(a.container)).not.toBe(firstGradient(b.container));
	});
});
