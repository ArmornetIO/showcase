<script lang="ts">
	// The Storyboard family's one placeable piece: a scene replay. Storyboards
	// themselves are built from frames in the filmstrip, not dropped as items.
	import ScenePlayer from '../../scene/ScenePlayer.svelte';
	import { sceneById } from '../../scene/catalogue.js';
	import { accessors } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props, h }: RendererProps = $props();
	const { s, b } = accessors(() => props);
</script>

{#if componentId === 'ScenePlayer'}
	<!-- ScenePlayer fills its box, so it needs one; a document embed gets its
	     height from the fence's reserved `h`.
	     The fallback is for a stale id held in a saved canvas or scene file. A
	     document fence cannot reach it: `scene` is an enum, so the embed coercer
	     clamps an unknown id to the default before it arrives — which means a
	     doc naming a deleted scene quietly replays a different one. -->
	<!-- ponytail: no drift test ties committed doc fences to SCENE_IDS; add one
	     if a scene is ever renamed out from under a published document. -->
	{@const scene = sceneById(s('scene', ''))}
	{#if scene}
		<div style:width="100%" style:height="{h || 360}px" style:position="relative">
			<ScenePlayer {scene} autoplay={b('autoplay', true)} loop={b('loop')} />
		</div>
	{:else}
		<p class="slot">Unknown scene: {s('scene', '')}</p>
	{/if}
{/if}

<style>
	.slot {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--fg-dim);
		margin: 0;
	}
</style>
