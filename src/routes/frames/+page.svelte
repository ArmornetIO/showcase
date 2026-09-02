<script lang="ts">
	import StatTile from '$lib/display/metric/StatTile.svelte';
	import Chip from '$lib/primitives/status/Chip.svelte';
	import Panel from '$lib/primitives/chrome/Panel.svelte';
	import RadialProgress from '$lib/display/progress/RadialProgress.svelte';
	import PostureVerdict from '$lib/display/metric/PostureVerdict.svelte';
	import Frame from '$lib/frames/Frame.svelte';
	import { FRAME_MAP } from '$lib/frames/frames.js';
	import { frameControl } from '$lib/frames/control.svelte.js';

	// Simulate the exposure page: several regions that arrive on their own clocks.
	type Tile = { label: string; value: string; sub: string; halo: 'mint' | 'cyan' | 'amber' | 'red' };
	const REAL: Tile[] = [
		{ label: 'VENDORS TRACKED', value: '1,284', sub: '+12 this week', halo: 'mint' },
		{ label: 'CRITICAL EXPOSURE', value: '37', sub: '-4 vs last month', halo: 'red' },
		{ label: 'BLOCKED PACKAGES', value: '9,102', sub: '+318 today', halo: 'amber' },
		{ label: 'PROXY UPTIME', value: '99.98%', sub: 'nominal', halo: 'cyan' }
	];

	// Each region owns its own frame state so they resolve independently.
	let ready = $state<boolean[]>([false, false, false, false]);
	let panelReady = $state(false);

	function stream() {
		ready = [false, false, false, false];
		panelReady = false;
		[400, 900, 1500, 2200].forEach((ms, i) => setTimeout(() => (ready[i] = true), ms));
		setTimeout(() => (panelReady = true), 2600);
	}

	const framedComponents = Object.keys(FRAME_MAP);
</script>

<svelte:head><title>ItemFrames — UI Lib</title></svelte:head>

