<script lang="ts">
	// A scene, as paths. `Figure` for more than one thing — same painter, same
	// camera, one depth sort across the lot.
	//
	// It frames on the scene's own bounds rather than on a body part, because a
	// scene has no head to crop to. `fit` is the only choice a caller gets: a
	// card wants the whole picture inside its art window, and a wide shot wants
	// to fill the window and lose the edges.
	import { sceneArt, type SceneSpec } from './scene.js';

	interface Props {
		scene: SceneSpec;
		/** `meet` keeps the whole scene in frame; `slice` fills the box and lets
		 *  the overflow fall off the edges — which is what card art does. */
		fit?: 'meet' | 'slice';
		/** Pull back. Above 1 the scene sits smaller in the same box, with more
		 *  air around it. */
		zoom?: number;
		/** Nudge the framing, in fractions of the scene's own size. Positive `y`
		 *  moves the picture UP in the window, which is how you put the horizon
		 *  where you want it rather than in the middle. */
		offset?: { x?: number; y?: number };
		label?: string;
	}

	let { scene, fit = 'meet', zoom = 1, offset, label }: Props = $props();

	const a = $derived(sceneArt(scene));
	const view = $derived.by(() => {
		const w = a.box.w * zoom;
		const h = a.box.h * zoom;
		return {
			x: a.box.x - (w - a.box.w) / 2 - (offset?.x ?? 0) * a.box.w,
			y: a.box.y - (h - a.box.h) / 2 + (offset?.y ?? 0) * a.box.h,
			w,
			h
		};
	});
</script>

<svg
	viewBox="{view.x} {view.y} {view.w} {view.h}"
	preserveAspectRatio="xMidYMid {fit}"
	aria-label={label}
	role="img"
>
	{#each a.tris as t, i (i)}
		<path d={t.d} fill={t.fill} stroke={t.edge} stroke-width="0.6" stroke-linejoin="round" />
	{/each}
</svg>

<style>
	svg {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
