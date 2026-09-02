<script lang="ts">
	import PanelLoading from '$lib/display/feedback/PanelLoading.svelte';
	import Canvas from '$lib/primitives/canvas/Canvas.svelte';
	import CameraControls from '$lib/primitives/canvas/CameraControls.svelte';
	import DataTable from '$lib/display/table/DataTable.svelte';
	import type { TableColumn, CompareColumn, CompareRow } from '$lib/display/table/DataTable.svelte';
	import Ticker from '$lib/display/metric/Ticker.svelte';
	import Avatar from '$lib/display/entity/Avatar.svelte';
	import LogRow from '$lib/display/code/LogRow.svelte';
	import StatTile from '$lib/display/metric/StatTile.svelte';
	import CountUp from '$lib/display/metric/CountUp.svelte';
	import PostureVerdict from '$lib/display/metric/PostureVerdict.svelte';
	import MeshMembrane from '$lib/mesh-studio/membrane/MeshMembrane.svelte';
	import Sparkline from '$lib/display/metric/Sparkline.svelte';
	import PeerCard from '$lib/display/entity/PeerCard.svelte';
	import CodeBlock from '$lib/display/code/CodeBlock.svelte';
	import ConfigBlock from '$lib/display/code/ConfigBlock.svelte';
	import ConsensusBar from '$lib/display/progress/ConsensusBar.svelte';
	import Timeline from '$lib/display/content/Timeline.svelte';
	import type { TimelineEvent } from '$lib/display/content/Timeline.svelte';
	import CollapsibleStack from '$lib/display/content/CollapsibleStack.svelte';
	import CollapsibleStackRow from '$lib/display/content/CollapsibleStackRow.svelte';
	import SheetDrawer from '$lib/display/drawer/SheetDrawer.svelte';
	import type { SheetDrawerSize } from '$lib/display/drawer/SheetDrawer.svelte';
	import Chip from '$lib/primitives/status/Chip.svelte';
	import IconButton from '$lib/primitives/actions/IconButton.svelte';
	import TableFoot from '$lib/display/table/TableFoot.svelte';
	import TablePager from '$lib/display/table/TablePager.svelte';
	import FilterToolbar from '$lib/display/table/FilterToolbar.svelte';
	import BulkActionBar from '$lib/display/table/BulkActionBar.svelte';
	import Select from '$lib/primitives/forms/Select.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';

	// ── Table furniture demo state ────────────────────────────────────────────
	// FilterToolbar reports a count it does not compute, so the page has to do
	// the filtering — otherwise the count is a decorative number.
	const AGENT_ROWS = [
		{ name: 'agent-01', mode: 'enforce' },
		{ name: 'agent-02', mode: 'observe' },
		{ name: 'agent-03', mode: 'enforce' },
		{ name: 'build-runner-02', mode: 'observe' },
		{ name: 'edge-proxy-eu', mode: 'enforce' }
	];
	let tableSearch = $state('');
	let agentMode = $state('all');
	const filteredAgents = $derived(
		AGENT_ROWS.filter(
			(a) =>
				a.name.toLowerCase().includes(tableSearch.toLowerCase()) &&
				(agentMode === 'all' || a.mode === agentMode)
		)
	);
	function resetTableFilters() {
		tableSearch = '';
		agentMode = 'all';
	}

	let bulkCount = $state(12);
	let pagerA = $state(1);
	let pagerB = $state(3);
	let pagerC = $state(97);

	const chartData = [12, 28, 19, 44, 38, 52, 47, 61, 55, 70, 63, 78, 71, 85, 79];
	const chartData2 = [80, 74, 85, 70, 65, 77, 60, 55, 68, 50, 58, 44, 52, 40, 35];

	// ── MeshMembrane demo data ────────────────────────────────────────────────
	const demoMembrane = {
		registries: [
			{ id: 'r-npm', label: 'NPM·REG', kind: 'npm' },
			{ id: 'r-pip', label: 'PYPI·REG', kind: 'pip' },
			{ id: 'r-go', label: 'GO·PROXY', kind: 'go' },
			{ id: 'r-git', label: 'GITHUB', kind: 'git' }
		],
		proxies: [
			{ id: 'p-go', label: 'GO', kind: 'go', policy: 'block' as const, enabled: true, agentCount: 14 },
			{ id: 'p-npm', label: 'NPM', kind: 'npm', policy: 'warn' as const, enabled: true, agentCount: 11 },
			{ id: 'p-git', label: 'GIT', kind: 'git', policy: 'block' as const, enabled: true, agentCount: 16 },
			{ id: 'p-pip', label: 'PIP', kind: 'pip', policy: 'block' as const, enabled: false }
		],
		agents: [
			{ id: 'a1', label: 'dep-analysis', status: 'healthy' as const },
			{ id: 'a2', label: 'threat-intel', status: 'degraded' as const }
		]
	};



	// ── DataTable demo data ───────────────────────────────────────────────────
	type VendorRow = {
		name: string;
		owner: string;
		criticality: string;
		critVariant: 'critical' | 'warn' | 'cyan' | 'blue';
		data: string;
		certs: string[];
		assessment: string;
		assessVariant: 'cyan' | 'default';
		lastReview: string;
		status: string;
		statusVariant: 'error' | 'warn' | 'success' | 'default';
	};

	const vendorRows: VendorRow[] = [
		{
			name: 'Acme Analytics',
			owner: 'data@armornet.io',
			criticality: 'LOW',
			critVariant: 'blue',
			data: 'none',
			certs: [],
			assessment: 'IN PROGRESS',
			assessVariant: 'cyan',
			lastReview: '—',
			status: 'NEVER',
			statusVariant: 'default'
		},
		{
			name: 'Amazon Web Services',
			owner: 'platform@armornet.io',
			criticality: 'CRITICAL',
			critVariant: 'critical',
			data: 'confidential, pii',
			certs: ['FedRAMP', 'SOC 2'],
			assessment: 'IN PROGRESS',
			assessVariant: 'cyan',
			lastReview: '2026-01-13',
			status: 'DUE SOON',
			statusVariant: 'warn'
		},
		{
			name: 'Okta',
			owner: 'security@armornet.io',
			criticality: 'CRITICAL',
			critVariant: 'critical',
			data: 'pii, confidential',
			certs: ['SOC 2'],
			assessment: 'NOT STARTED',
			assessVariant: 'default',
			lastReview: '2026-01-13',
			status: 'CURRENT',
			statusVariant: 'success'
		},
		{
			name: 'Slack',
			owner: 'it@armornet.io',
			criticality: 'MEDIUM',
			critVariant: 'cyan',
			data: 'internal, confidential',
			certs: ['SOC 2'],
			assessment: 'NOT STARTED',
			assessVariant: 'default',
			lastReview: '—',
			status: 'NEVER',
			statusVariant: 'default'
		},
		{
			name: 'Stripe',
			owner: 'finance@armornet.io',
			criticality: 'HIGH',
			critVariant: 'warn',
			data: 'pci, pii',
			certs: ['PCI DSS', 'SOC 2'],
			assessment: 'NOT STARTED',
			assessVariant: 'default',
			lastReview: '2025-05-13',
			status: 'OVERDUE',
			statusVariant: 'error'
		}
	] as VendorRow[];

	const vendorColumns: TableColumn<VendorRow>[] = [
		{ key: 'name', header: 'Name', width: '160px' },
		{ key: 'owner', header: 'Owner' },
		{ key: 'criticality', header: 'Criticality', width: '100px' },
		{ key: 'data', header: 'Data' },
		{ key: 'certs', header: 'Certifications', width: '160px' },
		{ key: 'assessment', header: 'Assessment', width: '120px' },
		{ key: 'lastReview', header: 'Last Review', width: '110px' },
		{ key: 'status', header: 'Status', width: '100px' },
		{ key: '_actions', header: '', width: '80px', align: 'right' }
	];

	const kvRows: [string, string | number][] = [
		['Agent ID', 'agt-f8d3e9'],
		['Version', '0.9.14'],
		['Uptime', '3d 14h 22m'],
		['Region', 'us-east-1'],
		['Last seen', '2026-05-16 07:01:33']
	];

	const compareColumns: CompareColumn[] = [
		{ key: '_feature', header: 'Feature', width: '44%' },
		{ key: 'starter', header: 'Starter', color: 'blue', width: '18%' },
		{ key: 'team', header: 'Team', color: 'mint', width: '20%' },
		{ key: 'enterprise', header: 'Enterprise', color: 'emerald', width: '18%' }
	];

	const compareRows: CompareRow[] = [
		{ type: 'category', label: 'Agent Mesh' },
		{ type: 'feature', feature: 'Managed agents', values: { starter: { type: 'qual', text: '5' }, team: { type: 'qual', text: '25', strong: true }, enterprise: { type: 'qual', text: 'Unlimited', strong: true } } },
		{ type: 'feature', feature: 'Mesh topology view', values: { starter: { type: 'check', on: true }, team: { type: 'check', on: true }, enterprise: { type: 'check', on: true } } },
		{ type: 'feature', feature: 'Custom agent types', values: { starter: { type: 'check', on: false }, team: { type: 'check', on: true }, enterprise: { type: 'check', on: true } } },
		{ type: 'feature', feature: 'Agent Line lifecycle control', values: { starter: { type: 'check', on: false }, team: { type: 'check', on: false }, enterprise: { type: 'check', on: true } } },
		{ type: 'category', label: 'Vendor Risk' },
		{ type: 'feature', feature: 'Vendor profiles', values: { starter: { type: 'qual', text: '10' }, team: { type: 'qual', text: '100', strong: true }, enterprise: { type: 'qual', text: 'Unlimited', strong: true } } },
		{ type: 'feature', feature: 'Automated evidence collection', values: { starter: { type: 'check', on: false }, team: { type: 'check', on: true }, enterprise: { type: 'check', on: true } } },
		{ type: 'feature', feature: 'Custom questionnaires', values: { starter: { type: 'check', on: false }, team: { type: 'check', on: false }, enterprise: { type: 'check', on: true } } },
		{ type: 'category', label: 'Platform' },
		{ type: 'feature', feature: 'Signal retention', values: { starter: { type: 'qual', text: '14 days' }, team: { type: 'qual', text: '90 days', strong: true }, enterprise: { type: 'qual', text: '1 year', strong: true } } },
		{ type: 'feature', feature: 'SSO / SCIM', values: { starter: { type: 'check', on: false }, team: { type: 'check', on: false }, enterprise: { type: 'check', on: true } } },
		{ type: 'feature', feature: 'API access', values: { starter: { type: 'check', on: false }, team: { type: 'check', on: true }, enterprise: { type: 'check', on: true } } },
		{ type: 'feature', feature: 'Support', values: { starter: { type: 'qual', text: 'Community' }, team: { type: 'qual', text: 'Priority', strong: true }, enterprise: { type: 'qual', text: '24/7 + CSM', strong: true } } }
	];

	let dataTableVariant = $state<'table' | 'kv' | 'compare'>('table');

	const sheetColumns: TableColumn<VendorRow>[] = [
		{ key: 'name', header: 'Name', width: '160px' },
		{ key: 'owner', header: 'Owner' },
		{ key: 'criticality', header: 'Criticality', width: '110px' },
		{ key: 'lastReview', header: 'Last Review', width: '120px' }
	];

	let sheetOpen = $state(false);
	let sheetSize = $state<SheetDrawerSize>('xl');
	function openSheet(size: SheetDrawerSize) {
		sheetSize = size;
		sheetOpen = true;
	}

	const demoPeers = [
		{ name: 'RISK·AGENT', id: 'risk.agent.01', latency: '14ms', color: 'var(--palette-emerald-l, #34d399)' },
		{ name: 'INTEL·FEED', id: 'intel.feed.02', latency: '38ms', color: 'var(--palette-amber, #fcd34d)' },
		{ name: 'EDGE·RELAY', id: 'edge.relay.03', latency: '—', color: 'var(--palette-red, #fca5a5)' }
	];

	const demoCodeSample = `<!-- Region 2 · person scope. Pinned, so the count is always on screen. -->
{#snippet footer()}
	<a href={ROUTES.inbox}>Inbox <Badge count={unseenCount} /></a>
	<AccountMenu user={session.user} />
{/snippet}

const seen = localStorage.getItem('armornet:header-seen');
if (!seen) expanded = true;`;

	const demoAgentYaml = `# Agent configuration
id: risk.agent.01
type: core
mesh:
  enabled: true
  heartbeat_interval: 30
  peers:
    - intel.feed.02
    - edge.relay.03
telemetry:
  enabled: true
  endpoint: line.internal:4317`;

	const demoTimeline: TimelineEvent[] = [
		{ when: '2026-05-17 07:01', title: 'Agent connected', major: true },
		{ when: '2026-05-17 07:02', title: 'Heartbeat received', desc: 'Latency: 14ms' },
		{ when: '2026-05-17 07:08', title: 'Peer sync complete', desc: '3 peers acknowledged' },
		{ when: '2026-05-17 07:21', title: 'Policy update pushed', major: true, desc: 'rev 4 → rev 5' },
		{ when: '2026-05-17 07:45', title: 'Latency spike detected', desc: 'P95 exceeded 200ms' }
	];

	const demoFeed: TimelineEvent[] = [
		{
			when: '2h',
			icon: 'shield-alert',
			title: 'event-stream',
			subject: 'event-stream',
			qualifiers: ['malware', '9'],
			accent: 'flame',
			count: 12,
			tone: 'bad',
			major: true,
			href: '#'
		},
		{
			when: '4h',
			icon: 'shield-alert',
			title: '@babel/plugin-transform-runtime',
			subject: '@babel/plugin-transform-runtime',
			qualifiers: ['typosquat'],
			tone: 'bad',
			major: true,
			href: '#'
		},
		{
			when: '6h',
			icon: 'alert-triangle',
			title: 'armornet.io',
			subject: 'armornet.io',
			qualifiers: ['c2'],
			tone: 'warn',
			href: '#'
		},
		{
			when: '1h',
			icon: 'check-circle-2',
			title: 'Rockboy',
			subject: 'Rockboy',
			transition: { from: 'IN REVIEW', to: 'APPROVED', tone: 'ok' },
			tone: 'info',
			major: true,
			href: '#'
		},
		{
			when: '1d',
			icon: 'x-circle',
			title: 'Northwind',
			subject: 'Northwind',
			transition: { from: 'IN REVIEW', to: 'REJECTED', tone: 'bad' },
			tone: 'info',
			major: true,
			href: '#'
		},
		{
			when: '11d',
			icon: 'mesh',
			title: 'prod-host-14',
			subject: 'prod-host-14',
			qualifiers: ['DNS Proxy'],
			tone: 'ok',
			href: '#'
		},
		{
			when: '6d',
			icon: 'message-square',
			title: 'Rockboy',
			subject: 'Rockboy',
			count: 5,
			tone: 'info',
			href: '#'
		}
	];
