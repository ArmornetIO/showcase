<script lang="ts">
	// ── ISOLINE TERRAIN ──────────────────────────────────────────────────────
	//
	// A survey of something: contour lines of a landscape you cannot see,
	// faintly alive.
	//
	// THE IDEA: iso-levels drive COLOUR AND WEIGHT, not just position. Every
	// topographic background on the internet strokes every contour identically
	// and gets wallpaper. Mapping level → weight → opacity → hue is what turns a
	// pattern into a landscape with a light direction — and it gives the theme a
	// real handle, since retinting the accent moves the "peaks" and nothing else.
	//
	// Geometry is computed ONCE at module scope, not per mount: the field is
	// seeded and deterministic, so every instance draws the same terrain and the
	// marching-squares pass is paid a single time for the whole session.

	import { traceIsolines } from './isolines.js';

	interface Props {
		/** Iso-levels. More is busier, not deeper. */
		levels?: number;
		/** Field seed — a different landscape, same character. */
		seed?: number;
	}
	let { levels = 8, seed = 7 }: Props = $props();

	const paths = $derived(traceIsolines({ levels, seed }));

	/**
	 * Which contours get the crawling tick.
	 *
	 * Animating `stroke-dashoffset` forces a repaint of that path's tile, so
	 * this is capped hard rather than applied to every accent path — the scope
	 * doc's own warning, and the difference between a cheap backdrop and a
	 * hundred repainting tiles.
	 */
	const flowing = $derived(new Set(paths.filter((p) => p.depth > 0.72).slice(0, 6)));
</script>

<div class="terrain" aria-hidden="true">
	<!-- `preserveAspectRatio="none"` so the layer has no intrinsic size and
	     stretches to `inset: 0`. The terrain distorts with the viewport, which
	     for an abstract field is a feature: no letterboxing, no resize pass. -->
	<svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
		{#each paths as p, i (i)}
			<path
				d={p.d}
				class:flow={flowing.has(p)}
				style:stroke={p.depth > 0.72
					? 'var(--isoline-peak)'
					: 'var(--isoline-line)'}
				style:stroke-width={(0.5 + p.depth * 1.6).toFixed(2)}
				style:opacity={(0.18 + p.depth * 0.82).toFixed(2)}
				style:animation-delay="calc(var(--isoline-flow-period) * -{(i % 6) / 6})"
			/>
		{/each}
	</svg>

	<div class="vignette"></div>
</div>

<style>
	.terrain {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		opacity: var(--backdrop-strength);
		background: var(--backdrop-ground);
	}

	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	path {
		fill: none;
		stroke-linecap: round;
		/* Non-scaling so the raked viewBox does not squash line weight along one
		   axis — the whole point of the weight ramp is that it reads as depth. */
		vector-effect: non-scaling-stroke;
	}

	/* A single faint tick crawling a handful of contours. A long gap against a
	   short mark: present but intermittent, which is the mesh's own vocabulary
	   for "something is moving through this". */
	.flow {
		stroke-dasharray: 3 260;
		animation: crawl var(--isoline-flow-period) linear infinite;
	}

	@keyframes crawl {
		to {
			stroke-dashoffset: -263;
		}
	}

	.vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 75% 65% at 50% 45%,
			transparent 0%,
			var(--backdrop-ground) 100%
		);
	}

	@media (prefers-reduced-motion: reduce) {
		.flow {
			animation: none;
		}
	}
</style>
