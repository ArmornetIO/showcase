<script lang="ts">
	// ── SHEAR WEAVE ──────────────────────────────────────────────────────────
	//
	// A diagonal pool of accent light with a fine lattice laid across it, and
	// the lattice is very slowly shearing — one axis sliding against the other,
	// so the interference between them breathes instead of sitting still.
	//
	// WHERE IT CAME FROM. The landing page's answer panel carried its own
	// background: a hand-written `linear-gradient(160deg, …)` in accent teal,
	// typed at the call site. A gradient in a page's stylesheet is a private
	// opinion about what the brand's surface is, and it cannot be themed,
	// stacked, or turned off. This is that idea rebuilt as a family — same
	// diagonal pool of accent, now a member of the set.
	//
	// THE IDEA: the two line sets are NOT perpendicular. At 90° the eye reads
	// graph paper, files it as "grid applied", and stops seeing it; off-square
	// it reads as woven cloth seen at an angle, and the moiré where the two
	// sets disagree is the thing worth looking at. The shear animation exists
	// only to move that moiré — the lines themselves travel far too slowly to
	// register as motion, which is the point. Nothing here should be noticed
	// while text is being read.

	interface Props {
		/** Lattice spacing. Below ~14px the two sets fuse into flat tone. */
		gap?: number;
		/** Angle of the first line set. The second is offset off-square. */
		angle?: number;
	}
	let { gap = 26, angle = 22 }: Props = $props();
</script>

<div class="weave" aria-hidden="true" style:--gap="{gap}px" style:--angle="{angle}deg">
	<!-- The pool. The ported gradient, kept diagonal and kept off-centre: a
	     centred wash reads as a vignette's inverse and flattens the panel. -->
	<div class="pool"></div>

	<!-- The two line sets. Separate elements rather than two backgrounds on one,
	     because they have to travel in opposite directions and a single element
	     has one transform. -->
	<div class="warp"></div>
	<div class="weft"></div>

	<!-- Dies before the edges, so the lattice never terminates against real
	     chrome — a hairline grid cut off by a border reads as a rendering bug. -->
	<div class="vignette"></div>
</div>

<style>
	.weave {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		isolation: isolate;
		opacity: var(--backdrop-strength);
		background: var(--backdrop-ground);
	}

	/* ONE gradient, at the angle it was ported from. It was briefly two — a radial
	   lift over the linear — and two washes of the same token composite to about
	   twice the alpha the token says, which is how a backdrop meant to sit under
	   text ends up being the brightest thing on the panel. If this needs more
	   presence, raise `--shear-pool`, where the number is visible. */
	.pool {
		position: absolute;
		inset: 0;
		background: linear-gradient(160deg, var(--shear-pool), transparent 55%);
	}

	/* Inset well past the box on every side: these are rotated and translated,
	   and a layer sized to the box shows its own corner sweeping through. */
	.warp,
	.weft {
		position: absolute;
		inset: -60%;
		opacity: var(--shear-weave);
		will-change: transform;
	}

	.warp {
		background: repeating-linear-gradient(
			var(--angle),
			var(--shear-line) 0 1px,
			transparent 1px var(--gap)
		);
		animation: shear-a var(--shear-period) linear infinite;
	}

	/* 74°, not 90°. See the header: square is graph paper. The odd number also
	   keeps the two sets from sharing a common period, so the moiré never
	   arrives back where it started. */
	.weft {
		background: repeating-linear-gradient(
			calc(var(--angle) + 74deg),
			var(--shear-line) 0 1px,
			transparent 1px var(--gap)
		);
		animation: shear-b calc(var(--shear-period) * 1.42) linear infinite;
	}

	.vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 75% 65% at 40% 35%,
			transparent 0%,
			var(--backdrop-ground) 100%
		);
	}

	/* One full gap of travel, so the pattern reseats exactly and the loop has no
	   seam. Translating by anything else pops at the wrap. */
	@keyframes shear-a {
		to {
			transform: translate3d(var(--gap), 0, 0);
		}
	}
	@keyframes shear-b {
		to {
			transform: translate3d(calc(var(--gap) * -1), 0, 0);
		}
	}

	/* The composition is a lattice, not a moving thing — unlike Long Scan, whose
	   light IS its geometry. Here the motion is the only part that can be
	   dropped without the art becoming an empty field, so it is dropped whole. */
	@media (prefers-reduced-motion: reduce) {
		.warp,
		.weft {
			animation: none;
		}
	}
</style>
