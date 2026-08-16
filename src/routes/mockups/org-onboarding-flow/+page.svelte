<script lang="ts">
	import { base } from '$app/paths';
	import StoryboardCanvas from '$lib/storyboard/StoryboardCanvas.svelte';
	import SwimLane from '$lib/storyboard/SwimLane.svelte';
	import StoryboardFrame from '$lib/storyboard/StoryboardFrame.svelte';
	import StoryboardArrow from '$lib/storyboard/StoryboardArrow.svelte';

	const WIZ = `${base}/mockups/onboarding-wizard`;
	const RISK = `${base}/mockups/onboarding-risk-mapping`;
</script>

<svelte:head><title>Org Onboarding Flow — Armornet</title></svelte:head>

<div class="flow-page">
	<div class="page-header">
		<span class="eyebrow">// onboarding · org creation flow</span>
		<h1 class="page-title">Org onboarding flow.</h1>
		<p class="page-sub">
			First-run setup. Legal acceptance is net-new (identity lib + migrations); org details,
			alerting, trust center and self-assessment reuse existing components; the risk-register import
			is the first end-to-end GenAI feature.
		</p>
	</div>

	<StoryboardCanvas>
		<!-- ── Lane 1: main onboarding path ─────────────────────────────── -->
		<SwimLane pill="ONBOARDING" sub="EULA → Privacy → Org details → Alerting → Optional setup">
			<!-- EULA -->
			<StoryboardFrame step={1} route="/ onboarding · eula" badge="NET-NEW" href={WIZ}>
				<div class="ms">
					<span class="ms-eyebrow">// onboarding · eula</span>
					<h2 class="ms-h2">License <span class="ms-accent">agreement.</span></h2>
					<div class="ms-doc">
						<p>1. License grant…</p>
						<p>2. Restrictions…</p>
						<p>3. Data ownership…</p>
						<p>4. Warranty & liability…</p>
					</div>
					<div class="ms-check"><span class="ms-box">✓</span> I have read and agree.</div>
					<div class="ms-btn ms-btn--primary">Accept & continue</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label={"POST /legal/accept\n(identity)"} />

			<!-- Privacy -->
			<StoryboardFrame step={2} route="/ onboarding · privacy" badge="NET-NEW" href={WIZ}>
				<div class="ms">
					<span class="ms-eyebrow">// onboarding · privacy</span>
					<h2 class="ms-h2">Privacy <span class="ms-accent">policy.</span></h2>
					<div class="ms-doc">
						<p>What we collect…</p>
						<p>How we use it…</p>
						<p>Encryption at rest…</p>
						<p>Your rights…</p>
					</div>
					<div class="ms-check"><span class="ms-box">✓</span> I acknowledge the policy.</div>
					<div class="ms-btn ms-btn--primary">Continue</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow />

			<!-- Org details -->
			<StoryboardFrame step={3} route="/ onboarding · org details" href={WIZ}>
				<div class="ms">
					<span class="ms-eyebrow">// onboarding · org</span>
					<h2 class="ms-h2">Org <span class="ms-accent">details.</span></h2>
					<div class="ms-field"><div class="ms-label">Org name</div><div class="ms-input">Acme Security</div></div>
					<div class="ms-field"><div class="ms-label">Slug</div><div class="ms-input">acme-security</div></div>
					<div class="ms-chips">
						<span class="ms-chip ms-chip--on">pii</span>
						<span class="ms-chip ms-chip--on">internal</span>
						<span class="ms-chip">confidential</span>
						<span class="ms-chip">phi</span>
					</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label={"patchOrg +\nsaveOrgProfile"} />

			<!-- Alerting -->
			<StoryboardFrame step={4} route="/ onboarding · alerting" href={WIZ}>
				<div class="ms">
					<span class="ms-eyebrow">// onboarding · alerting</span>
					<h2 class="ms-h2">Alerts <span class="ms-accent">& notifs.</span></h2>
					<div class="ms-tiles">
						<div class="ms-tile ms-tile--on">Slack</div>
						<div class="ms-tile">Webhook</div>
						<div class="ms-tile ms-tile--soon">Email</div>
					</div>
					<div class="ms-row"><span>Vendor finding</span><span class="ms-tog ms-tog--on"></span></div>
					<div class="ms-row"><span>Supply-chain incident</span><span class="ms-tog ms-tog--on"></span></div>
					<div class="ms-row ms-row--dim"><span>New CVE <em>soon</em></span><span class="ms-tog"></span></div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label={"POST /integrations\n/alerts"} />

			<!-- Optional setup hub -->
			<StoryboardFrame step={5} route="/ onboarding · optional" href={WIZ}>
				<div class="ms">
					<span class="ms-eyebrow">// onboarding · optional</span>
					<h2 class="ms-h2">Optional <span class="ms-accent">setup.</span></h2>
					<div class="ms-opt"><span class="ms-opt-i">▣</span><div><b>Trust Center</b><small>publish posture</small></div></div>
					<div class="ms-opt"><span class="ms-opt-i">▤</span><div><b>Self assessment</b><small>internal posture</small></div></div>
					<div class="ms-opt ms-opt--hot"><span class="ms-opt-i">⚡</span><div><b>Import risk register</b><small>GenAI mapping</small></div></div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow />

			<!-- Done -->
			<StoryboardFrame route="/ console" dashed>
				<div class="ms ms--center">
					<span class="ms-done">✓</span>
					<span class="ms-dest-name">You're set up</span>
					<span class="ms-dest-label">go to console</span>
				</div>
			</StoryboardFrame>
		</SwimLane>

		<div class="lane-divider"></div>

		<!-- ── Lane 2: GenAI risk-register import (branches off Optional setup) ─ -->
		<SwimLane pill="GENAI · RISK IMPORT" sub="Import schema → map to risk model → recommend threats → accept">
			<!-- Import -->
			<StoryboardFrame step={1} route="/ risk-import · upload" badge="SCHEMA ONLY" href={RISK}>
				<div class="ms">
					<span class="ms-eyebrow">// risk-import · upload</span>
					<h2 class="ms-h2">Import <span class="ms-accent">register.</span></h2>
					<div class="ms-drop">⬆ Drop CSV — headers only</div>
					<div class="ms-cols">
						<span>Risk Name</span><span>Likelihood (1-5)</span><span>Business Impact</span>
						<span>Data Sensitivity</span><span>Control Strength</span><span>Status</span>
					</div>
					<div class="ms-note">9 columns · 0 rows ingested</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label={"POST /risk-import\n/schema"} />

			<!-- Map schema -->
			<StoryboardFrame step={2} route="/ risk-import · map" badge="AI" href={RISK}>
				<div class="ms">
					<span class="ms-eyebrow">// risk-import · map</span>
					<h2 class="ms-h2">Map <span class="ms-accent">schema.</span></h2>
					<div class="ms-map"><span>Risk Name</span><span class="ms-arrow">→</span><span>title</span><em class="ms-pill ms-pill--hi">high</em></div>
					<div class="ms-map"><span>Likelihood</span><span class="ms-arrow">→</span><span>likelihood_success</span><em class="ms-pill ms-pill--md">med</em></div>
					<div class="ms-map"><span>Data Sensitivity</span><span class="ms-arrow">→</span><span>data_classes</span><em class="ms-pill ms-pill--hi">high</em></div>
					<div class="ms-map"><span>Status</span><span class="ms-arrow">→</span><span>status</span><em class="ms-pill ms-pill--lo">low</em></div>
					<div class="ms-note">GenAI mapped 8 / 9 · review & accept</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label={"POST /:id/map\n(structured JSON)"} />

			<!-- Threat model (background) -->
			<StoryboardFrame step={3} route="/ risk-import · threats" badge="BACKGROUND" href={RISK}>
				<div class="ms">
					<span class="ms-eyebrow">// risk-import · threats</span>
					<h2 class="ms-h2">Threat <span class="ms-accent">model.</span></h2>
					<div class="ms-seq"><span class="ms-ok">✓ RSK-001</span><span class="ms-ok">✓ RSK-002</span><span class="ms-run">⟳ RSK-003…</span><span class="ms-q">RSK-004</span></div>
					<div class="ms-threat"><b>typosquat</b><em class="ms-sev ms-sev--hi">8.2</em></div>
					<div class="ms-threat"><b>malware</b><em class="ms-sev ms-sev--hi">9.1</em></div>
					<div class="ms-threat"><b>phishing</b><em class="ms-sev ms-sev--md">6.8</em></div>
					<div class="ms-note">one risk at a time · AI-recommended</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label="accept" />

			<!-- Review / accept -->
			<StoryboardFrame step={4} route="/ risk-import · review" href={RISK}>
				<div class="ms ms--center">
					<span class="ms-done">⚡</span>
					<span class="ms-dest-name">8 mapped · 5 risks · 11 threats</span>
					<div class="ms-btn ms-btn--primary">Accept & finish</div>
					<span class="ms-dest-label">nothing written until you accept</span>
				</div>
			</StoryboardFrame>

			<StoryboardArrow />

			<StoryboardFrame route="/ risk / register" badge="UPDATED" dashed>
				<div class="ms ms--center">
					<span class="ms-dest-logo">▣</span>
					<span class="ms-dest-name">Risk model</span>
					<span class="ms-dest-label">risks + threats added</span>
				</div>
			</StoryboardFrame>
		</SwimLane>
	</StoryboardCanvas>
