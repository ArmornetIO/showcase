<script lang="ts" module>
	export interface EcoTab {
		id: string;
		/** Ecosystem name (omit for the "All" tab). */
		name?: string;
		/** Status/mode text displayed after the name, e.g. "0/5 active" or "inactive · BLOCK". */
		mode?: string;
	}
</script>

<script lang="ts">
	interface Props {
		tabs: EcoTab[];
		active: string;
		onchange: (id: string) => void;
	}

	let { tabs, active, onchange }: Props = $props();
</script>

<div class="eco-row">
	{#each tabs as tab (tab.id)}
		<button
			type="button"
			class="eco-tab"
			class:on={active === tab.id}
			onclick={() => onchange(tab.id)}
		>
			<span class="dot" aria-hidden="true"></span>
			{#if tab.name}
				<span class="nm">{tab.name}</span>
			{:else}
				All
			{/if}
			{#if tab.mode}
				<span class="mode">{tab.mode}</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.eco-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.eco-tab {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 14px;
		font-family: var(--mono);
		font-size: 12px;
		color: var(--fg-dim);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.eco-tab.on {
		color: var(--accent);
		border-color: var(--border-strong);
		background: var(--accent-faint);
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--fg-dim);
		flex-shrink: 0;
		transition: background 0.15s ease, box-shadow 0.15s ease;
	}
	.eco-tab.on .dot {
		background: var(--accent);
		box-shadow: 0 0 6px var(--accent);
	}
	.nm {
		color: var(--fg);
		font-weight: 500;
	}
	.mode {
		font-size: 10px;
		color: var(--fg-dim);
		letter-spacing: 0.1em;
	}
</style>
