<script lang="ts">
	import type { Snippet } from 'svelte';
	import { panelShapeClasses, type PanelShape } from './panel-shape.js';

	/**
	 * The card's tint. `accent` and `changed` carry meaning rather than
	 * decoration: a tinted card is one the user is acting on, and `changed`
	 * marks a section holding an edit that has not been committed yet.
	 */
	export type PanelTone = 'default' | 'accent' | 'changed';

	export type { PanelShape } from './panel-shape.js';

	interface PanelProps {
		/** Full override for the header bar — takes precedence over title/actions. */
		header?: Snippet;
		/** Auto-generated mono header label. Ignored when header snippet is provided. */
		title?: string;
		/** Glyph rendered before `title`, naming the card's subject at a glance. */
		icon?: Snippet;
		/** Right-aligned content in the auto-generated header row. */
		actions?: Snippet;
		/** Rendered in a bordered footer bar below the body. */
		footer?: Snippet;
		/** Card tint. Defaults to the neutral elevated surface. */
		tone?: PanelTone;
		/**
		 * The header/outline composition. Defaults to the rounded rectangle with a
		 * rule near the top. See `PanelShape`.
		 */
		shape?: PanelShape;
		/**
		 * Drop the header's divider and raised background so it reads as a label
		 * inside the card rather than a titlebar on top of it. Suits dense
		 * config surfaces where a divider per card adds rules but no meaning.
		 */
		flush?: boolean;
		/**
		 * Let absolutely-positioned children (hover popovers, dropdowns, tooltips)
		 * escape the card bounds. Off by default so the header/footer stay clipped
		 * to the rounded corners; the header/footer get matching corner rounding
		 * when enabled so they still read as a card.
		 */
		allowOverflow?: boolean;
		/**
		 * Body padding. `dense` is for surfaces that stack many panels in a narrow
		 * rail — a HUD, an inspector column — where the default 16px gutter spends
		 * more of the rail on air than on content. `none` hands the padding to the
		 * child, for a panel wrapping a list or a canvas that must reach the edge.
		 */
		padding?: 'default' | 'dense' | 'none';
		/** Extra classes forwarded to the root element. */
		class?: string;
		children: Snippet;
	}

	let {
		header,
		title,
		icon,
		actions,
		footer,
		tone = 'default',
		shape = 'default',
		flush = false,
		allowOverflow = false,
		padding = 'default',
		class: cls = '',
		children
	}: PanelProps = $props();

	const showHeader = $derived(!!(header || title || actions || icon));

	const shapeCls = $derived(panelShapeClasses(shape, allowOverflow).join(' '));

	const BODY_PAD: Record<NonNullable<PanelProps['padding']>, string> = {
		default: 'px-4 py-4',
		dense: 'px-2.5 py-2.5',
		none: ''
	};
	// `none` is about the BODY handing its gutter to the child — the header is not
	// that child, so it keeps the standard gutter or its title hangs off-grid
	// from the content below it.
	const HEAD_PAD: Record<NonNullable<PanelProps['padding']>, string> = {
		default: 'px-4',
		dense: 'px-2.5',
		none: 'px-4'
	};
</script>

<!-- `data-allow-overflow` is not decoration: the QA inspector re-shapes panels
     by swapping classes on the live element, and it must not overturn a page's
     decision to let content escape. This is where it reads it from. -->
