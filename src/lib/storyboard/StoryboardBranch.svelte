<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		connector?: string;
		label?: string;
		children: Snippet;
	}

	let { connector = '↓', label, children }: Props = $props();
</script>

<div class="branch">
	<span class="branch-connector">{connector}</span>
	{@render children()}
	{#if label}
		<span class="branch-label">{label}</span>
	{/if}
</div>

<style>
	.branch {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		margin-top: 8px;
		padding-left: 20px;
		opacity: 0.75;
	}

	.branch-connector {
		font-size: 1.2rem;
		color: var(--fg-dim);
		line-height: 1;
		padding-left: 8px;
	}

	.branch-label {
		font-size: 0.6rem;
		font-style: italic;
		color: var(--fg-dim);
		margin-top: 2px;
		padding-left: 4px;
	}
</style>