</div>

<style>
	.flow-page { padding: 2rem 2.5rem 4rem; max-width: none; min-width: 900px; }
	.page-header { margin-bottom: 2.5rem; max-width: 720px; }
	.eyebrow {
		display: block; font-family: var(--mono, monospace); font-size: 0.65rem;
		letter-spacing: 0.18em; text-transform: uppercase; color: var(--fg-dim); margin-bottom: 0.4rem;
	}
	.page-title { font-size: 2rem; font-weight: 700; color: var(--fg); line-height: 1.15; margin: 0 0 0.6rem; }
	.page-sub { font-size: 0.85rem; color: var(--fg-dim); line-height: 1.55; margin: 0; }
	.lane-divider { height: 1px; background: var(--border); margin: 0; }

	/* mini-screen (frames render at ~0.38× → use raw px) */
	.ms {
		padding: 30px 34px; background: var(--bg); min-height: 474px; box-sizing: border-box;
		display: flex; flex-direction: column; gap: 16px;
	}
	.ms--center { align-items: center; justify-content: center; text-align: center; gap: 18px; }
	.ms-eyebrow { font-family: monospace; font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--fg-dim); }
	.ms-h2 { font-size: 34px; font-weight: 700; color: var(--fg); line-height: 1.1; margin: 0; }
	.ms-accent { color: var(--accent); }

	.ms-doc {
		border: 1px solid var(--border); border-radius: 6px; padding: 16px; background: var(--bg-elev);
		display: flex; flex-direction: column; gap: 9px; font-family: monospace; font-size: 13px; color: var(--fg-dim);
	}
	.ms-check { display: flex; align-items: center; gap: 10px; font-size: 15px; color: var(--fg-muted); }
	.ms-box {
		width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
		background: var(--accent); color: var(--bg); font-size: 13px; font-weight: 700;
	}
	.ms-btn {
		display: flex; align-items: center; justify-content: center; height: 42px; border-radius: 4px;
		font-size: 14px; font-weight: 700; font-family: monospace; text-transform: uppercase; letter-spacing: 0.12em;
	}
	.ms-btn--primary { background: linear-gradient(135deg, var(--accent-soft, rgba(94,234,212,0.7)), var(--accent)); color: var(--bg); }

	.ms-field {
		border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; background: var(--bg-elev);
		display: flex; flex-direction: column; gap: 5px;
	}
	.ms-label { font-family: monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--fg-dim); }
	.ms-input {
		height: 34px; display: flex; align-items: center; padding: 0 12px; background: var(--bg);
		border: 1px solid var(--border-strong, rgba(94,234,212,0.2)); border-radius: 4px; color: var(--fg-muted); font-size: 15px;
	}
	.ms-chips { display: flex; flex-wrap: wrap; gap: 8px; }
	.ms-chip {
		padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); font-family: monospace;
		font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-dim);
	}
	.ms-chip--on { border-color: var(--accent); background: rgba(94,234,212,0.08); color: var(--accent); }

	.ms-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
	.ms-tile {
		display: flex; align-items: center; justify-content: center; padding: 16px 8px; border: 1.5px solid var(--border);
		border-radius: 6px; font-family: monospace; font-size: 13px; color: var(--fg-dim);
	}
	.ms-tile--on { border-color: rgba(94,234,212,0.45); background: rgba(94,234,212,0.06); color: var(--accent); }
	.ms-tile--soon { opacity: 0.5; }
	.ms-row {
		display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border);
		border-radius: 5px; background: var(--bg-elev); font-size: 14px; color: var(--fg);
	}
	.ms-row--dim { color: var(--fg-dim); }
	.ms-row em { font-family: monospace; font-size: 11px; text-transform: uppercase; color: var(--fg-dim); margin-left: 6px; }
	.ms-tog { width: 34px; height: 18px; border-radius: 9px; border: 1px solid var(--border-strong, rgba(94,234,212,0.2)); background: var(--bg); }
	.ms-tog--on { border-color: rgba(94,234,212,0.5); background: rgba(94,234,212,0.15); }

	.ms-opt {
		display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border);
		border-radius: 7px; background: var(--bg-elev);
	}
	.ms-opt--hot { border-color: rgba(94,234,212,0.45); background: rgba(94,234,212,0.05); }
	.ms-opt-i { font-size: 18px; color: var(--accent); width: 22px; text-align: center; }
	.ms-opt b { display: block; font-size: 14px; color: var(--fg); }
	.ms-opt small { font-size: 12px; color: var(--fg-dim); font-family: monospace; }

	.ms-drop {
		border: 1.5px dashed var(--border-strong, rgba(94,234,212,0.3)); border-radius: 8px; padding: 20px;
		text-align: center; font-family: monospace; font-size: 13px; color: var(--fg-dim);
	}
	.ms-cols { display: flex; flex-wrap: wrap; gap: 6px; }
	.ms-cols span {
		font-family: monospace; font-size: 11px; padding: 4px 8px; border: 1px solid var(--border);
		border-radius: 4px; color: var(--fg-muted); background: var(--bg-elev);
	}
	.ms-note { font-family: monospace; font-size: 12px; color: var(--fg-dim); }

	.ms-map { display: flex; align-items: center; gap: 8px; font-family: monospace; font-size: 12px; color: var(--fg-muted); }
	.ms-map span:first-child { flex: 1; }
	.ms-map span:nth-child(3) { flex: 1; color: var(--accent); }
	.ms-arrow { color: var(--fg-dim); }
	.ms-pill { font-size: 10px; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; font-style: normal; }
	.ms-pill--hi { background: rgba(52,211,153,0.15); color: #34d399; }
	.ms-pill--md { background: rgba(252,211,77,0.15); color: #fcd34d; }
	.ms-pill--lo { background: rgba(248,113,113,0.15); color: #f87171; }

	.ms-seq { display: flex; flex-wrap: wrap; gap: 8px; font-family: monospace; font-size: 12px; }
	.ms-ok { color: #34d399; }
	.ms-run { color: var(--accent); }
	.ms-q { color: var(--fg-dim); }
	.ms-threat {
		display: flex; align-items: center; justify-content: space-between; padding: 9px 13px; border: 1px solid var(--border);
		border-radius: 5px; background: var(--bg-elev); font-size: 14px; color: var(--fg); font-family: monospace;
	}
	.ms-sev { font-style: normal; font-weight: 700; font-size: 13px; padding: 2px 8px; border-radius: 4px; }
	.ms-sev--hi { background: rgba(248,113,113,0.15); color: #f87171; }
	.ms-sev--md { background: rgba(252,211,77,0.15); color: #fcd34d; }

	.ms-done { font-size: 40px; color: var(--accent); }
	.ms-dest-logo { font-size: 26px; color: var(--accent); opacity: 0.6; }
	.ms-dest-name { font-size: 15px; font-weight: 700; color: var(--fg-muted); }
	.ms-dest-label { font-size: 12px; color: var(--fg-dim); font-family: monospace; }
</style>
