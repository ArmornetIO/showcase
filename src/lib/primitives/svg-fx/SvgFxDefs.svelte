<script lang="ts">
	// ── SvgFxDefs — the filter chains ──────────────────────────────────────────
	//
	// PRIVATE to SvgFx (not exported from index.ts). Split out so both hosts —
	// the CSS-filter wrapper and the inline <svg> — declare the same chain, and
	// so the chains can be read as chains rather than buried in a component.
	//
	// Two conventions that are load-bearing, and are the usual reason a
	// hand-rolled SVG filter looks wrong:
	//
	//  · color-interpolation-filters="sRGB". The SPEC default is linearRGB, which
	//    washes out every blur and shifts every flood colour away from the hex
	//    you asked for. Nobody wants the default.
	//  · The region is set explicitly. The default (-10%/120%) clips all five of
	//    these effects, and a clipped glow reads as a rectangle of light.
	//
	// Every chain starts from SourceAlpha, never from specific geometry — that is
	// what lets these run over art that knows nothing about them.
	import type { ResolvedFx, SvgFxType } from './svg-fx.js';
	import { fxRegion } from './svg-fx.js';

	interface Props {
		id: string;
		type: SvgFxType;
		fx: ResolvedFx;
		bleed?: number;
	}

	let { id, type, fx, bleed = 50 }: Props = $props();

	const r = $derived(fxRegion(bleed));
</script>

<filter
	{id}
	x={r.x}
	y={r.y}
	width={r.width}
	height={r.height}
	filterUnits="objectBoundingBox"
	color-interpolation-filters="sRGB"
>
	{#if type === 'glow'}
		<feGaussianBlur in="SourceAlpha" stdDeviation={fx.size / 2} result="spread" />
		<!-- Set as BOTH attribute and CSS property. The attribute is what engines
		     actually read, but it cannot resolve a var() token — the style path
		     can, so a caller passing `color="var(--accent)"` still works. -->
		<feFlood flood-color={fx.color} style:flood-color={fx.color} result="paint" />
		<feComposite in="paint" in2="spread" operator="in" result="tinted" />
		<!-- Strength as an alpha ramp rather than duplicate merge nodes: it stays
		     continuous, so a slider does not jump between integer copies. -->
		<feComponentTransfer in="tinted" result="bloom">
			<feFuncA type="linear" slope={fx.strength} />
		</feComponentTransfer>
		<feMerge>
			<feMergeNode in="bloom" />
			<feMergeNode in="SourceGraphic" />
		</feMerge>
	{:else if type === 'outline'}
		<!-- feMorphology gives an EXACT width but a square kernel, so corners come
		     out mitred. The softness blur is what knocks them off; at softness 0
		     you get the boxy-but-precise version on purpose. -->
		<feMorphology in="SourceAlpha" operator="dilate" radius={fx.size} result="grown" />
		{#if fx.feather > 0}
			<feGaussianBlur in="grown" stdDeviation={fx.feather} result="grownSoft" />
		{/if}
		<!-- Set as BOTH attribute and CSS property. The attribute is what engines
		     actually read, but it cannot resolve a var() token — the style path
		     can, so a caller passing `color="var(--accent)"` still works. -->
		<feFlood flood-color={fx.color} style:flood-color={fx.color} result="paint" />
		<feComposite
			in="paint"
			in2={fx.feather > 0 ? 'grownSoft' : 'grown'}
			operator="in"
			result="ring"
		/>
		<feComponentTransfer in="ring" result="ringFade">
			<feFuncA type="linear" slope={fx.strength} />
		</feComponentTransfer>
		<feMerge>
			<feMergeNode in="ringFade" />
			<feMergeNode in="SourceGraphic" />
		</feMerge>
	{:else if type === 'emboss'}
		<!-- The blurred alpha IS the height map: flat inside, sloped at the edge,
		     so the lighting has a shoulder to catch. -->
		<feGaussianBlur in="SourceAlpha" stdDeviation={fx.bump} result="bump" />
		<feSpecularLighting
			in="bump"
			surfaceScale={fx.size}
			specularConstant={fx.strength}
			specularExponent="18"
			lighting-color={fx.light}
			style:lighting-color={fx.light}
			result="spec"
		>
			<feDistantLight azimuth={fx.azimuth} elevation={fx.elevation} />
		</feSpecularLighting>
		<!-- Clip to the shape first: specular light spills past the alpha and
		     without this the art wears a bright halo it never asked for. -->
		<feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip" />
		<feComposite
			in="SourceGraphic"
			in2="specClip"
			operator="arithmetic"
			k1="0"
			k2="1"
			k3="1"
			k4="0"
		/>
	{:else if type === 'chrome'}
		<feGaussianBlur in="SourceAlpha" stdDeviation={fx.bump} result="bump" />
		<!-- Metal is two passes, not a brighter highlight: a diffuse body that
		     carries the shading, then a tight specular ADDED on top for the hot
		     edge. One pass alone reads as plastic however hard it is lit.
		     The body REPLACES the art's own colour rather than multiplying over it
		     — multiplying a shaded body into the source crushes everything toward
		     black and leaves nothing but a rim. -->
		<feDiffuseLighting
			in="bump"
			surfaceScale={fx.size}
			diffuseConstant="1"
			lighting-color={fx.base}
			style:lighting-color={fx.base}
			result="diff"
		>
			<feDistantLight azimuth={fx.azimuth} elevation={fx.elevation} />
		</feDiffuseLighting>
		<feComposite in="diff" in2="SourceAlpha" operator="in" result="body" />
		<feSpecularLighting
			in="bump"
			surfaceScale={fx.size}
			specularConstant={fx.strength * 1.4}
			specularExponent="30"
			lighting-color={fx.light}
			style:lighting-color={fx.light}
			result="spec"
		>
			<feDistantLight azimuth={fx.azimuth} elevation={fx.elevation} />
		</feSpecularLighting>
		<feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip" />
		<feComposite in="body" in2="specClip" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
	{:else if type === 'engrave'}
		<!-- Inner shadow: offset the alpha, then keep only where the ORIGINAL alpha
		     is and the offset one is not. `operator="out"` is doing that
		     subtraction — it is the whole trick. -->
		<feOffset in="SourceAlpha" dx={fx.dx} dy={fx.dy} result="pushed" />
		<feGaussianBlur in="pushed" stdDeviation={Math.max(0.2, fx.size * 0.4)} result="pushedSoft" />
		<feComposite in="SourceAlpha" in2="pushedSoft" operator="out" result="lip" />
		<feFlood flood-color={fx.shadow} style:flood-color={fx.shadow} result="paint" />
		<feComposite in="paint" in2="lip" operator="in" result="inner" />
		<feComponentTransfer in="inner" result="innerFade">
			<feFuncA type="linear" slope={fx.strength} />
		</feComponentTransfer>
		<feMerge>
			<feMergeNode in="SourceGraphic" />
			<feMergeNode in="innerFade" />
		</feMerge>
	{/if}
</filter>
