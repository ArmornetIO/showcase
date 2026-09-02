// The DevCog's icon set, as raw path data on a 24×24 grid.
//
// The cog is a portable drop-in — it must not drag an icon library, a sprite
// sheet, or a font behind it into a host app. Every glyph is one or more `d`
// strings rendered by `DevIcon.svelte`, so the whole set costs a few hundred
// bytes and inherits `currentColor` from whatever button holds it.

/** A glyph: the path data, plus whether it is drawn filled or stroked. */
export interface DevGlyph {
	paths: string[];
	filled?: boolean;
}

/** QA / bug-report entry point (a droplet — the "found something" marker). */
export const ICON_QA: DevGlyph = {
	paths: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z']
};

/** Feature-flags entry point. */
export const ICON_COG: DevGlyph = {
	paths: [
		'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
		'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
		'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'
	]
};

/** Element inspector (crosshair). */
export const ICON_CROSSHAIR: DevGlyph = {
	paths: ['M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', 'M12 2v4M12 18v4M2 12h4M18 12h4']
};

/** Dismiss. */
export const ICON_CLOSE: DevGlyph = {
	paths: ['M6 6l12 12M18 6L6 18']
};

/** A saved annotation (speech bubble) — drawn filled on the overlay badge. */
export const ICON_NOTE: DevGlyph = {
	paths: ['M19 3H5a2 2 0 0 0-2 2v14l4-4h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z'],
	filled: true
};
