<script lang="ts">
	// Left rail: every placeable component, grouped by registry category.
	import { REGISTRY, CATEGORIES } from '../registry.js';

	interface Props {
		selectedId: string | null;
		onselect: (id: string) => void;
	}
	let { selectedId, onselect }: Props = $props();
</script>

<div class="rail">
	{#each CATEGORIES as cat (cat)}
		{@const items = REGISTRY.filter((m) => m.placeable && m.category === cat)}
		{#if items.length > 0}
			<div class="cat">{cat}</div>
			{#each items as meta (meta.id)}
				<button
					class="item"
					class:active={selectedId === meta.id}
					aria-pressed={selectedId === meta.id}
					onclick={() => onselect(meta.id)}
				>
					{meta.label}
					{#if selectedId === meta.id}<span class="dot"></span>{/if}
				</button>
			{/each}
		{/if}
	{/each}
</div>

<style>
	.rail {
		width: 148px;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
		overflow-y: auto;
		padding: 8px 0;
	}

	.cat {
		font-family: var(--mono);
		font-size: 0.48rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding: 10px 14px 4px;
	}

	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 5px 14px;
		font-size: 0.78rem;
		color: var(--fg-muted);
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: all 0.11s;
	}
	.item:hover {
		color: var(--fg);
		background: var(--surface-raised);
	}
	.item.active {
		color: var(--fg);
		background: var(--surface-strong);
	}

	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--accent);
		flex-shrink: 0;
	}
</style>
