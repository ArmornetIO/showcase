<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor } from '../chart.types.js';
	import type { ChartSeries, GradientStop } from '../chart.types.js';
	import { toNumber, linearPath, smoothPath, areaPath } from '../chart-scales.js';

	const ctx = getChartCtx();

	type Pt = [number, number];

	function toPixels(series: ChartSeries): Pt[] {
		return series.points.map((p) => [ctx.scaleX(p.x), ctx.scaleY(p.y)] as Pt);
	}

	/** Returns the SVG y-coordinate of the zero baseline */
	function baseline(): number {
		return ctx.scaleY(0);
	}

	function gradId(series: ChartSeries): string {
		return `cg-${series.id.replace(/[^a-z0-9]/gi, '-')}`;
	}

	function areaGradId(series: ChartSeries): string {
		return `cag-${series.id.replace(/[^a-z0-9]/gi, '-')}`;
	}

	function stopOpacity(stop: GradientStop): number {
		return stop.opacity ?? 1;
	}

	/** Determine active series for this renderer */
	const activeSeries = $derived(
		ctx.config.series.filter((s) => {
			if (!ctx.visibleSeries.has(s.id)) return false;
			const t = s.type ?? ctx.config.type;
			return t === 'line' || t === 'area' || t === 'sparkline';
		})
	);

	/** For each series, determine color mode */
	function colorMode(s: ChartSeries): 'gradient' | 'pointColor' | 'solid' {
		if (s.pointColor) return 'pointColor';
		if (s.gradient?.length) return 'gradient';
		return 'solid';
	}

	/** Build per-segment path+color for pointColor mode */
	function buildSegments(
		s: ChartSeries,
		pts: Pt[]
	): { d: string; color: string }[] {
		const segs: { d: string; color: string }[] = [];
		const smooth = s.smooth ?? false;
		for (let i = 0; i < s.points.length - 1; i++) {
			const color = s.pointColor!(s.points[i], i, s);
			if (color === 'transparent') continue;
			let d: string;
			if (smooth) {
				// bezier segment for this pair using catmull-rom
				const p0 = pts[Math.max(i - 1, 0)];
				const p1 = pts[i];
				const p2 = pts[i + 1];
				const p3 = pts[Math.min(i + 2, pts.length - 1)];
				const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
				const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
				const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
				const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
				d = `M ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
			} else {
				d = `M ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} L ${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`;
			}
			segs.push({ d, color });
		}
		return segs;
	}

	function resolveAreaColor(s: ChartSeries, i: number, id: string): string {
		if (!s.areaColor) return seriesColor(i, s.color) + '22';
		if (typeof s.areaColor === 'string') return s.areaColor;
		return `url(#${areaGradId(s)})`;
	}

	const seriesIndex = $derived(
		Object.fromEntries(ctx.config.series.map((s, i) => [s.id, i]))
	);
</script>

<defs>
	{#each activeSeries as s}
		{@const si = seriesIndex[s.id] ?? 0}
		{@const base = seriesColor(si, s.color)}

		{#if colorMode(s) === 'gradient' && s.gradient}
			<!-- Stroke gradient along x-axis -->
			<linearGradient
				id={gradId(s)}
				gradientUnits="userSpaceOnUse"
				x1={0} y1={0} x2={ctx.inner.w} y2={0}
			>
				{#each s.gradient as stop}
					<stop
						offset="{(stop.t * 100).toFixed(1)}%"
						stop-color={stop.color}
						stop-opacity={stopOpacity(stop)}
					/>
				{/each}
			</linearGradient>
		{/if}

		{#if (s.area || (s.type ?? ctx.config.type) === 'area') && Array.isArray(s.areaColor)}
			<!-- Area fill gradient -->
			<linearGradient
				id={areaGradId(s)}
				gradientUnits="userSpaceOnUse"
				x1={0} y1={0} x2={ctx.inner.w} y2={0}
			>
				{#each s.areaColor as stop}
					<stop
						offset="{(stop.t * 100).toFixed(1)}%"
						stop-color={stop.color}
						stop-opacity={stop.opacity ?? 1}
					/>
				{/each}
			</linearGradient>
		{/if}
	{/each}
</defs>

{#each activeSeries as s}
	{@const si = seriesIndex[s.id] ?? 0}
	{@const pts = toPixels(s)}
	{@const base = seriesColor(si, s.color)}
	{@const showArea = s.area || (s.type ?? ctx.config.type) === 'area'}
	{@const smooth = s.smooth ?? false}
	{@const sw = s.strokeWidth ?? 1.5}
	{@const opacity = s.opacity ?? 1}
	{@const bl = baseline()}

	{#if pts.length >= 2}
		<!-- Area fill -->
		{#if showArea}
			<path
				d={areaPath(pts, bl, smooth)}
				fill={resolveAreaColor(s, si, s.id)}
				stroke="none"
				opacity={opacity}
				pointer-events="none"
			/>
		{/if}

		<!-- Line stroke -->
		{#if colorMode(s) === 'pointColor'}
			{#each buildSegments(s, pts) as seg}
				<path
					d={seg.d}
					fill="none"
					stroke={seg.color}
					stroke-width={sw}
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity={opacity}
					pointer-events="none"
					pathLength={1}
					class="line-path"
				/>
			{/each}
		{:else}
			<path
				d={smooth ? smoothPath(pts) : linearPath(pts)}
				fill="none"
				stroke={colorMode(s) === 'gradient' ? `url(#${gradId(s)})` : base}
				stroke-width={sw}
				stroke-dasharray={s.dashArray ?? ''}
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={opacity}
				pointer-events="none"
				pathLength={1}
				class="line-path"
			/>
		{/if}

		<!-- Point dots on hover -->
		{#if ctx.hover.series?.id === s.id && ctx.hover.point}
			{@const hx = ctx.scaleX(ctx.hover.point.x)}
			{@const hy = ctx.scaleY(ctx.hover.point.y)}
			<circle
				cx={hx} cy={hy} r={3.5}
				fill={base}
				stroke="var(--bg)"
				stroke-width={1.5}
				opacity={opacity}
				pointer-events="none"
			/>
		{/if}
	{/if}
{/each}

<style>
	.line-path {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: chart-draw-in 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	@keyframes chart-draw-in {
		from {
			stroke-dashoffset: 1;
		}
		to {
			stroke-dashoffset: 0;
		}
	}
</style>
