<script lang="ts">
	import type { Snippet } from 'svelte';

	export interface ViewToggleOption {
		value: string;
		label: string;
		/** SVG icon snippet for icon-only mode. When all options have `icon`, text labels are hidden. */
		icon?: Snippet;
	}

	interface ViewToggleProps {
		options: ViewToggleOption[];
		value: string;
		onchange: (v: string) => void;
	}

	let { options, value, onchange }: ViewToggleProps = $props();

	const iconMode = $derived(options.every((o) => o.icon));
</script>

<div class="view-toggle max-sm:overflow-x-auto" class:icon-mode={iconMode}>
	{#each options as opt, i (opt.value)}
		{#if !iconMode && i > 0}
			<span class="sep" aria-hidden="true"></span>
		{/if}
		<button
			class="toggle-btn"
			class:active={value === opt.value}
			onclick={() => onchange(opt.value)}
			title={opt.label}
			aria-label={opt.label}
			aria-pressed={value === opt.value}
		>
			{#if opt.icon}
				{@render opt.icon()}
			{/if}
			{#if !iconMode && opt.label}
				{opt.label}
			{/if}
		</button>
	{/each}
</div>

<style>
	.view-toggle {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid var(--border);
		border-radius: var(--radius-inset);
		overflow: hidden;
	}

	/* Icon-only mode: rounder container, fixed button sizes */
	.view-toggle.icon-mode {
		border-radius: var(--radius-control);
	}

	.sep {
		width: 1px;
		background: var(--border);
		flex-shrink: 0;
	}

	.toggle-btn {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		padding: 6px 14px;
		background: var(--surface-raised);
		color: var(--fg-dim);
		border: none;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Icon-only button: fixed size, border-right separation */
	.icon-mode .toggle-btn {
		width: 38px;
		height: 34px;
		padding: 0;
		border-right: 1px solid var(--border);
	}
	.icon-mode .toggle-btn:last-child {
		border-right: none;
	}
	.icon-mode .toggle-btn :global(svg) {
		width: 16px;
		height: 16px;
	}

	.toggle-btn:hover:not(.active) {
		color: var(--fg-muted);
	}

	.toggle-btn.active {
		background: var(--accent-faint);
		color: var(--accent);
	}
</style>
