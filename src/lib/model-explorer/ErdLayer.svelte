<script lang="ts">
	// ── ErdLayer — entity-relationship diagram layer for the shared <Canvas> ──
	// A sibling of MeshStudio on the same camera: Canvas owns pan/zoom and
	// publishes the transform; this layer draws table cards, subject-area
	// regions and FK edges in world coordinates. Registers per-table positions
	// (→ Minimap dots, camera.flyTo(tableName)) and bounds (→ fitAll).
	//
	// dbdiagram-grade behaviors, plus the gaps its users ask for:
	//   · edges anchor to the exact column row, exit the facing card edge
	//   · 1/∗ endpoint markers; one-to-one detected from PK/unique FKs
	//   · PERSISTENT selection that survives pan/zoom, with dim-unrelated focus
	//   · detail ladder (all / keys / collapsed) + per-table collapse (dblclick)
	//   · hover a table → its edges + neighbors light; hover an FK row → that
	//     edge raises; endpoint rows glow on both cards
	import { getContext } from 'svelte';
	import { CANVAS_CTX } from '../primitives/canvas/canvas-camera.js';
	import type { CanvasContextValue } from '../primitives/canvas/canvas-camera.js';
	import type { ErdTable, ErdForeignKey, ErdGroup } from './types.js';
	import {
		HEADER_H, ROW_H,
		type DetailLevel,
		visibleColumns, tableWidth, tableHeight, anchorY, fkCardinality, routeEdge, groupBounds,
	} from './erd-layout.js';

	let {
		tables,
		fks,
		groups,
		positions = $bindable(),
		level = 'all',
		collapsedTables = $bindable({}),
		selected = $bindable(null),
		selectedEdge = $bindable(null),
		focusMode = true,
	}: {
		tables: ErdTable[];
		fks: ErdForeignKey[];
		groups: Record<string, ErdGroup>;
		positions: Record<string, { x: number; y: number }>;
		level?: DetailLevel;
		collapsedTables?: Record<string, boolean>;
		selected?: string | null;
		selectedEdge?: string | null;
		focusMode?: boolean;
	} = $props();

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const { transform } = ctx;

	let svgEl = $state<SVGSVGElement | undefined>();

	// ── Derived geometry ───────────────────────────────────────────────────────
	const tableByName = $derived(new Map(tables.map((t) => [t.name, t])));
	const widths = $derived(new Map(tables.map((t) => [t.name, tableWidth(t)])));

	function effLevel(name: string): DetailLevel {
		return collapsedTables[name] ? 'collapsed' : level;
	}

	const placed = $derived.by(() => {
		const m = new Map<string, { x: number; y: number; w: number; h: number }>();
		for (const t of tables) {
			const p = positions[t.name];
			if (!p) continue;
			m.set(t.name, { x: p.x, y: p.y, w: widths.get(t.name)!, h: tableHeight(t, effLevel(t.name)) });
		}
		return m;
	});

	interface EdgeGeom {
		fk: ErdForeignKey;
		d: string;
		fromLabel: { x: number; y: number; text: string };
		toLabel: { x: number; y: number; text: string };
		mid: { x: number; y: number };
		color: string;
	}
	const edgeGeoms = $derived.by((): EdgeGeom[] => {
		const out: EdgeGeom[] = [];
		for (const fk of fks) {
			const from = placed.get(fk.fromTable);
			const to = placed.get(fk.toTable);
			const ft = tableByName.get(fk.fromTable);
			const tt = tableByName.get(fk.toTable);
			if (!from || !to || !ft || !tt) continue;
			const fromY = anchorY(ft, from.y, fk.fromColumns[0], effLevel(ft.name));
			const toY = anchorY(tt, to.y, fk.toColumns[0], effLevel(tt.name));
			const path = routeEdge(from, fromY, to, toY, fkCardinality(fk, ft), fk.fromTable === fk.toTable);
			out.push({ fk, ...path, color: groups[tt.group]?.color ?? 'var(--fg-muted)' });
		}
		return out;
	});

	// Adjacency: table → connected tables / edge ids.
	const neighbors = $derived.by(() => {
		const m = new Map<string, Set<string>>();
		const add = (a: string, b: string) => {
			if (!m.has(a)) m.set(a, new Set());
			m.get(a)!.add(b);
		};
		for (const fk of fks) {
			add(fk.fromTable, fk.toTable);
			add(fk.toTable, fk.fromTable);
		}
		return m;
	});
	const tableEdges = $derived.by(() => {
		const m = new Map<string, Set<string>>();
		for (const fk of fks) {
			for (const t of [fk.fromTable, fk.toTable]) {
				if (!m.has(t)) m.set(t, new Set());
				m.get(t)!.add(fk.id);
			}
		}
		return m;
	});

	// ── Interaction state ──────────────────────────────────────────────────────
	let hoveredTable = $state<string | null>(null);
	let hoveredEdge = $state<string | null>(null);
	let hoveredCol = $state<{ table: string; col: string } | null>(null);

	// FK edge under a hovered column row, if any.
	const hoveredColEdge = $derived.by(() => {
		if (!hoveredCol) return null;
		const hit = fks.find(
			(fk) =>
				(fk.fromTable === hoveredCol!.table && fk.fromColumns.includes(hoveredCol!.col)) ||
				(fk.toTable === hoveredCol!.table && fk.toColumns.includes(hoveredCol!.col)),
		);
		return hit?.id ?? null;
	});

	// Edges lit right now: selected edge > hovered column's edge > hovered/selected table's edges.
	const activeEdges = $derived.by(() => {
		const s = new Set<string>();
		if (selectedEdge) s.add(selectedEdge);
		if (hoveredColEdge) s.add(hoveredColEdge);
		if (hoveredEdge) s.add(hoveredEdge);
		if (hoveredTable) for (const id of tableEdges.get(hoveredTable) ?? []) s.add(id);
		if (selected) for (const id of tableEdges.get(selected) ?? []) s.add(id);
		return s;
	});

	// Column rows glowing because an active edge terminates on them.
	const activeCols = $derived.by(() => {
		const m = new Map<string, Set<string>>();
		const add = (t: string, c: string) => {
			if (!m.has(t)) m.set(t, new Set());
			m.get(t)!.add(c);
		};
		for (const fk of fks) {
			if (!activeEdges.has(fk.id)) continue;
			for (const c of fk.fromColumns) add(fk.fromTable, c);
			for (const c of fk.toColumns) add(fk.toTable, c);
		}
		return m;
	});

	// Persistent focus: selection dims everything unrelated (the dbdiagram gap).
	const focusActive = $derived(focusMode && (selected !== null || selectedEdge !== null));
	const focusSet = $derived.by(() => {
		const s = new Set<string>();
		if (selected) {
			s.add(selected);
			for (const n of neighbors.get(selected) ?? []) s.add(n);
		}
		if (selectedEdge) {
			const fk = fks.find((f) => f.id === selectedEdge);
			if (fk) {
				s.add(fk.fromTable);
				s.add(fk.toTable);
			}
		}
		return s;
	});

	function tableOpacity(name: string): number {
		if (!focusActive) return 1;
		return focusSet.has(name) ? 1 : 0.13;
	}
	function edgeTier(id: string, fk: ErdForeignKey): 'active' | 'base' | 'dim' {
		if (activeEdges.has(id)) return 'active';
		if (focusActive && !(focusSet.has(fk.fromTable) && focusSet.has(fk.toTable))) return 'dim';
		return 'base';
	}

	const baseGeoms = $derived(edgeGeoms.filter((g) => !activeEdges.has(g.fk.id)));
	const raisedGeoms = $derived(edgeGeoms.filter((g) => activeEdges.has(g.fk.id)));

	// ── Camera / minimap registration ──────────────────────────────────────────
	// Registered at init, NOT in an $effect: the context maps are plain (non-
	// reactive) Maps, so a sibling Minimap mounted after us must find the getters
	// already present — an effect would run after its deriveds settle.
	const boundsId = Symbol();
	for (const t of tables)
		ctx.nodePositions.set(t.name, () => {
			const p = placed.get(t.name);
			return p ? { x: p.x + p.w / 2, y: p.y + p.h / 2 } : null;
		});
	ctx.boundsRegistry.set(boundsId, () => {
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		let any = false;
		for (const p of placed.values()) {
			any = true;
			minX = Math.min(minX, p.x - 30);
			minY = Math.min(minY, p.y - 40);
			maxX = Math.max(maxX, p.x + p.w + 30);
			maxY = Math.max(maxY, p.y + p.h + 30);
		}
		return any ? { minX, minY, maxX, maxY } : null;
	});
	$effect(() => {
		const ids = tables.map((t) => t.name);
		return () => {
			ctx.boundsRegistry.delete(boundsId);
			for (const id of ids) ctx.nodePositions.delete(id);
		};
	});

	// ── Drag ───────────────────────────────────────────────────────────────────
	let drag = $state<{ name: string; ox: number; oy: number; sx: number; sy: number; moved: boolean } | null>(null);

	function toWorld(clientX: number, clientY: number) {
		const rect = svgEl!.getBoundingClientRect();
		return {
			x: (clientX - rect.left - transform.tx) / transform.tk,
			y: (clientY - rect.top - transform.ty) / transform.tk,
		};
	}

	function onCardPointerDown(e: PointerEvent, name: string) {
		if (e.button !== 0) return;
		const w = toWorld(e.clientX, e.clientY);
		const p = positions[name];
		drag = { name, ox: w.x - p.x, oy: w.y - p.y, sx: e.clientX, sy: e.clientY, moved: false };
		svgEl?.setPointerCapture(e.pointerId);
		e.stopPropagation();
	}
	function onPointerMove(e: PointerEvent) {
		if (!drag) return;
		if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
		drag.moved = true;
		const w = toWorld(e.clientX, e.clientY);
		positions[drag.name] = { x: w.x - drag.ox, y: w.y - drag.oy };
	}
	function onPointerUp() {
		if (!drag) return;
		if (!drag.moved) {
			// A click, not a drag → persistent selection.
			selected = selected === drag.name ? null : drag.name;
			selectedEdge = null;
		}
		drag = null;
	}

	function onEdgeClick(e: MouseEvent, id: string) {
		e.stopPropagation();
		selectedEdge = selectedEdge === id ? null : id;
		selected = null;
	}

	// Background click (not a pan) → deselect.
	let bgDown: { x: number; y: number } | null = null;
	function onBgPointerDown(e: PointerEvent) {
		if (e.target === svgEl || (e.target as Element).closest('[data-erd-bg]')) bgDown = { x: e.clientX, y: e.clientY };
	}
	function onBgClick(e: MouseEvent) {
		if (!bgDown) return;
		const moved = Math.hypot(e.clientX - bgDown.x, e.clientY - bgDown.y) >= 3;
		bgDown = null;
		if (moved) return;
		if (e.target === svgEl || (e.target as Element).closest('[data-erd-bg]')) {
			selected = null;
			selectedEdge = null;
		}
	}

	function toggleCollapse(name: string) {
		collapsedTables[name] = !collapsedTables[name];
	}

	function fmtRows(n: number): string {
		if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
		return `${n}`;
	}

	const groupList = $derived(
		Object.entries(groups)
			.map(([id, g]) => ({ id, ...g, bounds: groupBounds(tables.filter((t) => t.group === id), positions, level) }))
			.filter((g) => g.bounds !== null),
	);

	const selectedFk = $derived(selectedEdge ? fks.find((f) => f.id === selectedEdge) : null);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
