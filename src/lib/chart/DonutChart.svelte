<script lang="ts">
	import Chart from './Chart.svelte';
	import DonutLegend from './DonutLegend.svelte';
	import DonutPopover from './DonutPopover.svelte';
	import type { ChartConfig, ChartSeries } from './chart.types.js';

	export interface DonutSlice {
		label: string;
		value: number;
		color: string;
		/** RGB triplet e.g. "251,146,60" — drives glow and popover accent */
		haloRgb?: string;
	}

	interface Props {
		title?: string;
		slices: DonutSlice[];
		/** Label shown in center hole when nothing is hovered */
		centerLabel?: string;
		/** Row label in the hover popover for the count/value row */
		countLabel?: string;
		caption?: string;
	}

	let { title, slices, centerLabel = 'Total', countLabel = 'Count', caption }: Props = $props();

	const total = $derived(slices.reduce((s, sl) => s + sl.value, 0));

	// Ride the shared chart engine: each slice → one single-point series, drawn by
	// DonutRenderer. Zero padding + a 180×180 box makes the engine's coordinate space
	// map 1:1 to the original standalone SVG, so the ring is pixel-identical.
	const config = $derived<ChartConfig>({
		type: 'donut',
		padding: { top: 0, right: 0, bottom: 0, left: 0 },
		legend: { position: 'none' },
		// DonutChart supplies its own DonutPopover overlay — suppress the engine's default tooltip.
		tooltip: { enabled: false },
		series: slices.map(
			(sl, i): ChartSeries => ({
				id: `slice-${i}`,
				label: sl.label,
				color: sl.color,
				points: [{ x: 0, y: sl.value }],
			})
		),
	});

	// Shared hover index — driven by BOTH the engine (arc hover, via onHover) and the
	// legend (bind:hoveredIdx). hoverSeriesId feeds legend hover back into the engine so
	// hovering a legend row lights its arc.
	let hoveredIdx = $state<number | null>(null);
	const hoverSeriesId = $derived(hoveredIdx !== null ? `slice-${hoveredIdx}` : null);

	const active = $derived(
		hoveredIdx !== null && slices[hoveredIdx]
			? { slice: slices[hoveredIdx], pct: Math.round((slices[hoveredIdx].value / (total || 1)) * 100) }
			: null
	);

	function handleHover(series: ChartSeries | null) {
		hoveredIdx = series ? Number(series.id.slice('slice-'.length)) : null;
	}
</script>

<div class="donut-block">
	{#if title}
		<div class="donut-title">{title}</div>
	{/if}

	<div class="donut-wrap">
		<div class="donut-engine">
			<Chart {config} {hoverSeriesId} onHover={handleHover} />
		</div>

		<div
			class="donut-center"
			class:lit={active !== null}
			class:dc-total={active === null}
			style={active?.slice.haloRgb ? `--halo-rgb:${active.slice.haloRgb}` : ''}
		>
			{#if active}
				<span class="dc-val">{active.pct}%</span>
				<span class="dc-label">{active.slice.label}</span>
			{:else}
				<span class="dc-val">{total.toLocaleString()}</span>
				<span class="dc-label">{centerLabel}</span>
			{/if}
		</div>

		{#if active}
			<DonutPopover slice={active.slice} pct={active.pct} {countLabel} />
		{/if}
	</div>

	<DonutLegend {slices} bind:hoveredIdx />

	{#if caption}
		<div class="donut-caption">{caption}</div>
	{/if}
</div>

<style>
	.donut-block {
		display: flex;
		flex-direction: column;
		gap: 0;
		max-width: 420px;
	}

	.donut-title {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--fg-muted);
		margin-bottom: 18px;
	}

	.donut-wrap {
		position: relative;
		display: flex;
		justify-content: center;
		padding: 4px 0 18px;
	}

	.donut-engine {
		width: 180px;
		height: 180px;
		overflow: visible;
	}

	.donut-center {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -58%);
		width: 96px;
		height: 96px;
		border-radius: 50%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		pointer-events: none;
		text-align: center;
		transition: box-shadow 0.25s ease;
	}

	.donut-center.lit {
		box-shadow:
			0 0 0 1px rgba(var(--halo-rgb), 0.4),
			0 0 18px -2px rgba(var(--halo-rgb), 0.5),
			inset 0 0 16px -6px rgba(var(--halo-rgb), 0.4);
	}

	.donut-center .dc-val {
		font-family: var(--sans-brand);
		font-size: 26px;
		font-weight: 700;
		line-height: 1;
		color: var(--fg);
		transition: color 0.2s ease;
	}

	.donut-center.lit .dc-val {
		color: rgb(var(--halo-rgb));
	}

	.donut-center .dc-label {
		font-family: var(--mono);
		font-size: 8px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.donut-center.dc-total .dc-val {
		color: var(--fg-muted);
	}

	.donut-caption {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
		margin-top: 14px;
	}
</style>
