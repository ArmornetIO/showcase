<script lang="ts">
	// ── Mockup: Onboarding · GenAI Risk Register Import & Threat Recommendation ──
	//
	// The heaviest step of org onboarding. Three GenAI-assisted phases plus a
	// review, all human-approved before anything is written to the risk model:
	//
	//   1. Import      — CSV upload, SCHEMA ONLY. We read column headers, never
	//                    the customer's row data. 0 rows ingested, ever, here.
	//   2. Map Schema  — GenAI maps each customer column onto the armornet Risk
	//                    field it best fits, with a confidence pill + rationale.
	//                    Reviewer accepts/overrides per row.
	//   3. Threat Model— a background worker analyses each imported risk ONE AT A
	//                    TIME and recommends threats from armornet's intelligence
	//                    model. Output grouped by originating risk; accept/dismiss
	//                    per threat.
	//   4. Review      — tallies, then "Finish import". Nothing lands until accept.
	//
	// Real armornet shapes modelled below (fake data):
	//   Risk fields        — internal/risk/types.go
	//     title, notes, asset_categories[], data_classes[], scope, cia_impact[],
	//     owner_id, treatment, status, + 5 NIST SP 800-30 Level inputs
	//     (likelihood_initiation, likelihood_success, impact,
	//      preventive_effectiveness, recovery_effectiveness). ref = RSK-NNN.
	//     data_classes ∈ { none, internal, confidential, pii, pci, phi }.
	//   Threat             — internal/meshproto/threatfeed.go
	//     type (malware|typosquat|c2|phishing|cve…), score 0–10, reason, advice,
	//     source, refs[]; indicator kind ∈ { domain, ip, url, asn, package,
	//     package_version, hash, cert_fingerprint, email }.
	//
	// API stubs (not yet built):
	//   POST /api/risk-import/schema
	//        { filename, columns:[{name,sample_header}] } → { import_id, columns }
	//   POST /api/risk-import/:id/map                      → GenAI column→field map
	//        → { mappings:[{ source_column, target_field, confidence, rationale }] }
	//   POST /api/risk-import/:id/map/accept
	//        { accepted:[{ source_column, target_field }] }
	//   GET  /api/risk-import/:id/threats                  → background worker output
	//        → { risks:[{ ref, title, state, threats:[Threat] }] }  (SSE/poll)
	//   POST /api/risk-import/:id/threats/accept
	//        { accepted:[{ risk_ref, threat_id }] }
	//   POST /api/risk-import/:id/finish                   → { risks_written, … }

	import Icon, { type IconName } from '$lib/icons/Icon.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import Select from '$lib/primitives/Select.svelte';
	import FileUpload from '$lib/primitives/FileUpload.svelte';
	import SteppedProgress from '$lib/display/progress/SteppedProgress.svelte';
	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';

	// ── Phase machine ───────────────────────────────────────────────────────────

	const PHASES = ['Import', 'Map Schema', 'Threat Model', 'Review'];
	let step = $state(0);
	let furthest = $state(0);

	function goStep(i: number) {
		if (i < 0 || i > PHASES.length - 1) return;
		// Can't skip ahead past what's been unlocked.
		if (i > furthest && i > step + 1) return;
		step = i;
		if (i > furthest) furthest = i;
	}
	const next = () => goStep(step + 1);
	const back = () => goStep(step - 1);

	// ── Phase 1 — Import (schema only) ───────────────────────────────────────────

	let csvValue = $state('');
	let csvFilename = $state('');
	// Pre-seeded so the mockup reads as "already parsed" — the fake customer file.
	let imported = $state(true);
	const SOURCE_FILE = 'acme-risk-register-2026Q2.csv';

	type SourceColumn = { name: string; sample: string };
	const SOURCE_COLUMNS: SourceColumn[] = [
		{ name: 'Risk Name', sample: 'Third-party npm dependency compromise' },
		{ name: 'Description', sample: 'Build pulls transitive deps with no pinning…' },
		{ name: 'Likelihood (1-5)', sample: '4' },
		{ name: 'Business Impact', sample: 'High' },
		{ name: 'Affected Systems', sample: 'CI pipeline, artifact registry' },
		{ name: 'Data Sensitivity', sample: 'Confidential' },
		{ name: 'Mitigation Owner', sample: 'j.okafor@…' },
		{ name: 'Control Strength', sample: 'Moderate' },
		{ name: 'Status', sample: 'In Review' }
	];

	function onImport() {
		imported = true;
	}

	// ── Phase 2 — Map Schema (GenAI output) ──────────────────────────────────────

	type Confidence = 'high' | 'medium' | 'low';

	// armornet Risk field catalogue — the target schema columns map ONTO.
	const TARGET_FIELDS: { value: string; label: string }[] = [
		{ value: '', label: '— Unmapped —' },
		{ value: 'title', label: 'title' },
		{ value: 'notes', label: 'notes' },
		{ value: 'likelihood_initiation', label: 'likelihood_initiation' },
		{ value: 'likelihood_success', label: 'likelihood_success' },
		{ value: 'impact', label: 'impact' },
		{ value: 'preventive_effectiveness', label: 'preventive_effectiveness' },
		{ value: 'recovery_effectiveness', label: 'recovery_effectiveness' },
		{ value: 'asset_categories', label: 'asset_categories' },
		{ value: 'data_classes', label: 'data_classes' },
		{ value: 'owner_id', label: 'owner_id' },
		{ value: 'treatment', label: 'treatment' },
		{ value: 'status', label: 'status' },
		{ value: 'scope', label: 'scope' },
		{ value: 'cia_impact', label: 'cia_impact' }
	];

	type Mapping = {
		source_column: string;
		sample: string;
		target_field: string; // '' = unmapped
		suggested_field: string;
		confidence: Confidence;
		rationale: string;
		accepted: boolean;
	};

	let mappings = $state<Mapping[]>([
		{
			source_column: 'Risk Name',
			sample: 'Third-party npm dependency compromise',
			target_field: 'title',
			suggested_field: 'title',
			confidence: 'high',
			rationale: 'Free-text risk statement — direct match to the risk title.',
			accepted: false
		},
		{
			source_column: 'Description',
			sample: 'Build pulls transitive deps…',
			target_field: 'notes',
			suggested_field: 'notes',
			confidence: 'high',
			rationale: 'Prose detail with no structured equivalent → notes.',
			accepted: false
		},
		{
			source_column: 'Likelihood (1-5)',
			sample: '4',
			target_field: 'likelihood_success',
			suggested_field: 'likelihood_success',
			confidence: 'medium',
			rationale: "1–5 ordinal maps to armornet's 5-point Level scale. NIST splits likelihood in two — assigned to success, not initiation.",
			accepted: false
		},
		{
			source_column: 'Business Impact',
			sample: 'High',
			target_field: 'impact',
			suggested_field: 'impact',
			confidence: 'high',
			rationale: "'High' aligns to the Level scale; impact is scored before controls.",
			accepted: false
		},
		{
			source_column: 'Affected Systems',
			sample: 'CI pipeline, artifact registry',
			target_field: 'asset_categories',
			suggested_field: 'asset_categories',
			confidence: 'medium',
			rationale: 'Free-text systems resolve to asset_categories (application, network); values need review.',
			accepted: false
		},
		{
			source_column: 'Data Sensitivity',
			sample: 'Confidential',
			target_field: 'data_classes',
			suggested_field: 'data_classes',
			confidence: 'high',
			rationale: "Values 'PII','Confidential' align to armornet data classes.",
			accepted: false
		},
		{
			source_column: 'Control Strength',
			sample: 'Moderate',
			target_field: 'preventive_effectiveness',
			suggested_field: 'preventive_effectiveness',
			confidence: 'medium',
			rationale: 'Reads as preventive control effectiveness; recovery controls not represented in source.',
			accepted: false
		},
		{
			source_column: 'Status',
			sample: 'In Review',
			target_field: 'status',
			suggested_field: 'status',
			confidence: 'low',
			rationale: "No direct match — armornet uses an 11-state machine keyed off treatment. 'In Review' has no clean landing state.",
			accepted: false
		},
		{
			source_column: 'Mitigation Owner',
			sample: 'j.okafor@…',
			target_field: '',
			suggested_field: 'owner_id',
			confidence: 'low',
			rationale: 'No confident match — owner_id keys on a workspace member, not an email. Pick a member to resolve.',
			accepted: false
		}
	]);

	const CONF_META: Record<Confidence, { label: string; color: 'success' | 'warn' | 'error'; icon: IconName }> = {
		high: { label: 'High confidence', color: 'success', icon: 'check-circle' },
		medium: { label: 'Medium', color: 'warn', icon: 'alert-circle' },
		low: { label: 'Low', color: 'error', icon: 'alert-triangle' }
	};

	// Fake member list for the owner_id resolver.
	const MEMBERS = [
		{ value: '', label: 'Select member…' },
		{ value: 'u_okafor', label: 'Sam Okafor — Compliance' },
		{ value: 'u_reyes', label: 'Dana Reyes — Security Lead' },
		{ value: 'u_kim', label: 'Jordan Kim — Platform Eng' }
	];
	let ownerMember = $state('');

	const mappedCount = $derived(mappings.filter((m) => m.target_field !== '').length);
	const acceptedMappingCount = $derived(mappings.filter((m) => m.accepted).length);
	const allMappingsAccepted = $derived(mappings.every((m) => m.accepted));

	function acceptMapping(m: Mapping) {
		m.accepted = !m.accepted;
	}
	function acceptAllMappings() {
		const target = !allMappingsAccepted;
		for (const m of mappings) m.accepted = target;
	}
	function changeTarget(m: Mapping, e: Event & { currentTarget: HTMLSelectElement }) {
		m.target_field = e.currentTarget.value;
		m.accepted = false; // an override needs re-confirming
	}

	// ── Phase 3 — Threat Model (background worker, one at a time) ─────────────────

	type ThreatType = 'malware' | 'typosquat' | 'c2' | 'phishing' | 'cve';
	type IndicatorKind =
		| 'domain'
		| 'ip'
		| 'url'
		| 'asn'
		| 'package'
		| 'package_version'
		| 'hash'
		| 'cert_fingerprint'
		| 'email';

	type Threat = {
		id: string;
		type: ThreatType;
		kind: IndicatorKind;
		indicator: string;
		score: number; // 0–10
		reason: string;
		advice: string;
		source: string;
		refs: string[];
		decision: 'pending' | 'accepted' | 'dismissed';
	};

	type ImportedRisk = {
		ref: string;
		title: string;
		state: 'done' | 'analyzing' | 'queued';
		threats: Threat[];
	};

	let importedRisks = $state<ImportedRisk[]>([
		{
			ref: 'RSK-001',
			title: 'Third-party npm dependency compromise',
			state: 'done',
			threats: [
				{
					id: 't1',
					type: 'typosquat',
					kind: 'package',
					indicator: 'lodahs',
					score: 8.2,
					reason: 'Typosquat of `lodash` published to npm 6 days ago; install script beacons on postinstall.',
					advice: 'Pin dependencies to digests and enable the mesh package-name proximity guard on the CI egress path.',
					source: 'armornet intel · npm mirror scan',
					refs: ['npm:lodahs@4.17.9', 'GHSA-xxxx-typosquat'],
					decision: 'pending'
				},
				{
					id: 't2',
					type: 'malware',
					kind: 'package_version',
					indicator: 'event-strim@1.0.3',
					score: 9.1,
					reason: 'Known malicious version in the transitive tree — exfiltrates env vars to a hardcoded C2 host.',
					advice: 'Block the version at the proxy and rotate any CI secrets exposed during the affected build window.',
					source: 'armornet intel · OSV + mesh telemetry',
					refs: ['OSV-2026-1180', 'ip:185.220.101.44'],
					decision: 'pending'
				}
			]
		},
		{
			ref: 'RSK-002',
			title: 'Exposed internal API on shared egress',
			state: 'done',
			threats: [
				{
					id: 't3',
					type: 'c2',
					kind: 'domain',
					indicator: 'sync-telemetry.app',
					score: 7.4,
					reason: 'Newly-registered domain matching known C2 fast-flux infrastructure resolved from the API subnet.',
					advice: 'Add the domain to the DNS blocklist and alert on any further resolution from the exposed segment.',
					source: 'armornet intel · passive DNS',
					refs: ['domain:sync-telemetry.app', 'asn:AS209588'],
					decision: 'pending'
				}
			]
		},
		{
			ref: 'RSK-003',
			title: 'Phishing of finance team',
			state: 'done',
			threats: [
				{
					id: 't4',
					type: 'phishing',
					kind: 'url',
					indicator: 'https://acme-payroll.review/login',
					score: 6.8,
					reason: 'Credential-harvesting page impersonating the payroll portal; targets finance-role mailboxes.',
					advice: 'Block the URL at the proxy and run a targeted awareness nudge for the finance distribution list.',
					source: 'armornet intel · brand-abuse feed',
					refs: ['url:acme-payroll.review/login', 'cert:9f:2a:…'],
					decision: 'pending'
				}
			]
		},
		{
			ref: 'RSK-004',
			title: 'Stale PATs with org-wide scope',
			state: 'analyzing',
			threats: []
		},
		{
			ref: 'RSK-005',
			title: 'Unencrypted Postgres backups at rest',
			state: 'queued',
			threats: []
		},
		{
			ref: 'RSK-006',
			title: 'Single-region control plane',
			state: 'queued',
			threats: []
		}
	]);

	const THREAT_META: Record<ThreatType, { label: string; icon: IconName }> = {
		malware: { label: 'malware', icon: 'flame' },
		typosquat: { label: 'typosquat', icon: 'copy' },
		c2: { label: 'c2', icon: 'radio' },
		phishing: { label: 'phishing', icon: 'send' },
		cve: { label: 'cve', icon: 'shield-alert' }
	};

	function scoreColor(score: number): string {
		if (score >= 8) return 'var(--palette-red)';
		if (score >= 5) return 'var(--palette-amber)';
		return 'var(--palette-green)';
	}
	function scoreChip(score: number): 'error' | 'warn' | 'success' {
		if (score >= 8) return 'error';
		if (score >= 5) return 'warn';
		return 'success';
	}

	const allThreats = $derived(importedRisks.flatMap((r) => r.threats));
	const recommendedThreatCount = $derived(allThreats.length);
	const acceptedThreatCount = $derived(allThreats.filter((t) => t.decision === 'accepted').length);
	const dismissedThreatCount = $derived(allThreats.filter((t) => t.decision === 'dismissed').length);
	const analyzedCount = $derived(importedRisks.filter((r) => r.state === 'done').length);
	const analyzingRisk = $derived(importedRisks.find((r) => r.state === 'analyzing'));

	function decideThreat(t: Threat, decision: 'accepted' | 'dismissed') {
		t.decision = t.decision === decision ? 'pending' : decision;
	}
	function acceptAllThreats() {
		for (const t of allThreats) if (t.decision !== 'dismissed') t.decision = 'accepted';
	}

	// ── Phase 4 — Review tallies ─────────────────────────────────────────────────

	const RISK_COUNT = 6;
	let finishing = $state(false);
	let finished = $state(false);
	async function finishImport() {
		finishing = true;
		await new Promise((r) => setTimeout(r, 900));
		finishing = false;
		finished = true;
	}
