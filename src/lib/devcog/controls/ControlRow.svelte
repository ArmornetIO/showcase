<script lang="ts">
	// The alignment contract for a non-fader control: label, optional one-line
	// qualifier, the applies badge, the info dot, then the control itself.
	//
	// It exists so call sites stop hand-rolling a row each — which is how the
	// old panel ended up with four different ways to render "a label and a
	// slider", each with its own paragraph underneath.
	import type { Snippet } from 'svelte';
	import InfoDot from './InfoDot.svelte';
	import type { AppliesWhen } from '../console/types.js';

	interface ControlRowProps {
		label: string;
		/** Current value, shown without interaction. */
		display?: string;
		applies?: AppliesWhen;
		detail?: string;
		/** At most one short line. Anything longer belongs in `detail`. */
		qualifier?: string;
		/** The control. Omit for a label-only heading above a bank. */
		children?: Snippet;
	}

	let { label, display, applies = 'live', detail, qualifier, children }: ControlRowProps = $props();
</script>

<div class="dc-row">
	<span class="dc-row-lab">{label}</span>
	{#if applies !== 'live'}<span class="dc-row-badge">{applies}</span>{/if}
	{#if detail}<InfoDot {detail} />{/if}
	{#if display}<span class="dc-row-val">{display}</span>{/if}
	{#if children}<div class="dc-row-ctl">{@render children()}</div>{/if}
</div>
{#if qualifier}<p class="dc-row-qual">{qualifier}</p>{/if}

<style>
	.dc-row {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.dc-row-lab {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.dc-row-val {
		margin-left: auto;
		font-family: var(--mono, monospace);
		font-size: 0.62rem;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
	.dc-row-ctl {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	.dc-row-badge {
		font-family: var(--mono, monospace);
		font-size: 0.48rem;
		padding: 0 3px;
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--fg-dim);
	}
	.dc-row-qual {
		margin: 2px 0 0;
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}
</style>
