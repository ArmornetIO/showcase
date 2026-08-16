<script module lang="ts">
	import type { ChipColor } from '../primitives/Chip.svelte';

	/** A single row in a PersonListPanel — a person (or handle) plus optional scope metadata. */
	export interface PersonListItem {
		id: string;
		/** Primary label rendered in the chip (email, @handle, name). */
		label: string;
		/** Optional secondary metadata shown after the chip (e.g. assignment scope). */
		sublabel?: string;
		/** Chip color for the label. Defaults to 'accent'. Lets callers encode meaning
		 *  (e.g. whole-assessment ownership reads accent, section/question scope reads default). */
		color?: ChipColor;
	}
</script>

<script lang="ts">
	import Panel from './Panel.svelte';
	import Button from '../primitives/Button.svelte';
	import Chip from '../primitives/Chip.svelte';
	import Input from '../primitives/Input.svelte';
	import Icon, { type IconName } from '../icons/Icon.svelte';

	interface PersonListPanelProps {
		/** Header label. */
		title: string;
		/** Optional glyph shown before the title. */
		icon?: IconName;
		/** Rows to render. */
		items: PersonListItem[];
		/** Placeholder for the add-input. */
		placeholder: string;
		/** When true, hides the form + list and shows `disabledHint` instead. */
		disabled?: boolean;
		/** Add in-flight — disables the form and shows the busy add-label. */
		busy?: boolean;
		/** Initial load in-flight — shows a loading line in place of the list. */
		loading?: boolean;
		/** Text on the add button. */
		addLabel?: string;
		/** Helper line shown under the form. */
		hint?: string;
		/** Shown in place of everything when `disabled`. */
		disabledHint?: string;
		/** Shown when `items` is empty. */
		emptyText?: string;
		/** Id of the row whose remove is in-flight (shows a spinner + disables it). */
		removingId?: string | null;
		/** Called with the trimmed input value when the user submits the form. */
		onAdd: (who: string) => void;
		/** Called with the item id when the user removes a row. */
		onRemove: (id: string) => void;
	}

	let {
		title,
		icon,
		items,
		placeholder,
		disabled = false,
		busy = false,
		loading = false,
		addLabel = 'Add',
		hint,
		disabledHint = 'Not available yet.',
		emptyText = 'No one added yet.',
		removingId = null,
		onAdd,
		onRemove
	}: PersonListPanelProps = $props();

	let value = $state('');

	function submit() {
		const who = value.trim();
		if (!who || busy) return;
		onAdd(who);
		// Optimistic clear — the input owns only transient text; the row list is
		// driven by `items` from the caller.
		value = '';
	}
</script>

<Panel {title}>
	{#snippet header()}
		<div class="flex items-center gap-[0.4rem]">
			{#if icon}
				<span class="flex items-center text-[var(--fg-dim)]"><Icon name={icon} size={14} /></span>
			{/if}
			<h2
				class="m-0 font-mono text-[0.78rem] font-semibold tracking-[0.08em] uppercase text-[var(--fg)]"
			>
				{title}
			</h2>
			{#if items.length > 0}
				<Chip color="accent" look="filled">{items.length}</Chip>
			{/if}
		</div>
	{/snippet}

	{#if disabled}
		<p class="mt-2 text-[0.78rem] text-[var(--fg-muted)]">{disabledHint}</p>
	{:else}
		<form
			class="flex items-center gap-[0.35rem]"
			onsubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			<Input size="sm" {placeholder} bind:value disabled={busy} />
			<Button
				type="submit"
				variant="primary"
				size="sm"
				disabled={!value.trim() || busy}
				onclick={submit}
			>
				{busy ? 'Adding…' : addLabel}
			</Button>
		</form>
		{#if hint}
			<p class="mt-[0.4rem] mb-[0.6rem] text-[0.7rem] leading-[1.45] text-[var(--fg-muted)]">
				{hint}
			</p>
		{/if}

		{#if loading}
			<p class="mt-2 text-[0.78rem] text-[var(--fg-muted)]">Loading…</p>
		{:else if items.length === 0}
			<p class="mt-2 text-[0.78rem] text-[var(--fg-muted)]">{emptyText}</p>
		{:else}
			<ul class="mt-1 flex list-none flex-col gap-[0.35rem] p-0">
				{#each items as item (item.id)}
					<li
						class="flex items-center justify-between gap-2 border-b border-[var(--border)] py-[0.3rem] last:border-b-0"
					>
						<div class="flex min-w-0 flex-wrap items-center gap-[0.4rem]">
							<Chip color={item.color ?? 'accent'} look="filled">{item.label}</Chip>
							{#if item.sublabel}
								<span
									class="font-mono text-[0.65rem] tracking-[0.04em] uppercase text-[var(--fg-muted)]"
									>{item.sublabel}</span
								>
							{/if}
						</div>
						<Button
							variant="ghost"
							size="sm"
							disabled={removingId === item.id}
							onclick={() => onRemove(item.id)}
						>
							{removingId === item.id ? '…' : 'Remove'}
						</Button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</Panel>
