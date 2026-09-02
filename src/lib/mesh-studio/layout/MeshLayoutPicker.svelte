<script lang="ts" module>
	import type { MeshLayoutId, MeshLayoutOption } from './mesh-layout.js';
	export type { MeshLayoutId, MeshLayoutOption };
</script>

<script lang="ts">
	import { MESH_LAYOUTS } from './mesh-layout.js';

	/**
	 * MeshLayoutPicker — the arrangement control the mesh canvases share: a labelled
	 * grid of layout options (Grouped / Packed / Radial / Fan / Globe) plus the hint
	 * for the active one. Bindable `value`; it holds no layout logic of its own, it
	 * only chooses. Pair it with `solveMeshLayout` (or the caller's globe) to apply.
	 */
	interface Props {
		/** The active layout. Bindable. */
		value?: MeshLayoutId;
		/** Options to offer. Defaults to the full MESH_LAYOUTS set. */
		options?: MeshLayoutOption[];
		/** Heading above the grid. */
		label?: string;
		/** Columns in the option grid. */
		columns?: number;
		onchange?: (id: MeshLayoutId) => void;
	}

	let {
		value = $bindable('grouped'),
		options = MESH_LAYOUTS,
		label = 'Arrangement',
		columns = 2,
		onchange
	}: Props = $props();

	const activeHint = $derived(options.find((o) => o.id === value)?.hint);

	function pick(id: MeshLayoutId) {
		value = id;
		onchange?.(id);
	}
</script>

<div class="mlp">
	{#if label}<span class="mlp-label">{label}</span>{/if}
	<div class="mlp-grid" style:grid-template-columns="repeat({columns}, 1fr)">
		{#each options as o (o.id)}
			<button
				type="button"
				title={o.hint}
				class="mlp-opt"
				class:mlp-opt--on={value === o.id}
				aria-pressed={value === o.id}
				onclick={() => pick(o.id)}
			>
				{o.label}
			</button>
		{/each}
	</div>
	{#if activeHint}<span class="mlp-hint">{activeHint}</span>{/if}
</div>

<style>
	.mlp {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.mlp-label {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.mlp-grid {
		display: grid;
		gap: 0.25rem;
	}
	.mlp-opt {
		padding: 0.35rem 0.5rem;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: none;
		cursor: pointer;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
		transition:
			color 120ms,
			border-color 120ms,
			background 120ms;
	}
	.mlp-opt:hover {
		color: var(--fg);
	}
	.mlp-opt--on {
		border-color: var(--accent);
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
	.mlp-hint {
		font-family: var(--mono);
		font-size: 0.58rem;
		line-height: 1.35;
		color: var(--fg-dim);
	}
</style>
