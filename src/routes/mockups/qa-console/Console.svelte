<script lang="ts">
	// The redesigned console: one panel, a vertical rail of six groups, and
	// nothing standing on screen that a control's own label does not need.
	//
	// Six groups rather than four because the numbers force it — a combined
	// canvas group measured 1,289px against ~700px of usable height, so it
	// would still scroll. Six labels do not fit a horizontal tab strip at this
	// width, which is why the switcher is a rail.
	import Fader from './Fader.svelte';
	import InfoDot from './InfoDot.svelte';
	import Seg from './Seg.svelte';

	interface Props {
		/** Simulates a route where the canvas tools do not apply. */
		gated?: boolean;
		nitCount?: number;
		onClose: () => void;
	}
	let { gated = false, nitCount = 4, onClose }: Props = $props();

	type Group = { id: string; label: string; glyph: string; gate?: string };

	const GROUPS: Group[] = [
		{ id: 'page', label: 'PAGE', glyph: '▤' },
		{ id: 'render', label: 'RENDER', glyph: '◧' },
		{ id: 'globe', label: 'GLOBE', glyph: '◍' },
		{ id: 'mesh', label: 'MESH', glyph: '⬡' },
		{ id: 'capture', label: 'CAPTURE', glyph: '◎' },
		{ id: 'perf', label: 'PERF', glyph: '⌁' }
	];

	// A gated group keeps its place in the rail and states its condition. The
	// old panel deleted them, which is why nobody knew how big it really was.
	const GATES: Record<string, string> = {
		globe: 'Needs a registered globe on the page.',
		mesh: 'Only on /mesh.'
	};

	const groups = $derived(
		GROUPS.map((g) => ({ ...g, gate: gated ? GATES[g.id] : undefined }))
	);

	let active = $state('globe');
	const current = $derived(groups.find((g) => g.id === active) ?? groups[0]);

	function onRailKey(e: KeyboardEvent) {
		const i = groups.findIndex((g) => g.id === active);
		if (e.key === 'ArrowDown') active = groups[(i + 1) % groups.length].id;
		else if (e.key === 'ArrowUp') active = groups[(i - 1 + groups.length) % groups.length].id;
		else return;
		e.preventDefault();
	}

	// ── control state ────────────────────────────────────────────────────────
	let dpr = $state(1.25);
	let msaa = $state(true);
	let wall = $state(0.06);
	let relief = $state(0.012);
	let lean = $state(12);
	let orbit = $state('sweep');
	let surface = $state('relief');
	let latency = $state('0');
	let forceFrames = $state(false);
	let shape = $state('default');
	let load = $state({ n: 300, sigs: 8, lines: 24, offline: 90, servers: 3 });
	let force = $state('auto');

	const DETAIL = {
		dpr: 'Biggest single lever measured. Late frames/s — 2.0: 38.5 · 1.5: 21.8 · 1.25: 14.8 · 1.0: 11.6. Applies on the next resize, no reload.',
		msaa: 'Measured a wash: 22.15/s off vs 21.84/s on. A context-creation attribute, so it needs a reload — which is why it is saved.',
		wall: 'How far territory walls stand off the sphere, in globe radii. 0 lays them flat. Past ~0.25 the far walls show over the near crests.',
		relief: 'How high the ground rolls, in globe radii. 0 is a smooth sphere with nothing to stand in.',
		lean: 'How far 3D pieces tip back toward you. 0 stands them straight out of the sphere, where the one facing you shows only its roof.',
		orbit: 'The intro the globe plays on mount — same physics primitive, different sweep.',
		surface: 'Relief: ground, solids standing in it, raised walls. Flat: smooth sphere, disc nodes, walls on the surface.',
		latency: 'Holds every GET so the real pre-load scaffolds stay on screen.',
		force: 'Pins scaffolds on regardless of data.',
		shape: 'A card shape is a decision that ships in the source. The point is comparing one against a column of six on a real page.',
		census: 'What the canvas actually draws. Per-node above ~30 is where density starts to hurt.',
		load: 'Synthetic agents. 0 signatures means all unique, so nothing folds.',
		detailToggles: 'Auto by agent count until you pin one by hand.',
		perf: 'Drops to reduced under sustained late frames or low battery.'
	};

	const NITS = [
		{ sel: '.page-head .page-title', note: 'Title sits 2px low against the breadcrumb baseline.' },
		{ sel: '.metric-grid > div:nth-of-type(2)', note: 'Percentage should be tabular-nums — it jitters on every poll.' },
		{ sel: '.control-table tbody tr:nth-of-type(3)', note: 'Status pill wraps under 1280px and pushes the row height.' },
		{ sel: '.page-actions .btn-primary', note: 'No disabled state while the POST is in flight — double-submits.' }
	];

	const DETAIL_TOGGLES = [
		{ label: 'rings', on: true, pinned: false },
		{ label: 'labels', on: true, pinned: true },
		{ label: 'ports', on: false, pinned: false }
	];

	const CENSUS: [string, string | number][] = [
		['elements', 11840],
		['per node', 39.5],
		['nodes', 300],
		['edges', 412],
		['text', 604],
		['anims', 18]
	];
