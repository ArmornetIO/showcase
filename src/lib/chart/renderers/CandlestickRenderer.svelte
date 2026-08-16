<script lang="ts">
	/**
	 * Candlestick (OHLC):
	 *   p.y  = close
	 *   p.y1 = open
	 *   p.y2 = high
	 *   p.y3 = low
	 */
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor } from '../chart.types.js';

	const ctx = getChartCtx();

	const activeSeries = $derived(
		ctx.config.series.filter((s) => ctx.visibleSeries.has(s.id))
	);

	const seriesIndex = $derived(
		Object.fromEntries(ctx.config.series.map((s, i) => [s.id, i]))
	);

	// Candle width based on point density
	const candleW = $derived(() => {
		const s = activeSeries[0];
		if (!s || s.points.length < 2) return 8;
		const gap = ctx.scaleX(s.points[1].x) - ctx.scaleX(s.points[0].x);
		return Math.max(2, Math.min(20, gap * 0.7));
	});

	const BULL = '#4ADE80'; // close > open
	const BEAR = '#FB923C'; // close < open
</script>

{#each activeSeries as s}
	{@const si = seriesIndex[s.id] ?? 0}
	{@const cw = candleW()}
	{@const halfW = cw / 2}

	{#each s.points as p, pi}
		{@const open = p.y1 ?? p.y}
		{@const close = p.y}
		{@const high = p.y2 ?? Math.max(open, close)}
		{@const low = p.y3 ?? Math.min(open, close)}

		{@const px = ctx.scaleX(p.x)}
		{@const pOpen = ctx.scaleY(open)}
		{@const pClose = ctx.scaleY(close)}
		{@const pHigh = ctx.scaleY(high)}
		{@const pLow = ctx.scaleY(low)}

		{@const bull = close >= open}
		{@const color = s.pointColor
			? s.pointColor(p, pi, s)
			: (bull ? BULL : BEAR)}

		{@const bodyTop = Math.min(pOpen, pClose)}
		{@const bodyH = Math.max(Math.abs(pClose - pOpen), 1)}

		<!-- High-Low wick -->
		<line
			x1={px} y1={pHigh}
			x2={px} y2={pLow}
			stroke={color}
			stroke-width={1}
			opacity={0.8}
		/>
		<!-- Body -->
		<rect
			x={px - halfW}
			y={bodyTop}
			width={cw}
			height={bodyH}
			fill={bull ? color : 'transparent'}
			stroke={color}
			stroke-width={1}
			opacity={0.9}
		/>
	{/each}
{/each}