</script>

<svelte:head>
	<title>Display — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<!-- PanelLoading -->
	<ShowcaseBlock component="PanelLoading">
		<h3 class="component-name">PanelLoading</h3>
		<p class="component-desc">Full-area loading skeleton for content panels awaiting data. Use when the entire panel body is pending. For scanning states within an already-visible panel, use <code class="demo-code">ProgressBar</code> with <code class="demo-code">indeterminate</code> instead.</p>
		<div class="demo-row">
			<span class="demo-label">default (h-32)</span>
			<div class="demo-items demo-items--wide demo-border">
				<PanelLoading />
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">custom message</span>
			<div class="demo-items demo-items--wide demo-border">
				<PanelLoading message="FETCHING AGENTS…" class="h-20" />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- DataTable -->
	<ShowcaseBlock component="DataTable">
		<h3 class="component-name">DataTable</h3>
		<p class="component-desc">Three variants in one: <code class="demo-code">table</code> (columnar with typed columns and custom cell Snippets), <code class="demo-code">kv</code> (key–value metadata display), <code class="demo-code">compare</code> (feature comparison matrix). Compose with <code class="demo-code">TableFoot</code> for pagination. For full control over raw markup, use <code class="demo-code">TableWrap</code> directly.</p>

		<div class="blade-ctrl">
			<div class="bc-group">
				<span class="bc-label">VARIANT</span>
				<div class="bc-btns">
					<button
						class="bc-btn"
						class:bc-active={dataTableVariant === 'table'}
						title="Table"
						onclick={() => (dataTableVariant = 'table')}
					><Icon name="table" size={13} /></button>
					<button
						class="bc-btn"
						class:bc-active={dataTableVariant === 'kv'}
						title="Key / Value"
						onclick={() => (dataTableVariant = 'kv')}
					><Icon name="clipboard-list" size={13} /></button>
					<button
						class="bc-btn"
						class:bc-active={dataTableVariant === 'compare'}
						title="Compare"
						onclick={() => (dataTableVariant = 'compare')}
					><Icon name="git-fork" size={13} /></button>
				</div>
			</div>
		</div>

		{#if dataTableVariant === 'table'}
			<p class="component-desc">
				Generic columnar table built on <code class="demo-code">TableWrap</code>. Columns accept
				custom cell Snippets; action columns are just a column with a Snippet and no
				<code class="demo-code">key</code> lookup.
			</p>
			<DataTable
				columns={vendorColumns}
				rows={vendorRows}
				onRowClick={(r) => console.log('open vendor', r.name)}
			>
				{#snippet cell(key, row)}
					{#if key === 'criticality'}
						<Chip color={row.critVariant}>{row.criticality}</Chip>
					{:else if key === 'certs'}
						<div style="display:flex;gap:4px;flex-wrap:wrap;">
							{#each row.certs as cert}
								<Chip color="accent">{cert}</Chip>
							{/each}
							{#if row.certs.length === 0}<span style="color:var(--fg-dim)">—</span>{/if}
						</div>
					{:else if key === 'assessment'}
						<Chip color={row.assessVariant}>{row.assessment}</Chip>
					{:else if key === 'status'}
						<Chip color={row.statusVariant}>{row.status}</Chip>
					{:else if key === '_actions'}
						<div style="display:flex;gap:4px;justify-content:flex-end;">
							<IconButton icon="shield" label="Assess {row.name}" />
							<IconButton icon="trash" variant="danger" label="Delete {row.name}" />
						</div>
					{:else}
						{String((row as Record<string, unknown>)[key] ?? '')}
					{/if}
				{/snippet}
				{#snippet footer()}
					<TableFoot
						meta="{vendorRows.length} / {vendorRows.length} RECORDS"
						onRefresh={() => console.log('refresh')}
					/>
				{/snippet}
			</DataTable>

		{:else if dataTableVariant === 'kv'}
			<div class="demo-row">
				<span class="demo-label">default</span>
				<div class="demo-items demo-items--wide">
					<DataTable variant="kv" kvTitle="Agent metadata" kvRows={kvRows} />
				</div>
			</div>
			<div class="demo-row">
				<span class="demo-label">narrow key col</span>
				<div class="demo-items demo-items--wide">
					<DataTable
						variant="kv"
						kvTitle="Connection"
						kvKeyWidth="100px"
						kvRows={[
							['Latency', '14ms'],
							['Protocol', 'WebSocket'],
							['TLS', '1.3']
						]}
					/>
				</div>
			</div>

		{:else}
			<p class="component-desc">
				Side-by-side feature comparison. <code class="demo-code">color</code> tints the header
				column; <code class="demo-code">type: 'check'</code> cells render check/dash glyphs,
				<code class="demo-code">type: 'qual'</code> renders mono text.
			</p>
			<DataTable
				variant="compare"
				compareColumns={compareColumns}
				compareRows={compareRows}
			/>
		{/if}
	</ShowcaseBlock>

	<!-- Ticker -->
	<ShowcaseBlock component="Ticker">
		<h3 class="component-name">Ticker</h3>
		<p class="component-desc">Seamlessly looping horizontal marquee for ambient signal display on landing pages or summary dashboards. Dot separators cycle through the four accent palette colors. Not for critical alerts — use <code class="demo-code">AlertBlade</code> instead.</p>
		<div class="demo-row">
			<span class="demo-label">default · bordered</span>
			<div class="demo-items demo-items--wide" style="padding: 0; overflow: hidden; border-radius: 4px;">
				<Ticker />
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">custom items · fast</span>
			<div class="demo-items demo-items--wide" style="padding: 0; overflow: hidden; border-radius: 4px;">
				<Ticker
					speed={18}
					items={[
						'ZERO-TRUST ARCHITECTURE',
						'ENDPOINT DETECTION',
						'SIEM INTEGRATION',
						'CLOUD SECURITY POSTURE',
						'CONTINUOUS MONITORING',
						'MFA ENFORCEMENT'
					]}
				/>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">no border · slow</span>
			<div class="demo-items demo-items--wide" style="padding: 0; overflow: hidden; border-radius: 4px;">
				<Ticker bordered={false} speed={45} />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Avatar -->
	<ShowcaseBlock component="Avatar">
		<h3 class="component-name">Avatar</h3>
		<p class="component-desc">User identity chip — 2–3 character initials in a mono-spaced, accent-bordered square. Scales uniformly with <code class="demo-code">size</code>. Composes into <code class="demo-code">PeerCard</code> and <code class="demo-code">Card type="profile"</code>. Use when you need an identity indicator without a full profile card.</p>
		<div class="demo-row">
			<span class="demo-label">sizes</span>
			<div class="demo-items" style="align-items:center;gap:12px;">
				<Avatar initials="AK" size={24} />
				<Avatar initials="SP" size={32} />
				<Avatar initials="MR" size={40} />
				<Avatar initials="JL" size={56} />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- StatTile -->
	<ShowcaseBlock component="StatTile">
		<h3 class="component-name">StatTile</h3>
		<p class="component-desc">Compact inline metric tile with corner-bracket decoration and an optional delta sub-label (<code class="demo-code">subVariant: up/down/neutral</code>). Use inside dashboard stat rows where space is tight. For standalone featured metrics with more visual weight, prefer <code class="demo-code">Card type="stat"</code>.</p>
		<div class="demo-row">
			<span class="demo-label">basic</span>
			<div class="demo-items" style="gap:24px;flex-wrap:wrap;">
				<StatTile label="Total Vendors" value="24" />
				<StatTile label="Compliant" value="19" sub="↑ 2 this week" subVariant="up" />
				<StatTile label="Overdue" value="3" sub="↑ 1 this week" subVariant="down" />
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">mono value</span>
			<div class="demo-items" style="gap:24px;flex-wrap:wrap;">
				<StatTile label="Agent ID" value="risk.01" mono />
				<StatTile label="Uptime" value="99.97%" mono sub="30-day avg" />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- CountUp -->
	<ShowcaseBlock component="CountUp">
		<h3 class="component-name">CountUp</h3>
		<p class="component-desc">Animates a number to its target with a <code class="demo-code">requestAnimationFrame</code> tween (easeOutQuint), reduced-motion aware (jumps to final under <code class="demo-code">prefers-reduced-motion</code>). Built for hero telemetry that "boots up" on load. Pair with a mono label for instrument readouts.</p>
		<div class="demo-row">
			<span class="demo-label">telemetry</span>
			<div class="demo-items" style="gap:48px;flex-wrap:wrap;align-items:baseline;">
				<span style="font-size:44px;font-weight:700;color:#fca5a5;font-family:var(--mono)"><CountUp value={37} /></span>
				<span style="font-size:24px;color:var(--fg);font-family:var(--mono)"><CountUp value={128000} /></span>
				<span style="font-size:24px;color:var(--accent);font-family:var(--mono)"><CountUp value={82} suffix="%" /></span>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- PostureVerdict -->
	<ShowcaseBlock component="PostureVerdict">
		<h3 class="component-name">PostureVerdict</h3>
		<p class="component-desc">The one-sentence security-posture line a dashboard leads with: a large headline metric (via <code class="demo-code">CountUp</code>), an auto-derived <code class="demo-code">Strong / Gaps / Exposed</code> chip, and hairline sub-clauses stating the "so what". Supports a first-run empty mode.</p>
		<div class="demo-row">
			<span class="demo-label">posture</span>
			<div class="demo-items" style="width:100%;">
				<PostureVerdict
					value={82}
					prefix="You have assurance on"
					suffix="of your critical third-party risk"
					clauses={[
						{ text: '4 critical vendors still unassessed — your biggest breach blind spots.', tone: 'bad' },
						{ text: '37 supply-chain attacks blocked in the last 24h.', tone: 'good' }
					]}
				/>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">first run</span>
			<div class="demo-items" style="width:100%;">
				<PostureVerdict empty emptySub="Add your vendors and deploy your first agent to see where a breach would hurt." />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- MeshMembrane -->
	<ShowcaseBlock component="MeshMembrane">
		<h3 class="component-name">MeshMembrane</h3>
		<p class="component-desc">Ambient, non-interactive "security frontier" canvas — untrusted registries → the mesh membrane (proxies + agents) → protected core — with a world→core boot cascade, energy-flow ignition after the nodes settle, periodic block-flares on block-policy proxies, and SEEN / BLOCKED / ALLOWED telemetry on the glass. No pan / zoom / select. Composes <code class="demo-code">Canvas</code> + <code class="demo-code">MeshStudio</code> + <code class="demo-code">CountUp</code>.</p>
		<div class="demo-row">
			<div class="demo-items" style="width:100%;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
				<MeshMembrane
					registries={demoMembrane.registries}
					proxies={demoMembrane.proxies}
					agents={demoMembrane.agents}
					seen={128000}
					blocked={37}
					allowed={127951}
					coreValue="40"
					height="360px"
				/>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Sparkline -->
	<ShowcaseBlock component="Sparkline">
		<h3 class="component-name">Sparkline</h3>
		<p class="component-desc">Minimal SVG line+area chart for embedding inside <code class="demo-code">StatTile</code> or table cells. Color follows <code class="demo-code">var(--accent)</code> by default; override with any CSS color. For labeled, titled metric panels use <code class="demo-code">Chart</code>.</p>
		<div class="demo-row">
			<span class="demo-label">variants</span>
			<div class="demo-items" style="gap:20px;flex-wrap:wrap;align-items:center;">
				<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:120px;">
					<Sparkline data={chartData} height={40} />
					<span style="font-family:var(--mono);font-size:9px;color:var(--fg-dim)">accent · 120×40</span>
				</div>
				<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:120px;">
					<Sparkline data={chartData2} height={40} color="var(--palette-red, #fca5a5)" />
					<span style="font-family:var(--mono);font-size:9px;color:var(--fg-dim)">red · declining</span>
				</div>
				<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:80px;">
					<Sparkline data={[40, 42, 41, 43, 42, 44, 43]} height={28} color="var(--palette-emerald-l, #34d399)" />
					<span style="font-family:var(--mono);font-size:9px;color:var(--fg-dim)">emerald · compact</span>
				</div>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- PeerCard -->
	<ShowcaseBlock component="PeerCard">
		<h3 class="component-name">PeerCard</h3>
		<p class="component-desc">Mesh peer list row with a glowing status dot, name, node ID, and latency reading. Use inside the <code class="demo-code">peers</code> slot of <code class="demo-code">NodeDrawer</code> to show connected neighbors. Color is freeform — pass a CSS palette variable to match node state.</p>
		<div class="demo-row">
			<span class="demo-label">peers</span>
			<div class="demo-items demo-items--wide" style="display:flex;flex-direction:column;gap:6px;width:100%;max-width:380px;">
				{#each demoPeers as peer}
					<PeerCard name={peer.name} id={peer.id} latency={peer.latency} color={peer.color} />
				{/each}
			</div>
		</div>
	</ShowcaseBlock>

	<!-- CodeBlock -->
	<ShowcaseBlock component="CodeBlock">
		<h3 class="component-name">CodeBlock</h3>
		<p class="component-desc">Source-code highlighter for Svelte markup and TypeScript — components are cyan, elements blue, strings emerald, <code class="demo-code">{'{#block}'}</code> tags amber, comments dimmed. Dependency-free, same single-pass approach as <code class="demo-code">ConfigBlock</code>. Use for code samples in docs and pattern pages; use <code class="demo-code">ConfigBlock</code> for YAML values and <code class="demo-code">TerminalBlock</code> for terminal sessions or plain output. <code class="demo-code">dedent</code> is on by default so samples can stay indented at their authoring site.</p>
		<div class="demo-row">
			<span class="demo-label">svelte sample</span>
			<div class="demo-items demo-items--wide">
				<CodeBlock title="example" code={demoCodeSample} />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- ConfigBlock -->
	<ShowcaseBlock component="ConfigBlock">
		<h3 class="component-name">ConfigBlock</h3>
		<p class="component-desc">YAML syntax highlighter with semantic coloring: keys are accent-colored, strings are emerald, numbers are amber, booleans are blue, comments are dimmed. Use in agent config detail panels and the <code class="demo-code">config</code> tab of <code class="demo-code">NodeDrawer</code>. Pass <code class="demo-code">accentColor</code> to match the current theme variant.</p>
		<div class="demo-row">
			<span class="demo-label">agent config</span>
			<div class="demo-items demo-items--wide">
				<ConfigBlock yaml={demoAgentYaml} />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- ConsensusBar -->
	<ShowcaseBlock component="ConsensusBar">
		<h3 class="component-name">ConsensusBar</h3>
		<p class="component-desc">Multi-agent voting progress bar — shows the percentage of agents that voted YES on a policy decision or assessment trigger. Fixed emerald fill signals agreement. This is not a general-purpose progress bar; for that use <code class="demo-code">ProgressBar</code>.</p>
		<div class="demo-row">
			<span class="demo-label">agreement levels</span>
			<div class="demo-items demo-items--wide" style="display:flex;flex-direction:column;gap:16px;width:100%;max-width:400px;">
				<ConsensusBar pct={100} label="Policy: deny-egress-unknown" />
				<ConsensusBar pct={75} label="Assessment: risk.agent.01" />
				<ConsensusBar pct={40} label="Trigger: quarantine-clf.03" />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- LogRow -->
	<ShowcaseBlock component="LogRow">
		<h3 class="component-name">LogRow</h3>
		<p class="component-desc">Single log line in a fixed 3-column grid (timestamp · level badge · message). Stack rows inside a <code class="demo-code">TableWrap</code> or <code class="demo-code">Panel</code> for a live log panel. Use inside the <code class="demo-code">logs</code> slot of <code class="demo-code">NodeDrawer</code>.</p>
		<div class="demo-row">
			<span class="demo-label">all levels</span>
			<div class="demo-items demo-items--wide" style="display:flex;flex-direction:column;width:100%;">
				<LogRow ts="07:01:33" level="ok" message="Agent connected · policy.engine.01" />
				<LogRow ts="07:02:01" level="info" message="Heartbeat received · latency 14ms" />
				<LogRow ts="07:08:44" level="warn" message="intel.feed.02 reporting elevated latency (P95 > 200ms)" />
				<LogRow ts="07:21:15" level="err" message="edge.relay.03 connection lost · retrying in 30s" />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- CollapsibleStack -->
	<ShowcaseBlock component="CollapsibleStack">
		<h3 class="component-name">CollapsibleStack</h3>
		<p class="component-desc">
			A worklist whose rows open in place. Not <code class="demo-code">Collapsible</code> (one
			generic disclosure) and not <code class="demo-code">FaqAccordion</code> (prose): this is a
			queue you work down. <strong>Every row is one line high</strong> — rows that wrap cannot be
			scanned, and anything that would have been a second line becomes a glyph with a tooltip or
			moves into the expansion. The <em>stack</em> owns which row is open, because “one at a time”
			is a property of the list, not of any row in it; pass
			<code class="demo-code">single=&#123;false&#125;</code> for a classic multi-open accordion.
			<code class="demo-code">meta</code> renders outside the row button, so a trailing mark can be
			a link. Expanding plays the theme’s selection flourish, reversed on collapse.
		</p>
		<div class="demo-row">
			<span class="demo-label">stack</span>
			<div class="demo-items" style="padding: 8px 0; width: 100%; max-width: 560px;">
				<CollapsibleStack>
					<CollapsibleStackRow
						key="a"
						size="md"
						glyph="shield-alert"
						glyphColor="#FB7185"
						glyphLabel="Critical"
						accent="#FB7185"
						trailing="46d"
					>
						{#snippet label()}No deletion schedule for event streams containing PII{/snippet}
						{#snippet meta()}
							<span class="flex shrink-0 text-[var(--fg-dim)]"><Icon name="message-square" size={12} /></span>
							<span class="flex shrink-0" style="color:#FB7185"><Icon name="flag" size={12} /></span>
						{/snippet}
						<p class="m-0 text-[0.82rem] text-[var(--fg-muted)]">
							Answered “no”; the scale needs “yes”. The accent edge is reserved for rows worse than
							their neighbours — an edge on every row is a border, not a signal.
						</p>
					</CollapsibleStackRow>
					<CollapsibleStackRow
						key="b"
						size="md"
						glyph="alert-triangle"
						glyphColor="#FBBF24"
						glyphLabel="Warning"
						trailing="52d"
					>
						{#snippet label()}Revocation SLA is 5 business days, not 24 hours{/snippet}
						<p class="m-0 text-[0.82rem] text-[var(--fg-muted)]">
							No accent, so this row shows the hover/open edge instead.
						</p>
					</CollapsibleStackRow>
					<CollapsibleStackRow key="c" size="md" glyph="package" glyphLabel="Scan" trailing="17d">
						{#snippet label()}northwind/ingest-sdk{/snippet}
						<p class="m-0 text-[0.82rem] text-[var(--fg-muted)]">
							Opening this one closes whichever was open — that is the stack's job.
						</p>
					</CollapsibleStackRow>
				</CollapsibleStack>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Timeline -->
	<ShowcaseBlock component="Timeline">
		<h3 class="component-name">Timeline</h3>
		<p class="component-desc">Vertical event log, in two densities. <code class="demo-code">rail</code> (default) is the connector-rail history — <code class="demo-code">major: true</code> events get a glowing dot for significant state changes. <code class="demo-code">feed</code> is a kill feed: ⟨<code class="demo-code">icon</code>⟩ <code class="demo-code">subject</code> · <code class="demo-code">qualifiers</code> ×<code class="demo-code">count</code>, age right-aligned. The icon IS the verb — never spell it out in the text. Every row is the same height; a <code class="demo-code">transition</code> rides the same line with the destination loudest, tinted by <code class="demo-code">transition.tone</code>, which also overrides the row tone: a state change means what it moved <em>to</em>. Hostile subjects (<code class="demo-code">tone: bad|warn</code>) wear the tone; friendly ones stay neutral.</p>
		<div class="demo-row">
			<span class="demo-label">rail</span>
			<div class="demo-items" style="padding: 8px 0;">
				<Timeline events={demoTimeline} />
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">feed</span>
			<div class="demo-items" style="padding: 8px 0; max-width: 300px;">
				<Timeline events={demoFeed} variant="feed" />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- SheetDrawer -->
	<ShowcaseBlock component="SheetDrawer">
		<h3 class="component-name">SheetDrawer</h3>
		<p class="component-desc">The content-agnostic right-hand sheet — same scrim, slide-in and Esc / scrim dismissal as <code class="demo-code">IncidentDrawer</code>, but you own the body. Reach for it when a surface needs a <em>working</em> panel (a register, a queue, a form) instead of a centred <code class="demo-code">Modal</code>. The header is pinned; <code class="demo-code">body="scroll"</code> scrolls the sheet, <code class="demo-code">body="fill"</code> hands the scroll to the child so a table keeps its sticky head. <code class="demo-code">flush</code> drops the gutter for content that <em>is</em> the sheet — don't nest it in a card, the sheet is already the container. Flush content can paint sticky chrome with <code class="demo-code">var(--sheet-surface)</code>. <code class="demo-code">actions</code> docks controls in the header rail; <code class="demo-code">footer</code> pins under the body. Widths: <code class="demo-code">sm</code> 440 · <code class="demo-code">md</code> 640 · <code class="demo-code">lg</code> 900 · <code class="demo-code">xl</code> 1200, all capped at 96vw.</p>
		<div class="demo-row">
			<span class="demo-label">size</span>
			<div class="demo-items">
				{#each ['sm', 'md', 'lg', 'xl'] as const as s (s)}
					<button class="bc-btn" style="width:auto;padding:0 10px;" onclick={() => openSheet(s)}>{s}</button>
				{/each}
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Table furniture — the three pieces that surround a DataTable -->
	<ShowcaseBlock component="FilterToolbar">
		<h3 class="component-name">FilterToolbar</h3>
		<p class="component-desc">
			The strip above a table: search, host-supplied filter controls, a result count and a reset
			that only appears once something is filtering. <code class="demo-code">activeFilters</code> is
			the count the reset badge shows — the toolbar does not inspect the controls you pass it, so
			the host owns that number.
		</p>
		<div class="table-demo">
			<FilterToolbar
				bind:value={tableSearch}
				placeholder="Search agents…"
				resultCount={filteredAgents.length}
				noun="agent"
				activeFilters={agentMode === 'all' ? 0 : 1}
				onreset={resetTableFilters}
			>
				{#snippet filters()}
					<Select
						bind:value={agentMode}
						options={[
							{ value: 'all', label: 'Any mode' },
							{ value: 'enforce', label: 'Enforce' },
							{ value: 'observe', label: 'Observe' }
						]}
					/>
				{/snippet}
			</FilterToolbar>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="BulkActionBar">
		<h3 class="component-name">BulkActionBar</h3>
		<p class="component-desc">
			Appears once rows are selected. Light actions sit inline; heavy or destructive ones go behind
			the overflow, where <code class="demo-code">danger</code> is honoured — an inline red button
			is one mis-click, a menu is two.
		</p>
		<div class="demo-row">
			<span class="demo-label">selected</span>
			<div class="demo-items">
				{#each [0, 1, 12] as n (n)}
					<button class="bc-btn" style="width:auto;padding:0 10px;" onclick={() => (bulkCount = n)}>
						{n}
					</button>
				{/each}
			</div>
		</div>
		<div class="table-demo">
			{#if bulkCount > 0}
				<BulkActionBar
					count={bulkCount}
					actions={[
						{ label: 'Export', icon: 'download', onclick: () => {} },
						{ label: 'Tag', icon: 'flag', onclick: () => {} }
					]}
					moreActions={[
						{ label: 'Move to org…', icon: 'layers', onclick: () => {} },
						{ label: 'Decommission', icon: 'trash-2', onclick: () => {}, danger: true }
					]}
					ondeselect={() => (bulkCount = 0)}
				/>
			{:else}
				<p class="empty-hint">Nothing selected — the bar is absent, not disabled.</p>
			{/if}
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="TablePager">
		<h3 class="component-name">TablePager</h3>
		<p class="component-desc">
			Page control for a table, bound to the page number. Shown at three sizes because the only
			interesting cases are the ones where it changes shape: a single page, a handful, and enough
			that it has to elide.
		</p>
		<div class="table-demo pager-stack">
			<TablePager bind:page={pagerA} pageSize={25} total={18} noun="agent" />
			<TablePager bind:page={pagerB} pageSize={25} total={140} noun="agent" />
			<TablePager bind:page={pagerC} pageSize={25} total={48210} noun="interception" />
		</div>
	</ShowcaseBlock>
</div>

<SheetDrawer
	open={sheetOpen}
	title="Vendor inventory"
	eyebrow="register · 3 vendors"
	size={sheetSize}
	onclose={() => (sheetOpen = false)}
>
	{#snippet actions()}
		<IconButton icon="refresh-cw" label="Refresh" onclick={() => {}} />
		<IconButton icon="plus" label="New" onclick={() => {}} />
	{/snippet}
	<DataTable columns={sheetColumns} rows={vendorRows}>
		{#snippet cell(key, row)}
			{#if key === 'criticality'}
				<Chip color={row.critVariant}>{row.criticality}</Chip>
			{:else}
				{String((row as Record<string, unknown>)[key] ?? '')}
			{/if}
		{/snippet}
	</DataTable>
	{#snippet footer()}
		<span class="demo-label">Esc or the scrim closes the sheet.</span>
	{/snippet}
</SheetDrawer>

<style>
	.demo-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		min-height: 2rem;
	}

	.demo-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		min-width: 88px;
		flex-shrink: 0;
	}

	.demo-items {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.demo-items--wide {
		flex: 1;
		min-width: 0;
	}

	.demo-border {
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}

	.demo-code {
		font-family: var(--mono);
		font-size: 0.78em;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		color: var(--fg-muted);
	}

	.blade-ctrl {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}
	.bc-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bc-label {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.2em;
		color: var(--fg-muted, rgba(156, 163, 175, 0.45));
	}
	.bc-btns {
		display: flex;
		gap: 4px;
	}
	.bc-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 2px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.bc-btn:hover {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: rgba(94, 234, 212, 0.06);
	}
	.bc-btn.bc-active {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.5);
		background: rgba(94, 234, 212, 0.1);
	}
	.table-demo {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		padding: 0.65rem;
	}
	.pager-stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.empty-hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--fg-dim);
	}
</style>
