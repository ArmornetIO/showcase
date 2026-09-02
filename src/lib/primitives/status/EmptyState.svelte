<script lang="ts">
	import type { Snippet } from 'svelte';

	export type EmptyStateVariant = 'inline' | 'card';

	interface Props {
		message: string;
		/** Optional sub-text shown below the message. */
		sub?: string;
		/** `'inline'` — centered text in a fixed-height area (default). `'card'` — bordered rounded box. */
		variant?: EmptyStateVariant;
		/** Optional icon snippet rendered above the message. */
		icon?: Snippet;
		class?: string;
	}

	let { message, sub, variant = 'inline', icon, class: cls = '' }: Props = $props();
</script>

<div class="empty-state {variant} {cls}">
	{#if icon}
		<div class="es-icon">{@render icon()}</div>
	{/if}
	<span class="es-msg">{message}</span>
	{#if sub}
		<span class="es-sub">{sub}</span>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 8px;
		color: var(--fg-dim);
		font-family: var(--mono);
	}
	.inline {
		min-height: 200px;
		padding: 28px 16px;
		font-size: 12.5px;
		line-height: 1.7;
	}
	.card {
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		background: var(--bg-elev);
		padding: 40px;
		font-size: 13px;
		width: 100%;
	}
	.es-icon :global(svg) {
		width: 24px;
		height: 24px;
		color: var(--fg-dim);
	}
	.es-msg {
		color: var(--fg-dim);
	}
	.es-sub {
		font-size: 11px;
		color: var(--fg-dim);
		opacity: 0.7;
	}
</style>
