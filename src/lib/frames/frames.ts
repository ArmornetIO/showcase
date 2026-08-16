// ItemFrames — the "pre-load" scaffold for showcase components.
//
// A *frame* is NOT a loading spinner. It is the state a region is in *before*
// its data exists: the component's own outer shell is drawn for real, and its
// text-bearing fields are drained into shimmer bars of the same size. Because
// the component renders its true outline, the frame is pixel-accurate with zero
// layout shift — the skeleton *is* the real page with the data removed.
//
// We do NOT add a branch to every component. Instead this file is the single,
// hand-curated list of components we know we can frame, mapping each to the
// selectors of the inner fields that should shimmer. `<Frame>` reads this map,
// generates one global stylesheet, and paints the shimmer while a region is
// framed. The builder registry can import the same map.

/** How a single component is turned into a pre-load frame. */
export interface FrameSpec {
	/**
	 * Selectors, relative to the framed region, whose text is replaced by a
	 * shimmer bar sized to the element's own box. These are the "fields".
	 */
	fields: readonly string[];
	/**
	 * Optional selectors to fully hide while framed — icons, charts, canvases,
	 * or anything that can't shimmer sensibly. Their space is preserved.
	 */
	hide?: readonly string[];
}

/**
 * FRAME_MAP — the opt-in list. componentId → which fields shimmer.
 * A component absent from this map is simply not frame-able (yet). Onboard a
 * component by giving it stable field classes and adding one entry here.
 */
export const FRAME_MAP: Record<string, FrameSpec> = {
	// StatTile handles its own frame state (label stays, value rolls) via
	// getFrameState() — see StatTile.svelte — so it is intentionally not here.
	Panel: { fields: ['.panel-title'] },
	Chip: { fields: ['.chip-body'] }
	// Onboarding a component = give it a stable field class (a non-styling hook
	// like `.panel-title` / `.chip-body`), then add one entry here. Text-bearing
	// leaf classes are best; charts/canvases go in `hide` instead of `fields`.
};

/** Attribute a framed region carries; the generated CSS keys off it. */
export const FRAME_ATTR = 'data-frame';

/**
 * buildFrameCss flattens the map into one global stylesheet. Every field, for
 * every frame-able component, receives the same shimmer treatment so the look
 * is uniform and the map stays declarative. Scoped only to `[data-frame]`
 * regions, so nothing shimmers unless a Frame turns it on.
 */
export function buildFrameCss(map: Record<string, FrameSpec> = FRAME_MAP): string {
	// Two universal escape hatches so page-local bespoke markup can frame without
	// bloating the component map: `.frame-field` shimmers, `.frame-hide` blanks.
	const fieldSel: string[] = [`[${FRAME_ATTR}] .frame-field`];
	const hideSel: string[] = [`[${FRAME_ATTR}] .frame-hide`];
	for (const spec of Object.values(map)) {
		for (const f of spec.fields) fieldSel.push(`[${FRAME_ATTR}] ${f}`);
		for (const h of spec.hide ?? []) hideSel.push(`[${FRAME_ATTR}] ${h}`);
	}

	const rules: string[] = [
		// The shimmer tokens — theme-aware, overridable per host.
		`:root{
			--frame-shimmer-base: color-mix(in srgb, var(--fg-dim) 14%, transparent);
			--frame-shimmer-lite: color-mix(in srgb, var(--fg-dim) 26%, transparent);
			--frame-radius: 5px;
			--frame-speed: 1.4s;
		}`,
		`@keyframes frame-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`,
		`@media (prefers-reduced-motion: reduce){
			${fieldSel.join(',')}{animation:none !important;}
		}`
	];

	if (fieldSel.length) {
		rules.push(`${fieldSel.join(',')}{
			color: transparent !important;
			-webkit-text-fill-color: transparent !important;
			border-radius: var(--frame-radius);
			background-image: linear-gradient(90deg,
				var(--frame-shimmer-base) 25%,
				var(--frame-shimmer-lite) 50%,
				var(--frame-shimmer-base) 75%) !important;
			background-size: 200% 100%;
			animation: frame-shimmer var(--frame-speed) ease-in-out infinite;
			user-select: none;
		}`);
		// Blank out any nested marks (icons, dots) inside a shimmering field.
		rules.push(`${fieldSel.map((s) => `${s} *`).join(',')}{visibility:hidden;}`);
	}
	if (hideSel.length) {
		rules.push(`${hideSel.join(',')}{visibility:hidden !important;}`);
	}
	return rules.join('\n');
}
