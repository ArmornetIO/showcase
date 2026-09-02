<script lang="ts" module>
	export type ChipColor =
		| 'default'
		| 'accent'
		| 'success'
		| 'warn'
		| 'error'
		| 'cyan'
		| 'blue'
		| 'critical'
		| 'get'
		| 'post'
		| 'delete'
		| 'patch';

	export type ChipLook = 'ghost' | 'filled';
	export type ChipCut = 'square' | 'shield' | 'node' | 'line' | 'tag' | 'pill';
	export type ChipEdge = 'hairline' | 'bracket' | 'none';
	export type ChipLead = 'none' | 'dot' | 'bar' | 'wedge';
	export type ChipSize = 'sm' | 'md';

	// The option lists the studio's knob declaration reads, so a silhouette
	// added here cannot go missing from the panel that is supposed to show it.
	export const CHIP_CUTS: readonly ChipCut[] = ['square', 'shield', 'node', 'line', 'tag', 'pill'];
	export const CHIP_EDGES: readonly ChipEdge[] = ['hairline', 'bracket', 'none'];
	export const CHIP_LEADS: readonly ChipLead[] = ['none', 'dot', 'bar', 'wedge'];
</script>

<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// CHIP — a label that carries its meaning in its SILHOUETTE, not only in a
	// hue.
	//
	// The rounded hairline rectangle this started as is the shape every tool
	// reaches for by default, which is exactly the problem: it says "this is a
	// tag" and nothing else. So the shape vocabulary here is closed and derived,
	// not invented per use — EVERY cut is a 45° chamfer of one or more corners
	// of the same box, and which corners are cut is the whole message:
	//
	//   square  no cut          · inert data. A value, not a state.
	//   shield  bottom two      · the crest's foot. Identity and ownership.
	//   node    all four        · the mesh node's octagon. A thing on the graph.
	//   line    top-L + bot-R   · a segment with direction. Flow, transition.
	//   tag     left point      · hangs off a parent. Bound to the row it's in.
	//
	// One family, one construction rule, five readings — which is what keeps it
	// a system instead of a mood board. `pill` stays only because the old shape
	// is still in the wild; it is the one option that means nothing.
	//
	// WHY THE CUTS ARE PAINTED, NOT BORDERED: `clip-path` removes the corner and
	// the border with it, leaving the chamfer edge open. Each cut therefore
	// re-draws its own hypotenuse as a background layer. The corner-KEYWORD
	// gradients below are exact for that: `to bottom right` puts its 50% band
	// through the other two corners of its box at any aspect ratio, so the line
	// lands on the hypotenuse rather than near it.
	import type { Snippet } from 'svelte';
	import GlowOutline from '../chrome/GlowOutline.svelte';

	interface ChipProps {
		look?: ChipLook;
		color?: ChipColor;
		/** Which corners are chamfered — the chip's meaning. See the header. */
		cut?: ChipCut;
		/** Chamfer depth. Under 3px the cut reads as a rendering artefact. */
		cutSize?: number;
		/** How the outline is drawn: continuous hairline, HUD corner ticks, or
		 *  nothing at all (fill-only, for chips packed into a dense table). */
		edge?: ChipEdge;
		/** The leading marker. `dot` is the legacy signal; `bar` and `wedge` are
		 *  painted inside the clip, so they take the silhouette's cut with them. */
		lead?: ChipLead;
		/** Animates the `dot` lead. Kept as its own prop because call sites read
		 *  `pulse` as "this is live", not as "put a dot here". */
		pulse?: boolean;
		size?: ChipSize;
		/** Wraps the chip in an animated RGB conic-gradient outline. */
		outline?: 'rgb';
		href?: string;
		target?: string;
		rel?: string;
		children: Snippet;
	}

	let {
		look = 'ghost',
		color = 'default',
		cut = 'square',
		cutSize = 6,
		edge = 'hairline',
		lead,
		pulse = false,
		size,
		outline,
		href,
		target,
		rel,
		children
	}: ChipProps = $props();

	// `pulse` predates `lead` and every existing call site uses it alone, so it
	// still has to be able to summon the dot by itself.
	const leadMark = $derived(lead ?? (pulse ? 'dot' : 'none'));
	// The two looks shipped at different type sizes before `size` existed;
	// keeping that as the default is what makes this prop additive.
	const sizeCls = $derived(size ?? (look === 'filled' ? 'md' : 'sm'));
