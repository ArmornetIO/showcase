<script lang="ts">
	import Canvas from '$lib/primitives/Canvas.svelte';
	import MeshStudio from '$lib/mesh-studio/MeshStudio.svelte';
	import type { StudioNode, StudioEdge } from '$lib/mesh-studio/studio.types.js';
	import CameraControls from '$lib/primitives/CameraControls.svelte';
	import Minimap from '$lib/primitives/Minimap.svelte';
	import SelectionBox from '$lib/primitives/SelectionBox.svelte';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';

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

</div>

<style>
	.canvas-demo {
		width: 100%;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		margin-top: 12px;
	}
	.canvas-demo.free { height: 480px; }
</style>
