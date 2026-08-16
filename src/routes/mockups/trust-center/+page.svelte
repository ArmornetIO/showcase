<script lang="ts">
	// /trust/:token — Invite-only Trust Center
	//
	// A gated, "flashy" rendered PROJECTION of an APPROVED vendor assessment.
	// There is NO editor: every module below is populated from data the app
	// already stores. The private link IS the gate (extends existing share-token
	// infra: SharePanel.svelte / GET /api/shared/assessment/:token).
	//
	// Auto-send trigger (baked into review/sales process): a rule on the
	// ActivityEvent feed mints + emails a private link when the assessment hits
	//   assessment_status === 'approved'  &&  review_status === 'current'
	//   &&  passed === true  &&  open_critical === 0
	//
	// API stub (read-only, single payload — the allow-list projection):
	//   GET /api/shared/trust/:token → TrustProfile  (unauthenticated)
	//
	// Data shapes backed by internal/trust.TrustProfile today (snake_case):
	//   vendor      { name, website, description, criticality, data_classes[], certifications[]{framework, url} }
	//   assessment  { score, pass_threshold, passed, open_critical, open_warnings }
	//   breakdown[] { section_id, section_title, score }                  (ScoreResult.breakdown)
	//   subprocessors[] { name, purpose, location }
	//
	// NOT yet in the projection (path #2 enrichment — mock-only below): controls[],
	// per-cert dates/labels, vuln-scan score, review dates.

	import HexShield from '$lib/display/HexShield.svelte';
	import RadialProgress from '$lib/display/progress/RadialProgress.svelte';
	import ProgressBar from '$lib/display/progress/ProgressBar.svelte';
	import StatTile from '$lib/display/metric/StatTile.svelte';
	import FaqAccordion from '$lib/display/FaqAccordion.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import StatusBadge from '$lib/primitives/StatusBadge.svelte';
	import Button from '$lib/primitives/Button.svelte';

	// ── Mock payload (would arrive from GET /api/shared/trust/:token) ───────────

	const vendor = {
		name: 'Armornet',
		website: 'armornet.io',
		description:
			'Autonomous vendor-risk & supply-chain security platform. Continuous assessment of third-party posture across your entire vendor mesh.',
		criticality: 'high',
		data_classes: ['pii', 'confidential', 'internal'] as const,
		// certifications[]: { framework, url } — the ready-made badge grid.
		// (label is derived from framework; a null url = not published.)
		certifications: [
			{ framework: 'soc2', label: 'SOC 2 Type II', url: '#' },
			{ framework: 'iso27001', label: 'ISO 27001', url: '#' },
			{ framework: 'pci_dss', label: 'PCI DSS', url: '#' },
			{ framework: 'hipaa', label: 'HIPAA', url: '#' },
			{ framework: 'gdpr', label: 'GDPR', url: '#' },
			{ framework: 'fedramp', label: 'FedRAMP', url: null }
		]
	};

	const assessment = {
		score: 0.94, // 0..1
		pass_threshold: 0.75,
		passed: true,
		open_critical: 0,
		open_warnings: 2
	};

	const score_pct = Math.round(assessment.score * 100);

	// ScoreResult.breakdown — template sections (vendor-risk.yaml) with per-domain scores.
	const breakdown = [
		{ section_id: 'enc', section_title: 'Encryption & Data Protection', score: 0.98 },
		{ section_id: 'acc', section_title: 'Access Control & Authentication', score: 0.95 },
		{ section_id: 'ir', section_title: 'Incident Response & Business Continuity', score: 0.9 },
		{ section_id: 'sub', section_title: 'Sub-processors & Privacy', score: 0.88 },
		{ section_id: 'vuln', section_title: 'Vulnerability Management', score: 0.93 }
	];

	function scoreVariant(s: number): 'success' | 'accent' | 'warn' {
		if (s >= 0.95) return 'success';
		if (s >= 0.85) return 'accent';
		return 'warn';
	}

	// Per-question Reference.control citations → ready-made controls-coverage grid.
	const controls = [
		{ framework: 'SOC 2', control: 'CC6.1', title: 'Logical access — least privilege', status: 'verified' },
		{ framework: 'SOC 2', control: 'CC6.7', title: 'Data in transit encrypted (TLS 1.3)', status: 'verified' },
		{ framework: 'SOC 2', control: 'CC7.1', title: 'Continuous vuln detection', status: 'verified' },
		{ framework: 'ISO 27001', control: 'A.10.1.1', title: 'Cryptographic controls policy', status: 'verified' },
		{ framework: 'ISO 27001', control: 'A.9.4.2', title: 'Secure log-on (MFA enforced)', status: 'verified' },
		{ framework: 'GDPR', control: 'Art. 28', title: 'Processor obligations / DPA', status: 'verified' },
		{ framework: 'GDPR', control: 'Art. 33', title: 'Breach notification (72h)', status: 'verified' },
		{ framework: 'NIST-CSF', control: 'PR.AC-7', title: 'Identity proofing & binding', status: 'verified' },
		{ framework: 'NIST-CSF', control: 'DE.CM-8', title: 'Vulnerability scans performed', status: 'attention' }
	];

	const subprocessors = [
		{ name: 'Amazon Web Services', purpose: 'Cloud infrastructure & hosting', location: 'US-East, EU-West' },
		{ name: 'Cloudflare', purpose: 'CDN, WAF & DDoS protection', location: 'Global (edge)' },
		{ name: 'Anthropic', purpose: 'LLM inference for assessment engine', location: 'US' },
		{ name: 'Stripe', purpose: 'Billing & payment processing', location: 'US, EU' }
	];

	const DATA_CLASS_LABEL: Record<string, string> = {
		pii: 'PII', pci: 'PCI', phi: 'PHI', confidential: 'Confidential', internal: 'Internal', none: 'None'
	};

	const faq = [
		{
			q: 'Is this trust profile continuously updated?',
			a: 'Yes. The page is a live projection of Armornet’s approved assessment. When a control’s evidence changes or a re-review completes, this page reflects it automatically — there is no manually-edited copy.'
		},
		{
			q: 'How do I access the full evidence pack (SOC 2 report, pentest summary)?',
			a: 'Your invite already grants evidence access. Use “Request evidence pack” below — the full report bundle is released to the invited email on this private link.'
		},
		{
			q: 'Where does the data on this page come from?',
			a: 'Directly from Armornet’s completed vendor-risk assessment: certifications, per-control framework mappings (SOC 2 / ISO 27001 / GDPR / NIST-CSF), section scores, and sub-processor declarations.'
		},
		{
			q: 'Can I share this link with my security team?',
			a: 'This link is scoped to your organization. You can forward it internally; access is logged.'
		}
	];

	let requested = $state(false);
	function requestEvidence() {
		requested = true;
	}