</script>

<svelte:head><title>Risk import — Armornet onboarding</title></svelte:head>

<LayoutHeader eyebrow="// onboarding · risk import">
	{#snippet title()}Import your <span class="text-[var(--accent)]">risk register.</span>{/snippet}
	{#snippet lede()}
		Bring your existing GRC risk register into armornet. GenAI maps your columns onto the risk model and recommends
		relevant threats from our intelligence — every recommendation is yours to accept before anything is written.
	{/snippet}
</LayoutHeader>

<div class="mx-auto max-w-[900px] pb-16">
	<!-- Stepper -->
	<div class="mb-8">
		<SteppedProgress
			steps={PHASES}
			current={furthest + 1}
			active={step}
			stepStyle="blocks"
			labelSize="sm"
			onstep={goStep}
		/>
	</div>

	<!-- ══════════════════════════ PHASE 1 — IMPORT ══════════════════════════ -->
	{#if step === 0}
		<section class="flex flex-col gap-5">
			<div class="phase-eyebrow">// phase 1 · import — schema only</div>

			<div class="card">
				<div class="flex items-start gap-3 mb-4">
					<div class="icon-tile"><Icon name="upload" size={16} /></div>
					<div>
						<h2 class="card-title">Upload your risk register</h2>
						<p class="card-sub">
							Upload your existing risk register (CSV) — we read the column headers only, never your row data.
						</p>
					</div>
				</div>

				<FileUpload
					bind:value={csvValue}
					bind:filename={csvFilename}
					accept=".csv"
					placeholder="Drop your risk-register CSV here, or click to browse"
				/>

				{#if !imported}
					<div class="mt-4">
						<Button variant="primary" size="sm" onclick={onImport}>
							<Icon name="radar" size={12} /> Read column headers
						</Button>
					</div>
				{/if}
			</div>

			{#if imported}
				<div class="card">
					<div class="flex items-center justify-between mb-3">
						<div class="flex items-center gap-2">
							<Icon name="file-text" size={14} class="text-[var(--fg-dim)]" />
							<span class="font-mono text-[0.78rem] text-[var(--fg)]">{SOURCE_FILE}</span>
						</div>
						<Chip look="filled" color="accent">Schema only · 9 columns · 0 rows ingested</Chip>
					</div>
					<p class="card-sub mb-4">
						Detected source columns. armornet parsed only the header row — no risk data left your browser.
					</p>
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
						{#each SOURCE_COLUMNS as col}
							<div class="col-pill">
								<span class="col-name">{col.name}</span>
								<span class="col-sample">e.g. {col.sample}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	{/if}

	<!-- ══════════════════════════ PHASE 2 — MAP SCHEMA ══════════════════════════ -->
	{#if step === 1}
		<section class="flex flex-col gap-5">
			<div class="phase-eyebrow">// phase 2 · map schema — genai recommendation</div>

			<!-- AI summary banner -->
			<div class="ai-banner">
				<div class="flex items-center gap-3">
					<div class="icon-tile accent"><Icon name="zap" size={16} /></div>
					<div>
						<p class="text-[0.85rem] text-[var(--fg)] font-medium">
							GenAI mapped {mappedCount} of {mappings.length} columns to the armornet risk model.
						</p>
						<p class="card-sub">Review each recommendation and accept, or override the target field.</p>
					</div>
				</div>
				<Button variant={allMappingsAccepted ? 'ghost' : 'primary'} size="sm" onclick={acceptAllMappings}>
					<Icon name={allMappingsAccepted ? 'x' : 'check'} size={12} />
					{allMappingsAccepted ? 'Unaccept all' : 'Accept all'}
				</Button>
			</div>

			<!-- Mapping rows -->
			<div class="card p-0 overflow-hidden">
				<div class="map-head">
					<span>Your column</span>
					<span></span>
					<span>armornet risk field</span>
					<span class="text-right">Accept</span>
				</div>
				{#each mappings as m (m.source_column)}
					{@const cm = CONF_META[m.confidence]}
					<div class="map-row" class:accepted={m.accepted} class:unmapped={m.target_field === ''}>
						<!-- LEFT: source column -->
						<div class="min-w-0">
							<div class="font-mono text-[0.8rem] text-[var(--fg)] truncate">{m.source_column}</div>
							<div class="text-[0.68rem] text-[var(--fg-dim)] truncate">e.g. {m.sample}</div>
						</div>

						<!-- arrow -->
						<div class="flex items-center justify-center text-[var(--fg-dim)]">
							<Icon name="arrow-right" size={14} />
						</div>

						<!-- RIGHT: target field + confidence + rationale -->
						<div class="min-w-0 flex flex-col gap-1.5">
							<div class="flex items-center gap-2 flex-wrap">
								<Select
									value={m.target_field}
									options={TARGET_FIELDS}
									onchange={(e) => changeTarget(m, e)}
									class="map-select"
								/>
								<Chip look="ghost" color={cm.color}>
									<Icon name={cm.icon} size={10} /> {cm.label}
								</Chip>
							</div>
							<p class="text-[0.68rem] text-[var(--fg-dim)] leading-snug">{m.rationale}</p>

							{#if m.target_field === 'owner_id' || m.suggested_field === 'owner_id'}
								<div class="mt-1">
									<Select bind:value={ownerMember} options={MEMBERS} icon="user" class="map-select" />
								</div>
							{/if}
						</div>

						<!-- accept toggle -->
						<div class="flex items-start justify-end">
							<button
								type="button"
								class="accept-btn"
								class:on={m.accepted}
								onclick={() => acceptMapping(m)}
								aria-label={m.accepted ? 'Accepted' : 'Accept mapping'}
								title={m.accepted ? 'Accepted' : 'Accept mapping'}
							>
								<Icon name="check" size={13} />
							</button>
						</div>
					</div>
				{/each}
			</div>

			<div class="text-[0.72rem] text-[var(--fg-dim)] font-mono">
				{acceptedMappingCount} / {mappings.length} mappings accepted
			</div>
		</section>
	{/if}

	<!-- ══════════════════════════ PHASE 3 — THREAT MODEL ══════════════════════════ -->
	{#if step === 2}
		<section class="flex flex-col gap-5">
			<div class="phase-eyebrow">// phase 3 · threat model — recommended threats</div>

			<div class="ai-banner">
				<div class="flex items-center gap-3">
					<div class="icon-tile accent"><Icon name="cpu" size={16} /></div>
					<div>
						<p class="text-[0.85rem] text-[var(--fg)] font-medium">
							Armornet is analyzing each imported risk and recommending relevant threats — one at a time.
						</p>
						<p class="card-sub">
							AI-generated from armornet's intelligence model. Nothing is added to your risk model until you accept.
						</p>
					</div>
				</div>
				<Button variant="primary" size="sm" onclick={acceptAllThreats}>
					<Icon name="check" size={12} /> Accept all recommended
				</Button>
			</div>

			<!-- Worker progress -->
			<div class="card">
				<div class="flex items-center justify-between mb-3">
					<span class="phase-eyebrow !mb-0">// background worker</span>
					<span class="font-mono text-[0.7rem] text-[var(--fg-dim)]">
						{analyzedCount} / {importedRisks.length} analyzed
					</span>
				</div>
				<div class="flex flex-col gap-1.5">
					{#each importedRisks as r (r.ref)}
						<div class="worker-row">
							<span class="worker-state worker-{r.state}">
								{#if r.state === 'done'}
									<Icon name="check" size={12} />
								{:else if r.state === 'analyzing'}
									<span class="spinner"></span>
								{:else}
									<Icon name="clock" size={11} />
								{/if}
							</span>
							<span class="font-mono text-[0.72rem] text-[var(--fg-dim)]">{r.ref}</span>
							<span class="text-[0.78rem] text-[var(--fg)] truncate flex-1">{r.title}</span>
							{#if r.state === 'analyzing'}
								<span class="text-[0.68rem] text-[var(--accent)] font-mono animate-pulse">Analyzing…</span>
							{:else if r.state === 'done'}
								<span class="text-[0.68rem] text-[var(--fg-dim)] font-mono">
									{r.threats.length} threat{r.threats.length === 1 ? '' : 's'}
								</span>
							{:else}
								<span class="text-[0.68rem] text-[var(--fg-dim)] font-mono">queued</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Recommended threats grouped by risk -->
			{#each importedRisks.filter((r) => r.threats.length > 0) as r (r.ref)}
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2 mt-2">
						<span class="font-mono text-[0.72rem] text-[var(--fg-dim)]">{r.ref}</span>
						<span class="text-[0.82rem] text-[var(--fg)] font-medium">{r.title}</span>
						<span class="text-[0.68rem] text-[var(--fg-dim)] font-mono">
							· {r.threats.length} recommended
						</span>
					</div>

					{#each r.threats as t (t.id)}
						{@const tm = THREAT_META[t.type]}
						<div class="threat-card" class:accepted={t.decision === 'accepted'} class:dismissed={t.decision === 'dismissed'}>
							<div class="score-badge" style={`--score-c:${scoreColor(t.score)}`}>
								<span class="score-n">{t.score.toFixed(1)}</span>
								<span class="score-l">score</span>
							</div>

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap mb-1.5">
									<Chip look="filled" color={scoreChip(t.score)}>
										<Icon name={tm.icon} size={10} /> {tm.label}
									</Chip>
									<Chip look="ghost" color="default">{t.kind}</Chip>
									<span class="font-mono text-[0.7rem] text-[var(--fg-muted)] truncate">{t.indicator}</span>
								</div>
								<p class="text-[0.78rem] text-[var(--fg)] leading-snug mb-1">
									<span class="text-[var(--fg-dim)]">reason:</span> {t.reason}
								</p>
								<p class="text-[0.75rem] text-[var(--fg-dim)] leading-snug mb-2">
									<span class="text-[var(--accent)]">advice:</span> {t.advice}
								</p>
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-mono text-[0.65rem] text-[var(--fg-dim)]">{t.source}</span>
									{#each t.refs as ref}
										<span class="ref-chip">{ref}</span>
									{/each}
								</div>
							</div>

							<div class="flex flex-col gap-1.5 shrink-0">
								<Button
									variant={t.decision === 'accepted' ? 'primary' : 'ghost'}
									size="xs"
									onclick={() => decideThreat(t, 'accepted')}
								>
									<Icon name="check" size={11} /> Accept
								</Button>
								<Button
									variant={t.decision === 'dismissed' ? 'danger' : 'ghost'}
									size="xs"
									onclick={() => decideThreat(t, 'dismissed')}
								>
									<Icon name="x" size={11} /> Dismiss
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/each}

			<div class="text-[0.72rem] text-[var(--fg-dim)] font-mono">
				{acceptedThreatCount} accepted · {dismissedThreatCount} dismissed · {recommendedThreatCount} recommended so far
			</div>
		</section>
	{/if}

	<!-- ══════════════════════════ PHASE 4 — REVIEW ══════════════════════════ -->
	{#if step === 3}
		<section class="flex flex-col gap-5">
			<div class="phase-eyebrow">// phase 4 · review — confirm import</div>

			<div class="card">
				<h2 class="card-title mb-4">Ready to import</h2>
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div class="tally">
						<span class="tally-n">{acceptedMappingCount}</span>
						<span class="tally-l">columns mapped</span>
					</div>
					<div class="tally">
						<span class="tally-n">{RISK_COUNT}</span>
						<span class="tally-l">risks imported</span>
					</div>
					<div class="tally">
						<span class="tally-n">{recommendedThreatCount}</span>
						<span class="tally-l">threats recommended</span>
					</div>
					<div class="tally" style="--score-c:var(--accent)">
						<span class="tally-n" style="color:var(--accent)">{acceptedThreatCount}</span>
						<span class="tally-l">threats accepted</span>
					</div>
				</div>
			</div>

			<div class="card">
				<div class="flex items-start gap-3">
					<Icon name="shield-check" size={16} class="text-[var(--accent)] shrink-0 mt-0.5" />
					<div>
						<p class="text-[0.82rem] text-[var(--fg)] font-medium mb-1">Human-approved before it enters the model</p>
						<p class="card-sub">
							{acceptedMappingCount} column mappings and {acceptedThreatCount} threats will be written to your risk
							register. Unaccepted recommendations are discarded. You can revisit any risk after import.
						</p>
					</div>
				</div>
			</div>

			{#if finished}
				<div class="done-banner">
					<Icon name="check-circle" size={16} class="text-[var(--palette-green)]" />
					Import complete — {RISK_COUNT} risks and {acceptedThreatCount} threats written to your register.
				</div>
			{:else}
				<div>
					<Button variant="primary" size="md" loading={finishing} onclick={finishImport}>
						<Icon name="check" size={13} /> Finish import
					</Button>
				</div>
			{/if}

			<p class="text-[0.72rem] text-[var(--fg-dim)] font-mono">
				Nothing is written to your risk model until you accept.
			</p>
		</section>
	{/if}

	<!-- Nav footer -->
	<div class="mt-8 pt-5 border-t border-[var(--border)] flex items-center justify-between">
		<Button variant="ghost" size="sm" onclick={back} disabled={step === 0}>
			<Icon name="arrow-left" size={12} /> Back
		</Button>
		<span class="font-mono text-[0.65rem] tracking-[0.15em] uppercase text-[var(--fg-dim)]">
			Step {step + 1} of {PHASES.length} · {PHASES[step]}
		</span>
		<Button variant="primary" size="sm" onclick={next} disabled={step === PHASES.length - 1}>
			Next <Icon name="arrow-right" size={12} />
		</Button>
	</div>
</div>

<style>
	.phase-eyebrow {
		font-family: var(--mono);
		font-size: 0.65rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin-bottom: 0.25rem;
	}

	.card {
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 1.1rem 1.25rem;
	}
	.card.p-0 {
		padding: 0;
	}
	.card-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--fg);
	}
	.card-sub {
		font-size: 0.75rem;
		color: var(--fg-dim);
		line-height: 1.5;
		margin-top: 2px;
	}

	.icon-tile {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		flex-shrink: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--fg-dim);
		background: var(--bg);
	}
	.icon-tile.accent {
		border-color: rgba(94, 234, 212, 0.4);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		color: var(--accent);
	}

	/* Phase 1 — detected columns */
	.col-pill {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 11px;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--bg);
	}
	.col-name {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--fg);
	}
	.col-sample {
		font-size: 0.62rem;
		color: var(--fg-dim);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* AI banner */
	.ai-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.9rem 1.1rem;
		border: 1px solid rgba(94, 234, 212, 0.3);
		border-radius: 10px;
		background: color-mix(in srgb, var(--accent) 6%, transparent);
	}

	/* Phase 2 — mapping table */
	.map-head {
		display: grid;
		grid-template-columns: 1fr 28px 1.6fr 56px;
		gap: 0.75rem;
		padding: 0.6rem 1.1rem;
		border-bottom: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.map-row {
		display: grid;
		grid-template-columns: 1fr 28px 1.6fr 56px;
		gap: 0.75rem;
		padding: 0.85rem 1.1rem;
		border-bottom: 1px solid var(--border);
		align-items: start;
		transition: background 0.15s;
	}
	.map-row:last-child {
		border-bottom: none;
	}
	.map-row.accepted {
		background: color-mix(in srgb, var(--accent) 5%, transparent);
	}
	.map-row.unmapped {
		background: rgba(252, 165, 165, 0.04);
	}

	:global(.map-select) {
		width: 100% !important;
		max-width: 260px;
	}

	.accept-btn {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 7px;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--fg-dim);
		cursor: pointer;
		transition: all 0.15s;
	}
	.accept-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.accept-btn.on {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--bg);
	}

	/* Phase 3 — worker */
	.worker-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.35rem 0;
	}
	.worker-state {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 5px;
		flex-shrink: 0;
	}
	.worker-done {
		background: color-mix(in srgb, var(--palette-green) 18%, transparent);
		color: var(--palette-green);
	}
	.worker-analyzing {
		color: var(--accent);
	}
	.worker-queued {
		color: var(--fg-dim);
	}
	.spinner {
		width: 13px;
		height: 13px;
		border-radius: 50%;
		border: 2px solid rgba(94, 234, 212, 0.25);
		border-top-color: var(--accent);
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Phase 3 — threat cards */
	.threat-card {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
		padding: 0.9rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-elev);
		transition: border-color 0.15s, opacity 0.15s;
	}
	.threat-card.accepted {
		border-color: rgba(94, 234, 212, 0.5);
		background: color-mix(in srgb, var(--accent) 5%, transparent);
	}
	.threat-card.dismissed {
		opacity: 0.45;
	}
	.score-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border-radius: 9px;
		flex-shrink: 0;
		border: 1px solid var(--score-c);
		background: color-mix(in srgb, var(--score-c) 12%, transparent);
	}
	.score-n {
		font-family: var(--mono);
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1;
		color: var(--score-c);
	}
	.score-l {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin-top: 2px;
	}
	.ref-chip {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
		padding: 1px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
	}

	/* Phase 4 — tallies */
	.tally {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 0.9rem 1rem;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--bg);
	}
	.tally-n {
		font-family: var(--mono);
		font-size: 1.6rem;
		font-weight: 700;
		line-height: 1;
		color: var(--fg);
	}
	.tally-l {
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fg-dim);
		font-family: var(--mono);
	}

	.done-banner {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.85rem 1.1rem;
		border: 1px solid rgba(52, 211, 153, 0.4);
		border-radius: 10px;
		background: rgba(52, 211, 153, 0.08);
		font-size: 0.82rem;
		color: var(--fg);
	}
</style>
