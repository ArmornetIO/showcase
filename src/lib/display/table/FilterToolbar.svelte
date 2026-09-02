<script lang="ts">
	import type { Snippet } from 'svelte';
	import SearchInput from '../../primitives/forms/SearchInput.svelte';

	interface FilterToolbarProps {
		/** Bindable search text. */
		value?: string;
		searchable?: boolean;
		placeholder?: string;
		/** Result count for the meta row. Omit to hide the count. */
		resultCount?: number;
		/** Singular / plural noun for the count, e.g. "vendor" / "vendors". */
		noun?: string;
		nounPlural?: string;
		/** Number of active filters — drives the "N filters active" note + Clear all. */
		activeFilters?: number;
		/** Called when the user clicks "Clear all". */
		onreset?: () => void;
		/** Left-of-actions filter controls (SegmentGroup, Select, …). */
		filters?: Snippet;
		/** Right-aligned action buttons (Export, Add, …). */
		actions?: Snippet;
	}

	let {
		value = $bindable(''),
		searchable = true,
		placeholder = 'Search…',
		resultCount,
		noun = 'result',
		nounPlural,
		activeFilters = 0,
		onreset,
		filters,
		actions
	}: FilterToolbarProps = $props();

	const plural = $derived(nounPlural ?? `${noun}s`);
	const showMeta = $derived(resultCount !== undefined || activeFilters > 0);
</script>

<div class="ft">
	<div class="ft-controls">
		{#if searchable}
			<div class="ft-search"><SearchInput bind:value {placeholder} /></div>
		{/if}
		{#if filters}
			<div class="ft-filters">{@render filters()}</div>
		{/if}
		{#if actions}
			<div class="ft-actions">{@render actions()}</div>
		{/if}
	</div>

	{#if showMeta}
		<div class="ft-meta">
			<span class="ft-count">
				{#if resultCount !== undefined}
					<strong>{resultCount}</strong>
					{resultCount === 1 ? noun : plural}
				{/if}
				{#if activeFilters > 0}
					<span class="ft-dim"
						>{resultCount !== undefined ? '· ' : ''}{activeFilters} filter{activeFilters === 1
							? ''
							: 's'} active</span
					>
				{/if}
			</span>
			{#if activeFilters > 0 && onreset}
				<button type="button" class="ft-clear" onclick={onreset}>Clear all</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.ft {
		display: flex;
		flex-direction: column;
	}
	.ft-controls {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.85rem 0.9rem;
		flex-wrap: wrap;
	}
	.ft-search {
		flex: 1 1 220px;
		max-width: 340px;
		min-width: 180px;
	}
	.ft-filters {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.ft-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-left: auto;
		flex-wrap: wrap;
	}
	.ft-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		border-top: 1px solid var(--border);
		font-size: 0.76rem;
		color: var(--fg-muted);
	}
	.ft-count strong {
		color: var(--fg);
		font-family: var(--mono);
	}
	.ft-dim {
		color: var(--fg-dim);
		margin-left: 0.25rem;
	}
	.ft-clear {
		border: none;
		background: transparent;
		color: var(--accent);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
	}
	.ft-clear:hover {
		text-decoration: underline;
	}
</style>
