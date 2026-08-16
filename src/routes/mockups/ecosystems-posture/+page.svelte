<script lang="ts">
	// ── Mockup: Vendors › Package Ecosystems tab — BLAST-RADIUS REDESIGN ──────
	//
	// A distinct identity from the two posture-scorecard tabs. Where Overview /
	// Vendor-Risk are "how assured are we" scorecards, this tab is a threat-
	// hunter's INTERCEPTION surface: the centrepiece is the blast-radius map —
	// every blocked package plotted by threat score × agents exposed — feeding
	// a click-through incident drawer. It answers "what got stopped, how bad,
	// and who was in the blast radius" — a question no other tab asks.
	//
	// Spine (deliberately NOT the Overview's verdict→pillars→mesh clone):
	//   instrument strip  →  BLAST-RADIUS MAP + triage queue (side by side)
	//   →  attack concentration (eco×threat heatmap + category donut)
	//   →  compact registry-coverage footer  →  incident drawer (on click).
	//
	// Keyboard path: the scatter isn't focusable, so the triage queue is the
	// accessible mirror — every incident is a real <button>, Esc closes the
	// drawer. Map and queue open the same drawer.
	//
	// The `mode` toggle flips busy ↔ quiet/first-run to show graceful degrade.
	//
	// Data shapes (exact fields from app-ui/src/lib/types/proxy.ts):
	//   BlockEvent  { ecosystem, package, version, threat_type, threat_score,
	//                 cve, description, recommendation, affected_agents[],
	//                 first_seen, last_seen, count }
	//   ProxyConfig { kind, enabled, scan_policy, active_agent_count, target_replicas }
	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';
	import Panel from '$lib/layout/Panel.svelte';
	import Chart from '$lib/chart/Chart.svelte';
	import DonutChart from '$lib/chart/DonutChart.svelte';
	import EmptyState from '$lib/primitives/EmptyState.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import StatusDot from '$lib/primitives/StatusDot.svelte';
	import ActionsMenu from '$lib/primitives/ActionsMenu.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { ChartConfig } from '$lib/chart/chart.types.js';
	import type { DonutSlice } from '$lib/chart/DonutChart.svelte';
	import type { ActionMenuItem } from '$lib/primitives/ActionsMenu.svelte';

	// ── Mockup state switch ───────────────────────────────────────────────────
	let mode = $state<'busy' | 'quiet'>('busy');

	const ECO_COLOR: Record<string, string> = {
		npm: '#FB923C',
		pip: '#38BDF8',
		go: '#5FEAD5',
		docker: '#60A5FA',
		git: '#A78BFA'
	};
	const THREAT_COLORS: Record<string, string> = {
		malware: '#fca5a5',
		dependency_confusion: '#fb923c',
		typosquat: '#fcd34d',
		protestware: '#94a3b8',
		backdoor: '#c084fc'
	};

	// ── Proxy configs (two npm — dedupe proves the roster rollup) ─────────────
	type Proxy = { kind: string; enabled: boolean; scan_policy: 'block' | 'warn' | 'log'; active_agent_count: number; target_replicas: number };
	const proxiesBusy: Proxy[] = [
		{ kind: 'npm', enabled: true, scan_policy: 'block', active_agent_count: 22, target_replicas: 24 },
		{ kind: 'npm', enabled: true, scan_policy: 'warn', active_agent_count: 6, target_replicas: 6 },
		{ kind: 'pip', enabled: true, scan_policy: 'block', active_agent_count: 18, target_replicas: 20 },
		{ kind: 'go', enabled: true, scan_policy: 'block', active_agent_count: 14, target_replicas: 14 },
		{ kind: 'docker', enabled: true, scan_policy: 'warn', active_agent_count: 9, target_replicas: 16 },
		{ kind: 'git', enabled: false, scan_policy: 'log', active_agent_count: 0, target_replicas: 8 }
	];
	const proxiesQuiet: Proxy[] = [
		{ kind: 'npm', enabled: true, scan_policy: 'block', active_agent_count: 1, target_replicas: 6 },
		{ kind: 'npm', enabled: true, scan_policy: 'block', active_agent_count: 0, target_replicas: 6 }
	];
	const proxies = $derived(mode === 'busy' ? proxiesBusy : proxiesQuiet);

	// ── Block events — the star data (quiet org → none) ────────────────────────
	type Incident = {
		id: string;
		ecosystem: string;
		package: string;
		version: string;
		threat_type: string;
		threat_score: number;
		cve?: string;
		description: string;
		recommendation: string;
		agents: string[];
		first_seen: string;
		last_seen: string;
		count: number;
		action: 'blocked' | 'warned';
		rule: string;
	};
	const agentPool = ['agent-7f3a', 'agent-19bd', 'agent-c204', 'agent-a8e1', 'agent-4d90', 'agent-6b7c', 'agent-e512', 'agent-2fa0'];
	const ag = (n: number, off = 0) => agentPool.slice(off, off + n);
	const incidentsBusy: Incident[] = [
		{
			id: 'i1', ecosystem: 'pip', package: 'requestz', version: '2.31.0', threat_type: 'malware', threat_score: 9.4,
			cve: 'CVE-2024-99821', description: 'Typosquat of `requests` shipping an obfuscated post-install payload that exfiltrates environment variables to a hardcoded C2 host.',
			recommendation: 'Purge from all caches, rotate any credentials the affected agents had in-env, and add a package-name allowlist rule for `requests`.',
			agents: ag(6), first_seen: '4h ago', last_seen: '38m ago', count: 2, action: 'blocked', rule: 'threat-feed · malware'
		},
		{
			id: 'i2', ecosystem: 'npm', package: '@corp/internal-ui', version: '9.9.9', threat_type: 'dependency_confusion', threat_score: 8.8,
			cve: undefined, description: 'A public package impersonating your private `@corp` scope with an inflated version to win resolution — classic dependency-confusion substitution.',
			recommendation: 'Pin the internal registry for the `@corp/*` scope and keep the block. Verify no build pulled 9.9.9 before the interception.',
			agents: ag(3, 2), first_seen: '6h ago', last_seen: '6h ago', count: 1, action: 'blocked', rule: 'scope-guard · @corp/*'
		},
		{
			id: 'i3', ecosystem: 'pip', package: 'colorama-pro', version: '0.4.6', threat_type: 'backdoor', threat_score: 9.1,
			cve: 'CVE-2024-41010', description: 'Brand-jacking of `colorama` with a backdoor that opens a reverse shell when an interactive TTY is detected.',
			recommendation: 'Block and report to PyPI. Scan the two affected agents for persistence artifacts.',
			agents: ag(2, 4), first_seen: '14h ago', last_seen: '13h ago', count: 1, action: 'blocked', rule: 'threat-feed · backdoor'
		},
		{
			id: 'i4', ecosystem: 'npm', package: 'event-strem', version: '3.3.6', threat_type: 'typosquat', threat_score: 8.1,
			cve: undefined, description: 'One-character typosquat of the popular `event-stream` package. Known credential-stealer lineage.',
			recommendation: 'Keep blocked; add an edit-distance rule around your top 100 npm dependencies to catch siblings.',
			agents: ag(2, 1), first_seen: '2h ago', last_seen: '2h ago', count: 1, action: 'blocked', rule: 'typosquat · edit-distance'
		},
		{
			id: 'i5', ecosystem: 'npm', package: 'colours.js', version: '1.4.1', threat_type: 'protestware', threat_score: 6.2,
			cve: undefined, description: 'Sabotaged build that prints a protest banner and enters an infinite loop on non-allowlisted locales. Availability risk, not exfiltration.',
			recommendation: 'Warned rather than blocked — pin to the last-known-good 1.4.0 and review before upgrading.',
			agents: ag(4, 3), first_seen: '18m ago', last_seen: '11m ago', count: 3, action: 'warned', rule: 'threat-feed · protestware'
		},
		{
			id: 'i6', ecosystem: 'docker', package: 'nginx-unprivil3ged', version: 'latest', threat_type: 'typosquat', threat_score: 5.4,
			cve: undefined, description: 'Registry typosquat of `nginx-unprivileged` bundling a crypto-miner in an extra layer.',
			recommendation: 'Warned on a soft (warn) proxy — promote docker to block policy to auto-stop the next one.',
			agents: ag(1, 6), first_seen: '9h ago', last_seen: '9h ago', count: 1, action: 'warned', rule: 'threat-feed · typosquat'
		}
	];
	const incidents = $derived<Incident[]>(mode === 'busy' ? incidentsBusy : []);

	// ═══ ECO ROSTER ROLLUP (fixes the duplicate-kind rows) ════════════════════
	type EcoRow = { kind: string; configs: number; enabled: boolean; policy: 'block' | 'warn' | 'log'; enrolled: number; total: number };
	const roster = $derived.by<EcoRow[]>(() => {
		const rank: Record<string, number> = { block: 2, warn: 1, log: 0 };
		const byKind = new Map<string, EcoRow>();
		for (const p of proxies) {
			const r = byKind.get(p.kind);
			if (!r) byKind.set(p.kind, { kind: p.kind, configs: 1, enabled: p.enabled, policy: p.scan_policy, enrolled: p.active_agent_count, total: p.target_replicas });
			else {
				r.configs++; r.enabled ||= p.enabled; r.enrolled += p.active_agent_count; r.total += p.target_replicas;
				if ((rank[p.scan_policy] ?? 0) > (rank[r.policy] ?? 0)) r.policy = p.scan_policy;
			}
		}
		return [...byKind.values()];
	});

	// ── Instrument-strip aggregates ────────────────────────────────────────────
	const stats = $derived.by(() => {
		const exposed = new Set<string>();
		let critical = 0, pulls = 0;
		for (const i of incidents) {
			i.agents.forEach((a) => exposed.add(a));
			if (i.threat_score >= 7.5) critical++;
			pulls += i.count;
		}
		const scanned = roster.filter((r) => r.enabled).length;
		const worst = [...incidents].sort((a, b) => b.threat_score - a.threat_score)[0];
		return { intercepted: incidents.length, pulls, exposed: exposed.size, critical, scanned, blindSpots: 5 - scanned, worst };
	});

	const sev = (s: number) => (s >= 8 ? 'crit' : s >= 6 ? 'high' : 'med');
	const sevColor = (s: number) => (s >= 8 ? '#fca5a5' : s >= 6 ? '#fb923c' : '#fcd34d');

	// ═══ TRIAGE ═══════════════════════════════════════════════════════════════
	// The proxy already auto-blocked/warned — triage is the human decision +
	// hand-off layer on top. Two axes: a disposition status, and a route to
	// wherever the team works (Linear / GitHub / Slack), plus one Armornet-native
	// action: turn the detection into a durable policy rule. All simulated here.
	type Status = 'open' | 'ack' | 'resolved' | 'dismissed';
	const STATUS_STEPS: Status[] = ['open', 'ack', 'resolved'];
	const STATUS_LABEL: Record<Status, string> = { open: 'Open', ack: 'Acked', resolved: 'Resolved', dismissed: 'Dismissed' };
	const STATUS_COLOR: Record<Status, string> = { open: 'var(--fg-muted)', ack: '#5eead4', resolved: '#34d399', dismissed: 'var(--fg-dim)' };
	const DESTS = [
		{ id: 'linear', label: 'Linear', icon: 'layout-grid' as const },
		{ id: 'github', label: 'GitHub Issue', icon: 'git-branch' as const },
		{ id: 'slack', label: 'Slack · #supply-chain', icon: 'message-square' as const }
	];
	const DEST_LABEL: Record<string, string> = { linear: 'Linear', github: 'GitHub', slack: 'Slack' };

	let statusMap = $state<Record<string, Status>>({});
	let linkMap = $state<Record<string, { dest: string; ref: string }>>({});
	let ruleMap = $state<Record<string, boolean>>({});
	let queueFilter = $state<'all' | 'open'>('all');

	const statusOf = (id: string): Status => statusMap[id] ?? 'open';
	const isActive = (id: string) => statusOf(id) === 'open' || statusOf(id) === 'ack';
	function setStatus(id: string, s: Status) {
		statusMap = { ...statusMap, [id]: statusOf(id) === s ? 'open' : s };
	}
	function sendTo(id: string, destId: string) {
		const idx = incidents.findIndex((i) => i.id === id);
		const ref = destId === 'linear' ? `LIN-${482 + idx}` : destId === 'github' ? `#${1240 + idx}` : '#supply-chain';
		linkMap = { ...linkMap, [id]: { dest: destId, ref } };
		if (statusOf(id) === 'open') statusMap = { ...statusMap, [id]: 'ack' };
	}
	function createRule(id: string) {
		ruleMap = { ...ruleMap, [id]: true };
	}
	const sendItems = (id: string): ActionMenuItem[] => [
		{ kind: 'header', label: 'Hand off to' },
		...DESTS.map((d) => ({ label: d.label, icon: d.icon, onclick: () => sendTo(id, d.id) }))
	];

	// ── Triage queue: active first, ranked by exposure = score × agents ───────
	const exposure = (i: Incident) => i.threat_score * i.agents.length;
	const openCount = $derived(incidents.filter((i) => isActive(i.id)).length);
	const triage = $derived(
		[...incidents]
			.filter((i) => (queueFilter === 'open' ? isActive(i.id) : true))
			.sort((a, b) => Number(isActive(b.id)) - Number(isActive(a.id)) || exposure(b) - exposure(a))
	);

	// ── BLAST-RADIUS MAP config ────────────────────────────────────────────────
	const blastChart = $derived<ChartConfig>({
		type: 'scatter',
		series: [
			{
				id: 'incidents',
				label: 'Interceptions',
				pointColor: (pt) => THREAT_COLORS[(pt.meta?.threat as string) ?? ''] ?? 'var(--fg-dim)',
				points: incidents.map((i) => ({
					x: i.threat_score,
					y: i.agents.length,
					r: 7 + i.count * 4,
					label: i.package,
					meta: { id: i.id, threat: i.threat_type, eco: i.ecosystem, count: i.count }
				}))
			}
		],
		xAxis: { type: 'linear', domain: [0, 10], label: 'Threat score →', grid: true, ticks: [0, 2, 4, 6, 8, 10], format: (v) => `${v}` },
		yAxis: { type: 'linear', domain: [0, 8], label: 'Agents exposed', grid: true },
		legend: { position: 'none' },
		crosshair: false,
		padding: { top: 20, right: 28, bottom: 52, left: 56 },
		annotations: [
			{ type: 'line', axis: 'x', value: 7.5, color: '#fca5a5', label: 'Critical severity', dashArray: '4 3', opacity: 0.5 },
			{ type: 'line', axis: 'y', value: 3, color: 'var(--fg-dim)', label: 'Wide blast', dashArray: '2 4', opacity: 0.35 }
		],
		tooltip: { format: (_s, pt) => `${pt.label} (${pt.meta?.eco})  ·  score ${pt.x}  ·  ${pt.y} agents  ·  ×${pt.meta?.count}` }
	});

	// ── Attack concentration: eco × threat heatmap + category donut ────────────
	const ecoThreatHeatmap = $derived.by<ChartConfig>(() => {
		const ecos = roster.filter((r) => r.enabled).map((r) => r.kind);
		const types = [...new Set(incidents.map((i) => i.threat_type))];
		return {
			type: 'heatmap',
			series: ecos.map((eco) => ({
				id: eco,
				label: eco,
				points: types.map((t) => ({ x: t.replace(/_/g, ' '), y: incidents.filter((i) => i.ecosystem === eco && i.threat_type === t).reduce((s, i) => s + i.count, 0) }))
			})),
			xAxis: { type: 'band', label: 'Threat type' },
			colorScale: [ [0, '#0d1117'], [0.3, '#3b1219'], [0.65, '#7f1d1d'], [1, '#fca5a5'] ],
			legend: { position: 'right', layout: 'vertical' },
			padding: { top: 8, right: 72, bottom: 48, left: 24 }
		};
	});
	const threatSlices = $derived.by<DonutSlice[]>(() => {
		const c: Record<string, number> = {};
		for (const i of incidents) c[i.threat_type] = (c[i.threat_type] ?? 0) + i.count;
		return Object.entries(c).map(([t, v]) => ({ label: t.replace(/_/g, ' '), value: v, color: THREAT_COLORS[t] ?? 'var(--fg-dim)' }));
	});

	// ── Incident drawer ────────────────────────────────────────────────────────
	let openId = $state<string | null>(null);
	const active = $derived(incidents.find((i) => i.id === openId) ?? null);
	function open(id: string | undefined) {
		if (id) openId = id;
	}
	function close() {
		openId = null;
	}
