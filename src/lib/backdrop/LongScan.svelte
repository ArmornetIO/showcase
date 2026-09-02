<script lang="ts">
	// ── LONG SCAN ────────────────────────────────────────────────────────────
	//
	// A dead-still machined plate, and every forty seconds a slow raking light
	// crosses it and you notice the surface has a texture you had stopped
	// seeing.
	//
	// Deliberately the most static of the family. A page of dense tables can
	// tolerate exactly one moving thing, so there is exactly one: the sweep.
	// Nothing else in this component has an animation.
	//
	// THE IDEA: the hatch spacing is IRREGULAR. Even spacing is a pattern and
	// the eye files it away as "texture applied"; unequal stops read as a milled
	// physical surface, and that is the only reason the sweep is worth having —
	// it needs something to rake across. A sweep over a flat gradient is a
	// loading skeleton.

	interface Props {
		/** Hatch angle in degrees. */
		angle?: number;
	}
	let { angle = 17 }: Props = $props();
</script>

<div class="scan" aria-hidden="true" style:--angle="{angle}deg">
	<!-- The plate. Four stops at 3/7/4/11px — not a rhythm. -->
	<div class="plate"></div>

	<!-- Vignette, so the hatching dies before it reaches the sidenav or a
	     drawer edge and never competes with real chrome. -->
	<div class="vignette"></div>

	<!-- The one moving thing. Masked by the same vignette, so the light dies at
	     the edges too rather than sliding off a hard boundary. -->
	<div class="sweep"></div>
</div>

<style>
	.scan {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		isolation: isolate;
		opacity: var(--backdrop-strength);
		background: var(--backdrop-ground);
	}

	.plate {
		position: absolute;
		inset: -30%;
		background: repeating-linear-gradient(
			var(--angle),
			var(--backdrop-line) 0 1px,
			transparent 1px 3px,
			var(--backdrop-line) 3px 4px,
			transparent 4px 11px,
			var(--backdrop-line) 11px 12px,
			transparent 12px 19px
		);
	}

	.vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 70% 60% at 50% 40%,
			transparent 0%,
			var(--backdrop-ground) 100%
		);
	}

	/* Wider than the viewport so the band is fully off-screen at both ends of
	   its travel and never pops in. */
	.sweep {
		position: absolute;
		top: -10%;
		bottom: -10%;
		left: -60%;
		width: 60%;
		mix-blend-mode: screen;
		background: linear-gradient(
			100deg,
			transparent 0%,
			var(--scan-sweep) 45%,
			var(--scan-sweep) 55%,
			transparent 100%
		);
		mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 0%, transparent 100%);
		-webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 0%, transparent 100%);
		will-change: transform;
		animation: rake var(--scan-sweep-period) linear infinite;
	}

	@keyframes rake {
		to {
			transform: translate3d(270%, 0, 0);
		}
	}

	/*
	 * Reduced motion parks the light rather than removing it. The composition is
	 * a lit plate; with no light source at all the hatching has nothing to catch
	 * and the whole thing reads as an empty grey field. Geometry stays, motion
	 * goes — and here the light IS geometry.
	 */
	@media (prefers-reduced-motion: reduce) {
		.sweep {
			animation: none;
			transform: translate3d(160%, 0, 0);
			opacity: 0.6;
		}
	}
</style>
