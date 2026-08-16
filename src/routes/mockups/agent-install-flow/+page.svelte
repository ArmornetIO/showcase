<script lang="ts">
	import { base } from '$app/paths';
	import StoryboardCanvas from '$lib/storyboard/StoryboardCanvas.svelte';
	import SwimLane from '$lib/storyboard/SwimLane.svelte';
	import StoryboardFrame from '$lib/storyboard/StoryboardFrame.svelte';
	import StoryboardArrow from '$lib/storyboard/StoryboardArrow.svelte';
	import StoryboardBranch from '$lib/storyboard/StoryboardBranch.svelte';
</script>

<svelte:head><title>Agent Install Flow — Armornet</title></svelte:head>

<div class="agent-flows-page">
	<div class="page-header">
		<span class="eyebrow">// agents · install flow</span>
		<h1 class="page-title">Agent install flow.</h1>
	</div>

	<StoryboardCanvas>

		<!-- ── Lane 1: UI Wizard (new agent) ───────────────────────────────────── -->
		<SwimLane pill="UI WIZARD" sub="Console → provision credentials → binary install">

			<!-- Step 1: Name -->
			<StoryboardFrame step={1} route="/ agents / install" href="{base}/mockups/agent-install">
				<div class="mock-screen">
					<span class="mock-eyebrow">// agents · install</span>
					<h2 class="mock-h2">Install <span class="mock-accent">Agent.</span></h2>
					<div class="mock-step-bar">
						<span class="mock-step-dot mock-step-dot--active">1</span>
						<span class="mock-step-line"></span>
						<span class="mock-step-dot">2</span>
						<span class="mock-step-line"></span>
						<span class="mock-step-dot">3</span>
					</div>
					<div class="mock-card">
						<div class="mock-field-label">Agent name</div>
						<div class="mock-input">prod-supply-chain</div>
						<div class="mock-field-hint">A unique label for this agent.</div>
					</div>
					<div class="mock-btn mock-btn--primary">Create agent</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label={"POST /agent-clients\n→ credentials"} />

			<!-- Step 2: Tools -->
			<StoryboardFrame step={2} route="/ agents / install · step 2" href="{base}/mockups/agent-install">
				<div class="mock-screen">
					<span class="mock-eyebrow">// agents · install</span>
					<h2 class="mock-h2">Install <span class="mock-accent">Agent.</span></h2>
					<div class="mock-step-bar">
						<span class="mock-step-dot mock-step-dot--past">✓</span>
						<span class="mock-step-line mock-step-line--filled"></span>
						<span class="mock-step-dot mock-step-dot--active">2</span>
						<span class="mock-step-line"></span>
						<span class="mock-step-dot">3</span>
					</div>
					<div class="mock-tool-grid">
						<div class="mock-tool-tile mock-tool-tile--on">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
							<span>DNS</span>
						</div>
						<div class="mock-tool-tile mock-tool-tile--on">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
							<span>Go</span>
						</div>
						<div class="mock-tool-tile">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
							<span>npm</span>
						</div>
						<div class="mock-tool-tile">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
							<span>pip</span>
						</div>
						<div class="mock-tool-tile">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5"/></svg>
							<span>Docker</span>
						</div>
					</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow />

			<!-- Step 3: Install -->
			<StoryboardFrame step={3} route="/ agents / install · step 3" href="{base}/mockups/agent-install">
				<div class="mock-screen">
					<span class="mock-eyebrow">// agents · install</span>
					<h2 class="mock-h2">Install <span class="mock-accent">Agent.</span></h2>
					<div class="mock-step-bar">
						<span class="mock-step-dot mock-step-dot--past">✓</span>
						<span class="mock-step-line mock-step-line--filled"></span>
						<span class="mock-step-dot mock-step-dot--past">✓</span>
						<span class="mock-step-line mock-step-line--filled"></span>
						<span class="mock-step-dot mock-step-dot--active">3</span>
					</div>
					<div class="mock-secret-box">
						<span class="mock-secret-warn">⚠ Copy secret — shown once</span>
						<code class="mock-secret-val">agt_sec_••••••••••••</code>
					</div>
					<div class="mock-code-block">
						<span class="mock-code-cmd">armornet agent init</span>
						<span class="mock-code-flag"> --client-id=</span>
						<span class="mock-code-str">"agent:org:…"</span>
					</div>
					<div class="mock-conn-status">
						<span class="mock-spinner" aria-hidden="true"></span>
						<span>Waiting for connection…</span>
					</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label={"agent connects\nvia OpAMP"} />

			<!-- Agent mesh destination -->
			<StoryboardFrame route="/ agents" dashed>
				<div class="mock-destination">
					<span class="mock-dest-logo">▣</span>
					<span class="mock-dest-name">Agent Mesh</span>
					<span class="mock-dest-label">agent online</span>
				</div>
			</StoryboardFrame>

		</SwimLane>

		<div class="lane-divider"></div>

		<!-- ── Lane 2: CLI Fast Path ────────────────────────────────────────────── -->
		<SwimLane pill="CLI FAST PATH" sub="armornet agent init — non-interactive provisioning">

			<!-- Step 1: login -->
			<StoryboardFrame step={1} route="armornet login">
				<div class="mock-terminal">
					<div class="mock-term-bar">
						<span class="mock-term-dot mock-term-dot--red"></span>
						<span class="mock-term-dot mock-term-dot--yellow"></span>
						<span class="mock-term-dot mock-term-dot--green"></span>
						<span class="mock-term-title">terminal</span>
					</div>
					<div class="mock-term-body">
						<div class="mock-term-line">
							<span class="mock-term-prompt">$</span>
							<span class="mock-term-cmd"> armornet login</span>
						</div>
						<div class="mock-term-out">Opening browser…</div>
						<div class="mock-term-out mock-term-out--accent">✓ Logged in as alice@acme.com</div>
					</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label="browser OAuth" />

			<!-- Step 2: agent init -->
			<div class="cli-col">
				<StoryboardFrame step={2} route="armornet agent init" badge="INTERACTIVE">
					<div class="mock-terminal">
						<div class="mock-term-bar">
							<span class="mock-term-dot mock-term-dot--red"></span>
							<span class="mock-term-dot mock-term-dot--yellow"></span>
							<span class="mock-term-dot mock-term-dot--green"></span>
							<span class="mock-term-title">terminal</span>
						</div>
						<div class="mock-term-body">
							<div class="mock-term-line">
								<span class="mock-term-prompt">$</span>
								<span class="mock-term-cmd"> armornet agent init</span>
							</div>
							<div class="mock-term-out">? Agent name: <span class="mock-term-input">prod-supply-chain</span></div>
							<div class="mock-term-out">? Enable tools:</div>
							<div class="mock-term-out mock-term-out--accent">  ◉ DNS Protection</div>
							<div class="mock-term-out mock-term-out--accent">  ◉ Go proxy</div>
							<div class="mock-term-out">  ◯ npm proxy</div>
							<div class="mock-term-out mock-term-out--dim">Writing agent.yaml…</div>
							<div class="mock-term-out mock-term-out--accent">✓ Config written to ./agent.yaml</div>
						</div>
					</div>
				</StoryboardFrame>

				<StoryboardBranch label="--flags skip prompts">
					<StoryboardFrame
						route="armornet agent init --flags"
						badge="NON-INTERACTIVE"
						width={240}
						height={140}
					>
						<div class="mock-terminal">
							<div class="mock-term-bar">
								<span class="mock-term-dot mock-term-dot--red"></span>
								<span class="mock-term-dot mock-term-dot--yellow"></span>
								<span class="mock-term-dot mock-term-dot--green"></span>
								<span class="mock-term-title">terminal</span>
							</div>
							<div class="mock-term-body">
								<div class="mock-term-line">
									<span class="mock-term-prompt">$</span>
									<span class="mock-term-cmd"> armornet agent init \</span>
								</div>
								<div class="mock-term-out"><span class="mock-term-flag">  --name</span>=prod-chain \</div>
								<div class="mock-term-out"><span class="mock-term-flag">  --tools</span>=dns,go</div>
								<div class="mock-term-out mock-term-out--accent">✓ ./agent.yaml</div>
							</div>
						</div>
					</StoryboardFrame>
				</StoryboardBranch>
			</div>

			<StoryboardArrow />

			<!-- Step 3: agent serve -->
			<StoryboardFrame step={3} route="armornet agent serve">
				<div class="mock-terminal">
					<div class="mock-term-bar">
						<span class="mock-term-dot mock-term-dot--red"></span>
						<span class="mock-term-dot mock-term-dot--yellow"></span>
						<span class="mock-term-dot mock-term-dot--green"></span>
						<span class="mock-term-title">terminal</span>
					</div>
					<div class="mock-term-body">
						<div class="mock-term-line">
							<span class="mock-term-prompt">$</span>
							<span class="mock-term-cmd"> armornet agent serve \</span>
						</div>
						<div class="mock-term-out"><span class="mock-term-flag">    -config</span> ./agent.yaml</div>
						<div class="mock-term-out mock-term-out--dim">starting dns_proxy…</div>
						<div class="mock-term-out mock-term-out--dim">starting supply_chain_proxy/go…</div>
						<div class="mock-term-out mock-term-out--accent">✓ connected to opamp</div>
						<div class="mock-term-out mock-term-out--accent">✓ 2 tools active</div>
					</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label={"OpAMP\nhandshake"} />

			<!-- Agent mesh destination -->
			<StoryboardFrame route="/ agents" dashed>
				<div class="mock-destination">
					<span class="mock-dest-logo">▣</span>
					<span class="mock-dest-name">Agent Mesh</span>
					<span class="mock-dest-label">agent online</span>
				</div>
			</StoryboardFrame>

		</SwimLane>

		<div class="lane-divider"></div>

		<!-- ── Lane 3: Re-provision / Rotate Secret ──────────────────────────────── -->
		<SwimLane pill="ROTATE SECRET" sub="Revoke old client → new credentials → restart agent">

			<!-- Step 1: Agents list -->
			<StoryboardFrame step={1} route="/ agents">
				<div class="mock-screen">
					<span class="mock-eyebrow">// agents</span>
					<h2 class="mock-h2">Agent <span class="mock-accent">Mesh.</span></h2>
					<div class="mock-agent-row mock-agent-row--selected">
						<span class="mock-agent-dot mock-agent-dot--green"></span>
						<span class="mock-agent-name">prod-supply-chain</span>
						<span class="mock-agent-meta">dns · go</span>
						<span class="mock-agent-action">⋯</span>
					</div>
					<div class="mock-agent-row">
						<span class="mock-agent-dot mock-agent-dot--green"></span>
						<span class="mock-agent-name">staging-k8s</span>
						<span class="mock-agent-meta">dns</span>
						<span class="mock-agent-action">⋯</span>
					</div>
					<div class="mock-agent-row">
						<span class="mock-agent-dot mock-agent-dot--dim"></span>
						<span class="mock-agent-name">dev-laptop</span>
						<span class="mock-agent-meta">offline</span>
						<span class="mock-agent-action">⋯</span>
					</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label="delete client" />

			<!-- Step 2: Revoke confirmation -->
			<div class="cli-col">
				<StoryboardFrame step={2} route="/ agents / :id · revoke" badge="CONFIRM">
					<div class="mock-screen mock-screen--center">
						<span class="mock-danger-icon">
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
						</span>
						<p class="mock-danger-title">Revoke credentials?</p>
						<p class="mock-danger-sub">prod-supply-chain will disconnect immediately.</p>
						<div class="mock-btn mock-btn--danger">Revoke</div>
					</div>
				</StoryboardFrame>

				<StoryboardBranch label="agent disconnects">
					<StoryboardFrame
						route="/ agents"
						badge="OFFLINE"
						badgeVariant="red"
						width={220}
						height={130}
					>
						<div class="mock-screen">
							<div class="mock-agent-row">
								<span class="mock-agent-dot mock-agent-dot--red"></span>
								<span class="mock-agent-name">prod-supply-chain</span>
								<span class="mock-agent-meta mock-agent-meta--red">disconnected</span>
							</div>
						</div>
					</StoryboardFrame>
				</StoryboardBranch>
			</div>

			<StoryboardArrow label={"POST /agent-clients\nnew credentials"} />

			<!-- Step 3: Re-run init with new creds -->
			<StoryboardFrame step={3} route="armornet agent init --rotate">
				<div class="mock-terminal">
					<div class="mock-term-bar">
						<span class="mock-term-dot mock-term-dot--red"></span>
						<span class="mock-term-dot mock-term-dot--yellow"></span>
						<span class="mock-term-dot mock-term-dot--green"></span>
						<span class="mock-term-title">terminal</span>
					</div>
					<div class="mock-term-body">
						<div class="mock-term-line">
							<span class="mock-term-prompt">$</span>
							<span class="mock-term-cmd"> armornet agent init \</span>
						</div>
						<div class="mock-term-out"><span class="mock-term-flag">  --rotate</span> ./agent.yaml</div>
						<div class="mock-term-out mock-term-out--dim">Fetching new credentials…</div>
						<div class="mock-term-out mock-term-out--accent">✓ agent.yaml updated</div>
						<div class="mock-term-out mock-term-out--dim">Restart agent to reconnect.</div>
					</div>
				</div>
			</StoryboardFrame>

			<StoryboardArrow label="restart" />

			<!-- Agent mesh destination -->
			<StoryboardFrame route="/ agents" badge="RECONNECTED" dashed>
				<div class="mock-destination">
					<span class="mock-dest-logo">▣</span>
					<span class="mock-dest-name">Agent Mesh</span>
					<span class="mock-dest-label">agent online</span>
				</div>
			</StoryboardFrame>

		</SwimLane>

	</StoryboardCanvas>
