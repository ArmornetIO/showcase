<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// Org Onboarding Wizard — mockup
	//
	// A single navigable wizard covering the lightweight onboarding steps. The
	// heavy GenAI step (risk-register import → schema mapping → threat recs) lives
	// in its own mockup: /showcase/mockups/onboarding-risk-mapping
	//
	// API surface this would drive (see docs/design/org-onboarding/*):
	//   EULA/Privacy   → NET-NEW in internal/identity + dbmgr migrations
	//                    POST /api/legal/accept { document_id, version }
	//   Org details    → patchOrg(org_id, name, slug)              [$lib/api/auth]
	//                    saveOrgProfile({ logo, website, description,
	//                                     data_classes[], certifications[] })  [$lib/api/orgProfile]
	//   Alerting       → POST /api/integrations/alerts { kind, url, events[] }  [$lib/api/integrations]
	//                    GET  /api/integrations/alert-events
	//   Configure hub  → SelfTrustPanel / AssessmentWorkspace / risk-import
	// ─────────────────────────────────────────────────────────────────────────
	import Icon, { type IconName } from '$lib/icons/Icon.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import FormField from '$lib/primitives/FormField.svelte';
	import Input from '$lib/primitives/Input.svelte';
	import Textarea from '$lib/primitives/Textarea.svelte';
	import Checkbox from '$lib/primitives/Checkbox.svelte';
	import Toggle from '$lib/primitives/Toggle.svelte';
	import SteppedProgress from '$lib/display/progress/SteppedProgress.svelte';

	const STEPS = ['EULA', 'Privacy', 'Org details', 'Alerting', 'Configure', 'Done'];
	let step = $state(0);
	const isLast = $derived(step === STEPS.length - 1);

	function next() {
		if (step < STEPS.length - 1) step += 1;
	}
	function back() {
		if (step > 0) step -= 1;
	}
	function goto(i: number) {
		step = i;
	}

	// ── Step 1/2 — legal acceptance ─────────────────────────────────────────
	let eulaAgreed = $state(false);
	let privacyAgreed = $state(false);

	// ── Step 3 — org details (mirrors settings/org real shapes) ─────────────
	let orgName = $state('Acme Security');
	let orgSlug = $state('acme-security');
	let logo = $state('');
	let website = $state('acme.com');
	let description = $state('');
	const DATA_CLASSES = ['none', 'internal', 'confidential', 'pii', 'pci', 'phi'];
	let dataClasses = $state<string[]>(['internal', 'pii']);
	function toggleDataClass(dc: string) {
		dataClasses = dataClasses.includes(dc)
			? dataClasses.filter((x) => x !== dc)
			: [...dataClasses, dc];
	}
	const CERT_FRAMEWORKS = [
		{ value: 'soc2', label: 'SOC 2' },
		{ value: 'iso27001', label: 'ISO 27001' },
		{ value: 'hipaa', label: 'HIPAA' },
		{ value: 'pci_dss', label: 'PCI DSS' },
		{ value: 'gdpr', label: 'GDPR' }
	];
	let certs = $state<{ framework: string; url: string }[]>([{ framework: 'soc2', url: '' }]);
	let newCertFw = $state('iso27001');
	let newCertUrl = $state('');
	function addCert() {
		if (certs.some((c) => c.framework === newCertFw)) return;
		certs = [...certs, { framework: newCertFw, url: newCertUrl.trim() }];
		newCertUrl = '';
	}
	function removeCert(fw: string) {
		certs = certs.filter((c) => c.framework !== fw);
	}
	const certLabel = (v: string) => CERT_FRAMEWORKS.find((f) => f.value === v)?.label ?? v;

	// ── Step 4 — alerting (mirrors $lib/api/integrations) ───────────────────
	type Channel = { kind: 'slack' | 'webhook' | 'email'; label: string; icon: IconName; status: 'connect' | 'connected' | 'soon' };
	let channels = $state<Channel[]>([
		{ kind: 'slack', label: 'Slack', icon: 'message-square', status: 'connect' },
		{ kind: 'webhook', label: 'Webhook', icon: 'link', status: 'connect' },
		{ kind: 'email', label: 'Email', icon: 'send', status: 'soon' }
	]);
	function connectChannel(k: Channel['kind']) {
		channels = channels.map((c) =>
			c.kind === k && c.status !== 'soon' ? { ...c, status: 'connected' } : c
		);
	}
	// Event catalog — `live` = actually fires a producer today (see alerting-backend-gaps.md)
	type AlertEvent = { id: string; label: string; live: boolean };
	let events = $state<(AlertEvent & { on: boolean })[]>([
		{ id: 'assessment.completed', label: 'Vendor assessment finding', live: true, on: true },
		{ id: 'supply_chain.incident', label: 'Supply-chain incident sent to channel', live: true, on: true },
		{ id: 'risk.reminder', label: 'Risk review reminder', live: true, on: false },
		{ id: 'vendor.review_overdue', label: 'Vendor review overdue', live: false, on: false },
		{ id: 'vendor.risk_score_changed', label: 'Vendor risk score changed', live: false, on: false },
		{ id: 'supply_chain.vulnerability', label: 'New CVE in a dependency', live: false, on: false },
		{ id: 'proxy.auth_failure', label: 'Proxy auth failure', live: false, on: false }
	]);
	function toggleEvent(id: string) {
		events = events.map((e) => (e.id === id ? { ...e, on: !e.on } : e));
	}

	// ── Step 5 — optional configure hub ─────────────────────────────────────
	const configureItems: {
		key: string;
		icon: IconName;
		title: string;
		blurb: string;
		reuse: string;
		href: string;
		featured?: boolean;
	}[] = [
		{
			key: 'trust',
			icon: 'shield',
			title: 'Trust Center',
			blurb: 'Publish your security posture, subprocessors, and certifications to customers.',
			reuse: 'SelfTrustPanel',
			href: 'trust-center'
		},
		{
			key: 'assessment',
			icon: 'clipboard-check',
			title: 'Self assessment',
			blurb: "Complete your organization's internal compliance posture — required before you can publish trust.",
			reuse: 'AssessmentWorkspace · variant="self"',
			href: 'settings-org'
		},
		{
			key: 'risk',
			icon: 'zap',
			title: 'Import risk register',
			blurb: 'Upload your existing risk register (CSV). GenAI maps your schema to the armornet risk model and recommends threats.',
			reuse: 'NET-NEW · GenAI',
			href: 'onboarding-risk-mapping',
			featured: true
		}
	];
	let doneItems = $state<Record<string, boolean>>({});
	function markDone(k: string) {
		doneItems = { ...doneItems, [k]: true };
	}
