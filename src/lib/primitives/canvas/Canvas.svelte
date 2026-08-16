	<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setContext } from 'svelte';
	import { CanvasCameraImpl, CANVAS_CTX } from './canvas-camera.js';
	import type { CanvasCamera, SelectionHandler } from './canvas-camera.js';

	let {
		allowPan = true,
		allowZoom = true,
		minZoom = 0.1,
		maxZoom = 4,
		fitOnLoad = false,
		onSelectionChange,
		camera = $bindable(),
		children,
	}: {
		allowPan?: boolean;
		allowZoom?: boolean;
		minZoom?: number;
		maxZoom?: number;
		fitOnLoad?: boolean;
		onSelectionChange?: (ids: string[]) => void;
		camera?: CanvasCamera;
		children?: Snippet;
	} = $props();

	let rootEl = $state<HTMLDivElement | undefined>();
	const transform = $state({ tx: 0, ty: 0, tk: 1 });
	const svgSize = $state({ w: 800, h: 600 });

	const nodePositions = $state(new Map<string, () => { x: number; y: number } | null>());
	const boundsRegistry = $state(new Map<symbol | string, () => { minX: number; minY: number; maxX: number; maxY: number } | null>());
	const selectionHandler: { current?: SelectionHandler } = {};

	function screenToCanvas(sx: number, sy: number): { x: number; y: number } {
		return { x: (sx - transform.tx) / transform.tk, y: (sy - transform.ty) / transform.tk };
	}

	const cameraImpl = new CanvasCameraImpl(
		transform,
		svgSize,
		nodePositions,
		boundsRegistry,
		minZoom,
		maxZoom,
	);

	camera = cameraImpl;

	setContext(CANVAS_CTX, {
		transform,
		svgSize,
		nodePositions,
		boundsRegistry,
		camera: cameraImpl,
		getRoot: () => rootEl,
		selectionHandler,
		onSelectionChange,
		screenToCanvas,
	});

	let panning = $state(false);
	let selectingActive = false;
	let panOrigin = { x: 0, y: 0 };
	let panStart = { tx: 0, ty: 0 };

	function onPointerDown(e: PointerEvent) {
		if ((e.target as Element).closest('[data-canvas-node]')) return;

		if (selectionHandler.current) {
			selectingActive = true;
			selectionHandler.current.onStart(screenToCanvas(e.clientX, e.clientY));
			rootEl?.setPointerCapture(e.pointerId);
			return;
		}

		if (!allowPan) return;
		panning = true;
		panOrigin = { x: e.clientX, y: e.clientY };
		panStart = { tx: transform.tx, ty: transform.ty };
		rootEl?.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (selectingActive) {
			selectionHandler.current?.onMove(screenToCanvas(e.clientX, e.clientY));
			return;
		}
		if (!panning) return;
		transform.tx = panStart.tx + (e.clientX - panOrigin.x);
		transform.ty = panStart.ty + (e.clientY - panOrigin.y);
	}

	function onPointerUp() {
		if (selectingActive) {
			selectingActive = false;
			selectionHandler.current?.onEnd();
			return;
		}
		panning = false;
	}

	function onWheel(e: WheelEvent) {
		if (!allowZoom) return;
		e.preventDefault();
		const { tx, ty, tk } = transform;
		const rect = rootEl!.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		const newTk = Math.max(minZoom, Math.min(maxZoom, tk * delta));
		transform.tx = mx - (mx - tx) * (newTk / tk);
		transform.ty = my - (my - ty) * (newTk / tk);
		transform.tk = newTk;
	}

	$effect(() => {
		if (!rootEl) return;
		const ro = new ResizeObserver((entries) => {
			const r = entries[0].contentRect;
			svgSize.w = r.width;
			svgSize.h = r.height;
		});
		ro.observe(rootEl);
		return () => ro.disconnect();
	});

	let fitted = false;
	$effect(() => {
		// delay one microtask so GraphLayer has registered its bounds
		if (fitOnLoad && !fitted && svgSize.w > 0) {
			fitted = true;
			setTimeout(() => cameraImpl.fitAll(), 0);
		}
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="cv-root"
	class:cv-panning={panning}
	bind:this={rootEl}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onwheel={onWheel}
	role="region"
	aria-label="Canvas"
>
	{@render children?.()}
</div>

<style>
	.cv-root {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--bg);
		font-family: var(--mono);
		cursor: grab;
		user-select: none;
	}
	.cv-root.cv-panning {
		cursor: grabbing;
	}
</style>