</div>

<style>
	/* ── Page chrome ────────────────────────────────────────────── */
	.agent-flows-page {
		padding: 2rem 2.5rem 4rem;
		max-width: none;
		min-width: 900px;
	}

	.page-header {
		margin-bottom: 2.5rem;
	}

	.eyebrow {
		display: block;
		font-family: var(--mono, monospace);
		font-size: 0.65rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin-bottom: 0.4rem;
	}

	.page-title {
		font-size: 2rem;
		font-weight: 700;
		color: var(--fg);
		line-height: 1.15;
		margin: 0;
	}

	/* ── Lane divider ───────────────────────────────────────────── */
	.lane-divider {
		height: 1px;
		background: var(--border);
		margin: 0;
	}

	/* ── CLI column (frame + branch) ────────────────────────────── */
	.cli-col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
		flex-shrink: 0;
	}

	/* ── Destination placeholder ────────────────────────────────── */
	.mock-destination {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.mock-dest-logo {
		font-size: 1.5rem;
		color: var(--accent);
		opacity: 0.5;
	}

	.mock-dest-name {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--fg-dim);
		letter-spacing: 0.05em;
	}

	.mock-dest-label {
		font-size: 0.62rem;
		color: var(--fg-dim);
		font-family: var(--mono, monospace);
	}

	/* ── Shared mock screen (wizard frames) ─────────────────────── */
	.mock-screen {
		padding: 32px 40px;
		background: var(--bg);
		min-height: 474px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.mock-screen--center {
		align-items: center;
		justify-content: center;
		gap: 20px;
		text-align: center;
	}

	.mock-eyebrow {
		display: block;
		font-family: monospace;
		font-size: 13px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.mock-h2 {
		font-size: 38px;
		font-weight: 700;
		color: var(--fg);
		line-height: 1.1;
		margin: 0;
	}

	.mock-accent { color: var(--accent); }

	/* ── Step indicator (inside wizard frames) ──────────────────── */
	.mock-step-bar {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.mock-step-dot {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1.5px solid var(--border-strong);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: monospace;
		font-size: 11px;
		font-weight: 700;
		color: var(--fg-dim);
		background: var(--bg-elev);
		flex-shrink: 0;
	}

	.mock-step-dot--active {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--bg);
	}

	.mock-step-dot--past {
		border-color: var(--accent);
		background: rgba(94, 234, 212, 0.15);
		color: var(--accent);
		font-size: 9px;
	}

	.mock-step-line {
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.mock-step-line--filled {
		background: var(--accent);
		opacity: 0.4;
	}

	/* ── Form field mockup ──────────────────────────────────────── */
	.mock-card {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 20px;
		background: var(--bg-elev);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mock-field-label {
		font-family: monospace;
		font-size: 14px;
		font-weight: 700;
		color: var(--fg-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.mock-input {
		padding: 0 14px;
		height: 44px;
		display: flex;
		align-items: center;
		background: var(--bg);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		color: var(--fg-muted);
		font-size: 18px;
	}

	.mock-field-hint {
		font-size: 13px;
		color: var(--fg-dim);
	}

	/* ── CTA button ─────────────────────────────────────────────── */
	.mock-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		border-radius: 4px;
		font-size: 15px;
		font-weight: 700;
		font-family: monospace;
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}

	.mock-btn--primary {
		background: linear-gradient(135deg, var(--accent-soft), var(--accent));
		color: var(--bg);
	}

	.mock-btn--danger {
		background: rgba(248, 113, 113, 0.12);
		border: 1px solid rgba(248, 113, 113, 0.4);
		color: var(--palette-red, #f87171);
	}

	/* ── Tool grid (step 2 thumbnail) ───────────────────────────── */
	.mock-tool-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}

	.mock-tool-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 14px 8px;
		border: 1.5px solid var(--border);
		border-radius: 5px;
		background: rgba(255,255,255,0.02);
		font-size: 13px;
		font-family: monospace;
		color: var(--fg-dim);
	}

	.mock-tool-tile--on {
		border-color: rgba(94, 234, 212, 0.45);
		background: rgba(94, 234, 212, 0.05);
		color: var(--accent);
	}

	/* ── Secret box (step 3 thumbnail) ─────────────────────────── */
	.mock-secret-box {
		border: 1px solid rgba(252, 211, 77, 0.35);
		background: rgba(252, 211, 77, 0.04);
		border-radius: 4px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mock-secret-warn {
		font-family: monospace;
		font-size: 13px;
		color: var(--palette-amber, #fcd34d);
	}

	.mock-secret-val {
		font-family: monospace;
		font-size: 14px;
		color: var(--fg-muted);
	}

	/* ── Code block thumbnail ───────────────────────────────────── */
	.mock-code-block {
		background: rgba(0,0,0,0.25);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 14px 16px;
		font-family: monospace;
		font-size: 14px;
		line-height: 1.6;
	}

	.mock-code-cmd  { color: var(--accent); font-weight: 600; }
	.mock-code-flag { color: var(--palette-blue, #60a5fa); }
	.mock-code-str  { color: var(--palette-amber, #fcd34d); }

	/* ── Connection status (step 3) ─────────────────────────────── */
	.mock-conn-status {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		border: 1px solid var(--border);
		border-radius: 4px;
		font-family: monospace;
		font-size: 14px;
		color: var(--fg-dim);
	}

	.mock-spinner {
		width: 14px;
		height: 14px;
		border: 1.5px solid var(--fg-dim);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	/* ── Agent list (lane 3) ────────────────────────────────────── */
	.mock-agent-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 18px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg-elev);
		font-size: 16px;
	}

	.mock-agent-row--selected {
		border-color: rgba(94, 234, 212, 0.35);
		background: rgba(94, 234, 212, 0.04);
	}

	.mock-agent-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.mock-agent-dot--green  { background: var(--palette-green, #34d399); box-shadow: 0 0 5px var(--palette-green); }
	.mock-agent-dot--dim    { background: var(--fg-dim); }
	.mock-agent-dot--red    { background: var(--palette-red, #f87171); }

	.mock-agent-name {
		flex: 1;
		font-size: 17px;
		font-weight: 600;
		color: var(--fg);
	}

	.mock-agent-meta {
		font-family: monospace;
		font-size: 13px;
		color: var(--fg-dim);
	}

	.mock-agent-meta--red { color: var(--palette-red, #f87171); }

	.mock-agent-action {
		color: var(--fg-dim);
		font-size: 18px;
	}

	/* ── Danger confirm ─────────────────────────────────────────── */
	.mock-danger-icon {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: rgba(248, 113, 113, 0.08);
		border: 1px solid rgba(248, 113, 113, 0.25);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--palette-red, #f87171);
	}

	.mock-danger-title {
		font-size: 22px;
		font-weight: 600;
		color: var(--fg);
		margin: 0;
	}

	.mock-danger-sub {
		font-size: 14px;
		color: var(--fg-dim);
		margin: 0;
		max-width: 260px;
	}

	/* ── Terminal mockup ────────────────────────────────────────── */
	.mock-terminal {
		display: flex;
		flex-direction: column;
		min-height: 474px;
		background: #0d1117;
		border-radius: 0;
		overflow: hidden;
		box-sizing: border-box;
	}

	.mock-term-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 14px;
		background: #161b22;
		border-bottom: 1px solid rgba(255,255,255,0.06);
		flex-shrink: 0;
	}

	.mock-term-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.mock-term-dot--red    { background: #ff5f57; }
	.mock-term-dot--yellow { background: #ffbd2e; }
	.mock-term-dot--green  { background: #28c840; }

	.mock-term-title {
		font-family: monospace;
		font-size: 12px;
		color: rgba(255,255,255,0.35);
		margin-left: auto;
	}

	.mock-term-body {
		flex: 1;
		padding: 20px 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.mock-term-line {
		display: flex;
		font-family: monospace;
		font-size: 15px;
	}

	.mock-term-prompt { color: #34d399; }
	.mock-term-cmd    { color: #e6edf3; }
	.mock-term-flag   { color: #60a5fa; }
	.mock-term-input  { color: var(--accent, #5eead4); }

	.mock-term-out {
		font-family: monospace;
		font-size: 14px;
		color: rgba(230,237,243,0.5);
		padding-left: 16px;
	}

	.mock-term-out--accent { color: #34d399; }
	.mock-term-out--dim    { color: rgba(230,237,243,0.3); }
</style>
