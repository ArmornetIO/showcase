import { describe, it, expect } from 'vitest';
import { parseNits, buildAIPrompt, DEFAULT_NIT_CONFIG, type Nit, type NitConfig } from './nits.js';

const nit = (over: Partial<Nit> = {}): Nit => ({
	id: '1',
	selector: 'div.card > button',
	textContent: 'Click me',
	outerHTML: '<button>Click me</button>',
	note: 'wrong color',
	url: '/vendors',
	ts: 0,
	...over
});

describe('parseNits', () => {
	it('returns [] for null / empty / garbage', () => {
		expect(parseNits(null)).toEqual([]);
		expect(parseNits('')).toEqual([]);
		expect(parseNits('not json')).toEqual([]);
		expect(parseNits('{"not":"an array"}')).toEqual([]);
	});

	it('round-trips a serialized batch', () => {
		const nits = [nit(), nit({ id: '2' })];
		expect(parseNits(JSON.stringify(nits))).toEqual(nits);
	});
});

describe('buildAIPrompt', () => {
	const config: NitConfig = { storageKey: 'k', appName: 'Armornet web app', appStack: 'Svelte 5 + SvelteKit' };

	it('returns empty string for an empty batch', () => {
		expect(buildAIPrompt([], config)).toBe('');
	});

	it('embeds the configured app name and stack (no hardcoded branding)', () => {
		const out = buildAIPrompt([nit()], config);
		expect(out).toContain('Armornet web app');
		expect(out).toContain('Svelte 5 + SvelteKit');
		const generic = buildAIPrompt([nit()], DEFAULT_NIT_CONFIG);
		expect(generic).toContain('this web app');
		expect(generic).not.toContain('Armornet');
	});

	it('uses singular vs plural for nit count', () => {
		expect(buildAIPrompt([nit()], config)).toContain('1 UI nit ');
		expect(buildAIPrompt([nit(), nit({ id: '2' })], config)).toContain('2 UI nits ');
	});

	it('escapes backticks in captured content', () => {
		const out = buildAIPrompt([nit({ textContent: 'a `code` b', outerHTML: '<i>`x`</i>' })], config);
		expect(out).not.toContain('`code`');
		expect(out).toContain("a 'code' b");
	});

	it('includes note, selector and url per nit', () => {
		const out = buildAIPrompt([nit()], config);
		expect(out).toContain('wrong color');
		expect(out).toContain('div.card > button');
		expect(out).toContain('/vendors');
	});
});
