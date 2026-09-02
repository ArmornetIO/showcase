<script lang="ts">
	// ── ErdDiagram — composition of the Model Explorer diagram view ────────────
	// Prop-driven: the host passes tables/foreignKeys/groups (baked demo data in
	// showcase, live-fetched data in app-ui). Composes the decoupled pieces —
	// ErdTableList · Canvas(ErdLayer) · ErdToolbar · ErdInspector — and owns only
	// view state (layout positions, selection, detail level, camera).
	import Canvas from '../primitives/canvas/Canvas.svelte';
	import Minimap from '../primitives/canvas/Minimap.svelte';
	import CameraControls from '../primitives/canvas/CameraControls.svelte';
	import type { CanvasCamera } from '../primitives/canvas/canvas-camera.js';
	import ErdLayer from './ErdLayer.svelte';
	import ErdTableList from './ErdTableList.svelte';
	import ErdToolbar from './ErdToolbar.svelte';
	import ErdInspector from './ErdInspector.svelte';
	import { autoLayout, type DetailLevel } from './erd-layout.js';
	import type { ErdTable, ErdForeignKey, ErdGroup } from './types.js';

	let {
		tables = [],
		foreignKeys = [],
		groups = {}
	}: {
		tables?: ErdTable[];
		foreignKeys?: ErdForeignKey[];
		groups?: Record<string, ErdGroup>;
	} = $props();

	// ── View state ─────────────────────────────────────────────────────────────
	let level = $state<DetailLevel>('all');
	let positions = $state<Record<string, { x: number; y: number }>>({});
	let collapsedTables = $state<Record<string, boolean>>({});
	let selected = $state<string | null>(null);
	let selectedEdge = $state<string | null>(null);
	let focusMode = $state(true);
	let camera = $state<CanvasCamera>();
	let list = $state<ReturnType<typeof ErdTableList>>();

	// Re-seed the layout whenever the table set changes (first load, live refetch).
	let seededFor = '';
	$effect(() => {
		const key = tables.map((t) => t.name).join(',');
		if (key !== seededFor) {
			seededFor = key;
			positions = autoLayout(tables, level).positions;
		}
	});

	function rearrange() {
		positions = autoLayout(tables, level).positions;
		setTimeout(() => camera?.fitAll({ duration: 500 }), 0);
	}

	function jumpTo(name: string) {
		selected = name;
		selectedEdge = null;
		const tk = camera?.transform.scale ?? 1;
		camera?.flyTo(name, { duration: 450, zoom: tk < 0.75 ? 0.85 : tk });
	}

	// ── Inspector data ───────────────────────────────────────────────────────────
	const selTable = $derived(selected ? tables.find((t) => t.name === selected) : null);
	const selGroup = $derived(selTable ? groups[selTable.group] : undefined);
	const selRefsOut = $derived(selected ? foreignKeys.filter((f) => f.fromTable === selected) : []);
	const selRefsIn = $derived(
		selected ? foreignKeys.filter((f) => f.toTable === selected && f.fromTable !== selected) : []
	);

	// ── Keyboard — the shortcuts the sidebar footer advertises ────────────────────
	function onKeydown(e: KeyboardEvent) {
		const el = e.target as HTMLElement | null;
		const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA';
		if (typing) return; // the search input owns its own keys
		if (e.key === 'Escape') {
			selected = null;
			selectedEdge = null;
		} else if (e.key === '/') {
			e.preventDefault();
			list?.focusSearch();
		} else if (e.key === 'f') camera?.fitAll({ duration: 450 });
		else if (e.key === '1') level = 'all';
		else if (e.key === '2') level = 'keys';
		else if (e.key === '3') level = 'collapsed';
		else if (e.key === 'd') focusMode = !focusMode;
		else if (e.key === 'a') rearrange();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="erd-view">
	<ErdTableList bind:this={list} {tables} {groups} {selected} onjump={jumpTo} />

	<div class="erd-stage" class:inspecting={!!selTable}>
		<Canvas fitOnLoad bind:camera minZoom={0.05}>
			<ErdLayer
				{tables}
				fks={foreignKeys}
				{groups}
				bind:positions
				bind:collapsedTables
				bind:selected
				bind:selectedEdge
				{level}
				{focusMode}
			/>
			<Minimap />
			<CameraControls />
		</Canvas>

		<ErdToolbar
			tableCount={tables.length}
			fkCount={foreignKeys.length}
			bind:level
			bind:focusMode
			onarrange={rearrange}
		/>

		{#if selTable && selGroup}
			<ErdInspector
				table={selTable}
				group={selGroup}
				refsOut={selRefsOut}
				refsIn={selRefsIn}
				onjump={jumpTo}
				onclose={() => (selected = null)}
			/>
		{/if}

		{#if tables.length === 0}
			<div class="erd-empty-state">No schema to display.</div>
		{/if}
	</div>
</div>

<style>
	.erd-view {
		display: flex;
		height: 100%;
		min-height: 0;
	}
	.erd-stage {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	/* Slide the minimap clear of the inspector drawer. */
	.erd-stage.inspecting :global(.cv-minimap) {
		right: 346px;
	}
	.erd-empty-state {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--fg-muted);
	}
</style>