</script>

<aside class="devcog-console" data-devcog aria-label="Dev console">
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<nav class="dc-rail" role="tablist" aria-orientation="vertical" aria-label="Tool groups" onkeydown={onRailKey}>
		{#each groups as g (g.id)}
			<button
				role="tab"
				class="dc-tab"
				class:dc-on={active === g.id}
				class:dc-off={!!g.gate}
				aria-selected={active === g.id}
				tabindex={active === g.id ? 0 : -1}
				onclick={() => (active = g.id)}
			>
				<span class="dc-glyph">{g.glyph}</span>
				<span class="dc-tab-lab">{g.label}</span>
				{#if g.id === 'capture' && nitCount}<span class="dc-count">{nitCount}</span>{/if}
			</button>
		{/each}
	</nav>

	<div class="dc-main">
		<header class="dc-head">
			<span class="dc-title">{current.label}</span>
			<button class="dc-x" aria-label="Close console" onclick={onClose}>✕</button>
		</header>

		<div class="console-body" data-group={current.id}>
			{#if current.gate}
				<p class="dc-gate">{current.gate}</p>
			{:else if current.id === 'page'}
				<div class="dc-stack">
					<div class="dc-item">
						<span class="dc-lab">card shape</span>
						<InfoDot detail={DETAIL.shape} />
						<button class="dc-btn">pick</button>
					</div>
					<Seg
						options={[
							{ value: 'default', label: 'default' },
							{ value: 'tab', label: 'tab' },
							{ value: 'pill', label: 'pill' },
							{ value: 'plain', label: 'plain' }
						]}
						value={shape}
						onchange={(v) => (shape = v)}
					/>

					<div class="dc-sep"></div>

					<div class="dc-item">
						<span class="dc-lab">slow loading</span>
						<InfoDot detail={DETAIL.latency} />
					</div>
					<Seg
						options={[
							{ value: '0', label: 'off' },
							{ value: '1000', label: '1s' },
							{ value: '3000', label: '3s' },
							{ value: '8000', label: '8s' }
						]}
						value={latency}
						onchange={(v) => (latency = v)}
					/>
					<label class="dc-item dc-click">
						<input type="checkbox" bind:checked={forceFrames} />
						<span class="dc-lab">force frames</span>
						<InfoDot detail={DETAIL.force} />
					</label>

					<div class="dc-sep"></div>

					<div class="dc-item">
						<span class="dc-lab">wasm agent</span>
						<span class="dc-dim">io.armornet.query</span>
					</div>
					<Seg
						options={[
							{ value: '1', label: '1 load' },
							{ value: '2', label: '2 connect' },
							{ value: '3', label: '3 send' }
						]}
						value={'1'}
						onchange={() => {}}
					/>

					<button class="dc-btn dc-wide">random fill assessment</button>
				</div>
			{:else if current.id === 'render'}
				<div class="dc-bank">
					<Fader
						label="density"
						value={dpr}
						min={0.5}
						max={3}
						step={0.25}
						reference={1.25}
						applies="resize"
						format={(v) => `${v.toFixed(2)}×`}
						detail={DETAIL.dpr}
						oninput={(v) => (dpr = v)}
					/>
					<div class="dc-switchstrip">
						<label class="dc-item dc-click">
							<input type="checkbox" bind:checked={msaa} />
							<span class="dc-lab">msaa</span>
							<span class="dc-badge">reload</span>
							<InfoDot detail={DETAIL.msaa} />
						</label>
						<button class="dc-btn">reset</button>
					</div>
				</div>
			{:else if current.id === 'globe'}
				<div class="dc-stack">
					<Seg
						options={[
							{ value: 'sweep', label: 'sweep' },
							{ value: 'moon', label: 'moon' },
							{ value: 'flyin', label: 'fly-in' },
							{ value: 'spin', label: 'spin' }
						]}
						value={orbit}
						onchange={(v) => (orbit = v)}
					/>
					<div class="dc-btns">
						<button class="dc-btn dc-go">▶ intro</button>
						<button class="dc-btn">■ stop</button>
						<!-- "probe", not "arm": the cluster's inspector is the armed
						     thing in this tool, and two arms is one too many. -->
						<button class="dc-btn">◉ probe</button>
						<InfoDot detail={DETAIL.orbit} />
					</div>

					<div class="dc-item">
						<span class="dc-lab">surface</span>
						<InfoDot detail={DETAIL.surface} />
					</div>
					<Seg
						options={[
							{ value: 'relief', label: 'relief' },
							{ value: 'flat', label: 'flat' }
						]}
						value={surface}
						onchange={(v) => (surface = v)}
					/>

					<div class="dc-bank">
						<Fader
							label="wall"
							value={wall}
							min={0}
							max={0.25}
							step={0.005}
							reference={0.06}
							format={(v) => v.toFixed(2)}
							detail={DETAIL.wall}
							oninput={(v) => (wall = v)}
						/>
						<Fader
							label="relief"
							value={relief}
							min={0}
							max={0.05}
							step={0.002}
							reference={0.012}
							format={(v) => v.toFixed(3)}
							detail={DETAIL.relief}
							oninput={(v) => (relief = v)}
						/>
						<Fader
							label="lean"
							value={lean}
							min={0}
							max={45}
							step={1}
							reference={12}
							format={(v) => `${v}°`}
							detail={DETAIL.lean}
							oninput={(v) => (lean = v)}
						/>
					</div>
				</div>
			{:else if current.id === 'mesh'}
				<div class="dc-stack">
					<div class="dc-item">
						<span class="dc-lab">detail</span>
						<InfoDot detail={DETAIL.detailToggles} />
						<span class="dc-dim">300 agents</span>
					</div>
					<div class="dc-toggles">
						{#each DETAIL_TOGGLES as d (d.label)}
							<button class="dc-chip" class:dc-on={d.on}>
								<span class="dc-dot" class:dc-lit={d.on}></span>{d.label}{#if d.pinned}<span
										class="dc-pin">•</span
									>{/if}
							</button>
						{/each}
					</div>

					<div class="dc-sep"></div>

					<div class="dc-item">
						<span class="dc-lab">census</span>
						<InfoDot detail={DETAIL.census} />
						<button class="dc-btn">count</button>
						<button class="dc-btn">svg</button>
						<button class="dc-btn">png</button>
					</div>
					<dl class="dc-census">
						{#each CENSUS as [k, v] (k)}
							<div><dt>{k}</dt><dd class:dc-warn={k === 'per node'}>{v}</dd></div>
						{/each}
					</dl>

					<div class="dc-sep"></div>

					<div class="dc-item">
						<span class="dc-lab">load</span>
						<InfoDot detail={DETAIL.load} />
						<span class="dc-dim">synthetic</span>
					</div>
					<div class="dc-bank">
						<!-- No reference tick where the "default" is just the track end —
						     a mark at the bottom reads as noise, not a sweet spot. -->
						<Fader label="agents" value={load.n} min={0} max={1000} step={10}
							format={(v) => String(v)} detail="0 turns the fixture off."
							oninput={(v) => (load = { ...load, n: v })} />
						<Fader label="sigs" value={load.sigs} min={0} max={40} step={1} reference={8}
							format={(v) => String(v)} detail="0 means all unique — nothing folds."
							oninput={(v) => (load = { ...load, sigs: v })} />
						<Fader label="lines" value={load.lines} min={0} max={100} step={1} reference={24}
							format={(v) => String(v)} detail="Agent↔agent Lines."
							oninput={(v) => (load = { ...load, lines: v })} />
						<Fader label="offline" value={load.offline} min={0} max={100} step={1} reference={90}
							format={(v) => `${v}%`} detail="Rest split degraded/healthy."
							oninput={(v) => (load = { ...load, offline: v })} />
						<Fader label="srv" value={load.servers} min={1} max={12} step={1}
							format={(v) => String(v)} detail=">1 fakes federation."
							oninput={(v) => (load = { ...load, servers: v })} />
					</div>
				</div>
			{:else if current.id === 'capture'}
				<div class="dc-stack">
					<div class="dc-btns">
						<button class="dc-btn">all</button>
						<button class="dc-btn">clear</button>
						<button class="dc-btn dc-go">copy prompt</button>
					</div>
					{#each NITS as n (n.sel)}
						<article class="dc-nit">
							<div class="dc-nit-head">
								<input type="checkbox" aria-label="Select nit" />
								<code class="dc-nit-sel">{n.sel}</code>
								<button class="dc-mini" aria-label="Copy nit">⧉</button>
								<button class="dc-mini" aria-label="Remove nit">✕</button>
							</div>
							<p class="dc-nit-note">{n.note}</p>
						</article>
					{/each}
				</div>
			{:else}
				<div class="dc-stack">
					<div class="dc-item">
						<span class="dc-lab">fps</span>
						<InfoDot detail={DETAIL.perf} />
						<span class="dc-val">58</span>
					</div>
					<div class="dc-item">
						<span class="dc-lab">battery</span>
						<span class="dc-val">100%</span>
					</div>
					<Seg
						options={[
							{ value: 'auto', label: 'auto' },
							{ value: 'full', label: 'full' },
							{ value: 'reduced', label: 'reduced' },
							{ value: 'minimal', label: 'min' }
						]}
						value={force}
						onchange={(v) => (force = v)}
					/>
				</div>
			{/if}
		</div>

		<footer class="dc-foot">
			<a class="dc-link" href="/admin/flags">flags →</a>
		</footer>
	</div>
</aside>

<style>
	.devcog-console {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 9996;
		width: 420px;
		display: flex;
		background: color-mix(in srgb, var(--bg-elev) 94%, transparent);
		backdrop-filter: blur(20px);
		border-left: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
		box-shadow: -8px 0 40px rgba(0, 0, 0, 0.4);
	}

	/* A rail, not tabs: six labels do not fit a horizontal strip at 420px, and
	   a rail leaves the full content width for the fader banks. */
	.dc-rail {
		width: 52px;
		flex: none;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		padding-top: 6px;
	}
	.dc-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 7px 2px;
		border: none;
		border-left: 2px solid transparent;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		font-family: var(--mono, monospace);
		position: relative;
	}
	.dc-tab:hover {
		color: var(--fg);
	}
	.dc-tab.dc-on {
		color: var(--accent);
		border-left-color: var(--accent);
		background: var(--accent-faint);
	}
	.dc-tab.dc-off {
		opacity: 0.38;
	}
	.dc-glyph {
		font-size: 0.9rem;
		line-height: 1;
	}
	.dc-tab-lab {
		font-size: 0.44rem;
		letter-spacing: 0.08em;
	}
	.dc-count {
		position: absolute;
		top: 3px;
		right: 5px;
		font-size: 0.44rem;
		background: var(--accent);
		color: var(--bg);
		border-radius: 6px;
		padding: 0 3px;
	}

	.dc-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.dc-head {
		display: flex;
		align-items: center;
		height: 38px;
		padding: 0 10px 0 14px;
		border-bottom: 1px solid var(--border);
		flex: none;
	}
	.dc-title {
		flex: 1;
		font-family: var(--mono, monospace);
		font-size: 0.56rem;
		letter-spacing: 0.26em;
		color: var(--accent);
	}
	.dc-x {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		border-radius: 4px;
		width: 22px;
		height: 22px;
		font-size: 0.6rem;
		cursor: pointer;
	}

	.console-body {
		flex: 1;
		min-height: 0;
		padding: 12px 14px;
		/* Only the capture batch may scroll; every other group is sized to fit. */
		overflow-y: auto;
	}
	.dc-stack {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.dc-bank {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		padding: 8px 4px 2px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: color-mix(in srgb, var(--surface-raised) 60%, transparent);
	}
	.dc-switchstrip {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 8px;
		padding-bottom: 18px;
		flex: 2;
	}

	.dc-item {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.dc-click {
		cursor: pointer;
	}
	.dc-lab {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.dc-dim {
		margin-left: auto;
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}
	.dc-val {
		margin-left: auto;
		font-family: var(--mono, monospace);
		font-size: 0.62rem;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
	.dc-badge {
		font-family: var(--mono, monospace);
		font-size: 0.48rem;
		padding: 0 3px;
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--fg-dim);
	}
	.dc-sep {
		height: 1px;
		background: var(--border);
		margin: 2px 0;
	}
	.dc-btns {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.dc-btn {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		padding: 3px 8px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
	}
	.dc-btn:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.dc-go {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
	}
	.dc-wide {
		width: 100%;
	}

	.dc-toggles {
		display: flex;
		gap: 4px;
	}
	.dc-chip {
		display: flex;
		align-items: center;
		gap: 4px;
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		padding: 3px 7px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
	}
	.dc-chip.dc-on {
		color: var(--fg-muted);
	}
	.dc-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		border: 1px solid var(--border-strong, var(--border));
	}
	.dc-lit {
		background: var(--accent);
		border-color: var(--accent);
	}
	.dc-pin {
		color: var(--accent);
	}

	.dc-census {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 10px;
		margin: 0;
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
	}
	.dc-census > div {
		display: flex;
		gap: 5px;
		min-width: 84px;
	}
	.dc-census dt {
		color: var(--fg-dim);
	}
	.dc-census dd {
		margin: 0;
		color: var(--fg);
		font-variant-numeric: tabular-nums;
	}
	.dc-warn {
		color: rgb(251, 191, 36);
	}

	.dc-nit {
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 6px 8px;
		background: var(--surface-raised);
	}
	.dc-nit-head {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-bottom: 3px;
	}
	.dc-nit-note {
		margin: 0;
		font-size: 0.68rem;
		line-height: 1.35;
		color: var(--fg);
	}
	.dc-nit-sel {
		flex: 1;
		min-width: 0;
		font-family: var(--mono, monospace);
		font-size: 0.52rem;
		color: var(--fg-dim);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dc-mini {
		border: none;
		background: transparent;
		color: var(--fg-dim);
		font-size: 0.55rem;
		cursor: pointer;
		padding: 0 2px;
		flex: none;
	}
	.dc-mini:hover {
		color: var(--fg);
	}

	.dc-gate {
		margin: 0;
		font-family: var(--mono, monospace);
		font-size: 0.6rem;
		line-height: 1.5;
		color: var(--fg-dim);
	}

	.dc-foot {
		flex: none;
		padding: 7px 14px;
		border-top: 1px solid var(--border);
	}
	.dc-link {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		color: var(--fg-dim);
		text-decoration: none;
	}
	.dc-link:hover {
		color: var(--accent);
	}
</style>
