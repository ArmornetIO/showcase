<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// Full-shell chrome mock — v3, per feedback: keep the v1 contextual bar, just
	// ADD the eyebrow + collapse to IT (don't swap in the stock subheader).
	//   • Sidebar top = org/profile header + global cluster (Search / Inbox / My work).
	//   • Sidebar body = the 18-icon grouped rail.
	//   • Content bar = MY contextual bar, now with an eyebrow (// …) + a collapse
	//     chevron that reveals the hero (title + lede). Collapsed by default.
	//   • ⌘K = the real CommandPalette overlay.  Bottom = selection action bar.
	// Across 3 views: Vendor Risk list (w/ selection), Agents/Mesh (control swaps),
	// Vendor detail (controls empty to + New).
	// ─────────────────────────────────────────────────────────────────────────
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';
	import ThemePicker from '$lib/theme/ThemePicker.svelte';
	import CommandPalette from '$lib/primitives/CommandPalette.svelte';
	import type { CmdGroup } from '$lib/primitives/CommandPalette.svelte';

	interface NavItem {
		icon: IconName;
		label: string;
		locked?: boolean;
	}
	const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
		{
			label: 'Exposure',
			items: [
				{ icon: 'radar', label: 'Overview' },
				{ icon: 'shield', label: 'Vendor Risk' },
				{ icon: 'shield', label: 'Relay Exposure' },
				{ icon: 'globe', label: 'DNS Filtering', locked: true }
			]
		},
		{
			label: 'Agents',
			items: [
				{ icon: 'mesh', label: 'Mesh' },
				{ icon: 'message-square', label: 'Query', locked: true }
			]
		},
		{
			label: 'Third Party',
			items: [
				{ icon: 'activity', label: 'Activity' },
				{ icon: 'network', label: 'Inventory' },
				{ icon: 'wrench', label: 'Builder' }
			]
		},
		{
			label: 'Internal',
			items: [
				{ icon: 'table-2', label: 'Data Classifications' },
				{ icon: 'clipboard-check', label: 'Self Assessment' },
				{ icon: 'shield-check', label: 'Trust' },
				{ icon: 'clipboard-list', label: 'Risk Register', locked: true }
			]
		},
		{
			label: 'Enforcement',
			items: [
				{ icon: 'shield', label: 'Relays' },
				{ icon: 'code', label: 'Editor Extensions' },
				{ icon: 'clock', label: 'Coming Soon', locked: true },
				{ icon: 'link', label: 'Integrations' }
			]
		},
		{ label: '', items: [{ icon: 'file-text', label: 'Docs' }] }
	];
	const ADMIN: NavItem[] = [
		{ icon: 'users', label: 'User Management' },
		{ icon: 'settings', label: 'Org Settings' }
	];

	interface FilterDef {
		key: string;
		label: string;
	}
	interface ViewDef {
		id: string;
		nav: string;
		icon: IconName;
		eyebrow: string;
		crumb: string[];
		title: string;
		lede: string;
		filters: FilterDef[];
		trailing: { icon: IconName; label: string } | null;
		selectable: boolean;
	}
	const VIEWS: ViewDef[] = [
		{
			id: 'vendor-risk',
			nav: 'Vendor Risk',
			icon: 'shield',
			eyebrow: '// vendor risk · portfolio',
			crumb: ['Exposure', 'Vendor Risk'],
			title: 'Vendor risk.',
			lede: 'Your assessment pipeline and where risk concentrates — how far each vendor has moved through review, and which data classes sit behind your most critical third parties.',
			filters: [
				{ key: 'crit', label: 'Criticality: High' },
				{ key: 'time', label: 'Last 12 months' },
				{ key: 'data', label: 'Data class: PHI' }
			],
			trailing: { icon: 'layers', label: 'Display' },
			selectable: true
		},
		{
			id: 'mesh',
			nav: 'Mesh',
			icon: 'mesh',
			eyebrow: '// agents · mesh',
			crumb: ['Agents', 'Mesh'],
			title: 'Agent mesh.',
			lede: 'Live view of every agent reporting into the mesh — health, mode, and traffic, arranged the way you choose.',
			filters: [
				{ key: 'health', label: 'Status: Degraded' },
				{ key: 'mode', label: 'Mode: dns_proxy' }
			],
			trailing: { icon: 'eye', label: 'View: Canvas' },
			selectable: false
		},
		{
			id: 'detail',
			nav: 'Vendor Risk',
			icon: 'shield',
			eyebrow: '// vendor risk · datadog',
			crumb: ['Exposure', 'Vendor Risk', 'Datadog'],
			title: 'Datadog.',
			lede: "The full third-party risk record — assessment history, data exposure, and the controls behind this vendor's score.",
			filters: [],
			trailing: null,
			selectable: false
		}
	];

	let viewId = $state('vendor-risk');
	const view = $derived(VIEWS.find((v) => v.id === viewId) ?? VIEWS[0]);

	let activeFilters = $state<Record<string, Set<string>>>({
		'vendor-risk': new Set(['crit', 'time']),
		mesh: new Set(),
		detail: new Set()
	});
	const chips = $derived(view.filters.filter((f) => activeFilters[view.id]?.has(f.key)));
	const availFilters = $derived(view.filters.filter((f) => !activeFilters[view.id]?.has(f.key)));
	let filterOpen = $state(false);
	function addChip(k: string) {
		activeFilters[view.id] = new Set([...(activeFilters[view.id] ?? []), k]);
		filterOpen = false;
	}
	function removeChip(k: string) {
		const n = new Set(activeFilters[view.id]);
		n.delete(k);
		activeFilters[view.id] = n;
	}

	let selected = $state<Set<number>>(new Set());
	function toggleRow(i: number) {
		const n = new Set(selected);
		n.has(i) ? n.delete(i) : n.add(i);
		selected = n;
	}
	$effect(() => {
		if (!view.selectable) selected = new Set();
	});

	let paletteOpen = $state(false);
	let accountOpen = $state(false);
	let collapsed = $state(false); // sidebar
	let heroExpanded = $state(false); // the collapsable hero on the bar — collapsed by default

	const PALETTE_COMMANDS: CmdGroup[] = [
		{
			group: 'Results',
			items: [
				{ icon: 'shield', label: 'Datadog', sublabel: 'Vendors · datadoghq.com' },
				{ icon: 'mesh', label: 'edge-proxy-07', sublabel: 'Agents · us-west · dns_proxy' },
				{ icon: 'file-text', label: 'Agent Mesh Protocol', sublabel: 'Docs · Development' }
			]
		},
		{ group: 'Create', items: [{ icon: 'plus', label: 'Add vendor' }] }
	];

	const ROWS = ['Datadog', 'Databricks', 'Snowflake', 'Okta', 'Cloudflare', 'Stripe'];
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			accountOpen = false;
			filterOpen = false;
		}
	}}
