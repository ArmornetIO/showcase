<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '../../icons/Icon.svelte';
	import Select, { type SelectItem } from '../forms/Select.svelte';

	export interface ViewToggleOption {
		value: string;
		label: string;
		/** SVG icon snippet for icon-only mode. When all options have `icon`, text labels are hidden. */
		icon?: Snippet;
		/** A house icon by name — the same as `icon`, without a snippet per option. */
		iconName?: IconName;
		/** Makes the option a dropdown: the rows pick a variant of this view. */
		items?: SelectItem[];
	}

	interface ViewToggleProps {
		options: ViewToggleOption[];
		value: string;
		onchange: (v: string) => void;
	}

	let { options, value, onchange }: ViewToggleProps = $props();

	const iconMode = $derived(options.every((o) => o.icon || o.iconName));
</script>

<div class="view-toggle max-sm:overflow-x-auto" class:icon-mode={iconMode}>
	{#each options as opt, i (opt.value)}
		{#if !iconMode && i > 0}
			<span class="sep" aria-hidden="true"></span>
		{/if}
		{#if opt.items}
			<Select items={opt.items} placement="bottom-end" label={opt.label}>
				{#snippet trigger({ open, toggle })}
					<button
						class="toggle-btn has-menu"
						class:active={value === opt.value || open}
						onclick={toggle}
						title={opt.label}
						aria-label={opt.label}
						aria-haspopup="menu"
						aria-expanded={open}
					>
						{@render face(opt)}
						<Icon name="chevron-down" size={10} />
					</button>
				{/snippet}
			</Select>
		{:else}
			<button
				class="toggle-btn"
				class:active={value === opt.value}
				onclick={() => onchange(opt.value)}
				title={opt.label}
				aria-label={opt.label}
				aria-pressed={value === opt.value}
			>
				{@render face(opt)}
			</button>
		{/if}
	{/each}
</div>

{#snippet face(opt: ViewToggleOption)}
	{#if opt.icon}
		{@render opt.icon()}
	{:else if opt.iconName}
		<Icon name={opt.iconName} size={14} />
	{/if}
	{#if !iconMode && opt.label}
		{opt.label}
	{/if}
{/snippet}

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
	.icon-mode .toggle-btn.has-menu {
		width: auto;
		gap: 2px;
		padding: 0 8px 0 10px;
	}
	.icon-mode .toggle-btn.has-menu :global(svg:last-child) {
		width: 10px;
		height: 10px;
	}
	/* Select wraps its trigger, so the button is always its wrapper's last child;
	   the divider has to follow the wrapper's position in the group instead. */
	.icon-mode :global(.trigger-wrap:not(:last-child) > .has-menu) {
		border-right: 1px solid var(--border);
	}

	.toggle-btn:hover:not(.active) {
		color: var(--fg-muted);
	}

	.toggle-btn.active {
		background: var(--accent-faint);
		color: var(--accent);
	}
</style>
