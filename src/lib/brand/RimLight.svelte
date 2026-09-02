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
	}

	let { size = 470, edges, lamp, figure, shield, intensity = 1, offsetY = 0 }: Props = $props();

	const uid = $props.id();

	/** Below this an edge contributes a sub-pixel smear and a DOM node. */
	const lit = $derived(
		intensity > 0.01
			? edges.map((e, i) => ({ i, d: e.d, w: e.weight, v: edgeLight(e, lamp) })).filter((e) => e.v > 0.012)
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
			<filter id="{uid}-streakblur" x="-60%" y="-40%" width="220%" height="180%">
				<feGaussianBlur stdDeviation="7" />
			</filter>

			<!-- Brushed metal. Static: a texture that crawls is a texture that is on
			     the lens, not on the object. -->
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

			<!-- Bloom in two stages. One blur is a halo; a tight pass over a wide one
			     is a bright thing seen through air, because real bloom has a core AND
			     a spill and they fall off at different rates. -->
			<filter id="{uid}-bloom" x="-90%" y="-90%" width="280%" height="280%">
				<feGaussianBlur stdDeviation="11" />
			</filter>
		</defs>

		<g clip-path={shield ? `url(#${uid}-shield)` : undefined}>
			<rect
				x="0"
				y="0"
				width="200"
				height="220"
				filter="url(#{uid}-brush)"
				opacity={intensity * 0.5}
				style="mix-blend-mode: soft-light"
			/>
			<ellipse
				cx={lamp.x}
				cy="112"
				rx="30"
				ry="170"
				fill="url(#{uid}-streak)"
				transform="rotate(-13 {lamp.x} 112)"
				filter="url(#{uid}-streakblur)"
				opacity={intensity * 0.8}
				style="mix-blend-mode: screen"
			/>
		</g>

		<!-- Every contour, edge by edge. Drawn twice — a wide blurred pass for the
		     spill and a crisp one for the core. The brightness is a shading term
		     PER SEGMENT rather than one number for the whole outline, which is what
		     makes the highlight travel around the silhouette instead of pulsing
		     everywhere at once. -->
		<g fill="none" stroke="#dffdf7" stroke-linecap="round" opacity={intensity} filter="url(#{uid}-bloom)">
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
			     highlight and starts reading as a pupil, and the joints look back at
			     you. -->
			{#each balls as b, i (i)}
				{#if b.level > 0.03}
					<circle cx={b.x} cy={b.y} r={b.r * 0.5} fill="#ffffff" opacity={b.level * 0.6} />
				{/if}
			{/each}
		</g>
	</svg>
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
