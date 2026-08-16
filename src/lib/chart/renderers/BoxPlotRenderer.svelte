<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor } from '../chart.types.js';
	import { toNumber } from '../chart-scales.js';

	const ctx = getChartCtx();

	const activeSeries = $derived(
		ctx.config.series.filter((s) => {
			if (!ctx.visibleSeries.has(s.id)) return false;
			const t = s.type ?? ctx.config.type;
			return t === 'boxplot';
		})
	);

	const seriesIndex = $derived(
		Object.fromEntries(ctx.config.series.map((s, i) => [s.id, i]))
	);

	// Total number of data points across all active series (for box width calculation)
	const totalPoints = $derived(() => {
		let max = 0;
		for (const s of activeSeries) {
			if (s.points.length > max) max = s.points.length;
		}
		return max;
	});

	const boxWidth = $derived(() => {
		const numPts = Math.max(totalPoints(), 1);
		const raw = (ctx.inner.w / numPts) * 0.6;
		return Math.min(Math.max(raw, 8), 60);
	});
</script>

{#each activeSeries as s}
	{@const si = seriesIndex[s.id] ?? 0}
	{@const color = seriesColor(si, s.color)}
	{@const bw = boxWidth()}
	{@const capHalfW = bw * 0.4 * 0.5}

	{#each s.points as p}
		{@const xCenter = ctx.scaleX(p.x)}
		{@const yMedian = ctx.scaleY(p.y)}
		{@const yQ1 = p.y1 !== undefined ? ctx.scaleY(p.y1) : yMedian}
		{@const yQ3 = p.y2 !== undefined ? ctx.scaleY(p.y2) : yMedian}
		{@const whiskerLow = typeof p.meta?.whiskerLow === 'number' ? ctx.scaleY(p.meta.whiskerLow) : yQ1}
		{@const whiskerHigh = typeof p.meta?.whiskerHigh === 'number' ? ctx.scaleY(p.meta.whiskerHigh) : yQ3}
		{@const outliers = Array.isArray(p.meta?.outliers) ? (p.meta.outliers as number[]) : []}
		{@const isHovered = ctx.hover.point !== null && toNumber(ctx.hover.point.x) === toNumber(p.x)}

		<!-- Whisker stem: vertical dashed line from whiskerLow to whiskerHigh -->
		<line
			x1={xCenter}
			y1={whiskerLow}
			x2={xCenter}
			y2={whiskerHigh}
			stroke={color}
			stroke-width={1}
			stroke-opacity={0.5}
			stroke-dasharray="2,2"
		/>

		<!-- Lower whisker cap -->
		<line
			x1={xCenter - capHalfW}
			y1={whiskerLow}
			x2={xCenter + capHalfW}
			y2={whiskerLow}
			stroke={color}
			stroke-width={1}
			stroke-opacity={0.5}
		/>

		<!-- Upper whisker cap -->
		<line
			x1={xCenter - capHalfW}
			y1={whiskerHigh}
			x2={xCenter + capHalfW}
			y2={whiskerHigh}
			stroke={color}
			stroke-width={1}
			stroke-opacity={0.5}
		/>

		<!-- IQR box: from Q1 (yQ1, larger SVG y) to Q3 (yQ3, smaller SVG y) -->
		{@const boxTop = Math.min(yQ1, yQ3)}
		{@const boxHeight = Math.abs(yQ1 - yQ3)}
		<rect
			x={xCenter - bw / 2}
			y={boxTop}
			width={bw}
			height={Math.max(boxHeight, 1)}
			fill={color}
			fill-opacity={isHovered ? 0.3 : 0.15}
			stroke={color}
			stroke-opacity={0.6}
			stroke-width={isHovered ? 1.5 : 1}
			rx={1}
		/>

		<!-- Hover highlight ring -->
		{#if isHovered}
			<rect
				x={xCenter - bw / 2 - 1.5}
				y={boxTop - 1.5}
				width={bw + 3}
				height={Math.max(boxHeight, 1) + 3}
				fill="none"
				stroke={color}
				stroke-opacity={0.9}
				stroke-width={1}
				rx={2}
			/>
		{/if}

		<!-- Median line -->
		<line
			x1={xCenter - bw / 2}
			y1={yMedian}
			x2={xCenter + bw / 2}
			y2={yMedian}
			stroke={color}
			stroke-width={1.5}
			stroke-opacity={1}
		/>

		<!-- Outliers -->
		{#each outliers as ov}
			<circle
				cx={xCenter}
				cy={ctx.scaleY(ov)}
				r={2.5}
				fill={color}
				fill-opacity={0.7}
			/>
		{/each}
	{/each}
{/each}