</script>

{#snippet body()}
	{#if leadMark === 'dot'}
		<span class="chip-dot" class:chip-dot-pulse={pulse} aria-hidden="true"></span>
	{/if}
	{@render children()}
{/snippet}

{#snippet chip()}
	{#if href}
		<a
			{href}
			{target}
			{rel}
			class="chip chip-body"
			data-look={look}
			data-color={color}
			data-cut={cut}
			data-edge={edge}
			data-lead={leadMark}
			data-size={sizeCls}
			data-outline={outline}
			style="--chip-cut:{cutSize}px"
		>
			{@render body()}
		</a>
	{:else}
		<span
			class="chip chip-body"
			data-look={look}
			data-color={color}
			data-cut={cut}
			data-edge={edge}
			data-lead={leadMark}
			data-size={sizeCls}
			data-outline={outline}
			style="--chip-cut:{cutSize}px"
		>
			{@render body()}
		</span>
	{/if}
{/snippet}

{#if outline === 'rgb'}
	<GlowOutline>{@render chip()}</GlowOutline>
{:else}
	{@render chip()}
{/if}

<style>
	/* ── the box ─────────────────────────────────────────────────────────── */
	/* max-width + ellipsis: a chip used as a link with a long URL truncates at
	   its own boundary instead of pushing the row past the container edge.
	   `chip-body` stays as the ItemFrames shimmer hook — see lib/frames/frames.ts. */
	.chip {
		--chip-hair: 1.1px; /* just over 1px, or the diagonals alias into gaps */
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--mono);
		font-weight: 500;
		text-transform: uppercase;
		white-space: nowrap;
		line-height: 1;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		border: var(--chip-hair) solid var(--chip-edge);
		border-radius: var(--radius-hairline);
		color: var(--chip-ink);
		background-color: var(--chip-fill);
	}

	.chip[data-size='sm'] {
		font-size: 0.625rem;
		letter-spacing: 0.15em;
		padding: 4px 8px;
	}

	.chip[data-size='md'] {
		font-size: 0.7rem;
		letter-spacing: 0.05em;
		padding: 3px 10px;
	}

	/* ── colour ──────────────────────────────────────────────────────────── */
	/* One declaration per hue rather than per hue × look: the look only decides
	   whether `--chip-fill` is painted, so a new colour is four lines, not eight. */
	.chip { --chip-fill: transparent; }

	.chip[data-color='default'] {
		--chip-ink: var(--fg-dim);
		--chip-edge: rgba(156, 163, 175, 0.3);
		--chip-dot: rgba(156, 163, 175, 0.6);
		--chip-tint: var(--surface-raised);
	}
	.chip[data-color='accent'] {
		--chip-ink: var(--accent);
		--chip-edge: rgba(94, 234, 212, 0.35);
		--chip-dot: var(--accent);
		--chip-tint: var(--accent-faint);
	}
	.chip[data-color='success'] {
		--chip-ink: var(--palette-emerald-l);
		--chip-edge: rgba(52, 211, 153, 0.35);
		--chip-dot: var(--palette-emerald);
		--chip-tint: rgba(52, 211, 153, 0.1);
	}
	.chip[data-color='warn'] {
		--chip-ink: var(--palette-amber);
		--chip-edge: rgba(252, 211, 77, 0.4);
		--chip-dot: var(--palette-amber);
		--chip-tint: rgba(252, 211, 77, 0.1);
	}
	.chip[data-color='error'] {
		--chip-ink: var(--palette-red);
		--chip-edge: rgba(252, 165, 165, 0.4);
		--chip-dot: var(--palette-red);
		--chip-tint: rgba(252, 165, 165, 0.1);
	}
	.chip[data-color='cyan'] {
		--chip-ink: var(--palette-cyan-l);
		--chip-edge: rgba(34, 211, 238, 0.35);
		--chip-dot: var(--palette-cyan);
		--chip-tint: rgba(34, 211, 238, 0.1);
	}
	.chip[data-color='blue'] {
		--chip-ink: var(--palette-blue-l);
		--chip-edge: rgba(56, 189, 248, 0.35);
		--chip-dot: var(--palette-blue);
		--chip-tint: rgba(56, 189, 248, 0.1);
	}
	.chip[data-color='critical'] {
		--chip-ink: var(--palette-red);
		--chip-edge: rgba(252, 165, 165, 0.5);
		--chip-dot: var(--palette-red);
		--chip-tint: rgba(252, 165, 165, 0.1);
	}
	.chip[data-color='get'] {
		--chip-ink: var(--method-get-fg);
		--chip-edge: color-mix(in srgb, var(--method-get-fg) 30%, transparent);
		--chip-dot: var(--method-get-fg);
		--chip-tint: var(--method-get-bg);
	}
	.chip[data-color='post'] {
		--chip-ink: var(--method-post-fg);
		--chip-edge: color-mix(in srgb, var(--method-post-fg) 30%, transparent);
		--chip-dot: var(--method-post-fg);
		--chip-tint: var(--method-post-bg);
	}
	.chip[data-color='delete'] {
		--chip-ink: var(--method-delete-fg);
		--chip-edge: color-mix(in srgb, var(--method-delete-fg) 30%, transparent);
		--chip-dot: var(--method-delete-fg);
		--chip-tint: var(--method-delete-bg);
	}
	.chip[data-color='patch'] {
		--chip-ink: var(--method-patch-fg);
		--chip-edge: color-mix(in srgb, var(--method-patch-fg) 30%, transparent);
		--chip-dot: var(--method-patch-fg);
		--chip-tint: var(--method-patch-bg);
	}

	.chip[data-look='filled'] { --chip-fill: var(--chip-tint); }

	/* The RGB outline owns the edge; anything the chip paints fights it. */
	.chip[data-outline='rgb'] {
		--chip-ink: #fff;
		--chip-edge: transparent;
		--chip-fill: transparent;
	}

	/* ── silhouette ──────────────────────────────────────────────────────── */
	.chip[data-cut='pill'] { border-radius: 999px; }

	/* A cut corner IS the corner treatment — a radius on the survivors reads as
	   indecision between the two. */
	.chip:not([data-cut='square']):not([data-cut='pill']) { border-radius: 0; }

	.chip[data-cut='shield'] {
		clip-path: polygon(
			0 0,
			100% 0,
			100% calc(100% - var(--chip-cut)),
			calc(100% - var(--chip-cut)) 100%,
			var(--chip-cut) 100%,
			0 calc(100% - var(--chip-cut))
		);
	}

	.chip[data-cut='node'] {
		clip-path: polygon(
			var(--chip-cut) 0,
			calc(100% - var(--chip-cut)) 0,
			100% var(--chip-cut),
			100% calc(100% - var(--chip-cut)),
			calc(100% - var(--chip-cut)) 100%,
			var(--chip-cut) 100%,
			0 calc(100% - var(--chip-cut)),
			0 var(--chip-cut)
		);
	}

	.chip[data-cut='line'] {
		clip-path: polygon(
			var(--chip-cut) 0,
			100% 0,
			100% calc(100% - var(--chip-cut)),
			calc(100% - var(--chip-cut)) 100%,
			0 100%,
			0 var(--chip-cut)
		);
	}

	.chip[data-cut='tag'] {
		clip-path: polygon(var(--chip-cut) 0, 100% 0, 100% 100%, var(--chip-cut) 100%, 0 50%);
		/* The point replaces the left edge; a border there would be a stub. */
		border-left-color: transparent;
		padding-left: calc(8px + var(--chip-cut));
	}

	/* ── the cut edges ───────────────────────────────────────────────────── */
	/* One `::before` per silhouette, each a fixed list of corner boxes. The
	   corner keyword picks the diagonal: `to top right` draws the hypotenuse of
	   a bottom-left or top-right cut, `to bottom right` the other two. */
	/* `inset: -hair` and not 0: an absolutely positioned pseudo is laid out
	   against the PADDING box, so at `inset: 0` every corner square lands a
	   border-width inside the clip and the diagonals miss the straight edges
	   they are supposed to join. Pulling it out by the border width makes this
	   layer the border box, which is what the clip-path is cut from.

	   The band is 2× the hairline for the same reason it looks right: it is
	   centred on the hypotenuse, so the clip eats the outer half and exactly one
	   hairline survives — flush with the straight border rather than half of it. */
	.chip::before {
		content: '';
		position: absolute;
		inset: calc(var(--chip-hair) * -1);
		pointer-events: none;
		background-repeat: no-repeat;
	}

	.chip[data-cut='shield']::before {
		background-image:
			linear-gradient(
				to top right,
				transparent calc(50% - var(--chip-hair)),
				var(--chip-edge) calc(50% - var(--chip-hair)) calc(50% + var(--chip-hair)),
				transparent calc(50% + var(--chip-hair))
			),
			linear-gradient(
				to bottom right,
				transparent calc(50% - var(--chip-hair)),
				var(--chip-edge) calc(50% - var(--chip-hair)) calc(50% + var(--chip-hair)),
				transparent calc(50% + var(--chip-hair))
			);
		background-size: var(--chip-cut) var(--chip-cut);
		background-position: left bottom, right bottom;
	}

	.chip[data-cut='node']::before {
		background-image:
			linear-gradient(
				to bottom right,
				transparent calc(50% - var(--chip-hair)),
				var(--chip-edge) calc(50% - var(--chip-hair)) calc(50% + var(--chip-hair)),
				transparent calc(50% + var(--chip-hair))
			),
			linear-gradient(
				to top right,
				transparent calc(50% - var(--chip-hair)),
				var(--chip-edge) calc(50% - var(--chip-hair)) calc(50% + var(--chip-hair)),
				transparent calc(50% + var(--chip-hair))
			),
			linear-gradient(
				to bottom right,
				transparent calc(50% - var(--chip-hair)),
				var(--chip-edge) calc(50% - var(--chip-hair)) calc(50% + var(--chip-hair)),
				transparent calc(50% + var(--chip-hair))
			),
			linear-gradient(
				to top right,
				transparent calc(50% - var(--chip-hair)),
				var(--chip-edge) calc(50% - var(--chip-hair)) calc(50% + var(--chip-hair)),
				transparent calc(50% + var(--chip-hair))
			);
		background-size: var(--chip-cut) var(--chip-cut);
		background-position: left top, right top, right bottom, left bottom;
	}

	.chip[data-cut='line']::before {
		background-image:
			linear-gradient(
				to bottom right,
				transparent calc(50% - var(--chip-hair)),
				var(--chip-edge) calc(50% - var(--chip-hair)) calc(50% + var(--chip-hair)),
				transparent calc(50% + var(--chip-hair))
			),
			linear-gradient(
				to bottom right,
				transparent calc(50% - var(--chip-hair)),
				var(--chip-edge) calc(50% - var(--chip-hair)) calc(50% + var(--chip-hair)),
				transparent calc(50% + var(--chip-hair))
			);
		background-size: var(--chip-cut) var(--chip-cut);
		background-position: left top, right bottom;
	}

	/* Half-height boxes, so the point is a true V regardless of chip height. */
	.chip[data-cut='tag']::before {
		background-image:
			linear-gradient(
				to bottom right,
				transparent calc(50% - var(--chip-hair)),
				var(--chip-edge) calc(50% - var(--chip-hair)) calc(50% + var(--chip-hair)),
				transparent calc(50% + var(--chip-hair))
			),
			linear-gradient(
				to top right,
				transparent calc(50% - var(--chip-hair)),
				var(--chip-edge) calc(50% - var(--chip-hair)) calc(50% + var(--chip-hair)),
				transparent calc(50% + var(--chip-hair))
			);
		background-size: var(--chip-cut) 50%;
		background-position: left top, left bottom;
	}

	/* ── outline mode ────────────────────────────────────────────────────── */
	/* Corner ticks instead of a closed box: in a dense table a full outline adds
	   one rectangle per row, and the rows stop reading as rows. Deliberately
	   scoped to the uncut silhouettes — a tick on a chamfer is a stray dash. */
	.chip[data-edge='bracket'] { border-color: transparent; }

	.chip[data-edge='bracket']::after {
		content: '';
		position: absolute;
		inset: calc(var(--chip-hair) * -1);
		pointer-events: none;
		background-image:
			linear-gradient(var(--chip-edge), var(--chip-edge)),
			linear-gradient(var(--chip-edge), var(--chip-edge)),
			linear-gradient(var(--chip-edge), var(--chip-edge)),
			linear-gradient(var(--chip-edge), var(--chip-edge)),
			linear-gradient(var(--chip-edge), var(--chip-edge)),
			linear-gradient(var(--chip-edge), var(--chip-edge)),
			linear-gradient(var(--chip-edge), var(--chip-edge)),
			linear-gradient(var(--chip-edge), var(--chip-edge));
		background-size:
			5px var(--chip-hair), var(--chip-hair) 5px,
			5px var(--chip-hair), var(--chip-hair) 5px,
			5px var(--chip-hair), var(--chip-hair) 5px,
			5px var(--chip-hair), var(--chip-hair) 5px;
		background-position:
			left top, left top,
			right top, right top,
			right bottom, right bottom,
			left bottom, left bottom;
		background-repeat: no-repeat;
	}

	.chip[data-edge='none'] { border-color: transparent; }
	.chip[data-edge='none']::before { background-image: none; }

	/* ── leading marker ──────────────────────────────────────────────────── */
	/* `bar` and `wedge` are painted on the chip itself, so the silhouette's
	   clip crops them — the marker takes the chamfer with it instead of poking
	   through the cut corner the way an absolutely-positioned child would. */
	.chip[data-lead='bar'] {
		background-image: linear-gradient(var(--chip-dot), var(--chip-dot));
		background-size: 2px 100%;
		background-position: left center;
		background-repeat: no-repeat;
		padding-left: 12px;
	}

	.chip[data-lead='wedge'] {
		background-image: linear-gradient(to top right, var(--chip-dot) 50%, transparent 50%);
		background-size: 7px 100%;
		background-position: left center;
		background-repeat: no-repeat;
		padding-left: 15px;
	}

	.chip[data-cut='tag'][data-lead='bar'],
	.chip[data-cut='tag'][data-lead='wedge'] {
		padding-left: calc(12px + var(--chip-cut));
		background-position: var(--chip-cut) center;
	}

	.chip-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 999px;
		flex-shrink: 0;
		background: var(--chip-dot);
	}

	.chip-dot-pulse {
		animation: chip-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes chip-pulse {
		0%,
		100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	@media (prefers-reduced-motion: reduce) {
		.chip-dot-pulse { animation: none; }
	}

	a.chip {
		text-decoration: none;
	}
</style>
