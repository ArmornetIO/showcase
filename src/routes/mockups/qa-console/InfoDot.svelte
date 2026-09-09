<script lang="ts">
	// The affordance the 214 words moved behind. A real <button>, because
	// Tooltip already shows on focusin — making the trigger focusable is the
	// whole of the keyboard requirement.
	import Tooltip from '$lib/primitives/status/Tooltip.svelte';

	let { detail, placement = 'left' }: { detail: string; placement?: 'top' | 'bottom' | 'left' | 'right' } =
		$props();
</script>

<Tooltip content={detail} {placement} delay={80}>
	<button class="dc-info" type="button" aria-label="Details">i</button>
</Tooltip>

<style>
	.dc-info {
		width: 11px;
		height: 11px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 50%;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono, monospace);
		font-size: 0.5rem;
		line-height: 1;
		cursor: help;
		flex: none;
	}
	.dc-info:hover,
	.dc-info:focus-visible {
		color: var(--accent);
		border-color: var(--accent);
		outline: none;
	}
</style>
