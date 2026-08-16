<script lang="ts">
	// /console/admin/quotas — God-admin quota management
	//
	// API stubs:
	//   GET /api/admin/orgs                        → OrgQuotaRow[]
	//   PUT /api/admin/orgs/:org_id/quota          → 204
	//
	// OrgQuotaRow: { id, name, slug, quota: OrgQuota|null, usage: OrgUsage }
	// OrgQuota:    { max_agents, max_proxies, max_dns_rules, max_threat_feed_indicators, max_integrations }
	// OrgUsage:    { agents, proxies, dns_rules, threat_feed_indicators, integrations }
	//
	// NULL quota field = unlimited. Empty input in edit form sends null.

	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import Input from '$lib/primitives/Input.svelte';
	import FormField from '$lib/primitives/FormField.svelte';

	// ── Types ─────────────────────────────────────────────────────────────────

	type OrgQuota = {
		max_agents: number | null;
		max_proxies: number | null;
		max_dns_rules: number | null;
		max_threat_feed_indicators: number | null;
		max_integrations: number | null;
	};

	type OrgUsage = {
		agents: number;
		proxies: number;
		dns_rules: number;
		threat_feed_indicators: number;
		integrations: number;
	};

	type OrgQuotaRow = {
		id: string;
		name: string;
		slug: string;
		quota: OrgQuota | null;
		usage: OrgUsage;
	};

	const RESOURCES: { key: keyof OrgUsage; quotaKey: keyof OrgQuota; label: string }[] = [
		{ key: 'agents', quotaKey: 'max_agents', label: 'Agents' },
		{ key: 'proxies', quotaKey: 'max_proxies', label: 'Proxies' },
		{ key: 'dns_rules', quotaKey: 'max_dns_rules', label: 'DNS Rules' },
		{ key: 'threat_feed_indicators', quotaKey: 'max_threat_feed_indicators', label: 'Indicators' },
		{ key: 'integrations', quotaKey: 'max_integrations', label: 'Integrations' }
	];

	// ── Mock data ─────────────────────────────────────────────────────────────

	let rows = $state<OrgQuotaRow[]>([
		{
			id: 'org_acme',
			name: 'Acme Corp',
			slug: 'acme',
			quota: { max_agents: 10, max_proxies: 5, max_dns_rules: 100, max_threat_feed_indicators: null, max_integrations: null },
			usage: { agents: 2, proxies: 3, dns_rules: 45, threat_feed_indicators: 12400, integrations: 3 }
		},
		{
			id: 'org_nova',
			name: 'Nova Systems',
			slug: 'nova',
			quota: { max_agents: 10, max_proxies: 5, max_dns_rules: 100, max_threat_feed_indicators: null, max_integrations: 5 },
			usage: { agents: 7, proxies: 5, dns_rules: 92, threat_feed_indicators: 8200, integrations: 2 }
		},
		{
			id: 'org_helios',
			name: 'Helios Security',
			slug: 'helios',
			quota: null,
			usage: { agents: 0, proxies: 1, dns_rules: 8, threat_feed_indicators: 0, integrations: 1 }
		},
		{
			id: 'org_vertex',
			name: 'Vertex Labs',
			slug: 'vertex',
			quota: { max_agents: 3, max_proxies: 2, max_dns_rules: 20, max_threat_feed_indicators: 5000, max_integrations: 3 },
			usage: { agents: 3, proxies: 2, dns_rules: 21, threat_feed_indicators: 5000, integrations: 3 }
		}
	]);

	// ── UI state ──────────────────────────────────────────────────────────────

	let editingRow = $state<OrgQuotaRow | null>(null);
	let saving = $state(false);
	let search = $state('');

	// Form state — stored as strings so empty = unlimited
	let fAgents = $state('');
	let fProxies = $state('');
	let fDnsRules = $state('');
	let fIndicators = $state('');
	let fIntegrations = $state('');

	const filteredRows = $derived(
		search.trim()
			? rows.filter(
					(r) =>
						r.name.toLowerCase().includes(search.toLowerCase()) ||
						r.slug.toLowerCase().includes(search.toLowerCase())
				)
			: rows
	);

	function isAtLimit(row: OrgQuotaRow): boolean {
		if (!row.quota) return false;
		return RESOURCES.some((res) => {
			const limit = row.quota![res.quotaKey];
			if (limit === null) return false;
			return row.usage[res.key] >= limit;
		});
	}

	function cellClass(usage: number, limit: number | null): string {
		if (limit === null) return 'cell-ok';
		if (usage >= limit) return 'cell-over';
		if (usage >= limit * 0.8) return 'cell-warn';
		return 'cell-ok';
	}

	function fmtLimit(v: number | null): string {
		return v === null ? '∞' : String(v);
	}

	function fmtCount(n: number): string {
		return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
	}

	function openEdit(row: OrgQuotaRow) {
		editingRow = row;
		fAgents = row.quota?.max_agents != null ? String(row.quota.max_agents) : '';
		fProxies = row.quota?.max_proxies != null ? String(row.quota.max_proxies) : '';
		fDnsRules = row.quota?.max_dns_rules != null ? String(row.quota.max_dns_rules) : '';
		fIndicators = row.quota?.max_threat_feed_indicators != null ? String(row.quota.max_threat_feed_indicators) : '';
		fIntegrations = row.quota?.max_integrations != null ? String(row.quota.max_integrations) : '';
	}

	function parseField(s: string): number | null {
		const v = s.trim();
		if (v === '') return null;
		const n = parseInt(v, 10);
		return isNaN(n) || n < 0 ? null : n;
	}

	async function handleSave() {
		if (!editingRow || saving) return;
		saving = true;
		const quota = {
			max_agents: parseField(fAgents),
			max_proxies: parseField(fProxies),
			max_dns_rules: parseField(fDnsRules),
			max_threat_feed_indicators: parseField(fIndicators),
			max_integrations: parseField(fIntegrations)
		};
		// simulate API delay
		await new Promise((r) => setTimeout(r, 600));
		rows = rows.map((r) =>
			r.id === editingRow!.id ? { ...r, quota } : r
		);
		saving = false;
		editingRow = null;
	}
