<script module lang="ts">
	import type { IconName } from '../../icons/Icon.svelte';

	export interface CtxFilterOption {
		v: string;
		l: string;
	}
	export interface CtxFilterGroup {
		title: string;
		options: CtxFilterOption[];
		/** An array makes the group multi-select: `set` is handed the clicked value to toggle. */
		current: string | string[];
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
	import Icon from '../../icons/Icon.svelte';
	import ActionsMenu, { type ActionMenuItem } from './ActionsMenu.svelte';
	import Select, { type SelectItem } from '../forms/Select.svelte';

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
		/** Extra Display rows — how the page draws its content (layout, folding), under the sort. */
		display?: ActionMenuItem[];
		menu?: ActionMenuItem[];
		/** Swaps the ⋯ trigger, e.g. `plus` when the menu is a set of create actions. */
		menuIcon?: IconName;
		menuLabel?: string;
		/** Gives the trigger the primary action's accent, for when the menu replaces `primary`. */
		menuPrimary?: boolean;
		primary?: CtxAction;
		/** Page-specific control (e.g. a mesh layout picker) rendered at the start
		 *  of the toolbar, before the standard filter/display controls. */
		controls?: Snippet;
		/** Page-specific control rendered at the start of the actions zone. */
		actions?: Snippet;
	}
	let {
		chips = [],
		search,
		filterGroups = [],
		onClear,
		sort,
		secondary = [],
		display = [],
		menu = [],
		menuIcon = 'more-horizontal',
		menuLabel = 'More actions',
		menuPrimary = false,
		primary,
		controls,
		actions
	}: Props = $props();

	const hasFilter = $derived(!!search || filterGroups.length > 0);

	// The strip carries two kinds of thing and they are not peers: controls that
	// change what you are looking at (chips, Filter, Display) and actions that do
	// something to it (secondary, overflow, primary). Rendering them as one
	// undifferentiated row makes the user parse six items to find the one verb.
	// A hairline rule between the zones does that parsing for them.
	const hasControls = $derived(
		!!controls || chips.length > 0 || hasFilter || !!sort || display.length > 0
	);
	const hasActions = $derived(
		!!actions || secondary.length > 0 || menu.length > 0 || !!primary
	);

	// Both panels are Selects: the house popover owns placement, flipping, the
	// portal and dismissal, so a strip inside a clipped rail still opens in full.
	const filterItems = $derived<SelectItem[]>([
		...filterGroups.flatMap((g, i): SelectItem[] => [
			...(i ? [{ kind: 'separator' as const }] : []),
			{ kind: 'header', label: g.title },
			...g.options.map((o) =>
				Array.isArray(g.current)
					? { label: o.l, selected: g.current.includes(o.v), onclick: () => g.set(o.v) }
					: {
							label: o.l,
							selected: g.current === o.v,
							onclick: () => g.set(g.current === o.v ? 'all' : o.v)
						}
			)
		]),
		...(onClear
			? [{ kind: 'separator' as const }, { label: 'Clear filters', icon: 'x' as const, onclick: onClear }]
			: [])
	]);

	const displayItems = $derived<SelectItem[]>([
		...(sort
			? ([
					{ kind: 'header', label: 'Sort by' },
					...sort.options.map((s) => ({
						label: s.l,
						selected: sort.key === s.v,
						onclick: () => sort.set(s.v, sort.dir)
					})),
					{ kind: 'separator' },
					{
						label: sort.dir === 'asc' ? 'Ascending' : 'Descending',
						icon: sort.dir === 'asc' ? 'arrow-up' : 'arrow-down',
						onclick: () => sort.set(sort.key, sort.dir === 'asc' ? 'desc' : 'asc')
					}
				] satisfies SelectItem[])
			: []),
		...(sort && display.length ? [{ kind: 'separator' as const }] : []),
		...display
	]);

	const TRIGGER =
		'flex items-center gap-1 h-7 px-2 rounded-md font-mono text-[0.68rem] transition-colors';
	const triggerTone = (open: boolean) =>
		open
			? 'text-[var(--accent)] bg-[var(--accent-faint)]'
			: 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)]';
