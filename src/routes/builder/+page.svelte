<script lang="ts">
	import { base } from '$app/paths';
	import Builder from '$lib/builder/Builder.svelte';
	// The route is the seam. `src/lib` may not import an example — a library that
	// reaches into one has been turned inside out — but the page that mounts both
	// may, so the studio's POV slot is filled here and nowhere else.
	import { PovPreview } from '$examples/breach/index.js';
	// BREACH's maps, for 3D scenes to import and export: the same seam as the POV.
	import { MAPS } from '$examples/breach/insider/maps.js';
</script>

<Builder {base} maps={MAPS}>
	{#snippet pov(skin, suit)}
		<PovPreview {skin} {suit} />
	{/snippet}
</Builder>
