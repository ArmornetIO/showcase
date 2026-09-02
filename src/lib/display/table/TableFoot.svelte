<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../../icons/Icon.svelte';

	interface TableFootProps {
		meta?: string;
		onRefresh?: () => void;
		actions?: Snippet;
	}

	let { meta, onRefresh, actions }: TableFootProps = $props();
</script>

<div class="table-foot">
	<div class="table-foot-left">
		{#if actions}
			{@render actions()}
		{:else if onRefresh}
			<button onclick={onRefresh}>
				<Icon name="refresh-cw" size={12} strokeWidth={2} />
				REFRESH
			</button>
		{/if}
	</div>
	{#if meta}
		<div class="meta">{meta}</div>
	{/if}
</div>

<style>
	.table-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 16px;
		padding: 0 4px;
	}
	.table-foot-left {
		display: flex;
		align-items: center;
	}
	.table-foot button {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.25em;
		color: var(--fg-dim);
		background: transparent;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0;
		transition: color 0.15s ease;
	}
	.table-foot button:hover {
		color: var(--accent);
	}
	.meta {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		color: var(--fg-dim);
		opacity: 0.6;
	}
</style>
