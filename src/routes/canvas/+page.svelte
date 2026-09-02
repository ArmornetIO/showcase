<script lang="ts">
	import Canvas from '$lib/primitives/canvas/Canvas.svelte';
	import MeshStudio from '$lib/mesh-studio/MeshStudio.svelte';
	import type { StudioNode, StudioEdge } from '$lib/mesh-studio/studio.types.js';
	import CameraControls from '$lib/primitives/canvas/CameraControls.svelte';
	import Minimap from '$lib/primitives/canvas/Minimap.svelte';
	import SelectionBox from '$lib/primitives/canvas/SelectionBox.svelte';
	import PieceCrest from '$lib/mesh-studio/pieces/PieceCrest.svelte';
	import { ALL_PIECES } from '$lib/mesh-studio/pieces/piece-catalogue.js';
	import PieceStudio, { type StudioPiece } from '$lib/mesh-studio/pieces/PieceStudio.svelte';
	import Edge from '$lib/primitives/canvas/Edge.svelte';
	import type { DataType, EdgeStyle } from '$lib/primitives/canvas/canvas.types.js';
	import type { EdgeCurve } from '$lib/primitives/canvas/edge-path.js';
	import MeshCanvas from '$lib/mesh-studio/canvas/MeshCanvas.svelte';
	import MeshViewControls from '$lib/mesh-studio/layout/MeshViewControls.svelte';
	import type { MeshLayoutId } from '$lib/mesh-studio/layout/mesh-layout.js';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';

	// ── MeshCanvas demo topology ──────────────────────────────────────────────
	// Two agents per area plus the crest: enough that a territory has an inside
	// and an outside, which is the only thing clustering can be judged on.
	const MESH_AREAS: Record<string, string> = {
		'dev-1': 'develop',
		'dev-2': 'develop',
		'build-1': 'build',
		'build-2': 'build',
		'run-1': 'runtime',
		'run-2': 'runtime'
	};

	const MESH_TERRITORIES: Record<string, { name: string; color: string }> = {
		develop: { name: 'Development', color: '#34D399' },
		build: { name: 'Build & Registry', color: '#38BDF8' },
		runtime: { name: 'Runtime & Network', color: '#818CF8' }
	};

	const meshNodes: StudioNode[] = [
		{ id: 'hub', type: 'control-plane', state: 'healthy', label: 'Core', x: 0, y: 0, r: 42 },
		...Object.keys(MESH_AREAS).map((id) => ({
			id,
			type: 'proxy' as const,
			state: 'healthy' as const,
			label: id,
			x: 0,
			y: 0,
			r: 22
		}))
	];

	let viewLayout = $state<MeshLayoutId>('grouped');

	// Read off the catalogue rather than listed, so this page is a census: a
	// building that draws wrong, or one somebody added and forgot, shows up here
	// without an edit.
	const pieceKeys = Object.keys(ALL_PIECES).sort();

	// The crest grid is the index; the studio is the review — one subject at the
	// size you choose, turnable. Walks the same list the grid renders, so the
	// arrows cannot step onto a building this page did not show.
	const studioItems: StudioPiece[] = pieceKeys.map((piece) => ({ piece, label: piece }));
	let studioOpen = $state(false);
	let studioIndex = $state(0);

	function review(n: number) {
		studioIndex = n;
		studioOpen = true;
	}

	// ── Edge demo ─────────────────────────────────────────────────────────────
	// Every row is drawn between the SAME two coordinates, so what varies down
	// the column is only the property named beside it.
	const EDGE_A = { x: 30, y: 40 };
	const EDGE_B = { x: 250, y: 40 };

	const curves: EdgeCurve[] = ['line', 'bow', 'bezier', 'elbow'];
	const edgeStyles: (EdgeStyle | undefined)[] = [
		undefined,
		'dashed',
		'degraded',
		'blocked',
		'latent'
	];
	const dataTypes: DataType[] = ['query', 'config', 'feed', 'verdict', 'lifecycle', 'intercept'];

	// Re-armed rather than animated: the reveal is a one-shot transition, so the
	// only way to look at it twice is to put the edges back and let them run.
	let revealed = $state(true);
	function replay() {
		revealed = false;
		requestAnimationFrame(() => requestAnimationFrame(() => (revealed = true)));
	}

	// ── Mesh topology demo — free layout, full mesh nodes ─────────────────────

	let nodes = $state<StudioNode[]>([
		{
			id: 'ctrl', label: 'CTRL·PLANE', value: '4', valueLabel: 'CONNECTED',
			liveSlot: 'uptime 99.9%',
			type: 'control-plane', state: 'healthy',
			r: 64, x: 240, y: 200, flow: 0.9, popDelay: 0.1,
			portFlow: {
				'agents-in':      { active: true,  flowRate: 0.8 },
				'rest-in':        { active: true,  flowRate: 0.4 },
				'config-push':    { active: true,  flowRate: 0.6 },
				'query-dispatch': { active: true,  flowRate: 0.9 },
			},
		},
		{
			id: 'dep-analysis', label: 'DEP·ANALYSIS', value: '12', valueLabel: 'SCANS/HR',
			liveSlot: 'tool: repo-mirror',
			type: 'agentic', state: 'healthy',
			r: 52, x: 80, y: 80, flow: 0.8, popDelay: 0.3,
			portFlow: {
				'query-in':   { active: true,  flowRate: 0.9 },
				'tool-call':  { active: true,  flowRate: 0.7 },
				'answer-out': { active: false, flowRate: 0 },
				'feed-in':    { active: true,  flowRate: 0.5 },
			},
		},
		{
			id: 'intelligence', label: 'INTELLIGENCE', value: '3', valueLabel: 'FEEDS',
			liveSlot: '48ms latency',
			type: 'agentic', state: 'healthy',
			r: 48, x: 420, y: 90, flow: 0.5, popDelay: 0.5,
			portFlow: {
				'query-in':   { active: false, flowRate: 0 },
				'tool-call':  { active: true,  flowRate: 0.3 },
				'answer-out': { active: true,  flowRate: 0.3 },
				'feed-in':    { active: true,  flowRate: 1.0 },
			},
		},
		{
			id: 'supply-chain', label: 'SUPPLY·CHAIN', value: '2', valueLabel: 'BLOCKED',
			liveSlot: '12/min rate',
			type: 'proxy', state: 'healthy',
			r: 52, x: 100, y: 330, flow: 0.8, popDelay: 0.4,
			portFlow: {
				'intercept-in': { active: true, flowRate: 0.8 },
				'allow-out':    { active: true, flowRate: 0.7 },
				'block-out':    { active: true, flowRate: 0.2 },
				'config-in':    { active: true, flowRate: 0.3 },
				'threat-check': { active: true, flowRate: 0.6 },
			},
		},
		{
			id: 'github-runner', label: 'GH·RUNNER', value: '0', valueLabel: 'QUEUED',
			liveSlot: '3m ago',
			type: 'daemon', state: 'healthy',
			r: 46, x: 400, y: 330, flow: 0.2, popDelay: 0.6,
			portFlow: {
				'config-in':     { active: true,  flowRate: 0.2 },
				'heartbeat-out': { active: true,  flowRate: 0.1 },
				'task-out':      { active: false, flowRate: 0 },
			},
		},
		{
			id: 'vendor-mgmt', label: 'VENDOR·MGMT', value: '1', valueLabel: 'PENDING',
			liveSlot: 'degraded',
			type: 'agentic', state: 'degraded',
			r: 48, x: 380, y: 220, flow: 0, popDelay: 0.35,
			portFlow: {},
		},
	]);

	let edges = $state<StudioEdge[]>([
		{ id: 'e1', from: 'ctrl', to: 'dep-analysis',  fromPort: 'query-dispatch', toPort: 'query-in',  dataType: 'query',  style: 'energy', active: true },
		{ id: 'e2', from: 'ctrl', to: 'intelligence',  fromPort: 'query-dispatch', toPort: 'query-in',  dataType: 'query' },
		{ id: 'e3', from: 'ctrl', to: 'supply-chain',  fromPort: 'config-push',    toPort: 'config-in', dataType: 'config', style: 'energy', active: true },
		{ id: 'e4', from: 'ctrl', to: 'github-runner', fromPort: 'config-push',    toPort: 'config-in', dataType: 'config' },
		{ id: 'e5', from: 'ctrl', to: 'vendor-mgmt',   fromPort: 'query-dispatch', toPort: 'query-in',  dataType: 'query',  style: 'degraded', edgeState: 'degraded' },
		{ id: 'e6', from: 'intelligence', to: 'dep-analysis', fromPort: 'answer-out', toPort: 'feed-in', dataType: 'feed', style: 'energy', active: true, particleCount: 2 },
	]);

	let meshSelected = $state<string | null>(null);
