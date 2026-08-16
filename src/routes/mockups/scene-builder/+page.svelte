<script lang="ts">
	// ── /mockups/scene-builder ────────────────────────────────────────────────
	// The scene builder concept, built. Merges the recording layer (a spine of
	// beats + cues, everything a pure function of one clock) with the component
	// canvas (registry components rendered through the builder's own renderer).
	//
	// Full-bleed: this is a tool, not a gallery entry, so it owns the window the
	// way /builder and /model-explorer do.
	import { base } from '$app/paths';
	import SceneBuilder from '$lib/scene/SceneBuilder.svelte';
</script>

<svelte:head>
	<title>Scene Builder — armornet showcase</title>
</svelte:head>

<SceneBuilder backHref={base || '/'} />
