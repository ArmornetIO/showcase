<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// Corrected top bar — Linear-style CONTEXTUAL VIEW HEADER (not a search bar).
	// Left: breadcrumb/view-context + inline Filter/Display controls that fill the
	// bar with removable chips. Right: create + account. Global search lives in the
	// ⌘K overlay (summoned, floating) — never occupying the bar.
	// Interactive: switch views (breadcrumb + controls change), toggle filter chips,
	// open Display, open the ⌘K palette.
	// ─────────────────────────────────────────────────────────────────────────
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';

	interface FilterDef {
		key: string;
		label: string; // chip label when active, e.g. "Criticality: High"
	}
	interface ViewDef {
		id: string;
		icon: IconName;
		crumb: string[]; // breadcrumb segments
		filters: FilterDef[]; // available quick-filters for this view
		trailing: { icon: IconName; label: string }; // Display OR View control
	}

	const VIEWS: ViewDef[] = [
		{
			id: 'vendor-risk',
			icon: 'shield',
			crumb: ['Exposure', 'Vendor Risk'],
			filters: [
				{ key: 'crit', label: 'Criticality: High' },
				{ key: 'time', label: 'Last 12 months' },
				{ key: 'data', label: 'Data class: PHI' }
			],
			trailing: { icon: 'layers', label: 'Display' }
		},
		{
			id: 'relay',
			icon: 'shield',
			crumb: ['Exposure', 'Relay Exposure'],
			filters: [
				{ key: 'surface', label: 'Surface: Packages' },
				{ key: 'sev', label: 'Severity: Critical' },
				{ key: 'status', label: 'Status: Open' }
			],
			trailing: { icon: 'layers', label: 'Display' }
		},
		{
			id: 'mesh',
			icon: 'mesh',
			crumb: ['Agents', 'Mesh'],
			filters: [
				{ key: 'health', label: 'Status: Degraded' },
				{ key: 'mode', label: 'Mode: dns_proxy' }
			],
			trailing: { icon: 'eye', label: 'View: Canvas' }
		}
	];

	let viewId = $state('vendor-risk');
	const view = $derived(VIEWS.find((v) => v.id === viewId) ?? VIEWS[0]);

	// Active filter chips per view (keyed by view id → set of filter keys).
	let active = $state<Record<string, Set<string>>>({
		'vendor-risk': new Set(['crit', 'time']),
		relay: new Set(),
		mesh: new Set()
	});
	const chips = $derived(view.filters.filter((f) => active[view.id]?.has(f.key)));
	const available = $derived(view.filters.filter((f) => !active[view.id]?.has(f.key)));

	let filterOpen = $state(false);
	let displayOpen = $state(false);
	let paletteOpen = $state(false);

	function addChip(key: string) {
		active[view.id] = new Set([...(active[view.id] ?? []), key]);
		filterOpen = false;
	}
	function removeChip(key: string) {
		const next = new Set(active[view.id]);
		next.delete(key);
		active[view.id] = next;
	}

	// ⌘K to open the palette (proves search is summoned, not in the bar).
	function onKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			paletteOpen = !paletteOpen;
		} else if (e.key === 'Escape') {
			paletteOpen = false;
			filterOpen = false;
			displayOpen = false;
		}
	}

	const PALETTE_RESULTS = [
		{ kind: 'Vendors', icon: 'shield' as IconName, title: 'Datadog', sub: 'datadoghq.com' },
		{ kind: 'Vendors', icon: 'shield' as IconName, title: 'Databricks', sub: 'databricks.com' },
		{ kind: 'Agents', icon: 'mesh' as IconName, title: 'edge-proxy-07', sub: 'us-west · dns_proxy' },
		{ kind: 'Docs', icon: 'file-text' as IconName, title: 'Agent Mesh Protocol', sub: 'Development' }
	];
</script>

<svelte:window onkeydown={onKey} />

