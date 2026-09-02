<script lang="ts">
	// The ground behind a page: a static horizon grid with Möbius strips laid on
	// it and travellers running their edges.
	//
	// THE GRID DOES NOT MOVE. An earlier pass scrolled the cross-ties toward the
	// viewer, which is the outrun idiom — but a moving floor under a page of
	// tables means the whole surface is in motion behind the text, forever, and
	// peripheral vision cannot ignore motion. So the floor is fixed and only
	// THINGS travel over it.
	//
	// THE STRIPS ARE BELTS, NOT SPINNING OBJECTS. A Möbius boundary is a single
	// closed curve that takes two laps to walk. Its material runs along its own
	// length: the rim's dash flows, the slats pulse in a wave down the band, and
	// the strip itself holds still. Rotating the whole shape turns the picture,
	// which is not what a belt does.
	//
	// EVERY STRIP IS ADDRESSABLE. Placement comes from a `StripSpec` list, not
	// from an RNG the caller cannot reach into — see `strips.ts`.
	//
	// THE MOTION IS ON THE GPU, THE BODY IS IN THE DOM. Everything that ran as a
	// CSS keyframe — the rim's dash flow, the slat wave, the energy pulse, the
	// travellers — moved to `StripsGl`, because `stroke-dashoffset` and
	// `stroke-width` are not compositable and each frame was a full main-thread
	// repaint of a large stroked path behind the page. What stayed here is the
	// band's glass, which is STATIC: it costs one paint, and leaving it in the
	// DOM keeps the per-strip SvgFx chain, defocus and ghost hue treating it.

	import { getContext } from 'svelte';
	import SvgFx from '../primitives/svg-fx/SvgFx.svelte';
	import { CANVAS_CTX } from '../primitives/canvas/canvas-camera.js';
	import { mobiusLayout, type MobiusLayout } from './mobius.js';
	import { heroStrip, seedStrips, type StripSpec } from './strips.js';
	import { resolvePreset, type PresetId } from './presets.js';
	import StripsGl from './StripsGl.svelte';
	import { viewBoxOf, WORLD } from './gl/strip-placement.js';

	/**
	 * The canvas this backdrop is inside, if any.
	 *
	 * Outside a Canvas the strips are placed in viewport percentages, which is
	 * right for a decorative layer nailed behind a page. INSIDE one they become
	 * world-space objects and inherit the camera — pan, zoom, `flyTo`, `fitAll`
	 * — which is what makes the backdrop composable the way the overview's globe
	 * is, rather than a picture that happens to sit behind everything.
	 *
	 * `getContext` returns undefined outside a Canvas, so the same component
	 * serves both without the caller choosing a mode.
	 */
	const canvas = getContext<
		{ transform: { tx: number; ty: number; tk: number } } | undefined
	>(CANVAS_CTX);

	interface Props {
		/**
		 * The strips to draw, explicitly. Each is addressable and independently
		 * placed — pass this when tuning. Omit and the backdrop seeds its own,
		 * which is what shipping code does.
		 */
		strips?: StripSpec[];
		/** Show each strip's id on the stage, so "strip 2" has a referent. */
		labels?: boolean;
		/** Which id is highlighted while being edited. */
		selected?: string | null;
		/** How many strips to seed when `strips` is omitted. */
		count?: number;
		/** Deterministic scatter — same seed, same arrangement every load. */
		seed?: number;
		/** Seed one large centred strip instead of a scatter. */
		hero?: boolean;
		/**
		 * Sweep a continuous hue along the chain instead of using the flat strip
		 * colour. Each strip is one step further round the wheel, so the rainbow
		 * reads as one band of colour travelling a1 → a2 → a3 → b1 → …, not as
		 * six independently cycling objects.
		 */
		rainbow?: boolean;
		/**
		 * Load a named composition — the builder's and the app shell's way in,
		 * since neither can express a `StripSpec[]` as a prop.
		 *
		 * An explicit `strips` array always wins: the studio passes live,
		 * half-edited state and must not have it replaced by the preset it
		 * started from.
		 *
		 * A preset that carries a palette applies it to THIS component's wrapper
		 * rather than to `:root`. Two backdrops on one page then stay
		 * independent, and dropping one into an editor does not repaint the
		 * editor around it.
		 */
		preset?: PresetId;
		/** Fired when a strip's tag is clicked. Only reachable when `labels`. */
		onselect?: (id: string) => void;
	}

	let {
		strips: given,
		labels = false,
		selected = null,
		count = 3,
		seed = 7,
		hero = false,
		rainbow = false,
		preset,
		onselect
	}: Props = $props();

	/** The named composition, when one was asked for. */
	const loaded = $derived(preset ? resolvePreset(preset) : null);

	/** A preset's palette, as a style string for this component's own wrapper. */
	const presetCss = $derived(
		loaded?.tokens
			? Object.entries(loaded.tokens)
					.map(([k, v]) => `${k}: ${v}`)
					.join('; ')
			: ''
	);

	/** An explicit `rainbow` prop still wins; the preset only supplies a default. */
	const flowing = $derived(rainbow || (loaded?.rainbow ?? false));

	// Precedence, most explicit first: a passed array, then a named preset, then
	// the hero, then a seeded scatter. `given` wins over `preset` so the studio's
	// live edits are never overwritten by the preset they began as.
	const specs = $derived<StripSpec[]>(
		given ?? loaded?.strips ?? (hero ? [heroStrip()] : seedStrips(count, seed))
	);

	/**
	 * A saturated base for rainbow mode.
	 *
	 * `hue-rotate` turns a colour's hue; it cannot invent saturation. Run it
	 * over the ground's near-grey `--backdrop-strip` and you get a slightly
	 * warmer near-grey. So rainbow mode swaps the stroke for a fully saturated
	 * colour and lets the rotation do the rest.
	 */
	const RAINBOW_BASE = 'hsl(170 85% 60%)';

	/**
	 * Where a strip sits in the hue cycle, 0…1.
	 *
	 * Spread over the strips IN ORDER, so a1 → a2 → a3 → b1 → b2 → b3 each start
	 * a step further round the wheel. Fed to the animation as a negative delay,
	 * that makes one continuous sweep travelling down the chain rather than six
	 * strips each cycling on their own.
	 */
	function hueOf(i: number): number {
		return specs.length ? i / specs.length : 0;
	}

	const built = $derived(
		specs.map((s, i) => ({
			spec: s,
			i,
			layout: mobiusLayout(
				Array.from({ length: Math.max(1, s.traffic) }, (_, i) => `t${i}`),
				{ radius: 420, band: s.band, yaw: s.yaw, pitch: s.pitch, segments: 220, rungs: s.rungs }
			)
		}))
	);

	/**
	 * Where a strip sits, and how big, in whichever space applies.
	 *
	 * In a Canvas, `left`/`top` are WORLD coordinates and `size` is a world
	 * width, so the camera's transform maps them to the screen and the strips
	 * move with everything else on the canvas. Outside one they stay viewport
	 * percentages and `vw`, unchanged.
	 */
	/**
	 * Read as a $derived so the camera's transform is a tracked dependency.
	 *
	 * Reading it inside a plain function called from the template looks like it
	 * should track — and does not reliably, because the read happens behind a
	 * call boundary. Pulling the three numbers out here makes the dependency
	 * explicit, which is the difference between a backdrop that pans with the
	 * camera and one that sits still while everything else moves.
	 */
	const view = $derived({
		tx: canvas?.transform.tx ?? 0,
		ty: canvas?.transform.ty ?? 0,
		tk: canvas?.transform.tk ?? 1
	});

	function place(
		s: StripSpec,
		t: { tx: number; ty: number; tk: number }
	): { left: string; top: string; width: string } {
		if (!canvas) return { left: `${s.left}%`, top: `${s.top}%`, width: `${s.size}vw` };
		// A spec's numbers are PERCENTAGES. Used raw as world units they land
		// inside a 100×100 box — three strips a few pixels wide, stacked on the
		// origin, which is what "the strips vanished" actually was. WORLD scales
		// that unit square up to a canvas-sized region so the same spec composes
		// identically in both spaces.
		return {
			left: `${(s.left / 100) * WORLD.w * t.tk + t.tx}px`,
			top: `${(s.top / 100) * WORLD.h * t.tk + t.ty}px`,
			width: `${(s.size / 100) * WORLD.w * t.tk}px`
		};
	}

	/** The bounding box of a layout, as an SVG viewBox. Shared with the GL layer,
	 *  which maps user units through the same rectangle — two definitions would
	 *  offset every stroke from the glass it is drawn over. */
	function box(l: MobiusLayout): string {
		const v = viewBoxOf(l);
		return `${v.x} ${v.y} ${v.w} ${v.h}`;
	}

	/**
	 * The chain-wide energy clock, seconds.
	 *
	 * ONE duration for the whole chain, not one per strip: a pulse that crosses
	 * the chain has to be a single cycle, and giving each strip its own lets the
	 * phases drift apart within a lap, turning a charge travelling a1 → a2 → a3
	 * → b1 … back into six independent blinkers. The chain takes the first
	 * strip's `energySpeed` as its tempo; the per-strip values still drive
	 * COLOUR, which is what carries the recession.
	 */
	const energyPeriod = $derived(
		(specs[0]?.energySpeed ?? 1.6) * Math.max(1, specs.length)
	);

	/**
	 * Dissolve both ends of a strip along the chain's axis.
	 *
	 * This is what turns several strips into one ribbon: hard ends read as
	 * separate objects, whereas a strip that fades out exactly where the next
	 * fades in leaves the eye to join them. The stops are eased rather than
	 * linear — a linear alpha ramp reads as a visible grey band, because
	 * perceived brightness is not linear in alpha.
	 */
	function fadeMask(fade: number, angle: number): string {
		const a = Math.max(0, Math.min(0.5, fade)) * 100;
		return (
			`linear-gradient(${angle}deg,` +
			` transparent 0%,` +
			` rgba(0,0,0,0.35) ${(a * 0.55).toFixed(1)}%,` +
			` black ${a.toFixed(1)}%,` +
			` black ${(100 - a).toFixed(1)}%,` +
			` rgba(0,0,0,0.35) ${(100 - a * 0.55).toFixed(1)}%,` +
			` transparent 100%)`
		);
	}
