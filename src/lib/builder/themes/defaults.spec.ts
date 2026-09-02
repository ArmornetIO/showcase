import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEME_DEFAULTS, isPickable, toHex } from './defaults.js';
import { COMPONENT_STYLE_SPECS, DEFAULT_SPEC, COMP_FILES, TW_RADIUS } from './specs.js';

// THEME_DEFAULTS restates tokens.css so the studio can show every palette
// at once (see defaults.ts). That duplication is only safe while something
// checks it — this is that something. It caught two real drifts on the way in:
// `--fg-muted` was #a4b0b6 here against #8a969c in tokens.css, in two themes.

const LIB = fileURLToPath(new URL('../../', import.meta.url));
const css = readFileSync(`${LIB}tokens.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Parse tokens.css into theme → token → value, with :root as the dark base. */
function parseThemes(): Record<string, Record<string, string>> {
	const out: Record<string, Record<string, string>> = {};
	const blocks = [...css.matchAll(/(:root|\[data-theme=['"]([a-z-]+)['"]\])[^{]*\{([^}]*)\}/g)]
		.map((m) => ({ name: m[2] ?? 'dark', body: m[3] }))
		.filter((b) => (b.body.match(/--[a-z0-9-]+\s*:/g) ?? []).length > 8);

	for (const b of blocks) {
		const map = (out[b.name] ??= {});
		for (const m of b.body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) map[m[1]] = m[2].trim();
	}
	// tokens.css declares shared values once on :root; themes only override.
	// Keyed off what the file actually declares, so a new palette is covered by
	// this check the moment its block lands rather than when someone remembers.
	for (const k of Object.keys(out)) {
		if (k !== 'dark') out[k] = { ...out.dark, ...out[k] };
	}
	return out;
}

const cssThemes = parseThemes();
const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, '');

function resolve(theme: string, value: string | undefined, depth = 0): string | undefined {
	if (depth > 4 || !value?.startsWith('var(')) return value;
	const ref = value.match(/var\((--[a-z0-9-]+)/)?.[1];
	return resolve(theme, ref ? cssThemes[theme]?.[ref] : undefined, depth + 1);
}

describe('THEME_DEFAULTS', () => {
	it.each(Object.keys(THEME_DEFAULTS))('matches tokens.css for the %s theme', (theme) => {
		const drift: string[] = [];

		for (const [token, studioValue] of Object.entries(THEME_DEFAULTS[theme as never])) {
			const cssValue = resolve(theme, cssThemes[theme]?.[token]);
			if (cssValue === undefined) {
				drift.push(`${token} — not declared in tokens.css`);
			} else if (normalize(cssValue) !== normalize(studioValue)) {
				drift.push(`${token} — studio "${studioValue}" vs tokens.css "${cssValue}"`);
			}
		}

		expect(drift, `Theme Studio has drifted from tokens.css:\n  ${drift.join('\n  ')}\n`).toEqual(
			[]
		);
	});
});

describe('style specs', () => {
	it('only names tokens every palette carries', () => {
		const specs = [...Object.values(COMPONENT_STYLE_SPECS), DEFAULT_SPEC].flat();
		const tokens = [...new Set(specs.filter((c) => c.type === 'color').map((c) => c.token))];
		const missing: string[] = [];

		for (const theme of Object.keys(THEME_DEFAULTS)) {
			for (const token of tokens) {
				if (!(token in THEME_DEFAULTS[theme as never])) missing.push(`${theme}: ${token}`);
			}
		}

		// A gap here renders as a grey UNKNOWN_TOKEN swatch with no explanation.
		expect(missing, `Spec tokens absent from THEME_DEFAULTS:\n  ${missing.join('\n  ')}`).toEqual(
			[]
		);
	});

	it('points COMP_FILES at files that exist', () => {
		// The generated prompt hands these paths to an agent. A stale one sends it
		// to a file that is not there, which is worse than giving it no path.
		const missing = Object.entries(COMP_FILES)
			.filter(([, rel]) => !existsSync(`${LIB}../../${rel}`))
			.map(([id, rel]) => `${id} → ${rel}`);

		expect(missing, `COMP_FILES paths that do not resolve:\n  ${missing.join('\n  ')}`).toEqual([]);
	});

	it('offers a Tailwind class for every radius the slider can produce', () => {
		// The slider is min=0 max=16 step=2; TW_RADIUS gaps fall back to an inline
		// style in the prompt, so this documents which stops are "nice" values.
		for (const stop of [0, 2, 4, 6, 8, 12, 16]) {
			expect(TW_RADIUS[stop], `radius ${stop} has no Tailwind class`).toBeTruthy();
		}
	});
});

describe('colour helpers', () => {
	it('treats only 6-digit hex as pickable', () => {
		expect(isPickable('#5eead4')).toBe(true);
		expect(isPickable('#5EEAD4')).toBe(true);
		expect(isPickable('rgba(255,255,255,0.08)')).toBe(false);
		expect(isPickable('#abc')).toBe(false);
	});

	it('converts rgb/rgba and short hex to an opaque hex preview', () => {
		expect(toHex('rgba(94,234,212,0.4)')).toBe('#5eead4');
		expect(toHex('rgb(0, 0, 0)')).toBe('#000000');
		expect(toHex('#abc')).toBe('#aabbcc');
		expect(toHex('#5eead4')).toBe('#5eead4');
	});

	it('falls back rather than throwing on values it cannot read', () => {
		expect(toHex('color-mix(in srgb, red, blue)')).toBe('#888888');
	});
});
