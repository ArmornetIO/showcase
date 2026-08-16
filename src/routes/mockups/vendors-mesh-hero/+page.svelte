<script lang="ts">
	// ── API stubs ────────────────────────────────────────────────────────────────
	// GET /api/vendors            → VendorEnvelope[] { id, name, assessment_status, criticality }
	// GET /api/vendors/summary    → { total, scored_count, by_review_status: { overdue } }
	// GET /api/proxies/summary    → aggregate request/blocked/warned/enrolled totals
	//
	// The MeshMembrane is the page. Vendors are first-class mesh nodes now:
	// THREAT FEEDS → vendors (intermediary, coloured by assessment status) →
	// VENDOR AGENT → protected core. "We pick off feeds, monitor your vendors,
	// and our agent does the work." The three pillar readouts (coverage / activity
	// / footprint) dock either as floating cards over the canvas or in a right
	// rail — toggle between the two.
	import MeshMembrane, {
		type MembraneRegistry,
		type MembraneProxy,
		type MembraneVendor
	} from '$lib/mesh-studio/membrane/MeshMembrane.svelte';
	import PostureVerdict, { type PostureClause } from '$lib/display/metric/PostureVerdict.svelte';
	import RadialProgress from '$lib/display/progress/RadialProgress.svelte';
	import StatusDot from '$lib/primitives/StatusDot.svelte';
	import type { MeshLayoutId } from '$lib/mesh-studio/layout/mesh-layout.js';

	// ── Layout toggle ────────────────────────────────────────────────────────────
	let cardMode = $state<'float' | 'rail'>('float');
	// Mesh arrangement — driven by the picker docked over the canvas.
	let meshLayout = $state<'membrane' | MeshLayoutId>('fan');

	// ── Fake data (realistic shape) ──────────────────────────────────────────────
	// The original package supply-chain lanes — kept intact.
	const registries: MembraneRegistry[] = [
		{ id: 'reg-npm', label: 'NPM·REG', kind: 'npm' },
		{ id: 'reg-pip', label: 'PYPI·REG', kind: 'pip' },
		{ id: 'reg-go', label: 'GO·PROXY', kind: 'go' },
		{ id: 'reg-docker', label: 'DOCKER·HUB', kind: 'docker' },
		{ id: 'reg-git', label: 'GITHUB', kind: 'git' }
	];
	const proxies: MembraneProxy[] = [
		{ id: 'px-npm', label: 'NPM', kind: 'npm', policy: 'block', enabled: true, agentCount: 9, count: 3 },
		{ id: 'px-pip', label: 'PIP', kind: 'pip', policy: 'block', enabled: true, agentCount: 6 },
		{ id: 'px-go', label: 'GO', kind: 'go', policy: 'warn', enabled: true, agentCount: 5 },
		{ id: 'px-docker', label: 'DOCKER', kind: 'docker', policy: 'log', enabled: true, agentCount: 4 },
		{ id: 'px-git', label: 'GIT', kind: 'git', policy: 'block', enabled: false, agentCount: 0 }
	];
	// The new vendor-monitoring lane, layered on top.
	const vendors: MembraneVendor[] = [
		{ id: 'ven-stripe', label: 'STRIPE', status: 'approved' },
		{ id: 'ven-snowflake', label: 'SNOWFLAKE', status: 'approved' },
		{ id: 'ven-okta', label: 'OKTA', status: 'approved' },
		{ id: 'ven-datadog', label: 'DATADOG', status: 'in_review' },
		{ id: 'ven-acme', label: 'ACME ANALYTICS', status: 'critical' },
		{ id: 'ven-northwind', label: 'NORTHWIND HR', status: 'critical' }
	];
	const unassessed_critical = vendors.filter((v) => v.status === 'critical').length;

	const summary = { total: 22, scored_count: 14, by_review_status: { overdue: 2 } };
	const portfolio_score = 72;
	const sc_totals = { req: 12438, blocked: 3, warned: 7, enrolled: 24, total: 30, blind_spots: 1 };
	const feed_age_min = 6;
	const proxies_healthy = 4;
	const proxies_total = 5;

	const coverage_pct = Math.round((sc_totals.enrolled / sc_totals.total) * 100);
	const overview_coverage = 64;
	const allowed = Math.max(0, sc_totals.req - sc_totals.blocked - sc_totals.warned);

	const clauses: PostureClause[] = [
		{
			text: `${unassessed_critical} critical vendors still unassessed — your biggest breach blind spots.`,
			tone: 'bad'
		},
		{ text: `${sc_totals.blocked} supply-chain attacks blocked in the last 24h.`, tone: 'good' }
	];

	const score_variant = portfolio_score >= 65 ? 'success' : portfolio_score >= 50 ? 'warn' : 'error';
	const fmt = (n: number) => (n > 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
</script>

<svelte:head>
	<title>Mockup — Vendors Mesh Hero</title>
</svelte:head>

<!-- ══ The three pillar readouts, defined once, rendered in either layout ══ -->
{#snippet coverageCard()}
	<button class="card" onclick={() => {}}>
		<span class="card-eyebrow">/ vendor coverage</span>
		<div class="card-split">
			<RadialProgress
				value={portfolio_score}
				max={100}
				size={68}
				strokeWidth={7}
				variant={score_variant}
				label="SCORE"
			/>
			<dl class="kv">
				<div><dt>Scored</dt><dd>{summary.scored_count} / {summary.total}</dd></div>
				<div><dt>Pass line</dt><dd class="ok">65%</dd></div>
				<div><dt>Overdue review</dt><dd class="warn">{summary.by_review_status.overdue}</dd></div>
				<div><dt>Unassessed critical</dt><dd class="bad">{unassessed_critical}</dd></div>
			</dl>
		</div>
		<span class="cta">view vendor risk →</span>
	</button>
{/snippet}

{#snippet activityCard()}
	<button class="card" onclick={() => {}}>
		<span class="card-eyebrow">/ agent + proxy activity</span>
		<div class="triad">
			<div class="tri"><span class="tri-v bad">{sc_totals.blocked}</span><span class="tri-l">blocked</span></div>
			<div class="tri-sep"></div>
			<div class="tri"><span class="tri-v warn">{sc_totals.warned}</span><span class="tri-l">flagged</span></div>
			<div class="tri-sep"></div>
			<div class="tri"><span class="tri-v">{fmt(sc_totals.req)}</span><span class="tri-l">seen</span></div>
		</div>
		<div class="cov">
			<span class="cov-lbl">agent coverage</span>
			<div class="cov-track"><div class="cov-fill" style:width="{coverage_pct}%"></div></div>
			<span class="cov-pct">{coverage_pct}%</span>
		</div>
		<span class="cta">inspect ecosystems →</span>
	</button>
{/snippet}

{#snippet meshCard()}
	<button class="card" onclick={() => {}}>
		<span class="card-eyebrow">/ agent mesh</span>
		<div class="foot">
			<span class="foot-num">{sc_totals.enrolled}</span>
			<span class="foot-k">agents enrolled</span>
		</div>
		<dl class="kv">
			<div><dt>Coverage</dt><dd>{coverage_pct}%</dd></div>
			<div><dt>Active proxies</dt><dd>{proxies_healthy} / {proxies_total}</dd></div>
			<div><dt>Blind spots</dt><dd class="bad">{sc_totals.blind_spots}</dd></div>
		</dl>
		<span class="cta">watch the mesh →</span>
	</button>
{/snippet}

<div class="page">
	<div class="head">
		<PostureVerdict
			value={overview_coverage}
			prefix="You have assurance on"
			suffix="of your critical third-party risk"
			{clauses}
		/>
		<div class="toggle" role="group" aria-label="Card layout">
			<button class:on={cardMode === 'float'} onclick={() => (cardMode = 'float')}>Floating</button>
			<button class:on={cardMode === 'rail'} onclick={() => (cardMode = 'rail')}>Right rail</button>
		</div>
	</div>

	<div class="stage" class:stage--rail={cardMode === 'rail'}>
		<div class="mesh-wrap">
			<div class="mesh-canvas">
				<MeshMembrane
					bind:layout={meshLayout}
					showLayoutPicker
					{registries}
					{proxies}
					{vendors}
					vendorAgentLabel="VENDOR AGENT"
					threatFeedLabel="THREAT FEEDS"
					coreValue={String(sc_totals.enrolled)}
					coreLabel="PROTECTED CORE"
					interactive
					showTelemetry={false}
					height="100%"
				/>
			</div>

			<!-- Top hairline ticker -->
			<div class="ticker">
				<span class="ticker-brand">AGENT MESH · LIVE</span>
				<span class="ticker-sub">third-party frontier · 24h</span>
				<span class="ticker-spacer"></span>
				<span class="tk"><b>{fmt(sc_totals.req)}</b> requests</span>
				<span class="tk-sep"></span>
				<span class="tk"><b class="bad">{sc_totals.blocked}</b> blocked</span>
				<span class="tk-sep"></span>
				<span class="tk"><b class="warn">{sc_totals.warned}</b> warned</span>
				<span class="tk-sep"></span>
				<span class="tk feed"><StatusDot status={feed_age_min < 15 ? 'healthy' : 'degraded'} glow />threat feed {feed_age_min}m</span>
			</div>

			<!-- Floating cards: overlaid top-right of the canvas -->
			{#if cardMode === 'float'}
				<div class="float-stack">
					{@render coverageCard()}
					{@render activityCard()}
					{@render meshCard()}
				</div>
			{/if}
		</div>

		<!-- Right rail: docked beside the canvas -->
		{#if cardMode === 'rail'}
			<aside class="rail">
				{@render coverageCard()}
				{@render activityCard()}
				{@render meshCard()}
			</aside>
		{/if}
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.25rem 1.5rem 1.5rem;
		max-width: 1600px;
		margin: 0 auto;
		min-height: calc(100vh - 2rem);
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	/* ── Layout toggle ── */
	.toggle {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
		flex-shrink: 0;
	}
	.toggle button {
		padding: 0.4rem 0.7rem;
		background: none;
		border: none;
		cursor: pointer;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.toggle button + button {
		border-left: 1px solid var(--border);
	}
	.toggle button.on {
		background: rgba(94, 234, 212, 0.1);
		color: var(--accent);
	}

	/* ── Stage: mesh alone, or mesh + rail ── */
	.stage {
		flex: 1;
		min-height: clamp(520px, 72vh, 900px);
		display: grid;
		grid-template-columns: 1fr;
	}
	.stage--rail {
		grid-template-columns: 1fr clamp(280px, 24vw, 340px);
		gap: 1rem;
	}

	.mesh-wrap {
		position: relative;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
		background:
			radial-gradient(ellipse at 50% 40%, rgba(94, 234, 212, 0.03), transparent 65%),
			var(--bg-elevated, rgba(255, 255, 255, 0.015));
	}
	.mesh-canvas {
		position: absolute;
		inset: 40px 0 0 0;
	}

	/* ── Top ticker ── */
	.ticker {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 1rem;
		border-bottom: 1px solid var(--border);
		background: linear-gradient(180deg, rgba(5, 8, 12, 0.85), rgba(5, 8, 12, 0.55) 70%, transparent);
		backdrop-filter: blur(2px);
		pointer-events: none;
		z-index: 3;
	}
	.ticker-brand {
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		color: var(--fg);
	}
	.ticker-sub {
		font-size: 0.62rem;
		color: var(--fg-muted);
	}
	.ticker-spacer {
		flex: 1;
	}
	.tk {
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
	}
	.tk b {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--fg);
		font-variant-numeric: tabular-nums;
	}
	.tk.feed {
		align-items: center;
	}
	.tk-sep {
		width: 1px;
		height: 16px;
		background: var(--border);
	}

	/* ── Floating card stack (overlay, top-right) ── */
	.float-stack {
		position: absolute;
		top: 3.2rem;
		right: 1rem;
		z-index: 3;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: clamp(240px, 22vw, 300px);
	}

	/* ── Right rail ── */
	.rail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: auto;
	}

	/* ── Card — chrome that reads over the animated canvas ── */
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.85rem 0.95rem 0.9rem;
		text-align: left;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: color-mix(in srgb, var(--bg-elev, #0b0f16) 82%, transparent);
		backdrop-filter: blur(10px);
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
		cursor: pointer;
		font: inherit;
		color: inherit;
	}
	.rail .card {
		box-shadow: none;
		backdrop-filter: none;
		background: var(--bg-elev, rgba(255, 255, 255, 0.018));
	}
	.card:hover {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
	}
	.card:hover .cta {
		text-decoration: underline;
	}
	.card:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: -1px;
	}

	.card-eyebrow {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.card-split {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	.kv {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.24rem;
		margin: 0;
	}
	.kv > div {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.2rem;
	}
	.kv > div:last-child {
		border-bottom: none;
	}
	.kv dt {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.kv dd {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--fg);
		font-variant-numeric: tabular-nums;
	}

	.triad {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	.tri {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.tri-v {
		font-family: var(--mono);
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--fg);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.tri-l {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.tri-sep {
		width: 1px;
		height: 24px;
		background: var(--border);
	}

	.cov {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 8px;
	}
	.cov-lbl {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.cov-track {
		height: 4px;
		background: rgba(255, 255, 255, 0.07);
		border-radius: 2px;
		overflow: hidden;
	}
	.cov-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 2px;
	}
	.cov-pct {
		font-family: var(--mono);
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--fg);
	}

	.foot {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.foot-num {
		font-family: var(--mono);
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--fg);
		line-height: 1;
	}
	.foot-k {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.cta {
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.ok {
		color: var(--accent);
	}
	.warn {
		color: #fcd34d;
	}
	.bad {
		color: #fca5a5;
	}
	b.bad {
		color: #fb7185;
	}
	b.warn {
		color: #fbbf24;
	}

	/* Below ~1100px the rail drops under the canvas; floating cards restack too. */
	@media (max-width: 1100px) {
		.stage,
		.stage--rail {
			grid-template-columns: 1fr;
		}
		.float-stack {
			position: relative;
			top: auto;
			right: auto;
			width: 100%;
			flex-direction: row;
			flex-wrap: wrap;
			margin-top: 0.75rem;
		}
		.float-stack .card {
			flex: 1 1 240px;
		}
	}
</style>
