<script lang="ts">
	// A row of channel strips. Bottom-aligned so the tracks share a baseline and
	// the values read across.
	import type { Snippet } from 'svelte';

	interface FaderBankProps {
		/** 2..n <Fader>. One fader in a bank should just be a fader. */
		children: Snippet;
	}

	let { children }: FaderBankProps = $props();
</script>

<div class="dc-bank">
	{@render children()}
</div>

<style>
	.dc-bank {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		padding: 8px 4px 2px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: color-mix(in srgb, var(--surface-raised) 60%, transparent);
	}
</style>