</script>

<svelte:head><title>Mockup · Package Ecosystems (blast radius)</title></svelte:head>
<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') close();
	}}
/>

<LayoutHeader eyebrow="// vendor risk · exposure">
	{#snippet title()}Blast <span class="accent">radius.</span>{/snippet}
	{#snippet lede()}
		What got intercepted at the package frontier, how dangerous it was, and who was in the blast
		radius. Every dot is a stopped supply-chain attack — click to investigate.
	{/snippet}
	{#snippet eyebrowActions()}
		<div class="statebar">
			<button class="seg" class:seg--on={mode === 'busy'} onclick={() => (mode = 'busy')}>Busy org</button>
			<button class="seg" class:seg--on={mode === 'quiet'} onclick={() => (mode = 'quiet')}>Quiet / first-run</button>
		</div>
	{/snippet}
</LayoutHeader>

<div class="page">
	<!-- ═══ INSTRUMENT STRIP ═══ -->
	<div class="instrument">
		<div class="ins-cell">
			<span class="ins-v">{stats.intercepted}</span><span class="ins-l">intercepted · 24h</span>
		</div>
		<div class="ins-sep"></div>
		<div class="ins-cell">
			<span class="ins-v" class:bad={stats.critical > 0}>{stats.critical}</span><span class="ins-l">critical severity</span>
		</div>
		<div class="ins-sep"></div>
		<div class="ins-cell">
			<span class="ins-v" class:warn={stats.exposed > 0}>{stats.exposed}</span><span class="ins-l">agents exposed</span>
		</div>
		<div class="ins-sep"></div>
		<div class="ins-cell">
			<span class="ins-v">{stats.scanned}<span class="ins-sub">/5</span></span><span class="ins-l">registries guarded</span>
		</div>
		<div class="ins-sep"></div>
		<div class="ins-cell">
			<span class="ins-v" class:bad={stats.blindSpots > 0}>{stats.blindSpots}</span><span class="ins-l">blind spots</span>
		</div>
		{#if stats.worst}
			<div class="ins-worst">
				<span class="ins-worst-l">Top threat</span>
				<button class="ins-worst-b" onclick={() => open(stats.worst?.id)}>
					<span class="dot" style:background={sevColor(stats.worst.threat_score)}></span>
					<span class="ins-worst-pkg">{stats.worst.package}</span>
					<span class="ins-worst-s" style:color={sevColor(stats.worst.threat_score)}>{stats.worst.threat_score}</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- ═══ HERO: BLAST-RADIUS MAP + TRIAGE QUEUE ═══ -->
	<div class="hero">
		<Panel>
			{#snippet header()}
				<span class="p-label">Blast Radius</span>
				<span class="p-sub">threat score × agents exposed · bubble = times pulled · click a dot to investigate</span>
			{/snippet}
			{#if incidents.length === 0}
				<div class="map-empty">
					<EmptyState
						variant="card"
						message="No interceptions to plot"
						sub="The blast-radius map fills in as proxies stop malicious pulls. An empty map means clean traffic — armed proxies, nothing hostile in the last 24h."
					>
						{#snippet icon()}<Icon name="shield-check" size={28} strokeWidth={1.25} />{/snippet}
					</EmptyState>
				</div>
			{:else}
				<div class="map">
					<Chart config={blastChart} onPointClick={(_s, p) => open(p.meta?.id as string)} />
					<div class="quadrant-tag">▲ high severity · wide blast — triage first</div>
				</div>
				<div class="map-legend">
					{#each Object.entries(THREAT_COLORS) as [t, c]}
						{#if incidents.some((i) => i.threat_type === t)}
							<span class="lg"><span class="lg-dot" style:background={c}></span>{t.replace(/_/g, ' ')}</span>
						{/if}
					{/each}
				</div>
			{/if}
		</Panel>

		<Panel>
			{#snippet header()}
				<span class="p-label">Triage Queue</span>
				<span class="p-sub">{openCount} open · ranked by exposure</span>
				{#if incidents.length > 0}
					<div class="q-filter">
						<button class="qf" class:qf--on={queueFilter === 'all'} onclick={() => (queueFilter = 'all')}>All</button>
						<button class="qf" class:qf--on={queueFilter === 'open'} onclick={() => (queueFilter = 'open')}>Open</button>
					</div>
				{/if}
			{/snippet}
			{#if triage.length === 0}
				<EmptyState variant="inline" message="Queue clear" sub={incidents.length ? 'Nothing open — all interceptions triaged.' : 'No packages awaiting review.'} />
			{:else}
				<div class="queue">
					{#each triage as i, idx}
						{@const st = statusOf(i.id)}
						{@const link = linkMap[i.id]}
						<button class="q-row" class:q-open={openId === i.id} class:q-done={!isActive(i.id)} onclick={() => open(i.id)}>
							<span class="q-rank">{idx + 1}</span>
							<span class="q-sev" style:background={sevColor(i.threat_score)}></span>
							<span class="q-main">
								<span class="q-pkg">{i.package}<span class="q-ver">@{i.version}</span></span>
								<span class="q-meta">
									<span style:color={ECO_COLOR[i.ecosystem]}>{i.ecosystem}</span>
									· {i.threat_type.replace(/_/g, ' ')}
									{#if st !== 'open'}<span class="q-pill" style:color={STATUS_COLOR[st]} style:border-color={STATUS_COLOR[st]}>{STATUS_LABEL[st]}</span>{/if}
									{#if link}<span class="q-link">{DEST_LABEL[link.dest]} {link.ref}</span>{/if}
								</span>
							</span>
							<span class="q-nums">
								<span class="q-score" style:color={sevColor(i.threat_score)}>{i.threat_score}</span>
								<span class="q-agents">{i.agents.length} <Icon name="users" size={11} strokeWidth={1.75} /></span>
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</Panel>
	</div>

	<!-- ═══ ATTACK CONCENTRATION ═══ -->
	<div class="grid-2">
		<Panel>
			{#snippet header()}
				<span class="p-label">Where Attacks Concentrate</span>
				<span class="p-sub">interception count · registry × threat type</span>
			{/snippet}
			{#if incidents.length === 0}
				<EmptyState variant="card" message="No pattern yet" sub="The heatmap lights up as detections accumulate across registries." />
			{:else}
				<div class="chart-md"><Chart config={ecoThreatHeatmap} /></div>
			{/if}
		</Panel>
		<Panel allowOverflow>
			{#snippet header()}
				<span class="p-label">By Category</span>
				<span class="p-sub">blocked packages by threat type</span>
			{/snippet}
			{#if incidents.length === 0}
				<EmptyState variant="card" message="Nothing blocked yet" sub="Categories populate as interceptions roll in." />
			{:else}
				<DonutChart slices={threatSlices} centerLabel="Blocks" countLabel="Blocks" />
			{/if}
		</Panel>
	</div>

	<!-- ═══ REGISTRY-COVERAGE FOOTER (context, demoted) ═══ -->
	<Panel>
		{#snippet header()}
			<span class="p-label">Registry Coverage</span>
			<span class="p-sub">one chip per registry · proxy configs rolled up · most-restrictive policy wins</span>
		{/snippet}
		<div class="cov">
			{#each roster as r}
				<div class="cov-chip" class:cov-off={!r.enabled}>
					<div class="cov-top">
						<StatusDot status={r.enabled ? 'healthy' : 'offline'} glow={r.enabled} />
						<span class="cov-name" style:color={ECO_COLOR[r.kind]}>{r.kind}</span>
						{#if r.configs > 1}<span class="cov-x">×{r.configs}</span>{/if}
					</div>
					<div class="cov-bar">
						<div class="cov-fill" style:width="{r.total > 0 ? (r.enrolled / r.total) * 100 : 0}%" style:background={ECO_COLOR[r.kind]}></div>
					</div>
					<div class="cov-foot">
						<span class="cov-enr">{r.enrolled}/{r.total}</span>
						<span class="cov-pol" class:pol-block={r.policy === 'block'} class:pol-warn={r.policy === 'warn'} class:pol-log={r.policy === 'log'}>{r.policy}</span>
					</div>
				</div>
			{/each}
			{#each Array(Math.max(0, stats.blindSpots)) as _, i (i)}
				<div class="cov-chip cov-blind">
					<div class="cov-top"><span class="dot dot-blind"></span><span class="cov-name cov-name-blind">unscanned</span></div>
					<div class="cov-blind-msg">no proxy — open pull path</div>
				</div>
			{/each}
		</div>
	</Panel>
</div>

<!-- ═══ INCIDENT DRAWER ═══ -->
{#if active}
	{@const st = statusOf(active.id)}
	{@const link = linkMap[active.id]}
	<div class="scrim" onclick={close} role="presentation"></div>
	<aside class="drawer" aria-label="Incident detail">
		<header class="dh">
			<div class="dh-chips">
				<Chip color="cyan">{active.ecosystem.toUpperCase()}</Chip>
				<span class="dh-threat" style:color={THREAT_COLORS[active.threat_type]}>{active.threat_type.replace(/_/g, ' ')}</span>
			</div>
			<button class="dh-close" onclick={close} aria-label="Close"><Icon name="x" size={18} strokeWidth={2} /></button>
		</header>

		<div class="dh-pkg">{active.package}<span class="dh-ver">@{active.version}</span></div>

		<div class="d-score">
			<div class="d-score-ring" style:border-color={sevColor(active.threat_score)}>
				<span class="d-score-n" style:color={sevColor(active.threat_score)}>{active.threat_score}</span>
				<span class="d-score-d">/10</span>
			</div>
			<div class="d-score-meta">
				<span class="d-sev" style:color={sevColor(active.threat_score)}>{sev(active.threat_score) === 'crit' ? 'CRITICAL' : sev(active.threat_score) === 'high' ? 'HIGH' : 'MEDIUM'}</span>
				<span class="d-action" class:act-block={active.action === 'blocked'} class:act-warn={active.action === 'warned'}>
					<Icon name={active.action === 'blocked' ? 'x-circle' : 'shield-alert'} size={13} strokeWidth={1.75} />
					{active.action}
				</span>
				<span class="d-when">seen {active.count}× · {active.first_seen} → {active.last_seen}</span>
			</div>
		</div>

		<!-- ── triage action bar ── -->
		<section class="d-triage">
			<div class="d-sec-h"><Icon name="check-circle" size={13} strokeWidth={1.75} /> Triage</div>
			<div class="tri-status">
				{#each STATUS_STEPS as s}
					<button
						class="tri-seg"
						class:tri-seg--on={st === s}
						style:--seg={STATUS_COLOR[s]}
						onclick={() => setStatus(active!.id, s)}>{STATUS_LABEL[s]}</button
					>
				{/each}
				<button class="tri-dismiss" class:tri-dismiss--on={st === 'dismissed'} onclick={() => setStatus(active!.id, 'dismissed')}>
					<Icon name="x-circle" size={12} strokeWidth={1.75} /> Dismiss
				</button>
			</div>
			<div class="tri-actions">
				<ActionsMenu items={sendItems(active.id)} placement="bottom-start">
					{#snippet trigger({ toggle })}
						<button class="tri-btn" onclick={toggle}>
							<Icon name="external-link" size={13} strokeWidth={1.75} />
							{link ? 'Re-route…' : 'Send to…'}
							<Icon name="chevron-down" size={12} strokeWidth={1.75} />
						</button>
					{/snippet}
				</ActionsMenu>
				<button class="tri-btn" class:tri-btn--done={ruleMap[active.id]} onclick={() => createRule(active!.id)} disabled={ruleMap[active.id]}>
					<Icon name={ruleMap[active.id] ? 'check-circle' : 'filter'} size={13} strokeWidth={1.75} />
					{ruleMap[active.id] ? 'Rule added' : 'Create rule'}
				</button>
			</div>
			{#if link}
				<div class="tri-linked">
					<Icon name="external-link" size={12} strokeWidth={1.75} />
					Tracked in <strong>{DEST_LABEL[link.dest]}</strong>
					<a class="tri-ref" href="#issue">{link.ref} ↗</a>
				</div>
			{/if}
		</section>

		<section class="d-sec">
			<div class="d-sec-h"><Icon name="git-fork" size={13} strokeWidth={1.75} /> Blast radius · {active.agents.length} {active.agents.length === 1 ? 'agent' : 'agents'} exposed</div>
			<div class="d-agents">
				{#each active.agents as a}<span class="d-agent">{a}</span>{/each}
			</div>
		</section>

		<section class="d-sec">
			<div class="d-sec-h"><Icon name="file-text" size={13} strokeWidth={1.75} /> Intelligence</div>
			{#if active.cve}<a class="d-cve" href="#cve">{active.cve}</a>{/if}
			<p class="d-desc">{active.description}</p>
		</section>

		<section class="d-sec d-rec">
			<div class="d-sec-h"><Icon name="wrench" size={13} strokeWidth={1.75} /> Recommended action</div>
			<p class="d-desc">{active.recommendation}</p>
		</section>

		<section class="d-sec">
			<div class="d-sec-h"><Icon name="filter" size={13} strokeWidth={1.75} /> Enforcement</div>
			<div class="d-rule">
				<span class="d-rule-l">Matched rule</span>
				<span class="d-rule-v">{active.rule}</span>
			</div>
		</section>
	</aside>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.25rem 1.5rem 3rem;
		max-width: 1600px;
		margin: 0 auto;
	}
	:global(.accent) {
		color: var(--accent);
	}
	.bad {
		color: #fca5a5;
	}
	.warn {
		color: #fcd34d;
	}

	/* state toggle */
	.statebar {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: 7px;
		overflow: hidden;
	}
	.seg {
		background: transparent;
		border: none;
		padding: 6px 12px;
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fg-muted);
		cursor: pointer;
	}
	.seg--on {
		background: rgba(94, 234, 212, 0.1);
		color: var(--accent);
	}

	/* ── instrument strip ── */
	.instrument {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.85rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: linear-gradient(135deg, rgba(15, 23, 42, 0.4), rgba(8, 12, 18, 0.25));
	}
	.ins-cell {
		display: flex;
		flex-direction: column;
		gap: 2px;
		line-height: 1;
	}
	.ins-v {
		font-family: var(--mono);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--fg);
		font-variant-numeric: tabular-nums;
	}
	.ins-sub {
		font-size: 0.8rem;
		color: var(--fg-dim);
		font-weight: 500;
	}
	.ins-l {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.ins-sep {
		width: 1px;
		height: 30px;
		background: var(--border);
	}
	.ins-worst {
		margin-left: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: flex-end;
	}
	.ins-worst-l {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.ins-worst-b {
		display: flex;
		align-items: center;
		gap: 7px;
		background: rgba(252, 165, 165, 0.06);
		border: 1px solid rgba(252, 165, 165, 0.25);
		border-radius: 6px;
		padding: 5px 10px;
		cursor: pointer;
		transition: background 140ms;
	}
	.ins-worst-b:hover {
		background: rgba(252, 165, 165, 0.14);
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.ins-worst-pkg {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--fg);
	}
	.ins-worst-s {
		font-family: var(--mono);
		font-size: 0.72rem;
		font-weight: 700;
	}

	/* ── hero grid ── */
	.hero {
		display: grid;
		grid-template-columns: 1.65fr 1fr;
		gap: 1rem;
	}
	@media (max-width: 1040px) {
		.hero {
			grid-template-columns: 1fr;
		}
	}
	.map {
		position: relative;
		width: 100%;
		height: clamp(360px, 46vh, 480px);
	}
	.map-empty {
		min-height: 360px;
		display: flex;
		align-items: center;
	}
	.quadrant-tag {
		position: absolute;
		top: 10px;
		right: 16px;
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(252, 165, 165, 0.7);
		pointer-events: none;
	}
	.map-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 1rem;
		margin-top: 0.6rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--border);
	}
	.lg {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--fg-muted);
	}
	.lg-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	/* ── triage queue ── */
	.queue {
		display: flex;
		flex-direction: column;
		max-height: 460px;
		overflow-y: auto;
	}
	.q-row {
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border);
		padding: 0.55rem 0.35rem;
		cursor: pointer;
		transition: background 120ms;
	}
	.q-row:hover {
		background: rgba(94, 234, 212, 0.05);
	}
	.q-open {
		background: rgba(94, 234, 212, 0.09);
	}
	.q-rank {
		font-family: var(--mono);
		font-size: 0.64rem;
		color: var(--fg-dim);
		width: 14px;
		text-align: right;
	}
	.q-sev {
		width: 4px;
		height: 26px;
		border-radius: 2px;
	}
	.q-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.q-pkg {
		font-family: var(--mono);
		font-size: 0.74rem;
		color: var(--fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.q-ver {
		color: var(--fg-dim);
	}
	.q-meta {
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.q-nums {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.q-done {
		opacity: 0.45;
	}
	.q-pill {
		font-family: var(--mono);
		font-size: 0.52rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border: 1px solid;
		border-radius: 4px;
		padding: 1px 5px;
		margin-left: 5px;
	}
	.q-link {
		font-family: var(--mono);
		font-size: 0.56rem;
		color: var(--accent);
		margin-left: 5px;
	}
	.q-filter {
		display: inline-flex;
		margin-left: auto;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}
	.qf {
		background: transparent;
		border: none;
		padding: 3px 9px;
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--fg-muted);
		cursor: pointer;
	}
	.qf--on {
		background: rgba(94, 234, 212, 0.1);
		color: var(--accent);
	}
	.q-score {
		font-family: var(--mono);
		font-size: 0.82rem;
		font-weight: 700;
	}
	.q-agents {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-muted);
	}

	/* ── generic panel bits ── */
	.p-label {
		font-family: var(--mono);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg);
	}
	.p-sub {
		font-size: 0.64rem;
		color: var(--fg-muted);
		margin-left: 0.5rem;
	}
	.chart-md {
		width: 100%;
		height: 260px;
	}
	.grid-2 {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 1rem;
	}
	@media (max-width: 1040px) {
		.grid-2 {
			grid-template-columns: 1fr;
		}
	}

	/* ── registry coverage footer ── */
	.cov {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.75rem;
	}
	.cov-chip {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
	}
	.cov-off {
		opacity: 0.5;
	}
	.cov-top {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.cov-name {
		font-family: var(--mono);
		font-size: 0.74rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.cov-x {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-dim);
		margin-left: auto;
	}
	.cov-bar {
		height: 5px;
		background: rgba(255, 255, 255, 0.07);
		border-radius: 3px;
		overflow: hidden;
	}
	.cov-fill {
		height: 100%;
		border-radius: 3px;
	}
	.cov-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.cov-enr {
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--fg-muted);
	}
	.cov-pol {
		font-family: var(--mono);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.pol-block {
		color: #fca5a5;
	}
	.pol-warn {
		color: #fcd34d;
	}
	.pol-log {
		color: var(--fg-dim);
	}
	.cov-blind {
		border-style: dashed;
		border-color: rgba(252, 165, 165, 0.3);
		background: transparent;
	}
	.dot-blind {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #fca5a5;
		box-shadow: 0 0 5px #fca5a5;
	}
	.cov-name-blind {
		color: #fca5a5;
	}
	.cov-blind-msg {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: rgba(252, 165, 165, 0.7);
	}

	/* ── incident drawer ── */
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(3, 6, 10, 0.55);
		backdrop-filter: blur(2px);
		z-index: 40;
		animation: fade 160ms ease;
	}
	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(440px, 92vw);
		z-index: 41;
		overflow-y: auto;
		padding: 1.4rem 1.4rem 2.5rem;
		background: linear-gradient(160deg, #0b1017, #070b10);
		border-left: 1px solid var(--border);
		box-shadow: -24px 0 60px -20px rgba(0, 0, 0, 0.7);
		animation: slide 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes slide {
		from {
			transform: translateX(30px);
			opacity: 0;
		}
	}
	.dh {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.dh-chips {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.dh-threat {
		font-family: var(--mono);
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.dh-close {
		display: flex;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 5px;
		color: var(--fg-muted);
		cursor: pointer;
	}
	.dh-close:hover {
		color: var(--fg);
		border-color: var(--accent);
	}
	.dh-pkg {
		margin-top: 0.9rem;
		font-family: var(--mono);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--fg);
		word-break: break-all;
	}
	.dh-ver {
		color: var(--fg-dim);
		font-weight: 500;
	}
	.d-score {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1.1rem 0;
		padding-bottom: 1.1rem;
		border-bottom: 1px solid var(--border);
	}
	.d-score-ring {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 76px;
		height: 76px;
		border: 3px solid;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.d-score-n {
		font-family: var(--mono);
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
	}
	.d-score-d {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-dim);
	}
	.d-score-meta {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.d-sev {
		font-family: var(--mono);
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.06em;
	}
	.d-action {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--mono);
		font-size: 0.66rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		width: fit-content;
	}
	.act-block {
		color: #fca5a5;
	}
	.act-warn {
		color: #fcd34d;
	}
	.d-when {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}
	/* ── triage action bar ── */
	.d-triage {
		margin-bottom: 1.3rem;
		padding-bottom: 1.2rem;
		border-bottom: 1px solid var(--border);
	}
	.tri-status {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 0.6rem;
	}
	.tri-seg {
		flex: 1;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 6px 4px;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--fg-muted);
		cursor: pointer;
		transition: all 130ms;
	}
	.tri-seg--on {
		color: var(--seg);
		border-color: var(--seg);
		background: color-mix(in srgb, var(--seg) 12%, transparent);
	}
	.tri-dismiss {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 6px 9px;
		font-family: var(--mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--fg-dim);
		cursor: pointer;
		transition: all 130ms;
	}
	.tri-dismiss:hover,
	.tri-dismiss--on {
		color: #fca5a5;
		border-color: rgba(252, 165, 165, 0.4);
	}
	.tri-actions {
		display: flex;
		gap: 8px;
	}
	.tri-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(94, 234, 212, 0.06);
		border: 1px solid rgba(94, 234, 212, 0.28);
		border-radius: 6px;
		padding: 7px 11px;
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--accent);
		cursor: pointer;
		transition: background 130ms;
	}
	.tri-btn:hover:not(:disabled) {
		background: rgba(94, 234, 212, 0.14);
	}
	.tri-btn--done {
		background: rgba(52, 211, 153, 0.08);
		border-color: rgba(52, 211, 153, 0.35);
		color: #34d399;
		cursor: default;
	}
	.tri-linked {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 0.7rem;
		font-family: var(--mono);
		font-size: 0.64rem;
		color: var(--fg-muted);
	}
	.tri-linked :global(svg) {
		color: var(--accent);
	}
	.tri-linked strong {
		color: var(--fg);
		font-weight: 600;
	}
	.tri-ref {
		color: var(--accent);
		text-decoration: none;
	}

	.d-sec {
		margin-bottom: 1.15rem;
	}
	.d-sec-h {
		display: flex;
		align-items: center;
		gap: 7px;
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-muted);
		margin-bottom: 0.6rem;
	}
	.d-sec-h :global(svg) {
		color: var(--accent);
	}
	.d-agents {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.d-agent {
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--fg);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 3px 8px;
	}
	.d-cve {
		display: inline-block;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--accent);
		text-decoration: none;
		border: 1px solid rgba(94, 234, 212, 0.3);
		border-radius: 5px;
		padding: 3px 8px;
		margin-bottom: 0.6rem;
	}
	.d-desc {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.6;
		color: var(--fg-muted);
	}
	.d-rec {
		background: rgba(94, 234, 212, 0.05);
		border: 1px solid rgba(94, 234, 212, 0.18);
		border-radius: 8px;
		padding: 0.8rem 0.9rem;
	}
	.d-rule {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.5rem 0.7rem;
	}
	.d-rule-l {
		font-family: var(--mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--fg-dim);
	}
	.d-rule-v {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--fg);
	}
</style>
