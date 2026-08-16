<script lang="ts" module>
	export type ExportFormat = 'csv' | 'json' | 'pdf' | 'print';

	const FORMAT_LABELS: Record<ExportFormat, string> = {
		csv: 'Export CSV',
		json: 'Export JSON',
		pdf: 'Save PDF',
		print: 'Print'
	};

	const FORMAT_ICONS = {
		csv: 'table-2',
		json: 'code',
		pdf: 'file-text',
		print: 'printer'
	} as const;
</script>

<script lang="ts">
	import ActionsMenu from './ActionsMenu.svelte';
	import Icon from '../../icons/Icon.svelte';
	import type { IconName } from '../../icons/Icon.svelte';

	interface ExportMenuProps {
		/** Formats to include. Defaults to all four. */
		formats?: ExportFormat[];
		onformat: (format: ExportFormat) => void;
		disabled?: boolean;
		/** Override the trigger icon (default: download). */
		icon?: IconName;
		/** Tooltip / aria-label for the trigger button. */
		label?: string;
	}

	let {
		formats = ['csv', 'json', 'pdf', 'print'],
		onformat,
		disabled = false,
		icon = 'download',
		label = 'Export'
	}: ExportMenuProps = $props();

	const items = $derived(
		formats.map((fmt) => ({
			label: FORMAT_LABELS[fmt],
			icon: FORMAT_ICONS[fmt] as IconName,
			onclick: () => onformat(fmt)
		}))
	);
</script>

<ActionsMenu {items} placement="bottom-end" {disabled}>
	{#snippet trigger({ open, toggle })}
		<button
			type="button"
			class="export-btn"
			class:open
			{disabled}
			onclick={toggle}
			aria-label={label}
			aria-haspopup="menu"
			aria-expanded={open}
			title={label}
		>
			<Icon name={icon} size={14} />
		</button>
	{/snippet}
</ActionsMenu>

<style>
	.export-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border: 1px solid var(--border-strong);
		border-radius: 3px;
		background: var(--surface-raised);
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
		flex-shrink: 0;
	}
	.export-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		pointer-events: none;
	}
	.export-btn:hover,
	.export-btn.open {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: var(--accent-faint);
	}
	.export-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
