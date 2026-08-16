<script module lang="ts">
	import type { IconName } from '../icons/Icon.svelte';

	export interface CtxFilterOption {
		v: string;
		l: string;
	}
	export interface CtxFilterGroup {
		title: string;
		options: CtxFilterOption[];
		current: string;
		set: (v: string) => void;
	}
	export interface CtxSort {
		options: CtxFilterOption[];
		key: string;
		dir: 'asc' | 'desc';
		set: (key: string, dir: 'asc' | 'desc') => void;
	}
	export interface CtxChip {
		label: string;
		remove: () => void;
	}
	export interface CtxAction {
		label: string;
		icon?: IconName;
		/** Greys the action and blocks the click — e.g. a form that is not fileable yet. */
		disabled?: boolean;
		/** Shows in-flight state on the action; implies disabled. */
		loading?: boolean;
		onclick: () => void;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../icons/Icon.svelte';
	import ActionsMenu, { type ActionMenuItem } from '../primitives/ActionsMenu.svelte';

	// Standardized per-page contextual menu, rendered in a page's LayoutHeader
	// `eyebrowActions` snippet: active-filter chips · Filter dropdown (search +
	// grouped facets) · Display dropdown (sort) · secondary ghost buttons · ⋯
	// overflow menu · a primary "New" button. Every section is optional, so each
	// page passes only the controls it needs. Modeled on the vendor-inventory
	// controls so all pages read identically.
	interface Props {
		chips?: CtxChip[];
		search?: { value: string; set: (v: string) => void; placeholder?: string };
		filterGroups?: CtxFilterGroup[];
		onClear?: () => void;
		sort?: CtxSort;
		secondary?: CtxAction[];
		menu?: ActionMenuItem[];
		primary?: CtxAction;
		/** Page-specific control (e.g. a mesh layout picker) rendered at the start
		 *  of the toolbar, before the standard filter/display controls. */
		controls?: Snippet;
	}
	let {
		chips = [],
		search,
		filterGroups = [],
		onClear,
		sort,
		secondary = [],
		menu = [],
		primary,
		controls
	}: Props = $props();

	const hasFilter = $derived(!!search || filterGroups.length > 0);

	// The strip carries two kinds of thing and they are not peers: controls that
	// change what you are looking at (chips, Filter, Display) and actions that do
	// something to it (secondary, overflow, primary). Rendering them as one
	// undifferentiated row makes the user parse six items to find the one verb.
	// A hairline rule between the zones does that parsing for them.
	const hasControls = $derived(!!controls || chips.length > 0 || hasFilter || !!sort);
	const hasActions = $derived(secondary.length > 0 || menu.length > 0 || !!primary);

	let open = $state<'filter' | 'display' | null>(null);
	let root = $state<HTMLElement>();
	$effect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			if (root && !root.contains(e.target as Node)) open = null;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = null;
		};
		window.addEventListener('pointerdown', onDown);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('pointerdown', onDown);
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="flex items-center gap-1.5 min-w-0" bind:this={root}>
	<!-- page-specific control slot (e.g. mesh layout picker) -->
	{@render controls?.()}

	<!-- active filter chips -->
	{#if chips.length}
		<div class="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
			{#each chips as c (c.label)}
				{@render chip(c.label, c.remove)}
			{/each}
		</div>
	{/if}

	<!-- Filter -->
	{#if hasFilter}
		<div class="relative">
			<button
				type="button"
				onclick={() => (open = open === 'filter' ? null : 'filter')}
				class="flex items-center gap-1 h-7 px-2 rounded-md font-mono text-[0.68rem] transition-colors {open ===
				'filter'
					? 'text-[var(--accent)] bg-[var(--accent-faint)]'
					: 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)]'}"
			>
				<Icon name="filter" size={13} /> Filter
			</button>
			{#if open === 'filter'}
				<div
					class="absolute right-0 top-[calc(100%+0.4rem)] z-40 w-56 flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] shadow-[0_10px_30px_rgba(0,0,0,0.45)] overflow-hidden p-2 gap-1"
				>
					{#if search}
						<div class="flex items-center gap-1.5 px-1 pb-1">
							<Icon name="search" size={13} class="text-[var(--fg-dim)]" />
							<input
								value={search.value}
								oninput={(e) => search?.set((e.currentTarget as HTMLInputElement).value)}
								placeholder={search.placeholder ?? 'Search…'}
								class="flex-1 bg-transparent outline-none font-mono text-[0.72rem] text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
							/>
						</div>
					{/if}
					{#each filterGroups as g (g.title)}
						{@render filterGroup(g)}
					{/each}
					{#if onClear}
						<button
							type="button"
							onclick={onClear}
							class="mt-1 px-2 py-1.5 text-left font-mono text-[0.66rem] text-[var(--fg-dim)] hover:text-[var(--fg)] rounded-md hover:bg-[var(--surface-raised)]"
						>
							Clear filters
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Display (sort) -->
	{#if sort}
		<div class="relative">
			<button
				type="button"
				onclick={() => (open = open === 'display' ? null : 'display')}
				class="flex items-center gap-1 h-7 px-2 rounded-md font-mono text-[0.68rem] transition-colors {open ===
				'display'
					? 'text-[var(--accent)] bg-[var(--accent-faint)]'
					: 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)]'}"
			>
				<Icon name="layers" size={13} /> Display <Icon name="chevron-down" size={12} />
			</button>
			{#if open === 'display'}
				<div
					class="absolute right-0 top-[calc(100%+0.4rem)] z-40 w-52 flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] shadow-[0_10px_30px_rgba(0,0,0,0.45)] overflow-hidden p-2 gap-0.5"
				>
					<span
						class="font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)] px-2 py-1"
						>Sort by</span
					>
					{#each sort.options as s (s.v)}
						<button
							type="button"
							onclick={() => sort?.set(s.v, sort.dir)}
							class="flex items-center gap-2 px-2 py-1.5 rounded-md text-left font-mono text-[0.7rem] transition-colors {sort.key ===
							s.v
								? 'text-[var(--accent)]'
								: 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)]'}"
						>
							{#if sort.key === s.v}<Icon name="check" size={12} />{:else}<span class="w-3"></span
								>{/if}
							{s.l}
						</button>
					{/each}
					<div class="border-t border-[var(--border)] my-1"></div>
					<button
						type="button"
						onclick={() => sort?.set(sort.key, sort.dir === 'asc' ? 'desc' : 'asc')}
						class="flex items-center gap-2 px-2 py-1.5 rounded-md text-left font-mono text-[0.7rem] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)]"
					>
						<Icon name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={12} />
						{sort.dir === 'asc' ? 'Ascending' : 'Descending'}
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- zone rule — controls (what you see) | actions (what you do) -->
	{#if hasControls && hasActions}
		<span class="w-px h-4 mx-1 bg-[var(--border-strong)] shrink-0" aria-hidden="true"></span>
	{/if}

	<!-- secondary ghost actions -->
	{#each secondary as a (a.label)}
		<button
			type="button"
			onclick={a.onclick}
			disabled={a.disabled || a.loading}
			class="flex items-center gap-1 h-7 px-2 rounded-md font-mono text-[0.68rem] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
		>
			{#if a.icon}<Icon name={a.loading ? 'loader-2' : a.icon} size={13} />{/if}
			{a.label}
		</button>
	{/each}

	<!-- ⋯ overflow -->
	{#if menu.length}
		<ActionsMenu items={menu} placement="bottom-end">
			{#snippet trigger({ open: menuOpen, toggle })}
				<button
					type="button"
					onclick={toggle}
					aria-label="More actions"
					class="flex items-center justify-center w-7 h-7 rounded-md transition-colors {menuOpen
						? 'text-[var(--accent)] bg-[var(--accent-faint)]'
						: 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)]'}"
				>
					<Icon name="more-horizontal" size={15} />
				</button>
			{/snippet}
		</ActionsMenu>
	{/if}

	<!-- primary — the only accent-coloured item in the strip, but still in the
	     strip's weight class. A filled slab next to hairline ghosts is the
	     loudest thing on the page, and it is also the most page-specific: that
	     inverts the hierarchy the region exists to express. Outline + tint keeps
	     it unambiguously primary without shouting over the content. -->
	{#if primary}
		<button
			type="button"
			onclick={primary.onclick}
			disabled={primary.disabled || primary.loading}
			class="flex items-center gap-1 h-7 px-2.5 rounded-md border border-[var(--accent)]/45 bg-[var(--accent-faint-strong)] text-[var(--accent)] font-mono text-[0.68rem] font-semibold hover:border-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--accent)]/45 disabled:hover:bg-[var(--accent-faint-strong)]"
		>
			<Icon name={primary.loading ? 'loader-2' : (primary.icon ?? 'plus')} size={13} />
			{primary.label}
		</button>
	{/if}
</div>

{#snippet chip(label: string, onremove: () => void)}
	<span
		class="flex items-center gap-1 h-6 pl-2 pr-1 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-faint)] text-[var(--accent)] font-mono text-[0.66rem] whitespace-nowrap"
	>
		{label}
		<button
			type="button"
			onclick={onremove}
			class="flex items-center justify-center w-4 h-4 rounded hover:bg-[var(--accent)]/20"
			aria-label="Remove filter"><Icon name="x" size={11} /></button
		>
	</span>
{/snippet}

{#snippet filterGroup(g: CtxFilterGroup)}
	<span
		class="font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)] px-2 pt-1.5 pb-0.5"
		>{g.title}</span
	>
	<div class="flex flex-wrap gap-1 px-1 pb-1">
		{#each g.options as o (o.v)}
			<button
				type="button"
				onclick={() => g.set(g.current === o.v ? 'all' : o.v)}
				class="h-6 px-2 rounded-md font-mono text-[0.64rem] border transition-colors {g.current === o.v
					? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-faint)]'
					: 'border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'}">{o.l}</button
			>
		{/each}
	</div>
{/snippet}

<style>
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		scrollbar-width: none;
	}
</style>
