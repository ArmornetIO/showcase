<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor } from '../chart.types.js';

	const ctx = getChartCtx();

	const activeSeries = $derived(
		ctx.config.series.filter((s) => {
			if (!ctx.visibleSeries.has(s.id)) return false;
			const t = s.type ?? ctx.config.type;
			return t === 'scatter' || t === 'bubble';
		})
	);

	const seriesIndex = $derived(
		Object.fromEntries(ctx.config.series.map((s, i) => [s.id, i]))
	);

	const isBubble = $derived(ctx.config.type === 'bubble');
</script>

{#each activeSeries as s}
	{@const si = seriesIndex[s.id] ?? 0}
	{@const color = seriesColor(si, s.color)}
	{@const defaultR = s.pointRadius ?? 4}
	{@const opacity = s.opacity ?? 0.8}

	{#each s.points as p, pi}
		{@const px = ctx.scaleX(p.x)}
		{@const py = ctx.scaleY(p.y)}
		{@const r = (isBubble && p.r) ? p.r : defaultR}
		{@const fill = s.pointColor ? s.pointColor(p, pi, s) : color}

		{#if fill !== 'transparent' && px >= -r && px <= ctx.inner.w + r && py >= -r && py <= ctx.inner.h + r}
			<circle
				cx={px} cy={py} r={r}
				fill={fill}
				opacity={opacity}
				stroke={fill}
				stroke-width={0.5}
				stroke-opacity={0.4}
			/>
		{/if}
	{/each}
{/each}
