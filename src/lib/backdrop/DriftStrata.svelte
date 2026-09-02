<script lang="ts">
	// ── DRIFT STRATA ─────────────────────────────────────────────────────────
	//
	// Layered dark atmosphere seen edge-on — a core sample, or a cross-section
	// of weather, the far layers sliding behind the near ones.
	//
	// THE IDEA: HARD slab edges. Every aurora background on the internet
	// soft-fades its blobs into one another and gets a lava lamp. Clipping each
	// blurred field to a crisp horizontal band makes you read STRATIFICATION —
	// discrete layers with boundaries — which is both more architectural and
	// thematically right for a compliance product: layers, periods, audit
	// history. One `clip-path` stands between this and the most overdone effect
	// of the decade, so it is worth defending in review.
	//
	// TWO RULES that are the difference between this looking expensive and
	// looking cheap, both from how Linear and Arc actually do it:
	//
	//   1. The blur goes on the slab CONTAINER, never on the blobs. It then
	//      rasterizes ONCE per slab instead of once per blob — and, unlike our
	//      Möbius strips' three nested per-strip filters, never per frame. That
	//      is why this is cheaper than the backdrop we already ship despite
	//      looking heavier.
	//   2. The blur radius is in `vw`. A fixed px radius that looks right on a
	//      laptop is a hard-edged smudge on a 34" display.

	import { grainUrl } from './grain.js';

	interface Props {
		/** How many bands. Three reads as strata; six reads as noise. */
		count?: number;
		/**
		 * Multiplies every band's period. The far/near SPREAD is preserved — the
		 * layers moving at different speeds is what carries the depth — so this
		 * scales the whole set rather than flattening it toward one rate.
		 */
		speed?: number;
	}
	let { count = 4, speed = 1 }: Props = $props();

	/**
	 * One slab per band, far to near.
	 *
	 * Depth is carried by four cues agreeing: further slabs are dimmer, blurrier,
	 * lower contrast and slower. Any one alone is ambiguous.
	 */
	const slabs = $derived(
		Array.from({ length: count }, (_, i) => {
			const t = count > 1 ? i / (count - 1) : 0; // 0 = far, 1 = near
			return {
				top: (i / count) * 100,
				height: 100 / count,
				opacity: 0.35 + t * 0.5,
				blur: 9 - t * 4, // vw — far is softer
				period: (150 - t * 90) / Math.max(0.05, speed), // seconds — far is slower
				hue: t
			};
		})
	);

	// One fine tile, laid over every slab at a slightly different scale per
	// depth. This is what stops a blur reading as a smear.
	const fine = grainUrl({ size: 48, frequency: 2.4, opacity: 0.35 });
</script>

<div class="strata" aria-hidden="true">
	{#each slabs as s, i (i)}
		<div
			class="slab"
			style:top="{s.top}%"
			style:height="{s.height}%"
			style:opacity={s.opacity}
			style:filter="blur({s.blur}vw)"
			style:--period="{s.period}s"
		>
			<!-- The moving wrapper is INSIDE the blurred container, so the blur is
			     not recomputed as it travels — only the already-rasterized layer
			     is transformed. Blobs are duplicated end-to-end so the loop has no
			     seam. -->
			<div class="run">
				{#each [0, 1] as copy (copy)}
					<div class="blobs" style:left="{copy * 100}%">
						<span class="blob a" style:opacity={0.5 + s.hue * 0.5}></span>
						<span class="blob b" style:opacity={0.35 + s.hue * 0.4}></span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Grain sits OUTSIDE the blurred container, or it would be blurred too
		     and stop doing its job. -->
		<div
			class="tooth"
			style:top="{s.top}%"
			style:height="{s.height}%"
			style:background-image={fine}
			style:background-size="{40 + i * 6}px"
		></div>
	{/each}
</div>

<style>
	.strata {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		isolation: isolate;
		opacity: var(--backdrop-strength);
		background: var(--backdrop-ground);
	}

	/* The hard edge. `overflow: hidden` on a band-sized box, so the blurred
	   field inside is cut cleanly rather than fading out. */
	.slab {
		position: absolute;
		left: 0;
		right: 0;
		overflow: hidden;
		mix-blend-mode: screen;
	}

	.run {
		position: absolute;
		inset: 0;
		width: 200%;
		will-change: transform;
		animation: slide var(--period) linear infinite;
	}

	.blobs {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 50%;
	}

	.blob {
		position: absolute;
		display: block;
		border-radius: 50%;
	}
	/* Far larger than the slab, so an edge never shows through the blur. */
	.blob.a {
		left: 5%;
		top: -120%;
		width: 46%;
		height: 340%;
		background: radial-gradient(
			circle,
			var(--strata-tint) 0%,
			transparent 68%
		);
	}
	.blob.b {
		left: 52%;
		top: -90%;
		width: 40%;
		height: 300%;
		background: radial-gradient(
			circle,
			var(--strata-tint-2) 0%,
			transparent 70%
		);
	}

	.tooth {
		position: absolute;
		left: 0;
		right: 0;
		background-repeat: repeat;
		mix-blend-mode: soft-light;
		opacity: var(--strata-grain);
	}

	@keyframes slide {
		to {
			transform: translate3d(-50%, 0, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.run {
			animation: none;
		}
	}
</style>
