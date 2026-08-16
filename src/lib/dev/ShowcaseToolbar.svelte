<script lang="ts">
	// Showcase chrome: jump to any component in the library.
	//
	// The search UI is the library's own — a `command-trigger` SearchInput opens
	// the real CommandPalette, the same pairing the product uses. This file only
	// builds the index (from the generated route map) and navigates on select;
	// it owns no input, no dropdown and no keyboard handling.
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import SearchInput from '$lib/primitives/forms/SearchInput.svelte';
	import CommandPalette from '$lib/primitives/actions/CommandPalette.svelte';
	import type { CmdGroup, CmdItem } from '$lib/primitives/actions/CommandPalette.svelte';
	import routeMap from '$lib/generated/route-map.json' with { type: 'json' };

	type SearchEntry = { name: string; route: string; id: string; section: string };

	/** Pages that are destinations rather than component galleries. */
	const SKIP_ROUTES = new Set(['/builder', '/icons', '/arch', '/dev', '/theme', '/docs']);

	const ROUTE_LABELS: Record<string, string> = {
		'/primitives': 'Atoms · Primitives',
		'/layout': 'Atoms · Layout',
		'/navigation': 'Atoms · Navigation',
		'/display': 'Data & Display',
		'/progress': 'Data & Display · Progress',
		'/node-drawer': 'Patterns · NodeDrawer',
		'/modal': 'Patterns · Modal',
		'/alert-blade': 'Patterns · AlertBlade',
		'/cards': 'Patterns · Cards',
		'/canvas': 'Architecture · Canvas'
	};

	/** `PageHero` → `page-hero`, matching the anchor ids the gallery pages emit. */
	function toKebab(name: string): string {
		return name.replace(/([A-Z])/g, (_, c: string, i: number) =>
			i === 0 ? c.toLowerCase() : '-' + c.toLowerCase()
		);
	}

	const index: SearchEntry[] = (() => {
		const entries: SearchEntry[] = [];
		const seen = new Set<string>();
		for (const [route, components] of Object.entries(routeMap as Record<string, string[]>)) {
			if (SKIP_ROUTES.has(route)) continue;
			for (const name of components) {
				if (seen.has(name)) continue;
				seen.add(name);
				entries.push({ name, route, id: toKebab(name), section: ROUTE_LABELS[route] ?? route });
			}
		}
		return entries;
	})();

	const byName = new Map(index.map((e) => [e.name, e]));

	let open = $state(false);
	let query = $state('');

	// Ranked ourselves — exact match, then prefix, then alphabetical — so the
	// palette renders the order verbatim (`externalFilter`).
	const results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return index.slice(0, 8);
		return index
			.filter((e) => e.name.toLowerCase().includes(q))
			.sort((a, b) => {
				const an = a.name.toLowerCase();
				const bn = b.name.toLowerCase();
				const exact = Number(bn === q) - Number(an === q);
				if (exact !== 0) return exact;
				const prefix = Number(bn.startsWith(q)) - Number(an.startsWith(q));
				if (prefix !== 0) return prefix;
				return a.name.localeCompare(b.name);
			})
			.slice(0, 8);
	});

	const commands: CmdGroup[] = $derived([
		{
			group: query.trim() ? 'Components' : 'Jump to a component',
			items: results.map((e) => ({ label: e.name, sublabel: e.section }))
		}
	]);

	function select(item: CmdItem) {
		const entry = byName.get(item.label);
		if (!entry) return;
		open = false;
		query = '';
		goto(`${base}${entry.route}#${entry.id}`);
	}
</script>

<div class="toolbar">
	<div class="toolbar-inner">
		<div class="search-wrap">
			<SearchInput
				variant="command-trigger"
				placeholder="Search components…"
				onclick={() => (open = true)}
			/>
		</div>

		<!-- Future: AI and additional toolbar actions mount here -->
		<div class="toolbar-actions"></div>
	</div>
</div>

<CommandPalette
	bind:open
	{commands}
	externalFilter
	placeholder="Search components…"
	onquery={(q) => (query = q)}
	onselect={select}
/>

<style>
	.toolbar {
		position: sticky;
		top: 0;
		z-index: 40;
		background: var(--bg-elev);
		border-bottom: 1px solid var(--border);
	}

	.toolbar-inner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0 1.25rem;
		height: 48px;
	}

	.search-wrap {
		display: flex;
		align-items: center;
		flex: 1;
		max-width: 380px;
	}

	.toolbar-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	@media (max-width: 640px) {
		.search-wrap {
			max-width: none;
		}
	}
</style>
