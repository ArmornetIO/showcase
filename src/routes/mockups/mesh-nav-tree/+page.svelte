<!--
  Mesh Nav Tree — Linear-style adaptive sidebar mockup
  ─────────────────────────────────────────────────────────────────────────────
  Demonstrates the requested nav upgrade:
   • Category groups (Endpoints / Organization / Mesh) — small-caps label to the left.
   • Expandable nodes are OFFSET (indented). The group's primary/top-level row has
     NO icon; every child row DOES have an icon (Linear pattern).
   • Mesh expands → "Mesh" (all-encompassing agent mesh) + an Agents section and a
     Vendors section. Agents expands into agent MODES; Vendors into vendor modes.
   • Every Mesh-subtree node routes to the SAME Agent Management page with a
     scope/mode FILTER applied (the filter pattern already used elsewhere). The
     right pane is a live Agent Management view so you can SEE the filter land —
     expand Agents → click "DNS Proxy" → the table filters to that mode.

  Data shapes (source of truth for Go structs / TS types):
    NavNode:  { id, label, icon?, scope?: 'mesh'|'agents'|'vendors',
                mode?: string, href?: string, children?: NavNode[] }
    Agent:    { id, name: string, kind: 'agent'|'vendor', mode: string,
                mode_label: string, status: 'online'|'degraded'|'offline',
                host: string, last_seen: string }
    ModeMeta: { mode: string, label: string, icon: string, count: number }
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';
	import Panel from '$lib/layout/Panel.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import StatCard from '$lib/primitives/cards/StatCard.svelte';
	import DataTable from '$lib/display/table/DataTable.svelte';
	import type { TableColumn } from '$lib/display/table/DataTable.svelte';
	import MeshStudio from '$lib/mesh-studio/MeshStudio.svelte';
	import type { StudioNode, StudioEdge } from '$lib/mesh-studio/studio.types.js';
	type Row = Record<string, unknown>;

	// ── Types ────────────────────────────────────────────────────────────────
	type Scope = 'mesh' | 'agents' | 'vendors';
	interface NavNode {
		id: string;
		label: string;
		icon?: IconName; // absent → top-level / structural row (Linear: no icon)
		scope?: Scope; // present → routes to Agent Management with this scope
		mode?: string; // present → also filters to this specific agent mode
		href?: string; // present → non-mesh destination (stubbed route)
		children?: NavNode[];
	}
	interface Agent {
		id: string;
		name: string;
		kind: 'agent' | 'vendor';
		mode: string;
		mode_label: string;
		status: 'online' | 'degraded' | 'offline';
		host: string;
		last_seen: string;
	}

	// ── API stubs (drive the future integration) ───────────────────────────────
	const api = {
		// GET /api/agents?scope=<scope>&mode=<mode>
		fetchAgents: async (): Promise<Agent[]> => {
			await new Promise((r) => setTimeout(r, 300));
			return AGENTS;
		},
		// GET /api/agents/modes  → mode metadata + live counts for the nav
		fetchModes: async (): Promise<Record<string, number>> => {
			await new Promise((r) => setTimeout(r, 200));
			return AGENTS.reduce<Record<string, number>>((acc, a) => {
				acc[a.mode] = (acc[a.mode] ?? 0) + 1;
				return acc;
			}, {});
		}
	};

	// ── Agent mode catalog (mirrors agent/modes_gen.go) ────────────────────────
	const AGENT_MODES: { mode: string; label: string; icon: IconName }[] = [
		{ mode: 'control_plane_management', label: 'Control Plane', icon: 'cpu' },
		{ mode: 'dns_proxy', label: 'DNS Proxy', icon: 'globe' },
		{ mode: 'dep_analysis', label: 'Dependency Analysis', icon: 'git-fork' },
		{ mode: 'feed_content_analysis', label: 'Feed Analysis', icon: 'activity' },
		{ mode: 'github_runner', label: 'GitHub Runner', icon: 'git-branch' },
		{ mode: 'hardened_agent', label: 'Hardened Agent', icon: 'shield' },
		{ mode: 'intelligence', label: 'Intelligence', icon: 'radar' },
		{ mode: 'language', label: 'Language', icon: 'message-square' },
		{ mode: 'supply_chain_proxy', label: 'Supply Chain Proxy', icon: 'package' },
		{ mode: 'vscode_enforcement', label: 'Editor Enforcement', icon: 'code' }
	];
	const VENDOR_MODES: { mode: string; label: string; icon: IconName }[] = [
		{ mode: 'vendor_identification', label: 'Vendor Identification', icon: 'search' },
		{ mode: 'vendor_management', label: 'Vendor Management', icon: 'network' }
	];

	// ── Nav tree ───────────────────────────────────────────────────────────────
	// Groups are the "category to the left". Each group's first row is the
	// top-level (no icon) primary; children carry icons and are offset.
	const GROUPS: { category: string; nodes: NavNode[] }[] = [
		{
			category: 'Endpoints',
			nodes: [
				{
					id: 'endpoints',
					label: 'All Endpoints',
					href: '/console/endpoints',
					children: [
						{ id: 'relays', label: 'Relays', icon: 'shield', href: '/console/relays' },
						{
							id: 'extensions',
							label: 'Editor Extensions',
							icon: 'code',
							href: '/console/extensions'
						},
						{ id: 'install', label: 'Agent Install', icon: 'package', href: '/console/agents/install' },
						{ id: 'integrations', label: 'Integrations', icon: 'link', href: '/console/integrations' }
					]
				}
			]
		},
		{
			category: 'Organization',
			nodes: [
				{
					id: 'org',
					label: 'Organization',
					href: '/console/settings/org',
					children: [
						{ id: 'users', label: 'Users', icon: 'users', href: '/admin/users' },
						{ id: 'org-settings', label: 'Org Settings', icon: 'settings', href: '/console/settings/org' },
						{
							id: 'identity',
							label: 'Identity Providers',
							icon: 'fingerprint',
							href: '/console/settings/identity'
						},
						{ id: 'tokens', label: 'API Tokens', icon: 'key', href: '/console/settings/tokens' },
						{ id: 'trust', label: 'Trust Center', icon: 'shield-check', href: '/risk/internal/trust' }
					]
				}
			]
		},
		{
			category: 'Mesh',
			nodes: [
				// Top-level "Mesh" — no icon, the all-encompassing agent mesh (unfiltered).
				{
					id: 'mesh',
					label: 'Mesh',
					scope: 'mesh',
					children: [
						{
							id: 'agents',
							label: 'Agents',
							icon: 'cpu',
							scope: 'agents',
							children: AGENT_MODES.map((m) => ({
								id: `agent-${m.mode}`,
								label: m.label,
								icon: m.icon,
								scope: 'agents' as Scope,
								mode: m.mode
							}))
						},
						{
							id: 'vendors',
							label: 'Vendors',
							icon: 'network',
							scope: 'vendors',
							children: VENDOR_MODES.map((m) => ({
								id: `vendor-${m.mode}`,
								label: m.label,
								icon: m.icon,
								scope: 'vendors' as Scope,
								mode: m.mode
							}))
						}
					]
				}
			]
		}
	];

	// ── Fake agent data ─────────────────────────────────────────────────────────
	function pick<T>(arr: T[], i: number): T {
		return arr[i % arr.length];
	}
	const HOSTS = ['ip-10-0-3-12', 'ci-runner-04', 'edge-dns-01', 'lang-worker-7', 'gh-runner-2'];
	const STATUSES: Agent['status'][] = ['online', 'online', 'online', 'degraded', 'offline'];
	const AGENTS: Agent[] = [
		...AGENT_MODES.flatMap((m, mi) =>
			Array.from({ length: mi % 2 === 0 ? 2 : 1 }, (_, k) => ({
				id: `a-${m.mode}-${k}`,
				name: `${m.label.split(' ')[0].toLowerCase()}-${(mi + 1) * 10 + k}`,
				kind: 'agent' as const,
				mode: m.mode,
				mode_label: m.label,
				status: pick(STATUSES, mi + k),
				host: pick(HOSTS, mi + k),
				last_seen: pick(['12s ago', '1m ago', '4m ago', '2h ago'], mi + k)
			}))
		),
		...VENDOR_MODES.flatMap((m, mi) =>
			Array.from({ length: 2 }, (_, k) => ({
				id: `v-${m.mode}-${k}`,
				name: `${m.label.split(' ')[0].toLowerCase()}-${(mi + 1) * 10 + k}`,
				kind: 'vendor' as const,
				mode: m.mode,
				mode_label: m.label,
				status: pick(STATUSES, mi + k + 1),
				host: pick(HOSTS, mi + k + 2),
				last_seen: pick(['30s ago', '3m ago', '18m ago', '1d ago'], mi + k)
			}))
		)
	];

	// ── State ────────────────────────────────────────────────────────────────
	let expanded = $state<Record<string, boolean>>({ mesh: true, agents: true });
	let selected = $state<NavNode>(GROUPS[2].nodes[0]); // start on "Mesh" (all)
	let rows = $state<Agent[]>([]);
	let loading = $state(true);

	onMount(() => {
		api.fetchAgents().then((r) => {
			rows = r;
			loading = false;
		});
	});

	function toggle(n: NavNode) {
		if (n.children?.length) expanded[n.id] = !expanded[n.id];
	}
	function select(n: NavNode) {
		selected = n;
		if (n.children?.length) expanded[n.id] = true; // opening also expands
	}

	// The Agent Management filter derived from the selected node — this is the
	// query the real page would receive: /console/agent-management?scope=&mode=
	const activeScope = $derived<Scope | null>(selected.scope ?? null);
	const activeMode = $derived<string | null>(selected.mode ?? null);
	const isMeshView = $derived(activeScope !== null);

	const filtered = $derived(
		rows.filter((a) => {
			if (!activeScope) return false;
			if (activeScope === 'agents' && a.kind !== 'agent') return false;
			if (activeScope === 'vendors' && a.kind !== 'vendor') return false;
			if (activeMode && a.mode !== activeMode) return false;
			return true;
		})
	);

	const crumb = $derived.by<string[]>(() => {
		const c = ['Mesh'];
		if (activeScope === 'agents') c.push('Agents');
		if (activeScope === 'vendors') c.push('Vendors');
		if (activeMode) c.push(selected.label);
		return c;
	});

	const online = $derived(filtered.filter((a) => a.status === 'online').length);
	const degraded = $derived(filtered.filter((a) => a.status !== 'online').length);

	function statusColor(s: Agent['status']): 'success' | 'warn' | 'error' {
		return s === 'online' ? 'success' : s === 'degraded' ? 'warn' : 'error';
	}

	const columns: TableColumn[] = [
		{ key: 'name', header: 'Agent' },
		{ key: 'mode_label', header: 'Mode' },
		{ key: 'status', header: 'Status', width: '120px' },
		{ key: 'host', header: 'Host' },
		{ key: 'last_seen', header: 'Last seen', width: '110px' }
	];

	// ── Row → mesh drill-in ─────────────────────────────────────────────────────
	// Clicking an agent opens a sample of the agent mesh with THAT node filtered:
	// the clicked node stays lit and selected; everything else dims (opacity/inert),
	// so the mesh visually isolates the one agent you drilled into.
	let meshOpen = $state(false);
	let meshAgent = $state<Agent | null>(null);
	let meshNodes = $state<StudioNode[]>([]);
	let meshEdges = $state<StudioEdge[]>([]);
	let meshSelId = $state<string | null>(null);

	function meshTypeForMode(mode: string): StudioNode['type'] {
		if (mode === 'control_plane_management') return 'control-plane';
		if (mode === 'dns_proxy' || mode === 'supply_chain_proxy') return 'proxy';
		if (mode === 'github_runner') return 'daemon';
		return 'agentic';
	}

	// GET /api/mesh?focus=<agent_id>  → a sample of the mesh around one node.
	function buildMesh(focus: Agent, peers: Agent[]): { nodes: StudioNode[]; edges: StudioEdge[] } {
		const meshState = (s: Agent['status']): StudioNode['state'] =>
			s === 'online' ? 'healthy' : s === 'degraded' ? 'degraded' : 'offline';
		const hub: StudioNode = {
			id: 'ctl',
			type: 'control-plane',
			label: 'mesh-ctl',
			x: 430,
			y: 300,
			state: 'healthy'
		};
		// Ring = the focused agent + up to 5 peers from the same filtered view.
		const ring = [focus, ...peers.filter((p) => p.id !== focus.id)].slice(0, 6);
		const nodes: StudioNode[] = [hub];
		const edges: StudioEdge[] = [];
		const R = 195;
		ring.forEach((a, i) => {
			const t = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
			const isFocus = a.id === focus.id;
			nodes.push({
				id: a.id,
				type: meshTypeForMode(a.mode),
				label: a.name,
				x: 430 + R * Math.cos(t),
				y: 300 + R * Math.sin(t),
				state: meshState(a.status),
				mode: a.mode,
				strokeColor: isFocus ? 'var(--accent)' : undefined,
				// Filter: dim + freeze every node except the one we drilled into.
				opacity: isFocus ? 1 : 0.16,
				inert: !isFocus
			});
			edges.push({
				id: `e-${a.id}`,
				from: 'ctl',
				to: a.id,
				dataType: a.kind === 'vendor' ? 'verdict' : 'query',
				style: isFocus ? 'energy' : 'latent',
				active: isFocus
			});
		});
		return { nodes, edges };
	}

	function openMesh(a: Agent) {
		meshAgent = a;
		const built = buildMesh(a, filtered);
		meshNodes = built.nodes;
		meshEdges = built.edges;
		meshSelId = a.id;
		meshOpen = true;
	}
