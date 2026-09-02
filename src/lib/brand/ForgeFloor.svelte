<script lang="ts">
	// ── The room ─────────────────────────────────────────────────────────────────
	// Converging rails and a haze band. A solid needs somewhere to be standing —
	// a mark on a flat field is a sticker, and no amount of shading on the mark
	// itself fixes that, because the thing the eye is missing is the GROUND.
	//
	// The rails converge on a vanishing point at 30% height and the cross-lines
	// bunch toward it on a power curve, which is the whole of the perspective: no
	// transform, no camera, just two families of straight lines spaced the way a
	// receding plane spaces them.
	//
	// `xMidYMax slice` anchors the horizon rather than the centre. Letting it
	// letterbox puts the vanishing point somewhere different on every viewport,
	// and whatever is standing on the floor then stands at a different height on
	// each one.
	interface Props {
		/** How present the floor is. It is scenery — at 1 the rails compete with
		 *  whatever is standing on them. */
		opacity?: number;
		/** Rails, and cross-lines. More of either reads as graph paper. */
		rails?: number;
		rungs?: number;
	}

	let { opacity = 0.5, rails = 23, rungs = 13 }: Props = $props();

	// Two instances on one page share an id space, and the second one's mask
	// silently wins for both.
	const uid = $props.id();
</script>

<svg
	class="floor"
	style:opacity
	viewBox="0 0 1000 620"
	preserveAspectRatio="xMidYMax slice"
	aria-hidden="true"
>
	<defs>
		<linearGradient id="{uid}-fade" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--accent)" stop-opacity="0" />
			<stop offset="0.45" stop-color="var(--accent)" stop-opacity="0.16" />
			<stop offset="1" stop-color="var(--accent)" stop-opacity="0.02" />
		</linearGradient>
		<mask id="{uid}-mask">
			<rect x="0" y="0" width="1000" height="620" fill="url(#{uid}-fade)" />
		</mask>
	</defs>
	<g mask="url(#{uid}-mask)" stroke="var(--accent)" stroke-width="0.8" fill="none">
		{#each Array(rails) as _, i (i)}
			{@const k = i - (rails - 1) / 2}
			<line x1={500 + k * 24} y1="300" x2={500 + k * 190} y2="620" />
		{/each}
		{#each Array(rungs) as _, i (i)}
			{@const f = Math.pow(i / (rungs - 1), 2.4)}
			<line x1="0" y1={300 + f * 320} x2="1000" y2={300 + f * 320} />
		{/each}
	</g>
</svg>

<style>
	.floor {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
</style>