</script>

<svelte:head><title>Org Quotas — Armornet Admin</title></svelte:head>

<LayoutHeader eyebrow="// admin · org quotas">
	{#snippet title()}Org <span class="text-[var(--accent)]">Quotas.</span>{/snippet}
	{#snippet lede()}View and edit per-organisation resource limits. Null = unlimited.{/snippet}
</LayoutHeader>

<!-- Search bar -->
<div class="flex items-center gap-3 mb-4">
	<div class="relative max-w-[280px] flex-1">
		<svg class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-dim)] pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
		<input
			class="w-full pl-8 pr-3 py-[0.4rem] bg-[var(--surface-raised)] border border-[var(--border)] rounded-[4px] text-[0.75rem] font-mono text-[var(--fg-muted)] outline-none placeholder:text-[var(--fg-dim)] focus:border-[var(--accent)] transition-[border-color] duration-150"
			type="search"
			placeholder="Filter orgs…"
			bind:value={search}
		/>
	</div>
	<span class="text-[0.68rem] text-[var(--fg-dim)] font-mono">{filteredRows.length} org{filteredRows.length !== 1 ? 's' : ''}</span>
</div>

<!-- Quota table -->
<div class="quota-table">
	<div class="quota-head">
		<span>Organisation</span>
		{#each RESOURCES as res}
			<span>{res.label}</span>
		{/each}
		<span></span>
	</div>

	{#each filteredRows as row (row.id)}
		<div class="quota-row" class:quota-row--alert={isAtLimit(row)}>
			<div class="org-cell">
				<span class="org-name">{row.name}</span>
				<span class="org-slug">{row.slug}</span>
			</div>
			{#each RESOURCES as res}
				{@const limit = row.quota?.[res.quotaKey] ?? null}
				{@const usage = row.usage[res.key]}
				<div class="usage-cell {cellClass(usage, limit)}">
					<span class="usage-count">{fmtCount(usage)}</span>
					<span class="usage-sep">/</span>
					<span class="usage-limit" class:unlimited={limit === null}>{fmtLimit(limit)}</span>
				</div>
			{/each}
			<div class="row-action">
				<button class="edit-btn" onclick={() => openEdit(row)}>Edit</button>
			</div>
		</div>
	{/each}

	{#if filteredRows.length === 0}
		<div class="empty-row">No organisations match.</div>
	{/if}
</div>

<!-- Backdrop -->
{#if editingRow}
	<div class="fixed inset-0 bg-black/50 z-[99]" onclick={() => (editingRow = null)} aria-hidden="true"></div>

	<!-- Drawer -->
	<div class="fixed right-0 top-0 bottom-0 w-[400px] max-w-[95vw] z-[100] bg-[var(--bg-elev)] border-l border-[var(--border)] flex flex-col overflow-hidden" role="dialog" aria-modal="true">
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
			<div>
				<span class="font-mono text-[0.6rem] tracking-[0.18em] uppercase text-[var(--fg-dim)]">// edit quota</span>
				<p class="text-[0.85rem] font-semibold text-[var(--fg)] mt-[2px]">{editingRow.name}</p>
			</div>
			<button class="text-[var(--fg-dim)] hover:text-[var(--fg)] text-lg bg-transparent border-none cursor-pointer p-1 leading-none" onclick={() => (editingRow = null)} aria-label="Close">×</button>
		</div>

		<!-- Body -->
		<div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
			<p class="text-[0.72rem] text-[var(--fg-dim)] m-0 pb-1">Leave a field blank to remove the limit (unlimited). Current usage shown in brackets.</p>

			<FormField label="Max Agents" id="f-agents" hint="Current usage: {editingRow.usage.agents}">
				<Input id="f-agents" type="number" placeholder="unlimited" bind:value={fAgents} />
			</FormField>
			<FormField label="Max Proxies" id="f-proxies" hint="Current usage: {editingRow.usage.proxies}">
				<Input id="f-proxies" type="number" placeholder="unlimited" bind:value={fProxies} />
			</FormField>
			<FormField label="Max DNS Rules" id="f-dns" hint="Current usage: {editingRow.usage.dns_rules}">
				<Input id="f-dns" type="number" placeholder="unlimited" bind:value={fDnsRules} />
			</FormField>
			<FormField label="Max Threat Indicators" id="f-ind" hint="Current usage: {fmtCount(editingRow.usage.threat_feed_indicators)}">
				<Input id="f-ind" type="number" placeholder="unlimited" bind:value={fIndicators} />
			</FormField>
			<FormField label="Max Integrations" id="f-int" hint="Current usage: {editingRow.usage.integrations}">
				<Input id="f-int" type="number" placeholder="unlimited" bind:value={fIntegrations} />
			</FormField>
		</div>

		<!-- Footer -->
		<div class="shrink-0 px-6 py-4 border-t border-[var(--border)] flex gap-3">
			<Button variant="primary" size="md" loading={saving} onclick={handleSave}>Save quota</Button>
			<Button variant="ghost" size="sm" onclick={() => (editingRow = null)}>Cancel</Button>
		</div>
	</div>
{/if}

<style>
	/* ── Quota table ──────────────────────────────────────────────── */
	.quota-table {
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}
	.quota-head {
		display: grid;
		grid-template-columns: 1.6fr repeat(5, 1fr) 60px;
		padding: 0.5rem 1rem;
		background: rgba(255, 255, 255, 0.025);
		border-bottom: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.quota-row {
		display: grid;
		grid-template-columns: 1.6fr repeat(5, 1fr) 60px;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		transition: background 0.1s;
	}
	.quota-row:last-child { border-bottom: none; }
	.quota-row:hover { background: rgba(255, 255, 255, 0.02); }
	.quota-row--alert { background: rgba(251, 191, 36, 0.04); }
	.quota-row--alert:hover { background: rgba(251, 191, 36, 0.07); }

	/* Org cell */
	.org-cell {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.org-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--fg);
	}
	.org-slug {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}

	/* Usage cells */
	.usage-cell {
		display: flex;
		align-items: baseline;
		gap: 0.2rem;
		font-family: var(--mono);
		font-size: 0.72rem;
	}
	.usage-count { font-weight: 600; }
	.usage-sep { color: var(--fg-dim); font-size: 0.65rem; }
	.usage-limit { font-size: 0.68rem; }

	.cell-ok .usage-count { color: var(--fg-muted); }
	.cell-ok .usage-limit { color: var(--fg-dim); }
	.cell-ok .usage-sep  { color: var(--border-strong); }

	.cell-warn .usage-count { color: var(--palette-amber, #fbbf24); }
	.cell-warn .usage-limit { color: var(--palette-amber, #fbbf24); opacity: 0.7; }
	.cell-warn .usage-sep  { color: var(--palette-amber, #fbbf24); opacity: 0.5; }

	.cell-over .usage-count { color: var(--palette-red, #f87171); font-weight: 700; }
	.cell-over .usage-limit { color: var(--palette-red, #f87171); opacity: 0.7; }
	.cell-over .usage-sep  { color: var(--palette-red, #f87171); opacity: 0.5; }

	.unlimited { color: var(--accent) !important; opacity: 1 !important; }

	/* Row action */
	.row-action { display: flex; justify-content: flex-end; }
	.edit-btn {
		padding: 0.2rem 0.6rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--fg-dim);
		background: transparent;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.edit-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Empty */
	.empty-row {
		padding: 3rem;
		text-align: center;
		font-size: 0.78rem;
		color: var(--fg-dim);
		font-family: var(--mono);
	}
</style>
