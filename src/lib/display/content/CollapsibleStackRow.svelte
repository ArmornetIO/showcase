<script lang="ts" module>
	export type CollapsibleStackRowSize = 'sm' | 'md';
</script>

<script lang="ts">
	// One line of a `CollapsibleStack`. See that file for why the stack owns which
	// row is open.
	//
	// THE RULE THIS ENFORCES: a worklist row is ONE LINE HIGH. Rows that wrap
	// cannot be scanned, and a list you cannot scan is a stack of cards with
	// extra steps. Anything that would have been a second line is a glyph with a
	// tooltip, or it lives in the expansion.
	//
	// ANATOMY — `meta` is a sibling of the button, never inside it. A trailing
	// mark is often a link, and an anchor nested in a button is invalid HTML that
	// browsers resolve however they like.
	//
	//   ▏ ⚠  Revocation SLA is 5 business days…      💬 ⚑   52d  ›
	//   ▔   ▔                                         ▔     ▔    ▔
	//  edge glyph        label (truncates)          meta  trailing chevron
	//
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '../../icons/Icon.svelte';
	import Tooltip from '../../primitives/status/Tooltip.svelte';
	import Flourish from '../../motion/Flourish.svelte';
	import type { FlourishKind } from '../../motion/effects.js';
	import { advancedSettings } from '../../settings/store.svelte.js';
	import { getStackContext } from './collapsible-stack.js';

	interface Props {
		/** Identity within the stack. Required when inside one. */
		key?: string;
		/** Standalone open state, used only when there is no stack around. */
		open?: boolean;
		/** Leading glyph — the row's verb or severity, as a picture. */
		glyph?: IconName;
		glyphColor?: string;
		/** Tooltip on the glyph. The WORD for the glyph goes here, so the row does
		 *  not spend a column repeating what the icon already says. */
		glyphLabel?: string;
		/**
		 * Left-edge colour. Reserve it for rows genuinely worse than their
		 * neighbours — an edge on every row is a border, not a signal. Rows
		 * without one still get the hover edge, so the affordance is uniform.
		 */
		accent?: string;
		/** Right-aligned scalar — an age, a count, a level. Kept short. */
		trailing?: string;
		/** The row's line. Truncates; never wraps. */
		label: Snippet;
		/** Trailing marks, rendered outside the button so links work. */
		meta?: Snippet;
		/** The body, shown when open. */
		children?: Snippet;
		/** `sm` for logs, `md` for lists read at a slower pace. */
		size?: CollapsibleStackRowSize;
		/**
		 * Effect on expand, replayed in reverse on collapse. Follows the theme's
		 * nav selection effect so one preference drives the whole app; pass
		 * `'none'` to opt a list out.
		 */
		flourish?: FlourishKind;
	}

	let {
		key,
		open = $bindable(false),
		glyph,
		glyphColor = 'var(--fg-dim)',
		glyphLabel,
		accent,
		trailing,
		label,
		meta,
		children,
		size = 'sm',
		flourish
	}: Props = $props();

	const stack = getStackContext();
	const isOpen = $derived(stack && key ? stack.isOpen(key) : open);

	const fxKind = $derived(flourish ?? advancedSettings.navFlourish);

	// Two counters, one per half of the lifecycle, so an expand and a collapse
	// can be on screen at once without either resetting the other — the same
	// split `ActionsMenu` uses for its open/close bursts.
	let openBurst = $state(0);
	let closeBurst = $state(0);

	function toggle() {
		const next = !isOpen;
		if (stack && key) stack.toggle(key);
		else open = next;
		if (next) openBurst += 1;
		else closeBurst += 1;
	}

	const pad = $derived(size === 'sm' ? 'py-[0.26rem]' : 'py-[0.45rem]');
	const text = $derived(size === 'sm' ? 'text-[0.76rem]' : 'text-[0.84rem]');
</script>

<li
	class="cs-row relative"
	class:cs-accented={!!accent}
	class:cs-open={isOpen}
	style:--cs-accent={accent ?? 'transparent'}
>
	<!-- Anchored near the glyph, so the burst reads as belonging to the line that
	     opened rather than to the page. -->
	<Flourish kind={fxKind} trigger={openBurst} anchorX="16px" color={accent ?? 'var(--accent)'} />
	<Flourish
		kind={fxKind}
		trigger={closeBurst}
		anchorX="16px"
		color={accent ?? 'var(--accent)'}
		reverse
	/>

	<div class="flex items-center gap-3 pl-3 pr-2">
		<button
			type="button"
			class="flex-1 min-w-0 flex items-center gap-3 {pad} text-left bg-transparent border-0 cursor-pointer"
			aria-expanded={isOpen}
			onclick={toggle}
		>
			{#if glyph}
				<span class="flex shrink-0" style:color={glyphColor}>
					{#if glyphLabel}
						<Tooltip content={glyphLabel}><Icon name={glyph} size={13} /></Tooltip>
					{:else}
						<Icon name={glyph} size={13} />
					{/if}
				</span>
			{/if}
			<span class="flex-1 min-w-0 truncate {text} text-[var(--fg)]">
				{@render label()}
			</span>
		</button>

		{#if meta}{@render meta()}{/if}

		{#if trailing}
			<span
				class="shrink-0 font-[var(--mono)] text-[0.68rem] tabular-nums text-[var(--fg-dim)] opacity-70 text-right"
			>
				{trailing}
			</span>
		{/if}

		<span
			class="flex shrink-0 text-[var(--fg-dim)] transition-transform duration-150"
			style:transform="rotate({isOpen ? 90 : 0}deg)"
		>
			<Icon name="chevron-right" size={12} />
		</span>
	</div>

	{#if isOpen && children}
		<div class="pl-9 pr-3 pb-3 pt-1">
			{@render children()}
		</div>
	{/if}
</li>

<style>
	/* The edge is every row's border-left, transparent by default, so an accented
	   row and a plain one occupy identical space. A stripe that only exists on
	   hover would shift every label by 2px as the pointer runs down the list. */
	.cs-row {
		list-style: none;
		border-left: 2px solid transparent;
		border-radius: var(--radius-control);
		transition:
			background 0.12s,
			border-color 0.12s;
	}
	.cs-accented {
		border-left-color: var(--cs-accent);
	}
	.cs-row:hover,
	.cs-open {
		background: var(--surface-raised);
	}
	/* Hover and open reveal an edge on rows that have none, and leave an accented
	   row's own colour alone — neither state should overwrite severity. */
	.cs-row:not(.cs-accented):hover {
		border-left-color: var(--border-strong);
	}
	.cs-row:not(.cs-accented).cs-open {
		border-left-color: var(--accent);
	}
</style>
