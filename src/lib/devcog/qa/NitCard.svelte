<script lang="ts">
	// One captured nit in the drawer list: where it was taken, what was said
	// about it, and the selector it will be reported under.
	import type { Nit } from './nits.js';

	interface NitCardProps {
		nit: Nit;
		onRemove: (id: string) => void;
	}

	let { nit, onRemove }: NitCardProps = $props();
</script>

<li class="nit-item">
	<div class="nit-item-top">
		<span class="nit-url">{nit.url}</span>
		<button class="nit-delete" onclick={() => onRemove(nit.id)} aria-label="Remove nit">×</button>
	</div>
	<span class="nit-note">{nit.note}</span>
	<code class="nit-selector" title={nit.selector}>{nit.selector}</code>
</li>

<style>
	.nit-item {
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.nit-item-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.nit-url {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}
	.nit-delete {
		background: none;
		border: none;
		color: var(--fg-dim);
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		padding: 0;
		transition: color 0.1s;
	}
	.nit-delete:hover {
		color: var(--method-delete-fg, #f87171);
	}
	.nit-note {
		font-size: 0.8rem;
		color: var(--fg);
		line-height: 1.35;
	}
	.nit-selector {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}
</style>
