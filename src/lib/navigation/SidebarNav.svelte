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

	// The nav's hierarchy style is a global preference, not a prop: one look for
	// the whole app, and a per-instance override would let two navs in the same
	// session disagree.
	const graphMode = $derived(advancedSettings.navStyle === 'graph');

	// Which ancestor column a last child merges back into: the nearest one to its
	// left that still has rows below. -1 when nothing follows anywhere up the
	// chain, in which case the path simply ends on that child.
	function mergeTarget(trunks: boolean[], depth: number): number {
		for (let j = depth - 2; j >= 0; j--) if (trunks[j]) return j;
		return -1;
	}

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

	<!--
		The commit-graph gutter. `trunks[i]` = the branch owning column `i` still
		has rows below this one. It is the one thing a row cannot work out from
		itself, so it is threaded down the recursion; children get
		`[...trunks, !childIsLast]`.

		The graph is a CHAIN, not a comb: an ancestor's trunk is paused for the
		length of an open subtree rather than run beside it, and the last child
		merges it back. One path descends and rejoins, so at any row there is
		exactly one line that leads to you.
	-->
	{#snippet graph(item: NavItem, depth: number, trunks: boolean[], open: boolean, active: boolean)}
		{@const hasKids = !!item.children?.length}
		{@const isLast = depth > 0 && trunks[depth - 1] === false}
		{@const mergeTo = isLast ? mergeTarget(trunks, depth) : -1}
		<span class="graph" aria-hidden="true">
			{#each trunks as passes, i (i)}
				<span class="cell">
					{#if i < depth - 1}
						<!-- Deliberately empty: this ancestor's trunk is paused, and the
						     merge below puts it back. Drawing it here as well would put two
						     lines down the same rows and neither would be the one you are
						     on. -->
					{:else}
						<!-- The parent's column. It always reaches this row's junction, and
						     continues past it only if more siblings follow AND this row is
						     not itself branching — an open row hands the path to its
						     children and takes it back at their last one. -->
						<span class={passes && !open ? 'line-full' : 'line-top'} class:lit={active}
						></span>
						<span class="elbow" class:lit={active}></span>
						{#if mergeTo >= 0}
							<span class="merge-down"></span>
							<span class="merge-across" style="width:{(i - mergeTo) * 0.85}rem"></span>
						{/if}
					{/if}
				</span>
			{/each}
			<span class="cell">
				{#if open && hasKids}
					<span class="line-bottom" class:line-bottom--caret={depth === 0}></span>
				{:else if hasKids && depth > 0}
					<!-- Closed, and nested too deep to carry a caret: show the HEAD of the
					     branch, a short spur that fades out. A closed subtree would
					     otherwise be indistinguishable from a leaf, and this says "there
					     is more" in the graph's own vocabulary instead of adding a second
					     glyph per row. -->
					<span class="line-stub"></span>
				{/if}
				{#if depth === 0 && hasKids}
					<!-- Only the root of a branch carries a disclosure. Below it the lines
					     already say what is open, so a chevron per row would be the same
					     fact twice. -->
					<span class="caret" class:caret--open={open} class:caret--active={active}>
						<Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
					</span>
				{/if}
			</span>
		</span>
	{/snippet}

	{#snippet navRow(item: NavItem, depth: number, trunks: boolean[])}
		{@const hasKids = !!item.children?.length}
		{@const open = isOpen(item)}
		{@const active = item.href ? isActive(item.href) : hasKids ? subtreeActive(item) && !open : false}
		<!-- Indent comes from the gutter cells in graph mode, so padding must not
		     add a second one — the lines and the indent could then disagree. -->
		{@const pad = graphMode
			? ''
			: `padding-left: calc(0.75rem + ${Math.max(0, depth - 1)} * 0.8rem)`}
		{@const rowCls = graphMode ? 'gap-[0.5rem] pl-2 pr-3' : 'gap-[0.6rem] pr-3'}
		{#snippet chevron()}
			<span class="nav-chevron w-3.5 shrink-0 flex items-center justify-center text-[var(--fg-dim)]">
				{#if hasKids}
					<Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
				{/if}
			</span>
		{/snippet}
		{#snippet gutter()}
			{#if graphMode}
				{@render graph(item, depth, trunks, open, active)}
			{:else}
				{@render chevron()}
			{/if}
		{/snippet}
		{#snippet rowIcon()}
			{#if item.icon}
				{#if graphMode}
					<!-- The icon IS the node: the branch terminates on this ring rather
					     than on a separate dot, so the graph ends where the eye already is. -->
					<span class="icon-node" class:icon-node--active={active}>
						<Icon name={item.icon} size={14} strokeWidth={1.75} />
					</span>
				{:else}
					<span class="flex items-center justify-center shrink-0">
						<Icon name={item.icon} size={17} strokeWidth={1.75} />
					</span>
				{/if}
			{/if}
		{/snippet}
		{#snippet label()}
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
				class="nav-item nav-item--locked flex items-center {rowCls} py-2 rounded-md relative text-[var(--fg-dim)] cursor-not-allowed"
				style={pad}
				aria-disabled="true"
				title="{item.label} — coming soon"
			>
				{@render gutter()}
				{@render rowIcon()}
				{@render label()}
			</span>
		{:else if item.href}
			<!-- Navigates. The gutter doubles as the expander when there is a subtree. -->
			<a
				href={item.href}
				onclick={() => {
					fire(item.href!);
					if (hasKids) openExclusive(item);
				}}
				class="nav-item flex items-center {rowCls} py-2 rounded-md no-underline transition-[color,background] duration-150 relative hover:text-[var(--fg)] hover:bg-[var(--surface-raised)] {active ? 'text-[var(--accent)] bg-[var(--accent-faint)]' : 'text-[var(--fg-muted)]'}"
				style={pad}
				class:active
				aria-current={active ? 'page' : undefined}
			>
				{#if hasKids}
					<button
						type="button"
						class={graphMode
							? 'graph-btn'
							: 'nav-chevron-btn w-3.5 shrink-0 flex items-center justify-center text-[var(--fg-dim)] hover:text-[var(--fg)]'}
						aria-label={open ? 'Collapse' : 'Expand'}
						aria-expanded={open}
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							toggle(item);
						}}
					>
						{#if graphMode}
							{@render graph(item, depth, trunks, open, active)}
						{:else}
							<Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
						{/if}
					</button>
				{:else}
					{@render gutter()}
				{/if}
				{@render rowIcon()}
				{@render label()}
				<Flourish
					kind={advancedSettings.navFlourish}
					trigger={bursts[item.href] ?? 0}
					anchorX={collapsed ? '50%' : '1.35rem'}
				/>
			</a>
		{:else if hasKids}
			<!-- Expand-only parent (no page of its own) — the whole row toggles. -->
			<button
				type="button"
				class="nav-item w-full flex items-center {rowCls} py-2 rounded-md text-left transition-colors hover:text-[var(--fg)] hover:bg-[var(--surface-raised)] {active ? 'text-[var(--fg)]' : 'text-[var(--fg-muted)]'}"
				style={pad}
				aria-expanded={open}
				onclick={() => toggle(item)}
			>
				{@render gutter()}
				{@render rowIcon()}
				{@render label()}
			</button>
		{/if}

		{#if hasKids && open}
			<!-- The subtree gets its own flex column so the wrapper collapse needs
			     (height + overflow) does not disturb the row gap. -->
			<div class="flex flex-col gap-[0.1rem]" transition:collapse>
				{#each item.children! as child, i (keyOf(child))}
					{@render navRow(child, depth + 1, [...trunks, i < item.children!.length - 1])}
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
						{@render navRow(item, 0, [])}
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

	/* Nothing in the gutter transitions. Every state it shows — hover, active,
	   focus — is feedback about the pointer or the caret, and a 150ms ease on
	   feedback reads as the nav lagging behind the cursor. The row's own
	   background keeps its fade; the graph answers instantly.

	   ── Commit-graph gutter (navStyle: 'graph') ─────────────────────────────
	   One cell per column, laid out in the row's own flow so indent and lines come
	   from the same box — the graph cannot drift out of register with the text.
	   Every segment is absolutely positioned inside its cell and stretches to the
	   cell's edges, so adjacent rows' segments meet with no seam at any row height. */
	.graph {
		display: flex;
		align-self: stretch;
		flex-shrink: 0;
		/* One knob for the whole graph. Sits between `--border` (vanishes) and
		   `--fg-dim` (competes with the labels) — the graph is structure the eye
		   should be able to ignore until it goes looking for it. */
		--graph-line: color-mix(in oklab, var(--fg-dim) 45%, transparent);
		--graph-weight: 1px;
	}
	.cell {
		position: relative;
		width: 0.85rem;
		flex-shrink: 0;
	}
	.line-full,
	.line-top,
	.line-bottom {
		position: absolute;
		left: 50%;
		width: var(--graph-weight);
		transform: translateX(-50%);
		background: var(--graph-line);
	}
	/* Rows sit in a `gap-[0.1rem]` column and each subtree adds another gap above
	   its first child, so a segment that stopped at the cell edge left the graph
	   visibly dashed at every row boundary. The overhang bridges both gaps. */
	.line-full {
		top: -4px;
		bottom: -4px;
	}
	.line-top {
		top: -4px;
		height: calc(50% + 4px);
	}
	.line-bottom {
		top: 50%;
		bottom: -4px;
	}
	/* Under a caret the line starts below the glyph, so the trunk looks like it
	   comes out of the disclosure rather than through it. */
	.line-bottom--caret {
		top: 72%;
	}
	/* Runs from the parent column's centre, through this row's own column and
	   across the row gap, to land on the icon's ring — the branch has to touch its
	   node or the two read as separate ornaments. 1.5 cells + the row's 0.5rem gap. */
	.elbow {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 1.775rem;
		height: var(--graph-weight);
		transform: translateY(-50%);
		background: var(--graph-line);
	}

	/* Fades rather than stops: a hard tick would read as a mark ON the graph, and
	   the point is that it reads as a line continuing out of frame. */
	.line-stub {
		position: absolute;
		left: 50%;
		top: 50%;
		height: 0.6rem;
		width: var(--graph-weight);
		transform: translateX(-50%);
		background: linear-gradient(var(--graph-line), transparent);
	}
	/* On the row you are pointing at it commits to being a line — that is the
	   moment you are asking "does this open?". */
	.nav-item:hover .line-stub {
		height: 0.85rem;
	}

	/* The merge. A last child does not leave the path dangling: it carries it down
	   and back left into the nearest ancestor column that still has rows below, so
	   the gutter is one chain that branches and rejoins rather than a comb with a
	   loose end under every group. */
	.merge-down {
		position: absolute;
		left: 50%;
		top: 50%;
		bottom: 0;
		width: var(--graph-weight);
		transform: translateX(-50%);
		background: var(--graph-line);
	}
	.merge-across {
		position: absolute;
		right: 50%;
		bottom: 0;
		height: var(--graph-weight);
		background: var(--graph-line);
	}

	/* The branch feeding the current row lights up — the gutter then answers
	   "where am I" on its own, which is the reason to draw it at all. */
	.lit {
		background: color-mix(in oklab, var(--accent) 70%, transparent);
	}

	/* The node: a ring around the row's own icon. `--bg-elev` is load-bearing —
	   it masks the elbow so the line stops at the ring instead of running under
	   the glyph. */
	.icon-node {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		position: relative;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 1px solid var(--graph-line);
		background: var(--bg-elev);
	}
	.icon-node--active {
		border-color: var(--accent);
		background: var(--accent-faint);
	}
	.nav-item:hover .icon-node {
		border-color: var(--fg-dim);
	}

	.caret {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--fg-dim);
	}
	.caret--open {
		color: var(--fg-muted);
	}
	.caret--active {
		color: var(--accent);
	}
	.nav-item:hover .caret {
		color: var(--fg);
	}
	.nav-item:hover .graph {
		--graph-line: color-mix(in oklab, var(--fg-dim) 80%, transparent);
	}

	/* The caret is the expander, so it needs a real hit area — the button stretches
	   the row's height while staying exactly the gutter's width. */
	.graph-btn {
		display: flex;
		align-self: stretch;
		flex-shrink: 0;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.graph-btn:focus-visible {
		outline: none;
	}
	.graph-btn:focus-visible .caret {
		color: var(--accent);
	}
	.graph-btn:focus-visible .graph {
		--graph-line: var(--accent);
	}

	.nav-item.active::before {
		content: '';
		position: absolute;
		left: 0;
		top: 20%;
		bottom: 20%;
		width: 2px;
		border-radius: var(--radius-hairline);
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