<svg
	class="erd-svg"
	bind:this={svgEl}
	onpointerdown={onBgPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onclick={onBgClick}
	role="application"
	aria-label="Entity relationship diagram — {tables.length} tables"
>
	<defs>
		<pattern
			id="erd-grid" width="28" height="28" patternUnits="userSpaceOnUse"
			patternTransform="translate({transform.tx},{transform.ty}) scale({transform.tk})"
		>
			<circle cx="1" cy="1" r="1" fill="var(--border)" opacity="0.55" />
		</pattern>
		<filter id="erd-edge-glow" x="-30%" y="-30%" width="160%" height="160%">
			<feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
		</filter>
	</defs>

	<rect data-erd-bg width="100%" height="100%" fill="url(#erd-grid)" />

	<g transform="translate({transform.tx},{transform.ty}) scale({transform.tk})">
		<!-- ── Subject-area regions ─────────────────────────────────────────── -->
		{#each groupList as g (g.id)}
			{@const b = g.bounds!}
			{@const dimmed = focusActive}
			<g opacity={dimmed ? 0.25 : 1} pointer-events="none">
				<rect x={b.x} y={b.y} width={b.w} height={b.h} rx="14" fill={g.color} opacity="0.045" />
				<rect x={b.x} y={b.y} width={b.w} height={b.h} rx="14" fill="none" stroke={g.color} stroke-opacity="0.22" stroke-dasharray="3 5" />
				<text x={b.x + 14} y={b.y - 9} class="erd-group-label" fill={g.color}>{g.label.toUpperCase()}</text>
				<text x={b.x + 14 + g.label.length * 7.1 + 10} y={b.y - 9} class="erd-group-count">· {tables.filter((t) => t.group === g.id).length}</text>
			</g>
		{/each}

		<!-- ── Edges (base pass, then raised on top of nothing yet — cards come after,
		     raised pass re-renders after cards so it paints above them) ──────── -->
		{#each baseGeoms as g (g.fk.id)}
			{@const tier = edgeTier(g.fk.id, g.fk)}
			<g class="erd-edge" opacity={tier === 'dim' ? 0.06 : 0.4}>
				<path d={g.d} fill="none" stroke={g.color} stroke-width="1.1" />
				<!-- fat invisible hit path -->
				<path
					d={g.d} fill="none" stroke="transparent" stroke-width="11" pointer-events="stroke"
					style="cursor: pointer"
					onpointerenter={() => (hoveredEdge = g.fk.id)}
					onpointerleave={() => (hoveredEdge = null)}
					onclick={(e) => onEdgeClick(e, g.fk.id)}
					role="button" tabindex="-1" aria-label="{g.fk.fromTable} → {g.fk.toTable}"
					onkeydown={undefined}
				/>
			</g>
		{/each}

		<!-- ── Table cards ──────────────────────────────────────────────────── -->
		{#each tables as t (t.name)}
			{@const p = placed.get(t.name)}
			{#if p}
				{@const eff = effLevel(t.name)}
				{@const cols = visibleColumns(t, eff)}
				{@const g = groups[t.group]}
				{@const isSel = selected === t.name}
				{@const lit = activeCols.get(t.name)}
				<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
				<g
					class="erd-card"
					data-canvas-node
					transform="translate({p.x},{p.y})"
					opacity={tableOpacity(t.name)}
					onpointerdown={(e) => onCardPointerDown(e, t.name)}
					onpointerenter={() => (hoveredTable = t.name)}
					onpointerleave={() => { hoveredTable = null; hoveredCol = null; }}
				>
					<!-- body -->
					<rect
						width={p.w} height={p.h} rx="8"
						fill="var(--bg-elev)"
						stroke={isSel ? 'var(--accent)' : g?.color ?? 'var(--border)'}
						stroke-opacity={isSel ? 1 : hoveredTable === t.name ? 0.9 : 0.45}
						stroke-width={isSel ? 1.6 : 1}
					/>
					{#if isSel}
						<rect width={p.w} height={p.h} rx="8" fill="none" stroke="var(--accent)" stroke-opacity="0.25" stroke-width="5" />
					{/if}
					<!-- header -->
					<g style="cursor: grab" ondblclick={() => toggleCollapse(t.name)}>
						<path
							d="M 8 0 H {p.w - 8} Q {p.w} 0 {p.w} 8 V {HEADER_H} H 0 V 8 Q 0 0 8 0 Z"
							fill={g?.color ?? 'var(--fg-muted)'} opacity="0.16"
						/>
						<rect x="0" y="0" width={p.w} height="2.5" rx="1.25" fill={g?.color} opacity="0.85" />
						<text x="10" y="20" class="erd-tname">{t.name}</text>
						<text x={p.w - 10} y="20" text-anchor="end" class="erd-rows">
							{eff === 'collapsed' ? `${t.columns.length} cols` : t.approxRows > 0 ? fmtRows(t.approxRows) : ''}
						</text>
					</g>
					<!-- column rows -->
					{#each cols as c, i (c.name)}
						{@const rowY = HEADER_H + i * ROW_H}
						{@const isLit = lit?.has(c.name) ?? false}
						{@const isFkCol = !!c.fk}
						<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
						<g
							onpointerenter={() => (hoveredCol = { table: t.name, col: c.name })}
							onpointerleave={() => (hoveredCol = null)}
							style={isFkCol ? 'cursor: pointer' : undefined}
							onclick={isFkCol ? (e) => { const fk = fks.find((f) => (f.fromTable === t.name && f.fromColumns.includes(c.name)) || (f.toTable === t.name && f.toColumns.includes(c.name))); if (fk) onEdgeClick(e, fk.id); } : undefined}
						>
							<rect x="1" y={rowY} width={p.w - 2} height={ROW_H} fill={isLit ? g?.color ?? 'var(--accent)' : 'transparent'} opacity={isLit ? 0.14 : 1} />
							{#if c.pk}
								<text x="10" y={rowY + 14.5} class="erd-key">⚷</text>
							{/if}
							<text x={c.pk ? 22 : 10} y={rowY + 14.5} class="erd-col" class:erd-col--pk={c.pk} class:erd-col--fk={isFkCol}>
								{c.name}
							</text>
							<text x={p.w - 10} y={rowY + 14.5} text-anchor="end" class="erd-type">
								{c.type}{c.nullable ? '?' : ''}{#if c.unique && !c.pk}<tspan class="erd-uq">&nbsp;U</tspan>{/if}
							</text>
						</g>
					{/each}
					{#if eff === 'keys' && cols.length < t.columns.length}
						<text x="10" y={p.h + 12} class="erd-more">+{t.columns.length - cols.length} more…</text>
					{/if}
				</g>
			{/if}
		{/each}

		<!-- ── Raised edges — repainted above the cards ─────────────────────── -->
		{#each raisedGeoms as g (g.fk.id)}
			<g class="erd-edge">
				<path d={g.d} fill="none" stroke={g.color} stroke-width="1.9" filter="url(#erd-edge-glow)" />
				<circle cx={g.fromLabel.x} cy={g.fromLabel.y + 5} r="0" />
				<text x={g.fromLabel.x} y={g.fromLabel.y} text-anchor="middle" class="erd-card-lbl" fill={g.color}>{g.fromLabel.text === '1' ? '1' : '∗'}</text>
				<text x={g.toLabel.x} y={g.toLabel.y} text-anchor="middle" class="erd-card-lbl" fill={g.color}>{g.toLabel.text}</text>
				{#if selectedEdge === g.fk.id && selectedFk}
					{@const label = `${selectedFk.fromTable}.${selectedFk.fromColumns.join(',')} → ${selectedFk.toTable} · on delete ${selectedFk.onDelete}`}
					{@const w = label.length * 5.6 + 16}
					<g transform="translate({g.mid.x},{g.mid.y})" pointer-events="none">
						<rect x={-w / 2} y="-19" width={w} height="17" rx="8.5" fill="var(--bg)" stroke={g.color} stroke-opacity="0.6" />
						<text x="0" y="-7" text-anchor="middle" class="erd-edge-chip" fill={g.color}>{label}</text>
					</g>
				{/if}
				<path
					d={g.d} fill="none" stroke="transparent" stroke-width="11" pointer-events="stroke"
					style="cursor: pointer"
					onpointerenter={() => (hoveredEdge = g.fk.id)}
					onpointerleave={() => (hoveredEdge = null)}
					onclick={(e) => onEdgeClick(e, g.fk.id)}
					role="button" tabindex="-1" aria-label="{g.fk.fromTable} → {g.fk.toTable}"
					onkeydown={undefined}
				/>
			</g>
		{/each}
	</g>
</svg>

<style>
	.erd-svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		touch-action: none;
	}
	.erd-card {
		transition: opacity 0.18s;
	}
	.erd-group-label {
		font-family: var(--mono);
		font-size: 11.5px;
		letter-spacing: 0.14em;
		opacity: 0.8;
	}
	.erd-group-count {
		font-family: var(--mono);
		font-size: 10.5px;
		fill: var(--fg-muted);
	}
	.erd-tname {
		font-family: var(--mono);
		font-size: 12px;
		font-weight: 700;
		fill: var(--fg);
		user-select: none;
	}
	.erd-rows {
		font-family: var(--mono);
		font-size: 9px;
		fill: var(--fg-muted);
		user-select: none;
	}
	.erd-key {
		font-size: 10px;
		fill: var(--palette-amber);
		user-select: none;
	}
	.erd-col {
		font-family: var(--mono);
		font-size: 10.5px;
		fill: var(--fg-dim);
		user-select: none;
	}
	.erd-col--pk {
		fill: var(--fg);
		font-weight: 600;
	}
	.erd-col--fk {
		text-decoration: underline dotted;
		text-underline-offset: 2.5px;
	}
	.erd-type {
		font-family: var(--mono);
		font-size: 9.5px;
		fill: var(--fg-muted);
		user-select: none;
	}
	.erd-uq {
		fill: var(--palette-amber);
		font-size: 8.5px;
	}
	.erd-more {
		font-family: var(--mono);
		font-size: 9px;
		fill: var(--fg-muted);
		font-style: italic;
	}
	.erd-card-lbl {
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 700;
		user-select: none;
	}
	.erd-edge-chip {
		font-family: var(--mono);
		font-size: 9px;
	}
</style>
