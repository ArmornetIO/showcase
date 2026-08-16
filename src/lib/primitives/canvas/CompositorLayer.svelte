<script lang="ts">
	import { getContext } from 'svelte';
	import { CANVAS_CTX } from './canvas-camera.js';
	import type { CanvasContextValue } from './canvas-camera.js';
	import { builder } from '$lib/builder/store.svelte.js';
	import { REGISTRY_MAP } from '$lib/builder/registry.js';
	import ComponentRenderer from '$lib/builder/ComponentRenderer.svelte';
	import type { CanvasItem } from '$lib/builder/store.svelte.js';

	let {
		onItemSelect,
	}: {
		onItemSelect?: (id: string | null) => void;
	} = $props();

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const { transform, getRoot } = ctx;

	let hostEl = $state<HTMLDivElement | undefined>();

	// ── Drag state ───────────────────────────────────────────────────────────

	type DragKind =
		| { type: 'move';   itemId: string; startPX: number; startPY: number; origX: number; origY: number; origW: number; origH: number }
		| { type: 'resize'; itemId: string; startPX: number; startPY: number; origX: number; origY: number; origW: number; origH: number; corner: 'nw' | 'ne' | 'sw' | 'se' }
		| { type: 'group-move'; groupId: string; startPX: number; startPY: number; origPositions: { id: string; x: number; y: number }[] };

	let drag = $state<DragKind | null>(null);
	let justDropped = false;
	let justMoved = false;

	// ── Group bounds ─────────────────────────────────────────────────────────

	function computeGroupBounds(groupId: string) {
		const members = builder.items.filter((i) => i.groupId === groupId && i.visible);
		if (members.length === 0) return null;
		const minX = Math.min(...members.map((i) => i.x));
		const minY = Math.min(...members.map((i) => i.y));
		const maxX = Math.max(...members.map((i) => i.x + Math.max(i.w, 60)));
		const maxY = Math.max(...members.map((i) => i.y + Math.max(i.h, 40)));
		const maxZ = Math.max(...members.map((i) => i.zIndex));
		return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, maxZ };
	}

	// ── Pointer events ───────────────────────────────────────────────────────

	function handleItemPointerDown(e: PointerEvent, item: CanvasItem) {
		if (!hostEl) return;
		e.stopPropagation();

		if (item.locked) {
			if (item.groupId) builder.selectGroup(item.groupId);
			else builder.select(item.id);
			onItemSelect?.(item.id);
			return;
		}

		if (e.shiftKey) {
			builder.toggleMultiSelect(item.id);
			return;
		}

		if (item.groupId) {
			if (builder.selectedGroupId === item.groupId) {
				const origPositions = builder.items
					.filter((i) => i.groupId === item.groupId)
					.map((i) => ({ id: i.id, x: i.x, y: i.y }));
				drag = { type: 'group-move', groupId: item.groupId, startPX: e.clientX, startPY: e.clientY, origPositions };
				hostEl.setPointerCapture(e.pointerId);
			} else {
				builder.selectGroup(item.groupId);
			}
			return;
		}

		builder.select(item.id);
		builder.bringToFront(item.id);
		onItemSelect?.(item.id);
		drag = {
			type: 'move',
			itemId: item.id,
			startPX: e.clientX,
			startPY: e.clientY,
			origX: item.x,
			origY: item.y,
			origW: item.w,
			origH: item.h,
		};
		hostEl.setPointerCapture(e.pointerId);
	}

	function handleItemDoubleClick(e: MouseEvent, item: CanvasItem) {
		if (item.groupId && builder.selectedGroupId === item.groupId) {
			e.stopPropagation();
			builder.select(item.id);
		}
	}

	function startResizeDrag(e: PointerEvent, item: CanvasItem, corner: 'nw' | 'ne' | 'sw' | 'se') {
		if (!hostEl) return;
		e.stopPropagation();
		const itemEl = hostEl.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement | null;
		const actualW = item.w || itemEl?.offsetWidth  || 100;
		const actualH = item.h || itemEl?.offsetHeight || 60;
		drag = { type: 'resize', itemId: item.id, startPX: e.clientX, startPY: e.clientY, origX: item.x, origY: item.y, origW: actualW, origH: actualH, corner };
		hostEl.setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!drag) return;
		const { tk } = transform;
		const dxC = (e.clientX - drag.startPX) / tk;
		const dyC = (e.clientY - drag.startPY) / tk;

		if (drag.type === 'group-move') {
			builder.setGroupPositions(drag.origPositions, dxC, dyC);
			return;
		}

		const { itemId, origX, origY, origW, origH } = drag;
		if (drag.type === 'move') {
			builder.setItemRect(itemId, origX + dxC, origY + dyC, origW, origH);
		} else {
			const { corner } = drag;
			let x = origX, y = origY, w = origW, h = origH;
			if (corner === 'se') { w = Math.max(40, origW + dxC); h = Math.max(20, origH + dyC); }
			else if (corner === 'sw') { w = Math.max(40, origW - dxC); x = origX + (origW - w); h = Math.max(20, origH + dyC); }
			else if (corner === 'ne') { w = Math.max(40, origW + dxC); h = Math.max(20, origH - dyC); y = origY + (origH - h); }
			else { w = Math.max(40, origW - dxC); x = origX + (origW - w); h = Math.max(20, origH - dyC); y = origY + (origH - h); }
			builder.setItemRect(itemId, Math.max(0, x), Math.max(0, y), w, h);
		}
	}

	function handlePointerUp() {
		if (!drag) return;
		if (drag.type === 'group-move') builder.snapGroup(drag.groupId);
		else builder.snapItem(drag.itemId);
		drag = null;
		justMoved = true;
	}

	// ── Canvas click (deselect) ───────────────────────────────────────────────

	function handleClick() {
		if (justDropped) { justDropped = false; return; }
		if (justMoved)   { justMoved   = false; return; }
		builder.clearSelection();
		onItemSelect?.(null);
	}

	// ── HTML drag-and-drop from toolbox ───────────────────────────────────────

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'copy';
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const id = e.dataTransfer?.getData('component-id');
		if (!id) return;
		const root = getRoot();
		if (!root) return;
		const rect = root.getBoundingClientRect();
		const { tx, ty, tk } = transform;
		const x = (e.clientX - rect.left - tx) / tk;
		const y = (e.clientY - rect.top  - ty) / tk;
		builder.addItem(id, x, y);
		justDropped = true;
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="cv-compositor"
	bind:this={hostEl}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	ondragover={handleDragOver}
	ondrop={handleDrop}
	onclick={handleClick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}}
	role="application"
	aria-label="Layout canvas"