</script>

<div class="flex h-[calc(100vh-3rem)] bg-[var(--bg)] text-[var(--fg)]">
	<!-- ── Sidebar ─────────────────────────────────────────────────────────── -->
	<aside
		class="w-[264px] shrink-0 border-r border-[var(--border)] bg-[var(--bg-elev)] overflow-y-auto py-3"
	>
		<!-- RECOMMEND: extract this whole tree as a lib <NavTree groups={} onselect> —
		     it is the reusable half of the AppShell rail. -->
		{#snippet nodeRow(n: NavNode, depth: number)}
			{@const open = expanded[n.id] ?? false}
			{@const isSel = selected.id === n.id}
			<button
				type="button"
				onclick={() => select(n)}
				aria-current={isSel ? 'page' : undefined}
				aria-expanded={n.children?.length ? open : undefined}
				class="group w-full flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors
					{isSel
					? 'bg-[var(--accent-faint)] text-[var(--accent)]'
					: 'text-[var(--fg-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--fg)]'}"
				style="padding-left: {0.5 + depth * 0.85}rem"
			>
				<!-- chevron (only when the node expands) -->
				<span class="w-3.5 shrink-0 flex items-center justify-center text-[var(--fg-dim)]">
					{#if n.children?.length}
						<span
							role="button"
							tabindex="-1"
							onclick={(e) => {
								e.stopPropagation();
								toggle(n);
							}}
							class="cursor-pointer hover:text-[var(--fg)]"
						>
							<Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
						</span>
					{/if}
				</span>
				<!-- icon: absent on top-level rows (depth 0), present on children -->
				{#if n.icon}
					<span class="shrink-0 flex items-center justify-center"><Icon name={n.icon} size={14} /></span>
				{/if}
				<span
					class="truncate font-mono {depth === 0
						? 'text-[0.78rem] font-semibold tracking-wide'
						: 'text-xs'}">{n.label}</span
				>
				<!-- filter affordance hint on mesh nodes -->
				{#if n.mode}
					<span class="ml-auto text-[var(--fg-dim)] opacity-0 group-hover:opacity-100 transition-opacity">
						<Icon name="filter" size={11} />
					</span>
				{/if}
			</button>
			{#if n.children?.length && open}
				{#each n.children as child (child.id)}
					{@render nodeRow(child, depth + 1)}
				{/each}
			{/if}
		{/snippet}

		{#each GROUPS as group (group.category)}
			<div class="px-3 pt-4 pb-1">
				<span
					class="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-[var(--fg-dim)]"
					>{group.category}</span
				>
			</div>
			<div class="px-1.5 flex flex-col gap-0.5">
				{#each group.nodes as node (node.id)}
					{@render nodeRow(node, 0)}
				{/each}
			</div>
		{/each}
	</aside>

	<!-- ── Content: Agent Management (filtered) ────────────────────────────── -->
	<main class="flex-1 min-w-0 overflow-y-auto p-6">
		{#if isMeshView}
			<!-- Breadcrumb + active filter chips: proof the nav selection landed as a filter -->
			<div class="flex items-center gap-2 mb-1 font-mono text-[0.7rem] text-[var(--fg-dim)]">
				{#each crumb as part, i (part)}
					{#if i > 0}<Icon name="chevron-right" size={11} />{/if}
					<span class={i === crumb.length - 1 ? 'text-[var(--fg)]' : ''}>{part}</span>
				{/each}
			</div>
			<div class="flex items-center justify-between gap-4 mb-4">
				<h1 class="font-mono text-lg font-semibold">Agent Management</h1>
				<code class="font-mono text-[0.62rem] text-[var(--fg-dim)]">
					GET /api/agents?scope={activeScope}{activeMode ? `&mode=${activeMode}` : ''}
				</code>
			</div>
			<div class="flex flex-wrap items-center gap-2 mb-5">
				<Chip look="filled" color="blue">scope: {activeScope}</Chip>
				{#if activeMode}
					<Chip look="filled" color="accent">mode: {activeMode}</Chip>
				{/if}
				<span class="font-mono text-[0.68rem] text-[var(--fg-dim)]">{filtered.length} matching</span>
			</div>

			<!-- Summary tiles react to the filter -->
			<div class="grid grid-cols-3 gap-3 mb-5">
				<StatCard label="Matching" value={filtered.length} size="sm" />
				<StatCard label="Online" value={online} size="sm" variant="success" />
				<StatCard label="Degraded / offline" value={degraded} size="sm" variant="warn" />
			</div>

			<div class="mb-2 font-mono text-[0.62rem] text-[var(--fg-dim)]">
				Tip — click any agent to open it in the mesh, filtered to that node.
			</div>
			<Panel title={crumb[crumb.length - 1]} flush>
				{#if loading}
					<div class="p-8 text-center font-mono text-xs text-[var(--fg-dim)]">Loading agents…</div>
				{:else if filtered.length === 0}
					<div class="p-10 flex flex-col items-center gap-2 text-center">
						<Icon name="cpu" size={26} />
						<p class="font-mono text-xs text-[var(--fg-dim)]">
							No agents running in this mode yet.
						</p>
						<Button size="sm" variant="ghost">Deploy an agent</Button>
					</div>
				{:else}
					<DataTable
						{columns}
						rows={filtered as unknown as Row[]}
						onRowClick={(r) => openMesh(r as unknown as Agent)}
					>
						{#snippet cell(colKey: string, r: Row)}
							{@const row = r as unknown as Agent}
							{#if colKey === 'status'}
								<Chip look="ghost" color={statusColor(row.status)}>{row.status}</Chip>
							{:else if colKey === 'name'}
								<span class="font-mono text-[var(--fg)]">{row.name}</span>
							{:else if colKey === 'host'}
								<span class="font-mono text-[0.7rem] text-[var(--fg-dim)]">{row.host}</span>
							{:else if colKey === 'mode_label'}
								{row.mode_label}
							{:else if colKey === 'last_seen'}
								<span class="text-[0.7rem] text-[var(--fg-dim)]">{row.last_seen}</span>
							{:else}
								{row[colKey as keyof Agent]}
							{/if}
						{/snippet}
					</DataTable>
				{/if}
			</Panel>
		{:else}
			<!-- Non-mesh destination (Endpoints / Organization) — route stub -->
			<div class="flex items-center gap-2 mb-4 font-mono text-[0.7rem] text-[var(--fg-dim)]">
				<span>Navigate</span><Icon name="chevron-right" size={11} /><span class="text-[var(--fg)]"
					>{selected.label}</span
				>
			</div>
			<Panel title={selected.label}>
				<div class="p-8 flex flex-col items-center gap-3 text-center">
					{#if selected.icon}<Icon name={selected.icon} size={28} />{/if}
					<p class="font-mono text-xs text-[var(--fg-muted)]">
						This nav item routes to its own page.
					</p>
					<code class="font-mono text-[0.7rem] text-[var(--accent)]">{selected.href}</code>
					<p class="max-w-md font-mono text-[0.66rem] text-[var(--fg-dim)] mt-2">
						The adaptive tree only re-renders THIS pane for the Mesh group — Endpoints and
						Organization are shown for structure. Open <strong>Mesh → Agents</strong> and click a
						mode to watch the filter land.
					</p>
				</div>
			</Panel>
		{/if}
	</main>

	<!-- ── Mesh drill-in drawer ─────────────────────────────────────────────── -->
	<!-- RECOMMEND: this "focus a node in a sample mesh" drawer is reusable — a lib
	     <MeshFocusDrawer agent={} /> wrapping MeshStudio would serve the real page. -->
	{#if meshOpen && meshAgent}
		<div class="fixed inset-0 z-50 flex">
			<button
				type="button"
				aria-label="Close mesh"
				class="flex-1 bg-black/50 backdrop-blur-sm"
				onclick={() => (meshOpen = false)}
			></button>
			<div
				class="w-[720px] max-w-[92vw] h-full bg-[var(--bg-elev)] border-l border-[var(--border)] shadow-2xl flex flex-col"
			>
				<header class="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border)]">
					<div class="min-w-0">
						<div class="flex items-center gap-2 font-mono text-[0.62rem] text-[var(--fg-dim)]">
							<Icon name="mesh" size={12} /> Agent Mesh · filtered
						</div>
						<div class="font-mono text-sm font-semibold truncate">{meshAgent.name}</div>
					</div>
					<div class="flex items-center gap-2">
						<Chip look="filled" color="accent">{meshAgent.mode}</Chip>
						<Chip look="ghost" color={statusColor(meshAgent.status)}>{meshAgent.status}</Chip>
						<button
							type="button"
							onclick={() => (meshOpen = false)}
							class="p-1 rounded hover:bg-[var(--surface-raised)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
							aria-label="Close"
						>
							<Icon name="x-circle" size={18} />
						</button>
					</div>
				</header>

				<div class="relative flex-1 min-h-0">
					<MeshStudio
						concept="signet"
						nodes={meshNodes}
						edges={meshEdges}
						selectedId={meshSelId}
						onSelect={(id) => (meshSelId = id)}
						showGrid={false}
						allowLinkDraw={false}
						flowActive
					/>
					<!-- filter caption over the canvas -->
					<div
						class="pointer-events-none absolute left-4 bottom-4 font-mono text-[0.6rem] text-[var(--fg-dim)] bg-[var(--bg-elev)]/80 px-2 py-1 rounded"
					>
						Showing 1 of {filtered.length} nodes in this view · others dimmed
					</div>
				</div>

				<footer class="flex items-center justify-between gap-3 px-5 py-3 border-t border-[var(--border)]">
					<code class="font-mono text-[0.6rem] text-[var(--fg-dim)] truncate"
						>GET /api/mesh?focus={meshAgent.id}</code
					>
					<Button size="sm" variant="ghost" onclick={() => (meshOpen = false)}>Close</Button>
				</footer>
			</div>
		</div>
	{/if}
</div>
