<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		children: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<div class="canvas">
	{#if title}
		<span class="canvas-title">{title}</span>
	{/if}
	{@render children()}
</div>

<style>
	.canvas {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		overflow-x: auto;
	}

	.canvas-title {
		display: block;
		font-family: var(--mono);
		font-size: 0.65rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
</style>
