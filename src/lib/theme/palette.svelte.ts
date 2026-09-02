/**
 * The mesh's colour seam.
 *
 * Territories, agent modes and the membrane were all painted from raw hex —
 * `#6EE7B7`, `#818CF8`, `#FB923C` — spread across a dozen files and, for the
 * modes, arriving from Go through a GENERATED file nobody may hand-edit. Every
 * one of those literals is a Tailwind 300/400 step, i.e. a palette chosen
 * against a black ground, so in a light theme the globe turned into pastel
 * smears with unreadable labels. No theme could reach them: they were values,
 * not names.
 *
 * This module is the boundary that turns a value back into a name. `ink` takes
 * any of those literals and answers with the current theme's step for that HUE
 * — the identity a mode or region carries is "violet", and violet is `#C4B5FD`
 * on black and `#7C3AED` on paper.
 *
 * It resolves to a concrete colour string rather than handing back
 * `var(--palette-violet)`, because most of these consumers are `ctx.strokeStyle`
 * and WebGL uniforms, where a `var()` is not a colour. SVG attributes accept
 * either, so they go through here too and there is one rule instead of two.
 *
 * Anything it does not recognise passes through untouched. That is deliberate:
 * the map covers the categorical hues, and the structural colours mixed in with
 * them (`#0A0A0A` chassis, `#FFFFFF`, the neutral scale) are meant to stay put
 * in every theme, exactly like `--terminal-*`.
 */

/** Legacy literal → the palette token carrying that hue. Lower-case keys; the
 *  same hue at two tints maps to the base and its `-l` lift respectively. */
const TOKEN_OF: Readonly<Record<string, string>> = {
	'#22d3ee': '--palette-cyan',
	'#67e8f9': '--palette-cyan-l',
	'#5fead5': '--palette-teal',
	'#5eead4': '--palette-teal',
	'#7fe3f0': '--palette-teal-l',
	'#34d399': '--palette-emerald',
	'#6ee7b7': '--palette-emerald-l',
	'#4ade80': '--palette-green',
	'#86efac': '--palette-green-l',
	'#38bdf8': '--palette-blue',
	'#7dd3fc': '--palette-blue-l',
	'#60a5fa': '--palette-sky',
	'#93c5fd': '--palette-sky-l',
	'#818cf8': '--palette-indigo',
	'#a5b4fc': '--palette-indigo-l',
	'#c4b5fd': '--palette-violet',
	'#c4a8ff': '--palette-violet',
	'#ddd6fe': '--palette-violet-l',
	'#a78bfa': '--palette-purple',
	'#e879f9': '--palette-fuchsia',
	'#f5d0fe': '--palette-fuchsia-l',
	'#fcd34d': '--palette-amber',
	'#fde68a': '--palette-amber-l',
	'#f59e0b': '--palette-gold',
	'#fbbf24': '--palette-gold-l',
	'#fb923c': '--palette-orange',
	'#fdba74': '--palette-orange-l',
	'#fca5a5': '--palette-red',
	'#fecaca': '--palette-red-l',
	'#f87171': '--palette-rose',
	'#f87185': '--palette-rose',
	'#facc15': '--palette-yellow',
	'#fde047': '--palette-yellow-l',
	'#94a3b8': '--palette-slate',
	'#cbd5e1': '--palette-slate-l',
	'#c6d9e2': '--palette-slate-l',
	'#71717a': '--palette-zinc',
	'#a1a1aa': '--palette-zinc-l'
};

/**
 * Resolves mesh colours against whichever theme the document is wearing.
 *
 * The store exists for two reasons a bare function could not cover.
 *
 * Caching: a canvas frame asks for a colour once per node per draw, and
 * `getComputedStyle` forces style resolution — uncached it is the most
 * expensive call in the loop.
 *
 * Reactivity: the resolved value depends on an attribute on `<html>`, which no
 * component reads and Svelte therefore cannot track. `ink()` touches `#theme`
 * on the way through, so anything that paints with it — markup or an `$effect`
 * driving a canvas — re-runs when the theme changes, without every call site
 * having to know that colour is theme-dependent at all.
 */
class MeshPalette {
	#theme = $state('');
	#cache = new Map<string, string>();
	#stop: (() => void) | undefined;

