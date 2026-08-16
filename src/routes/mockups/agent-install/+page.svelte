<script lang="ts">
	// /console/agents/install — Agent Install Guide
	//
	// API stubs:
	//   POST /api/admin/orgs/:org_id/agent-clients → { client_id, client_secret }
	//   POST /api/admin/orgs/:org_id/cloud-agents  → { agent_id } (cloud-hosted)

	import Button from '$lib/primitives/Button.svelte';
	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';

	// ── Types ────────────────────────────────────────────────────────────────────

	type AgentMode = 'local' | 'cloud';

	type Tool = {
		id: string;
		label: string;
		icon: IconName;
		tag: string;
	};

	// ── Static defs ──────────────────────────────────────────────────────────────

	const TOOLS: Tool[] = [
		{ id: 'dns_proxy', label: 'DNS Protection', icon: 'shield',        tag: 'dns_proxy'           },
		{ id: 'sc_go',     label: 'Go proxy',        icon: 'git-branch',   tag: 'supply_chain / go'   },
		{ id: 'sc_npm',    label: 'npm proxy',        icon: 'layers',       tag: 'supply_chain / npm'  },
		{ id: 'sc_pip',    label: 'pip proxy',        icon: 'flask-conical',tag: 'supply_chain / pip'  },
		{ id: 'sc_docker', label: 'Docker proxy',     icon: 'package',      tag: 'supply_chain / docker'},
	];

	const OPAMP_ENDPOINT = 'wss://opamp.armornet.io/v1/opamp';
	const MOCK_ORG_ID    = 'org_demo';

	// ── State ────────────────────────────────────────────────────────────────────

	let agentMode      = $state<AgentMode>('local');
	let enabledTools   = $state<Set<string>>(new Set(['dns_proxy', 'sc_go']));
	let provisioning   = $state(false);
	let createdAgent   = $state<{ client_id: string; client_secret: string } | null>(null);
	let secretRevealed = $state(false);
	let connStatus     = $state<'idle' | 'waiting' | 'connected'>('idle');
	let copiedBlock    = $state<string | null>(null);

	$effect(() => {
		if (connStatus !== 'waiting') return;
		const t = setTimeout(() => { connStatus = 'connected'; }, 4500);
		return () => clearTimeout(t);
	});

	// ── Derived ──────────────────────────────────────────────────────────────────

	const serveCmd = $derived(
		createdAgent
			? `armornet agent serve \\\n  --client-id="${createdAgent.client_id}" \\\n  --client-secret="${secretRevealed ? createdAgent.client_secret : '••••••'}" \\\n  --opamp-endpoint="${OPAMP_ENDPOINT}"`
			: ''
	);

	const serveCmdFlat = $derived(
		createdAgent
			? `armornet agent serve --client-id="${createdAgent.client_id}" --client-secret="${createdAgent.client_secret}" --opamp-endpoint="${OPAMP_ENDPOINT}"`
			: ''
	);

	const maskedSecret = $derived(
		createdAgent ? createdAgent.client_secret.slice(0, 6) + '••••••••••••••••••••••••••' : ''
	);

	// ── Handlers ─────────────────────────────────────────────────────────────────

	function toggleTool(id: string) {
		const next = new Set(enabledTools);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		enabledTools = next;
	}

	async function provision() {
		if (provisioning) return;
		provisioning = true;
		createdAgent = null;
		secretRevealed = false;
		connStatus = 'idle';
		await new Promise((r) => setTimeout(r, 900));
		createdAgent = {
			client_id:     `agent:${MOCK_ORG_ID}:${crypto.randomUUID().slice(0, 8)}`,
			client_secret: 'agt_sec_' + crypto.randomUUID().replace(/-/g, '').slice(0, 32),
		};
		provisioning = false;
		connStatus = 'waiting';
	}

	async function copyBlock(text: string, id: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedBlock = id;
			setTimeout(() => { if (copiedBlock === id) copiedBlock = null; }, 1400);
		} catch { /* no-op */ }
	}
</script>

<svelte:head><title>Install Agent — Armornet</title></svelte:head>

<LayoutHeader eyebrow="// agents · install" />

