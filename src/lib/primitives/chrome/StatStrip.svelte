<script lang="ts" module>
	/**
	 * What a value MEANS, as a colour. Callers pass `danger`/`warn` only when the
	 * number is non-zero, so a clean strip reads dim rather than alarming.
	 *
	 * `mono` is the deliberate opt-out: a figure that is context rather than
	 * status (a rank, an id) and should not compete with the ones that are.
	 */
	export type StatStripColor = 'default' | 'danger' | 'warn' | 'good' | 'mono';

	/**
	 * Density. `default` is the page-header strip; `compact` is the one that sits
	 * under a toolbar with panels below it, where the taller strip pushes the
	 * content it introduces off the fold.
	 */
	export type StatStripDensity = 'default' | 'compact';

	export interface StatStripItem {
		/** Pre-formatted by the caller — this component owns layout and tone, not arithmetic. */
		value: string;
		label: string;
		color?: StatStripColor;
		/**
		 * A literal colour, overriding `color`. For a value carrying an IDENTITY
		 * rather than a severity — a relay surface keeps its own hue on every page
		 * it appears, which no semantic tone can express.
		 */
		hex?: string;
		/** Dimmed denominator appended to the value, e.g. `/85` in `76/85`. */
		suffix?: string;
	}
</script>

<script lang="ts">
	// Absorbed `app-ui`'s `MetricsStrip` (console/MetricsStrip.svelte), which was
	// the same component built a second time because this one lived in showcase
	// and that one did not. The differences were a denser padding scale, a
	// dimmed `suffix`, and two more tones — all of which are props now.
	import type { Snippet } from 'svelte';
	import FrameNumber from '../../frames/FrameNumber.svelte';

	interface Props {
		items: StatStripItem[];
		density?: StatStripDensity;
		/** Pushed to the far end of the strip — a control that belongs to the
		 *  readings rather than a reading of its own. */
		trailing?: Snippet;
		class?: string;
	}

	let { items, density = 'default', trailing, class: cls = '' }: Props = $props();
</script>

<div class="stat-strip glass {density === 'compact' ? 'compact' : ''} {cls}">
	{#each items as item, i (i)}
		{#if i > 0}
			<div class="ss-sep" aria-hidden="true"></div>
		{/if}
		<div class="ss-item {item.color ?? 'default'}" style:--ss-hex={item.hex}>
			<!-- Inside a pre-load Frame each value rolls (fixed width); labels stay. -->
			<span class="v"
				><FrameNumber value={item.value} />{#if item.suffix}<span class="sfx">{item.suffix}</span
					>{/if}</span
			>
			{item.label}
		</div>
	{/each}
	{#if trailing}
		<div class="ss-trailing">{@render trailing()}</div>
	{/if}
</div>

<style>
	/* No border, background or radius here — the surface is the shared `.glass`
	   in the markup, which is the only thing `data-appearance` switches. Painting
	   one here would be unlayered component CSS out-ranking `@layer components`,
	   which is how this strip stayed opaque while the cards around it followed
	   the setting. */
	.stat-strip {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 20px;
		flex-wrap: wrap;
	}
	.ss-item {
		display: flex;
		align-items: center;
		gap: 9px;
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding-right: 24px;
	}
	.ss-item .v {
		font-family: var(--mono-display);
		font-weight: 900;
		font-size: 18px;
		color: var(--fg);
	}
	.ss-item .sfx {
		font-size: 10px;
		font-weight: 400;
		color: var(--fg-dim);
	}
	.ss-item.danger .v {
		color: var(--palette-red);
	}
	.ss-item.warn .v {
		color: var(--palette-amber);
	}
	.ss-item.good .v {
		color: var(--palette-emerald, #34d399);
	}
	.ss-item.mono .v {
		color: var(--fg-dim);
	}
	/* A literal hue outranks the semantic tone — see `hex`. */
	.ss-item[style*='--ss-hex'] .v {
		color: var(--ss-hex);
	}
	.ss-trailing {
		margin-left: auto;
	}
	.ss-sep {
		width: 1px;
		height: 22px;
		background: var(--border);
		margin-right: 24px;
		flex-shrink: 0;
	}

	/* Compact — what `MetricsStrip` was. Reads as a rule under the toolbar rather
	   than a card of its own: squarer corners, tighter padding. It says that
	   through the RADIUS token now, not a competing fill — under glass the
	   surface already separates it from a full card, and a background here would
	   flatten it back out. */
	.compact {
		--glass-radius: var(--radius-control);
		padding: 10px 16px;
		gap: 0;
	}
	/* Flat mode never reads `--glass-radius` or the glass fill, so the compact
	   strip has to restate both or it inherits the full card treatment it is
	   defined in opposition to. */
	:global([data-appearance='flat']) .compact {
		border-radius: var(--radius-control);
		background: rgba(255, 255, 255, 0.02);
	}
	.compact .ss-item {
		align-items: baseline;
		gap: 6px;
		padding: 0 16px;
		font-size: 0.6rem;
		letter-spacing: 0.14em;
	}
	.compact .ss-item:first-child {
		padding-left: 0;
	}
	.compact .ss-item .v {
		font-family: var(--mono);
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.compact .ss-sep {
		height: 18px;
		margin-right: 0;
		background: rgba(255, 255, 255, 0.08);
	}
</style>
