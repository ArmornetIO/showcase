<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A bordered card that docks a toolbar flush against one edge, sharing the
	 *  card's border (a divider separates it from the content). Reusable wherever a
	 *  surface needs an attached rail — e.g. a question card with a review verdict
	 *  dock on its right edge. With no `toolbar` it renders as a plain bordered card. */
	interface Props {
		/** Which edge the toolbar docks against. */
		edge?: 'left' | 'right' | 'top' | 'bottom';
		/** The docked rail. When omitted, the card renders content only. */
		toolbar?: Snippet;
		children: Snippet;
		/** Extra classes on the outer card (e.g. sizing / max-width). */
		class?: string;
		/** Classes for the content wrapper (padding, inner layout). */
		contentClass?: string;
	}
	let { edge = 'right', toolbar, children, class: cls = '', contentClass = '' }: Props = $props();

	const row = $derived(edge === 'left' || edge === 'right');
	const leading = $derived(edge === 'left' || edge === 'top');
	// Divider sits on the side of the toolbar that faces the content.
	const dividerClass = $derived(
		leading
			? row
				? 'border-r border-[var(--border)]'
				: 'border-b border-[var(--border)]'
			: row
				? 'border-l border-[var(--border)]'
				: 'border-t border-[var(--border)]'
	);
</script>

<div
	class="border border-[var(--border)] r-surface bg-[var(--surface-raised)] overflow-hidden flex {row
		? 'flex-row items-stretch'
		: 'flex-col'} {cls}"
>
	{#if toolbar && leading}
		<div class="shrink-0 flex {dividerClass}">{@render toolbar()}</div>
	{/if}
	<div class="flex-1 min-w-0 {contentClass}">{@render children()}</div>
	{#if toolbar && !leading}
		<div class="shrink-0 flex {dividerClass}">{@render toolbar()}</div>
	{/if}
</div>
