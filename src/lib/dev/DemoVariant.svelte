<script lang="ts">
	import type { Snippet } from 'svelte';
	import { showcaseState } from './showcaseState.svelte.js';
	import Icon from '$lib/icons/Icon.svelte';

	let {
		code,
		children
	}: {
		/** Svelte usage snippet revealed when this variant is selected. */
		code: string;
		children: Snippet;
	} = $props();

	const isSelected = $derived(showcaseState.selectedCode === code);

	function select(e: MouseEvent) {
		e.stopPropagation();
		showcaseState.selectedCode = showcaseState.selectedCode === code ? null : code;
		showcaseState.sidebarOpen = true;
	}
</script>

<div class="demo-variant" class:selected={isSelected}>
	{@render children()}
	<button
		class="code-trigger"
		onclick={select}
		aria-label="Show usage snippet"
		title="Show usage snippet"
	>
		<Icon name="code" size={11} />
	</button>
</div>

<style>
	.demo-variant {
		position: relative;
		display: inline-flex;
		border-radius: 6px;
		padding: 4px;
		border: 1px solid transparent;
		transition:
			border-color 0.15s,
			background 0.15s;
	}

	.demo-variant:hover {
		border-color: var(--border);
		background: var(--surface-raised);
	}

	.demo-variant.selected {
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	.code-trigger {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.15s,
			color 0.15s,
			border-color 0.15s;
		z-index: 1;
	}

	.demo-variant:hover .code-trigger {
		opacity: 1;
		pointer-events: auto;
	}

	.demo-variant.selected .code-trigger {
		opacity: 1;
		pointer-events: auto;
		color: var(--accent);
		border-color: var(--accent);
	}

	.code-trigger:hover {
		color: var(--accent);
		border-color: var(--accent);
	}
</style>
