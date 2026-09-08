<script lang="ts">
	// ── The operator, wearing things ─────────────────────────────────────────
	// The figure is the REAL one: `$lib/character/Figure.svelte`, drawn from the
	// same faceted geometry the roster tiles and the board use. This component
	// does not draw a character — a second silhouette would be a second character
	// that drifts, and the whole point of a locker is that what you buy is what
	// stands on the board.
	//
	// The hat is a layer over it, and it is anchored rather than eyeballed:
	// `art()` publishes `bust`, the rect containing the head and a little
	// shoulder, in the figure's own units. Both SVGs are given the SAME viewBox
	// and the same `preserveAspectRatio`, so a coordinate in one is that
	// coordinate in the other — no matter the character, the crop or the size.
	// The alternative is a per-character pixel nudge table, which is a table that
	// is wrong the first time somebody changes the camera.
	import { art, Figure, type ArtOpts, type CharacterSkin } from 'showcase';
	import type { CosmeticItem } from './catalog.js';

	interface Props {
		skin: CharacterSkin;
		hat?: CosmeticItem;
		/** The hue the hat flies in — the banner, not the character's plate. A
		 *  cosmetic belongs to the player; the plate belongs to the class. */
		color: string;
		crop?: 'hero' | 'bust' | 'chip';
		size?: number;
		opts?: ArtOpts;
		locked?: boolean;
	}

	let { skin, hat, color, crop = 'hero', size = 168, opts, locked = false }: Props = $props();

	const a = $derived(art(skin, opts));

	// Mirrors Figure's own crop maths exactly. If that changes, this has to —
	// which is the cost of overlaying a component instead of forking it, and it
	// is much cheaper than the fork.
	const view = $derived.by(() => {
		if (crop === 'hero') return a.box;
		const h = crop === 'chip' ? a.bust.w * 0.75 : a.bust.h;
		return { ...a.bust, h };
	});
	const par = $derived(crop === 'hero' ? 'xMidYMax meet' : 'xMidYMin slice');

	// Headwear is authored in a 100×100 box with the skull centred on (50,44) at
	// radius 20. Placing it means landing that circle on the figure's head, so
	// the two numbers below are the only tuning in the file: how wide the head is
	// as a fraction of the bust, and how far down the bust its centre sits.
	const HEAD_W = 0.52;
	const HEAD_Y = 0.50;

	const place = $derived.by(() => {
		const headW = a.bust.w * HEAD_W;
		const s = headW / 40; // 40 = the skull's width in the authoring box
		const cx = a.bust.x + a.bust.w / 2;
		const cy = a.bust.y + a.bust.h * HEAD_Y;
		return `translate(${cx - 50 * s} ${cy - 44 * s}) scale(${s})`;
	});
</script>

<div class="wrap" class:locked style:width="{size}px" style:height="{size}px">
	<Figure klass={skin} {crop} art={opts} shadow={crop === 'hero'} />

	{#if hat?.art}
		<svg
			class="hat"
			viewBox="{view.x} {view.y} {view.w} {view.h}"
			preserveAspectRatio={par}
			style:color
			aria-hidden="true"
		>
			<g transform={place}>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html hat.art}
			</g>
		</svg>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
	}
	.wrap.locked {
		opacity: 0.4;
		filter: grayscale(0.85);
	}
	.hat {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		pointer-events: none;
		/* A bust crop is `slice` — it cuts at the top of the head, which is
		   exactly where a top hat is. Letting the overlay draw outside its
		   viewBox keeps the hat in the figure's coordinate space (so it stays
		   anchored) while escaping the crop that would behead it. */
		overflow: visible;
	}
</style>
