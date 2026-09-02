<script lang="ts" module>
	export interface SelectionItem {
		value: string;
		label: string;
		description?: string;
	}
</script>

<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from '../../primitives/actions/Button.svelte';
	import Icon from '../../icons/Icon.svelte';

	interface SelectionModalProps {
		open: boolean;
		title: string;
		items: SelectionItem[];
		/** Currently selected values. */
		selected?: string[];
		/** Allow picking multiple items. */
		multiselect?: boolean;
		/** Placeholder text when no items match the search. */
		emptyLabel?: string;
		/** Show a search filter input. */
		searchable?: boolean;
		onconfirm: (selected: string[]) => void;
		onclose: () => void;
	}

	let {
		open,
		title,
		items,
		selected = [],
		multiselect = false,
		emptyLabel = 'No items found.',
		searchable = false,
		onconfirm,
		onclose
	}: SelectionModalProps = $props();

	let draft = $state<string[]>([]);
	let query = $state('');

	// Reset draft whenever the modal opens.
	$effect(() => {
		if (open) {
			draft = [...selected];
			query = '';
		}
	});

	const filtered = $derived(
		query.trim()
			? items.filter(
					(item) =>
						item.label.toLowerCase().includes(query.toLowerCase()) ||
						item.description?.toLowerCase().includes(query.toLowerCase())
				)
			: items
	);

	function isSelected(value: string) {
		return draft.includes(value);
	}

	function toggle(value: string) {
		if (multiselect) {
			if (draft.includes(value)) {
				draft = draft.filter((v) => v !== value);
			} else {
				draft = [...draft, value];
			}
		} else {
			draft = draft.includes(value) ? [] : [value];
		}
	}

	function confirm() {
		onconfirm(draft);
	}
</script>

<Modal {open} {title} size="md" {onclose}>
	{#snippet children()}
		{#if searchable}
			<div class="search-wrap">
				<span class="search-icon"><Icon name="search" size={13} /></span>
				<input
					class="search-input"
					type="search"
					placeholder="Filter…"
					bind:value={query}
					autocomplete="off"
				/>
			</div>
		{/if}

		{#if filtered.length === 0}
			<p class="empty-label">{emptyLabel}</p>
		{:else}
			<ul class="item-list" role={multiselect ? 'group' : 'radiogroup'}>
				{#each filtered as item (item.value)}
					<li>
						<button
							type="button"
							class="sel-item"
							class:selected={isSelected(item.value)}
							role={multiselect ? 'checkbox' : 'radio'}
							aria-checked={isSelected(item.value)}
							onclick={() => toggle(item.value)}
						>
							<span class="check-mark" aria-hidden="true">
								{#if isSelected(item.value)}
									<Icon name="check" size={11} strokeWidth={2.5} />
								{/if}
							</span>
							<span class="item-content">
								<span class="item-label">{item.label}</span>
								{#if item.description}
									<span class="item-desc">{item.description}</span>
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/snippet}

	{#snippet footer()}
		<Button variant="ghost" size="sm" onclick={onclose}>Cancel</Button>
		<Button size="sm" onclick={confirm}>
			{multiselect ? `Apply (${draft.length})` : 'Select'}
		</Button>
	{/snippet}
</Modal>

<style>
	/* ── Search ──────────────────────────────────────────────────────────── */
	.search-wrap {
		position: relative;
		margin-bottom: 12px;
	}
	.search-icon {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--fg-dim);
		pointer-events: none;
		display: flex;
	}
	.search-input {
		width: 100%;
		padding: 7px 10px 7px 30px;
		background: var(--surface-raised);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-inset);
		color: var(--fg);
		font-family: var(--sans);
		font-size: 0.82rem;
		outline: none;
		box-sizing: border-box;
		transition: border-color 0.15s;
	}
	.search-input:focus {
		border-color: var(--accent);
	}
	.search-input::placeholder {
		color: var(--fg-dim);
	}

	/* ── List ────────────────────────────────────────────────────────────── */
	.item-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.empty-label {
		margin: 16px 0;
		text-align: center;
		font-size: 0.82rem;
		color: var(--fg-dim);
	}

	/* ── Individual item ─────────────────────────────────────────────────── */
	.sel-item {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		width: 100%;
		padding: 9px 10px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-inset);
		color: var(--fg);
		font-family: var(--sans);
		font-size: 0.85rem;
		text-align: left;
		cursor: pointer;
		transition:
			background 0.1s,
			border-color 0.1s;
	}
	.sel-item:hover {
		background: var(--accent-faint);
		border-color: var(--border-strong);
	}
	.sel-item.selected {
		background: rgba(94, 234, 212, 0.07);
		border-color: rgba(94, 234, 212, 0.3);
	}
	.sel-item:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* ── Check indicator ─────────────────────────────────────────────────── */
	.check-mark {
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		margin-top: 1px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-hairline);
		background: var(--surface-raised);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent);
		transition:
			background 0.1s,
			border-color 0.1s;
	}
	.sel-item.selected .check-mark {
		background: rgba(94, 234, 212, 0.12);
		border-color: var(--accent);
	}

	.item-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.item-label {
		line-height: 1.3;
	}
	.item-desc {
		font-size: 0.75rem;
		color: var(--fg-muted);
		line-height: 1.4;
	}
</style>
