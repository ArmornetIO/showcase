<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../icons/Icon.svelte';
	import type { IconName } from '../icons/Icon.svelte';
	import Flourish from '../motion/Flourish.svelte';
	import { collapse } from '../motion/collapse.js';
	import { advancedSettings } from '../settings/store.svelte.js';

	export interface NavItem {
		label: string;
		/** Destination. Optional — an expand-only parent row (children, no page)
		 *  omits it and just toggles its subtree on click. */
		href?: string;
		/** Optional — top-level/structural rows (Linear pattern) render no icon;
		 *  leaf and nested rows carry one. */
		icon?: IconName;
		/** Locked/roadmap destination — rendered inert (no link) and dimmed. */
		disabled?: boolean;
		/** Tiny trailing tag, e.g. "SOON" on a locked item. */
		badge?: string;
		/** Nested rows — renders an expand chevron; children indent one level. */
		children?: NavItem[];
		/** Start expanded. */
		defaultOpen?: boolean;
		/** Stable key for expand state; defaults to href ?? label. */
		id?: string;
	}

	export interface NavSection {
		title?: string;
		items: NavItem[];
	}

	interface Props {
		sections: NavSection[];
		isActive: (href: string) => boolean;
		brand?: Snippet;
		/** Pinned block between the brand and the scrolling nav — e.g. a global
		 *  Search / Inbox / My-work cluster. Stays put like brand/footer. */
		cluster?: Snippet;
		footer?: Snippet;
		/** Icon-rail (collapsed) mode — centres the burst over the icon instead of
		 *  anchoring it near the left edge of a full-width row. */
		collapsed?: boolean;
	}

	let { sections, isActive, brand, cluster, footer, collapsed = false }: Props = $props();

	// Per-item replay counters. Clicking an item bumps its counter so the shared
	// Flourish overlay replays; the effect itself comes from the cached setting.
	let bursts = $state<Record<string, number>>({});
	function fire(href: string) {
		bursts[href] = (bursts[href] ?? 0) + 1;
	}

	// Expand state for nested rows, keyed by item.id ?? href ?? label.
	function keyOf(item: NavItem): string {
		return item.id ?? item.href ?? item.label;
	}
	let expanded = $state<Record<string, boolean>>({});

	// Expand state is keyed by position in the tree, not by href/label: the nav
	// legitimately repeats an href (Mesh's parent row and its "All Agents" child
	// both point at the mesh route), and a shared key made opening a child write
	// `false` over its own parent. Object identity → structural path fixes that.
	interface NodeMeta {
		path: string;
		/** Paths of the rows beside this one at the same level. */
		siblings: string[];
	}
	const meta = $derived.by(() => {
		const map = new Map<NavItem, NodeMeta>();
		function walk(items: NavItem[], prefix: string) {
			const paths = items.map((_, i) => `${prefix}/${i}`);
			items.forEach((item, i) => {
				map.set(item, { path: paths[i], siblings: paths.filter((_, j) => j !== i) });
				if (item.children?.length) walk(item.children, paths[i]);
			});
		}
		// Top-level rows across every section form ONE sibling group — sections are
		// visual spacing, not scope, and each typically holds a single expandable
		// parent, so scoping per-section would make the accordion a no-op.
		walk(
			sections.flatMap((s) => s.items),
			''
		);
		return map;
	});

	function isOpen(item: NavItem): boolean {
		const path = meta.get(item)?.path;
		return (path !== undefined ? expanded[path] : undefined) ?? item.defaultOpen ?? false;
	}
	function openExclusive(item: NavItem) {
		const node = meta.get(item);
		if (!node) return;
		// Explicit `false` matters — it has to beat a sibling's `defaultOpen`.
		for (const s of node.siblings) expanded[s] = false;
		expanded[node.path] = true;
	}
	function toggle(item: NavItem) {
		const node = meta.get(item);
		if (!node) return;
		if (isOpen(item)) expanded[node.path] = false;
		else openExclusive(item);
	}
	// A subtree counts as active when the row itself or any descendant is active —
	// so a collapsed parent still shows the current location.
	function subtreeActive(item: NavItem): boolean {
		if (item.href && isActive(item.href)) return true;
		return (item.children ?? []).some(subtreeActive);
	}

	// Flat rail projection: when collapsed to the icon rail, the expandable tree
	// gives way to a single strip of destination icons. A top-level row that
	// carries an icon stands for itself; an icon-less structural parent (a group
	// header) is replaced by its direct children. We never recurse deeper — the
	// rail stays one icon per primary destination, with dividers between groups.
	function railItems(items: NavItem[]): NavItem[] {
		const out: NavItem[] = [];
		for (const it of items) {
			if (it.disabled) continue;
			if (it.icon) out.push(it);
			else if (it.children) {
				for (const c of it.children) if (!c.disabled) out.push(c);
			}
		}
		return out;
	}