</script>

<div class="flex items-center gap-1.5 min-w-0">
	<!-- page-specific control slot (e.g. mesh layout picker) -->
	{@render controls?.()}

	<!-- active filter chips — inside the Filter panel when there is one, so a
	     long filter set doesn't push the strip off the page -->
	{#if chips.length && !hasFilter}
		<div class="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
			{#each chips as c (c.label)}
				{@render chip(c.label, c.remove)}
			{/each}
		</div>
	{/if}

	<!-- Filter -->
	{#if hasFilter}
		<Select
			items={filterItems}
			placement="bottom-end"
			closeOnSelect={false}
			label="Filter"
			header={search || chips.length ? filterHeader : undefined}
		>
			{#snippet trigger({ open, toggle })}
				<button
					type="button"
					onclick={toggle}
					aria-haspopup="menu"
					aria-expanded={open}
					class="{TRIGGER} {triggerTone(open)}"
				>
					<Icon name="filter" size={13} /> Filter
					{#if chips.length}
						<span
							class="flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-[0.6rem] font-semibold"
							aria-label="{chips.length} active">{chips.length}</span
						>
					{/if}
				</button>
			{/snippet}
		</Select>
	{/if}

	<!-- Display (sort) -->
	{#if sort || display.length}
		<Select items={displayItems} placement="bottom-end" closeOnSelect={false} label="Display">
			{#snippet trigger({ open, toggle })}
				<button
					type="button"
					onclick={toggle}
					aria-haspopup="menu"
					aria-expanded={open}
					class="{TRIGGER} {triggerTone(open)}"
				>
					<Icon name="layers" size={13} /> Display <Icon name="chevron-down" size={12} />
				</button>
			{/snippet}
		</Select>
	{/if}

	<!-- zone rule — controls (what you see) | actions (what you do) -->
	{#if hasControls && hasActions}
		<span class="w-px h-4 mx-1 bg-[var(--border-strong)] shrink-0" aria-hidden="true"></span>
	{/if}

	{@render actions?.()}

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
					aria-label={menuLabel}
					class="flex items-center justify-center transition-colors {menuPrimary
						? 'w-[38px] h-9 rounded-[var(--radius-control)] border text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/20 ' +
							(menuOpen
								? 'border-[var(--accent)] bg-[var(--accent)]/20'
								: 'border-[var(--accent)]/45 bg-[var(--accent-faint-strong)]')
						: 'w-7 h-7 rounded-md ' +
							(menuOpen
								? 'text-[var(--accent)] bg-[var(--accent-faint)]'
								: 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)]')}"
				>
					<!-- primary trigger matches ViewToggle's icon-mode button, its usual neighbour -->
					<Icon name={menuIcon} size={menuPrimary ? 16 : 15} />
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

{#snippet filterHeader()}
	{#if chips.length}
		<!-- capped: the panel sizes to content, and an unwrapped chip row sets that -->
		<div class="flex flex-wrap gap-1.5 max-w-64 {search ? 'mb-2' : ''}">
			{#each chips as c (c.label)}
				{@render chip(c.label, c.remove)}
			{/each}
		</div>
	{/if}
	{#if search}{@render searchField()}{/if}
{/snippet}

{#snippet searchField()}
	<div class="flex items-center gap-1.5">
		<Icon name="search" size={13} class="text-[var(--fg-dim)]" />
		<input
			value={search?.value ?? ''}
			oninput={(e) => search?.set((e.currentTarget as HTMLInputElement).value)}
			placeholder={search?.placeholder ?? 'Search…'}
			class="flex-1 bg-transparent outline-none font-mono text-[0.72rem] text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
		/>
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
