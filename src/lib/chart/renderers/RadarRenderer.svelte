<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor } from '../chart.types.js';

	const ctx = getChartCtx();

	const cx = $derived(ctx.inner.w / 2);
	const cy = $derived(ctx.inner.h / 2);
	const radius = $derived(Math.min(ctx.inner.w, ctx.inner.h) / 2 - 24);

	const activeSeries = $derived(
		ctx.config.series.filter((s) => ctx.visibleSeries.has(s.id))
	);

	const seriesIndex = $derived(
		Object.fromEntries(ctx.config.series.map((s, i) => [s.id, i]))
	);

	// Axes = unique x labels across all series
	const axes = $derived(() => {
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

	// Global max for normalization
	const yMax = $derived(() => {
		let max = -Infinity;
		for (const s of activeSeries) {
			for (const p of s.points) if (p.y > max) max = p.y;
		}
		return max <= 0 ? 1 : max;
	});

	function angleAt(i: number, n: number): number {
		return (i / n) * Math.PI * 2 - Math.PI / 2;
	}

	function polarPt(angle: number, r: number): [number, number] {
		return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
	}

	function seriesPath(s: typeof activeSeries[0]): string {
		const ax = axes();
		const max = yMax();
		const n = ax.length;
		if (n === 0) return '';
		const pts = ax.map((label, i) => {
			const point = s.points.find((p) => String(p.x) === label);
			const t = point ? point.y / max : 0;
			return polarPt(angleAt(i, n), radius * Math.min(1, Math.max(0, t)));
		});
		return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
	}

	// Concentric rings for scale
	const rings = [0.25, 0.5, 0.75, 1.0];
</script>

<!-- Concentric rings -->
{#each rings as t}
	{@const ax = axes()}
	{@const n = ax.length}
	{#if n >= 3}
		{@const pts = ax.map((_, i) => polarPt(angleAt(i, n), radius * t))}
		<polygon
			points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
			fill="none"
			stroke="var(--border)"
			stroke-width={0.5}
			opacity={0.4}
		/>
	{/if}
{/each}

<!-- Axis lines + labels -->
{#each axes() as label, i}
	{@const n = axes().length}
	{@const angle = angleAt(i, n)}
	{@const [ex, ey] = polarPt(angle, radius)}
	<line
		x1={cx.toFixed(1)} y1={cy.toFixed(1)}
		x2={ex.toFixed(1)} y2={ey.toFixed(1)}
		stroke="var(--border)"
		stroke-width={0.5}
		opacity={0.4}
	/>
	{@const [lx, ly] = polarPt(angle, radius + 14)}
	<text
		x={lx.toFixed(1)} y={ly.toFixed(1)}
		text-anchor={Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'}
		dominant-baseline="middle"
		font-size="9"
		fill="var(--fg-dim)"
		font-family="var(--mono)"
	>{label}</text>
{/each}

<!-- Series polygons -->
{#each activeSeries as s}
	{@const si = seriesIndex[s.id] ?? 0}
	{@const color = seriesColor(si, s.color)}
	{@const opacity = s.opacity ?? 0.7}
	<path
		d={seriesPath(s)}
		fill={color}
		fill-opacity={opacity * 0.2}
		stroke={color}
		stroke-width={1.5}
		stroke-linejoin="round"
		opacity={opacity}
	/>
{/each}
