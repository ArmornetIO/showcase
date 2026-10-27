<script lang="ts">
	// ── One lamp, and everything that answers to it ──────────────────────────────
	// A light at a real place in front of the mark, and every surface term read
	// off it: the streak drawn on the face, each contour edge shaded by its own
	// angle to the source, a specular dot walking each ball joint, a hotspot held
	// where the lamp projects onto each tube.
	//
	// The cut this replaced had a bright shape crossing a mark whose edges glowed
	// at a constant. Nothing on screen agreed about where the light was, and that
	// is what made it read as a filter over a picture rather than as illumination
	// of an object — the eye resolves "lit" from agreement between highlights, not
	// from brightness.
	//
	// So: take the lamp away and all of it goes dark together. That property is
	// the component. `rimlight.ts` owns the shading maths; this owns the passes.
	import { edgeLight, ballLight, tubeLight, type ContourEdge, type Lamp } from './rimlight.js';
	import type { Pt } from '../icons/ArmornetCrestMesh.svelte';
	import RimLightGl, { type RimQuad } from './RimLightGl.svelte';

	interface Props {
		/** Rendered width, px. The contours are authored in the forged cut's
		 *  200×220 box and scale with it. */
		size?: number;
		/** The contours to light — `buildEdges()`, or any subset of it. */
		edges: ContourEdge[];
		/** Where the light is. `z` is how far in front of the face it hangs: near
		 *  enough to pick out edges one at a time, far enough not to blow out
		 *  whatever it passes over. */
		lamp: Lamp;
		/** The mesh figure's joints, so the solid parts of the mark are lit too.
		 *  Omit and only the contours answer — which the eye reads immediately as
		 *  a shield that is lit with a mark sitting on it that is not. */
		figure?: { hub: Pt; nodes: Pt[]; hubR: number; nodeR: number };
		/** The silhouette the face passes are clipped to. Without it the brushed
		 *  field and the streak are a rectangle over the artwork. */
		shield?: string;
		/** Fade the whole lamp up. Every pass reads it, so this is the light
		 *  arriving rather than an opacity over a lit picture. */
		intensity?: number;
		/** Px to lift the artboard by, so the SHIELD's centre — not the 200×220
		 *  box's — lands on the host's centre. `0.005784 × size` is what the
		 *  forged cut needs; a scene registers every layer against the same
		 *  point or the light drifts off the thing it is lighting. */
		offsetY?: number;
		/** Drop the three SVG filters. They are the whole per-frame cost of this
		 *  component: `lamp` moves every frame, so the filter region is re-blurred
		 *  every frame, and a phone spends the entire intro doing it.
		 *
		 *  What is lost is small because each filter sits on something already
		 *  soft — the streak is a radial gradient that ends at zero, and the bloom
		 *  is a wide low-opacity restatement of strokes that are drawn crisply
		 *  underneath it anyway. What is lost is NOT nothing: the brushed field
		 *  goes, and with it the sense that the face is a material. That is the
		 *  trade, made where the frames are not there to pay for it. */
		lite?: boolean;
	}

	let {
		size = 470,
		edges,
		lamp,
		figure,
		shield,
		intensity = 1,
		offsetY = 0,
		lite = false
	}: Props = $props();

	const uid = $props.id();

	/** Below this an edge contributes a sub-pixel smear and a DOM node. */
	const lit = $derived(
		intensity > 0.01
			? edges
					.map((e, i) => ({
						i,
						d: e.d,
						// Endpoints as well as the path. `ContourEdge` carries both by
						// design — see its own note — so the GPU pass reads the numbers
						// rather than re-parsing the `d` the SVG pass strokes.
						x0: e.x0,
						y0: e.y0,
						x1: e.x1,
						y1: e.y1,
						w: e.weight,
						v: edgeLight(e, lamp)
					}))
					.filter((e) => e.v > 0.012)
			: []
	);
	const balls = $derived(
		intensity > 0.01 && figure
			? [
					ballLight(figure.hub[0], figure.hub[1], figure.hubR, lamp),
					...figure.nodes.map((n) => ballLight(n[0], n[1], figure.nodeR, lamp))
				]
			: []
	);
	const tubes = $derived(
		intensity > 0.01 && figure ? figure.nodes.map((n) => tubeLight(figure.hub, n, lamp)) : []
	);

	/** Whether the moving passes go to the GPU. Off once `RimLightGl` reports it
	 *  could not hold a context — the SVG groups below are the fallback, and they
	 *  are still correct, just expensive. */
	let gl = $state(true);

	/** `#rrggbb` → 0–1 triple, once per colour rather than per instance. */
	const rgb = (hex: string): [number, number, number] => [
		parseInt(hex.slice(1, 3), 16) / 255,
		parseInt(hex.slice(3, 5), 16) / 255,
		parseInt(hex.slice(5, 7), 16) / 255
	];
	const CORE_RGB = rgb('#f2fffc');
	const TUBE_RGB = rgb('#eafffb');
	const BALL_RGB = rgb('#ffffff');

	/** The three moving passes as one instance list.
	 *
	 *  The arithmetic is the SVG's, kept term for term so the two renderers can be
	 *  diffed rather than compared by eye: `e.w` is the crisp stroke WIDTH, so the
	 *  shader's half-width is half of it, and the spill's `e.v * 0.42` capped at
	 *  0.5 is the wide pass's opacity unchanged. What is not carried over is the
	 *  wide pass's 3.2× width — in the SVG that width existed to give the blur
	 *  something to spread; here the gaussian spreads from the core's edge
	 *  directly, so restating it would double the glow. */
	const quads = $derived.by((): RimQuad[] => {
		const out: RimQuad[] = [];
		for (const e of lit) {
			out.push({
				x0: e.x0,
				y0: e.y0,
				x1: e.x1,
				y1: e.y1,
				hw: e.w / 2,
				core: Math.min(1, e.v) * intensity,
				spill: Math.min(0.5, e.v * 0.42) * intensity,
				// One colour where the SVG had two. Its wide pass strokes `#dffdf7`,
				// a hair greener than the core's `#f2fffc`; an instance carries one
				// colour, and at the spill's opacity over a dark cut that difference
				// is below what the 8-bit buffer can hold anyway.
				r: CORE_RGB[0],
				g: CORE_RGB[1],
				b: CORE_RGB[2]
			});
		}
		for (const tb of tubes) {
			if (tb.level <= 0.03) continue;
			out.push({
				x0: tb.x,
				y0: tb.y,
				x1: tb.x,
				y1: tb.y,
				hw: 5,
				core: tb.level * 0.16 * intensity,
				spill: 0,
				r: TUBE_RGB[0],
				g: TUBE_RGB[1],
				b: TUBE_RGB[2]
			});
		}
		for (const b of balls) {
			if (b.level <= 0.03) continue;
			out.push({
				x0: b.x,
				y0: b.y,
				x1: b.x,
				y1: b.y,
				hw: b.r * 0.5,
				core: b.level * 0.6 * intensity,
				spill: 0,
				r: BALL_RGB[0],
				g: BALL_RGB[1],
				b: BALL_RGB[2]
			});
		}
		return out;
	});
