<script lang="ts">
	import Chart from '../../chart/Chart.svelte';
	import type { ChartConfig } from '../../chart/chart.types.js';

	interface SparklineProps {
		data: number[];
		color?: string;
		areaColor?: string;
		height?: number;
		class?: string;
	}

	let {
		data,
		color = 'var(--accent)',
		areaColor,
		height = 40,
		class: className = '',
	}: SparklineProps = $props();

	const config = $derived<ChartConfig>({
		type: 'sparkline',
		series: [
			{
				id: 'spark',
				label: '',
				area: true,
				color,
				...(areaColor ? { areaColor } : {}),
				points:
					data.length >= 2
						? data.map((y, i) => ({ x: i, y }))
						: [
								{ x: 0, y: 0 },
								{ x: 1, y: 0 },
							],
			},
		],
		xAxis: { type: 'linear', ticks: [], grid: false },
		yAxis: { type: 'linear', ticks: [], grid: false },
		legend: { position: 'none' },
		tooltip: { enabled: false },
		crosshair: false,
		padding: { top: 2, right: 2, bottom: 2, left: 2 },
	});
</script>

<div class="sparkline-wrap {className}" style="height: {height}px;" aria-hidden="true">
	<Chart {config} />
</div>

<style>
	.sparkline-wrap {
		width: 100%;
		display: block;
	}
</style>
