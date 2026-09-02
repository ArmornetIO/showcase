<script lang="ts">
	// A labelled block in the QA drawer. Owning the section chrome here is what
	// lets host-supplied `qaContent` sit flush with the built-in tools instead
	// of each caller re-inventing a heading.
	import type { Snippet } from 'svelte';

	interface QaSectionProps {
		label: string;
		/** Fills the remaining drawer height and drops its trailing rule. */
		grow?: boolean;
		/** Buttons rendered inline with the label. */
		actions?: Snippet;
		children: Snippet;
	}

	let { label, grow = false, actions, children }: QaSectionProps = $props();
</script>

<section class="qa-section" class:grow>
	<div class="qa-section-head">
		<span class="qa-section-label">// {label}</span>
		{#if actions}
			<div class="qa-section-actions">{@render actions()}</div>
		{/if}
	</div>
	<div class="qa-section-body">
		{@render children()}
	</div>
</section>

<style>
	.qa-section {
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
	}
	.grow {
		flex: 1;
		border-bottom: 0;
	}

	.qa-section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
		min-height: 18px;
	}

	.qa-section-label {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.qa-section-actions {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.qa-section-body {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
</style>