<div class="px-6 py-6 flex flex-col gap-8 max-w-5xl">
	<!-- ── Intro ─────────────────────────────────────────────────────────── -->
	<header class="flex flex-col gap-2">
		<h2 class="text-2xl font-semibold text-[var(--fg)]">ItemFrames</h2>
		<p class="text-sm text-[var(--fg-muted)] leading-relaxed max-w-2xl">
			The <strong>pre-load scaffold</strong> for showcase components. A <em>frame</em> is not a loading
			spinner — it's the state a region is in <em>before</em> its data exists. The component renders
			its own real outer shell; its text fields are drained into shimmer bars of the same size.
			Because the outline is real, the scaffold is pixel-accurate with <strong>zero layout shift</strong>
			— the skeleton <em>is</em> the page with the data removed.
		</p>
	</header>

	<!-- ── How it works ──────────────────────────────────────────────────── -->
	<section class="doc-card">
		<h3 class="doc-h">How it works — no per-component branch</h3>
		<ol class="doc-list">
			<li>
				A dedicated map, <code>lib/frames/frames.ts</code>, lists the components we know we can frame
				→ the selectors of the inner fields that shimmer. <em>That list is the opt-in.</em>
			</li>
			<li>
				<code>&lt;Frame framed&gt;</code> stamps <code>data-frame</code> on a region and injects one
				global stylesheet generated from the map.
			</li>
			<li>
				The CSS matches those field classes <strong>at any depth</strong>, so one Frame around a
				region shimmers every mapped component inside it — nothing in the component source changes.
			</li>
		</ol>
		<p class="doc-note">
			Currently framed: {#each framedComponents as c, i}<code>{c}</code>{i < framedComponents.length - 1 ? ', ' : ''}{/each}.
			Onboard a component by giving it a stable field class and adding one map entry.
		</p>
	</section>

	<!-- ── Live demo ─────────────────────────────────────────────────────── -->
	<section class="flex flex-col gap-4">
		<div class="flex items-center justify-between flex-wrap gap-3">
			<h3 class="doc-h">Live — independent, staggered arrival</h3>
			<div class="flex items-center gap-3">
				<button class="demo-btn" onclick={stream}>Simulate load</button>
				<label class="demo-toggle">
					<input type="checkbox" bind:checked={frameControl.forceFrames} />
					Force frames
				</label>
			</div>
		</div>
		<p class="text-xs text-[var(--fg-dim)] font-mono">
			Or open the <strong>Dev cog → ITEMFRAMES</strong> and set "slow loading" to hold real network
			GETs — every page's frames stay on screen while you tune them.
		</p>

		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			{#each REAL as tile, i}
				<Frame framed={!ready[i]}>
					<StatTile label={tile.label} value={tile.value} sub={tile.sub} halo={tile.halo} />
				</Frame>
			{/each}
		</div>

		<!-- Rich widgets render bespoke frame states via getFrameState():
		     the radial spins an rgb arc, the posture % rolls until data lands. -->
		<Frame framed={!panelReady}>
			<div class="flex flex-wrap items-center gap-8 p-5 border border-[var(--border)] rounded-[10px] bg-[var(--bg-elev)]">
				<RadialProgress value={82} label="SCORE" size={104} strokeWidth={9} variant="accent" />
				<div class="flex-1 min-w-[280px]">
					<PostureVerdict
						value={100}
						prefix="You have assurance on"
						suffix="of your critical third-party risk"
					/>
				</div>
			</div>
		</Frame>

		<Frame framed={!panelReady}>
			<Panel title="TOP VENDORS">
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2">
						<Chip color="critical" look="ghost">critical</Chip>
						<span class="text-sm text-[var(--fg)]">Northwind Traders</span>
					</div>
					<div class="flex items-center gap-2">
						<Chip color="warn" look="ghost">high</Chip>
						<span class="text-sm text-[var(--fg)]">Contoso Logistics</span>
					</div>
				</div>
			</Panel>
		</Frame>
	</section>

	<!-- ── API ───────────────────────────────────────────────────────────── -->
	<section class="doc-card">
		<h3 class="doc-h">Usage</h3>
		<pre class="doc-pre">{`import { Frame, StatTile } from 'showcase';

<Frame framed={!data}>
  <StatTile label="CRITICAL EXPOSURE" value={data?.critical ?? '—'} halo="red" />
</Frame>`}</pre>
		<ul class="doc-list">
			<li><code>&lt;Frame framed={'{bool}'}&gt;</code> — true = scaffold, false = real content.</li>
			<li><code>getFrameState()</code> — reactive getter; a child can read the frame state to render its own placeholder.</li>
			<li><code>frameControl.forceFrames</code> / <code>frameControl.devLatencyMs</code> — the Dev cog's show-off switches.</li>
		</ul>
	</section>
</div>

<style>
	.doc-card {
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-elev);
		padding: 1.1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.doc-h {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--fg);
	}
	.doc-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.82rem;
		line-height: 1.5;
		color: var(--fg-muted);
		padding-left: 1.1rem;
		list-style: decimal;
	}
	.doc-note {
		font-size: 0.75rem;
		color: var(--fg-dim);
	}
	.doc-pre {
		background: var(--surface-raised, rgba(0, 0, 0, 0.25));
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.8rem;
		font-family: var(--mono, monospace);
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--fg);
		overflow-x: auto;
	}
	code {
		font-family: var(--mono, monospace);
		font-size: 0.78em;
		color: var(--accent);
	}
	.demo-btn {
		padding: 0.35rem 0.8rem;
		font-family: var(--mono, monospace);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--fg);
		background: var(--bg-elev);
		cursor: pointer;
	}
	.demo-btn:hover {
		border-color: var(--accent);
	}
	.demo-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--mono, monospace);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--fg-dim);
		cursor: pointer;
	}
</style>
