<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor } from '../chart.types.js';

	const ctx = getChartCtx();

	const activeSeries = $derived(
		ctx.config.series.filter((s) => {
			if (!ctx.visibleSeries.has(s.id)) return false;
			const t = s.type ?? ctx.config.type;
			return t === 'waterfall';
		})
	);

	const seriesIndex = $derived(
		Object.fromEntries(ctx.config.series.map((s, i) => [s.id, i]))
	);

	// Pre-compute waterfall layout data per series
	const seriesLayouts = $derived(
		activeSeries.map((s) => {
			const points = s.points;
			const n = points.length;
			const step = n > 0 ? ctx.inner.w / n : ctx.inner.w;
			const barWidth = step * 0.7;

			const bars = points.map((p, i) => {
				const runningBaseline = points.slice(0, i).reduce((acc, pt) => acc + pt.y, 0);
				const barTop = runningBaseline + p.y;
				const isTotal = i === n - 1;

				// Pixel coords
				const xCenter = ctx.scaleX(p.x);
				const xLeft = xCenter - barWidth / 2;

				let yTopPx: number;
				let yBottomPx: number;

				if (isTotal) {
					// Total bar always runs from 0
					yTopPx = ctx.scaleY(Math.max(0, barTop));
					yBottomPx = ctx.scaleY(Math.min(0, barTop));
				} else {
					yTopPx = ctx.scaleY(Math.max(runningBaseline, barTop));
					yBottomPx = ctx.scaleY(Math.min(runningBaseline, barTop));
				}

				const height = Math.max(Math.abs(yBottomPx - yTopPx), 2);

				return {
					p,
					i,
					isTotal,
					runningBaseline,
					barTopValue: barTop,
					xLeft,
					xCenter,
					barWidth,
					yTopPx,
					yBottomPx,
					height
				};
			});

			return { s, bars };
		})
	);
</script>

{#each seriesLayouts as { s, bars }, li}
	{@const si = seriesIndex[s.id] ?? li}
	{@const totalColor = seriesColor(si, s.color)}

	{#each bars as bar, bi}
		{@const isHovered = ctx.hover.point !== null && ctx.hover.point.x === bar.p.x}
		{@const opacity = isHovered ? 1.0 : 0.85}

		{@const fillColor = bar.isTotal
			? totalColor
			: bar.p.y >= 0
				? '#4ADE80'
				: '#FB923C'}

		<!-- Bar rect -->
		<rect
			x={bar.xLeft}
			y={bar.yTopPx}
			width={bar.barWidth}
			height={bar.height}
			fill={fillColor}
			{opacity}
			rx={1}
		/>

		<!-- Value label inside bar (only if tall enough) -->
		{#if bar.height > 14}
			<text
				x={bar.xLeft + bar.barWidth / 2}
				y={bar.yTopPx + bar.height / 2}
				text-anchor="middle"
				dominant-baseline="central"
				font-size="9"
				fill="var(--bg)"
			>
				{bar.p.y >= 0 && !bar.isTotal ? `+${bar.p.y}` : `${bar.p.y}`}
			</text>
		{/if}

		<!-- Step connector: right edge of this bar to left edge of next bar -->
		{#if bi < bars.length - 1}
			{@const nextBar = bars[bi + 1]}
			<line
				x1={bar.xLeft + bar.barWidth}
				y1={bar.yTopPx}
				x2={nextBar.xLeft}
				y2={bar.yTopPx}
				stroke="var(--fg-muted)"
				stroke-width="1"
				opacity="0.4"
			/>
		{/if}
	{/each}
{/each}