<div class="panel tone-{tone} {shapeCls} {cls}" data-allow-overflow={allowOverflow}>
	{#if showHeader}
		<div
			class="panel-header {HEAD_PAD[padding]} {flush
				? padding === 'dense'
					? 'pt-2.5 pb-0'
					: 'pt-4 pb-0'
				: padding === 'dense'
					? 'py-2 panel-head'
					: 'py-3 panel-head'} {allowOverflow && !flush ? 'r-surface-t' : ''}"
		>
			{#if header}
				{@render header()}
			{:else}
				<div class="flex items-center gap-[0.45rem]">
					{#if icon}
						<span class="flex items-center text-[var(--fg-dim)]">{@render icon()}</span>
					{/if}
					<span
						class="panel-title font-mono text-[0.72rem] font-semibold tracking-[0.1em] uppercase text-[var(--fg-dim)]"
					>
						{title}
					</span>
					{#if actions}
						<div class="flex items-center gap-[0.4rem] ml-auto">
							{@render actions()}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
	<div class="panel-body {BODY_PAD[padding]}">
		{@render children()}
	</div>
	{#if footer}
		<div class="panel-foot px-4 py-3 border-t border-[var(--border)] {allowOverflow ? 'r-surface-b' : ''}">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	/* The surface is NOT painted here — it comes from the shared `.glass` in the
	   markup, which is the only thing `data-appearance` switches. A `background`
	   in this block would be unlayered component CSS beating `@layer components`,
	   which is exactly how this card spent its life opaque and deaf to the
	   setting while every other card in the library followed it. */
	.panel {
		transition:
			border-color 0.18s,
			background 0.18s;
	}
	/* Tones tint the glass surface TOKEN rather than the background, so the rim
	   and the sheen keep painting over the tint instead of being replaced by it.
	   color-mix rather than a flat rgba so a tone tracks whatever the palette
	   token resolves to under the active theme. */
	.tone-accent {
		--glass-surface: color-mix(in srgb, var(--palette-emerald) 8%, transparent);
	}
	.tone-changed {
		--glass-surface: color-mix(in srgb, var(--palette-amber) 10%, transparent);
	}
	/* Flat appearance never reads `--glass-surface`, so a tone has to restate
	   itself as a real background there or the card loses its tint entirely. */
	:global([data-appearance='flat']) .tone-accent {
		border-color: color-mix(in srgb, var(--palette-emerald) 40%, transparent);
		background: color-mix(in srgb, var(--palette-emerald) 4%, transparent);
	}
	:global([data-appearance='flat']) .tone-changed {
		border-color: color-mix(in srgb, var(--palette-amber) 60%, transparent);
		background: color-mix(in srgb, var(--palette-amber) 6%, transparent);
	}
	.panel-head {
		border-bottom: 1px solid var(--border);
		background: var(--surface-raised);
	}

	/* ── Shapes ───────────────────────────────────────────────────────────────
	   Every rule below is two classes deep (`.shape-x .panel-header`), which is
	   what lets it beat the single-class Tailwind utilities on those elements
	   without a single `!important`.

	   A shape that erases part of its own outline has to PAINT over it — there is
	   no way to un-draw a border. That paint is the page colour, so a card on a
	   surface that is not `--bg` sets `--panel-knockout` to whatever it sits on. */
	.panel {
		--panel-knockout: var(--bg);
		--panel-edge: var(--border-strong);
	}
	/* Shapes that redraw the outline themselves get the default one taken away
	   rather than fighting it. */
	.is-bare {
		border: 0;
		background: none;
	}
	.panel:not(.shape-default) {
		position: relative;
	}

	/* ── Tab ── the outline breaks and re-forms around a raised header ────── */
	.shape-tab {
		border-top-left-radius: 0;
	}
	.shape-tab .panel-header {
		position: absolute;
		top: 0;
		left: -1px;
		transform: translateY(-100%);
		min-width: 10rem;
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--panel-edge);
		border-bottom: 0;
		border-radius: var(--radius-surface) var(--radius-surface) 0 0;
		background: var(--bg-elev);
	}
	/* Hides the card's own top border under the tab, so the seam disappears and
	   the two boxes read as one continuous outline. */
	.shape-tab .panel-header::after {
		content: '';
		position: absolute;
		left: 1px;
		right: 1px;
		bottom: -1px;
		height: 1px;
		background: var(--bg-elev);
	}

	/* ── Legend ── the title sits ON the border and knocks a hole in it ────── */
	.shape-legend .panel-header {
		position: absolute;
		top: 0;
		left: 1rem;
		transform: translateY(-50%);
		width: auto;
		padding: 0 0.5rem;
		border-bottom: 0;
		background: var(--panel-knockout);
	}
	.shape-legend .panel-body {
		padding-top: 1.1rem;
	}

	/* ── Notch ── the outline steps inward to admit the header ─────────────── */
	/* Border and fill are two clipped layers: a border cannot follow a clip-path,
	   so the lower layer IS the edge colour and the upper one is inset by 1px. */
	.shape-notch,
	.shape-chamfer {
		isolation: isolate;
	}
	.shape-notch::before,
	.shape-notch::after,
	.shape-chamfer::before,
	.shape-chamfer::after {
		content: '';
		position: absolute;
		z-index: -1;
	}
	.shape-notch > *,
	.shape-chamfer > * {
		position: relative;
	}
	.shape-notch {
		--notch-w: 58%;
		--notch-h: 2.2rem;
	}
	/* The header side is the TALL side: the outline drops to meet the body after
	   it. Cutting the header's own corner away instead left it floating over a
	   hole, which reads as a detached label rather than a card cut to admit one. */
	.shape-notch::before,
	.shape-notch::after {
		clip-path: polygon(
			0 0,
			var(--notch-w) 0,
			var(--notch-w) var(--notch-h),
			100% var(--notch-h),
			100% 100%,
			0 100%
		);
	}
	.shape-notch::before {
		inset: 0;
		background: var(--panel-edge);
	}
	.shape-notch::after {
		inset: 1px;
		background: var(--bg-elev);
	}
	.shape-notch .panel-header {
		display: flex;
		align-items: center;
		width: var(--notch-w);
		height: var(--notch-h);
		padding-top: 0;
		padding-bottom: 0;
		border-bottom: 0;
		background: none;
	}
	.shape-notch .panel-body {
		padding-top: 0.5rem;
	}

	/* ── Chamfer ── a cut corner turns a sheet into a plate ────────────────── */
	.shape-chamfer {
		--cut: 1.5rem;
	}
	.shape-chamfer::before {
		inset: 0;
		background: var(--panel-edge);
		clip-path: polygon(var(--cut) 0, 100% 0, 100% 100%, 0 100%, 0 var(--cut));
	}
	.shape-chamfer::after {
		inset: 1px;
		background: var(--bg-elev);
		clip-path: polygon(var(--cut) 0, 100% 0, 100% 100%, 0 100%, 0 var(--cut));
	}
	/* Indented past the cut so the label starts where the plate does. */
	.shape-chamfer .panel-header {
		padding-left: calc(var(--cut) + 0.4rem);
	}

	/* ── Bracket ── four corners imply the outline ─────────────────────────── */
	.shape-bracket::before,
	.shape-bracket::after,
	.shape-bracket .panel-body::before,
	.shape-bracket .panel-body::after {
		content: '';
		position: absolute;
		width: 1.3rem;
		height: 1.3rem;
		border: 1px solid var(--accent);
		pointer-events: none;
	}
	.shape-bracket::before {
		top: 0;
		left: 0;
		border-right: 0;
		border-bottom: 0;
	}
	.shape-bracket::after {
		top: 0;
		right: 0;
		border-left: 0;
		border-bottom: 0;
	}
	.shape-bracket .panel-body {
		position: static;
	}
	.shape-bracket .panel-body::before {
		bottom: 0;
		left: 0;
		border-right: 0;
		border-top: 0;
	}
	.shape-bracket .panel-body::after {
		bottom: 0;
		right: 0;
		border-left: 0;
		border-top: 0;
	}
	.shape-bracket .panel-header {
		justify-content: center;
		border-bottom: 0;
		background: none;
	}
	.shape-bracket .panel-header :global(.panel-title) {
		color: var(--accent);
	}

	/* ── Spine ── the header rotates onto the edge and becomes the binding ─── */
	.shape-spine {
		display: flex;
		flex-wrap: wrap;
	}
	.shape-spine .panel-header {
		flex: none;
		width: 2.1rem;
		padding: 0.7rem 0;
		border-right: 1px solid var(--border);
		border-bottom: 0;
		background: color-mix(in srgb, var(--accent) 7%, transparent);
		writing-mode: vertical-rl;
		text-orientation: mixed;
	}
	.shape-spine .panel-body {
		flex: 1 1 0;
		min-width: 0;
	}
	.shape-spine .panel-foot {
		width: 100%;
	}

	/* ── Split ── two objects, one owning the other ────────────────────────── */
	.shape-split .panel-header {
		width: fit-content;
		min-width: 11rem;
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--panel-edge);
		border-radius: var(--radius-control);
		background: var(--bg-elev);
	}
	.shape-split .panel-body {
		position: relative;
		margin-top: 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		background: var(--bg-elev);
	}
	/* The stem. Without it these are two cards, not one card in two parts. */
	.shape-split .panel-body::before {
		content: '';
		position: absolute;
		top: -0.85rem;
		left: 1.5rem;
		width: 1px;
		height: 0.85rem;
		background: var(--panel-edge);
	}

	/* ── Ticket ── a stub you tear off ─────────────────────────────────────── */
	.shape-ticket .panel-header {
		position: relative;
		padding-bottom: 0.7rem;
		border-bottom: 1px dashed var(--panel-edge);
		background: none;
	}
	/* The bites: page-coloured circles straddling both edges at the tear line. */
	.shape-ticket .panel-header::before,
	.shape-ticket .panel-header::after {
		content: '';
		position: absolute;
		bottom: -0.45rem;
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 50%;
		background: var(--panel-knockout);
		box-shadow: 0 0 0 1px var(--panel-edge);
	}
	.shape-ticket .panel-header::before {
		left: -0.5rem;
	}
	.shape-ticket .panel-header::after {
		right: -0.5rem;
	}

	/* ── Cap ── a tinted lid the body hangs under ──────────────────────────── */
	.shape-cap {
		border-top: 0;
		border-radius: 0 0 var(--radius-surface) var(--radius-surface);
	}
	.shape-cap .panel-header {
		/* Proud of the body's border on both sides, so it reads as a lid rather
		   than the first row. */
		margin: 0 -1px;
		border: 1px solid var(--accent);
		border-radius: var(--radius-surface) var(--radius-surface) 0 0;
		background: var(--accent-faint);
	}
	.shape-cap .panel-header :global(.panel-title) {
		color: var(--accent);
	}

	/* ── Rule ── the underline is the entire chrome ────────────────────────── */
	.shape-rule .panel-header {
		padding-left: 0;
		padding-right: 0;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--accent);
		background: none;
	}
	.shape-rule .panel-body {
		padding-left: 0;
		padding-right: 0;
	}

	/* ── Pill ── a marker pinned to the card, not part of it ───────────────── */
	.shape-pill .panel-header {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translate(-50%, -50%);
		width: auto;
		padding: 0.3rem 0.8rem;
		border: 1px solid var(--accent);
		border-radius: 999px;
		border-bottom: 1px solid var(--accent);
		background: var(--bg-elev);
	}
	.shape-pill .panel-header :global(.panel-title) {
		color: var(--accent);
	}
	.shape-pill .panel-body {
		padding-top: 1.3rem;
	}

	/* ── Slant ── one non-level edge, so a stack stops reading as a table ──── */
	.shape-slant .panel-header {
		padding-bottom: 1.1rem;
		border-bottom: 0;
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		clip-path: polygon(0 0, 100% 0, 100% 100%, 0 calc(100% - 0.9rem));
	}
	.shape-slant .panel-body {
		padding-top: 0.2rem;
	}
</style>
