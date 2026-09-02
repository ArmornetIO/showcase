<script lang="ts">
	// The insert palette.
	//
	// One palette, two doors: the left-gutter `+` and `/` on an empty line open
	// the same searchable, arrow-navigable menu. The mouse path and the keyboard
	// path must not lead to two different menus with two different mental models
	// — and a keyboard user should never have to reach for the gutter at all.
	//
	// The ordering is the opinion. Most documentation editors lead with prose
	// furniture; ours leads with the blocks that only mean something here — a
	// runnable procedure step, an evidence citation, a control mapping — because
	// those are what turn a policy from a document into something that can prove
	// itself. Paragraphs and tables are table stakes and sort below.

	import { Icon } from 'showcase';
	import type { IconName } from '$lib/icons/Icon.svelte';

	export interface InsertItem {
		id: string;
		label: string;
		hint: string;
		icon: IconName;
		group: string;
		/** Armornet-specific blocks are tinted; prose blocks are not. */
		accent?: string;
	}

	interface Props {
		open: boolean;
		/** Anchor position in the scroll container, in px. */
		x: number;
		y: number;
		oninsert: (item: InsertItem) => void;
		onclose: () => void;
	}

	let { open, x, y, oninsert, onclose }: Props = $props();

	const ITEMS: InsertItem[] = [
		{
			id: 'runnable',
			label: 'Runnable block',
			hint: 'A command that executes and emits its own evidence',
			icon: 'play',
			group: 'Armornet',
			accent: '#34d399'
		},
		{
			id: 'evidence',
			label: 'Evidence citation',
			hint: 'Bind an artifact to this clause, scored against its cadence',
			icon: 'shield-check',
			group: 'Armornet',
			accent: 'var(--accent)'
		},
		{
			id: 'control',
			label: 'Control mapping',
			hint: 'Map this clause to a framework control',
			icon: 'shield',
			group: 'Armornet',
			accent: 'var(--accent)'
		},
		{
			id: 'doclink',
			label: 'Document link',
			hint: 'Reference another policy or procedure by id',
			icon: 'link',
			group: 'Armornet',
			accent: 'var(--accent)'
		},
		{ id: 'h2', label: 'Heading', hint: 'A new clause with its own section id', icon: 'file-text', group: 'Content' },
		{ id: 'p', label: 'Paragraph', hint: 'Body prose', icon: 'file-text', group: 'Content' },
		{ id: 'ul', label: 'Bullet list', hint: 'An unordered list', icon: 'menu', group: 'Content' },
		{ id: 'callout', label: 'Callout', hint: 'A highlighted note', icon: 'info', group: 'Content' },
		{ id: 'code', label: 'Code block', hint: 'Fenced code, not runnable', icon: 'code', group: 'Content' },
		{ id: 'table', label: 'Table', hint: 'A grid of values', icon: 'table', group: 'Content' }
	];

	let query = $state('');
	let cursor = $state(0);
	let input_el = $state<HTMLInputElement | null>(null);

	const matches = $derived(
		ITEMS.filter((i) => {
			const q = query.trim().toLowerCase();
			return !q || i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q);
		})
	);

	// Group headers are rendered inline, so the cursor indexes the FLAT list —
	// keyboard order and visual order must not diverge.
	const groups = $derived([...new Set(matches.map((m) => m.group))]);

	$effect(() => {
		if (open) {
			query = '';
			cursor = 0;
			queueMicrotask(() => input_el?.focus());
		}
	});

	function onkeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			cursor = (cursor + 1) % Math.max(matches.length, 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			cursor = (cursor - 1 + matches.length) % Math.max(matches.length, 1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const item = matches[cursor];
			if (item) oninsert(item);
		}
	}
</script>

{#if open}
	<!-- Click-away. Not a scrim: the palette is a light-weight menu, and dimming
	     the document behind it would overstate what inserting a block costs. -->
	<button
		class="fixed inset-0 z-30 cursor-default"
		aria-label="Close insert menu"
		onclick={onclose}
	></button>

	<div
		class="absolute z-31 w-[19rem] rounded-[8px] border border-[var(--border-strong)]
		       bg-[var(--bg-elev)] shadow-[0_18px_50px_rgba(0,0,0,0.6)] overflow-hidden"
		style:left="{x}px"
		style:top="{y}px"
		role="dialog"
		aria-label="Insert block"
	>
		<div class="flex items-center gap-2 px-2.5 py-2 border-b border-[var(--border)]">
			<Icon name="search" size={12} style="color: var(--fg-dim)" />
			<input
				bind:this={input_el}
				bind:value={query}
				oninput={() => (cursor = 0)}
				{onkeydown}
				placeholder="Insert a block…"
				spellcheck="false"
				class="flex-1 min-w-0 bg-transparent border-0 outline-none font-mono text-[0.66rem] text-[var(--fg)]"
			/>
			<kbd class="font-mono text-[0.55rem] text-[var(--fg-dim)]">esc</kbd>
		</div>

		<div class="max-h-[17rem] overflow-y-auto py-1">
			{#each groups as g (g)}
				<div
					class="px-2.5 pt-2 pb-1 font-mono text-[0.55rem] tracking-[0.1em] uppercase text-[var(--fg-dim)]"
				>
					{g}
				</div>
				{#each matches.filter((m) => m.group === g) as item (item.id)}
					{@const idx = matches.indexOf(item)}
					<button
						class="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-left
						       {idx === cursor ? 'bg-[var(--accent-faint)]' : 'hover:bg-[var(--surface-strong)]'}"
						onclick={() => oninsert(item)}
						onmouseenter={() => (cursor = idx)}
					>
						<span
							class="flex items-center justify-center w-6 h-6 shrink-0 rounded border"
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
						<span class="flex flex-col min-w-0">
							<span class="font-mono text-[0.66rem] text-[var(--fg)]">{item.label}</span>
							<span class="truncate font-mono text-[0.55rem] text-[var(--fg-dim)]">{item.hint}</span>
						</span>
					</button>
				{/each}
			{/each}

			{#if matches.length === 0}
				<p class="m-0 px-2.5 py-4 text-center font-mono text-[0.62rem] text-[var(--fg-dim)]">
					No block matches “{query}”.
				</p>
			{/if}
		</div>
	</div>
{/if}
