<script lang="ts">
	import type { Snippet } from 'svelte';

	interface SubFooterProps {
		start?: Snippet;
		end?: Snippet;
	}

	let { start, end }: SubFooterProps = $props();
</script>

<footer class="subfooter">
	{#if start}
		<div class="subfooter-slot">
			{@render start()}
		</div>
	{/if}
	{#if end}
		<div class="subfooter-slot">
			{@render end()}
		</div>
	{/if}
</footer>

<style>
	.subfooter {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		flex-shrink: 0;
		backdrop-filter: blur(8px);
		background: color-mix(in srgb, var(--bg-elev) 80%, transparent);
	}

	.subfooter-slot {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
</style>
