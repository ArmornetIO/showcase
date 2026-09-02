<script lang="ts">
	// The character, at one of three sizes. Same paths every time — the crop is
	// the only difference between a hero and a 30px chip, because re-deriving
	// the art per size is how two views of one character stop matching.
	import { art, type ArtOpts } from './render.js';
	import type { CharacterSkin } from './characters.js';

	interface Props {
		klass: CharacterSkin;
		/** `hero` fits the whole figure; `bust` and `chip` crop to the head. */
		crop?: 'hero' | 'bust' | 'chip';
		/** A ground shadow only makes sense under a figure that has ground. */
		shadow?: boolean;
		/** Camera and suit. Omitted everywhere but the studio — a roster wants
		 *  one angle for all four, or the tiles stop being comparable. */
		art?: ArtOpts;
	}

	let { klass, crop = 'hero', shadow = false, art: opts }: Props = $props();

	const a = $derived(art(klass, opts));
	const view = $derived.by(() => {
		if (crop === 'hero') return a.box;
		const h = crop === 'chip' ? a.bust.w * 0.75 : a.bust.h;
		return { ...a.bust, h };
	});
	const gid = $derived(`fx-${klass.key}-${crop}`);
</script>

<svg
	viewBox="{view.x} {view.y} {view.w} {view.h}"
	preserveAspectRatio={crop === 'hero' ? 'xMidYMax meet' : 'xMidYMin slice'}
	aria-label={klass.name}
	role="img"
>
	{#if shadow}
		<defs>
			<filter id="{gid}-glow" x="-60%" y="-60%" width="220%" height="220%">
				<feGaussianBlur stdDeviation="2.2" result="b" />
				<feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
			</filter>
			<!-- The pool follows what the figure is EMITTING, not what it is
			     painted: a character lit red standing in its own pink glow is
			     showing two states at once. -->
			<radialGradient id="{gid}-sh">
				<stop offset="0%" stop-color={a.lamp} stop-opacity="0.5" />
				<stop offset="100%" stop-color={a.lamp} stop-opacity="0" />
			</radialGradient>
		</defs>
		<ellipse
			cx="0"
			cy={a.floor}
			rx={a.box.w * 0.42}
			ry={a.box.w * 0.09}
			fill="url(#{gid}-sh)"
		/>
	{/if}
	{#each a.tris as t, i (i)}
		<path
			d={t.d}
			fill={t.fill}
			stroke={t.edge}
			stroke-width={crop === 'hero' ? 0.5 : 0.6}
			stroke-linejoin="round"
			filter={shadow && t.glow ? `url(#${gid}-glow)` : undefined}
		/>
	{/each}
</svg>

<style>
	svg {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
