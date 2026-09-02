// ── backdrop/gl/strip-colors — CSS ink as shader floats ─────────────────────
//
// The palette is CUSTOM PROPERTIES, and it has to stay that way: a preset's
// vibe is half its colours, and the studio changes them by writing tokens onto
// the wrapper. A shader takes floats, so something has to read the token and
// convert — and it must be pure enough to test, because a colour parser that
// quietly returns black is indistinguishable from a strip that failed to draw.
//
// Deliberately narrow: hex, `rgb()/rgba()` and `hsl()/hsla()` in both the comma
// and the space syntax, which is every form `tokens.css` and the presets
// actually use. Anything else falls back rather than guessing.

export type Rgba = [number, number, number, number];

const HEX = /^#([0-9a-f]{3,8})$/i;

export function parseCssColor(input: string | null | undefined, fallback: Rgba): Rgba {
	const s = (input ?? '').trim().toLowerCase();
	if (!s) return fallback;
	if (s === 'transparent') return [0, 0, 0, 0];

	const hex = HEX.exec(s);
	if (hex) {
		const h = hex[1];
		const wide = h.length > 4;
		const step = wide ? 2 : 1;
		const need = wide ? 6 : 3;
		if (h.length !== need && h.length !== need + step) return fallback;
		const at = (i: number) => {
			const part = h.slice(i * step, i * step + step);
			return parseInt(wide ? part : part + part, 16) / 255;
		};
		return [at(0), at(1), at(2), h.length > need ? at(3) : 1];
	}

	const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
	if (!fn) return fallback;
	// One split for both syntaxes: CSS accepts `r, g, b, a` and `r g b / a`, and
	// the difference is punctuation rather than meaning.
	const parts = fn[2]
		.replace(/\//g, ' ')
		.split(/[\s,]+/)
		.filter(Boolean);
	if (parts.length < 3) return fallback;

	const alpha = parts.length > 3 ? channel(parts[3], 1) : 1;
	if (fn[1].startsWith('rgb')) {
		return [channel(parts[0], 255), channel(parts[1], 255), channel(parts[2], 255), alpha];
	}
	const h = (((num(parts[0]) % 360) + 360) % 360) / 360;
	const [r, g, b] = hslToRgb(h, channel(parts[1], 1), channel(parts[2], 1));
	return [r, g, b, alpha];
}

/** A component that may be written as a percentage or as a plain number, where
 *  `scale` is what a plain number is out of. */
function channel(token: string, scale: number): number {
	const v = token.endsWith('%') ? num(token) / 100 : num(token) / scale;
	return Math.min(1, Math.max(0, v));
}

function num(token: string): number {
	const v = parseFloat(token);
	return Number.isFinite(v) ? v : 0;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	if (s === 0) return [l, l, l];
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const at = (t: number) => {
		const x = (t + 1) % 1;
		if (x < 1 / 6) return p + (q - p) * 6 * x;
		if (x < 1 / 2) return q;
		if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
		return p;
	};
	return [at(h + 1 / 3), at(h), at(h - 1 / 3)];
}

/**
 * The same rotation `filter: hue-rotate()` applies — the Filter Effects
 * hueRotate matrix, in sRGB.
 *
 * Done on the CPU rather than in the shader because the angle is one value per
 * strip per frame: the rainbow sweep and a ghost pass's misregistration are
 * both uniform over the whole strip, so rotating six colours beats rotating one
 * per fragment.
 */
export function rotateHue(c: Rgba, deg: number): Rgba {
	if (!deg) return c;
	const a = (deg * Math.PI) / 180;
	const co = Math.cos(a);
	const si = Math.sin(a);
	const [r, g, b] = c;
	return [
		clamp(
			r * (0.213 + co * 0.787 - si * 0.213) +
				g * (0.715 - co * 0.715 - si * 0.715) +
				b * (0.072 - co * 0.072 + si * 0.928)
		),
		clamp(
			r * (0.213 - co * 0.213 + si * 0.143) +
				g * (0.715 + co * 0.285 + si * 0.14) +
				b * (0.072 - co * 0.072 - si * 0.283)
		),
		clamp(
			r * (0.213 - co * 0.213 - si * 0.787) +
				g * (0.715 - co * 0.715 + si * 0.715) +
				b * (0.072 + co * 0.928 + si * 0.072)
		),
		c[3]
	];
}

function clamp(v: number): number {
	return Math.min(1, Math.max(0, v));
}
