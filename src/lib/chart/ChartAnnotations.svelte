<script lang="ts">
	import { getChartCtx } from './chart-context.js';
	import { toNumber } from './chart-scales.js';
	import type { ChartAnnotation } from './chart.types.js';

	const ctx = getChartCtx();

	function resolve(a: ChartAnnotation): { x1: number; y1: number; x2: number; y2: number } | null {
		const { scaleX, scaleY, inner } = ctx;
		if (a.axis === 'x') {
			if (a.type === 'band') {
				const [lo, hi] = a.value as [number | Date, number | Date];
				return { x1: scaleX(lo), y1: 0, x2: scaleX(hi), y2: inner.h };
			}
			const px = scaleX(a.value as number | Date);
			return { x1: px, y1: 0, x2: px, y2: inner.h };
		} else {
			if (a.type === 'band') {
				const [lo, hi] = a.value as [number, number];
				return { x1: 0, y1: scaleY(hi), x2: inner.w, y2: scaleY(lo) };
			}
			const py = scaleY(a.value as number);
			return { x1: 0, y1: py, x2: inner.w, y2: py };
		}
	}
</script>

{#each ctx.config.annotations ?? [] as ann}
	{@const r = resolve(ann)}
	{#if r}
		{#if ann.type === 'band'}
			<rect
				x={r.x1} y={r.y1}
				width={r.x2 - r.x1} height={r.y2 - r.y1}
				fill={ann.color ?? 'var(--accent)'}
				opacity={ann.opacity ?? 0.08}
				pointer-events="none"
			/>
		{:else}
			<line
				x1={r.x1} y1={r.y1}
				x2={r.x2} y2={r.y2}
				stroke={ann.color ?? 'var(--accent)'}
				stroke-width={1}
				stroke-dasharray={ann.dashArray ?? '4,3'}
				opacity={ann.opacity ?? 0.7}
				pointer-events="none"
			/>
		{/if}
		{#if ann.label}
			<text
				x={ann.axis === 'x' ? r.x1 + 4 : ctx.inner.w - 4}
				y={ann.axis === 'x' ? 10 : r.y1 - 4}
				text-anchor={ann.axis === 'x' ? 'start' : 'end'}
				font-size="9"
				fill={ann.color ?? 'var(--accent)'}
				font-family="var(--mono)"
				letter-spacing="0.08em"
			>{ann.label}</text>
		{/if}
	{/if}
{/each}
