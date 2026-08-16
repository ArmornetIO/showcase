<script lang="ts">
	// ── /mockups/scene-player — a scene as an audience sees it ────────────────
	// The delivery half of the scene builder: a committed `Scene` rendered
	// full-bleed, autoplaying, looping, taking no input. This is the shape a real
	// destination (a QR landing page, an embedded hero) would take.
	import ScenePlayer from '$lib/scene/ScenePlayer.svelte';
	import { SAMPLE_SCENE } from '$lib/scene/sample-scene.js';
</script>

<svelte:head>
	<title>Scene Player — armornet showcase</title>
</svelte:head>

<div class="page">
	<ScenePlayer scene={SAMPLE_SCENE} />
</div>

<style>
	:global(html, body) {
		height: 100%;
		margin: 0;
		overflow: hidden;
		background: #05070c;
	}
	.page {
		position: fixed;
		inset: 0;
		background: #05070c;
	}
</style>