</script>

<svelte:head>
	<title>Canvas — Armornet UI</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">

	<!-- ── Mesh topology ─────────────────────────────────────────────────────── -->
	<ShowcaseBlock component="Canvas MeshStudio">
		<h3 class="component-name">Canvas · mesh topology</h3>
		<p class="component-desc">
			Unified pan/zoom SVG canvas. <code class="demo-code">Canvas</code> owns the camera;
			<code class="demo-code">MeshStudio</code> is the mesh layer inside it. Nodes render with a
			<strong>segmented ring</strong> (one arc per port, colored by data type),
			<strong>port activity indicators</strong> on the silhouette, an <strong>energy trace</strong>
			driven by <code class="demo-code">flow</code>, and a <strong>live-state slot</strong> at the
			center. Edges with <code class="demo-code">active: true</code> emit <strong>particle
			streams</strong>. Drag a node to move it; click a lit port then a target node to draw a link.
		</p>

		<div class="canvas-demo free">
			<Canvas fitOnLoad onSelectionChange={(ids) => (meshSelected = ids.join(', ') || null)}>
				<MeshStudio
					concept="instrument"
					bind:nodes
					bind:edges
					onSelect={(id) => (meshSelected = id)}
				/>
				<SelectionBox />
				<Minimap />
				<CameraControls />
			</Canvas>
		</div>
		{#if meshSelected}
			<p class="component-desc sub">Selected: <code class="demo-code">{meshSelected}</code></p>
		{/if}
	</ShowcaseBlock>

	<!-- ── Piece crests ──────────────────────────────────────────────────────── -->
	<ShowcaseBlock component="PieceCrest PieceStudio">
		<h3 class="component-name">Piece crest · the catalogue as icons</h3>
		<p class="component-desc">
			<code class="demo-code">NodePiece</code> draws a building through a node's local frame, so it
			needs a globe to stand on. <code class="demo-code">PieceCrest</code> is the same solid with
			nowhere to stand — a fixed head-on frame, tipped forward a few degrees — so a piece can be
			used as an <strong>icon</strong> in a roster, a log row or a legend and still be the object
			the canvas draws out there rather than a flat glyph chosen to stand for it. That is the whole
			value: the thing in the list and the thing on the map cannot drift apart, because they are
			one drawing.
		</p>

		<div class="crest-grid">
			{#each pieceKeys as key, n (key)}
				<button class="crest" onclick={() => review(n)} title="Open {key} on the turntable">
					<PieceCrest piece={key} color="var(--accent)" size={54} />
					<span>{key}</span>
				</button>
			{/each}
		</div>

		<p class="component-desc sub">
			<code class="demo-code">PieceStudio</code> is the review the crest grid is the index for:
			click any building above to put it on the turntable at a size you choose. Two solids that
			converge under a squint are the same building however different their geometry is on paper,
			and that is only visible one at a time and large.
		</p>

		<p class="component-desc sub">
			<code class="demo-code">offline</code> dims and dashes it — an unbuilt capability should read
			as unbuilt, not merely unlit.
		</p>
		<div class="crest-grid">
			{#each pieceKeys.slice(0, 6) as key (key)}
				<figure class="crest">
					<PieceCrest piece={key} color="var(--accent)" size={54} offline />
					<figcaption>{key}</figcaption>
				</figure>
			{/each}
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="MeshCanvas TerritoryCaps GlobePieces">
		<h3 class="component-name">MeshCanvas</h3>
		<p class="component-desc">
			The shell above <code class="demo-code">MeshStudio</code>: a caller hands it LOGICAL nodes and
			one <code class="demo-code">hubId</code>, and it owns everything visual — solving the layout,
			spinning and projecting the globe, and preserving positions the operator dragged. The demo
			above places nodes by hand; this one never touches x/y.
		</p>
		<p class="component-desc sub">
			<code class="demo-code">globeTerritories</code> turns on
			<code class="demo-code">TerritoryCaps</code> — the named regions clustered on the sphere —
			and <code class="demo-code">glPieces</code> swaps the node bodies for
			<code class="demo-code">GlobePieces</code>. Both read the canvas context, so neither can
			render outside a canvas host, which is why they are demoed through it rather than beside it.
		</p>
		<div class="canvas-demo canvas-demo--globe">
			<MeshCanvas
				nodes={meshNodes}
				hubId="hub"
				layout="globe"
				groupKeyOf={(n) => MESH_AREAS[n.id] ?? 'runtime'}
				territoryOf={(k) => MESH_TERRITORIES[k] ?? null}
				globeTerritories
				glPieces
				globeControls
				layoutPicker
				globeLabel="Mesh"
				autoRotate
			/>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="MeshViewControls">
		<h3 class="component-name">MeshViewControls</h3>
		<p class="component-desc">
			The collapsed form of the arrangement picker: one button carrying the active filter count,
			which opens to the five layouts. Closed by default because on a canvas the controls are not
			the subject — the badge is what has to survive being ignored.
		</p>
		<div class="controls-row">
			<MeshViewControls bind:layout={viewLayout} count={3} />
			<MeshViewControls layout="globe" count={0} />
			<span class="controls-hint">layout: {viewLayout}</span>
		</div>
	</ShowcaseBlock>

	<!-- ── Edge ──────────────────────────────────────────────────────────────── -->
	<ShowcaseBlock component="Edge">
		<h3 class="component-name">Edge · one Line, drawn the way the mesh draws them</h3>
		<p class="component-desc">
			The mesh's connector as something you can point at two coordinates — the same dash table and
			the same <code class="demo-code">DATA_TYPE_COLOR</code> table
			<code class="demo-code">MeshStudio</code> paints from, available to a rail, a diagram or a spur
			between two cards. It renders <strong>SVG children, not its own
			<code class="demo-code">&lt;svg&gt;</code></strong>: edges compose into one canvas, so the
			caller supplies the element and its viewBox.
		</p>

		<div class="edge-grid">
			{#each curves as curve (curve)}
				<figure class="edge-cell">
					<svg viewBox="0 0 280 80" role="presentation">
						<Edge from={EDGE_A} to={EDGE_B} {curve} {revealed} cap dataType="query" />
					</svg>
					<figcaption>curve="{curve}"</figcaption>
				</figure>
			{/each}
		</div>

		<p class="component-desc sub">
			<code class="demo-code">style</code> sets the dash rhythm, and the rhythm carries the meaning:
			a long mark with a short gap reads as moving, a short mark with a long gap as intermittent or
			severed. A solid edge <strong>wipes</strong> in; a dashed one cannot — the reveal and the
			pattern are the same property — so it fades instead.
		</p>
		<div class="edge-grid">
			{#each edgeStyles as style (style ?? 'solid')}
				<figure class="edge-cell">
					<svg viewBox="0 0 280 80" role="presentation">
						<Edge from={EDGE_A} to={EDGE_B} curve="line" {style} {revealed} width={1.5} />
					</svg>
					<figcaption>style="{style ?? 'solid'}"</figcaption>
				</figure>
			{/each}
		</div>

		<p class="component-desc sub">
			<code class="demo-code">dataType</code> picks the colour off the shared table — what travels
			on the line, not which line it is. <code class="demo-code">flow</code> runs a travelling orb
			along it; <code class="demo-code">'both'</code> launches a second one the other way at the
			same instant, because two pulses crossing mid-run is what reads as duplex.
		</p>
		<div class="edge-grid">
			{#each dataTypes as dataType (dataType)}
				<figure class="edge-cell">
					<svg viewBox="0 0 280 80" role="presentation">
						<Edge from={EDGE_A} to={EDGE_B} {dataType} {revealed} flow cap />
					</svg>
					<figcaption>dataType="{dataType}"</figcaption>
				</figure>
			{/each}
			<figure class="edge-cell">
				<svg viewBox="0 0 280 80" role="presentation">
					<Edge from={EDGE_A} to={EDGE_B} dataType="verdict" {revealed} flow="both" cap />
				</svg>
				<figcaption>flow="both"</figcaption>
			</figure>
			<figure class="edge-cell">
				<svg viewBox="0 0 280 80" role="presentation">
					<Edge from={EDGE_A} to={EDGE_B} curve="elbow" {revealed} sharp cap width={1.5} />
				</svg>
				<figcaption>sharp — butt caps, diamond junction</figcaption>
			</figure>
		</div>

		<div class="controls-row">
			<button class="replay" onclick={replay}>Replay reveal</button>
			<span class="controls-hint">
				Staggering a bundle with <code class="demo-code">delay</code> is what makes it read as
				wiring rather than an appearing picture.
			</span>
		</div>
	</ShowcaseBlock>

</div>

<PieceStudio
	open={studioOpen}
	items={studioItems}
	bind:index={studioIndex}
	onclose={() => (studioOpen = false)}
/>

<style>
	.canvas-demo {
		width: 100%;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		margin-top: 12px;
	}
	.canvas-demo.free { height: 480px; }

	/* The crests are drawn with `overflow: visible`, so each cell needs slack
	   around it — a tight grid clips the roofs of the taller solids. */
	.crest-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 18px;
		margin-top: 12px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.crest {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		width: 78px;
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.crest:hover span {
		color: var(--accent);
	}
	.crest span,
	.crest figcaption {
		font-family: var(--font-mono, monospace);
		font-size: 0.6rem;
		color: var(--fg-dim);
	}

	/* A cell per edge, each with its own viewBox: the component draws SVG
	   children, so a shared canvas would mean hand-placing every run. */
	.edge-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 8px;
		margin-top: 12px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.edge-cell {
		margin: 0;
	}
	.edge-cell svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.edge-cell figcaption {
		font-family: var(--mono, monospace);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}
	.replay {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.3rem 0.7rem;
		background: none;
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.7rem;
		cursor: pointer;
	}
	.replay:hover {
		color: var(--accent);
		border-color: var(--accent);
	}
	.canvas-demo--globe {
		height: 560px;
	}
	.controls-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.controls-hint {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--fg-dim);
		align-self: center;
	}
</style>
