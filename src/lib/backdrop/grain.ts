// ── grain — a baked feTurbulence tile as a data URI ─────────────────────────
//
// The standard trick for film grain on the web: an inline SVG filter serialized
// into a `background-image`. Roughly 300 bytes of markup against 50–200 KB for
// a tiled PNG, and it scales to any DPR because the browser rasterizes it.
//
// The important word is BAKED. `feTurbulence` runs once, when the browser
// rasterizes the data URI, and the result is then an ordinary repeating bitmap.
// Nothing re-runs the filter — which matters, because Codrops' own filter series
// warns that animated SVG filters cost in proportion to the filtered AREA, and
// a full-viewport animated turbulence is exactly the thing that makes a fan
// audible.
//
// Shared rather than private to one backdrop: the strata and flow-field
// treatments both lay this over themselves, and it is what stops a blur reading
// as a smear.

export interface GrainOptions {
	/** Tile size in px. Larger reads as coarse dust, smaller as fine film. */
	size?: number;
	/** feTurbulence baseFrequency. Higher is finer. */
	frequency?: number;
	/** Octaves of turbulence. Three is plenty at these scales. */
	octaves?: number;
	/** 0–1, baked into the tile's own alpha. */
	opacity?: number;
}

/**
 * A `url("data:image/svg+xml,…")` value ready for `background-image`.
 *
 * The `feColorMatrix` is not optional decoration — raw `feTurbulence` is
 * coloured noise, and coloured noise over a near-black ground reads as broken
 * pixels. Desaturating to luminance is what makes it grain.
 */
export function grainUrl({
	size = 180,
	frequency = 0.6,
	octaves = 3,
	opacity = 0.5
}: GrainOptions = {}): string {
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
		`<filter id="g" x="0" y="0" width="100%" height="100%">` +
		`<feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="${octaves}" stitchTiles="stitch"/>` +
		// Collapse to luminance, then push the result into alpha so the tile is
		// transparent where the noise is dark rather than being a grey slab.
		`<feColorMatrix type="saturate" values="0"/>` +
		`<feComponentTransfer><feFuncA type="linear" slope="${opacity}"/></feComponentTransfer>` +
		`</filter>` +
		`<rect width="100%" height="100%" filter="url(#g)"/>` +
		`</svg>`;

	// `encodeURIComponent` rather than base64: it is smaller for markup this
	// shape, and it stays readable in devtools.
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
