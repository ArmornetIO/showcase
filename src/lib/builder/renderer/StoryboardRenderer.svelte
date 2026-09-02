<script lang="ts">
	// Storyboard pieces. Three of them are containers, and the builder has no
	// nesting model, so their slot shows a `__children` string that tells you
	// what would go inside.
	import StoryboardCanvas from '$lib/storyboard/StoryboardCanvas.svelte';
	import SwimLane from '$lib/storyboard/SwimLane.svelte';
	import StoryboardFrame from '$lib/storyboard/StoryboardFrame.svelte';
	import StoryboardArrow from '$lib/storyboard/StoryboardArrow.svelte';
	import StoryboardBranch from '$lib/storyboard/StoryboardBranch.svelte';
	import { accessors } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s, b, n, e } = accessors(() => props);
</script>

{#if componentId === 'StoryboardCanvas'}
	<StoryboardCanvas title={s('title', '')}>
		<p class="slot">{s('__children', 'Drop swim lanes here.')}</p>
	</StoryboardCanvas>

{:else if componentId === 'SwimLane'}
	<SwimLane pill={s('pill', 'LANE')} label={s('label', '')} sub={s('sub', '')}>
		<p class="slot">{s('__children', 'Drop storyboard frames here.')}</p>
	</SwimLane>

{:else if componentId === 'StoryboardFrame'}
	<StoryboardFrame
		step={n('step', 1)}
		route={s('route', '/ path')}
		badge={s('badge', '')}
		badgeVariant={e('badgeVariant', 'default')}
		dashed={b('dashed')}
	>
		<p class="slot">{s('__children', 'Frame content.')}</p>
	</StoryboardFrame>

{:else if componentId === 'StoryboardArrow'}
	<StoryboardArrow label={s('label', '')} tall={b('tall')} />

{:else if componentId === 'StoryboardBranch'}
	<StoryboardBranch connector={s('connector', '↓')} label={s('label', '')}>
		<p class="slot">{s('__children', 'Branch content.')}</p>
	</StoryboardBranch>
{/if}

<style>
	.slot {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--fg-dim);
		margin: 0;
	}
</style>
