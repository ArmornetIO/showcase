<script lang="ts">
	import { getChartCtx } from './chart-context.js';
	import { generateLinearTicks, generateLogTicks, generateTimeTicks, defaultFormat, toNumber } from './chart-scales.js';

	const ctx = getChartCtx();

	const ticks = $derived.by(() => {
		const { config, inner, scaleX, scaleY, scaleY2, visibleSeries } = ctx;
		const xCfg = config.xAxis;
		const yCfg = config.yAxis;
		const y2Cfg = config.y2Axis;

		// X ticks
		const xDomain = scaleX.invert
			? [scaleX.invert(0), scaleX.invert(inner.w)] as [number, number]
			: [0, 1] as [number, number];

		let xTickVals: (number | Date | string)[];
		if (xCfg?.type === 'band') {
			const seen = new Set<string>();
			const bandVals: string[] = [];
			for (const s of config.series) {
				if (!visibleSeries.has(s.id)) continue;
				for (const p of s.points) {
					const k = String(p.x);
					if (!seen.has(k)) { seen.add(k); bandVals.push(k); }
				}
			}
			xTickVals = bandVals;
		} else if (Array.isArray(xCfg?.ticks)) {
			xTickVals = xCfg.ticks as (number | Date)[];
		} else if (xCfg?.type === 'time') {
			xTickVals = generateTimeTicks(xDomain, typeof xCfg.ticks === 'number' ? xCfg.ticks : 6);
		} else if (xCfg?.type === 'log') {
			xTickVals = generateLogTicks(xDomain, typeof xCfg.ticks === 'number' ? xCfg.ticks : 5);
		} else {
			xTickVals = generateLinearTicks(xDomain, typeof xCfg?.ticks === 'number' ? xCfg.ticks : 5);
		}

		// Y ticks
		const yDomain = scaleY.invert
			? [scaleY.invert(inner.h), scaleY.invert(0)] as [number, number]
			: [0, 1] as [number, number];

		let yTickVals: number[];
		if (Array.isArray(yCfg?.ticks)) {
			yTickVals = yCfg.ticks as number[];
		} else if (yCfg?.type === 'log') {
			yTickVals = generateLogTicks(yDomain, typeof yCfg?.ticks === 'number' ? yCfg.ticks : 5);
		} else {
			yTickVals = generateLinearTicks(yDomain, typeof yCfg?.ticks === 'number' ? yCfg.ticks : 5);
		}

		// Y2 ticks
		let y2TickVals: number[] = [];
		if (y2Cfg && scaleY2) {
			const y2Domain = scaleY2.invert
				? [scaleY2.invert(inner.h), scaleY2.invert(0)] as [number, number]
				: [0, 1] as [number, number];
			y2TickVals = Array.isArray(y2Cfg.ticks)
				? (y2Cfg.ticks as number[])
				: generateLinearTicks(y2Domain, typeof y2Cfg.ticks === 'number' ? y2Cfg.ticks : 5);
		}

		return { xTickVals, yTickVals, y2TickVals };
	});

	function fmtX(v: number | Date): string {
		const cfg = ctx.config.xAxis;
		if (cfg?.format) return cfg.format(v);
		return defaultFormat(v, cfg?.unit);
	}

	function fmtY(v: number): string {
		const cfg = ctx.config.yAxis;
		if (cfg?.format) return cfg.format(v);
		return defaultFormat(v, cfg?.unit);
	}

	function fmtY2(v: number): string {
		const cfg = ctx.config.y2Axis;
		if (cfg?.format) return cfg.format(v);
		return defaultFormat(v, cfg?.unit);
	}

	const gridColor = $derived(ctx.config.yAxis?.gridColor ?? 'var(--border)');
	const showGrid = $derived(ctx.config.yAxis?.grid !== false);
	const showXGrid = $derived(ctx.config.xAxis?.grid === true);
	const showZeroLine = $derived(ctx.config.yAxis?.zeroLine !== false);
</script>

