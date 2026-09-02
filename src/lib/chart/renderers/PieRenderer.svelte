<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor } from '../chart.types.js';

	const ctx = getChartCtx();

	const cx = $derived(ctx.inner.w / 2);
	const cy = $derived(ctx.inner.h / 2);
	const outerR = $derived(Math.min(ctx.inner.w, ctx.inner.h) / 2 - 8);
	// Donut hole — driven by config.donut (fraction of outer radius). 0 = solid pie.
	const innerR = $derived(outerR * Math.min(Math.max(ctx.config.donut ?? 0, 0), 0.95));

	// Use first series if multiple — pie uses series as slices (each point is a slice)
	const slices = $derived(() => {
		const series = ctx.config.series.filter((s) => ctx.visibleSeries.has(s.id));
		if (series.length === 0) return [];

		// If multiple series, use first point of each series as the slice value
		const items = series.map((s, i) => ({
			label: s.label,
			value: s.points[0]?.y ?? 0,
			color: seriesColor(i, s.color),
			series: s,
			index: i,
		}));

		const total = items.reduce((sum, s) => sum + Math.abs(s.value), 0) || 1;
		let cumAngle = -Math.PI / 2; // start at top
		return items.map((item) => {
			const sweep = (Math.abs(item.value) / total) * (Math.PI * 2);
			const start = cumAngle;
			cumAngle += sweep;
			return { ...item, start, sweep, total };
		});
	});

	function arc(start: number, sweep: number, oR: number, iR: number, cx: number, cy: number): string {
		if (sweep >= Math.PI * 2 - 0.001) sweep = Math.PI * 2 - 0.001;
		const end = start + sweep;
		const cos0 = Math.cos(start), sin0 = Math.sin(start);
		const cos1 = Math.cos(end), sin1 = Math.sin(end);
		const large = sweep > Math.PI ? 1 : 0;
		const x0o = cx + oR * cos0, y0o = cy + oR * sin0;
		const x1o = cx + oR * cos1, y1o = cy + oR * sin1;

		if (iR <= 0) {
			return [
				`M ${x0o.toFixed(2)} ${y0o.toFixed(2)}`,
				`A ${oR.toFixed(2)} ${oR.toFixed(2)} 0 ${large} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
				`L ${cx.toFixed(2)} ${cy.toFixed(2)}`,
				'Z',
			].join(' ');
		}

		const x0i = cx + iR * cos0, y0i = cy + iR * sin0;
		const x1i = cx + iR * cos1, y1i = cy + iR * sin1;
		return [
			`M ${x0o.toFixed(2)} ${y0o.toFixed(2)}`,
			`A ${oR.toFixed(2)} ${oR.toFixed(2)} 0 ${large} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
			`L ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
			`A ${iR.toFixed(2)} ${iR.toFixed(2)} 0 ${large} 0 ${x0i.toFixed(2)} ${y0i.toFixed(2)}`,
			'Z',
		].join(' ');
	}

	const hoveredId = $derived(ctx.hover.series?.id ?? null);
</script>

{#if outerR > 0}
	{#each slices() as slice}
		{@const expanded = hoveredId === slice.series.id}
		{@const midAngle = slice.start + slice.sweep / 2}
		{@const nudge = expanded ? 6 : 0}
		{@const ox = cx + nudge * Math.cos(midAngle)}
		{@const oy = cy + nudge * Math.sin(midAngle)}

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<path
			d={arc(slice.start, slice.sweep, outerR, innerR, ox, oy)}
			fill={slice.color}
			stroke="var(--bg)"
			stroke-width={2}
			opacity={hoveredId === null ? 0.9 : expanded ? 1 : 0.32}
			style:cursor="pointer"
			style:color={slice.color}
			style:filter={expanded ? 'drop-shadow(0 0 6px currentColor) drop-shadow(0 0 14px currentColor)' : 'none'}
			style:transition="opacity 0.18s ease, filter 0.18s ease"
			role="img"
			aria-label={slice.label}
			onmouseenter={() => { ctx.hover.series = slice.series; ctx.hover.point = slice.series.points[0] ?? null; }}
			onmouseleave={() => { ctx.hover.series = null; ctx.hover.point = null; }}
		/>

		<!-- Slice label for larger slices -->
		{#if slice.sweep > 0.4}
			{@const labelR = innerR > 0 ? (innerR + outerR) / 2 : outerR * 0.65}
			{@const midA = slice.start + slice.sweep / 2}
			<text
				x={(ox + labelR * Math.cos(midA)).toFixed(1)}
				y={(oy + labelR * Math.sin(midA)).toFixed(1)}
				text-anchor="middle"
				dominant-baseline="middle"
				font-size="10"
				fill="var(--bg)"
				font-family="var(--mono)"
				font-weight="600"
				pointer-events="none"
			>
				{((slice.value / slice.total) * 100).toFixed(0)}%
			</text>
		{/if}
	{/each}

{/if}
