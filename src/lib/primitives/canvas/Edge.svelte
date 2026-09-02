<script lang="ts">
	/**
	 * One edge — a Line, drawn the way the mesh draws them.
	 *
	 * The vocabulary already existed (`EdgeStyle`, `EDGE_STYLE_DASH`,
	 * `DATA_TYPE_COLOR` in canvas.types.ts) but only `MeshStudio` could paint it,
	 * and only for edges between its own laid-out nodes. Anything else that wanted
	 * a connector — a marketing rail, a diagram, a spur between two cards — drew
	 * its own hairline by hand and picked its own colours, which is how the same
	 * idiom ended up restated in gradients and hardcoded rgba across the app.
	 *
	 * This is that idiom as a component you can point at two coordinates. It
	 * renders SVG CHILDREN, not its own `<svg>`: edges compose into one canvas, and
	 * a wrapper per edge would put each one in its own stacking and coordinate
	 * context. The caller supplies the `<svg>` and its viewBox.
	 *
	 * It does NOT replace MeshStudio's own edge pass. That one carries ports,
	 * label chips, flow-depth dimming, selection state and per-edge signal weight —
	 * a superset with a lot of studio-specific input. Sharing the dash table and
	 * the colour table (which both files import from canvas.types.ts) is the part
	 * that actually has to agree; sharing the markup would mean dragging that
	 * whole context in here. Worth revisiting if MeshStudio's version ever gets
	 * simple enough to sit on top of this one.
	 */
	import { DATA_TYPE_COLOR, EDGE_STYLE_DASH, type DataType, type EdgeStyle } from './canvas.types.js';
	import { edgePathBetween, trimSegment, type EdgeCurve, type EdgePoint } from './edge-path.js';
	import { meshInk } from '../../theme/palette.svelte.js';

	type Point = EdgePoint;

	interface Props {
		/** Where the line starts. Ignored when `d` is given. */
		from?: Point;
		/** Where it ends. Ignored when `d` is given. */
		to?: Point;
		/**
		 * An explicit path, for anything the two routes below cannot express.
		 * Takes precedence over `from`/`to`.
		 */
		d?: string;
		/** The shape of the run. `bow` is the mesh's default — see edge-path.ts
		 *  for what each one is for and why the bow is clamped the way it is. */
		curve?: EdgeCurve;
		/** Transmission status. Sets the dash rhythm; see `EDGE_STYLE_DASH`. */
		style?: EdgeStyle;
		/**
		 * Where the dash pattern sits along the run, in px.
		 *
		 * For a caller that drives its march off its own clock instead of taking
		 * the CSS animation — a scene where every element has to be a pure
		 * function of one time value, so a second free-running timer would drift
		 * against everything else in it.
		 *
		 * Only applies to a DASHED edge. A solid one reveals by animating this
		 * same property, so honouring it there would fight the wipe.
		 */
		dashOffset?: number;
		/** What travels on it. Sets the colour, unless `color` overrides. */
		dataType?: DataType;
		/** Explicit colour. A legacy palette literal or a `--palette-*` name is
		 *  resolved to the current theme's step — see theme/palette.svelte.ts. */
		color?: string;
		width?: number;
		opacity?: number;
		/** Run a travelling orb along the line — the mesh's "this link is live"
		 *  signal. Costs an `<animateMotion>`, so it is off by default.
		 *
		 *  `'both'` adds a second orb running the other way, launched at the same
		 *  moment, for a link that carries traffic in both directions rather than
		 *  feeding one end. Same-instant and not staggered, matching the paired
		 *  `scanning` particles in `MeshStudio`: two pulses crossing mid-run is
		 *  the thing that reads as duplex, and phasing them apart turns it back
		 *  into one orb shuttling. Opt-in, because direction is information — on
		 *  a one-way link a returning orb is a claim we cannot make. */
		flow?: boolean | 'both';
		/** Seconds for one traversal. Longer reads as further, not slower. */
		flowDur?: number;
		/** Draw a junction mark where the line ENDS. The mesh marks a termination,
		 *  never a mid-run point — a dot in the middle reads as a node. */
		cap?: boolean;
		/**
		 * Hard-edged rendering: butt line caps, and a SQUARE junction mark instead
		 * of a dot.
		 *
		 * The console is a rounded surface and the mesh's default matches it. The
		 * marketing site is not — it is built on right angles, and a round cap
		 * landing on a square node is the one detail that gives away that the
		 * diagram came from somewhere else. Opt-in, so the app keeps its own vibe.
		 */
		sharp?: boolean;
		/** Stop this many px short of `from` — the radius of whatever sits there. */
		trimStart?: number;
		/** Stop this many px short of `to`. See `trimSegment`. */
		trimEnd?: number;
		/**
		 * Whether the line is drawn in yet. `false` holds it hidden, `true` runs
		 * the reveal, so a caller can gate the whole rail on one scroll trigger.
		 *
		 * How it reveals depends on the style, because it has to: a solid line
		 * WIPES (dashoffset over a normalised path length), but a line that
		 * already carries a dash pattern cannot — the wipe and the pattern are the
		 * same property, and animating one destroys the other. Those fade instead.
		 */
		revealed?: boolean;
		/** Seconds before this edge starts revealing. Staggering a bundle is what
		 *  makes it read as wiring rather than an appearing picture. */
		delay?: number;
	}

	let {
		from,
		to,
		d,
		curve = 'bow',
		style,
		dashOffset,
		dataType,
		color,
		width = 1,
		opacity = 1,
		flow = false,
		flowDur = 3.4,
		cap = false,
		sharp = false,
		trimStart = 0,
		trimEnd = 0,
		revealed = true,
		delay = 0
	}: Props = $props();

	// `$props.id()` rather than a counter: two instances in different components
	// must not collide, and an `<mpath href>` that resolves to the wrong path
	// sends the orb down someone else's line.
	const uid = $props.id();

	// Trimmed once and shared: the path and the end cap have to agree about where
	// the line actually stops, or the dot floats off the end of it.
	const ends = $derived(
		from && to ? trimSegment(from, to, trimStart, trimEnd) : undefined
	);
	const path = $derived(d ?? (ends ? edgePathBetween(ends.a, ends.b, curve) : ''));

	const dash = $derived(style ? EDGE_STYLE_DASH[style] : undefined);
	const ink = $derived(
		meshInk(color ?? (dataType ? DATA_TYPE_COLOR[dataType] : 'var(--border-strong)'))
	);
	const endPoint = $derived(d ? undefined : ends?.b);
