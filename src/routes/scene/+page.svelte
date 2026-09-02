<script lang="ts">
	// The scene subsystem had no page at all: ten components you could import
	// from the package and not look at. SceneBuilder mounts nine of them —
	// viewport, stage, dock, inspector, palette, captions, cue picker,
	// conversation — so the editor IS the demo for the set. ScenePlayer is the
	// tenth and the only one the editor never mounts: it is the same scene with
	// the authoring chrome taken away, which is the whole point of it.
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import SceneBuilder from '$lib/scene/SceneBuilder.svelte';
	import ScenePlayer from '$lib/scene/ScenePlayer.svelte';
	import SceneCaptions from '$lib/scene/SceneCaptions.svelte';
	import { SAMPLE_SCENE } from '$lib/scene/sample-scene.js';
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Scene — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="SceneBuilder SceneViewport SceneStage SceneDock SceneInspector ScenePalette SceneCuePicker SceneConversation">
		<h3 class="component-name">SceneBuilder</h3>
		<p class="component-desc">
			The authoring tool for a scene: a timeline of beats, cues on nodes and edges, and a canvas
			that solves placement rather than storing coordinates. Mounts the whole editing set —
			<code class="demo-code">SceneViewport</code> (which hosts
			<code class="demo-code">SceneStage</code>), <code class="demo-code">SceneDock</code>,
			<code class="demo-code">SceneInspector</code> (which hosts
			<code class="demo-code">SceneConversation</code>), <code class="demo-code">ScenePalette</code>
			and <code class="demo-code">SceneCuePicker</code>. Loaded with
			<code class="demo-code">SAMPLE_SCENE</code>: six agents, one goes dark, the mesh reroutes.
		</p>
		<div class="stage stage--tall">
			<SceneBuilder backHref="{base}/scene" />
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ScenePlayer">
		<h3 class="component-name">ScenePlayer</h3>
		<p class="component-desc">
			The same scene with the authoring chrome removed — autoplaying and looping. This is what a
			scene looks like embedded in a page or a deck, and it is the only scene component the builder
			never mounts.
		</p>
		<div class="stage">
			<ScenePlayer scene={SAMPLE_SCENE} autoplay loop />
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="SceneCaptions">
		<h3 class="component-name">SceneCaptions</h3>
		<p class="component-desc">
			The beat's caption layer on its own, at a fixed progress. Shown standalone because in the
			player it only exists for the instant its beat is on screen — which is not long enough to read
			the typography against.
		</p>
		<div class="caption-row">
			<div class="caption-cell">
				<SceneCaptions
					beat={SAMPLE_SCENE.beats[1]}
					beatIndex={1}
					beatCount={SAMPLE_SCENE.beats.length}
					progress={0.5}
				/>
			</div>
			<div class="caption-cell">
				<SceneCaptions
					beat={SAMPLE_SCENE.beats[2]}
					beatIndex={2}
					beatCount={SAMPLE_SCENE.beats.length}
					progress={0.5}
					chrome={false}
				/>
			</div>
		</div>
	</ShowcaseBlock>
</div>

<style>
	.stage {
		position: relative;
		height: 520px;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg);
	}
	.stage--tall {
		height: 720px;
	}

	.caption-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 0.75rem;
	}
	.caption-cell {
		position: relative;
		min-height: 180px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		overflow: hidden;
	}
</style>
