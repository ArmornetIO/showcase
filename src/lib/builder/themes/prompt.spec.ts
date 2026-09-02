import { describe, it, expect } from 'vitest';
import type { ComponentMeta } from '../registry.js';
import { buildPrompt, changedProps } from './prompt.js';
import type { ColorControl } from './types.js';

// The prompt IS this tool's product — it is what gets pasted into an agent. So
// its exact text is worth asserting, not just its shape.

const META: ComponentMeta = {
	id: 'Button',
	label: 'Button',
	category: 'Primitives',
	defaultW: 0,
	defaultH: 0,
	resizable: false,
	placeable: true,
	props: {
		variant: { kind: 'enum', label: 'Variant', default: 'ghost', options: ['ghost', 'primary'] },
		disabled: { kind: 'boolean', label: 'Disabled', default: false }
	}
};

const CONTROLS: ColorControl[] = [{ type: 'color', label: 'Accent color', token: '--accent' }];

const base = {
	meta: META,
	componentId: 'Button',
	overrides: {},
	defaults: { '--accent': '#5eead4' },
	controls: CONTROLS,
	borderRadius: null,
	props: { variant: 'ghost', disabled: false },
	date: '2026-01-01'
};

describe('changedProps', () => {
	it('reports only values differing from the registry default', () => {
		expect(changedProps(META, { variant: 'ghost', disabled: false })).toEqual([]);
		expect(changedProps(META, { variant: 'primary', disabled: false })).toEqual([
			['variant', 'primary']
		]);
	});

	it('is empty without a component', () => {
		expect(changedProps(null, { variant: 'primary' })).toEqual([]);
	});
});

describe('buildPrompt', () => {
	it('says there is nothing to do when nothing changed', () => {
		const out = buildPrompt(base);
		expect(out).toContain('No changes yet.');
		expect(out).not.toContain('```css');
	});

	it('names the token by what it does and records what it replaced', () => {
		const out = buildPrompt({ ...base, overrides: { '--accent': '#ff0000' } });
		expect(out).toContain('--accent: #ff0000; /* Accent color — was: #5eead4 */');
	});

	it('points at the real source file', () => {
		const out = buildPrompt({ ...base, overrides: { '--accent': '#ff0000' } });
		expect(out).toContain('showcase/src/lib/primitives/actions/Button.svelte');
	});

	it('falls back to a glob for a component with no mapped file', () => {
		const out = buildPrompt({
			...base,
			componentId: 'Unmapped',
			meta: { ...META, id: 'Unmapped', label: 'Unmapped' },
			overrides: { '--accent': '#ff0000' }
		});
		expect(out).toContain('src/lib/**/Unmapped.svelte');
	});

	it('translates a radius to its Tailwind class', () => {
		const out = buildPrompt({ ...base, borderRadius: 8 });
		expect(out).toContain('replace `rounded-*` classes with `rounded-lg`');
	});

	it('falls back to an inline style for an off-scale radius', () => {
		const out = buildPrompt({ ...base, borderRadius: 10 });
		expect(out).toContain('style="border-radius:10px"');
	});

	it('lists changed props with their defaults', () => {
		const out = buildPrompt({ ...base, props: { variant: 'primary', disabled: false } });
		expect(out).toContain('variant="primary"  // Variant · default: "ghost"');
		expect(out).not.toContain('disabled=');
	});

	it('is deterministic given a date', () => {
		expect(buildPrompt(base)).toBe(buildPrompt(base));
		expect(buildPrompt(base)).toContain('# Component Style — 2026-01-01 · Button');
	});

	it('never emits a literal closing style tag that would break the host page', () => {
		const out = buildPrompt({ ...base, overrides: { '--accent': '#ff0000' } });
		expect(out).toContain('<style> block');
	});
});
