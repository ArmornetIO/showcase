<script lang="ts">
	import { setContext, type Snippet } from 'svelte';
	import { CHART_CTX } from './chart-context.js';
	import type { ChartCtxValue, HoverState } from './chart-context.js';
	import type { ChartConfig, ChartSeries, ChartPoint } from './chart.types.js';
	import { buildScaleX, buildScaleY, linearScale, toNumber } from './chart-scales.js';
	import ChartAxis from './ChartAxis.svelte';
	import ChartLegend from './ChartLegend.svelte';
	import ChartCrosshair from './ChartCrosshair.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import ChartAnnotations from './ChartAnnotations.svelte';
	import LineRenderer from './renderers/LineRenderer.svelte';
	import BarRenderer from './renderers/BarRenderer.svelte';
	import ScatterRenderer from './renderers/ScatterRenderer.svelte';
	import PieRenderer from './renderers/PieRenderer.svelte';
	import DonutRenderer from './renderers/DonutRenderer.svelte';
	import HeatmapRenderer from './renderers/HeatmapRenderer.svelte';
	import CandlestickRenderer from './renderers/CandlestickRenderer.svelte';
	import RadarRenderer from './renderers/RadarRenderer.svelte';
	import BoxPlotRenderer from './renderers/BoxPlotRenderer.svelte';
	import WaterfallRenderer from './renderers/WaterfallRenderer.svelte';
	import HorizonRenderer from './renderers/HorizonRenderer.svelte';
	import StackedAreaRenderer from './renderers/StackedAreaRenderer.svelte';
	import GaugeRenderer from './renderers/GaugeRenderer.svelte';

	interface ChartProps {
		config: ChartConfig;
		visibleSeries?: Set<string>;
		onSeriesToggle?: (id: string, nowVisible: boolean) => void;
		/** Optional override — called after the built-in isolation logic. */
		onSeriesIsolate?: (id: string) => void;
		onPointClick?: (series: ChartSeries, point: ChartPoint) => void;
		/** Fires whenever the hovered series/point changes (null when the pointer leaves). */
		onHover?: (series: ChartSeries | null, point: ChartPoint | null) => void;
		/** Controlled hover input — set the hovered series by id (e.g. from an external legend). */
		hoverSeriesId?: string | null;
		/**
		 * Custom hover popover. When provided, this renders at the cursor in place of the
		 * default ChartTooltip. Lets any chart (donut, lollipop, heatmap) supply rich markup.
		 */
		tooltip?: Snippet<[{ series: ChartSeries; point: ChartPoint }]>;
		class?: string;
	}

	let {
		config,
		visibleSeries = $bindable(),
		onSeriesToggle,
		onSeriesIsolate,
		onPointClick,
		onHover,
		hoverSeriesId,
		tooltip,
		class: className = '',
	}: ChartProps = $props();

	function handleToggle(id: string, nowVisible: boolean) {
		if (visibleSeries === undefined) {
			if (nowVisible) _ownVisible.add(id);
			else _ownVisible.delete(id);
		}
		onSeriesToggle?.(id, nowVisible);
	}

	function handleIsolate(id: string) {
		const alreadyIsolated = config.series.every(
			(s) => (s.id === id ? effectiveVisible.has(s.id) : !effectiveVisible.has(s.id))
		);
		if (alreadyIsolated) {
			// Second long-press on isolated series → restore all
			config.series.forEach((s) => handleToggle(s.id, true));
		} else {
			config.series.forEach((s) => handleToggle(s.id, s.id === id));
		}
		onSeriesIsolate?.(id);
	}

	let rootEl = $state<HTMLDivElement | undefined>();
	let svgEl = $state<SVGSVGElement | undefined>();
	const size = $state({ w: 0, h: 0 });

	// Uncontrolled fallback — mutable so legend clicks work when no bind:visibleSeries is provided
	let _ownVisible = $state(new Set(config.series.map((s) => s.id)));
	const effectiveVisible = $derived(visibleSeries ?? _ownVisible);

	// Reconcile visibility with a series set that grows after mount (live/polling
	// charts). Any series id we've never seen becomes visible; ids the user
	// explicitly toggled off (already seen) are left hidden. No-op when controlled.
	let _seenIds = new Set(config.series.map((s) => s.id));
	$effect(() => {
		if (visibleSeries !== undefined) return; // controlled: caller owns visibility
		for (const s of config.series) {
			if (!_seenIds.has(s.id)) {
				_seenIds.add(s.id);
				_ownVisible.add(s.id);
			}
		}
	});

	const pad = $derived({
		top: config.padding?.top ?? 16,
		right: config.padding?.right ?? 24,
		bottom: config.padding?.bottom ?? 44,
		left: config.padding?.left ?? 60,
	});

	const innerW = $derived(Math.max(size.w - pad.left - pad.right, 0));
	const innerH = $derived(Math.max(size.h - pad.top - pad.bottom, 0));

	const clipId = 'cc-' + Math.random().toString(36).slice(2, 7);

	let zoomDomain = $state<[number, number] | null>(null);
	let isPanning = $state(false);
	let panStartX = $state(0);
	let panStartDomain = $state<[number, number] | null>(null);

	const zoomedConfig = $derived(
		config.zoomable && zoomDomain
			? { ...config, xAxis: { ...config.xAxis, domain: zoomDomain as [number, number] } }
			: config
	);
	const scaleX = $derived(
		innerW > 0
			? buildScaleX(zoomedConfig, effectiveVisible, innerW)
			: linearScale([0, 1], [0, 1])
	);
	const scaleY = $derived(
		innerH > 0
			? buildScaleY(config, effectiveVisible, innerH, 'left')
			: linearScale([0, 1], [1, 0])
	);
	const scaleY2 = $derived(
		config.y2Axis && innerH > 0
			? buildScaleY(config, effectiveVisible, innerH, 'right')
			: null
	);

	const hover: HoverState = $state({ svgX: null, svgY: null, series: null, point: null });

	const ctx: ChartCtxValue = $state({
		config: config,
		inner: { w: 0, h: 0 },
		pad: { top: 16, right: 24, bottom: 44, left: 60 },
		scaleX: linearScale([0, 1], [0, 1]),
		scaleY: linearScale([0, 1], [1, 0]),
		scaleY2: null,
		visibleSeries: new Set<string>(),
		hover,
	});

	$effect(() => {
		ctx.config = zoomedConfig;
		ctx.inner.w = innerW;
		ctx.inner.h = innerH;
		ctx.pad = pad;
		ctx.scaleX = scaleX;
		ctx.scaleY = scaleY;
		ctx.scaleY2 = scaleY2;
		ctx.visibleSeries = effectiveVisible;
	});

	setContext(CHART_CTX, ctx);

	// Notify consumers whenever the hovered series/point changes.
	$effect(() => {
		onHover?.(hover.series, hover.point);
	});

	// Controlled hover — an external legend can drive which slice is highlighted.
	$effect(() => {
		if (hoverSeriesId === undefined) return;
		const s = hoverSeriesId === null ? null : config.series.find((x) => x.id === hoverSeriesId) ?? null;
		hover.series = s;
		hover.point = s?.points[0] ?? null;
	});

	// Observe the SVG element itself — not the root div.
	// Observing rootEl with an explicit height={size.h} on the SVG creates a
	// feedback loop: rootEl grows → size.h updates → SVG attribute grows → rootEl grows.
	$effect(() => {
		if (!svgEl) return;
		const ro = new ResizeObserver((entries) => {
			const r = entries[0].contentRect;
			size.w = r.width;
			size.h = r.height;
		});
		ro.observe(svgEl);
		return () => ro.disconnect();
	});

	const chartType = $derived(config.type);
	const isPolar = $derived(chartType === 'pie' || chartType === 'radar' || chartType === 'donut');
	const isHeatmap = $derived(chartType === 'heatmap');
	const isCandlestick = $derived(chartType === 'candlestick');
	// A gauge has no axes, no grid and no x-domain — it shares only the box.
	const isGauge = $derived(chartType === 'gauge');
	const isCartesian = $derived(!isPolar && !isHeatmap && !isCandlestick && !isGauge);

	const showLegend = $derived(
		config.legend?.position !== 'none' && config.series.length > 0
	);
	const legendPos = $derived(config.legend?.position ?? 'top');

	function onWheel(e: WheelEvent) {
		if (!config.zoomable) return;
		e.preventDefault();
		const inv = scaleX.invert;
		if (!inv) return;
		const lo = inv(0), hi = inv(innerW);
		const span = hi - lo;
		const factor = e.deltaY > 0 ? 1.1 : 0.9;
		const rect = svgEl!.getBoundingClientRect();
		const cx = inv(e.clientX - rect.left - pad.left);
		const loPct = (cx - lo) / span;
		const hiPct = (hi - cx) / span;
		const newSpan = span * factor;
		zoomDomain = [cx - loPct * newSpan, cx + hiPct * newSpan];
	}

	function onMouseDown(e: MouseEvent) {
		if (!config.zoomable) return;
		isPanning = true;
		panStartX = e.clientX;
		const inv = scaleX.invert;
		panStartDomain = inv ? [inv(0), inv(innerW)] : null;
	}

	function onPanMove(e: MouseEvent) {
		if (!isPanning || !panStartDomain) return;
		const inv = scaleX.invert;
		if (!inv) return;
		const span = panStartDomain[1] - panStartDomain[0];
		const domainPerPx = span / innerW;
		const shift = -(e.clientX - panStartX) * domainPerPx;
		zoomDomain = [panStartDomain[0] + shift, panStartDomain[1] + shift];
	}

	function onMouseUpGlobal() {
		isPanning = false;
	}

	function onDblClick() {
		if (config.zoomable) zoomDomain = null;
	}

	function onMouseMove(e: MouseEvent) {
		if (!svgEl) return;
		if (isPanning) onPanMove(e);
		const rect = svgEl.getBoundingClientRect();
		const mx = e.clientX - rect.left - pad.left;
		const my = e.clientY - rect.top - pad.top;
		hover.svgX = mx;
		hover.svgY = my;

		// Polar/heatmap charts own their own hover via per-mark mouseenter — the
		// x-proximity search below is meaningless there and would clobber it.
		if (isPolar || isHeatmap || isGauge) return;

		// Find nearest series+point by x proximity
		const xDomain = scaleX.invert?.(mx);
		if (xDomain === undefined) return;
		let best: { series: ChartSeries; point: ChartPoint; dist: number } | null = null;
		for (const s of config.series) {
			if (!effectiveVisible.has(s.id)) continue;
			const isSpatial = ['scatter', 'bubble'].includes(s.type ?? config.type);
			for (const p of s.points) {
				const dist = isSpatial
					? Math.hypot(scaleX(p.x) - mx, scaleY(p.y) - my)
					: Math.abs(toNumber(p.x) - (xDomain ?? 0));
				if (!best || dist < best.dist) best = { series: s, point: p, dist };
			}
		}
		if (best) {
			hover.series = best.series;
			hover.point = best.point;
		}
	}

	function onMouseLeave() {
		hover.svgX = null;
		hover.svgY = null;
		hover.series = null;
		hover.point = null;
	}

	function onClick() {
		if (onPointClick && hover.series && hover.point) {
			onPointClick(hover.series, hover.point);
		}
	}