<!-- Y grid + ticks -->
{#each ticks.yTickVals as tv}
	{@const py = ctx.scaleY(tv)}
	{#if py >= -1 && py <= ctx.inner.h + 1}
		{#if showGrid}
			<line
				x1={0} y1={py}
				x2={ctx.inner.w} y2={py}
				stroke={tv === 0 && showZeroLine ? 'var(--fg-dim)' : gridColor}
				stroke-width={tv === 0 && showZeroLine ? 1 : 0.5}
				stroke-dasharray={tv === 0 ? '' : '3,3'}
				opacity={tv === 0 ? 0.5 : 0.35}
			/>
		{/if}
		<!-- Y label -->
		<text
			x={-8} y={py}
			text-anchor="end"
			dominant-baseline="middle"
			font-size="10"
			fill="var(--fg-dim)"
			font-family="var(--mono)"
		>{fmtY(tv)}</text>
	{/if}
{/each}

<!-- X grid + ticks -->
{#each ticks.xTickVals as tv}
	{@const bandOffset = typeof tv === 'string' ? (ctx.scaleX.bandwidth ?? 0) / 2 : 0}
	{@const px = ctx.scaleX(tv) + bandOffset}
	{@const label = typeof tv === 'string' ? (ctx.config.xAxis?.format ? ctx.config.xAxis.format(tv as unknown as number) : tv) : fmtX(tv as number | Date)}
	{#if px >= -1 && px <= ctx.inner.w + 1}
		{#if showXGrid}
			<line
				x1={px} y1={0}
				x2={px} y2={ctx.inner.h}
				stroke={gridColor}
				stroke-width={0.5}
				stroke-dasharray="3,3"
				opacity={0.35}
			/>
		{/if}
		<!-- X label -->
		<text
			x={px} y={ctx.inner.h + 14}
			text-anchor="middle"
			font-size="10"
			fill="var(--fg-dim)"
			font-family="var(--mono)"
		>{label}</text>
		<!-- Tick mark -->
		<line
			x1={px} y1={ctx.inner.h}
			x2={px} y2={ctx.inner.h + 4}
			stroke="var(--fg-dim)"
			stroke-width={0.5}
			opacity={0.5}
		/>
	{/if}
{/each}

<!-- Axis lines -->
<line
	x1={0} y1={ctx.inner.h}
	x2={ctx.inner.w} y2={ctx.inner.h}
	stroke="var(--border)"
	stroke-width={1}
	opacity={0.6}
/>
<line
	x1={0} y1={0}
	x2={0} y2={ctx.inner.h}
	stroke="var(--border)"
	stroke-width={1}
	opacity={0.6}
/>

<!-- Y axis label -->
{#if ctx.config.yAxis?.label}
	<text
		transform="rotate(-90) translate({-ctx.inner.h / 2}, {-ctx.pad.left + 12})"
		text-anchor="middle"
		font-size="10"
		fill="var(--fg-dim)"
		font-family="var(--mono)"
		letter-spacing="0.1em"
	>{ctx.config.yAxis.label}</text>
{/if}

<!-- X axis label -->
{#if ctx.config.xAxis?.label}
	<text
		x={ctx.inner.w / 2}
		y={ctx.inner.h + ctx.pad.bottom - 4}
		text-anchor="middle"
		font-size="10"
		fill="var(--fg-dim)"
		font-family="var(--mono)"
		letter-spacing="0.1em"
	>{ctx.config.xAxis.label}</text>
{/if}

<!-- Secondary Y axis -->
{#if ctx.scaleY2 && ctx.config.y2Axis}
	{#each ticks.y2TickVals as tv}
		{@const py = ctx.scaleY2(tv)}
		{#if py >= -1 && py <= ctx.inner.h + 1}
			<text
				x={ctx.inner.w + 8} y={py}
				text-anchor="start"
				dominant-baseline="middle"
				font-size="10"
				fill="var(--fg-dim)"
				font-family="var(--mono)"
			>{fmtY2(tv)}</text>
		{/if}
	{/each}
	<line
		x1={ctx.inner.w} y1={0}
		x2={ctx.inner.w} y2={ctx.inner.h}
		stroke="var(--border)"
		stroke-width={1}
		opacity={0.6}
	/>
{/if}
