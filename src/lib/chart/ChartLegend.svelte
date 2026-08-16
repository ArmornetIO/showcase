<script lang="ts">
	import { getChartCtx } from './chart-context.js';
	import { seriesColor } from './chart.types.js';

	interface Props {
		onSeriesToggle?: (id: string, nowVisible: boolean) => void;
		onIsolate?: (id: string) => void;
		clickMode?: 'toggle' | 'isolate';
		vertical?: boolean;
	}

	let { onSeriesToggle, onIsolate, clickMode = 'toggle', vertical = false }: Props = $props();

	const ctx = getChartCtx();

	const LONG_PRESS_MS = 350;

	let pressingId = $state<string | null>(null);
	let longFired = false;
	let pressTimer: ReturnType<typeof setTimeout> | undefined;

	function toggle(id: string) {
		onSeriesToggle?.(id, !ctx.visibleSeries.has(id));
	}

	function onPointerDown(id: string, e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		longFired = false;
		pressingId = id;
		pressTimer = setTimeout(() => {
			longFired = true;
			pressingId = null;
			onIsolate?.(id);
		}, LONG_PRESS_MS);
	}

	function onPointerUp(id: string, e: PointerEvent) {
		clearTimeout(pressTimer);
		const wasLong = longFired;
		pressingId = null;
		longFired = false;
		if (!wasLong) {
			clickMode === 'isolate' ? onIsolate?.(id) : toggle(id);
		}
	}

	function onPointerCancel() {
		clearTimeout(pressTimer);
		pressingId = null;
		longFired = false;
	}
</script>

<div class="legend" class:legend--vertical={vertical}>
	{#each ctx.config.series as series, i}
		{@const active = ctx.visibleSeries.has(series.id)}
		{@const color = seriesColor(i, series.color)}
		{@const pressing = pressingId === series.id}
		<button
			class="legend-item"
			class:legend-item--inactive={!active}
			class:legend-item--pressing={pressing}
			style:--press-color={color}
			onpointerdown={(e) => onPointerDown(series.id, e)}
			onpointerup={(e) => onPointerUp(series.id, e)}
			onpointercancel={onPointerCancel}
			type="button"
			title="Click to toggle · Hold to isolate"
		>
			<span class="legend-swatch" style:background={color} style:opacity={active ? 1 : 0.35}></span>
			<span class="legend-label">{series.label}</span>
		</button>
	{/each}
</div>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		padding: 4px 8px;
		align-items: center;
	}

	.legend--vertical {
		flex-direction: column;
		align-items: flex-start;
		padding: 0 12px 0 0;
	}

	.legend-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 6px;
		border-radius: 2px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		transition: color 0.15s, opacity 0.15s;
		white-space: nowrap;
		overflow: hidden;
		user-select: none;
		-webkit-user-select: none;
	}

	.legend-item:hover {
		color: var(--fg);
		background: var(--bg-elev);
	}

	.legend-item--inactive {
		opacity: 0.45;
	}

	/* Long-press progress bar sweeps across the bottom in exactly LONG_PRESS_MS */
	.legend-item--pressing::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		height: 2px;
		width: 0;
		background: var(--press-color, var(--fg));
		animation: legend-charge 350ms linear forwards;
		border-radius: 0 1px 1px 0;
	}

	@keyframes legend-charge {
		from { width: 0; }
		to   { width: 100%; }
	}

	.legend-swatch {
		display: block;
		width: 8px;
		height: 8px;
		border-radius: 1px;
		flex-shrink: 0;
		transition: opacity 0.15s;
	}
</style>
