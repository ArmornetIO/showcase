<script module lang="ts">
	export type { SvgFxType, SvgFxTuning } from './svg-fx.js';
	export { FX_DEFAULTS, FX_KNOBS, FX_BLURB, resolveFx, fxRegion } from './svg-fx.js';
</script>

<script lang="ts">
	/**
	 * SvgFx — apply a chrome/emboss/outline/glow/engrave treatment to ANY vector
	 * art, including art that was never authored for it.
	 *
	 * The crests in `icons/` get their metal from ~90 hand-sampled gradient stops
	 * painted onto hand-traced geometry. That is the right way to build ONE mark
	 * and the wrong way to treat fifty, because none of it transfers. This does
	 * the opposite: every chain here reads only the SOURCE ALPHA, so it works on
	 * an icon, a logo, a chart series, a whole row of glyphs — anything with a
	 * silhouette.
	 *
	 * Two hosts, because "an SVG" means two different things in practice:
	 *
	 * · `wrap` (default) puts a CSS `filter: url(...)` on a wrapping element and
	 *   parks the filter in a zero-size <svg>. This is the one that takes ANY
	 *   children — complete <svg> elements, <Icon>s, several of them at once,
	 *   even HTML. Reach for this by default.
	 * · `svg` renders its own <svg viewBox> and wraps the children in
	 *   `<g filter>`. Use it when the result has to be ONE self-contained SVG
	 *   document — anything going through `dev/svg-export.ts`, or any case where
	 *   the effect must survive being serialized out of the page. Children must
	 *   be SVG fragments (`<path>`, `<g>`, …), not whole <svg> elements.
	 *
	 * Effects compose by nesting: an outline outside a chrome inside a glow is
	 * three SvgFx wrappers, and they stack in the order you nest them.
	 *
	 * Known edges, so nobody rediscovers them:
	 * · Filters rasterize. The output is resolution-independent in the page but
	 *   an effect tuned at 24px will look heavy-handed at 300px — `size` is in
	 *   user units, so scale it with the art.
	 * · `bleed` is a generous default because the exact spill cannot be known
	 *   without measuring the content. Raise it if a big glow looks cropped.
	 * · Lit effects (`emboss`, `chrome`) need a shoulder to catch the light. On
	 *   hairline strokes there is barely any alpha to slope, so they read weakly —
	 *   thicken the stroke or raise `softness`.
	 */
	import type { Snippet } from 'svelte';
	import type { SvgFxType, SvgFxTuning } from './svg-fx.js';
	import { resolveFx } from './svg-fx.js';
	import SvgFxDefs from './SvgFxDefs.svelte';

	interface SvgFxProps extends Partial<SvgFxTuning> {
		/** The art to treat. */
		children: Snippet;
		/** Which treatment. */
		type?: SvgFxType;
		/** How the effect is hosted — see the note above. */
		host?: 'wrap' | 'svg';
		/** Turn the effect off without unmounting the art, so a toggle does not
		 *  remount whatever is inside. */
		enabled?: boolean;
		/** Filter region bleed, % of the content box per side. Raise if clipped. */
		bleed?: number;

		// ── host="svg" only ──────────────────────────────────────────────────────
		viewBox?: string;
		width?: number | string;
		height?: number | string;
		/** Accessible name. Given one, the <svg> is exposed as an image; without
		 *  one it is hidden from assistive tech, which is right for decoration. */
		title?: string;

		class?: string;
		style?: string;
	}

	let {
		children,
		type = 'chrome',
		host = 'wrap',
		enabled = true,
		bleed = 50,
		viewBox = '0 0 24 24',
		width,
		height,
		title,
		class: cls = '',
		style = '',
		...tuning
	}: SvgFxProps = $props();

	// Scoped per instance — several SvgFx on one page would otherwise all resolve
	// url(#fx) to whichever filter mounted first.
	const uid = $props.id();
	const fid = $derived(`fx-${type}-${uid}`);
	const fx = $derived(resolveFx(tuning));
	const filterRef = $derived(enabled ? `url(#${fid})` : undefined);
</script>

{#if host === 'svg'}
	<svg
		class="svg-fx {cls}"
		{style}
		{viewBox}
		width={width ?? undefined}
		height={height ?? undefined}
		role={title ? 'img' : 'presentation'}
		aria-label={title}
		aria-hidden={title ? undefined : 'true'}
	>
		{#if title}<title>{title}</title>{/if}
		<defs>
			<SvgFxDefs id={fid} {type} {fx} {bleed} />
		</defs>
		<g filter={filterRef}>{@render children()}</g>
	</svg>
{:else}
	<span class="svg-fx svg-fx--wrap {cls}" {style} style:filter={filterRef}>
		<!-- The filter has to live in a rendered <svg> for CSS url() to resolve it,
		     but must contribute no layout of its own. -->
		<svg class="svg-fx__defs" width="0" height="0" aria-hidden="true" focusable="false">
			<defs>
				<SvgFxDefs id={fid} {type} {fx} {bleed} />
			</defs>
		</svg>
		{@render children()}
	</span>
{/if}

<style>
	.svg-fx {
		display: inline-block;
		flex-shrink: 0;
		vertical-align: middle;
	}

	/* line-height: 0 so the wrapper hugs the art instead of inheriting a text
	   leading gap, which otherwise shifts a filtered icon off its baseline. */
	.svg-fx--wrap {
		line-height: 0;
	}

	.svg-fx__defs {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}

	/* Filters are decoration. Under forced-colours the art must survive on its
	   own, and a specular highlight actively fights a high-contrast palette. */
	@media (forced-colors: active) {
		.svg-fx--wrap {
			filter: none !important;
		}
	}
</style>
