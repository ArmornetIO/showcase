<script lang="ts">
	import type { Snippet } from 'svelte';

	interface TableWrapProps {
		children: Snippet;
	}

	let { children }: TableWrapProps = $props();
</script>

<div class="table-wrap">
	{@render children()}
</div>

<style>
	.table-wrap {
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		overflow: auto;
		background: var(--bg-elev);
		width: 100%;
		max-width: 100%;
		min-width: 0;
	}

	.table-wrap :global(table) {
		width: 100%;
		border-collapse: collapse;
	}

	.table-wrap :global(thead th) {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: .22em;
		text-transform: uppercase;
		color: var(--fg-dim);
		font-weight: 500;
		padding: 13px 16px;
		text-align: left;
		background: var(--surface-raised);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	.table-wrap :global(tbody tr) {
		transition: background .15s ease, box-shadow .15s ease;
	}

	.table-wrap :global(tbody td) {
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 13px;
		color: var(--fg-muted);
		vertical-align: middle;
	}

	.table-wrap :global(tbody tr:last-child td) {
		border-bottom: none;
	}

	.table-wrap :global(tbody tr:hover) {
		background: var(--accent-faint);
		box-shadow: inset 2px 0 0 var(--accent);
	}
</style>
