<script lang="ts">
	// ── Mockup: Onboarding › Codebase › Supply-chain surface ──────────────────
	//
	// Renders the output of the `codebase_analysis` agent — a static scan of a
	// customer's GitHub repo that clones in memory, detects every package-
	// ecosystem manifest, and recommends supply-chain proxy configs.
	//
	// The screen answers three questions, in priority order:
	//   1. What proxies can I ENABLE right now?  (recommendations — actionable)
	//   2. What did we detect that has NO proxy yet?  (the honest gap)
	//   3. What evidence backs each of those?  (findings — manifest inventory)
	//
	// Grouped by ecosystem throughout. The `state` switch flips
	// never-scanned → scanning → scanned to show every lifecycle state.
	//
	// Data shapes (exact fields from the codebase_analysis API contract):
	//   ScanResult {
	//     repo, ref, commit_sha, scanned_at, ecosystems[],
	//     findings:        { ecosystem, path, manifest, kind }[]
	//     recommendations: { ecosystem, proxy_type, upstream_registry,
	//                        listen_addr, evidence[] }[]
	//   }
	//   kind ∈ 'manifest' | 'lockfile'
	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';
	import Panel from '$lib/layout/Panel.svelte';
	import EmptyState from '$lib/primitives/EmptyState.svelte';
	import Icon from '$lib/icons/Icon.svelte';

	// ── Mockup state switch ───────────────────────────────────────────────────
	let view = $state<'scanned' | 'scanning' | 'never'>('scanned');

	// ── API stub — the exact JSON the API returns ─────────────────────────────
	type Finding = { ecosystem: string; path: string; manifest: string; kind: 'manifest' | 'lockfile' };
	type Recommendation = {
		ecosystem: string;
		proxy_type: string;
		upstream_registry: string;
		listen_addr: string;
		evidence: string[];
	};
	type ScanResult = {
		repo: string;
		ref: string;
		commit_sha: string;
		scanned_at: string;
		ecosystems: string[];
		findings: Finding[];
		recommendations: Recommendation[];
	};

	const scan: ScanResult = {
		repo: 'https://github.com/acme/api.git',
		ref: 'main',
		commit_sha: '9f2c1a7b0d3e4f5a6b7c8d9e0f1a2b3c4d5e6f70',
		scanned_at: '2026-07-23T14:30:00Z',
		ecosystems: ['docker', 'go', 'npm', 'pip', 'cargo', 'ruby', 'maven'],
		findings: [
			{ ecosystem: 'go', path: 'go.mod', manifest: 'go.mod', kind: 'manifest' },
			{ ecosystem: 'go', path: 'go.sum', manifest: 'go.sum', kind: 'lockfile' },
			{ ecosystem: 'npm', path: 'web/package.json', manifest: 'package.json', kind: 'manifest' },
			{ ecosystem: 'npm', path: 'web/pnpm-lock.yaml', manifest: 'pnpm-lock.yaml', kind: 'lockfile' },
			{ ecosystem: 'pip', path: 'services/api/requirements.txt', manifest: 'requirements.txt', kind: 'manifest' },
			{ ecosystem: 'docker', path: 'Dockerfile', manifest: 'Dockerfile', kind: 'manifest' },
			{ ecosystem: 'docker', path: 'deploy/web.Dockerfile', manifest: 'web.Dockerfile', kind: 'manifest' },
			{ ecosystem: 'cargo', path: 'rustsvc/Cargo.toml', manifest: 'Cargo.toml', kind: 'manifest' },
			{ ecosystem: 'cargo', path: 'rustsvc/Cargo.lock', manifest: 'Cargo.lock', kind: 'lockfile' },
			{ ecosystem: 'ruby', path: 'ops/Gemfile', manifest: 'Gemfile', kind: 'manifest' },
			{ ecosystem: 'maven', path: 'jvm/pom.xml', manifest: 'pom.xml', kind: 'manifest' }
		],
		recommendations: [
			{ ecosystem: 'go', proxy_type: 'go', upstream_registry: 'https://proxy.golang.org', listen_addr: '127.0.0.1:4873', evidence: ['go.mod'] },
			{ ecosystem: 'npm', proxy_type: 'npm', upstream_registry: 'https://registry.npmjs.org', listen_addr: '127.0.0.1:4874', evidence: ['web/package.json'] },
			{ ecosystem: 'pip', proxy_type: 'pip', upstream_registry: 'https://pypi.org', listen_addr: '127.0.0.1:4875', evidence: ['services/api/requirements.txt'] },
			{ ecosystem: 'docker', proxy_type: 'docker', upstream_registry: 'https://registry-1.docker.io', listen_addr: '127.0.0.1:4876', evidence: ['Dockerfile', 'deploy/web.Dockerfile'] }
		]
	};

	// ── Ecosystem presentation metadata ───────────────────────────────────────
	const ECO: Record<string, { label: string; color: string; registryName: string }> = {
		go: { label: 'go', color: '#5FEAD5', registryName: 'Go module proxy' },
		npm: { label: 'npm', color: '#FB923C', registryName: 'npm registry' },
		pip: { label: 'pip', color: '#38BDF8', registryName: 'PyPI' },
		docker: { label: 'docker', color: '#60A5FA', registryName: 'Docker registry' },
		cargo: { label: 'cargo', color: '#DEA584', registryName: 'crates.io' },
		ruby: { label: 'ruby', color: '#F87171', registryName: 'RubyGems' },
		maven: { label: 'maven', color: '#C084FC', registryName: 'Maven Central' }
	};
	const eco = (id: string) => ECO[id] ?? { label: id, color: 'var(--fg-dim)', registryName: id };

	// ── Derived rollups ───────────────────────────────────────────────────────
	// The full detected set is the distinct ecosystem across findings — the
	// source of truth for "everything we saw", not the recommendations subset.
	const detected = $derived([...new Set(scan.findings.map((f) => f.ecosystem))]);
	const recByEco = $derived(new Map(scan.recommendations.map((r) => [r.ecosystem, r])));
	const findingsByEco = $derived.by(() => {
		const m = new Map<string, Finding[]>();
		for (const f of scan.findings) {
			const arr = m.get(f.ecosystem) ?? [];
			arr.push(f);
			m.set(f.ecosystem, arr);
		}
		return m;
	});
	// The honest gap: detected, but no supply-chain proxy exists for it yet.
	const gaps = $derived(detected.filter((e) => !recByEco.has(e)));
	const manifestCount = $derived(scan.findings.filter((f) => f.kind === 'manifest').length);
	const lockfileCount = $derived(scan.findings.filter((f) => f.kind === 'lockfile').length);

	const shortSha = $derived(scan.commit_sha.slice(0, 12));
	const scannedAgo = 'scanned 6m ago';

	// ── Interaction stubs (all simulated) ─────────────────────────────────────
	let enabled = $state<Record<string, boolean>>({});
	let copied = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	function toggleEnable(id: string) {
		enabled = { ...enabled, [id]: !enabled[id] };
	}
	function configYaml(r: Recommendation): string {
		return [
			`- proxy_type: ${r.proxy_type}`,
			`  upstream_registry: ${r.upstream_registry}`,
			`  listen_addr: ${r.listen_addr}`
		].join('\n');
	}
	function copyConfig(r: Recommendation) {
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(configYaml(r)).catch(() => {});
		}
		copied = r.ecosystem;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = null), 1600);
	}
	const enabledCount = $derived(scan.recommendations.filter((r) => enabled[r.ecosystem]).length);
