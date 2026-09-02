<script lang="ts">
	// ── ASH DRIFT ────────────────────────────────────────────────────────────
	//
	// The screen looks like a photograph of something dark rather than a
	// rendered surface: there is dust in the air and it is very slowly settling.
	//
	// THE IDEA, which is one extra div: two grain layers at a 4:1 frequency
	// ratio, drifting in OPPOSITE directions at different speeds. One grain
	// layer is a Photoshop filter and reads as noise. Two counter-drifting
	// layers beat against each other slowly, and the eye reads that interference
	// as depth in the air.
	//
	// No JS at all — no `$effect`, no loop, no observer. After first paint this
	// is two repeating bitmaps on promoted layers and a compositor transform.

	import { grainUrl } from './grain.js';

	interface Props {
		/** Coarse tile size in px; the fine layer is a quarter of it. */
		scale?: number;
	}
	let { scale = 180 }: Props = $props();

	// Baked once. `$derived` only so a caller can retune `scale` live in the
	// studio; in the app these are constant for the component's lifetime.
	const coarse = $derived(grainUrl({ size: scale, frequency: 0.6, opacity: 0.55 }));
	const fine = $derived(grainUrl({ size: Math.round(scale / 4), frequency: 2.4, opacity: 0.4 }));
</script>

<div class="ash" aria-hidden="true">
	<!-- Ground: one off-centre pool so the plate is not flat. Painted once. -->
	<div class="ground"></div>

	<!-- Coarse grain, drifting one way… -->
	<div class="drift coarse" style:background-image={coarse} style:background-size="{scale}px"></div>

	<!-- …fine grain the other, and stepped rather than smooth. `steps()` is what
	     makes it read as film: grain that GLIDES is a moving texture, grain that
	     reseats is a projector. 8Hz rather than the usual 24 — calmer behind a
	     table, and a third of the repaints. -->
	<div
		class="drift fine"
		style:background-image={fine}
		style:background-size="{Math.round(scale / 4)}px"
	></div>
</div>

<style>
	.ash {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		opacity: var(--backdrop-strength);
		/* The blend modes below need a stacking context of their own, or they
		   composite against whatever the page happens to have painted. */
		isolation: isolate;
		background: var(--backdrop-ground);
	}

	.ground {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				60% 45% at 32% 28%,
				var(--ash-tint) 0%,
				transparent 70%
			),
			radial-gradient(
				70% 50% at 78% 82%,
				var(--ash-tint-2) 0%,
				transparent 72%
			);
	}

	/* Oversized so a translate never walks an edge into view. The tile repeats,
	   so the motion is seamless and the layer is never resized. */
	.drift {
		position: absolute;
		inset: -20%;
		background-repeat: repeat;
		will-change: transform;
	}

	.coarse {
		mix-blend-mode: overlay;
		opacity: var(--ash-grain);
		animation: drift-a var(--ash-drift) linear infinite alternate;
	}

	.fine {
		mix-blend-mode: soft-light;
		opacity: calc(var(--ash-grain) * 0.5);
		animation:
			drift-b calc(var(--ash-drift) * 1.55) linear infinite alternate,
			flicker 1s steps(8) infinite;
	}

	@keyframes drift-a {
		to {
			transform: translate3d(3%, 2%, 0);
		}
	}
	@keyframes drift-b {
		to {
			transform: translate3d(-2.5%, -3%, 0);
		}
	}
	/* One tile of travel, in eight discrete jumps. */
	@keyframes flicker {
		to {
			background-position: var(--ash-grain-step) 0;
		}
	}

	/* The geometry is the design; only the drift is the flourish. */
	@media (prefers-reduced-motion: reduce) {
		.drift {
			animation: none;
		}
	}
</style>
