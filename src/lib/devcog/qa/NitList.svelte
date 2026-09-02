<script lang="ts">
	// The nit batch, or the prompt to start one. Reads and mutates the shared
	// controller directly — this list IS the batch's view, not a copy of it.
	import type { NitsController } from './nits.svelte.js';
	import NitCard from './NitCard.svelte';

	interface NitListProps {
		nits: NitsController;
	}

	let { nits }: NitListProps = $props();
</script>

{#if nits.count === 0}
	<p class="qa-hint">
		{#if nits.inspecting}
			Click any element to annotate it.
		{:else}
			Press ⌖ to start inspecting elements.
		{/if}
	</p>
{:else}
	<ul class="nit-list">
		{#each nits.nits as nit (nit.id)}
			<NitCard
				{nit}
				selected={nits.isSelected(nit.id)}
				copied={nits.copiedId === nit.id}
				onToggle={(id) => nits.toggleSelect(id)}
				onCopy={(id) => nits.copyOne(id)}
				onRemove={(id) => nits.remove(id)}
			/>
		{/each}
	</ul>
{/if}

<style>
	.qa-hint {
		font-family: var(--mono, monospace);
		font-size: 0.7rem;
		color: var(--fg-dim);
		line-height: 1.6;
		margin: 0;
		padding: 8px 0;
	}

	.nit-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
</style>