<div class="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
	<!-- View switcher (mockup-only control to demo per-view context) -->
	<div class="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg)]">
		<span class="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-[var(--fg-dim)] mr-2"
			>Demo view →</span
		>
		{#each VIEWS as v (v.id)}
			<button
				type="button"
				onclick={() => (viewId = v.id)}
				class="flex items-center gap-1.5 h-7 px-2.5 rounded-md border font-mono text-[0.68rem] transition-colors {viewId ===
				v.id
					? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-faint)]'
					: 'border-[var(--border)] bg-transparent text-[var(--fg-dim)] hover:text-[var(--fg-muted)]'}"
			>
				<Icon name={v.icon} size={13} />
				{v.crumb[v.crumb.length - 1]}
			</button>
		{/each}
	</div>

	<!-- ═══ THE CORRECTED BAR ═══════════════════════════════════════════════════ -->
	<div
		class="relative flex items-center gap-2 h-12 px-4 border-b border-[var(--border)] bg-[var(--bg-elev)]"
	>
		<!-- LEFT: breadcrumb / view context -->
		<div class="flex items-center gap-1.5 shrink-0">
			<Icon name={view.icon} size={15} style="color: var(--accent)" />
			{#each view.crumb as seg, i (seg)}
				{#if i > 0}<span class="text-[var(--fg-dim)] text-xs">/</span>{/if}
				<span
					class="font-mono text-[0.78rem] {i === view.crumb.length - 1
						? 'text-[var(--fg)] font-semibold'
						: 'text-[var(--fg-muted)]'}">{seg}</span
				>
			{/each}
		</div>

		<span class="w-px h-5 bg-[var(--border)] mx-1"></span>

		<!-- INLINE: Filter + chips (the bar fills as you filter) -->
		<div class="relative flex items-center gap-1.5 min-w-0 flex-1">
			<button
				type="button"
				onclick={() => (filterOpen = !filterOpen)}
				class="flex items-center gap-1 h-7 px-2 rounded-md border border-transparent bg-transparent text-[var(--fg-dim)] hover:text-[var(--fg)] hover:border-[var(--border)] font-mono text-[0.68rem] transition-colors shrink-0"
			>
				<Icon name="filter" size={13} />
				Filter
			</button>

			<!-- active chips -->
			<div class="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
				{#each chips as f (f.key)}
					<span
						class="flex items-center gap-1 h-6 pl-2 pr-1 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-faint)] text-[var(--accent)] font-mono text-[0.66rem] whitespace-nowrap"
					>
						{f.label}
						<button
							type="button"
							onclick={() => removeChip(f.key)}
							class="flex items-center justify-center w-4 h-4 rounded hover:bg-[var(--accent)]/20"
							aria-label="Remove filter"
						>
							<Icon name="x" size={11} />
						</button>
					</span>
				{/each}
			</div>

			<!-- Filter dropdown -->
			{#if filterOpen}
				<div
					class="absolute left-0 top-[calc(100%+0.4rem)] z-30 w-52 flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] shadow-[0_10px_30px_rgba(0,0,0,0.45)] overflow-hidden"
				>
					<span
						class="font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)] px-3 pt-2.5 pb-1"
						>Add filter</span
					>
					{#if available.length === 0}
						<span class="px-3 py-2 font-mono text-[0.66rem] text-[var(--fg-dim)]">All applied</span>
					{/if}
					{#each available as f (f.key)}
						<button
							type="button"
							onclick={() => addChip(f.key)}
							class="flex items-center gap-2 px-3 py-2 text-left font-mono text-[0.68rem] text-[var(--fg-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--fg)] transition-colors"
						>
							<Icon name="plus" size={12} />
							{f.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- RIGHT: Display/View · Create · Search(⌘K) · Account -->
		<div class="flex items-center gap-1.5 shrink-0">
			<div class="relative">
				<button
					type="button"
					onclick={() => (displayOpen = !displayOpen)}
					class="flex items-center gap-1 h-7 px-2 rounded-md border border-transparent text-[var(--fg-dim)] hover:text-[var(--fg)] hover:border-[var(--border)] font-mono text-[0.68rem] transition-colors"
				>
					<Icon name={view.trailing.icon} size={13} />
					{view.trailing.label}
					<Icon name="chevron-down" size={12} />
				</button>
				{#if displayOpen}
					<div
						class="absolute right-0 top-[calc(100%+0.4rem)] z-30 w-52 flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] shadow-[0_10px_30px_rgba(0,0,0,0.45)] p-3 gap-2.5"
					>
						<div class="flex items-center justify-between">
							<span class="font-mono text-[0.62rem] text-[var(--fg-muted)]">Grouping</span>
							<span class="font-mono text-[0.62rem] text-[var(--accent)]">Criticality</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="font-mono text-[0.62rem] text-[var(--fg-muted)]">Ordering</span>
							<span class="font-mono text-[0.62rem] text-[var(--accent)]">Score ↓</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="font-mono text-[0.62rem] text-[var(--fg-muted)]">Layout</span>
							<div class="flex gap-1">
								<span class="font-mono text-[0.62rem] text-[var(--accent)]">List</span>
								<span class="font-mono text-[0.62rem] text-[var(--fg-dim)]">Board</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<span class="w-px h-5 bg-[var(--border)] mx-0.5"></span>

			<button
				type="button"
				class="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[var(--accent)] text-[var(--bg)] font-mono text-[0.68rem] font-semibold hover:opacity-90 transition-opacity"
			>
				<Icon name="plus" size={13} /> New
			</button>

			<!-- search is a SMALL affordance → opens the ⌘K overlay -->
			<button
				type="button"
				onclick={() => (paletteOpen = true)}
				aria-label="Search (Command K)"
				class="flex items-center gap-1.5 h-7 px-2 rounded-md border border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--fg-muted)] hover:border-[var(--accent)] transition-colors"
			>
				<Icon name="search" size={13} />
				<kbd class="font-mono text-[0.56rem] text-[var(--fg-dim)]">⌘K</kbd>
			</button>

			<span
				class="w-7 h-7 flex items-center justify-center rounded-full border border-[var(--border)] font-mono text-[0.7rem] font-bold text-[var(--fg-muted)]"
				>T</span
			>
		</div>
	</div>

	<!-- Faux content, so the bar reads as a real view header -->
	<div class="p-6 max-w-[1200px] mx-auto">
		<div class="flex items-baseline gap-3 mb-4">
			<h1 class="font-mono text-lg text-[var(--fg)]">{view.crumb[view.crumb.length - 1]}</h1>
			<span class="font-mono text-[0.7rem] text-[var(--fg-dim)]"
				>{chips.length} filter{chips.length === 1 ? '' : 's'} · showing 42 of 128</span
			>
		</div>
		<div class="grid gap-2">
			{#each Array(6) as _, i (i)}
				<div
					class="flex items-center gap-3 h-11 px-3 rounded-md border border-[var(--border)] bg-[var(--bg)]"
				>
					<span class="w-1.5 h-6 rounded-sm" style:background="var(--accent)"></span>
					<span class="font-mono text-[0.78rem] text-[var(--fg)]">Row {i + 1}</span>
					<span class="font-mono text-[0.66rem] text-[var(--fg-dim)] ml-auto">contextual to this view</span>
				</div>
			{/each}
		</div>

		<!-- Anatomy caption -->
		<div class="mt-8 flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-[0.62rem] text-[var(--fg-dim)]">
			<span><b class="text-[var(--fg-muted)]">Left:</b> breadcrumb / view context</span>
			<span><b class="text-[var(--fg-muted)]">Inline:</b> Filter → chips fill the bar</span>
			<span><b class="text-[var(--fg-muted)]">Right:</b> Display · New · ⌘K search · account</span>
			<span><b class="text-[var(--accent)]">Search lives in ⌘K</b>, never a bar-wide field</span>
		</div>
	</div>

	<!-- ⌘K palette overlay — summoned, floating, does everything -->
	{#if paletteOpen}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] cursor-default"
			aria-label="Close"
			onclick={() => (paletteOpen = false)}
		></button>
		<div
			class="fixed left-1/2 top-[18vh] -translate-x-1/2 z-50 w-[min(560px,92vw)] rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden"
		>
			<div class="flex items-center gap-2.5 px-4 h-12 border-b border-[var(--border)]">
				<Icon name="search" size={17} style="color: var(--accent)" />
				<input
					class="flex-1 bg-transparent outline-none font-mono text-sm text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
					placeholder="Search vendors, agents, docs · run a command · create…"
					value="data"
				/>
				<span class="font-mono text-[0.56rem] text-[var(--fg-dim)]">ESC</span>
			</div>
			<div class="max-h-[52vh] overflow-y-auto py-2">
				<div class="px-4 py-1 font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]">Results</div>
				{#each PALETTE_RESULTS as r, i (r.title)}
					<div
						class="flex items-center gap-3 px-4 py-2 {i === 0 ? 'bg-[var(--surface-raised)]' : ''}"
					>
						<Icon name={r.icon} size={16} />
						<span class="flex flex-col min-w-0">
							<span class="font-mono text-[0.8rem] text-[var(--fg)]">{r.title}</span>
							<span class="font-mono text-[0.64rem] text-[var(--fg-dim)]">{r.kind} · {r.sub}</span>
						</span>
					</div>
				{/each}
				<div class="px-4 py-1 mt-1 font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]">Create</div>
				<div class="flex items-center gap-3 px-4 py-2">
					<Icon name="plus" size={16} />
					<span class="font-mono text-[0.8rem] text-[var(--fg)]">Add vendor</span>
				</div>
			</div>
			<div class="flex items-center gap-4 px-4 h-9 border-t border-[var(--border)] font-mono text-[0.58rem] text-[var(--fg-dim)]">
				<span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		scrollbar-width: none;
	}
</style>
