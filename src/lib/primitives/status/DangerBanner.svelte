<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		message: string;
		/** Optional action (e.g. a danger Button) placed at the right end. */
		action?: Snippet;
	}

	let { title, message, action }: Props = $props();
</script>

<div class="danger-banner">
	<div class="db-text">
		<div class="db-title">{title}</div>
		<div class="db-msg">{message}</div>
	</div>
	{#if action}
		{@render action()}
	{/if}
</div>

<style>
	.danger-banner {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 22px 26px;
		border: 1px solid rgba(248, 113, 113, 0.4);
		border-radius: 6px;
		background: rgba(248, 113, 113, 0.04);
	}
	.db-text {
		flex: 1;
		min-width: 0;
	}
	.db-title {
		font-family: var(--mono);
		font-size: 13px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #F87171;
		margin-bottom: 8px;
	}
	.db-msg {
		font-family: var(--mono);
		font-size: 13px;
		color: var(--fg-muted);
		letter-spacing: 0.02em;
	}
</style>
