<script lang="ts">
	import type { Snippet } from 'svelte';

	interface CardStackProps {
		gap?: string;
		class?: string;
		children: Snippet;
	}

	let { gap = '16px', class: cls = '', children }: CardStackProps = $props();
</script>

<div class="stack {cls}" style:gap>
	{@render children()}
</div>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		width: 100%;
	}
</style>