</script>

<svelte:head><title>Armornet — Trust Center</title></svelte:head>

<div class="min-h-screen bg-[var(--page-bg)] text-[var(--fg)]">
	<div class="mx-auto max-w-[1120px] px-6 pb-24">
		<!-- ── Hero ──────────────────────────────────────────────────────────── -->
		<section class="grid grid-cols-1 items-center gap-8 pt-12 pb-10 lg:grid-cols-[1.4fr_1fr]">
			<div>
				<div class="mb-4 flex items-center gap-3">
					<div
						class="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--border-accent)] bg-[var(--bg-elev)] text-lg font-bold text-[var(--accent)]"
					>
						A
					</div>
					<div>
						<div class="text-[1.35rem] font-semibold leading-none">{vendor.name}</div>
						<a href="https://{vendor.website}" class="text-[0.8rem] text-[var(--accent)] hover:underline"
							>{vendor.website}</a
						>
					</div>
					<div class="ml-1">
						<StatusBadge status="healthy" label="Assessment approved" dot filled />
					</div>
				</div>

				<h1 class="mb-3 text-[2.1rem] font-bold leading-[1.15] tracking-tight">
					Security you can verify —<br />
					<span class="text-[var(--accent)]">before you sign.</span>
				</h1>
				<p class="mb-6 max-w-[46ch] text-[0.95rem] leading-relaxed text-[var(--fg-dim)]">
					{vendor.description}
				</p>

				<div class="flex flex-wrap items-center gap-3">
					<Button variant="primary" size="md" onclick={requestEvidence}>
						{requested ? '✓ Evidence pack sent' : 'Request evidence pack'}
					</Button>
					<Button variant="ghost" size="md" href="#controls">View controls coverage</Button>
				</div>
			</div>

			<!-- Posture: RadialProgress over the HexShield motif -->
			<div class="relative flex items-center justify-center">
				<div class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40">
					<HexShield />
				</div>
				<div
					class="relative z-10 flex flex-col items-center rounded-2xl border border-[var(--border-accent)] bg-[color-mix(in_srgb,var(--bg-elev)_82%,transparent)] px-8 py-7 backdrop-blur-sm"
				>
					<RadialProgress value={score_pct} size={148} strokeWidth={10} variant="success" label="Trust score" />
					<div class="mt-3 text-center font-mono text-[0.68rem] text-[var(--fg-dim)]">
						PASS THRESHOLD {Math.round(assessment.pass_threshold * 100)} · <span class="text-[var(--accent-emerald)]">PASSED</span>
					</div>
				</div>
			</div>
		</section>

		<!-- ── Metrics strip ─────────────────────────────────────────────────── -->
		<section class="grid grid-cols-2 gap-3 pb-12 md:grid-cols-4">
			<StatTile label="Certifications" value="{vendor.certifications.filter((c) => c.url).length} active" halo="mint" mono />
			<StatTile label="Controls verified" value="{controls.filter((c) => c.status === 'verified').length}/{controls.length}" halo="cyan" mono />
			<StatTile label="Open critical" value={String(assessment.open_critical)} sub="none outstanding" subVariant="up" halo="emerald" mono />
			<StatTile label="Open warnings" value={String(assessment.open_warnings)} sub="continuously monitored" halo="blue" mono />
		</section>

		<!-- ── Compliance badge grid ─────────────────────────────────────────── -->
		<section class="pb-12">
			<h2 class="mb-1 text-[1.05rem] font-semibold">Compliance & certifications</h2>
			<p class="mb-5 text-[0.82rem] text-[var(--fg-dim)]">Independently attested. Click any badge for the report.</p>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
				{#each vendor.certifications as cert}
					{@const active = !!cert.url}
					<a
						href={cert.url ?? undefined}
						class="group flex flex-col items-center rounded-xl border p-4 text-center transition-colors {active
							? 'border-[var(--border-accent)] bg-[var(--bg-elev)] hover:border-[var(--accent)]'
							: 'border-[var(--border)] bg-transparent opacity-55'}"
						class:pointer-events-none={!active}
					>
						<div
							class="mb-2 flex h-10 w-10 items-center justify-center rounded-full border {active
								? 'border-[var(--accent)] text-[var(--accent)]'
								: 'border-[var(--border)] text-[var(--fg-muted)]'}"
						>
							{#if active}✓{:else}◌{/if}
						</div>
						<div class="text-[0.78rem] font-semibold leading-tight">{cert.label}</div>
						<div class="mt-1 font-mono text-[0.62rem] text-[var(--fg-muted)]">
							{active ? 'attested' : 'not published'}
						</div>
					</a>
				{/each}
			</div>
		</section>

		<!-- ── Security posture by domain ────────────────────────────────────── -->
		<section class="pb-12">
			<h2 class="mb-1 text-[1.05rem] font-semibold">Security posture by domain</h2>
			<p class="mb-5 text-[0.82rem] text-[var(--fg-dim)]">Scored across the assessment’s control sections.</p>
			<div class="grid grid-cols-1 gap-x-10 gap-y-5 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 md:grid-cols-2">
				{#each breakdown as d}
					<div>
						<div class="mb-1.5 flex items-baseline justify-between gap-3">
							<span class="text-[0.85rem] font-medium">{d.section_title}</span>
							<span class="font-mono text-[0.75rem] text-[var(--fg-dim)]">
								{Math.round(d.score * 100)}
							</span>
						</div>
						<ProgressBar type="linear" value={Math.round(d.score * 100)} variant={scoreVariant(d.score)} size="sm" showPercent={false} animate />
					</div>
				{/each}
			</div>
		</section>

		<!-- ── Controls coverage grid ────────────────────────────────────────── -->
		<section id="controls" class="pb-12">
			<h2 class="mb-1 text-[1.05rem] font-semibold">Controls coverage</h2>
			<p class="mb-5 text-[0.82rem] text-[var(--fg-dim)]">
				Every answer is mapped to its framework control — SOC 2, ISO 27001, GDPR, NIST-CSF.
			</p>
			<div class="overflow-hidden rounded-xl border border-[var(--border)]">
				<table class="w-full border-collapse text-left text-[0.82rem]">
					<thead>
						<tr class="bg-[var(--bg-elev)] font-mono text-[0.68rem] uppercase tracking-wider text-[var(--fg-muted)]">
							<th class="px-4 py-2.5 font-normal">Framework</th>
							<th class="px-4 py-2.5 font-normal">Control</th>
							<th class="px-4 py-2.5 font-normal">Requirement</th>
							<th class="px-4 py-2.5 text-right font-normal">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each controls as c}
							<tr class="border-t border-[var(--border)]">
								<td class="px-4 py-2.5">
									<Chip look="ghost" color={c.framework === 'GDPR' ? 'blue' : c.framework === 'NIST-CSF' ? 'cyan' : 'accent'}>
										{c.framework}
									</Chip>
								</td>
								<td class="px-4 py-2.5 font-mono text-[var(--fg)]">{c.control}</td>
								<td class="px-4 py-2.5 text-[var(--fg-dim)]">{c.title}</td>
								<td class="px-4 py-2.5 text-right">
									{#if c.status === 'verified'}
										<span class="font-mono text-[0.72rem] text-[var(--accent-emerald)]">✓ verified</span>
									{:else}
										<span class="font-mono text-[0.72rem] text-[var(--palette-amber)]">◐ monitoring</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<!-- ── Data handling + Subprocessors ─────────────────────────────────── -->
		<section class="grid grid-cols-1 gap-6 pb-12 lg:grid-cols-[0.8fr_1.2fr]">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
				<h3 class="mb-1 text-[0.95rem] font-semibold">Data handling</h3>
				<p class="mb-4 text-[0.8rem] text-[var(--fg-dim)]">Classes of data permitted under review.</p>
				<div class="flex flex-wrap gap-2">
					{#each vendor.data_classes as dc}
						<Chip look="filled" color={dc === 'pii' ? 'warn' : 'accent'}>{DATA_CLASS_LABEL[dc]}</Chip>
					{/each}
				</div>
				<div class="mt-5 border-t border-[var(--border)] pt-4 font-mono text-[0.72rem] text-[var(--fg-dim)]">
					<div class="flex justify-between py-1"><span>Criticality tier</span><span class="text-[var(--fg)]">{vendor.criticality}</span></div>
					<div class="flex justify-between py-1"><span>Open warnings</span><span class="text-[var(--palette-amber)]">{assessment.open_warnings}</span></div>
				</div>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
				<h3 class="mb-1 text-[0.95rem] font-semibold">Sub-processors</h3>
				<p class="mb-4 text-[0.8rem] text-[var(--fg-dim)]">Third parties in the data path.</p>
				<div class="flex flex-col divide-y divide-[var(--border)]">
					{#each subprocessors as sp}
						<div class="flex items-center justify-between gap-4 py-2.5">
							<div>
								<div class="text-[0.85rem] font-medium">{sp.name}</div>
								<div class="text-[0.75rem] text-[var(--fg-dim)]">{sp.purpose}</div>
							</div>
							<div class="whitespace-nowrap font-mono text-[0.7rem] text-[var(--fg-muted)]">{sp.location}</div>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- ── FAQ ───────────────────────────────────────────────────────────── -->
		<section class="pb-12">
			<h2 class="mb-5 text-[1.05rem] font-semibold">Frequently asked</h2>
			<FaqAccordion items={faq} />
		</section>

		<!-- ── Evidence CTA ──────────────────────────────────────────────────── -->
		<section
			class="flex flex-col items-center gap-4 rounded-2xl border border-[var(--border-accent)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--bg-elev))] px-8 py-10 text-center"
		>
			<h2 class="text-[1.3rem] font-bold">Need the full evidence pack?</h2>
			<p class="max-w-[48ch] text-[0.88rem] text-[var(--fg-dim)]">
				Your invite includes evidence access. Release the SOC 2 Type II report, pen-test summary, and completed
				questionnaire to the invited email on this private link.
			</p>
			<Button variant="primary" size="lg" onclick={requestEvidence}>
				{requested ? '✓ Sent — check your inbox' : 'Release evidence pack'}
			</Button>
		</section>

		<!-- ── Provenance footer (the "no editor" story) ─────────────────────── -->
		<footer class="mt-10 flex flex-col items-center gap-2 border-t border-[var(--border)] pt-8 text-center">
			<div class="flex items-center gap-2 font-mono text-[0.68rem] text-[var(--fg-muted)]">
				<span class="text-[var(--accent)]">⬡ Verified by Armornet</span>
				<span class="opacity-40">·</span>
				<span>auto-generated from approved assessment — no manual editing</span>
			</div>
		</footer>
	</div>
</div>
