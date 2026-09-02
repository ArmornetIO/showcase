<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import type { ChartPoint, ChartSeries } from '../chart.types.js';

	// Fixed 180×180 geometry — identical to the original standalone DonutChart SVG.
	// The renderer draws in the engine's translated coordinate space; DonutChart gives
	// the engine a 180×180 box with zero padding so CX/CY/radii map 1:1 to screen px.
	const CX = 90,
		CY = 90,
		OUTER_R = 86,
		INNER_R = 60;
	const MID_R = (OUTER_R + INNER_R) / 2;

	const ctx = getChartCtx();

	interface Seg {
		series: ChartSeries;
		point: ChartPoint | undefined;
		color: string;
		pct: number;
		path: string;
		labelX: number;
		labelY: number;
	}

	function arcPath(startAngle: number, sweep: number): string {
		if (sweep >= Math.PI * 2 - 0.001) sweep = Math.PI * 2 - 0.001;
		const end = startAngle + sweep;
		const large = sweep > Math.PI ? 1 : 0;
		const cos0 = Math.cos(startAngle),
			sin0 = Math.sin(startAngle);
		const cos1 = Math.cos(end),
			sin1 = Math.sin(end);
		const x0o = (CX + OUTER_R * cos0).toFixed(2),
			y0o = (CY + OUTER_R * sin0).toFixed(2);
		const x1o = (CX + OUTER_R * cos1).toFixed(2),
			y1o = (CY + OUTER_R * sin1).toFixed(2);
		const x0i = (CX + INNER_R * cos0).toFixed(2),
			y0i = (CY + INNER_R * sin0).toFixed(2);
		const x1i = (CX + INNER_R * cos1).toFixed(2),
			y1i = (CY + INNER_R * sin1).toFixed(2);
		return `M${x0o},${y0o} A${OUTER_R},${OUTER_R} 0 ${large} 1 ${x1o},${y1o} L${x1i},${y1i} A${INNER_R},${INNER_R} 0 ${large} 0 ${x0i},${y0i} Z`;
	}

	// Each series carries one point → one slice (value = points[0].y).
	const total = $derived(
		ctx.config.series
			.filter((s) => ctx.visibleSeries.has(s.id))
			.reduce((sum, s) => sum + (s.points[0]?.y ?? 0), 0)
	);

	const segments = $derived((): Seg[] => {
		const series = ctx.config.series.filter((s) => ctx.visibleSeries.has(s.id));
		const tot = total || 1;
		let angle = -Math.PI / 2;
		return series.map((s): Seg => {
			const point = s.points[0];
			const value = point?.y ?? 0;
			const sweep = (value / tot) * Math.PI * 2;
			const midAngle = angle + sweep / 2;
			const pct = Math.round((value / tot) * 100);
			const path = arcPath(angle, sweep);
			const labelX = CX + MID_R * Math.cos(midAngle);
			const labelY = CY + MID_R * Math.sin(midAngle);
			angle += sweep;
			return { series: s, point, color: s.color ?? '#888', pct, path, labelX, labelY };
		});
	});

	const hoveredId = $derived(ctx.hover.series?.id ?? null);
</script>

{#each segments() as seg (seg.series.id)}
	{@const hot = hoveredId === seg.series.id}
	{@const dim = hoveredId !== null && !hot}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<path
		d={seg.path}
		fill={seg.color}
		class="dn-seg"
		class:hot
		class:dim
		style="color:{seg.color}"
		onmouseenter={() => {
			ctx.hover.series = seg.series;
			ctx.hover.point = seg.point ?? null;
		}}
		onmouseleave={() => {
			ctx.hover.series = null;
			ctx.hover.point = null;
		}}
	>
		<title>{seg.series.label}: {seg.pct}%</title>
	</path>
{/each}
{#each segments() as seg (seg.series.id)}
	{@const hot = hoveredId === seg.series.id}
	{@const dim = hoveredId !== null && !hot}
	<text
		x={seg.labelX.toFixed(1)}
		y={seg.labelY.toFixed(1)}
		class="dn-pct"
		class:hot
		class:dim
		text-anchor="middle"
		dominant-baseline="central">{seg.pct}%</text
	>
{/each}

<style>
	.dn-seg {
		transition:
			opacity 0.18s ease,
			transform 0.18s ease,
			filter 0.18s ease;
		transform-origin: 90px 90px;
		cursor: pointer;
	}

	.dn-seg.dim {
		opacity: 0.28;
	}

	.dn-seg.hot {
		opacity: 1;
		transform: scale(1.045);
		filter: drop-shadow(0 0 6px currentColor) drop-shadow(0 0 14px currentColor);
	}

	.dn-pct {
		font-family: var(--mono);
		font-size: 10px;
		fill: var(--text-onaccent);
		font-weight: 700;
		pointer-events: none;
		transition: opacity 0.18s ease;
	}

	.dn-pct.dim {
		opacity: 0.25;
	}

	.dn-pct.hot {
		opacity: 1;
	}
</style>
