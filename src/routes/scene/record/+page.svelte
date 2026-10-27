<script lang="ts">
	// One scene, the whole window, played once: the page `scripts/record-scenes.mjs`
	// films. It holds no clock of its own — the recorder installs a fake one and
	// steps it a frame at a time, so a GIF is the scene as it plays, not as a
	// screen recorder happened to catch it.
	import { page } from '$app/state';
	import ScenePlayer from '$lib/scene/ScenePlayer.svelte';
	import { sceneById } from '$lib/scene/catalogue.js';

	const scene = $derived(sceneById(page.url.searchParams.get('id') ?? ''));
</script>

<svelte:head>
	<title>{scene?.label ?? 'Unknown scene'} — UI Lib</title>
</svelte:head>

{#if scene}
	<div class="record" data-scene={scene.id} data-run-ms={scene.runMs}>
		<ScenePlayer {scene} loop={false} />
	</div>
{:else}
	<p class="missing">No scene with that id.</p>
{/if}

<style>
	.record {
		position: fixed;
		inset: 0;
	}
	.missing {
		padding: 24px;
		color: var(--fg-muted);
	}
</style>
