<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../icons/Icon.svelte';
	import type { IconName } from '../icons/Icon.svelte';

	export type IconButtonVariant = 'default' | 'primary' | 'danger' | 'bordered';
	export type IconButtonSize = 'sm' | 'md' | 'lg';

	type IconButtonProps = {
		variant?: IconButtonVariant;
		size?: IconButtonSize;
		disabled?: boolean;
		/** Required accessible label — no visible text is shown */
		label: string;
		onclick?: () => void;
	} & (
		| { icon: IconName; children?: never }
		| { icon?: never; children: Snippet }
	);

	let {
		variant = 'default',
		size = 'md',
		disabled = false,
		label,
		onclick,
		icon,
		children
	}: IconButtonProps = $props();

	const iconSize = $derived(size === 'sm' ? 12 : size === 'lg' ? 18 : 14);
</script>

<button
	type="button"
	aria-label={label}
	{disabled}
	{onclick}
	class="icon-btn icon-btn-{variant} icon-btn-{size}"
>
	{#if icon}
		<Icon name={icon} size={iconSize} strokeWidth={2} />
	{:else if children}
		{@render children()}
	{/if}
</button>

<style>
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--fg-dim);
		cursor: pointer;
		border: 1px solid transparent;
		background: transparent;
		border-radius: 3px;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
		flex-shrink: 0;
		padding: 0;
	}
	.icon-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		pointer-events: none;
	}
	.icon-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* ── Sizes ────────────────────────────────────────────────────────────── */
	.icon-btn-sm { width: 22px; height: 22px; }
	.icon-btn-md { width: 28px; height: 28px; }
	.icon-btn-lg { width: 36px; height: 36px; }

	/* ── Variants ─────────────────────────────────────────────────────────── */
	.icon-btn-default:hover {
		color: var(--accent);
		background: var(--accent-faint);
	}

	.icon-btn-primary {
		color: var(--accent);
		border-color: var(--border-strong);
	}
	.icon-btn-primary:hover {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	.icon-btn-bordered {
		border-color: var(--border-strong);
	}
	.icon-btn-bordered:hover {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	.icon-btn-danger:hover {
		color: var(--palette-red-l);
		background: rgba(252, 165, 165, 0.08);
	}
</style>