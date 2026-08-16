<script lang="ts">
	// Charts, tables and timelines — the components that take a dataset rather
	// than a handful of scalars. Their preview data lives in `chart-presets.ts`
	// so the fixtures don't drown the markup.
	import DataTable from '$lib/display/table/DataTable.svelte';
	import type { TableColumn } from '$lib/display/table/DataTable.svelte';
	import Timeline from '$lib/display/Timeline.svelte';
	import type { TimelineEvent } from '$lib/display/Timeline.svelte';
	import Sparkline from '$lib/display/metric/Sparkline.svelte';
	import Chart from '$lib/chart/Chart.svelte';
	import DonutChart from '$lib/chart/DonutChart.svelte';
	import { accessors, keyValues, numbers, parseJson } from './accessors.js';
	import { DONUT_SLICES, chartPreset } from './chart-presets.js';
	import type { RendererProps } from './types.js';

	let { componentId, props, h }: RendererProps = $props();
	const { s, n, e } = accessors(() => props);

	const kvRows = $derived(keyValues(s('rows', 'Vendor: Armornet\nStatus: Active')));

	const columns = $derived(
		parseJson<TableColumn[]>(props.columns, [
			{ key: 'name', header: 'Name' },
			{ key: 'status', header: 'Status' },
			{ key: 'score', header: 'Score' }
		])
	);

	const rows = $derived(
		parseJson<Record<string, unknown>[]>(props.tableRows, [
			{ name: 'threat-scraper', status: 'active', score: '94' },
			{ name: 'dep-analyzer', status: 'active', score: '87' }
		])
	);

	const events = $derived(
		parseJson<TimelineEvent[]>(props.events, [
			{ when: '2025-01-14', title: 'Agent deployed', major: true },
			{ when: '2025-01-15', title: 'First scan completed' }
		])
	);

	const sparkData = $derived(numbers(s('data', '10,24,18,42,30,55,47,62,58,71')));
</script>

{#if componentId === 'DataTable'}
	{#if e('variant', 'kv') === 'kv'}
		<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
		<DataTable variant="kv" rows={kvRows as any} />
	{:else}
		<DataTable variant="table" {columns} {rows} />
	{/if}

{:else if componentId === 'Timeline'}
	<Timeline {events} />

{:else if componentId === 'Sparkline'}
	<div style="width: {n('width', 160)}px;">
		<Sparkline data={sparkData} color={s('color', 'var(--accent)')} height={n('height', 60)} />
	</div>

{:else if componentId === 'Chart'}
	<!-- Chart fills its parent, so the canvas item's height has to be handed down. -->
	<div style:width="100%" style:height="{h || 220}px">
		<Chart config={chartPreset(e('type', 'line'))} />
	</div>

{:else if componentId === 'DonutChart'}
	<DonutChart
		title={s('title', 'Data Exposure')}
		slices={DONUT_SLICES}
		centerLabel={s('centerLabel', 'Total')}
		countLabel={s('countLabel', 'Count')}
		caption={s('caption', '') || undefined}
	/>
{/if}
