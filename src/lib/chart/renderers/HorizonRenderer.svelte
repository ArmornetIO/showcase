<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor } from '../chart.types.js';
	import type { ChartSeries } from '../chart.types.js';

	const ctx = getChartCtx();

	// Unique clip-path ID — generated once at module evaluation time
	const clipId = 'hz-' + Math.random().toString(36).slice(2, 7);

	// Number of bands: honour ctx.config.yAxis?.ticks if it's a plain number, else 3
	const N = $derived((): number => {
		const t = ctx.config.yAxis?.ticks;
		return typeof t === 'number' && t > 0 ? t : 3;
	});

	// Negative-value band color (rose/orange)
	const NEG_COLOR = '#FB923C';

	/** Active horizon series */
	const activeSeries = $derived(
		ctx.config.series.filter((s) => {
			if (!ctx.visibleSeries.has(s.id)) return false;
			const t = s.type ?? ctx.config.type;
			return (t as string) === 'horizon';
		})
	);

	const seriesIndex = $derived(
		Object.fromEntries(ctx.config.series.map((s, i) => [s.id, i]))
	);

	/** Per-series derived rendering data */
	type BandPath = {
		d: string;
		fill: string;
		opacity: number;
	};

	type SeriesRender = {
		s: ChartSeries;
		color: string;
		bands: BandPath[];
	};

	function buildSeriesRender(s: ChartSeries, si: number, n: number): SeriesRender {
		const color = seriesColor(si, s.color);
		const pts = s.points;

		if (pts.length === 0) return { s, color, bands: [] };

		// Compute yMax as max absolute value across all points
		let yMax = 0;
		for (const p of pts) {
			const abs = Math.abs(p.y);
			if (abs > yMax) yMax = abs;
		}
		if (yMax === 0) return { s, color, bands: [] };

		const bandSize = yMax / n;
		const h = ctx.inner.h;
		const bands: BandPath[] = [];

		for (let k = 0; k < n; k++) {
			const bandLo = k * bandSize;
			const opacity = 0.3 + k * 0.25;

			// --- Positive band ---
			{
				const topEdge: [number, number][] = pts.map((p) => {
					const clamped = Math.min(Math.max(p.y - bandLo, 0), bandSize);
					const svgY = h - (clamped / bandSize) * h;
					return [ctx.scaleX(p.x), svgY];
				});

				// Only emit the band if it has any visible area
				const hasArea = topEdge.some(([, y]) => y < h);
				if (hasArea) {
					const d = buildAreaPath(topEdge, h);
					bands.push({ d, fill: color, opacity });
				}
			}

			// --- Negative band ---
			{
				const topEdge: [number, number][] = pts.map((p) => {
					const clamped = Math.min(Math.max(-p.y - bandLo, 0), bandSize);
					const svgY = h - (clamped / bandSize) * h;
					return [ctx.scaleX(p.x), svgY];
				});

				const hasArea = topEdge.some(([, y]) => y < h);
				if (hasArea) {
					const d = buildAreaPath(topEdge, h);
					bands.push({ d, fill: NEG_COLOR, opacity });
				}
			}
		}

		return { s, color, bands };
	}

	/**
	 * Build an SVG area path:
	 * - Top edge: M x0 y0 L x1 y1 ... L xN yN
	 * - Close down to baseline and back to start
	 */
	function buildAreaPath(topEdge: [number, number][], baseline: number): string {
		if (topEdge.length === 0) return '';

		const [x0, y0] = topEdge[0];
		let d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;

		for (let i = 1; i < topEdge.length; i++) {
			const [x, y] = topEdge[i];
			d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
		}

		// Close down to baseline, then back to start
		const [xLast] = topEdge[topEdge.length - 1];
		d += ` L ${xLast.toFixed(1)} ${baseline.toFixed(1)}`;
		d += ` L ${x0.toFixed(1)} ${baseline.toFixed(1)}`;
		d += ' Z';

		return d;
	}

	const renders = $derived(
		activeSeries.map((s) => {
			const si = seriesIndex[s.id] ?? 0;
			return buildSeriesRender(s, si, N());
		})
	);
</script>

<defs>
	<clipPath id={clipId}>
		<rect x={0} y={0} width={ctx.inner.w} height={ctx.inner.h} />
	</clipPath>
</defs>

{#each renders as r}
	<!-- Baseline -->
	<line
		x1={0}
		y1={ctx.inner.h}
		x2={ctx.inner.w}
		y2={ctx.inner.h}
		stroke={r.color}
		stroke-width={0.5}
		opacity={0.3}
		pointer-events="none"
	/>

	<g clip-path="url(#{clipId})" pointer-events="none">
		{#each r.bands as band}
			<path
				d={band.d}
				fill={band.fill}
				opacity={band.opacity}
				stroke="none"
			/>
		{/each}
	</g>
{/each}
