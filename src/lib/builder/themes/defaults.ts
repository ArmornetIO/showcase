import type { ThemeKey } from '$lib/theme/themes.js';
import type { TokenMap } from './types.js';

/**
 * Theme palettes, applied imperatively to the preview element so the preview is
 * self-contained regardless of which theme the surrounding page is using — the
 * studio must be able to show you the light palette while you sit in dark.
 *
 * These values DUPLICATE tokens.css, which is a liability: it drifted twice
 * before anyone noticed (`--fg-muted` was two shades light in dark and oled).
 * They are not derived at runtime because the studio needs all four palettes at
 * once, and `getComputedStyle` only ever resolves the one theme the document is
 * actually in — probing the other three would mean mounting hidden `data-theme`
 * elements and reading them back before first paint.
 *
 * The duplication is instead made safe by `defaults.spec.ts`, which parses
 * tokens.css and fails when any value here disagrees. Change a colour in
 * tokens.css and that test tells you to change it here too.
 */
export const THEME_DEFAULTS: Record<ThemeKey, TokenMap> = {
	dark: {
		'--bg': '#06070b',
		'--bg-elev': '#0a0b10',
		'--fg': '#e5edf0',
		'--fg-muted': '#8a969c',
		'--fg-dim': '#6c777e',
		'--accent': '#5eead4',
		'--accent-bright': '#7af0d8',
		'--accent-deep': '#04221f',
		'--accent-faint': 'rgba(94,234,212,0.06)',
		'--accent-faint-strong': 'rgba(94,234,212,0.12)',
		'--accent-glow': 'rgba(94,234,212,0.4)',
		'--border': 'rgba(255,255,255,0.08)',
		'--border-strong': 'rgba(255,255,255,0.14)',
		'--border-accent': 'rgba(94,234,212,0.2)',
		'--surface-raised': 'rgba(255,255,255,0.018)',
		'--surface-strong': 'rgba(255,255,255,0.025)',
		'--input-bg': 'rgba(0,0,0,0.25)',
		'--btn-primary-fg': '#04221f'
	},
	light: {
		'--bg': '#f7f8fa',
		'--bg-elev': '#eef0f4',
		'--fg': '#0d1417',
		'--fg-muted': '#475259',
		'--fg-dim': '#6b757b',
		'--accent': '#0e7868',
		'--accent-bright': '#0a8978',
		'--accent-deep': '#e9faf7',
		'--accent-faint': 'rgba(14,120,104,0.06)',
		'--accent-faint-strong': 'rgba(14,120,104,0.12)',
		'--accent-glow': 'rgba(14,120,104,0.25)',
		'--border': 'rgba(13,20,23,0.1)',
		'--border-strong': 'rgba(13,20,23,0.18)',
		'--border-accent': 'rgba(14,120,104,0.2)',
		'--surface-raised': 'rgba(13,20,23,0.025)',
		'--surface-strong': 'rgba(13,20,23,0.04)',
		'--input-bg': '#ffffff',
		'--btn-primary-fg': '#ffffff'
	},
	oled: {
		'--bg': '#000000',
		'--bg-elev': '#050505',
		'--fg': '#e5edf0',
		'--fg-muted': '#8a969c',
		'--fg-dim': '#6c777e',
		'--accent': '#5eead4',
		'--accent-bright': '#7af0d8',
		'--accent-deep': '#04221f',
		'--accent-faint': 'rgba(94,234,212,0.06)',
		'--accent-faint-strong': 'rgba(94,234,212,0.12)',
		'--accent-glow': 'rgba(94,234,212,0.4)',
		'--border': 'rgba(255,255,255,0.08)',
		'--border-strong': 'rgba(255,255,255,0.14)',
		'--border-accent': 'rgba(94,234,212,0.2)',
		'--surface-raised': 'rgba(255,255,255,0.03)',
		'--surface-strong': 'rgba(255,255,255,0.05)',
		'--input-bg': 'rgba(0,0,0,0.6)',
		'--btn-primary-fg': '#04221f'
	},
	'high-contrast': {
		'--bg': '#000000',
		'--bg-elev': '#000000',
		'--fg': '#ffffff',
		'--fg-muted': '#ffffff',
		'--fg-dim': '#cccccc',
		'--accent': '#ffff00',
		'--accent-bright': '#ffff66',
		'--accent-deep': '#000000',
		'--accent-faint': 'rgba(255,255,0,0.12)',
		'--accent-faint-strong': 'rgba(255,255,0,0.2)',
		'--accent-glow': 'rgba(255,255,0,0.6)',
		'--border': '#ffffff',
		'--border-strong': '#ffffff',
		'--border-accent': '#ffff00',
		'--surface-raised': '#000000',
		'--surface-strong': '#0a0a0a',
		'--input-bg': '#000000',
		'--btn-primary-fg': '#000000'
	}
};

/** Fallback shown when a spec names a token no palette carries. `specs.spec.ts`
 *  asserts this never happens, so seeing grey in the UI means a spec drifted. */
export const UNKNOWN_TOKEN = '#888888';

export function defaultFor(theme: ThemeKey, token: string): string {
	return THEME_DEFAULTS[theme][token] ?? UNKNOWN_TOKEN;
}

/**
 * `<input type="color">` only speaks 7-character hex. Tokens like `--border`
 * and `--input-bg` are `rgba()`, so the picker cannot represent them and,
 * worse, silently returns an opaque hex that discards the alpha.
 * `isPickable` lets the UI tell the honest story instead of pretending.
 */
export function isPickable(value: string): boolean {
	return /^#[0-9a-f]{6}$/i.test(value.trim());
}

/** Best-effort opaque preview of any colour, for the picker's initial value. */
export function toHex(value: string): string {
	const v = value.trim();
	if (isPickable(v)) return v;
	if (/^#[0-9a-f]{3}$/i.test(v)) {
		return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
	}
	const rgb = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
	if (rgb) {
		const hex = (n: string) =>
			Math.max(0, Math.min(255, Math.round(Number(n))))
				.toString(16)
				.padStart(2, '0');
		return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
	}
	return UNKNOWN_TOKEN;
}