</script>

<svelte:head><title>Org Onboarding Wizard — Armornet</title></svelte:head>

<div class="mx-auto max-w-[720px] px-6 py-10">
	<!-- Header -->
	<div class="mb-2">
		<span class="block font-mono text-[0.65rem] tracking-[0.18em] uppercase text-[var(--fg-dim)]">
			// onboarding · first-run setup
		</span>
	</div>
	<h1 class="text-[2rem] font-bold leading-tight text-[var(--fg)] mb-6">
		Set up your <span class="text-[var(--accent)]">organization.</span>
	</h1>

	<!-- Stepper -->
	<div class="mb-8">
		<SteppedProgress steps={STEPS} current={step} active={step} onstep={goto} stepStyle="blocks" />
	</div>

	<!-- Step body -->
	<div class="min-h-[380px]">
		{#if step === 0}
			<!-- ── EULA ─────────────────────────────────────────────── -->
			<section class="flex flex-col gap-4">
				<div class="flex items-center gap-2">
					<h2 class="text-[1.05rem] font-semibold text-[var(--fg)]">End User License Agreement</h2>
					<span class="font-mono text-[0.6rem] tracking-widest uppercase px-2 py-0.5 rounded border border-[rgba(252,211,77,0.4)] text-[var(--palette-amber)]">net-new backend</span>
				</div>
				<p class="text-[0.8rem] text-[var(--fg-dim)] leading-relaxed">
					Acceptance is stored in the identity layer, keyed on your user id and version. You'll be
					re-prompted only when the agreement changes.
				</p>
				<div class="h-[190px] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-4 text-[0.75rem] leading-relaxed text-[var(--fg-muted)] font-mono">
					<p class="mb-3"><strong class="text-[var(--fg)]">1. License grant.</strong> Armornet grants you a non-exclusive, non-transferable license to use the platform in accordance with these terms…</p>
					<p class="mb-3"><strong class="text-[var(--fg)]">2. Restrictions.</strong> You may not resell, reverse engineer, or use the service to build a competing product…</p>
					<p class="mb-3"><strong class="text-[var(--fg)]">3. Data.</strong> You retain ownership of your data. Armornet processes it solely to provide the service…</p>
					<p class="mb-3"><strong class="text-[var(--fg)]">4. Warranty & liability.</strong> The service is provided "as is". Aggregate liability is limited to fees paid in the prior 12 months…</p>
					<p class="mb-0"><strong class="text-[var(--fg)]">5. Termination.</strong> Either party may terminate on 30 days' notice. Sections 3–4 survive termination…</p>
				</div>
				<label class="flex items-center gap-3 cursor-pointer select-none">
					<Checkbox checked={eulaAgreed} onchange={() => (eulaAgreed = !eulaAgreed)} />
					<span class="text-[0.82rem] text-[var(--fg)]">I have read and agree to the End User License Agreement.</span>
				</label>
			</section>
		{:else if step === 1}
			<!-- ── Privacy ──────────────────────────────────────────── -->
			<section class="flex flex-col gap-4">
				<div class="flex items-center gap-2">
					<h2 class="text-[1.05rem] font-semibold text-[var(--fg)]">Privacy Policy</h2>
					<span class="font-mono text-[0.6rem] tracking-widest uppercase px-2 py-0.5 rounded border border-[rgba(252,211,77,0.4)] text-[var(--palette-amber)]">net-new backend</span>
				</div>
				<p class="text-[0.8rem] text-[var(--fg-dim)] leading-relaxed">
					How we collect, use, and protect your data. Acknowledgement is recorded per user and version.
				</p>
				<div class="h-[190px] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-4 text-[0.75rem] leading-relaxed text-[var(--fg-muted)] font-mono">
					<p class="mb-3"><strong class="text-[var(--fg)]">What we collect.</strong> Account details, org metadata, and the security signals your agents produce…</p>
					<p class="mb-3"><strong class="text-[var(--fg)]">How we use it.</strong> To operate the mesh, detect threats, and provide your console. We do not sell your data…</p>
					<p class="mb-3"><strong class="text-[var(--fg)]">Encryption at rest.</strong> Correlatable fields are encrypted with AES-256-GCM keyed by your KEK…</p>
					<p class="mb-3"><strong class="text-[var(--fg)]">Subprocessors.</strong> A current list of subprocessors is published on our own Trust Center…</p>
					<p class="mb-0"><strong class="text-[var(--fg)]">Your rights.</strong> Access, export, and deletion requests are honored per applicable law…</p>
				</div>
				<label class="flex items-center gap-3 cursor-pointer select-none">
					<Checkbox checked={privacyAgreed} onchange={() => (privacyAgreed = !privacyAgreed)} />
					<span class="text-[0.82rem] text-[var(--fg)]">I acknowledge the Privacy Policy.</span>
				</label>
			</section>
		{:else if step === 2}
			<!-- ── Org details ──────────────────────────────────────── -->
			<section class="flex flex-col gap-6">
				<div>
					<h2 class="text-[0.65rem] tracking-[0.2em] uppercase font-mono text-[var(--fg-dim)] mb-3">General</h2>
					<div class="flex flex-col gap-4">
						<div style="max-width:none">
							<FormField label="Org name" id="w-name" required>
								<Input id="w-name" bind:value={orgName} placeholder="Acme Security" />
							</FormField>
						</div>
						<div style="max-width:none">
							<FormField label="Slug" id="w-slug" hint="Used in your workspace URL.">
								<Input id="w-slug" bind:value={orgSlug} placeholder="acme-security" />
							</FormField>
						</div>
					</div>
				</div>
				<div>
					<h2 class="text-[0.65rem] tracking-[0.2em] uppercase font-mono text-[var(--fg-dim)] mb-1">Trust profile</h2>
					<p class="text-[0.72rem] text-[var(--fg-dim)] mb-3 leading-relaxed">
						Your public identity on your Trust Center. Stored encrypted at rest.
					</p>
					<div class="flex flex-col gap-4">
						<div style="max-width:none">
							<FormField label="Website" id="w-web">
								<Input id="w-web" bind:value={website} placeholder="acme.com" />
							</FormField>
						</div>
						<div style="max-width:none">
							<FormField label="Description" id="w-desc" hint="One-line summary shown in the hero.">
								<Textarea id="w-desc" bind:value={description} rows={2} placeholder="What your company does…" />
							</FormField>
						</div>
						<div>
							<span class="block text-[0.72rem] font-mono text-[var(--fg-dim)] mb-2">Data classes handled</span>
							<div class="flex flex-wrap gap-2">
								{#each DATA_CLASSES as dc}
									{@const active = dataClasses.includes(dc)}
									<button
										type="button"
										onclick={() => toggleDataClass(dc)}
										class="px-3 py-1.5 rounded-md border text-[0.72rem] font-mono uppercase tracking-wider transition-colors {active
											? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]'
											: 'border-[var(--border)] text-[var(--fg-dim)] hover:border-[var(--fg-dim)]'}"
									>{dc}</button>
								{/each}
							</div>
						</div>
						<div>
							<span class="block text-[0.72rem] font-mono text-[var(--fg-dim)] mb-2">Certifications</span>
							{#if certs.length}
								<div class="flex flex-col gap-2 mb-3">
									{#each certs as cert (cert.framework)}
										<div class="flex items-center justify-between gap-3 px-3 py-2 bg-[var(--bg-elev)] border border-[var(--border)] rounded-md">
											<span class="text-[0.68rem] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)]">{certLabel(cert.framework)}</span>
											<span class="flex-1 font-mono text-[0.72rem] text-[var(--fg-dim)] truncate">{cert.url || '— no link —'}</span>
											<button type="button" onclick={() => removeCert(cert.framework)} class="text-[var(--fg-dim)] hover:text-[var(--palette-red)]" aria-label="Remove"><Icon name="x" size={14} /></button>
										</div>
									{/each}
								</div>
							{/if}
							<div class="flex items-end gap-2">
								<div style="max-width:none">
									<FormField label="Framework" id="w-fw">
										<select id="w-fw" bind:value={newCertFw} class="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg)] text-[0.8rem] font-mono focus:outline-none focus:border-[var(--accent)]">
											{#each CERT_FRAMEWORKS as fw}<option value={fw.value}>{fw.label}</option>{/each}
										</select>
									</FormField>
								</div>
								<div class="flex-1" style="max-width:none">
									<FormField label="Report URL (optional)" id="w-url">
										<Input id="w-url" bind:value={newCertUrl} placeholder="https://acme.com/soc2" />
									</FormField>
								</div>
								<div class="pb-[1px]"><Button variant="ghost" size="md" onclick={addCert}>Add</Button></div>
							</div>
						</div>
					</div>
				</div>
			</section>
		{:else if step === 3}
			<!-- ── Alerting ─────────────────────────────────────────── -->
			<section class="flex flex-col gap-6">
				<div>
					<h2 class="text-[1.05rem] font-semibold text-[var(--fg)] mb-1">Alerting & notifications</h2>
					<p class="text-[0.8rem] text-[var(--fg-dim)] leading-relaxed">
						Choose where alerts go and what you want to hear about. You can change this anytime under
						<span class="font-mono text-[var(--fg-muted)]">Integrations</span>.
					</p>
				</div>
				<div>
					<span class="block text-[0.72rem] font-mono text-[var(--fg-dim)] mb-2">Delivery channels</span>
					<div class="grid grid-cols-3 gap-3">
						{#each channels as ch}
							<div class="flex flex-col items-center gap-2 p-4 rounded-lg border {ch.status === 'connected' ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]' : 'border-[var(--border)] bg-[var(--bg-elev)]'}">
								<Icon name={ch.icon} size={20} class={ch.status === 'connected' ? 'text-[var(--accent)]' : 'text-[var(--fg-dim)]'} />
								<span class="text-[0.82rem] font-medium text-[var(--fg)]">{ch.label}</span>
								{#if ch.status === 'soon'}
									<span class="font-mono text-[0.58rem] tracking-widest uppercase text-[var(--fg-dim)]">coming soon</span>
								{:else if ch.status === 'connected'}
									<span class="font-mono text-[0.58rem] tracking-widest uppercase text-[var(--accent)]">✓ connected</span>
								{:else}
									<button type="button" onclick={() => connectChannel(ch.kind)} class="font-mono text-[0.62rem] tracking-widest uppercase text-[var(--accent)] hover:underline">Connect</button>
								{/if}
							</div>
						{/each}
					</div>
				</div>
				<div>
					<span class="block text-[0.72rem] font-mono text-[var(--fg-dim)] mb-2">Notify me about</span>
					<div class="flex flex-col gap-1.5">
						{#each events as ev}
							<div class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)]">
								<div class="flex items-center gap-2 min-w-0">
									<span class="text-[0.82rem] text-[var(--fg)] truncate">{ev.label}</span>
									{#if !ev.live}
										<span class="shrink-0 font-mono text-[0.55rem] tracking-widest uppercase px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--fg-dim)]">soon</span>
									{/if}
								</div>
								<Toggle checked={ev.on} label={ev.label} onchange={() => toggleEvent(ev.id)} />
							</div>
						{/each}
					</div>
					<p class="mt-2 text-[0.68rem] text-[var(--fg-dim)] font-mono">
						Events marked <span class="uppercase">soon</span> are in the catalog but not yet wired to a producer.
					</p>
				</div>
			</section>
		{:else if step === 4}
			<!-- ── Optional configure hub ───────────────────────────── -->
			<section class="flex flex-col gap-4">
				<div>
					<h2 class="text-[1.05rem] font-semibold text-[var(--fg)] mb-1">Optional setup</h2>
					<p class="text-[0.8rem] text-[var(--fg-dim)] leading-relaxed">
						Do these now or later from Settings. Each opens the same tools you'll use day-to-day.
					</p>
				</div>
				<div class="flex flex-col gap-3">
					{#each configureItems as item}
						<div class="flex items-start gap-4 p-4 rounded-lg border {item.featured ? 'border-[rgba(94,234,212,0.45)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]' : 'border-[var(--border)] bg-[var(--bg-elev)]'}">
							<div class="mt-0.5 shrink-0 w-9 h-9 rounded-md flex items-center justify-center border {item.featured ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--fg-dim)]'}">
								<Icon name={item.icon} size={18} />
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="text-[0.9rem] font-semibold text-[var(--fg)]">{item.title}</span>
									<span class="font-mono text-[0.55rem] tracking-widest uppercase px-1.5 py-0.5 rounded border {item.featured ? 'border-[rgba(252,211,77,0.4)] text-[var(--palette-amber)]' : 'border-[var(--border)] text-[var(--fg-dim)]'}">{item.reuse}</span>
								</div>
								<p class="text-[0.75rem] text-[var(--fg-dim)] leading-relaxed mt-1">{item.blurb}</p>
							</div>
							<div class="shrink-0 self-center">
								{#if doneItems[item.key]}
									<span class="font-mono text-[0.62rem] tracking-widest uppercase text-[var(--accent)]">✓ done</span>
								{:else}
									<Button variant={item.featured ? 'primary' : 'solid'} size="sm" onclick={() => markDone(item.key)}>
										{item.featured ? 'Import' : 'Configure'}
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				<p class="text-[0.68rem] text-[var(--fg-dim)] font-mono mt-1">
					The risk register import is the GenAI step — see the
					<span class="text-[var(--accent)]">onboarding-risk-mapping</span> mockup for the full flow.
				</p>
			</section>
		{:else}
			<!-- ── Done ─────────────────────────────────────────────── -->
			<section class="flex flex-col items-center text-center gap-4 py-8">
				<div class="w-14 h-14 rounded-full flex items-center justify-center border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]">
					<Icon name="check" size={28} />
				</div>
				<h2 class="text-[1.3rem] font-bold text-[var(--fg)]">You're set up.</h2>
				<p class="text-[0.82rem] text-[var(--fg-dim)] max-w-[40ch] leading-relaxed">
					<span class="text-[var(--fg)]">{orgName}</span> is ready. Alerts route to your connected
					channels, and you can finish optional setup anytime from Settings.
				</p>
				<div class="mt-2"><Button variant="primary" size="md">Go to console</Button></div>
			</section>
		{/if}
	</div>

	<!-- Footer nav -->
	<div class="flex items-center justify-between mt-8 pt-5 border-t border-[var(--border)]">
		<Button variant="ghost" size="md" onclick={back} disabled={step === 0}>Back</Button>
		<span class="font-mono text-[0.62rem] tracking-widest uppercase text-[var(--fg-dim)]">
			Step {step + 1} / {STEPS.length} · {STEPS[step]}
		</span>
		{#if !isLast}
			<Button
				variant="primary"
				size="md"
				onclick={next}
				disabled={(step === 0 && !eulaAgreed) || (step === 1 && !privacyAgreed)}
			>
				{step === 4 ? 'Finish' : 'Continue'}
			</Button>
		{:else}
			<span class="w-[72px]"></span>
		{/if}
	</div>
</div>
