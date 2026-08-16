<script lang="ts">
	import type { DonutSlice } from './DonutChart.svelte';

	interface Props {
		slices: DonutSlice[];
		hoveredIdx?: number | null;
	}

	let { slices, hoveredIdx = $bindable(null) }: Props = $props();
</script>

<div class="donut-legend">
	{#each slices as slice, i}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="dn-leg"
			class:hot={hoveredIdx === i}
			onmouseenter={() => { hoveredIdx = i; }}
			onmouseleave={() => { hoveredIdx = null; }}
		>
			<span class="dn-key" style="background:{slice.color};color:{slice.color}"></span>
			{slice.label}
		</span>
	{/each}
</div>

<style>
	.donut-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 20px;
	}

	.dn-leg {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-muted);
		cursor: pointer;
		transition: color 0.15s ease;
		user-select: none;
		-webkit-user-select: none;
	}

	.dn-leg:hover,
	.dn-leg.hot {
		color: var(--fg);
	}

	.dn-key {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
		transition: box-shadow 0.15s ease;
	}

	.dn-leg.hot .dn-key {
		box-shadow: 0 0 8px currentColor;
	}
</style>