	/** The active `data-theme`. Mostly an implementation detail of `ink`, but
	 *  exposed because a consumer that branches on light/dark needs the same
	 *  signal and should not plant a second observer to get it. */
	get theme(): string {
		this.#observe();
		return this.#theme;
	}

	/**
	 * The current theme's colour for a mesh hue.
	 *
	 * @param color a legacy palette literal, a `--palette-*` name, or anything
	 *              else (returned unchanged — see the module note).
	 */
	ink(color: string): string {
		// Prerender has no document to read a custom property off. Returning the
		// literal is right rather than merely safe: it is the dark value, and dark
		// is what an unhydrated page paints before the theme attribute lands.
		if (typeof document === 'undefined') return color;

		// Read for the dependency, not for the value — `#observe` has already
		// reconciled it against the DOM.
		void this.theme;

		const hit = this.#cache.get(color);
		if (hit !== undefined) return hit;

		const resolved = this.#resolve(color);
		this.#cache.set(color, resolved);
		return resolved;
	}

	#resolve(color: string): string {
		const raw = color.trim().toLowerCase();

		// The same hues are also authored as `rgba(r,g,b,a)` — a node's fill is its
		// stroke at 0.14, an edge's glow is its line at 0.65. Those are the SAME
		// categorical colour, so re-keying them by their opaque form gets them
		// themed too, and the alpha is carried across rather than looked up. Doing
		// it here (instead of adding a second table) is what keeps the fill from
		// drifting off its stroke the next time a hue moves.
		const rgba = raw.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?\s*\)$/);
		if (rgba) {
			const hex = `#${[rgba[1], rgba[2], rgba[3]]
				.map((n) => Number(n).toString(16).padStart(2, '0'))
				.join('')}`;
			const base = this.#lookup(hex);
			if (!base) return color;
			return rgba[4] === undefined ? base : withAlpha(base, Number(rgba[4]));
		}

		return this.#lookup(raw.startsWith('--') ? raw : raw) ?? color;
	}

	/** The theme's value for a literal or a token name; undefined if unmapped. */
	#lookup(value: string): string | undefined {
		const token = value.startsWith('--') ? value : TOKEN_OF[value];
		if (!token) return undefined;
		const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
		return v || undefined;
	}

	/** Drop the resolved values. Needed when the palette moves under a FIXED
	 *  theme name — the Theme Studio writes tokens straight onto the element, so
	 *  `data-theme` alone cannot tell us the colours changed. */
	reset(): void {
		this.#cache = new Map();
	}

	/** Start tracking `data-theme`, once, on first use. Self-starting rather than
	 *  host-wired because this is a leaf utility: a canvas deep in the tree should
	 *  not need the app shell to have remembered to turn colour on. */
	#observe(): void {
		if (this.#stop || typeof document === 'undefined') return;
		const el = document.documentElement;
		const sync = () => {
			const next = el.dataset.theme ?? '';
			if (next === this.#theme) return;
			this.#theme = next;
			this.#cache = new Map();
		};
		const mo = new MutationObserver(sync);
		mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
		this.#stop = () => mo.disconnect();

		// The FIRST sync is deferred, and that is the whole subtlety of being
		// self-starting. `#observe` runs on the first read of `theme`, and the first
		// read comes from whatever paints first — in practice a `$derived`. Writing
		// `#theme` straight from here therefore assigns state during a derived's
		// evaluation, which Svelte rejects outright (`state_unsafe_mutation`), and
		// it takes the whole canvas down rather than degrading.
		//
		// A microtask puts that assignment after the current evaluation instead of
		// inside it. The cost is that the very first paint resolves against theme
		// '' — but `sync` then clears the cache exactly as a real theme change
		// would, and everything repaints through the same path. There is no case
		// here the observer does not already handle.
		queueMicrotask(sync);
	}
}

/** `#rrggbb` + alpha → `rgba(...)`. The palette is authored in hex, so this is
 *  the only conversion needed; a non-hex value is handed back untouched. */
function withAlpha(hex: string, alpha: number): string {
	const m = hex.match(/^#([0-9a-f]{6})$/i);
	if (!m) return hex;
	const n = parseInt(m[1], 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const meshPalette = new MeshPalette();

/** Shorthand for the common case. Reactive — see `MeshPalette`. */
export function meshInk(color: string): string {
	return meshPalette.ink(color);
}
