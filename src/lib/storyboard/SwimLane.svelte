<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		pill: string;
		label?: string;
		sub?: string;
		footer?: Snippet;
		children: Snippet;
	}

	let { pill, label, sub, footer, children }: Props = $props();
</script>

<div class="swim-lane">
	<div class="lane-header">
		<span class="lane-pill">{pill}</span>
		{#if label}<span class="lane-label">{label}</span>{/if}
		{#if sub}<span class="lane-sub">{sub}</span>{/if}
	</div>
	<div class="lane-steps">
		{@render children()}
	</div>
	{#if footer}
		<div class="lane-footer">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	.swim-lane {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.5rem 0;
	}

	.lane-header {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		margin-bottom: 0.25rem;
	}

	.lane-pill {
		font-family: var(--mono);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
		background: var(--accent-faint);
		border: 1px solid rgba(94, 234, 212, 0.25);
		border-radius: 4px;
		padding: 2px 8px;
		white-space: nowrap;
	}

	.lane-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--fg-muted);
	}

	.lane-sub {
		font-size: 0.72rem;
		color: var(--fg-dim);
		font-style: italic;
	}

	.lane-steps {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		flex-wrap: nowrap;
	}

	.lane-footer {
		margin-top: 0.25rem;
	}
</style>
