<script lang="ts">
	import type { Snippet } from 'svelte';

	export interface Tab {
		id: string;
		label: string;
		/** Optional SVG icon rendered before the label. */
		icon?: Snippet;
		disabled?: boolean;
	}

	interface TabsProps {
		tabs: Tab[];
		/** The id of the currently active tab. Bindable. */
		active: string;
		onchange?: (id: string) => void;
	}

	let { tabs, active = $bindable(), onchange }: TabsProps = $props();

	function select(id: string) {
		active = id;
		onchange?.(id);
	}
</script>

<div role="tablist" class="tabs">
	{#each tabs as tab (tab.id)}
		<button
			role="tab"
			aria-selected={active === tab.id}
			aria-disabled={tab.disabled ?? false}
			disabled={tab.disabled}
			onclick={() => !tab.disabled && select(tab.id)}
			class:active={active === tab.id}
		>
			{#if tab.icon}
				{@render tab.icon()}
			{/if}
			{tab.label}
		</button>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 11px 16px;
		font-family: var(--mono);
		font-size: 13px;
		color: var(--fg-dim);
		background: transparent;
		border: none;
		cursor: pointer;
		position: relative;
		transition: color .2s ease;
		white-space: nowrap;
		flex-shrink: 0;
	}
	button :global(svg) {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
	}
	button:hover:not(:disabled) {
		color: var(--fg-muted);
	}
	button.active {
		color: var(--accent);
	}
	button.active::after {
		content: '';
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: -1px;
		height: 2px;
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent);
	}
	button:disabled {
		color: var(--fg-dim);
		opacity: .4;
		cursor: not-allowed;
		background: var(--accent-faint);
	}
</style>
