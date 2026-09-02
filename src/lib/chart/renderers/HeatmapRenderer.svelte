<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor, type GradientStop } from '../chart.types.js';

	const ctx = getChartCtx();

	// Heatmap: x = column label, y = row label, each series provides a flat grid
	// Convention: series[0].points = flat row-major data, with x=colIndex, y=rowIndex,
	// and the point.meta.value (or p.r) as the cell value.
	// Fallback: use p.y for the value, p.x for column, series index for row.

	const activeSeries = $derived(
		ctx.config.series.filter((s) => ctx.visibleSeries.has(s.id))
	);

	const seriesIndex = $derived(
		Object.fromEntries(ctx.config.series.map((s, i) => [s.id, i]))
	);

	// Get all unique x values (columns)
	const cols = $derived(() => {
		const seen = new Set<string>();
		const vals: string[] = [];
		for (const s of activeSeries) {
			for (const p of s.points) {
				const k = String(p.x);
				if (!seen.has(k)) { seen.add(k); vals.push(k); }
			}
		}
		return vals;
	});

	// Cell dimensions
	const cellW = $derived(activeSeries.length > 0 ? ctx.inner.w / Math.max(cols().length, 1) : 0);
	const cellH = $derived(activeSeries.length > 0 ? ctx.inner.h / Math.max(activeSeries.length, 1) : 0);

	// Global value range across all series for color normalization
	const valueRange = $derived(() => {
		let min = Infinity, max = -Infinity;
		for (const s of activeSeries) {
			for (const p of s.points) {
				if (p.y < min) min = p.y;
				if (p.y > max) max = p.y;
			}
		}
		return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 1 : max };
	});

	const DEFAULT_HEATMAP_SCALE: GradientStop[] = [
		{ t: 0,    color: '#0a1628' },
		{ t: 0.25, color: '#0e3a5c' },
		{ t: 0.5,  color: '#22D3EE' },
		{ t: 0.75, color: '#FBBF24' },
		{ t: 1.0,  color: '#FB923C' },
	];

	function parseHex(hex: string): { r: number; g: number; b: number } {
		return {
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
		};
	}

	function interpolateColorScale(stops: GradientStop[], t: number): string {
		if (stops.length === 0) return 'rgb(0,0,0)';
		if (t <= stops[0].t) return stops[0].color;
		if (t >= stops[stops.length - 1].t) return stops[stops.length - 1].color;

		let lo = stops[0];
		let hi = stops[stops.length - 1];
		for (let i = 0; i < stops.length - 1; i++) {
			if (stops[i].t <= t && t <= stops[i + 1].t) {
				lo = stops[i];
				hi = stops[i + 1];
				break;
			}
		}

		const span = hi.t - lo.t;
		const f = span === 0 ? 0 : (t - lo.t) / span;
		const a = parseHex(lo.color);
		const b = parseHex(hi.color);
		const r = Math.round(a.r + f * (b.r - a.r));
		const g = Math.round(a.g + f * (b.g - a.g));
		const bv = Math.round(a.b + f * (b.b - a.b));
		return `rgb(${r},${g},${bv})`;
	}

	function valueToColor(v: number, seriesIdx: number, s: { color?: string; gradient?: GradientStop[] }): string {
		const { min, max } = valueRange();
		const t = max === min ? 0.5 : (v - min) / (max - min);

		if (s.gradient && s.gradient.length > 0) {
			return interpolateColorScale(s.gradient, t);
		}

		if (s.color && s.color.startsWith('#')) {
			return hexWithAlpha(s.color, t);
		}

		return interpolateColorScale(DEFAULT_HEATMAP_SCALE, t);
	}

	function hexWithAlpha(hex: string, t: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r},${g},${b},${(0.08 + t * 0.92).toFixed(2)})`;
	}
</script>

{#each activeSeries as s, rowIndex}
	{@const si = seriesIndex[s.id] ?? rowIndex}
	{@const color = seriesColor(si, s.color)}

	{#each s.points as p, pi}
		{@const colIndex = cols().indexOf(String(p.x))}
		{#if colIndex >= 0}
			{@const cx = colIndex * cellW}
			{@const cy = rowIndex * cellH}
			{@const fill = s.pointColor
				? s.pointColor(p, pi, s)
				: valueToColor(p.y, si, s)}

			<rect
				x={cx + 1}
				y={cy + 1}
				width={cellW - 2}
				height={cellH - 2}
				fill={fill}
				rx={2}
			/>

			{#if cellW > 28 && cellH > 16}
				<text
					x={(cx + cellW / 2).toFixed(1)}
					y={(cy + cellH / 2).toFixed(1)}
					text-anchor="middle"
					dominant-baseline="middle"
					font-size="9"
					fill="var(--fg)"
					font-family="var(--mono)"
					opacity={0.8}
				>{p.y}</text>
			{/if}
		{/if}
	{/each}

	<!-- Row label -->
	{#if cellH > 10}
		<text
			x={-6}
			y={(rowIndex * cellH + cellH / 2).toFixed(1)}
			text-anchor="end"
			dominant-baseline="middle"
			font-size="9"
			fill="var(--fg-dim)"
			font-family="var(--mono)"
		>{s.label}</text>
	{/if}
{/each}

<!-- Column labels -->
{#each cols() as col, ci}
	{#if cellW > 12}
		<text
			x={(ci * cellW + cellW / 2).toFixed(1)}
			y={ctx.inner.h + 12}
			text-anchor="middle"
			font-size="9"
			fill="var(--fg-dim)"
			font-family="var(--mono)"
		>{col}</text>
	{/if}
{/each}
