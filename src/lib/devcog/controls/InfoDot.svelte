<script lang="ts">
	// Where a control's explanation lives now. The console used to carry 214
	// words of standing prose; this is what it moved behind.
	//
	// The trigger is a real <button> on purpose: Tooltip already opens on
	// focusin, so making it focusable is the entire keyboard story — no second
	// disclosure mechanism, no aria wiring beyond what Tooltip does itself.
	import Tooltip from '../../primitives/status/Tooltip.svelte';
	import type { TooltipPlacement } from '../../primitives/status/Tooltip.svelte';

	interface InfoDotProps {
		detail: string;
		placement?: TooltipPlacement;
	}

	let { detail, placement = 'left' }: InfoDotProps = $props();
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
