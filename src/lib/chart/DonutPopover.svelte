<script lang="ts">
	import type { DonutSlice } from './DonutChart.svelte';

	interface Props {
		slice: DonutSlice;
		pct: number;
		/** Row label for the count/value row */
		countLabel?: string;
		/** When true, render in normal flow (for use inside a positioned tooltip container). */
		inline?: boolean;
	}

	let { slice, pct, countLabel = 'Count', inline = false }: Props = $props();
</script>

<div
	class="donut-pop on"
	class:inline
	style={slice.haloRgb ? `--halo-rgb:${slice.haloRgb}` : ''}
>
	<div class="dp-head">
		<span class="dp-dot" style="background:{slice.color};color:{slice.color}"></span>
		<span class="dp-name">{slice.label}</span>
	</div>
	<div class="dp-row"><span>Share</span><span class="dp-v">{pct}%</span></div>
	<div class="dp-row"><span>{countLabel}</span><span class="dp-v">{slice.value.toLocaleString()}</span></div>
	<div class="dp-bar">
		<i style="width:{pct}%;background:{slice.color};color:{slice.color}"></i>
	</div>
</div>

<style>
	.donut-pop {
		position: absolute;
		z-index: 30;
		top: 4px;
		left: calc(100% + 2px);
		width: 178px;
		background: var(--bg-elev);
		backdrop-filter: blur(20px);
		border: 1px solid var(--border-strong);
		padding: 13px 14px;
		opacity: 0;
		transform: translateX(-6px);
		pointer-events: none;
		transition:
			opacity 0.18s ease,
			transform 0.18s ease;
		clip-path: polygon(
			10px 0,
			100% 0,
			100% calc(100% - 10px),
			calc(100% - 10px) 100%,
			0 100%,
			0 10px
		);
		box-shadow: 0 14px 40px -10px rgba(0, 0, 0, 0.6);
	}

	.donut-pop::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(
			90deg,
			rgb(var(--halo-rgb)),
			transparent
		);
	}

	.donut-pop.on {
		opacity: 1;
		transform: translateX(0);
	}

	.donut-pop.inline {
		position: static;
		top: auto;
		left: auto;
		transform: none;
	}

	.dp-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}

	.dp-dot {
		width: 9px;
		height: 9px;
		border-radius: 2px;
		flex-shrink: 0;
		box-shadow: 0 0 7px currentColor;
	}

	.dp-name {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg);
	}

	.dp-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--fg-dim);
		margin-top: 5px;
	}

	.dp-row .dp-v {
		color: var(--fg);
	}

	.dp-bar {
		height: 4px;
		border-radius: 2px;
		background: var(--surface-raised);
		margin-top: 10px;
		overflow: hidden;
	}

	.dp-bar i {
		display: block;
		height: 100%;
		border-radius: 2px;
		box-shadow: 0 0 8px currentColor;
		transition: width 0.3s ease;
	}
</style>