/>

<div class="flex h-screen bg-[var(--bg)] text-[var(--fg)] overflow-hidden">
	<!-- ═══ SIDEBAR ═══════════════════════════════════════════════════════════ -->
	<aside
		class="shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg-elev)] transition-[width] duration-200 {collapsed
			? 'w-[64px]'
			: 'w-[248px]'}"
	>
		<!-- A. Header: org + account dropdown -->
		<div class="relative shrink-0 px-3 pt-3 pb-2">
			<button
				type="button"
				onclick={() => (accountOpen = !accountOpen)}
				class="w-full flex items-center gap-2 h-9 px-1.5 rounded-md hover:bg-[var(--surface-raised)] transition-colors"
			>
				<span class="w-6 h-6 shrink-0 flex items-center justify-center rounded-[6px] bg-[var(--accent)] text-[var(--bg)] text-[0.7rem] font-bold">A</span>
				{#if !collapsed}
					<span class="font-mono text-[0.78rem] text-[var(--fg)] truncate">Acme Security</span>
					<Icon name="chevron-down" size={13} class="ml-auto text-[var(--fg-dim)]" />
				{/if}
			</button>
			{#if accountOpen}
				<div class="absolute left-3 right-3 top-[calc(100%-0.25rem)] z-40 flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] shadow-[0_10px_30px_rgba(0,0,0,0.45)] overflow-hidden">
					<div class="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)]">
						<span class="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]">Theme</span>
						<ThemePicker />
					</div>
					<div class="flex flex-col gap-1 px-3 py-2.5 border-b border-[var(--border)]">
						<div class="flex flex-col">
							<span class="font-mono text-[0.5rem] tracking-[0.12em] uppercase text-[var(--fg-dim)]">Subject</span>
							<span class="font-mono text-[0.66rem] text-[var(--fg)]">auth0|6f2a…c91</span>
						</div>
						<div class="flex flex-col">
							<span class="font-mono text-[0.5rem] tracking-[0.12em] uppercase text-[var(--fg-dim)]">Role</span>
							<span class="font-mono text-[0.66rem] text-[var(--fg)]">owner</span>
						</div>
					</div>
					{#each [{ i: 'settings', l: 'Org Settings' }, { i: 'key', l: 'API Tokens' }] as row (row.l)}
						<button type="button" class="flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface-raised)] transition-colors">
							<Icon name={row.i as IconName} size={14} class="text-[var(--fg-dim)]" />
							<span class="font-mono text-xs text-[var(--fg-muted)]">{row.l}</span>
						</button>
					{/each}
					<button type="button" class="flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface-raised)] transition-colors">
						<Icon name="power" size={14} class="text-[#fca5a5]" />
						<span class="font-mono text-xs text-[#fca5a5]">Sign out</span>
					</button>
				</div>
			{/if}
		</div>

		<!-- C. Global cluster -->
		<div class="shrink-0 px-2 pb-2 flex flex-col gap-0.5">
			<button
				type="button"
				onclick={() => (paletteOpen = true)}
				class="flex items-center gap-2.5 h-8 px-2 rounded-md text-[var(--fg-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--fg)] transition-colors {collapsed ? 'justify-center' : ''}"
				title="Search"
			>
				<Icon name="search" size={16} class="shrink-0" />
				{#if !collapsed}<span class="font-mono text-[0.76rem]">Search</span><kbd class="ml-auto font-mono text-[0.56rem] text-[var(--fg-dim)]">⌘K</kbd>{/if}
			</button>
			<button
				type="button"
				class="flex items-center gap-2.5 h-8 px-2 rounded-md text-[var(--fg-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--fg)] transition-colors {collapsed ? 'justify-center' : ''}"
				title="Inbox"
			>
				<Icon name="bell" size={16} class="shrink-0" />
				{#if !collapsed}<span class="font-mono text-[0.76rem]">Inbox</span><span class="ml-auto min-w-[1.1rem] h-4 px-1 flex items-center justify-center rounded-full bg-[var(--accent)] text-[var(--bg)] text-[0.56rem] font-bold font-mono">3</span>{/if}
			</button>
			<div
				class="flex items-center gap-2.5 h-8 px-2 rounded-md text-[var(--fg-dim)] cursor-not-allowed {collapsed ? 'justify-center' : ''}"
				title="My work — coming soon"
			>
				<Icon name="clipboard-check" size={16} class="shrink-0" />
				{#if !collapsed}<span class="font-mono text-[0.76rem]">My work</span><span class="ml-auto font-mono text-[0.5rem] tracking-[0.1em] uppercase px-1 py-[0.05rem] rounded border border-[var(--border)]">Soon</span>{/if}
			</div>
		</div>

		<div class="mx-3 border-t border-[var(--border)]"></div>

		<!-- D. Grouped nav rail -->
		<nav class="flex-1 min-h-0 overflow-y-auto px-2 py-3 flex flex-col gap-4">
			{#each NAV_GROUPS as group (group.label || group.items[0].label)}
				<div class="flex flex-col gap-0.5">
					{#if group.label && !collapsed}
						<span class="font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)] px-2 pb-1">{group.label}</span>
					{/if}
					{#each group.items as item (item.label)}
						{@const isActive = item.label === view.nav && !item.locked}
						<div
							class="flex items-center gap-2.5 h-8 px-2 rounded-md transition-colors {collapsed ? 'justify-center' : ''} {item.locked
								? 'text-[var(--fg-dim)] cursor-not-allowed'
								: isActive
									? 'bg-[var(--accent-faint)] text-[var(--accent)]'
									: 'text-[var(--fg-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--fg)] cursor-pointer'}"
							title={item.label}
						>
							<Icon name={item.icon} size={15} class="shrink-0" />
							{#if !collapsed}
								<span class="font-mono text-[0.74rem] truncate">{item.label}</span>
								{#if item.locked}<Icon name="lock" size={11} class="ml-auto text-[var(--fg-dim)]" />{/if}
							{/if}
						</div>
					{/each}
				</div>
			{/each}

			<div class="mt-auto pt-2 border-t border-[var(--border)] flex flex-col gap-0.5">
				{#if !collapsed}<span class="font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)] px-2 pb-1">Org Admin</span>{/if}
				{#each ADMIN as item (item.label)}
					<div class="flex items-center gap-2.5 h-8 px-2 rounded-md text-[var(--fg-dim)] hover:bg-[var(--surface-raised)] hover:text-[var(--fg-muted)] cursor-pointer transition-colors {collapsed ? 'justify-center' : ''}" title={item.label}>
						<Icon name={item.icon} size={15} class="shrink-0" />
						{#if !collapsed}<span class="font-mono text-[0.74rem]">{item.label}</span>{/if}
					</div>
				{/each}
			</div>
		</nav>

		<!-- F. footer -->
		<div class="shrink-0 px-2 py-2 border-t border-[var(--border)] flex items-center gap-1">
			<button type="button" onclick={() => (collapsed = !collapsed)} class="flex items-center justify-center w-8 h-8 rounded-md text-[var(--fg-dim)] hover:bg-[var(--surface-raised)] hover:text-[var(--fg)] transition-colors" title={collapsed ? 'Expand' : 'Collapse'}>
				<Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={15} />
			</button>
			{#if !collapsed}<span class="font-mono text-[0.62rem] text-[var(--fg-dim)] ml-1">Help &amp; Feedback</span>{/if}
		</div>
	</aside>

	<!-- ═══ CONTENT ═══════════════════════════════════════════════════════════ -->
	<div class="flex-1 min-w-0 flex flex-col">
		<!-- Demo view switcher (mock-only) -->
		<div class="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg)]">
			<span class="font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)] mr-1">Demo →</span>
			{#each VIEWS as v (v.id)}
				<button
					type="button"
					onclick={() => (viewId = v.id)}
					class="h-6 px-2 rounded font-mono text-[0.64rem] transition-colors {viewId === v.id ? 'bg-[var(--accent-faint)] text-[var(--accent)]' : 'text-[var(--fg-dim)] hover:text-[var(--fg-muted)]'}"
					>{v.crumb[v.crumb.length - 1]}{v.id === 'detail' ? ' (detail)' : ''}</button
				>
			{/each}
		</div>

		<!-- ═══ CONTEXTUAL BAR — my v1 bar + eyebrow + collapse ═══ -->
		<div class="shrink-0 border-b border-[var(--border)] bg-[var(--bg-elev)]">
			<div class="relative flex items-center gap-2 h-12 px-4">
				<!-- LEFT: collapse chevron + eyebrow (the "eyebrow / collapsable" we have now) -->
				<button
					type="button"
					onclick={() => (heroExpanded = !heroExpanded)}
					class="flex items-center gap-2 shrink-0 text-[var(--accent)] hover:text-[var(--accent-bright)] transition-colors"
					aria-expanded={heroExpanded}
					aria-label={heroExpanded ? 'Collapse header' : 'Expand header'}
				>
					<svg class="transition-transform duration-200 {heroExpanded ? '' : '-rotate-90'}" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
					<span class="font-mono text-[0.72rem] tracking-[0.22em] uppercase">{view.eyebrow}</span>
				</button>

				<span class="w-px h-5 bg-[var(--border)] mx-1"></span>

				<!-- Filter + chips (only where the view has filters) -->
				{#if view.filters.length}
					<div class="relative flex items-center gap-1.5 min-w-0 flex-1">
						<button
							type="button"
							onclick={() => (filterOpen = !filterOpen)}
							class="flex items-center gap-1 h-7 px-2 rounded-md text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)] font-mono text-[0.68rem] transition-colors shrink-0"
						>
							<Icon name="filter" size={13} /> Filter
						</button>
						<div class="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
							{#each chips as f (f.key)}
								<span class="flex items-center gap-1 h-6 pl-2 pr-1 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-faint)] text-[var(--accent)] font-mono text-[0.66rem] whitespace-nowrap">
									{f.label}
									<button type="button" onclick={() => removeChip(f.key)} class="flex items-center justify-center w-4 h-4 rounded hover:bg-[var(--accent)]/20" aria-label="Remove"><Icon name="x" size={11} /></button>
								</span>
							{/each}
						</div>
						{#if filterOpen}
							<div class="absolute left-0 top-[calc(100%+0.4rem)] z-30 w-52 flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] shadow-[0_10px_30px_rgba(0,0,0,0.45)] overflow-hidden py-1">
								<span class="font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)] px-3 py-1">Add filter</span>
								{#each availFilters as f (f.key)}
									<button type="button" onclick={() => addChip(f.key)} class="flex items-center gap-2 px-3 py-2 text-left font-mono text-[0.68rem] text-[var(--fg-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--fg)] transition-colors"><Icon name="plus" size={12} /> {f.label}</button>
								{/each}
								{#if availFilters.length === 0}<span class="px-3 py-2 font-mono text-[0.66rem] text-[var(--fg-dim)]">All applied</span>{/if}
							</div>
						{/if}
					</div>
				{:else}
					<div class="flex-1"></div>
				{/if}

				<!-- RIGHT: Display/View · New · ⌘K -->
				<div class="flex items-center gap-1.5 shrink-0">
					{#if view.trailing}
						<button type="button" class="flex items-center gap-1 h-7 px-2 rounded-md text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)] font-mono text-[0.68rem] transition-colors">
							<Icon name={view.trailing.icon} size={13} /> {view.trailing.label} <Icon name="chevron-down" size={12} />
						</button>
					{/if}
					<button type="button" class="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[var(--accent)] text-[var(--bg)] font-mono text-[0.68rem] font-semibold hover:opacity-90 transition-opacity">
						<Icon name="plus" size={13} /> New
					</button>
					<button type="button" onclick={() => (paletteOpen = true)} aria-label="Search" class="flex items-center justify-center w-7 h-7 rounded-md border border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--fg-muted)] hover:border-[var(--accent)] transition-colors">
						<Icon name="search" size={13} />
					</button>
				</div>
			</div>

			<!-- collapsable hero (title + lede), revealed by the eyebrow chevron -->
			<div class="grid transition-[grid-template-rows] duration-200" style:grid-template-rows={heroExpanded ? '1fr' : '0fr'}>
				<div class="overflow-hidden">
					<div class="px-4 pt-1 pb-6 max-w-[1100px]">
						<h1 class="[font-family:var(--sans-brand,'Rajdhani',sans-serif)] text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] text-[var(--fg)] m-0">{view.title}</h1>
						<p class="text-[1.0625rem] leading-[1.6] font-light text-[var(--fg-dim)] max-w-[56ch] mt-3 mb-0">{view.lede}</p>
					</div>
				</div>
			</div>
		</div>

		<!-- content list -->
		<div class="flex-1 min-h-0 overflow-y-auto p-6">
			<div class="max-w-[1100px] mx-auto grid gap-2">
				{#each ROWS as name, i (name)}
					<div class="flex items-center gap-3 h-12 px-3 rounded-md border transition-colors {selected.has(i) ? 'border-[var(--accent)]/50 bg-[var(--accent-faint)]' : 'border-[var(--border)] bg-[var(--bg)]'}">
						{#if view.selectable}
							<button type="button" onclick={() => toggleRow(i)} class="w-4 h-4 shrink-0 rounded border flex items-center justify-center {selected.has(i) ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]' : 'border-[var(--fg-dim)]'}" aria-label="Select">
								{#if selected.has(i)}<Icon name="check" size={11} />{/if}
							</button>
						{/if}
						<span class="w-1.5 h-6 rounded-sm bg-[var(--accent)]"></span>
						<span class="font-mono text-[0.82rem] text-[var(--fg)]">{name}</span>
						<span class="font-mono text-[0.66rem] text-[var(--fg-dim)] ml-auto">{view.id === 'mesh' ? 'us-west · healthy' : 'critical · owner: tony'}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- E. selection action bar -->
	{#if view.selectable && selected.size > 0}
		<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 h-11 pl-4 pr-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
			<span class="font-mono text-[0.7rem] text-[var(--fg)]">{selected.size} selected</span>
			<span class="w-px h-5 bg-[var(--border)] mx-2"></span>
			{#each [{ i: 'user', l: 'Assign owner' }, { i: 'flag', l: 'Set criticality' }, { i: 'play', l: 'Start assessment' }, { i: 'save', l: 'Export' }] as a (a.l)}
				<button type="button" class="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[var(--fg-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--fg)] font-mono text-[0.68rem] transition-colors">
					<Icon name={a.i as IconName} size={13} /> {a.l}
				</button>
			{/each}
			<button type="button" onclick={() => (selected = new Set())} class="flex items-center justify-center w-8 h-8 rounded-md text-[var(--fg-dim)] hover:text-[var(--fg)] ml-1" aria-label="Clear"><Icon name="x" size={14} /></button>
		</div>
	{/if}
</div>

<CommandPalette bind:open={paletteOpen} commands={PALETTE_COMMANDS} externalFilter placeholder="Search vendors, agents, docs · run a command · create…" />

<style>
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		scrollbar-width: none;
	}
</style>
