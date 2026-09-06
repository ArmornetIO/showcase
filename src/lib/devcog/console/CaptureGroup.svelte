<script lang="ts">
	// The capture batch, lifted out of the old drawer. The inspector that fills
	// it now arms from the cluster, so this group is the batch and nothing else.
	import type { NitsController } from '../qa/nits.svelte.js';
	import GhostButton from '../qa/GhostButton.svelte';
	import NitList from '../qa/NitList.svelte';

	let { nits }: { nits: NitsController } = $props();
</script>

<div class="dc-capture">
	{#if nits.count > 0}
		<div class="dc-capture-actions">
			{#if nits.selectedCount > 0}
				<GhostButton onclick={() => nits.clearSelection()} title="Deselect all (Esc)">
					none
				</GhostButton>
			{:else}
				<GhostButton onclick={() => nits.selectAll()} title="Select every capture">all</GhostButton>
			{/if}
			<GhostButton onclick={() => nits.clear()}>clear</GhostButton>
			<GhostButton
				accent
				onclick={() => nits.copyPrompt()}
				title={nits.selectedCount > 0
					? `Copy the ${nits.selectedCount} selected`
					: 'Copy every capture'}
			>
				{#if nits.copied}
					✓ copied
				{:else if nits.selectedCount > 0}
					copy {nits.selectedCount}
				{:else}
					copy prompt
				{/if}
			</GhostButton>
		</div>
	{/if}
	<NitList {nits} />
</div>

<style>
	.dc-capture {
		display: flex;
		flex-direction: column;
		gap: 8px;
		height: 100%;
	}
	.dc-capture-actions {
		display: flex;
		gap: 4px;
		flex: none;
	}
</style>