>
	<!-- dot grid -->
	{#if builder.gridVisible}
		<div class="cv-comp-grid"
			style:background-size="{builder.gridSize}px {builder.gridSize}px"
		></div>
	{/if}

	<!-- canvas coordinate space wrapper -->
	<div
		class="cv-comp-world"
		style:transform="translate({transform.tx}px,{transform.ty}px) scale({transform.tk})"
	>
		<!-- Group bounding boxes -->
		{#each builder.groups as group (group.id)}
			{@const bounds = computeGroupBounds(group.id)}
			{#if bounds}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="comp-group-bbox"
					class:comp-group-bbox--selected={builder.selectedGroupId === group.id}
					style:left="{bounds.x - 10}px"
					style:top="{bounds.y - 10}px"
					style:width="{bounds.w + 20}px"
					style:height="{bounds.h + 20}px"
					style:z-index={Math.max(1, bounds.maxZ - 1)}
					role="button"
					tabindex="-1"
					onclick={(e) => { e.stopPropagation(); builder.selectGroup(group.id); }}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') builder.selectGroup(group.id); }}
				>
					<span class="comp-group-label">{group.name}</span>
				</div>
			{/if}
		{/each}

		<!-- Items -->
		{#each builder.items as item (item.id)}
			{#if item.visible}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="comp-item"
					class:comp-item--selected={builder.selectedId === item.id}
					class:comp-item--group-active={builder.selectedGroupId && item.groupId === builder.selectedGroupId}
					class:comp-item--multi-selected={builder.multiSelectedIds.includes(item.id)}
					class:comp-item--dragging={
						(drag?.type === 'move' && drag.itemId === item.id) ||
						(drag?.type === 'group-move' && item.groupId === drag.groupId)
					}
					class:comp-item--locked={item.locked}
					data-item-id={item.id}
					style:left="{item.x}px"
					style:top="{item.y}px"
					style:z-index={item.zIndex}
					style:width={item.w > 0 ? `${item.w}px` : 'auto'}
					style:height={item.h > 0 ? `${item.h}px` : 'auto'}
					role="button"
					tabindex="0"
					onpointerdown={(e) => handleItemPointerDown(e, item)}
					ondblclick={(e) => handleItemDoubleClick(e, item)}
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => {
						if (e.key === 'Delete' || e.key === 'Backspace') {
							e.preventDefault();
							builder.deleteItem(item.id);
						}
					}}
					ondragstart={(e) => e.preventDefault()}
				>
					<div class="comp-item-content">
						<ComponentRenderer
							componentId={item.componentId}
							props={item.props}
							w={item.w}
							h={item.h}
							styleOverrides={item.styleOverrides}
						/>
					</div>

					{#if builder.selectedId === item.id}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="rh rh-nw" onpointerdown={(e) => { e.stopPropagation(); startResizeDrag(e, item, 'nw'); }}></div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="rh rh-ne" onpointerdown={(e) => { e.stopPropagation(); startResizeDrag(e, item, 'ne'); }}></div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="rh rh-sw" onpointerdown={(e) => { e.stopPropagation(); startResizeDrag(e, item, 'sw'); }}></div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="rh rh-se" onpointerdown={(e) => { e.stopPropagation(); startResizeDrag(e, item, 'se'); }}></div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>

	{#if builder.items.length === 0}
		<div class="comp-empty">
			<div class="comp-empty-icon">⊕</div>
			<div class="comp-empty-label">Drag components from the toolbox to build your layout</div>
		</div>
	{/if}
</div>

<style>
	.cv-compositor {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.cv-comp-grid {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, rgba(94, 234, 212, 0.18) 1px, transparent 1px);
		pointer-events: none;
	}

	.cv-comp-world {
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: 0 0;
		/* items are absolutely positioned within canvas-space coords */
		width: 0;
		height: 0;
	}

	/* ── Group bounding boxes ── */
	.comp-group-bbox {
		position: absolute;
		border: 1px dashed rgba(94, 234, 212, 0.18);
		border-radius: 3px;
		pointer-events: none;
		box-sizing: border-box;
	}
	.comp-group-bbox--selected {
		border-color: rgba(94, 234, 212, 0.5);
		background: rgba(94, 234, 212, 0.03);
		pointer-events: auto;
		cursor: pointer;
	}
	.comp-group-label {
		position: absolute;
		top: -18px;
		left: 4px;
		font-family: var(--mono);
		font-size: 8px;
		letter-spacing: 0.15em;
		color: rgba(94, 234, 212, 0.4);
		pointer-events: none;
		white-space: nowrap;
		text-transform: uppercase;
	}
	.comp-group-bbox--selected .comp-group-label { color: rgba(94, 234, 212, 0.75); }

	/* ── Items ── */
	.comp-item {
		position: absolute;
		cursor: grab;
		user-select: none;
		box-sizing: border-box;
	}
	.comp-item:active,
	.comp-item.comp-item--dragging { cursor: grabbing; }
	.comp-item.comp-item--selected         { outline: 1px solid rgba(94, 234, 212, 0.55); outline-offset: 5px; }
	.comp-item.comp-item--group-active     { outline: 1px solid rgba(94, 234, 212, 0.3);  outline-offset: 3px; }
	.comp-item.comp-item--multi-selected   { outline: 1px solid rgba(165, 180, 252, 0.6); outline-offset: 4px; }
	.comp-item.comp-item--locked           { cursor: default; }

	.comp-item-content {
		pointer-events: none;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	/* ── Resize handles ── */
	.rh {
		position: absolute;
		width: 10px;
		height: 10px;
		background: var(--accent);
		border: 2px solid var(--bg);
		border-radius: 50%;
		z-index: 100;
		box-shadow: 0 0 6px rgba(94, 234, 212, 0.5);
	}
	.rh-nw { top: -5px;    left: -5px;   cursor: nw-resize; }
	.rh-ne { top: -5px;    right: -5px;  cursor: ne-resize; }
	.rh-sw { bottom: -5px; left: -5px;   cursor: sw-resize; }
	.rh-se { bottom: -5px; right: -5px;  cursor: se-resize; }

	/* ── Empty state ── */
	.comp-empty {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		pointer-events: none;
		user-select: none;
	}
	.comp-empty-icon {
		font-size: 32px;
		color: rgba(94, 234, 212, 0.2);
	}
	.comp-empty-label {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.15em;
		color: rgba(94, 234, 212, 0.25);
		text-align: center;
		max-width: 280px;
	}
</style>
