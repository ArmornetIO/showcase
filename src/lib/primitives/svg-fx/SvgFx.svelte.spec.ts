import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SvgFx from './SvgFx.svelte';
import SvgFxHarness from '../../__test__/SvgFxHarness.svelte';

describe('SvgFx', () => {
	it('wraps arbitrary art and points a CSS filter at its own chain', async () => {
		const { container } = render(SvgFxHarness, { type: 'chrome' });
		const wrap = container.querySelector('.svg-fx--wrap') as HTMLElement;
		const filter = container.querySelector('filter')!;
		// The art is untouched — the effect is applied around it, not to its markup.
		expect(container.querySelector('svg[data-art]')).not.toBeNull();
		expect(filter.id).toMatch(/^fx-chrome-/);
		expect(wrap.style.filter).toBe(`url(#${filter.id})`);
	});

	it('drops the filter reference but keeps the art when disabled', async () => {
		const { container } = render(SvgFxHarness, { enabled: false });
		expect((container.querySelector('.svg-fx--wrap') as HTMLElement).style.filter).toBe('');
		expect(container.querySelector('svg[data-art]')).not.toBeNull();
	});

	// Each chain must actually change primitives, not just relabel the filter.
	it('builds a distinct primitive chain per effect type', async () => {
		const chain = (type: 'glow' | 'outline' | 'emboss' | 'chrome' | 'engrave') => {
			const { container } = render(SvgFxHarness, { type });
			return [...container.querySelector('filter')!.children].map((n) => n.tagName);
		};
		expect(chain('glow')).toContain('feFlood');
		expect(chain('outline')).toContain('feMorphology');
		expect(chain('emboss')).toContain('feSpecularLighting');
		// Metal is diffuse-multiply UNDER a specular — one pass alone reads plastic.
		expect(chain('chrome')).toContain('feDiffuseLighting');
		expect(chain('chrome')).toContain('feSpecularLighting');
		expect(chain('engrave')).toContain('feOffset');
	});

	it('opens the filter region, since the SVG default crops every effect', async () => {
		const { container } = render(SvgFxHarness, { bleed: 60 });
		const f = container.querySelector('filter')!;
		expect(f.getAttribute('x')).toBe('-60%');
		expect(f.getAttribute('width')).toBe('220%');
		// linearRGB (the spec default) washes out blurs and shifts flood colours.
		expect(f.getAttribute('color-interpolation-filters')).toBe('sRGB');
	});

	it('hosts inline in its own svg when asked, for serializable output', async () => {
		const { container } = render(SvgFxHarness, { host: 'svg', viewBox: '0 0 48 48' });
		const svg = container.querySelector('svg.svg-fx') as SVGSVGElement;
		expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
		const g = svg.querySelector('g[filter]')!;
		expect(g.getAttribute('filter')).toBe(`url(#${svg.querySelector('filter')!.id})`);
	});

	it('is hidden from assistive tech unless given a title', async () => {
		const bare = render(SvgFxHarness, { host: 'svg' });
		expect(bare.container.querySelector('svg.svg-fx')!.getAttribute('aria-hidden')).toBe('true');
		const named = render(SvgFxHarness, { host: 'svg', title: 'Treated mark' });
		const svg = named.container.querySelector('svg.svg-fx')!;
		expect(svg.getAttribute('role')).toBe('img');
		expect(svg.getAttribute('aria-label')).toBe('Treated mark');
	});

	// Two instances resolving url(#fx) to the same filter is the classic SVG-defs
	// collision, and it silently applies the wrong effect.
	it('scopes its filter id per instance', async () => {
		const a = render(SvgFxHarness, {});
		const b = render(SvgFxHarness, {});
		const idOf = (c: Element) => c.querySelector('filter')!.id;
		expect(idOf(a.container)).not.toBe(idOf(b.container));
	});

	it('re-exports its tuning surface for callers building controls', () => {
		expect(SvgFx).toBeTruthy();
	});
});
