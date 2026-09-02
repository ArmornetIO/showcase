<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import { CANVAS_CTX } from './canvas-camera.js';
	import type { CanvasContextValue, SelectionHandler } from './canvas-camera.js';
	import { builder } from '$lib/builder/store.svelte.js';
	import { REGISTRY_MAP } from '$lib/builder/registry.js';
	import ComponentRenderer from '$lib/builder/ComponentRenderer.svelte';
	import ConnectorLayer from '$lib/builder/ConnectorLayer.svelte';
	import ClusterLayer from '$lib/builder/ClusterLayer.svelte';
	import FrameLayer from '$lib/builder/FrameLayer.svelte';
	import type { CanvasItem } from '$lib/builder/store.svelte.js';

	let {
		onItemSelect,
		onItemContextMenu,
		connectMode = false,
		onConnectEnd,
	}: {
		onItemSelect?: (id: string | null) => void;
		/** Right-click on an item. The host owns the menu — the compositor only
		 *  reports where it happened and makes sure the item is selected first. */
		onItemContextMenu?: (e: MouseEvent, id: string) => void;
		/** Click two items to wire them together instead of selecting them. */
		connectMode?: boolean;
		/** Fired when a connector was drawn (or the gesture was abandoned), so the
		 *  host can drop out of connect mode. */
		onConnectEnd?: () => void;
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

	/**
	 * Pointer capture is taken on the first real MOVE, not on pointerdown.
	 *
	 * Capturing at pointerdown retargets the whole gesture's compatibility
	 * events — `click`, `dblclick` and `contextmenu` all end up on the capture
	 * element — which silently broke double-click-to-edit and the right-click
	 * menu: both fired on the compositor host instead of the item under the
	 * cursor. Waiting for movement means a plain click never captures at all,
	 * and a drag still tracks the pointer once it leaves the canvas.
	 */
	const DRAG_THRESHOLD = 3;
	let pendingPointerId: number | null = null;
	let captured = false;

	/** First endpoint picked while in connect mode, waiting for its target. */
	let connectFrom = $state<string | null>(null);

	// Leaving connect mode with a half-drawn connector must not leave the source
	// primed for the next time it is entered.
	$effect(() => {
		if (!connectMode) connectFrom = null;
	});

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
		// The hand tool pans from anywhere, so an item must not swallow the press.
		// Returning WITHOUT stopPropagation is the point: the event carries on up
		// to the canvas, which starts the pan.
		if (builder.tool === 'pan') return;
		// Left button only. A right-click that captured the pointer here retargeted
		// the `contextmenu` that follows it onto the capture element, so the menu
		// never saw the item it was opened on.
		if (e.button !== 0) return;
		e.stopPropagation();

		// Connect mode: the first item clicked is the source, the second is the
		// target. Clicking the same item twice cancels rather than drawing a
		// connector from something to itself.
		if (connectMode) {
			if (!connectFrom) {
				connectFrom = item.id;
			} else {
				if (connectFrom !== item.id) builder.addConnector(connectFrom, item.id);
				connectFrom = null;
				onConnectEnd?.();
			}
			return;
		}

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
				pendingPointerId = e.pointerId;
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
		pendingPointerId = e.pointerId;
	}

	function handleItemDoubleClick(e: MouseEvent, item: CanvasItem) {
		// A Text item's content IS the item, so editing it in a side panel is a
		// round trip for something you are looking straight at. Double-click puts
		// a textarea in its place, sized and styled to match.
		if (item.componentId === 'Text' && !item.locked) {
			e.stopPropagation();
			builder.select(item.id);
			editingTextId = item.id;
			return;
		}
		if (item.groupId && builder.selectedGroupId === item.groupId) {
			e.stopPropagation();
			builder.select(item.id);
		}
	}

	// ── Inline text editing ──────────────────────────────────────────────────
	let editingTextId = $state<string | null>(null);

	/** Focus and select-all on mount, so double-click-and-type replaces the
	 *  placeholder the way it does everywhere else. */
	function autofocus(el: HTMLTextAreaElement) {
		el.focus();
		el.select();
		return { destroy() {} };
	}

	function commitText(id: string, value: string) {
		builder.updateProp(id, 'content', value);
		editingTextId = null;
	}

	function startResizeDrag(e: PointerEvent, item: CanvasItem, corner: 'nw' | 'ne' | 'sw' | 'se') {
		if (!hostEl) return;
		e.stopPropagation();
		const itemEl = hostEl.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement | null;
		const actualW = item.w || itemEl?.offsetWidth  || 100;
		const actualH = item.h || itemEl?.offsetHeight || 60;
		drag = { type: 'resize', itemId: item.id, startPX: e.clientX, startPY: e.clientY, origX: item.x, origY: item.y, origW: actualW, origH: actualH, corner };
		// A resize handle has no click behaviour to protect, so it captures at
		// once — dragging a corner off the canvas edge is the normal case.
		pendingPointerId = e.pointerId;
		hostEl.setPointerCapture(e.pointerId);
		captured = true;
	}

	function handlePointerMove(e: PointerEvent) {
		if (!drag) return;

		// Below the threshold this is still a click, not a drag: don't move
		// anything and don't capture, so `click`/`dblclick` reach the item.
		if (!captured) {
			const far =
				Math.abs(e.clientX - drag.startPX) > DRAG_THRESHOLD ||
				Math.abs(e.clientY - drag.startPY) > DRAG_THRESHOLD;
			if (!far) return;
			if (pendingPointerId !== null) hostEl?.setPointerCapture(pendingPointerId);
			captured = true;
		}

		const { tk } = transform;
		const dxC = (e.clientX - drag.startPX) / tk;
		const dyC = (e.clientY - drag.startPY) / tk;

		if (drag.type === 'group-move') {
			builder.setGroupPositions(drag.origPositions, dxC, dyC);
			return;
		}

		const { itemId, origX, origY, origW, origH } = drag;
		if (drag.type === 'move') {
			// Not setItemRect: a move has to ask whichever cluster it is over what
			// the position means. Resizes stay raw — a cluster aligns positions.
			builder.dragItemTo(itemId, origX + dxC, origY + dyC, origW, origH);
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
		const wasDrag = drag;
		const moved = captured;
		drag = null;
		captured = false;
		pendingPointerId = null;
		if (!wasDrag || !moved) {
			// A gesture that never became a drag still needs its guides taken down.
			builder.clearGuides();
			return;
		}
		if (wasDrag.type === 'group-move') builder.snapGroup(wasDrag.groupId);
		else builder.snapItem(wasDrag.itemId);
		// Only a real drag suppresses the deselect-click that follows it.
		justMoved = true;
	}

	// ── Marquee (lasso) selection ────────────────────────────────────────────
	// Drag on empty canvas rubber-bands a rectangle; everything it touches on
	// release becomes the multi-selection. Intersection, not containment: on a
	// dense canvas you sweep across what you want rather than framing it exactly,
	// and every tool that does containment makes you drag from further away.
	//
	// Registered through the canvas's `selectionHandler` seam rather than owning
	// pointer events here: the Canvas host already decides pan-vs-select and
	// captures the pointer, and a second `setPointerCapture` on the same pointer
	// id leaves the drag wedged open.

	let marquee = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

	const marqueeRect = $derived(
		marquee
			? {
					x: Math.min(marquee.x0, marquee.x1),
					y: Math.min(marquee.y0, marquee.y1),
					w: Math.abs(marquee.x1 - marquee.x0),
					h: Math.abs(marquee.y1 - marquee.y0),
				}
			: null,
	);

	const marqueeHandler: SelectionHandler = {
		onStart(pos) {
			marquee = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
		},
		onMove(pos) {
			if (marquee) marquee = { ...marquee, x1: pos.x, y1: pos.y };
		},
		onEnd() {
			const r = marqueeRect;
			marquee = null;
			// A click, not a drag: leave it to the click handler to deselect.
			if (!r || (r.w < 4 && r.h < 4)) return;
			justMoved = true;
			const hits = builder.items.filter((item) => {
				if (!item.visible || item.locked) return false;
				// 0 means "size yourself", so hit-testing falls back to the same
				// nominal box the group bounds and alignment use.
				const w = item.w || 120;
				const h = item.h || 60;
				return item.x < r.x + r.w && item.x + w > r.x && item.y < r.y + r.h && item.y + h > r.y;
			});
			builder.setMultiSelect(hits.map((i) => i.id));
		},
	};

	ctx.selectionHandler.current = marqueeHandler;

	// ── Bounds, so the camera can fit what is actually here ───────────────────
	// Without this the compositor is invisible to `fitAll`: the camera fits the
	// union of registered bounds and the positions of registered nodes, and the
	// builder registers neither — "fit all" quietly did nothing on a canvas full
	// of components. Frames count too, since an empty artboard is still something
	// you laid out and expect to see.
	const boundsId = Symbol('compositor');
	ctx.boundsRegistry.set(boundsId, () => {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let any = false;
		for (const item of builder.items) {
			if (!item.visible) continue;
			any = true;
			minX = Math.min(minX, item.x);
			minY = Math.min(minY, item.y);
			maxX = Math.max(maxX, item.x + (item.w || 120));
			maxY = Math.max(maxY, item.y + (item.h || 60));
		}
		for (const f of builder.frames) {
			if (!f.visible) continue;
			any = true;
			minX = Math.min(minX, f.x);
			// Frames carry their name above the top edge; include it so fitting a
			// frame doesn't clip its own label.
			minY = Math.min(minY, f.y - 24);
			maxX = Math.max(maxX, f.x + f.w);
			maxY = Math.max(maxY, f.y + f.h);
		}
		return any ? { minX, minY, maxX, maxY } : null;
	});

	onDestroy(() => {
		if (ctx.selectionHandler.current === marqueeHandler) ctx.selectionHandler.current = undefined;
		ctx.boundsRegistry.delete(boundsId);
	});

	function handleItemContextMenu(e: MouseEvent, item: CanvasItem) {
		e.preventDefault();
		e.stopPropagation();
		// Right-clicking outside the current selection acts on what was clicked —
		// a menu that silently targets something else is worse than no menu.
		if (!builder.multiSelectedIds.includes(item.id)) {
			if (item.groupId) builder.selectGroup(item.groupId);
			else builder.select(item.id);
		}
		onItemContextMenu?.(e, item.id);
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

	/** Where a drop landed, in canvas coordinates. */
	function dropPoint(e: DragEvent) {
		const root = getRoot();
		if (!root) return null;
		const rect = root.getBoundingClientRect();
		const { tx, ty, tk } = transform;
		return {
			x: (e.clientX - rect.left - tx) / tk,
			y: (e.clientY - rect.top - ty) / tk,
		};
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const at = dropPoint(e);
		if (!at) return;

		// Two kinds of drop land here: a palette card (carrying `component-id`)
		// and image files from the OS. The files case is what makes a reference
		// screenshot or a brand asset something you can drag straight in.
		const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
		if (files.length) {
			justDropped = true;
			void dropImages(files, at);
			return;
		}

		const id = e.dataTransfer?.getData('component-id');
		if (!id) return;
		builder.addItem(id, at.x, at.y);
		justDropped = true;
	}

	/**
	 * Read each image, size it to its natural aspect, and place it stepping down
	 * and right from the drop point so a multi-file drop doesn't stack.
	 *
	 * Stored as a data URL rather than a blob URL: the canvas persists to
	 * localStorage and is reloaded in a later session, and a blob URL is dead the
	 * moment the page that minted it goes away. The cost is the document carrying
	 * the bytes, which is why oversized files are refused rather than quietly
	 * blowing the storage quota.
	 */
	async function dropImages(files: File[], at: { x: number; y: number }) {
		let n = 0;
		for (const file of files) {
			const dataUrl = await readAsDataUrl(file).catch(() => null);
			if (!dataUrl) continue;
			const size = await imageSize(dataUrl).catch(() => ({ w: 320, h: 200 }));
			const scale = Math.min(1, 480 / Math.max(size.w, size.h));
			builder.addImage(
				dataUrl,
				file.name,
				at.x + n * 24,
				at.y + n * 24,
				Math.round(size.w * scale),
				Math.round(size.h * scale),
			);
			n += 1;
		}
	}

	/** 8MB is roughly where a base64 image starts threatening a 10MB-ish
	 *  localStorage budget on its own. Bigger than that is a link, not a paste. */
	const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

	function readAsDataUrl(file: File): Promise<string> {
		if (file.size > MAX_IMAGE_BYTES) {
			return Promise.reject(new Error(`${file.name} is too large to embed`));
		}
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});
	}

	function imageSize(src: string): Promise<{ w: number; h: number }> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
			img.onerror = reject;
			img.src = src;
		});
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
		<!-- Artboards sit under everything; arrows route between items above them
		     but below the items themselves. -->
		<FrameLayer scale={transform.tk} />
		<!-- Clusters sit above the artboards and below the items: a cluster is the
		     surface its members sit on, not a box drawn over them. -->
		<ClusterLayer scale={transform.tk} />
		<ConnectorLayer />

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
					class:comp-item--connectable={connectMode}
					class:comp-item--connect-source={connectFrom === item.id}
					data-item-id={item.id}
					style:left="{item.x}px"
					style:top="{item.y}px"
					style:z-index={item.zIndex}
					style:width={item.w > 0 ? `${item.w}px` : 'auto'}
					style:height={item.h > 0 ? `${item.h}px` : 'auto'}
					role="button"
					tabindex="0"
					onpointerdown={(e) => handleItemPointerDown(e, item)}
					oncontextmenu={(e) => handleItemContextMenu(e, item)}
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
						{#if editingTextId === item.id}
							<textarea
								class="comp-text-edit"
								value={String(item.props.content ?? '')}
								use:autofocus
								onpointerdown={(e) => e.stopPropagation()}
								onblur={(e) => commitText(item.id, e.currentTarget.value)}
								onkeydown={(e) => {
									// Escape commits too: there is nothing destructive to cancel,
									// and undo is one keystroke away if the edit was a mistake.
									if (e.key === 'Escape') {
										e.preventDefault();
										commitText(item.id, e.currentTarget.value);
									}
								}}
							></textarea>
						{:else}
							<ComponentRenderer
								componentId={item.componentId}
								props={item.props}
								w={item.w}
								h={item.h}
								styleOverrides={item.styleOverrides}
							/>
						{/if}
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

		{#if marqueeRect}
			<div
				class="comp-marquee"
				style:left="{marqueeRect.x}px"
				style:top="{marqueeRect.y}px"
				style:width="{marqueeRect.w}px"
				style:height="{marqueeRect.h}px"
			></div>
		{/if}
	</div>

	{#if builder.items.length === 0}
		<div class="comp-empty">
			<div class="comp-empty-icon">⊕</div>
			<div class="comp-empty-label">Drag components from the toolbox to build your layout</div>
		</div>
	{/if}
</div>

<style>
	.comp-text-edit {
		display: block;
		width: 100%;
		min-height: 2.4em;
		padding: 2px 4px;
		background: rgba(94, 234, 212, 0.06);
		border: 1px dashed var(--accent, #5eead4);
		border-radius: var(--radius-hairline);
		color: var(--fg);
		font: inherit;
		line-height: 1.4;
		resize: none;
		outline: none;
	}

	.comp-marquee {
		position: absolute;
		border: 1px solid var(--accent, #5eead4);
		background: rgba(94, 234, 212, 0.08);
		pointer-events: none;
		z-index: 9999;
	}

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
		border-radius: var(--radius-inset);
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
	/* Connect mode: every item is a target, and the one already picked says so. */
	.comp-item.comp-item--connectable      { cursor: crosshair; }
	.comp-item.comp-item--connect-source   { outline: 1px dashed var(--accent, #5eead4); outline-offset: 4px; }

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
