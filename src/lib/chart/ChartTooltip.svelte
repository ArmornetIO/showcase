<script lang="ts">
	import { getChartCtx } from './chart-context.js';
	import { seriesColor } from './chart.types.js';
	import { defaultFormat, toNumber } from './chart-scales.js';

	const ctx = getChartCtx();

	const LEFT_EDGE_FLIP = 160; // px from right edge before flipping tooltip

	const visible = $derived(
		ctx.hover.svgX !== null && ctx.hover.point !== null && ctx.hover.series !== null
	);

	const tipLeft = $derived(
		ctx.hover.svgX !== null
			? ctx.pad.left + ctx.hover.svgX + 12
			: 0
	);
	const tipTop = $derived(
		ctx.hover.svgY !== null
			? ctx.pad.top + ctx.hover.svgY - 12
			: 0
	);
	const flipX = $derived(tipLeft > (ctx.inner.w + ctx.pad.left - LEFT_EDGE_FLIP));

	const xLabel = $derived(() => {
		const p = ctx.hover.point;
		if (!p) return '';
		const fmt = ctx.config.xAxis?.format;
		return fmt ? fmt(p.x) : defaultFormat(p.x instanceof Date ? p.x : toNumber(p.x), ctx.config.xAxis?.unit);
	});

	// Collect all series values at the current hovered x
	const rows = $derived(() => {
		const pt = ctx.hover.point;
		if (!pt) return [];
		const xVal = toNumber(pt.x);
		return ctx.config.series
			.filter((s) => ctx.visibleSeries.has(s.id))
			.map((s, i) => {
				const nearest = s.points.reduce<typeof s.points[0] | null>((best, p) => {
					if (!best) return p;
					return Math.abs(toNumber(p.x) - xVal) < Math.abs(toNumber(best.x) - xVal) ? p : best;
				}, null);
				return {
					series: s,
					color: seriesColor(i, s.color),
					value: nearest ? nearest.y : null,
					// Each series' OWN nearest point — the custom formatter must format
					// this, not the single globally-hovered point, or every row prints
					// the same number.
					point: nearest,
					fmt: ctx.config.tooltip?.format,
				};
			});
	});
</script>

{#if visible}
	<div
		class="tooltip"
		style:left="{flipX ? tipLeft - 148 : tipLeft}px"
		style:top="{tipTop}px"
	>
		{#if xLabel()}
			<div class="tooltip-header">{xLabel()}</div>
		{/if}
		{#each rows() as row}
			{#if row.value !== null}
				<div class="tooltip-row">
					<span class="tooltip-dot" style:background={row.color}></span>
					<span class="tooltip-series">{row.series.label}</span>
					<span class="tooltip-val">
						{row.fmt && row.point
							? row.fmt(row.series, row.point)
							: defaultFormat(row.value, ctx.config.yAxis?.unit)}
					</span>
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.tooltip {
		position: absolute;
		pointer-events: none;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		padding: 6px 10px;
		min-width: 130px;
		max-width: 220px;
		z-index: 10;
		font-family: var(--mono);
		font-size: 10px;
	}

	.tooltip-header {
		color: var(--fg-dim);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin-bottom: 4px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--border);
	}

	.tooltip-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 1px 0;
	}

	.tooltip-dot {
		width: 6px;
		height: 6px;
		border-radius: 1px;
		flex-shrink: 0;
	}

	.tooltip-series {
		color: var(--fg-dim);
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tooltip-val {
		color: var(--fg);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
</style>
