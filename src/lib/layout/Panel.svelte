<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The card's tint. `accent` and `changed` carry meaning rather than
	 * decoration: a tinted card is one the user is acting on, and `changed`
	 * marks a section holding an edit that has not been committed yet.
	 */
	export type PanelTone = 'default' | 'accent' | 'changed';

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
		flush = false,
		allowOverflow = false,
		padding = 'default',
		class: cls = '',
		children
	}: PanelProps = $props();

	const showHeader = $derived(!!(header || title || actions || icon));

	const BODY_PAD: Record<NonNullable<PanelProps['padding']>, string> = {
		default: 'px-4 py-4',
		dense: 'px-2.5 py-2.5',
		none: ''
	};
	const HEAD_PAD: Record<NonNullable<PanelProps['padding']>, string> = {
		default: 'px-4',
		dense: 'px-2.5',
		none: 'px-2.5'
	};
</script>

<div
	class="panel tone-{tone} rounded-[10px] {allowOverflow
		? 'overflow-visible'
		: 'overflow-hidden'} {cls}"
>
	{#if showHeader}
		<div
			class="{HEAD_PAD[padding]} {flush
				? padding === 'dense'
					? 'pt-2.5 pb-0'
					: 'pt-4 pb-0'
				: padding === 'dense'
					? 'py-2 panel-head'
					: 'py-3 panel-head'} {allowOverflow && !flush ? 'rounded-t-[10px]' : ''}"
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
	<div class={BODY_PAD[padding]}>
		{@render children()}
	</div>
	{#if footer}
		<div class="px-4 py-3 border-t border-[var(--border)] {allowOverflow ? 'rounded-b-[10px]' : ''}">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	/* color-mix rather than a flat rgba so a tone tracks whatever the palette
	   token resolves to under the active theme. */
	.panel {
		border: 1px solid var(--border);
		background: var(--bg-elev);
		transition:
			border-color 0.18s,
			background 0.18s;
	}
	.tone-accent {
		border-color: color-mix(in srgb, var(--palette-emerald) 40%, transparent);
		background: color-mix(in srgb, var(--palette-emerald) 4%, transparent);
	}
	.tone-changed {
		border-color: color-mix(in srgb, var(--palette-amber) 60%, transparent);
		background: color-mix(in srgb, var(--palette-amber) 6%, transparent);
	}
	.panel-head {
		border-bottom: 1px solid var(--border);
		background: var(--surface-raised);
	}
</style>
