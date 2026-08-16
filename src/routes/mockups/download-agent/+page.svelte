<script lang="ts">
	// /console/agents/download — One-click agent download
	//
	// Thesis: the current install guide is strong but multi-step. This screen
	// leads with a single OS-aware download button; the CLI path is demoted to
	// a secondary panel below.
	//
	// API stubs:
	//   GET  /api/releases/agent/latest            → { version, published_at, builds[] }
	//   POST /api/admin/orgs/:org_id/agent-clients → { client_id, client_secret }  (embedded in agent.yaml on download)

	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';

	// ── Types ──────────────────────────────────────────────────────────────────
	type OsKey = 'mac' | 'linux' | 'win' | 'docker';

	type Build = {
		os: OsKey;
		label: string; // pill label
		icon: IconName;
		lead: string; // button headline
		sub: string; // button subline
		file: string;
		size: string;
		sha256: string;
		install_cmd: string;
		run_cmd: string;
		term_label: string;
	};

	// ── Static defs (stubbed release manifest) ─────────────────────────────────
	const VERSION = 'v1.4.2';

	const BUILDS: Record<OsKey, Build> = {
		mac: {
			os: 'mac',
			label: 'macOS',
			icon: 'cpu',
			lead: 'Download for macOS',
			sub: 'Universal installer · Apple Silicon & Intel',
			file: `armornet-agent-${VERSION}-macos.pkg`,
			size: '24.8 MB',
			sha256: 'a1f0…9c3e',
			install_cmd: 'curl -fsSL https://install.armornet.io/agent | sh',
			run_cmd: 'armornet agent serve -config ./agent.yaml',
			term_label: 'install · macos'
		},
		linux: {
			os: 'linux',
			label: 'Linux',
			icon: 'activity',
			lead: 'Download for Linux',
			sub: 'x86-64 · systemd service installer',
			file: `armornet-agent-${VERSION}-linux-amd64.tar.gz`,
			size: '22.1 MB',
			sha256: '7b42…d180',
			install_cmd: 'curl -fsSL https://install.armornet.io/agent | sh',
			run_cmd: 'armornet agent serve -config ./agent.yaml',
			term_label: 'install · linux'
		},
		win: {
			os: 'win',
			label: 'Windows',
			icon: 'monitor',
			lead: 'Download for Windows',
			sub: 'x86-64 · MSI installer',
			file: `armornet-agent-${VERSION}-windows-amd64.msi`,
			size: '26.4 MB',
			sha256: 'e93c…4a71',
			install_cmd: 'iwr https://install.armornet.io/agent.ps1 | iex',
			run_cmd: 'armornet.exe agent serve -config .\\agent.yaml',
			term_label: 'install · windows'
		},
		docker: {
			os: 'docker',
			label: 'Docker',
			icon: 'package',
			lead: 'Pull the agent image',
			sub: 'Multi-arch · linux/amd64 · linux/arm64',
			file: '',
			size: '—',
			sha256: 'c0de…11ff',
			install_cmd: `docker run -v ./agent.yaml:/agent.yaml ghcr.io/armornetio/agent:${VERSION.slice(1)}`,
			run_cmd: 'docker compose up -d armornet-agent',
			term_label: 'run · docker'
		}
	};

	const AGENT_YAML = `# armornet agent config — download & run
agent:
  name: edge-agent-01
  mode: local
control_plane:
  endpoint: wss://opamp.armornet.io/v1/opamp
  auth:
    method: oidc
    client_id: <issued-on-download>
mesh:
  auto_register: true
`;

	// ── Detection ──────────────────────────────────────────────────────────────
	function detectOs(): OsKey {
		if (typeof navigator === 'undefined') return 'mac';
		const p = (
			(navigator as any).userAgentData?.platform ??
			navigator.platform ??
			navigator.userAgent
		).toLowerCase();
		if (p.includes('win')) return 'win';
		if (p.includes('linux') && !p.includes('android')) return 'linux';
		return 'mac';
	}

	function detectDetail(os: OsKey): string {
		if (os === 'win') return 'Windows · x86-64';
		if (os === 'linux') return 'Linux · x86-64';
		const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
		return `macOS · ${/arm|aarch/.test(ua) ? 'Apple Silicon' : 'Apple Silicon'}`;
	}

	// ── State ──────────────────────────────────────────────────────────────────
	let selected = $state<OsKey>(detectOs());
	const detected = detectOs();
	let copied = $state(false);
	let dlState = $state<'idle' | 'preparing' | 'done'>('idle');

	const build = $derived(BUILDS[selected]);

	$effect(() => {
		if (dlState !== 'preparing') return;
		const t = setTimeout(() => (dlState = 'done'), 1100);
		return () => clearTimeout(t);
	});

	// ── Handlers ───────────────────────────────────────────────────────────────
	function startDownload() {
		dlState = 'preparing';
	}

	async function copyInstall() {
		try {
			await navigator.clipboard.writeText(build.install_cmd);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* no-op */
		}
	}

	function downloadYaml() {
		const blob = new Blob([AGENT_YAML], { type: 'text/yaml' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'agent.yaml';
		a.click();
		URL.revokeObjectURL(a.href);
	}

	function select(os: OsKey) {
		selected = os;
		dlState = 'idle';
		copied = false;
	}
</script>

<svelte:head><title>Download Agent — Armornet</title></svelte:head>

<LayoutHeader eyebrow="// agents · download" />

<div class="page">
	<!-- ── Hero ──────────────────────────────────────────────────────────────── -->
	<p class="eyebrow">// deploy an agent</p>
	<h1 class="hero-title">Run an armornet agent<br /><span class="accent">in one click.</span></h1>
	<p class="lede">
		Download the installer, run it, and the agent registers itself into your Agent Mesh — no
		manifests to hand-write, no cluster to prep.
	</p>

	<div class="detected">
		<span class="dot"></span>
		<span>Detected&nbsp; <b>{detectDetail(detected)}</b></span>
	</div>

	<!-- The button -->
	<button class="dl" onclick={startDownload}>
		<span class="dl-ico">
			{#if dlState === 'done'}
				<Icon name="check" size={24} strokeWidth={2.4} />
			{:else}
				<Icon name="download" size={24} strokeWidth={2.1} />
			{/if}
		</span>
		<span class="dl-txt">
			<span class="dl-lead">
				{#if dlState === 'preparing'}Preparing…{:else if dlState === 'done'}Download started{:else}{build.lead}{/if}
			</span>
			<span class="dl-sub">
				{#if dlState === 'done' && build.file}{build.file}{:else}{build.sub}{/if}
			</span>
		</span>
		<span class="dl-meta">
			<span class="v">{VERSION}</span>
			<span class="s">{build.size}</span>
		</span>
	</button>

	<div class="verify">
		<Icon name="shield" size={12} />
		<span>Signed &amp; notarized · SHA-256 <code>{build.sha256}</code></span>
	</div>

	<!-- Other platforms -->
	<div class="pills">
		{#each Object.values(BUILDS) as b}
			<button class="pill" class:pill--active={selected === b.os} onclick={() => select(b.os)}>
				<Icon name={b.icon} size={13} strokeWidth={1.75} />
				{b.label}
			</button>
		{/each}
	</div>

	<!-- ── Divider ───────────────────────────────────────────────────────────── -->
	<div class="rule"><span>Prefer the command line?</span></div>

	<!-- CLI path -->
	<div class="term">
		<div class="term-bar">
			<i></i><i></i><i></i>
			<span class="term-lbl">{build.term_label}</span>
		</div>
		<div class="term-body">
			<code><span class="pr">$</span>{build.install_cmd}</code>
			<button class="copy" class:copy--done={copied} onclick={copyInstall}>
				<Icon name={copied ? 'check' : 'copy'} size={12} strokeWidth={copied ? 2.5 : 1.75} />
				{copied ? 'Copied' : 'Copy'}
			</button>
		</div>
	</div>

	<div class="aside-row">
		<Button variant="ghost" size="sm" onclick={downloadYaml}>
			{#snippet children()}
				<Icon name="download" size={12} /> Download agent.yaml
			{/snippet}
		</Button>
		<span class="runhint">then run&nbsp; <b>{build.run_cmd}</b></span>
	</div>

	<!-- ── What happens next ─────────────────────────────────────────────────── -->
	<div class="next">
		<h2 class="next-h">What happens next</h2>
		<div class="steps">
			<div class="step">
				<span class="n">01</span>
				<h3>Install</h3>
				<p>One click drops the <code>armornet</code> binary on your host. Nothing else to configure.</p>
			</div>
			<div class="step">
				<span class="n">02</span>
				<h3>Run</h3>
				<p>Start the agent with the bundled <code>agent.yaml</code>. It authenticates over OIDC on first boot.</p>
			</div>
			<div class="step">
				<span class="n">03</span>
				<h3>Joins the mesh</h3>
				<p>The agent registers into your Agent Mesh and appears live in the console within seconds.</p>
			</div>
		</div>
	</div>

	<p class="footnote">
		Air-gapped or a different arch? <a href="/showcase/mockups/agent-install">Browse all builds &amp; checksums →</a>
	</p>
</div>

<style>
	.page {
		max-width: 640px;
		display: flex;
		flex-direction: column;
	}

	/* ── Hero ──────────────────────────────────────────────────────────────── */
	.eyebrow {
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.24em;
		color: var(--accent);
		text-transform: uppercase;
		margin: 0 0 0.85rem;
	}
	.hero-title {
		font-family: var(--mono);
		font-weight: 700;
		font-size: clamp(1.6rem, 4vw, 2.3rem);
		line-height: 1.1;
		letter-spacing: -0.01em;
		color: var(--fg);
		margin: 0 0 0.85rem;
		text-wrap: balance;
	}
	.accent {
		color: var(--accent);
	}
	.lede {
		color: var(--fg-muted);
		font-size: 0.95rem;
		line-height: 1.55;
		max-width: 48ch;
		margin: 0 0 1.5rem;
	}

	.detected {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-family: var(--mono);
		font-size: 0.68rem;
		letter-spacing: 0.05em;
		color: #34d399;
		background: rgba(52, 211, 153, 0.07);
		border: 1px solid rgba(52, 211, 153, 0.28);
		border-radius: 100px;
		padding: 0.3rem 0.75rem 0.3rem 0.6rem;
		align-self: flex-start;
		margin-bottom: 1rem;
	}
	.detected b {
		color: var(--fg);
	}
	.detected .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #34d399;
		animation: pulse 2.4s infinite;
	}
	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.45);
		}
		70% {
			box-shadow: 0 0 0 7px rgba(52, 211, 153, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(52, 211, 153, 0);
		}
	}

	/* ── The button ────────────────────────────────────────────────────────── */
	.dl {
		position: relative;
		display: flex;
		align-items: center;
		gap: 1.1rem;
		width: 100%;
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		background: linear-gradient(145deg, rgba(94, 234, 212, 0.14), rgba(94, 234, 212, 0.05));
		border: 1px solid var(--border-accent, rgba(94, 234, 212, 0.28));
		border-radius: 8px;
		padding: 1.15rem 1.25rem;
		color: var(--fg);
		box-shadow:
			0 0 0 1px rgba(94, 234, 212, 0.04),
			0 18px 46px -20px rgba(94, 234, 212, 0.5),
			inset 0 1px 0 rgba(255, 255, 255, 0.05);
		transition:
			transform 0.18s ease,
			box-shadow 0.25s ease,
			border-color 0.25s ease;
	}
	.dl:hover {
		transform: translateY(-2px);
		border-color: var(--accent);
		box-shadow:
			0 0 0 1px rgba(94, 234, 212, 0.12),
			0 26px 60px -18px rgba(94, 234, 212, 0.65),
			inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}
	.dl:active {
		transform: translateY(0);
	}
	.dl-ico {
		flex: 0 0 auto;
		width: 46px;
		height: 46px;
		border-radius: 8px;
		display: grid;
		place-items: center;
		color: #04120f;
		background: radial-gradient(120% 120% at 30% 20%, var(--accent-bright, #7af0d8), var(--accent));
		box-shadow: 0 6px 18px -6px rgba(94, 234, 212, 0.7);
	}
	.dl-txt {
		flex: 1;
		min-width: 0;
	}
	.dl-lead {
		display: block;
		font-family: var(--mono);
		font-weight: 700;
		font-size: 1rem;
		letter-spacing: 0.01em;
	}
	.dl-sub {
		display: block;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-muted);
		margin-top: 0.2rem;
		letter-spacing: 0.02em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dl-meta {
		flex: 0 0 auto;
		text-align: right;
		font-family: var(--mono);
	}
	.dl-meta .v {
		display: block;
		font-size: 0.76rem;
		color: var(--accent);
		font-weight: 700;
	}
	.dl-meta .s {
		display: block;
		font-size: 0.62rem;
		color: var(--fg-dim);
		margin-top: 0.15rem;
	}

	.verify {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0.75rem 0.15rem 0;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
		letter-spacing: 0.03em;
	}
	.verify :global(svg) {
		color: #34d399;
	}
	.verify code {
		color: var(--fg-muted);
	}

	/* ── Platform pills ────────────────────────────────────────────────────── */
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1.4rem;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.4rem 0.8rem;
		font-family: var(--mono);
		font-size: 0.7rem;
		letter-spacing: 0.03em;
		color: var(--fg-dim);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 100px;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.pill:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.pill--active {
		color: var(--accent);
		border-color: var(--border-accent, rgba(94, 234, 212, 0.28));
		background: rgba(94, 234, 212, 0.08);
	}

	/* ── Divider ───────────────────────────────────────────────────────────── */
	.rule {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin: 2.4rem 0 1.4rem;
		color: var(--fg-dim);
	}
	.rule::before,
	.rule::after {
		content: '';
		height: 1px;
		flex: 1;
		background: var(--border);
	}
	.rule span {
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}

	/* ── Terminal ──────────────────────────────────────────────────────────── */
	.term {
		border: 1px solid var(--border-accent, rgba(94, 234, 212, 0.28));
		border-radius: 4px;
		background: rgba(3, 7, 18, 0.72);
		overflow: hidden;
	}
	.term-bar {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.55rem 0.75rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}
	.term-bar i {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		display: block;
	}
	.term-bar i:nth-child(1) {
		background: #ff5f57;
	}
	.term-bar i:nth-child(2) {
		background: #febc2e;
	}
	.term-bar i:nth-child(3) {
		background: #28c840;
	}
	/* Terminal chrome is always dark — colours inside it are theme-independent. */
	.term-lbl {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		color: rgba(255, 255, 255, 0.42);
		text-transform: uppercase;
	}
	.term-body {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 0.85rem 0.85rem 1rem;
	}
	.term-body code {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.92);
		white-space: nowrap;
		overflow-x: auto;
		flex: 1;
	}
	.term-body .pr {
		color: var(--accent);
		user-select: none;
		margin-right: 0.5ch;
	}
	.copy {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		color: rgba(255, 255, 255, 0.55);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 3px;
		padding: 0.3rem 0.55rem;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.copy:hover {
		color: rgba(255, 255, 255, 0.95);
		border-color: rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.08);
	}
	.copy--done {
		color: #34d399;
		border-color: rgba(52, 211, 153, 0.3);
	}

	.aside-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.85rem;
	}
	.runhint {
		font-family: var(--mono);
		font-size: 0.64rem;
		color: var(--fg-dim);
		letter-spacing: 0.02em;
	}
	.runhint b {
		color: var(--fg-muted);
		font-weight: 400;
	}

	/* ── Next steps ────────────────────────────────────────────────────────── */
	.next {
		margin-top: 2.6rem;
	}
	.next-h {
		font-family: var(--mono);
		font-size: 0.64rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin: 0 0 1rem;
		font-weight: 600;
	}
	.steps {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}
	.step {
		border: 1px solid var(--border);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.02);
		padding: 0.9rem 0.9rem 1rem;
	}
	.step .n {
		font-family: var(--mono);
		font-size: 0.62rem;
		font-weight: 700;
		color: var(--accent);
		background: rgba(94, 234, 212, 0.08);
		border: 1px solid rgba(94, 234, 212, 0.25);
		border-radius: 3px;
		padding: 0.1rem 0.4rem;
		letter-spacing: 0.05em;
	}
	.step h3 {
		font-family: var(--mono);
		font-size: 0.82rem;
		margin: 0.75rem 0 0.3rem;
		color: var(--fg);
		font-weight: 600;
	}
	.step p {
		margin: 0;
		font-size: 0.76rem;
		color: var(--fg-muted);
		line-height: 1.45;
	}
	.step p code {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--accent-bright, #7af0d8);
		background: rgba(94, 234, 212, 0.06);
		padding: 0.05rem 0.25rem;
		border-radius: 2px;
	}

	.footnote {
		margin-top: 2rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		color: var(--fg-dim);
	}
	.footnote a {
		color: var(--fg-muted);
		text-decoration: none;
		border-bottom: 1px dotted var(--border-strong);
	}
	.footnote a:hover {
		color: var(--accent);
	}

	@media (max-width: 560px) {
		.steps {
			grid-template-columns: 1fr;
		}
		.dl-meta {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.detected .dot {
			animation: none;
		}
		.dl {
			transition: none;
		}
	}
</style>
