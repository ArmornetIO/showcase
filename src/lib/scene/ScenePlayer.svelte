<script lang="ts">
	// ── ScenePlayer — what a scene looks like to an audience ──────────────────
	// The other half of the loop. Until this existed, nothing authored in the
	// editor could reach anyone: there was an exporter and no renderer.
	//
	// It shares `SceneViewport` and `SceneCaptions` with the editor, so preview
	// fidelity cannot drift from delivery — if the editor shows it, this shows it.
	// The only difference is that this one takes no input.
	import { onMount, untrack } from 'svelte';
	import type { Scene } from './types.js';
	import { sceneStateAt } from './state.js';
	import { planPlacement, placementAt, globePoseAt, type PlacementPlan } from './place.js';
	import SceneViewport from './SceneViewport.svelte';
	import SceneCaptions from './SceneCaptions.svelte';
	import type { CanvasCamera } from '../primitives/canvas-camera.js';

	let {
		scene,
		autoplay = true,
		loop = true,
		/** Sit here when not playing. The editor drives this; a kiosk never does. */
		seek = 0,
	}: { scene: Scene; autoplay?: boolean; loop?: boolean; seek?: number } = $props();

	let elapsed = $state(0);
	let playing = $state(false);
	let camera = $state<CanvasCamera | undefined>();

	// Structural half — only re-solved when the cast or arrangement changes.
	let plan = $state<PlacementPlan>({ mode: 'planar', positions: new Map() });
	const planKey = $derived(
		JSON.stringify([
			scene.layout,
			scene.hub,
			scene.objects.map((o) => [o.id, o.kind, o.place.mode, o.place.x, o.place.y, o.node?.r]),
		]),
	);
	$effect(() => {
		planKey;
		untrack(() => (plan = planPlacement(scene)));
	});

	const evaluated = $derived(sceneStateAt(scene, elapsed));
	const beatIndex = $derived(evaluated.beatIndex);
	const placement = $derived(placementAt(scene, plan, elapsed));
	const globePose = $derived(scene.layout === 'globe' ? globePoseAt(scene, elapsed) : null);
	const progress = $derived(Math.min(1, elapsed / scene.runMs));

	$effect(() => {
		const s = seek;
		if (!playing) untrack(() => (elapsed = s));
	});

	// Camera follows the beat, exactly as the editor does.
	$effect(() => {
		const i = beatIndex;
		untrack(() => {
			const b = scene.beats[i];
			if (!b || !camera) return;
			if (b.camera.kind === 'fit') camera.fitAll({ padding: 40, duration: 800 });
			else void camera.flyTo(b.camera.target, { duration: 800, zoom: b.camera.zoom });
		});
	});

	let raf = 0;
	let originAt = 0;
	function frame(now: number) {
		const t = now - originAt;
		if (t >= scene.runMs) {
			if (!loop) {
				elapsed = scene.runMs;
				playing = false;
				raf = 0;
				return;
			}
			originAt = now;
			elapsed = 0;
		} else {
			elapsed = t;
		}
		raf = requestAnimationFrame(frame);
	}

	onMount(() => {
		const kick = requestAnimationFrame(() =>
			requestAnimationFrame(() => camera?.fitAll({ padding: 40, duration: 0 })),
		);
		if (autoplay) {
			playing = true;
			originAt = performance.now();
			raf = requestAnimationFrame(frame);
		}
		return () => {
			cancelAnimationFrame(kick);
			if (raf) cancelAnimationFrame(raf);
		};
	});
</script>

<div class="player">
	<SceneViewport
		{scene}
		objects={evaluated.objects}
		bursts={evaluated.bursts}
		{placement}
		{globePose}
		globeRadius={plan.globe?.radius ?? 0}
		bind:camera
		interactive={false}
	>
		<SceneCaptions
			beat={evaluated.beat}
			{beatIndex}
			beatCount={scene.beats.length}
			{progress}
		/>
	</SceneViewport>
</div>

<style>
	.player {
		position: relative;
		display: flex;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--bg);
	}
</style>