</script>

{#if path}
	<!-- `pathLength="1"` normalises the wipe: without it the dash values are in
	     user units, so the same edge reveals at a different rate depending how
	     long it happens to be. -->
	<path
		class="edge"
		class:edge--wipe={!dash}
		class:edge--shown={revealed}
		id="edge-{uid}"
		d={path}
		pathLength={dash ? undefined : 1}
		fill="none"
		stroke={ink}
		stroke-width={width}
		stroke-dasharray={dash}
		stroke-dashoffset={dash ? dashOffset : undefined}
		stroke-linecap={sharp ? 'butt' : 'round'}
		{opacity}
		style="--edge-delay: {delay}s"
	/>

	{#if cap && endPoint}
		{@const r = Math.max(2.5, width * 2.5)}
		{#if sharp}
			<!-- A diamond, not an axis-aligned square. A square junction on a
			     horizontal run reads as a gap in the line — its flat side is
			     parallel to the stroke and the two merge. Turned 45° it reads as a
			     marker sitting ON the line, which is what a junction is.
			     Sized off the same radius as the dot, so switching a bundle to
			     `sharp` changes the shape of the junction and not its weight. -->
			<path
				class="edge-cap"
				class:edge--shown={revealed}
				d="M{endPoint.x} {endPoint.y - r} L{endPoint.x + r} {endPoint.y} L{endPoint.x} {endPoint.y +
					r} L{endPoint.x - r} {endPoint.y} Z"
				fill="var(--bg)"
				stroke={ink}
				stroke-width={width}
				style="--edge-delay: {delay + 0.1}s"
			/>
		{:else}
			<circle
				class="edge-cap"
				class:edge--shown={revealed}
				cx={endPoint.x}
				cy={endPoint.y}
				r={r}
				fill="var(--bg)"
				stroke={ink}
				stroke-width={width}
				style="--edge-delay: {delay + 0.1}s"
			/>
		{/if}
	{/if}

	{#if flow && revealed}
		<circle class="edge-orb" r={Math.max(2, width * 2)} fill={ink}>
			<animateMotion dur="{flowDur}s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
				<mpath href="#edge-{uid}" />
			</animateMotion>
			<!-- Fades at both ends of the run so the orb never appears to spawn or
			     die on a hard edge — it arrives and it leaves. -->
			<animate
				attributeName="opacity"
				values="0;1;1;0"
				keyTimes="0;0.12;0.85;1"
				dur="{flowDur}s"
				repeatCount="indefinite"
			/>
		</circle>
		{#if flow === 'both'}
			<circle class="edge-orb" r={Math.max(2, width * 2)} fill={ink}>
				<animateMotion
					dur="{flowDur}s"
					repeatCount="indefinite"
					keyPoints="1;0"
					keyTimes="0;1"
					calcMode="linear"
				>
					<mpath href="#edge-{uid}" />
				</animateMotion>
				<animate
					attributeName="opacity"
					values="0;1;1;0"
					keyTimes="0;0.12;0.85;1"
					dur="{flowDur}s"
					repeatCount="indefinite"
				/>
			</circle>
		{/if}
	{/if}
{/if}

<style>
	/* A dashed edge cannot wipe — the reveal and the pattern are the same
	   property — so it fades and the solid ones wipe. Both are held at the same
	   delay so a mixed bundle still arrives in one order. */
	.edge {
		opacity: 0;
		transition: opacity 0.5s ease var(--edge-delay, 0s);
	}
	.edge--wipe {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		opacity: 1;
		transition: stroke-dashoffset 0.6s ease var(--edge-delay, 0s);
	}
	.edge.edge--shown {
		opacity: 1;
	}
	.edge--wipe.edge--shown {
		stroke-dashoffset: 0;
	}

	.edge-cap {
		opacity: 0;
		transform-box: fill-box;
		transform-origin: center;
		transform: scale(0.5);
		transition:
			opacity 0.4s ease var(--edge-delay, 0s),
			transform 0.4s ease var(--edge-delay, 0s);
	}
	.edge-cap.edge--shown {
		opacity: 1;
		transform: scale(1);
	}

	@media (prefers-reduced-motion: reduce) {
		/* The orb is the only thing here that never stops, which is exactly what
		   this query is for. The reveal transitions are one-shot and stay. */
		.edge-orb {
			display: none;
		}
	}
</style>