</script>

<div
	class="chart-root {className}"
	bind:this={rootEl}
>
	{#if showLegend && legendPos === 'top'}
		<ChartLegend onSeriesToggle={handleToggle} onIsolate={handleIsolate} clickMode={config.legend?.clickMode} />
	{/if}

	<div class="chart-body">
		{#if showLegend && legendPos === 'left'}
			<ChartLegend onSeriesToggle={handleToggle} onIsolate={handleIsolate} clickMode={config.legend?.clickMode} vertical />
		{/if}

		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<svg
			class="chart-svg"
			bind:this={svgEl}
			onmousemove={onMouseMove}
			onmouseleave={onMouseLeave}
			onmousedown={onMouseDown}
			onmouseup={onMouseUpGlobal}
			ondblclick={onDblClick}
			onwheel={onWheel}
			onclick={onClick}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onClick();
				}
			}}
			role="img"
			aria-label={config.series.map((s) => s.label).join(', ')}
			data-zoomable={config.zoomable || undefined}
		>
			{#if config.background}
				<rect width="100%" height="100%" fill={config.background} />
			{/if}

			<g transform="translate({pad.left},{pad.top})">
				{#if innerW > 0 && innerH > 0}
					{#if isGauge}
						<GaugeRenderer />
					{:else if isPolar}
						{#if chartType === 'radar'}
							<RadarRenderer />
						{:else if chartType === 'donut'}
							<DonutRenderer />
						{:else}
							<PieRenderer />
						{/if}
					{:else if isHeatmap}
						<HeatmapRenderer />
					{:else if isCandlestick}
						<defs>
							<clipPath id={clipId}>
								<rect width={innerW} height={innerH} />
							</clipPath>
						</defs>
						<ChartAxis />
						<g clip-path="url(#{clipId})">
							<CandlestickRenderer />
						</g>
					{:else}
						<defs>
							<clipPath id={clipId}>
								<rect width={innerW} height={innerH} />
							</clipPath>
						</defs>
						<ChartAxis />
						<g clip-path="url(#{clipId})">
							{#if config.annotations?.length}
								<ChartAnnotations />
							{/if}
							<BarRenderer />
							<LineRenderer />
							<ScatterRenderer />
							<StackedAreaRenderer />
							<WaterfallRenderer />
							<BoxPlotRenderer />
							<HorizonRenderer />
							{#if config.crosshair !== false}
								<ChartCrosshair />
							{/if}
						</g>
					{/if}
				{/if}
			</g>
		</svg>

		{#if showLegend && legendPos === 'right'}
			<ChartLegend onSeriesToggle={handleToggle} onIsolate={handleIsolate} clickMode={config.legend?.clickMode} vertical />
		{/if}
	</div>

	{#if showLegend && legendPos === 'bottom'}
		<ChartLegend onSeriesToggle={handleToggle} onIsolate={handleIsolate} clickMode={config.legend?.clickMode} />
	{/if}

	{#if (config.tooltip?.enabled ?? true) && hover.point && hover.series}
		{#if tooltip}
			<div
				class="chart-custom-tip"
				style:left="{pad.left + (hover.svgX ?? 0) + 12}px"
				style:top="{pad.top + (hover.svgY ?? 0) - 12}px"
			>
				{@render tooltip({ series: hover.series, point: hover.point })}
			</div>
		{:else}
			<ChartTooltip />
		{/if}
	{/if}
</div>

<style>
	.chart-root {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		font-family: var(--mono);
		position: relative;
		color: var(--fg);
	}

	.chart-body {
		display: flex;
		flex: 1;
		min-height: 0;
		align-items: stretch;
	}

	.chart-svg {
		flex: 1;
		display: block;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: visible;
	}

	.chart-svg[data-zoomable] {
		cursor: grab;
	}
	.chart-svg[data-zoomable]:active {
		cursor: grabbing;
	}

	.chart-custom-tip {
		position: absolute;
		z-index: 10;
		pointer-events: none;
	}

	@keyframes chart-draw-in {
		from { stroke-dashoffset: 1; opacity: 0; }
		to   { stroke-dashoffset: 0; opacity: 1; }
	}
</style>
