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
	import ErdLintPanel from './ErdLintPanel.svelte';
	import { autoLayout, type DetailLevel } from './erd-layout.js';
	import { lintErd, LINT_RULES, type LintOptions } from './erd-lint.js';
	import type { ErdTable, ErdForeignKey, ErdGroup } from './types.js';

	let {
		tables = [],
		foreignKeys = [],
		groups = {},
		lintOptions
	}: {
		tables?: ErdTable[];
		foreignKeys?: ErdForeignKey[];
		groups?: Record<string, ErdGroup>;
		/** Host jargon for the linter — abbreviations it treats as one word,
		 *  role-qualified name stems. Defaults suit most schemas. */
		lintOptions?: LintOptions;
	} = $props();

	// ── View state ─────────────────────────────────────────────────────────────
	let level = $state<DetailLevel>('all');
	let positions = $state<Record<string, { x: number; y: number }>>({});
	let collapsedTables = $state<Record<string, boolean>>({});
	let selected = $state<string | null>(null);
	let selectedEdge = $state<string | null>(null);
	let focusMode = $state(true);
	let lintMode = $state(false);
	let camera = $state<CanvasCamera>();
	let list = $state<ReturnType<typeof ErdTableList>>();

	// ── Lint ───────────────────────────────────────────────────────────────────
	// Pure over the data already in hand, so it costs one pass and needs no
	// fetch — which is what lets a decoded capture be linted the same as a live
	// schema. The count is always computed; only the overlay is toggled.
	const lint = $derived(lintErd({ tables, foreignKeys, groups }, lintOptions));

	// Keyed by `table` and `table.column`; first (highest-severity) finding wins,
	// since findings arrive severity-sorted and a card can only carry one dot.
	const lintMarks = $derived.by(() => {
		const m = new Map<string, string>();
		if (!lintMode) return m;
		for (const f of lint.findings) {
			if (!f.table) continue;
			const color = LINT_RULES[f.rule].color;
			if (!m.has(f.table)) m.set(f.table, color);
			if (f.column) {
				const key = `${f.table}.${f.column}`;
				if (!m.has(key)) m.set(key, color);
			}
		}
		return m;
	});

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
		else if (e.key === 'l') lintMode = !lintMode;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="erd-view">
	<ErdTableList bind:this={list} {tables} {groups} {selected} onjump={jumpTo} />

	<div class="erd-stage" class:inspecting={!!selTable} class:linting={lintMode}>
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
				marks={lintMarks}
			/>
			<Minimap />
			<CameraControls />
		</Canvas>

		<ErdToolbar
			tableCount={tables.length}
			fkCount={foreignKeys.length}
			bind:level
			bind:focusMode
			bind:lintMode
			lintCount={lint.total}
			onarrange={rearrange}
		/>

		{#if lintMode}
			<ErdLintPanel
				report={lint}
				{selected}
				onjump={jumpTo}
				onclose={() => (lintMode = false)}
			/>
		{:else if selTable && selGroup}
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
		/* Without this the canvas is invisible in any shrink-to-fit parent — an
		   inline-flex demo wrapper sizes to the table list, and the stage's
		   `flex: 1` then resolves against zero free space. */
		width: 100%;
	}
	.erd-stage {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	/* Slide the minimap clear of whichever drawer is open. The lint panel is the
	   wider of the two, so the two offsets are not interchangeable. */
	.erd-stage.inspecting :global(.cv-minimap) {
		right: 346px;
	}
	.erd-stage.linting :global(.cv-minimap) {
		right: 370px;
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