</script>

<svelte:head><title>Mockup · Codebase Analysis</title></svelte:head>

<LayoutHeader eyebrow="// onboarding · codebase" sub="codebase_analysis · static manifest scan">
	{#snippet title()}Supply-chain <span class="hl">surface.</span>{/snippet}
	{#snippet lede()}
		We cloned your repository in memory and read every package-ecosystem manifest — no build, no
		install. Here's what ships into your supply chain, and the proxy configs we recommend to guard
		each registry your code pulls from.
	{/snippet}
	{#snippet eyebrowActions()}
		<div class="statebar">
			<button class="seg" class:seg--on={view === 'scanned'} onclick={() => (view = 'scanned')}>Scanned</button>
			<button class="seg" class:seg--on={view === 'scanning'} onclick={() => (view = 'scanning')}>Scanning</button>
			<button class="seg" class:seg--on={view === 'never'} onclick={() => (view = 'never')}>Not scanned</button>
		</div>
	{/snippet}
</LayoutHeader>

<div class="page">
	{#if view === 'never'}
		<!-- ═══ PRE-SCAN ═══ -->
		<Panel>
			<div class="prescan">
				<EmptyState
					variant="inline"
					message="No scan has run for this repository yet"
					sub="Run a static analysis to detect package manifests and get recommended supply-chain proxy configs. Nothing is built or installed — the repo is cloned in memory and read."
				>
					{#snippet icon()}<Icon name="package" size={30} strokeWidth={1.25} />{/snippet}
				</EmptyState>
				<div class="prescan-repo">
					<Icon name="git-branch" size={13} strokeWidth={1.75} />
					<span class="mono">{scan.repo}</span>
				</div>
				<button class="btn-primary" onclick={() => (view = 'scanning')}>
					<Icon name="play" size={14} strokeWidth={2} /> Run codebase scan
				</button>
			</div>
		</Panel>

	{:else if view === 'scanning'}
		<!-- ═══ SCANNING ═══ -->
		<Panel>
			<div class="scanning">
				<div class="spin"><Icon name="loader-2" size={26} strokeWidth={2} /></div>
				<div class="scanning-txt">
					<span class="scanning-h">Analyzing <span class="mono">{scan.repo}</span></span>
					<span class="scanning-sub">Cloning <span class="mono">{scan.ref}</span> in memory · walking the tree · matching manifest signatures</span>
				</div>
			</div>
			<div class="steps">
				{#each ['Clone repository (in-memory)', 'Detect package manifests', 'Resolve upstream registries', 'Recommend proxy configs'] as label, i}
					<div class="step" class:step--done={i < 2} class:step--active={i === 2}>
						<span class="step-dot">
							{#if i < 2}<Icon name="check" size={11} strokeWidth={2.5} />{:else if i === 2}<span class="pip"></span>{/if}
						</span>
						<span class="step-l">{label}</span>
					</div>
				{/each}
			</div>
		</Panel>

	{:else}
		<!-- ═══ SCANNED ═══ -->
		<!-- scan meta bar -->
		<div class="meta">
			<div class="meta-repo">
				<Icon name="git-branch" size={14} strokeWidth={1.75} />
				<span class="meta-repo-url mono">{scan.repo}</span>
			</div>
			<div class="meta-facts">
				<span class="fact"><span class="fact-k">ref</span><span class="fact-v mono">{scan.ref}</span></span>
				<span class="fact"><span class="fact-k">commit</span><span class="fact-v mono">{shortSha}</span></span>
				<span class="fact"><span class="fact-k">status</span><span class="fact-v">{scannedAgo}</span></span>
				<button class="rescan" onclick={() => (view = 'scanning')}>
					<Icon name="refresh-cw" size={12} strokeWidth={1.75} /> Re-scan
				</button>
			</div>
		</div>

		<!-- instrument strip -->
		<div class="instrument">
			<div class="ins-cell"><span class="ins-v">{detected.length}</span><span class="ins-l">ecosystems detected</span></div>
			<div class="ins-sep"></div>
			<div class="ins-cell"><span class="ins-v ok">{scan.recommendations.length}</span><span class="ins-l">proxies recommended</span></div>
			<div class="ins-sep"></div>
			<div class="ins-cell"><span class="ins-v" class:warn={gaps.length > 0}>{gaps.length}</span><span class="ins-l">no proxy available</span></div>
			<div class="ins-sep"></div>
			<div class="ins-cell"><span class="ins-v">{manifestCount}<span class="ins-sub">+{lockfileCount}</span></span><span class="ins-l">manifests + lockfiles</span></div>
			<div class="ins-cell ins-right">
				<span class="ins-l">enabled</span>
				<span class="ins-v">{enabledCount}<span class="ins-sub">/{scan.recommendations.length}</span></span>
			</div>
		</div>

		<!-- ═══ SECTION 1 · RECOMMENDED PROXIES ═══ -->
		<section class="sec">
			<div class="sec-head">
				<div class="sec-title">
					<Icon name="shield-check" size={15} strokeWidth={1.75} />
					<h2>Recommended proxies</h2>
					<span class="sec-count">{scan.recommendations.length}</span>
				</div>
				<p class="sec-sub">One guarded registry per ecosystem we can protect. Enable a proxy to route pulls through Armornet, or copy the config for your agent manifest.</p>
			</div>

			<div class="rec-grid">
				{#each scan.recommendations as r (r.ecosystem)}
					{@const m = eco(r.ecosystem)}
					{@const on = enabled[r.ecosystem]}
					<div class="rec" class:rec--on={on} style:--eco={m.color}>
						<div class="rec-top">
							<span class="mono-badge" style:--eco={m.color}>{m.label}</span>
							<div class="rec-title">
								<span class="rec-type">{r.proxy_type} proxy</span>
								<span class="rec-reg">{m.registryName}</span>
							</div>
							<span class="rec-state" class:rec-state--on={on}>
								<span class="rec-state-dot"></span>{on ? 'enabled' : 'off'}
							</span>
						</div>

						<div class="rec-config">
							<div class="cfg-row">
								<span class="cfg-k">upstream_registry</span>
								<span class="cfg-v mono">{r.upstream_registry}</span>
							</div>
							<div class="cfg-row">
								<span class="cfg-k">listen_addr</span>
								<span class="cfg-v mono">{r.listen_addr}</span>
							</div>
						</div>

						<div class="rec-evidence">
							<span class="ev-l">triggered by</span>
							{#each r.evidence as e}<span class="ev-file mono"><Icon name="file-text" size={10} strokeWidth={1.75} />{e}</span>{/each}
						</div>

						<div class="rec-actions">
							<button class="btn-enable" class:btn-enable--on={on} onclick={() => toggleEnable(r.ecosystem)}>
								{#if on}<Icon name="check-circle" size={13} strokeWidth={1.75} /> Enabled{:else}<Icon name="power" size={13} strokeWidth={1.75} /> Enable proxy{/if}
							</button>
							<button class="btn-copy" class:btn-copy--done={copied === r.ecosystem} onclick={() => copyConfig(r)}>
								<Icon name={copied === r.ecosystem ? 'check' : 'copy'} size={12} strokeWidth={1.75} />
								{copied === r.ecosystem ? 'Copied' : 'Copy config'}
							</button>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- ═══ SECTION 2 · DETECTED · NO PROXY AVAILABLE ═══ -->
		{#if gaps.length > 0}
			<section class="sec">
				<div class="sec-head">
					<div class="sec-title">
						<Icon name="alert-triangle" size={15} strokeWidth={1.75} />
						<h2>Detected · no proxy available</h2>
						<span class="sec-count sec-count--warn">{gaps.length}</span>
					</div>
					<p class="sec-sub">We found these ecosystems in your repo but there's no supply-chain proxy for them yet. They're listed so the gap is visible — pulls for these registries are not guarded.</p>
				</div>

				<div class="gap-grid">
					{#each gaps as g (g)}
						{@const m = eco(g)}
						{@const fs = findingsByEco.get(g) ?? []}
						<div class="gap" style:--eco={m.color}>
							<div class="gap-top">
								<span class="mono-badge mono-badge--dim" style:--eco={m.color}>{m.label}</span>
								<div class="gap-title">
									<span class="gap-name">{m.registryName}</span>
									<span class="gap-tag">no proxy yet</span>
								</div>
							</div>
							<div class="gap-files">
								{#each fs as f}
									<span class="gap-file mono"><Icon name="file-text" size={10} strokeWidth={1.75} />{f.path}</span>
								{/each}
							</div>
							<p class="gap-note">Detected only. A supply-chain proxy for {m.label} isn't available in this release — tracked for a future one.</p>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- ═══ SECTION 3 · MANIFEST EVIDENCE ═══ -->
		<section class="sec">
			<div class="sec-head">
				<div class="sec-title">
					<Icon name="clipboard-list" size={15} strokeWidth={1.75} />
					<h2>Manifest evidence</h2>
					<span class="sec-count">{scan.findings.length}</span>
				</div>
				<p class="sec-sub">Every manifest and lockfile the scan matched, grouped by ecosystem and located in the repo tree. This is the evidence behind the recommendations above.</p>
			</div>

			<Panel>
				<div class="evidence">
					{#each detected as e (e)}
						{@const m = eco(e)}
						{@const fs = findingsByEco.get(e) ?? []}
						{@const guarded = recByEco.has(e)}
						<div class="ev-group">
							<div class="ev-group-head">
								<span class="mono-badge mono-badge--sm" style:--eco={m.color}>{m.label}</span>
								<span class="ev-group-count">{fs.length} {fs.length === 1 ? 'file' : 'files'}</span>
								{#if guarded}
									<span class="ev-group-flag ev-group-flag--ok"><Icon name="shield-check" size={11} strokeWidth={1.75} /> proxy available</span>
								{:else}
									<span class="ev-group-flag ev-group-flag--warn"><Icon name="alert-triangle" size={11} strokeWidth={1.75} /> no proxy</span>
								{/if}
							</div>
							<div class="ev-rows">
								{#each fs as f}
									{@const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/') + 1) : ''}
									<div class="ev-row">
										<Icon name="file-text" size={12} strokeWidth={1.5} />
										<span class="ev-path mono"><span class="ev-dir">{dir}</span><span class="ev-name">{f.path.slice(dir.length)}</span></span>
										<span class="ev-kind" class:ev-kind--lock={f.kind === 'lockfile'}>{f.kind}</span>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</Panel>
		</section>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 0.25rem 1.5rem 3rem;
		max-width: 1280px;
		margin: 0 auto;
	}
	.mono {
		font-family: var(--mono);
	}
	.hl {
		color: var(--accent);
	}
	.ok {
		color: var(--palette-emerald-l, #34d399);
	}
	.warn {
		color: var(--palette-amber, #fcd34d);
	}

	/* ── state toggle ── */
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

	/* ── pre-scan ── */
	.prescan {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1rem 0 0.5rem;
	}
	.prescan-repo {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--fg-muted);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 6px 11px;
	}
	.prescan-repo :global(svg) {
		color: var(--accent);
	}
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: var(--accent);
		color: #05201c;
		border: none;
		border-radius: 7px;
		padding: 9px 18px;
		font-family: var(--mono);
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		cursor: pointer;
		transition: filter 140ms;
	}
	.btn-primary:hover {
		filter: brightness(1.1);
	}

	/* ── scanning ── */
	.scanning {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-bottom: 1.2rem;
		margin-bottom: 1.2rem;
		border-bottom: 1px solid var(--border);
	}
	.spin {
		display: flex;
		color: var(--accent);
		animation: spin 900ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.scanning-txt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.scanning-h {
		font-size: 0.95rem;
		color: var(--fg);
	}
	.scanning-sub {
		font-size: 0.72rem;
		color: var(--fg-muted);
	}
	.steps {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.step {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-family: var(--mono);
		font-size: 0.74rem;
		color: var(--fg-dim);
	}
	.step-dot {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 1px solid var(--border);
		color: #05201c;
		flex-shrink: 0;
	}
	.step--done .step-dot {
		background: var(--palette-emerald, #34d399);
		border-color: transparent;
	}
	.step--done .step-l {
		color: var(--fg-muted);
	}
	.step--active .step-dot {
		border-color: var(--accent);
	}
	.step--active .step-l {
		color: var(--fg);
	}
	.pip {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 6px var(--accent);
		animation: pulse 1.1s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.35;
		}
	}

	/* ── meta bar ── */
	.meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-elev);
	}
	.meta-repo {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.meta-repo :global(svg) {
		color: var(--accent);
		flex-shrink: 0;
	}
	.meta-repo-url {
		font-size: 0.78rem;
		color: var(--fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta-facts {
		display: inline-flex;
		align-items: center;
		gap: 1.1rem;
		flex-wrap: wrap;
	}
	.fact {
		display: inline-flex;
		flex-direction: column;
		gap: 1px;
		line-height: 1.2;
	}
	.fact-k {
		font-family: var(--mono);
		font-size: 0.54rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.fact-v {
		font-size: 0.72rem;
		color: var(--fg-muted);
	}
	.rescan {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 6px 11px;
		font-family: var(--mono);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--fg-muted);
		cursor: pointer;
		transition: all 130ms;
	}
	.rescan:hover {
		color: var(--accent);
		border-color: var(--accent);
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
	.ins-right {
		margin-left: auto;
		align-items: flex-end;
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

	/* ── section scaffolding ── */
	.sec {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.sec-head {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.sec-title {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}
	.sec-title :global(svg) {
		color: var(--accent);
	}
	.sec-title h2 {
		margin: 0;
		font-family: var(--sans-brand, 'Rajdhani', sans-serif);
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		color: var(--fg);
	}
	.sec-count {
		font-family: var(--mono);
		font-size: 0.66rem;
		font-weight: 700;
		color: var(--accent);
		background: rgba(94, 234, 212, 0.1);
		border-radius: 20px;
		padding: 2px 9px;
	}
	.sec-count--warn {
		color: var(--palette-amber, #fcd34d);
		background: rgba(252, 211, 77, 0.1);
	}
	.sec-sub {
		margin: 0;
		font-size: 0.82rem;
		line-height: 1.55;
		color: var(--fg-muted);
		max-width: 78ch;
	}

	/* ── shared eco monogram badge ── */
	.mono-badge {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 46px;
		height: 46px;
		border-radius: 8px;
		font-family: var(--mono);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: lowercase;
		color: var(--eco);
		background: color-mix(in srgb, var(--eco) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--eco) 45%, transparent);
	}
	.mono-badge--dim {
		color: color-mix(in srgb, var(--eco) 80%, var(--fg-dim));
		border-style: dashed;
		background: color-mix(in srgb, var(--eco) 6%, transparent);
	}
	.mono-badge--sm {
		width: 34px;
		height: 34px;
		font-size: 0.62rem;
		border-radius: 6px;
	}

	/* ── recommendation grid ── */
	.rec-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 1rem;
	}
	.rec {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-elev);
		transition:
			border-color 0.18s,
			background 0.18s;
	}
	.rec--on {
		border-color: color-mix(in srgb, var(--eco) 55%, transparent);
		background: color-mix(in srgb, var(--eco) 5%, transparent);
	}
	.rec-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.rec-title {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.rec-type {
		font-family: var(--mono);
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--fg);
		text-transform: lowercase;
	}
	.rec-reg {
		font-size: 0.68rem;
		color: var(--fg-dim);
	}
	.rec-state {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-left: auto;
		align-self: flex-start;
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.rec-state-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--fg-dim);
	}
	.rec-state--on {
		color: var(--eco);
	}
	.rec-state--on .rec-state-dot {
		background: var(--eco);
		box-shadow: 0 0 6px var(--eco);
	}
	.rec-config {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--border);
		border-radius: 7px;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.25);
	}
	.cfg-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 7px 11px;
	}
	.cfg-row + .cfg-row {
		border-top: 1px solid var(--border);
	}
	.cfg-k {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
		flex-shrink: 0;
	}
	.cfg-v {
		font-size: 0.7rem;
		color: var(--fg);
		text-align: right;
		word-break: break-all;
	}
	.rec-evidence {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.ev-l {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.ev-file {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.64rem;
		color: var(--fg-muted);
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 2px 7px;
	}
	.ev-file :global(svg) {
		color: var(--fg-dim);
	}
	.rec-actions {
		display: flex;
		gap: 8px;
		margin-top: auto;
	}
	.btn-enable {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		flex: 1;
		background: rgba(94, 234, 212, 0.08);
		border: 1px solid rgba(94, 234, 212, 0.3);
		border-radius: 7px;
		padding: 8px 12px;
		font-family: var(--mono);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--accent);
		cursor: pointer;
		transition: background 130ms;
	}
	.btn-enable:hover {
		background: rgba(94, 234, 212, 0.16);
	}
	.btn-enable--on {
		background: rgba(52, 211, 153, 0.1);
		border-color: rgba(52, 211, 153, 0.4);
		color: var(--palette-emerald-l, #34d399);
	}
	.btn-copy {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 7px;
		padding: 8px 12px;
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--fg-muted);
		cursor: pointer;
		transition: all 130ms;
	}
	.btn-copy:hover {
		color: var(--fg);
		border-color: var(--border-strong, var(--fg-dim));
	}
	.btn-copy--done {
		color: var(--palette-emerald-l, #34d399);
		border-color: rgba(52, 211, 153, 0.4);
	}

	/* ── gap grid ── */
	.gap-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
	}
	.gap {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1rem;
		border: 1px dashed color-mix(in srgb, var(--eco) 35%, var(--border));
		border-radius: 10px;
		background: color-mix(in srgb, var(--eco) 3%, transparent);
	}
	.gap-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.gap-title {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.gap-name {
		font-size: 0.82rem;
		color: var(--fg);
	}
	.gap-tag {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--palette-amber, #fcd34d);
	}
	.gap-files {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.gap-file {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.64rem;
		color: var(--fg-muted);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 2px 7px;
	}
	.gap-file :global(svg) {
		color: var(--fg-dim);
	}
	.gap-note {
		margin: 0;
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--fg-dim);
	}

	/* ── evidence ── */
	.evidence {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.ev-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ev-group-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.ev-group-count {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}
	.ev-group-flag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.ev-group-flag--ok {
		color: var(--palette-emerald-l, #34d399);
	}
	.ev-group-flag--warn {
		color: var(--palette-amber, #fcd34d);
	}
	.ev-rows {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: 7px;
		overflow: hidden;
	}
	.ev-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 7px 11px;
		background: rgba(0, 0, 0, 0.15);
	}
	.ev-row + .ev-row {
		border-top: 1px solid var(--border);
	}
	.ev-row :global(svg) {
		color: var(--fg-dim);
		flex-shrink: 0;
	}
	.ev-path {
		font-size: 0.72rem;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ev-dir {
		color: var(--fg-dim);
	}
	.ev-name {
		color: var(--fg);
	}
	.ev-kind {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--accent);
		border: 1px solid rgba(94, 234, 212, 0.3);
		border-radius: 4px;
		padding: 1px 6px;
		flex-shrink: 0;
	}
	.ev-kind--lock {
		color: var(--palette-blue-l, #93c5fd);
		border-color: rgba(147, 197, 253, 0.3);
	}

	@media (max-width: 640px) {
		.meta-facts {
			width: 100%;
		}
	}
</style>
