<script lang="ts" module>
	import type { IconName } from '../../icons/Icon.svelte';

	export interface InsertItem {
		id: string;
		label: string;
		hint: string;
		icon: IconName;
		group: string;
		/** Tints the item — for the blocks that only mean something in this product. */
		accent?: string;
	}
</script>

<script lang="ts">
	// The insert palette: searchable and arrow-navigable, so the gutter `+` and the
	// keyboard lead to the same menu with the same mental model.
	import Icon from '../../icons/Icon.svelte';

	interface Props {
		open: boolean;
		items: InsertItem[];
		/** Anchor in the positioned parent, in px. */
		x: number;
		y: number;
		oninsert: (item: InsertItem) => void;
		onclose: () => void;
	}

	let { open, items, x, y, oninsert, onclose }: Props = $props();

	let query = $state('');
	let cursor = $state(0);
	let input = $state<HTMLInputElement | null>(null);

	const matches = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return items.filter(
			(i) => !q || i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q)
		);
	});
	// The cursor indexes the FLAT list, so keyboard order and visual order agree.
	const groups = $derived([...new Set(matches.map((m) => m.group))]);

	$effect(() => {
		if (open) {
			query = '';
			cursor = 0;
			queueMicrotask(() => input?.focus());
		}
	});

	function onkeydown(e: KeyboardEvent) {
		const n = Math.max(matches.length, 1);
		if (e.key === 'Escape') onclose();
		else if (e.key === 'ArrowDown') cursor = (cursor + 1) % n;
		else if (e.key === 'ArrowUp') cursor = (cursor - 1 + n) % n;
		else if (e.key === 'Enter' && matches[cursor]) oninsert(matches[cursor]);
		else return;
		e.preventDefault();
	}
</script>

{#if open}
	<!-- Click-away, not a scrim: dimming the document would overstate what inserting costs. -->
	<button class="fixed inset-0 z-30 cursor-default" aria-label="Close insert menu" onclick={onclose}
	></button>

	<div
		class="absolute z-31 w-[19rem] overflow-hidden rounded-[8px] border border-[var(--border-strong)] bg-[var(--bg-elev)] shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
		style:left="{x}px"
		style:top="{y}px"
		role="dialog"
		aria-label="Insert block"
	>
		<div class="flex items-center gap-2 border-b border-[var(--border)] px-2.5 py-2">
			<Icon name="search" size={12} style="color: var(--fg-dim)" />
			<input
				bind:this={input}
				bind:value={query}
				oninput={() => (cursor = 0)}
				{onkeydown}
				placeholder="Insert a block…"
				spellcheck="false"
				class="min-w-0 flex-1 border-0 bg-transparent font-(family-name:--mono) text-[0.66rem] text-[var(--fg)] outline-none"
			/>
			<kbd class="font-(family-name:--mono) text-[0.55rem] text-[var(--fg-dim)]">esc</kbd>
		</div>

		<div class="max-h-[17rem] overflow-y-auto py-1">
			{#each groups as g (g)}
				<div
					class="px-2.5 pt-2 pb-1 font-(family-name:--mono) text-[0.55rem] tracking-[0.1em] text-[var(--fg-dim)] uppercase"
				>
					{g}
				</div>
				{#each matches.filter((m) => m.group === g) as item (item.id)}
					{@const idx = matches.indexOf(item)}
					<button
						type="button"
						class="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left {idx === cursor
							? 'bg-[var(--accent-faint)]'
							: 'hover:bg-[var(--surface-strong)]'}"
						onclick={() => oninsert(item)}
						onmouseenter={() => (cursor = idx)}
					>
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded border"
							style:color={item.accent ?? 'var(--fg-muted)'}
							style:border-color={item.accent
								? `color-mix(in srgb, ${item.accent} 35%, transparent)`
								: 'var(--border)'}
							style:background={item.accent
								? `color-mix(in srgb, ${item.accent} 12%, transparent)`
								: 'transparent'}
						>
							<Icon name={item.icon} size={12} />
						</span>
						<span class="flex min-w-0 flex-col">
							<span class="font-(family-name:--mono) text-[0.66rem] text-[var(--fg)]"
								>{item.label}</span
							>
							<span class="truncate font-(family-name:--mono) text-[0.55rem] text-[var(--fg-dim)]"
								>{item.hint}</span
							>
						</span>
					</button>
				{/each}
			{/each}

			{#if matches.length === 0}
				<p
					class="m-0 px-2.5 py-4 text-center font-(family-name:--mono) text-[0.62rem] text-[var(--fg-dim)]"
				>
					No block matches “{query}”.
				</p>
			{/if}
		</div>
	</div>
{/if}
