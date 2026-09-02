<script lang="ts">
	// Number-to-shape components: one value (or a set of segments) rendered as a
	// tile, bar, ring or step track.
	import StatTile from '$lib/display/metric/StatTile.svelte';
	import CountUp from '$lib/display/metric/CountUp.svelte';
	import PostureVerdict from '$lib/display/metric/PostureVerdict.svelte';
	import ProgressBar from '$lib/display/progress/ProgressBar.svelte';
	import RadialProgress from '$lib/display/progress/RadialProgress.svelte';
	import SteppedProgress from '$lib/display/progress/SteppedProgress.svelte';
	import StackedBar from '$lib/display/progress/StackedBar.svelte';
	import type { StackedSegment } from '$lib/display/progress/StackedBar.svelte';
	import ConsensusBar from '$lib/display/progress/ConsensusBar.svelte';
	import { accessors, parseJson } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s, b, n, e } = accessors(() => props);

	const segments = $derived(
		parseJson<StackedSegment[]>(props.segments, [
			{ label: 'Critical', value: 12, variant: 'error' },
			{ label: 'High', value: 28, variant: 'warn' },
			{ label: 'Medium', value: 45, variant: 'accent' },
			{ label: 'Low', value: 15, variant: 'success' }
		])
	);

	// `steps` is either a count ("4") or a comma-separated list of labels.
	const steps = $derived.by((): string[] | number => {
		const raw = s('steps', 'ASSESS,SCAN,ANALYZE,REPORT');
		const num = Number(raw);
		if (!isNaN(num) && raw.trim() !== '') return num;
		return raw
			.split(',')
			.map((v) => v.trim())
			.filter(Boolean);
	});
</script>

{#if componentId === 'StatTile'}
	<StatTile
		label={s('label', 'EVENTS')}
		value={s('value', '1,284')}
		sub={s('sub', '') || undefined}
		subVariant={e('subVariant', 'neutral')}
		mono={b('mono')}
	/>

{:else if componentId === 'CountUp'}
	<CountUp
		value={n('value', 1284)}
		duration={n('duration', 900)}
		decimals={n('decimals', 0)}
		separator={b('separator', true)}
		prefix={s('prefix', '')}
		suffix={s('suffix', '')}
		mono={b('mono', true)}
	/>

{:else if componentId === 'PostureVerdict'}
	<PostureVerdict
		value={n('value', 82)}
		unit={s('unit', '%')}
		prefix={s('prefix', 'You have assurance on') || undefined}
		suffix={s('suffix', 'of your critical third-party risk') || undefined}
	/>

{:else if componentId === 'ProgressBar'}
	<ProgressBar
		type={e('type', 'linear')}
		variant={e('variant', 'accent')}
		value={n('value', 65)}
		max={n('max', 100)}
		label={s('label', 'Progress')}
		size={e('size', 'md')}
		showPercent={b('showPercent', true)}
		indeterminate={b('indeterminate')}
	/>

{:else if componentId === 'RadialProgress'}
	<RadialProgress
		value={n('value', 72)}
		size={n('size', 80)}
		variant={e('variant', 'accent')}
		label={s('label', '') || undefined}
		showPercent={b('showPercent', true)}
		indeterminate={b('indeterminate')}
	/>

{:else if componentId === 'SteppedProgress'}
	<SteppedProgress
		{steps}
		current={n('current', 2)}
		stepStyle={e('stepStyle', 'blocks')}
		variant={e('variant', 'accent')}
		label={s('label', '') || undefined}
		showCount={b('showCount')}
	/>

{:else if componentId === 'StackedBar'}
	<StackedBar
		{segments}
		size={e('size', 'md')}
		showLegend={b('showLegend', true)}
		label={s('label', '') || undefined}
	/>

{:else if componentId === 'ConsensusBar'}
	<ConsensusBar pct={n('pct', 72)} label={s('label', '') || undefined} />
{/if}
