<script lang="ts">
	/**
	 * BreakoutStack — a container whose overlay is allowed to escape it.
	 *
	 * The composition the chrome crest does by hand, generalised: a piece of art
	 * sits over a frame, grown and lifted so it crosses the frame's own boundary.
	 * Badge treatments, hero marks, a glyph bursting out of a card.
	 *
	 * It is a LAYOUT primitive, not an effect — no filters, no paint. Pair it with
	 * SvgFx when the overlay also needs shading.
	 *
	 * The two things that make a breakout look deliberate rather than broken:
	 *
	 * · The container must NOT clip. `overflow: visible` is the whole mechanism,
	 *   and any ancestor with `overflow: hidden` (a Card, a Panel) will defeat it
	 *   no matter what this component does.
	 * · Growing alone is not enough. A shape that narrows toward the bottom —
	 *   a shield, a teardrop, a chevron — bursts its lower corners out long before
	 *   the top of the overlay reaches the top edge, so the result looks lopsided.
	 *   `lift` is the counterweight, and it is a genuine trade: too much and the
	 *   bottom rides back inside. The default leans on `lift` lightly for that
	 *   reason.
	 *
	 * Reserving space: a broken-out overlay overhangs its parent and can collide
	 * with whatever sits above. `pad` adds margin equal to the overhang so the
	 * flow makes room for it — leave it on unless the stack is absolutely
	 * positioned or deliberately overlapping.
	 *
	 * SIZING, and the one thing that trips people up: this scales the OVERLAY and
	 * never measures the container. An overlay much smaller than the container
	 * therefore cannot escape it at any `grow` — it just gets bigger inside. Size
	 * the overlay close to the container first, then dial `breakout`.
	 */
	import type { Snippet } from 'svelte';

	interface BreakoutStackProps {
		/** The frame — the thing being broken out of. Establishes the box. */
		container: Snippet;
		/** The art that escapes. Centred on the container. */
		overlay: Snippet;
		/** 0–1. How far the overlay breaks out. 0 leaves it contained. */
		breakout?: number;
		/** Overlay scale at breakout 1. 1.45 clears a shield-shaped container. */
		grow?: number;
		/** Upward shift, % of container height, at breakout 1. */
		lift?: number;
		/** Reserve flow space for the overhang. */
		pad?: boolean;
		/** Fractional origin the overlay grows about — 0.5/0.5 is its centre.
		 *  Drop it below centre to push the growth upward. */
		originX?: number;
		originY?: number;
		class?: string;
		style?: string;
	}

	let {
		container,
		overlay,
		breakout = 0.5,
		grow = 1.45,
		lift = 8,
		pad = true,
		originX = 0.5,
		originY = 0.5,
		class: cls = '',
		style = ''
	}: BreakoutStackProps = $props();

	const bo = $derived(Math.min(1, Math.max(0, breakout)));
	const scale = $derived(1 + (grow - 1) * bo);
	const rise = $derived(lift * bo);
	// Half the excess is what actually hangs off each side.
	const overhang = $derived(((scale - 1) / 2) * 100);
</script>

<div
	class="bs {cls}"
	class:bs--pad={pad && bo > 0}
	{style}
	style:--bs-scale={scale}
	style:--bs-rise="{rise}%"
	style:--bs-origin-x="{originX * 100}%"
	style:--bs-origin-y="{originY * 100}%"
	style:--bs-overhang="{overhang}%"
>
	<div class="bs__container">{@render container()}</div>
	<div class="bs__overlay">{@render overlay()}</div>
</div>

<style>
	.bs {
		position: relative;
		display: inline-grid;
		/* Both layers share one cell, so the overlay centres on the container
		   without either being positioned absolutely — which keeps the container
		   sizing the whole thing. */
		grid-template-areas: 'stack';
		place-items: center;
		overflow: visible;
	}

	.bs--pad {
		margin: var(--bs-overhang) var(--bs-overhang) 0;
	}

	.bs__container,
	.bs__overlay {
		grid-area: stack;
		line-height: 0;
	}

	.bs__overlay {
		transform: translateY(calc(var(--bs-rise) * -1)) scale(var(--bs-scale));
		transform-origin: var(--bs-origin-x) var(--bs-origin-y);
		/* Nothing under the overlay should become unclickable just because it is
		   being overlapped. */
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.bs__overlay {
			transition: none;
		}
	}
</style>