</script>

<!--
	`z-index: -1` is right for a page backdrop — it puts the layer behind the
	content it sits under. It is WRONG inside a Canvas: the canvas paints its own
	ground (`--glass-ground`) on `.cv-root`, and a negative child renders behind
	that, so the strips disappear entirely. In a canvas the backdrop is ordinary
	content and sits at 0.
-->
<div
	class="backdrop"
	class:in-canvas={!!canvas}
	style={presetCss}
	aria-hidden={!labels}
>
	<!-- The floor. Static: two raked planes meeting at a horizon. -->
	<div class="plane floor"></div>
	<div class="plane ceiling"></div>

	<!--
		The moving half of every strip, in one context.

		Before the glass rather than after it so the band's body still sits over its
		own ribs, as it did when both were in the same <svg>. The one thing that
		changes is that ALL the glass now paints over ALL the rims instead of doing
		it strip by strip — invisible at the 6% tint the glass is drawn with, and
		the price of a single canvas rather than one per strip.
	-->
	<StripsGl
		strips={built.map((b) => ({ spec: b.spec, index: b.i, layout: b.layout }))}
		flowing={flowing}
		{energyPeriod}
		camera={canvas?.transform ?? null}
		rainbowBase={RAINBOW_BASE}
	/>

	{#each built as b (b.spec.id)}
		{@const s = b.spec}
		<!--
			SvgFx in `wrap` mode: a CSS `filter: url(...)` on a wrapping element,
			with the filter parked in a zero-size <svg>. Its chains read only the
			SOURCE ALPHA, which is exactly why it can treat a generated Möbius
			projection that knows nothing about it. `enabled` rather than an {#if}
			so toggling the effect does not remount the strip and restart its belt.
		-->
		<!--
			PLACEMENT LIVES ON THE WRAPPER, not on the <svg> inside it. A CSS
			`filter` makes an element a containing block for absolutely-positioned
			descendants, so leaving `left`/`top` on the inner svg would resolve
			them against this zero-size span instead of the backdrop — every strip
			would collapse into the same corner the moment an effect was enabled.
		-->
		<!--
			Three nested layers, and the nesting is the point — each one owns a
			`filter`, and a single element can only carry one:

			  .strip-host  placement. Filter-free, so it stays the containing
			               block its descendants position against.
			  .hue         the rainbow. An animated `hue-rotate` over everything
			               below it, including the glow, which is what makes the
			               colour flow THROUGH the bloom rather than under it.
			  SvgFx        the effect chain itself.
		-->
		<!--
			The ghost pass, when a strip asks for one: the same art drawn again a
			few pixels off and hue-shifted, which is printing plates out of
			register. Drawn FIRST so the base pass sits on top of it, the way the
			key plate does over a misaligned colour plate.
		-->
		{#each s.ghost ? [s.ghost, null] : [null] as g, gi (gi)}
		<div
			class="strip-host"
			class:ghost={!!g}
			style="left:{place(s, view).left}; top:{place(s, view).top}; width:{place(s, view)
				.width}; opacity:{g ? s.opacity * g.opacity : s.opacity};{g
				? ` --ghost-dx:${g.dx}px; --ghost-dy:${g.dy}px; --ghost-hue:${g.hue}deg;`
				: ''}"
		>
			<div
				class="hue"
				class:flowing={flowing}
				style="--hue-phase:{hueOf(b.i)};{s.blur > 0 ? ` --strip-blur:blur(${s.blur}px);` : ''}"
			>
				<SvgFx
					type={s.fx === 'none' ? 'glow' : s.fx}
					enabled={s.fx !== 'none'}
					size={s.fxSize}
					strength={s.fxStrength}
					color={flowing ? RAINBOW_BASE : s.fxColor}
					base={s.fxBase}
					bleed={70}
				>
			<svg
				class="strip"
				class:sel={selected === s.id}
				viewBox={box(b.layout)}
				preserveAspectRatio="xMidYMid meet"
				style:--spin="{s.spin}deg"
				style:mask-image={s.fade > 0 ? fadeMask(s.fade, s.fadeAngle) : undefined}
				style:-webkit-mask-image={s.fade > 0 ? fadeMask(s.fade, s.fadeAngle) : undefined}
			>
			<!--
				THE GLASS, and now the only thing left in this <svg>. The band's
				surface, painted behind its ribs and its rim — which are drawn by
				`StripsGl` on the canvas underneath.

				A pane reads as glass because of what happens at its EDGES, not its
				middle: a bright lip where the light catches, a darker body, and a
				sheen that changes across the surface. So each facet is filled from
				a gradient rather than a flat tint, and the fill leans on depth —
				the near half of the band catches more light than the far half,
				which is what stops it looking like a flat coloured shape.
			-->
			<g class="glass">
				{#each b.layout.facets as f, fi (fi)}
					<path
						d={f.d}
						style:fill="var(--backdrop-glass, rgba(150, 178, 170, 0.06))"
						style:opacity={0.15 + f.depth * 0.85}
					/>
				{/each}
			</g>
				</svg>
				</SvgFx>
			</div>
		</div>
		{/each}

		{#if labels}
			<!-- The tag rides the same placement, so a label cannot drift off the
			     strip it names once the camera moves. -->
			<!--
				A real button, not a span: clicking a strip's tag selects it, which
				is the shortest path from "that one" to editing it — you point at
				the thing on the stage rather than hunting for its id in a list.

				The backdrop as a whole is `pointer-events: none`, so this opts
				itself back in; nothing else in here is clickable.
			-->
			<button
				class="tag"
				class:sel={selected === s.id}
				style:left={place(s, view).left}
				style:top={place(s, view).top}
				onclick={() => onselect?.(s.id)}
				title="Edit {s.id}"
			>
				{s.id}
			</button>
		{/if}
	{/each}
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		z-index: -1;
	}
	.backdrop.in-canvas {
		z-index: 0;
	}
	.backdrop {
		overflow: hidden;
		pointer-events: none;
		opacity: var(--backdrop-strength, 1);
		/* A shorter perspective is a wider lens: too short and the rails splay to
		   near-horizontal at the frame edge and read as streaks. */
		perspective: 420px;
		perspective-origin: 50% 50%;
	}

	.plane {
		position: absolute;
		left: -75%;
		right: -75%;
		height: 145%;
		background-image:
			linear-gradient(90deg, var(--backdrop-line) 1px, transparent 1px),
			linear-gradient(var(--backdrop-line) 1px, transparent 1px);
		background-size:
			var(--backdrop-cell, 34px) 100%,
			100% var(--backdrop-cell, 34px);
		backface-visibility: hidden;
	}

	/* Each plane rotates about the edge sitting ON the horizon, so that edge
	   stays pinned to the centre line. The mask fades each at its FAR end — not
	   the same end for both, so they get one each. */
	.floor {
		top: 50%;
		transform-origin: 50% 0%;
		transform: rotateX(72deg);
		mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.5) 18%, black 55%);
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent 0%,
			rgba(0, 0, 0, 0.5) 18%,
			black 55%
		);
	}
	.ceiling {
		bottom: 50%;
		transform-origin: 50% 100%;
		transform: rotateX(-72deg);
		mask-image: linear-gradient(to top, transparent 0%, rgba(0, 0, 0, 0.5) 18%, black 55%);
		-webkit-mask-image: linear-gradient(to top, transparent 0%, rgba(0, 0, 0, 0.5) 18%, black 55%);
	}

	/* Placement only. No filter here, so it stays the containing block. */
	.strip-host {
		position: absolute;
		transform: translate(-50%, -50%);
	}

	/* The out-of-register copy. The offset is in the transform and the hue shift
	   is a filter on the host — NOT on `.hue` inside it, which already owns a
	   filter for the rainbow and the defocus and would lose one of them. */
	.strip-host.ghost {
		transform: translate(-50%, -50%) translate(var(--ghost-dx, 4px), var(--ghost-dy, -4px));
		filter: hue-rotate(var(--ghost-hue, 140deg));
	}

	/*
	 * Both inner layers must be block-level and full-width.
	 *
	 * The strip <svg> is `width: 100%`, and a percentage resolves against the
	 * nearest ancestor with a definite width. `SvgFx`'s wrapper is an
	 * inline-block, which is shrink-to-fit — so once it sat between the placed
	 * host and the svg, every strip re-measured itself against a collapsed box
	 * and the whole composition moved. Forcing both to fill the host puts the
	 * definite width back where it was.
	 */
	.hue,
	.hue :global(.svg-fx--wrap) {
		display: block;
		width: 100%;
	}

	/* The defocus lives here when the rainbow is off; when it is on, the two
	   compose in one declaration, because a second `filter` would replace the
	   first rather than add to it. */
	.hue {
		filter: var(--strip-blur, none);
	}
	.hue.flowing {
		filter: var(--strip-blur, ) hue-rotate(0deg);
		animation: hue-flow var(--rainbow-speed, 18s) linear infinite;
		/* A negative delay starts each strip partway through the SAME cycle,
		   which is what turns six loops into one travelling sweep. */
		animation-delay: calc(var(--rainbow-speed, 18s) * -1 * var(--hue-phase, 0));
	}

	@keyframes hue-flow {
		to {
			filter: var(--strip-blur, ) hue-rotate(360deg);
		}
	}

	/* The strip does NOT rotate. `--spin` is a fixed bearing for variety, not an
	   animation — a belt holds still and its material runs along it. */
	.strip {
		display: block;
		overflow: visible;
		width: 100%;
		transform: rotate(var(--spin));
		filter: var(--strip-blur, none);
	}
	.strip.sel {
		outline: 1px dashed var(--accent);
		outline-offset: 6px;
	}

	/* In rainbow mode the stroke is saturated so `hue-rotate` has a hue to turn;
	   the ground's near-grey would only ever produce a warmer grey. The rim and
	   its energy take the same base in the shader, from the same token. */
	/* The glass takes the hue too, or the band's body stays grey while its rim
	   cycles — which reads as a coloured wire around a dead surface. */
	.flowing .glass path {
		fill: var(--backdrop-rainbow-base, hsl(170 85% 60%));
	}

	/* The glass body. `fill-rule: evenodd` so the two laps overlapping do not
	   double the tint where the band crosses itself — a self-intersecting
	   surface otherwise paints twice and reads as a bright seam. */
	.glass path {
		stroke: none;
		fill-rule: evenodd;
	}

	.tag {
		position: absolute;
		transform: translate(-50%, -50%);
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 2px 6px;
		/* The backdrop is inert; the tag opts back in so it can be clicked. */
		pointer-events: auto;
		cursor: pointer;
	}
	.tag:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.tag.sel {
		color: var(--accent);
		border-color: var(--border-accent);
	}

	/* Motion is the first thing to go; the geometry is the design. The belt, the
	   slats, the energy and the travellers now opt out inside `StripsGl`, which
	   freezes its clock rather than unmounting — the strips still have to be
	   there. The rainbow is the one moving part still owned by CSS, because the
	   glass it turns is still painted by the DOM. */
	@media (prefers-reduced-motion: reduce) {
		.hue.flowing {
			animation: none;
		}
	}
</style>