</script>

<div class="sidebar-nav">
	{#if brand}
		<div class="shrink-0 pt-5 px-3">
			<div class="px-[0.4rem]">
				{@render brand()}
			</div>
		</div>
	{/if}
	{#if cluster}
		<div class="shrink-0 px-3 pt-3">
			{@render cluster()}
		</div>
	{/if}

	{#snippet navRow(item: NavItem, depth: number)}
		{@const hasKids = !!item.children?.length}
		{@const open = isOpen(item)}
		{@const active = item.href ? isActive(item.href) : hasKids ? subtreeActive(item) && !open : false}
		{@const pad = `padding-left: calc(0.75rem + ${Math.max(0, depth - 1)} * 0.8rem)`}
		{#snippet chevron()}
			<span class="nav-chevron w-3.5 shrink-0 flex items-center justify-center text-[var(--fg-dim)]">
				{#if hasKids}
					<Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
				{/if}
			</span>
		{/snippet}
		{#snippet body(showIcon: boolean)}
			{@render chevron()}
			{#if showIcon && item.icon}
				<span class="flex items-center justify-center shrink-0">
					<Icon name={item.icon} size={17} strokeWidth={1.75} />
				</span>
			{/if}
			<span
				class="nav-label font-mono tracking-[0.02em] {depth === 0
					? 'text-[0.78rem] font-semibold'
					: 'text-xs'}">{item.label}</span
			>
			{#if item.badge}
				<span
					class="nav-label ml-auto font-mono text-[0.5rem] tracking-[0.1em] uppercase px-1 py-[0.05rem] rounded border border-[var(--border)] text-[var(--fg-dim)]"
					>{item.badge}</span
				>
			{/if}
		{/snippet}

		{#if item.disabled}
			<span
				class="nav-item nav-item--locked flex items-center gap-[0.6rem] py-2 pr-3 rounded-md relative text-[var(--fg-dim)] cursor-not-allowed"
				style={pad}
				aria-disabled="true"
				title="{item.label} — coming soon"
			>
				{@render body(true)}
			</span>
		{:else if item.href}
			<!-- Navigates. If it also has children, a nested chevron toggles the subtree. -->
			<a
				href={item.href}
				onclick={() => {
					fire(item.href!);
					if (hasKids) openExclusive(item);
				}}
				class="nav-item flex items-center gap-[0.6rem] py-2 pr-3 rounded-md no-underline transition-[color,background] duration-150 relative hover:text-[var(--fg)] hover:bg-[var(--surface-raised)] {active ? 'text-[var(--accent)] bg-[var(--accent-faint)]' : 'text-[var(--fg-muted)]'}"
				style={pad}
				class:active
				aria-current={active ? 'page' : undefined}
			>
				{#if hasKids}
					<button
						type="button"
						class="nav-chevron-btn w-3.5 shrink-0 flex items-center justify-center text-[var(--fg-dim)] hover:text-[var(--fg)]"
						aria-label={open ? 'Collapse' : 'Expand'}
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							toggle(item);
						}}
					>
						<Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
					</button>
				{:else}
					{@render chevron()}
				{/if}
				{#if item.icon}
					<span class="flex items-center justify-center shrink-0">
						<Icon name={item.icon} size={17} strokeWidth={1.75} />
					</span>
				{/if}
				<span
					class="nav-label font-mono tracking-[0.02em] {depth === 0
						? 'text-[0.78rem] font-semibold'
						: 'text-xs'}">{item.label}</span
				>
				<Flourish
					kind={advancedSettings.navFlourish}
					trigger={bursts[item.href] ?? 0}
					anchorX={collapsed ? '50%' : '1.35rem'}
				/>
			</a>
		{:else if hasKids}
			<!-- Expand-only parent (no page of its own) — click toggles the subtree. -->
			<button
				type="button"
				class="nav-item w-full flex items-center gap-[0.6rem] py-2 pr-3 rounded-md text-left transition-colors hover:text-[var(--fg)] hover:bg-[var(--surface-raised)] {active ? 'text-[var(--fg)]' : 'text-[var(--fg-muted)]'}"
				style={pad}
				aria-expanded={open}
				onclick={() => toggle(item)}
			>
				{@render body(true)}
			</button>
		{/if}

		{#if hasKids && open}
			<!-- The subtree gets its own flex column so the wrapper collapse needs
			     (height + overflow) does not disturb the row gap. -->
			<div class="flex flex-col gap-[0.1rem]" transition:collapse>
				{#each item.children! as child (keyOf(child))}
					{@render navRow(child, depth + 1)}
				{/each}
			</div>
		{/if}
	{/snippet}

	{#snippet railRow(item: NavItem)}
		{@const active = subtreeActive(item)}
		{#if item.href}
			<a
				href={item.href}
				onclick={() => fire(item.href!)}
				class="nav-item flex items-center gap-[0.6rem] py-2 px-3 rounded-md no-underline transition-[color,background] duration-150 relative hover:text-[var(--fg)] hover:bg-[var(--surface-raised)] {active
					? 'text-[var(--accent)] bg-[var(--accent-faint)]'
					: 'text-[var(--fg-muted)]'}"
				class:active
				aria-current={active ? 'page' : undefined}
			>
				{#if item.icon}
					<span class="flex items-center justify-center shrink-0">
						<Icon name={item.icon} size={17} strokeWidth={1.75} />
					</span>
				{/if}
				<span class="nav-label font-mono text-xs tracking-[0.02em]">{item.label}</span>
				<Flourish
					kind={advancedSettings.navFlourish}
					trigger={bursts[item.href] ?? 0}
					anchorX="50%"
				/>
			</a>
		{:else}
			<span
				class="nav-item flex items-center gap-[0.6rem] py-2 px-3 rounded-md relative text-[var(--fg-muted)]"
			>
				{#if item.icon}
					<span class="flex items-center justify-center shrink-0">
						<Icon name={item.icon} size={17} strokeWidth={1.75} />
					</span>
				{/if}
				<span class="nav-label font-mono text-xs tracking-[0.02em]">{item.label}</span>
			</span>
		{/if}
	{/snippet}

	<nav class="nav-scroll flex flex-col gap-6 pt-5 px-3 pb-4">
		{#each sections as section (section.title ?? section.items[0]?.href ?? section.items[0]?.label)}
			<div class="nav-group flex flex-col gap-[0.1rem]">
				{#if collapsed}
					<!-- Collapsed rail: a flat strip of destination icons, no expandable
					     sections — dividers between groups stand in for the group headers. -->
					{#each railItems(section.items) as leaf (keyOf(leaf))}
						{@render railRow(leaf)}
					{/each}
				{:else}
					{#if section.title}
						<span class="nav-label font-mono text-[0.6rem] tracking-[0.14em] uppercase text-[var(--fg-dim)] px-3 pb-[0.4rem]">
							{section.title}
						</span>
					{/if}
					{#each section.items as item (keyOf(item))}
						{@render navRow(item, 0)}
					{/each}
				{/if}
			</div>
		{/each}
	</nav>

	{#if footer}
		<div class="shrink-0">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	.sidebar-nav {
		display: flex;
		flex-direction: column;
		flex: 1;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	/* Only the nav items scroll — brand (top) and footer (bottom) stay put. */
	.nav-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	/* A comfortable, consistent target height regardless of icon/label metrics —
	   ~40px clears the crowding at the old 15px-icon/py-2 size and gives the
	   click/focus target more room. The mobile drawer goes a touch taller still. */
	.nav-item {
		min-height: 2.5rem;
	}
	@media (max-width: 640px) {
		.nav-item {
			min-height: 2.75rem;
		}
	}

	.nav-item.active::before {
		content: '';
		position: absolute;
		left: 0;
		top: 20%;
		bottom: 20%;
		width: 2px;
		border-radius: 1px;
		background: var(--accent);
	}

	/* Keyboard focus is a first-class state here: the UA outline is unreliable on
	   a dark surface, so give focus its own 2px accent ring. It coexists with the
	   active-bar (::before) so "where I am" and "where focus is" both read at once.
	   :focus-visible keeps it keyboard-only — no ring on mouse click. */
	.nav-item:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
		color: var(--fg);
	}
</style>
