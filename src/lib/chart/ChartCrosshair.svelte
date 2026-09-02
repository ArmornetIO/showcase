<script lang="ts">
	import { getChartCtx } from './chart-context.js';

	const ctx = getChartCtx();
</script>

{#if ctx.hover.svgX !== null}
	{@const x = ctx.hover.svgX}
	{#if x >= 0 && x <= ctx.inner.w}
		<line
			x1={x} y1={0}
			x2={x} y2={ctx.inner.h}
			stroke="var(--fg-dim)"
			stroke-width={1}
			stroke-dasharray="3,3"
			opacity={0.5}
			pointer-events="none"
		/>
		{#if ctx.hover.point && ctx.scaleX}
			{@const px = ctx.scaleX(ctx.hover.point.x)}
			{@const py = ctx.scaleY(ctx.hover.point.y)}
			{#if px >= -4 && px <= ctx.inner.w + 4 && py >= -4 && py <= ctx.inner.h + 4}
				<circle
					cx={px} cy={py}
					r={4}
					fill="var(--bg)"
					stroke="var(--accent)"
					stroke-width={1.5}
					pointer-events="none"
				/>
			{/if}
		{/if}
	{/if}
{/if}