</script>

{#if intensity > 0.01}
	<svg
		class="rim"
		style:--dy="{offsetY}px"
		width={size}
		height={size}
		viewBox="0 0 200 220"
		aria-hidden="true"
	>
		<defs>
			{#if shield}
				<clipPath id="{uid}-shield"><path d={shield} /></clipPath>
			{/if}

			<!-- The streak is an ELLIPSE, blurred, not a rectangle with a gradient in
			     it. A rect has two straight edges however soft you make the ramp, and
			     on a curved shield those edges are what read as cheap — the eye finds
			     the boundary of the effect before it finds the light. A blurred
			     ellipse has no boundary to find. -->
			<radialGradient id="{uid}-streak">
				<stop offset="0" stop-color="#ffffff" stop-opacity="0.9" />
				<stop offset="0.4" stop-color="#dcfbf5" stop-opacity="0.34" />
				<stop offset="1" stop-color="#dcfbf5" stop-opacity="0" />
			</radialGradient>
			{#if !lite}
				<filter id="{uid}-streakblur" x="-60%" y="-40%" width="220%" height="180%">
					<feGaussianBlur stdDeviation="7" />
				</filter>
			{/if}

			<!-- Brushed metal. Static: a texture that crawls is a texture that is on
			     the lens, not on the object. -->
			{#if !lite}
				<filter id="{uid}-brush" x="0" y="0" width="100%" height="100%">
					<!-- Only SLIGHTLY anisotropic. The first cut ran the x frequency twenty
					     times the y, which is genuinely how brushed steel is milled and, at
					     this size on a dark field, reads as rain on the lens. Grain that is
					     nearly isotropic and very fine says "material" without ever
					     resolving into marks you can count. -->
					<feTurbulence type="fractalNoise" baseFrequency="1.5 0.65" numOctaves="2" seed="11" />
					<feColorMatrix type="saturate" values="0" />
					<!-- The amplitude squeeze is the difference between a milled surface and
					     a damaged one. Raw turbulence swings the full range. -->
					<feComponentTransfer>
						<feFuncA type="linear" slope="0.34" intercept="0" />
					</feComponentTransfer>
				</filter>
			{/if}

			<!-- Bloom in two stages. One blur is a halo; a tight pass over a wide one
			     is a bright thing seen through air, because real bloom has a core AND
			     a spill and they fall off at different rates. -->
			{#if !lite}
				<filter id="{uid}-bloom" x="-90%" y="-90%" width="280%" height="280%">
					<feGaussianBlur stdDeviation="11" />
				</filter>
			{/if}
		</defs>

		<g clip-path={shield ? `url(#${uid}-shield)` : undefined}>
			{#if !lite}
				<rect
					x="0"
					y="0"
					width="200"
					height="220"
					filter="url(#{uid}-brush)"
					opacity={intensity * 0.5}
					style="mix-blend-mode: soft-light"
				/>
			{/if}
			<ellipse
				cx={lamp.x}
				cy="112"
				rx="30"
				ry="170"
				fill="url(#{uid}-streak)"
				transform="rotate(-13 {lamp.x} 112)"
				filter={lite ? undefined : `url(#${uid}-streakblur)`}
				opacity={intensity * 0.8}
				style="mix-blend-mode: screen"
			/>
		</g>

		<!-- ── The moving passes ──────────────────────────────────────────────
		     Only drawn here when the GPU could not take them. Everything below is
		     redrawn whenever the lamp moves, which is every frame, and in SVG that
		     means 2N stroked paths plus a blur — the intro's whole cost on a
		     phone. `RimLightGl` does the same arithmetic in one instanced draw.
		     Kept, rather than deleted, because a lost context is a normal Tuesday
		     and a mark that lights up is better than one that does not. -->
		{#if !gl}
			<!-- Every contour, edge by edge. Drawn twice — a wide blurred pass for
			     the spill and a crisp one for the core. The brightness is a shading
			     term PER SEGMENT rather than one number for the whole outline, which
			     is what makes the highlight travel around the silhouette instead of
			     pulsing everywhere at once. -->
			<g
				fill="none"
				stroke="#dffdf7"
				stroke-linecap="round"
				opacity={intensity}
				filter={lite ? undefined : `url(#${uid}-bloom)`}
			>
				{#each lit as e (e.i)}
					<path d={e.d} stroke-width={e.w * 3.2} opacity={Math.min(0.5, e.v * 0.42)} />
				{/each}
			</g>
			<g fill="none" stroke="#f2fffc" stroke-linecap="round" opacity={intensity}>
				{#each lit as e (e.i)}
					<path d={e.d} stroke-width={e.w} opacity={Math.min(1, e.v)} />
				{/each}
			</g>

			<g opacity={intensity} style="mix-blend-mode: screen">
				{#each tubes as tb, i (i)}
					{#if tb.level > 0.03}
						<circle cx={tb.x} cy={tb.y} r="5" fill="#eafffb" opacity={tb.level * 0.16} />
					{/if}
				{/each}
				<!-- Small. A specular is a REFLECTION of the source, so on a ball this
				     size it is a pinprick; drawn any bigger it stops reading as a
				     highlight and starts reading as a pupil, and the joints look back
				     at you. -->
				{#each balls as b, i (i)}
					{#if b.level > 0.03}
						<circle cx={b.x} cy={b.y} r={b.r * 0.5} fill="#ffffff" opacity={b.level * 0.6} />
					{/if}
				{/each}
			</g>
		{/if}
	</svg>

	{#if gl}
		<RimLightGl {size} {offsetY} {quads} onfallback={() => (gl = false)} />
	{/if}
{/if}

<style>
	/* `overflow: visible` so the wide bloom pass can spill past the artboard —
	   clipped at the box edge the spill ends on a straight line, which is the one
	   thing a glow must never do. */
	.rim {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%) translateY(calc(-1 * var(--dy, 0px)));
		pointer-events: none;
		overflow: visible;
	}
</style>
