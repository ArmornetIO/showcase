<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor } from '../chart.types.js';
	import type { ChartSeries } from '../chart.types.js';
	import { toNumber } from '../chart-scales.js';

	const ctx = getChartCtx();

	const activeSeries = $derived(
		ctx.config.series.filter((s) => {
			if (!ctx.visibleSeries.has(s.id)) return false;
			const t = s.type ?? ctx.config.type;
			return t === 'bar' || t === 'grouped-bar' || t === 'stacked-bar' || t === 'histogram';
		})
	);

	const chartType = $derived(
		activeSeries.length > 0
			? (activeSeries[0].type ?? ctx.config.type)
			: ctx.config.type
	);

	const baseline = $derived(ctx.scaleY(0));

	// Unique x values for bar positioning
	const xValues = $derived(() => {
		const seen = new Set<number | string>();
		const vals: (number | string)[] = [];
		for (const s of activeSeries) {
			for (const p of s.points) {
				const k = String(p.x);
				if (!seen.has(k)) { seen.add(k); vals.push(p.x as number | string); }
			}
		}
		return vals.sort((a, b) => toNumber(a) - toNumber(b));
	});

	// Bar width based on x-domain density or band scale bandwidth
	const barWidth = $derived.by(() => {
		if (ctx.scaleX.bandwidth !== undefined) {
			const n = chartType === 'grouped-bar' ? activeSeries.length : 1;
			return Math.max(2, ctx.scaleX.bandwidth * 0.85 / n);
		}
		const xs = xValues();
		if (xs.length < 2) return Math.min(ctx.inner.w * 0.8, 40);
		const firstGap = ctx.scaleX(xs[1]) - ctx.scaleX(xs[0]);
		const n = chartType === 'grouped-bar' ? activeSeries.length : 1;
		return Math.max(2, firstGap * 0.8 / n);
	});

	const seriesIndex = $derived(
		Object.fromEntries(ctx.config.series.map((s, i) => [s.id, i]))
	);

	// Precompute stacked positions: stackedData[xKey][seriesId] = { base, top }
	const stackedData = $derived.by(() => {
		if (chartType !== 'stacked-bar') return null;
		const result = new Map<string, Map<string, { base: number; top: number }>>();
		const xAcc = new Map<string, number>();
		for (const s of activeSeries) {
			for (const p of s.points) {
				const xKey = String(p.x);
				const base = xAcc.get(xKey) ?? 0;
				const top = base + (p.y ?? 0);
				if (!result.has(xKey)) result.set(xKey, new Map());
				result.get(xKey)!.set(s.id, { base, top });
				xAcc.set(xKey, top);
			}
		}
		return result;
	});
</script>

{#each activeSeries as s}
	{@const si = seriesIndex[s.id] ?? 0}
	{@const color = seriesColor(si, s.color)}
	{@const opacity = s.opacity ?? 1}
	{@const bw = barWidth}

	{@const isLollipop = (s as any).style === 'lollipop'}

	{#each s.points as p, pi}
		<!-- A band scale returns the band's LEFT EDGE, not its centre (ChartAxis
		     adds the same half-bandwidth to place its ticks). Without this every bar
		     sits half a bar-width left of its own band, and the first one is drawn
		     at a negative x — off-canvas, which on a one-band chart means nothing
		     renders at all. -->
		{@const px = ctx.scaleX(p.x) + (ctx.scaleX.bandwidth ?? 0) / 2}
		{@const py = ctx.scaleY(p.y)}
		{@const barH = Math.abs(baseline - py)}
		{@const barTop = p.y >= 0 ? py : baseline}
		{@const pointColor = s.pointColor ? s.pointColor(p, pi, s) : color}

		{#if isLollipop}
			{@const xCenter = px}
			{@const valueY = py}
			{@const isHovered = ctx.hover.point !== null && toNumber(ctx.hover.point.x) === toNumber(p.x)}
			<line
				x1={xCenter}
				y1={baseline}
				x2={xCenter}
				y2={valueY}
				stroke={pointColor}
				stroke-width="1.5"
				stroke-linecap="round"
				opacity={opacity}
			/>
			<circle
				cx={xCenter}
				cy={valueY}
				r={isHovered ? 5.5 : 4}
				fill={pointColor}
				stroke={isHovered ? 'var(--bg)' : undefined}
				stroke-width={isHovered ? 1.5 : undefined}
				opacity={opacity}
			/>
		{:else if chartType === 'grouped-bar'}
			{@const groupOffset = (si - (activeSeries.length - 1) / 2) * (bw + 1)}
			<rect
				x={px + groupOffset - bw / 2}
				y={barTop}
				width={bw}
				height={Math.max(barH, 1)}
				fill={pointColor}
				opacity={opacity}
				rx={1}
			/>
		{:else if chartType === 'stacked-bar'}
			{@const sd = stackedData?.get(String(p.x))?.get(s.id)}
			{@const stackBase = ctx.scaleY(sd?.base ?? 0)}
			{@const stackTop = ctx.scaleY(sd?.top ?? p.y)}
			<rect
				x={px - bw / 2}
				y={stackTop}
				width={bw}
				height={Math.max(Math.abs(stackBase - stackTop), 1)}
				fill={pointColor}
				opacity={opacity}
				rx={1}
			/>
		{:else}
			<!-- bar / histogram -->
			<rect
				x={px - bw / 2}
				y={barTop}
				width={bw}
				height={Math.max(barH, 1)}
				fill={pointColor}
				opacity={opacity}
				rx={1}
			/>
		{/if}
	{/each}
{/each}