<div class="guide">

	<!-- ── Step 01: Agent type ────────────────────────────────────────────────── -->
	<section class="step">
		<header class="step-head">
			<span class="step-num">01</span>
			<div>
				<h2 class="step-title">Deployment type</h2>
				<p class="step-sub">Choose where this agent runs.</p>
			</div>
		</header>
		<div class="step-body">
			<div class="seg-wrap">
				<div class="seg">
					<button class:seg-active={agentMode === 'local'} onclick={() => { agentMode = 'local'; createdAgent = null; connStatus = 'idle'; }}>
						<Icon name="cpu" size={12} /> Local agent
					</button>
					<button class:seg-active={agentMode === 'cloud'} onclick={() => { agentMode = 'cloud'; createdAgent = null; connStatus = 'idle'; }}>
						<Icon name="globe" size={12} /> Cloud agent
					</button>
				</div>
			</div>
			<p class="step-prose">
				{#if agentMode === 'local'}
					Install the Armornet binary on your host or in a container. The agent connects to the Armornet control plane via OpAMP and receives policy from the server.
				{:else}
					Armornet provisions and operates the agent in your org's cloud environment. No binary to install — the agent is available immediately after provisioning.
				{/if}
			</p>
		</div>
	</section>

	<!-- ── Step 02: Tools ────────────────────────────────────────────────────── -->
	<section class="step">
		<header class="step-head">
			<span class="step-num">02</span>
			<div>
				<h2 class="step-title">Select tools</h2>
				<p class="step-sub">Choose which security capabilities to enable. You can change these later.</p>
			</div>
		</header>
		<div class="eco-pills">
			{#each TOOLS as t}
				<button
					class="eco-pill"
					class:eco-pill--active={enabledTools.has(t.id)}
					onclick={() => toggleTool(t.id)}
				>
					<Icon name={t.icon} size={12} strokeWidth={1.75} />
					{t.label}
				</button>
			{/each}
		</div>
	</section>

	<!-- ── Step 03: Provision ────────────────────────────────────────────────── -->
	<section class="step">
		<header class="step-head">
			<span class="step-num">03</span>
			<div>
				<h2 class="step-title">
					{agentMode === 'cloud' ? 'Deploy agent' : 'Provision credentials'}
				</h2>
				<p class="step-sub">
					{agentMode === 'cloud'
						? 'Armornet will start the agent and push the selected tool config via OpAMP.'
						: 'Creates a client ID and secret the agent uses to authenticate with the control plane.'}
				</p>
			</div>
		</header>
		<div class="step-body">
			{#if !createdAgent}
				<Button
					variant="primary"
					size="md"
					loading={provisioning}
					onclick={provision}
				>
					{agentMode === 'cloud' ? 'Deploy agent' : 'Provision'}
				</Button>
			{:else}
				<!-- Connection status -->
				<div class="conn-row">
					{#if connStatus === 'waiting'}
						<Chip color="warn" look="filled" pulse>Waiting for agent to connect…</Chip>
					{:else}
						<Chip color="success" look="filled">Agent connected</Chip>
					{/if}
					<button class="reset-link" onclick={() => { createdAgent = null; connStatus = 'idle'; }}>
						Reprovision
					</button>
				</div>

				{#if agentMode === 'local'}
					<!-- Secret — show once -->
					<div class="secret-box">
						<div class="callout callout--warn">
							<Icon name="alert-triangle" size={12} />
							<span>This secret will not be shown again — copy it before continuing.</span>
						</div>
						<div class="secret-row">
							<code class="secret-val">{secretRevealed ? createdAgent.client_secret : maskedSecret}</code>
							{#if !secretRevealed}
								<Button variant="ghost" size="sm" onclick={() => (secretRevealed = true)}>Reveal</Button>
							{/if}
							<Button variant="ghost" size="sm" onclick={() => copyBlock(createdAgent!.client_secret, 'secret')}>
								{#snippet children()}
									<Icon name={copiedBlock === 'secret' ? 'check' : 'copy'} size={11} />
									{copiedBlock === 'secret' ? 'Copied' : 'Copy'}
								{/snippet}
							</Button>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</section>

	<!-- ── Step 04: Run (local only, after provision) ────────────────────────── -->
	{#if agentMode === 'local' && createdAgent}
		<section class="step">
			<header class="step-head">
				<span class="step-num">04</span>
				<div>
					<h2 class="step-title">Install &amp; run</h2>
					<p class="step-sub">Run these two commands on your target host.</p>
				</div>
			</header>
			<div class="step-body">
				<div class="code-block">
					<div class="code-head">
						<span class="code-lang">sh</span>
						<button class="code-copy" onclick={() => copyBlock('curl -fsSL https://install.armornet.io/agent | sh', 'install')}>
							<Icon name={copiedBlock === 'install' ? 'check' : 'copy'} size={11} strokeWidth={copiedBlock === 'install' ? 2.5 : 1.75} />
							{copiedBlock === 'install' ? 'copied' : 'copy'}
						</button>
					</div>
					<pre><code>curl -fsSL https://install.armornet.io/agent | sh</code></pre>
				</div>

				<div class="code-block">
					<div class="code-head">
						<span class="code-lang">sh</span>
						<button class="code-copy" onclick={() => copyBlock(serveCmdFlat, 'serve')}>
							<Icon name={copiedBlock === 'serve' ? 'check' : 'copy'} size={11} strokeWidth={copiedBlock === 'serve' ? 2.5 : 1.75} />
							{copiedBlock === 'serve' ? 'copied' : 'copy'}
						</button>
					</div>
					<pre><code>{serveCmd}</code></pre>
				</div>

				<p class="step-prose">
					Once the agent is running, the status above will flip to
					<Chip color="success" look="filled">connected</Chip>
					within a few seconds.
				</p>
			</div>
		</section>
	{/if}

</div>

<style>
	.guide {
		display: flex;
		flex-direction: column;
		gap: 0;
		max-width: 720px;
	}

	/* ── Step cards ──────────────────────────────────────────────────────────── */
	.step {
		border: 1px solid var(--border);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.02);
		margin-bottom: 1rem;
		overflow: hidden;
	}
	.step-head {
		display: flex;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		background: rgba(255, 255, 255, 0.015);
		align-items: flex-start;
	}
	.step-num {
		font-family: var(--mono);
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--accent);
		background: rgba(94, 234, 212, 0.08);
		border: 1px solid rgba(94, 234, 212, 0.25);
		border-radius: 3px;
		padding: 0.15rem 0.45rem;
		height: fit-content;
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}
	.step-title {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--fg);
		line-height: 1.25;
	}
	.step-sub {
		margin: 0.2rem 0 0;
		font-size: 0.75rem;
		color: var(--fg-muted);
		line-height: 1.45;
	}
	.step-body {
		padding: 0.9rem 1rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.step-prose {
		margin: 0;
		font-size: 0.78rem;
		color: var(--fg-muted);
		line-height: 1.5;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	/* ── Segmented control ───────────────────────────────────────────────────── */
	.seg-wrap { padding-bottom: 0.1rem; }
	.seg {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 2px;
		gap: 2px;
		background: rgba(0, 0, 0, 0.2);
	}
	.seg button {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: none;
		border: none;
		padding: 0.4rem 0.75rem;
		font-family: var(--mono);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 3px;
		transition: color 0.15s, background 0.15s;
	}
	.seg button:hover { color: var(--fg); }
	.seg-active {
		background: rgba(94, 234, 212, 0.1) !important;
		color: var(--accent) !important;
	}

	/* ── Tool pills ──────────────────────────────────────────────────────────── */
	.eco-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding: 0.75rem 1rem 1rem;
	}
	.eco-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.7rem;
		font-family: var(--mono);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--fg-muted);
		background: rgba(255, 255, 255, 0.025);
		border: 1px solid var(--border);
		border-radius: 3px;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
	}
	.eco-pill:hover { color: var(--fg); border-color: var(--border-strong); }
	.eco-pill--active {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.45);
		background: rgba(94, 234, 212, 0.08);
	}

	/* ── Provision step content ──────────────────────────────────────────────── */
	.conn-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.reset-link {
		background: none;
		border: none;
		padding: 0;
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--fg-dim);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.reset-link:hover { color: var(--fg-muted); }
	.secret-box {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.callout {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.65rem;
		background: rgba(252, 211, 77, 0.04);
		border: 1px solid rgba(252, 211, 77, 0.25);
		border-left-width: 2px;
		border-radius: 2px;
		font-size: 0.73rem;
		color: #fcd34d;
		line-height: 1.4;
	}
	.secret-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 0.5rem 0.75rem;
	}
	.secret-val {
		flex: 1;
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	/* ── Code blocks (matching app-ui IntegrationCard CodeBlock style) ────────── */
	.code-block {
		border: 1px solid var(--border);
		border-radius: 3px;
		background: rgba(0, 0, 0, 0.35);
		overflow: hidden;
	}
	.code-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.3rem 0.55rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		background: rgba(255, 255, 255, 0.02);
	}
	.code-lang {
		font-family: var(--mono);
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.code-copy {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: 1px solid transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.15rem 0.4rem;
		border-radius: 2px;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
	}
	.code-copy:hover {
		color: var(--accent);
		border-color: var(--border-strong);
		background: rgba(255, 255, 255, 0.03);
	}
	.code-block pre {
		margin: 0;
		padding: 0.8rem 0.9rem;
		font-family: var(--mono);
		font-size: 0.74rem;
		line-height: 1.55;
		color: var(--fg);
		overflow-x: auto;
	}
	.code-block code {
		white-space: pre;
		font-family: inherit;
	}
</style>
