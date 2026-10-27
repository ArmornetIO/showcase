	<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setContext } from 'svelte';
	import { cssZoom } from './css-zoom.js';
	import { CanvasCameraImpl, CANVAS_CTX } from './canvas-camera.js';
	import type { CanvasCamera, SelectionHandler } from './canvas-camera.js';

	let {
		allowPan = true,
		allowZoom = true,
		minZoom = 0.1,
		maxZoom = 4,
		fitOnLoad = false,
		tool = 'select',
		ground = true,
		onSelectionChange,
		camera = $bindable(),
		children,
	}: {
		allowPan?: boolean;
		allowZoom?: boolean;
		/**
		 * What a plain left-drag means. `select` leaves the marquee in charge and
		 * panning to the reserved gestures; `pan` hands the ordinary drag to the
		 * camera, which is the only arrangement most people find without being
		 * told. Defaults to `select` so every existing canvas is unchanged.
		 */
		tool?: 'select' | 'pan';
		/**
		 * The hairline GRID behind the scene.
		 *
		 * On for a flat diagram, where it is the only thing the eye can measure a
		 * pan or a zoom against. OFF for a scene that brings its own structure — a
		 * globe already has a graticule, and a flat 64px grid outside its limb is a
		 * SECOND grid at a different scale and perspective, which reads as two
		 * backgrounds fighting rather than as ground.
		 *
		 * Off does not mean bare: the grid is replaced by a STARFIELD over the same
		 * aurora (`--glass-space`). Points have nothing to duplicate — the globe
		 * owns every line in the frame — and they say the one thing a grid behind a
		 * planet says wrongly, which is where the camera is.
		 */
		ground?: boolean;
		minZoom?: number;
		maxZoom?: number;
		fitOnLoad?: boolean;
		onSelectionChange?: (ids: string[]) => void;
		camera?: CanvasCamera;
		children?: Snippet;
	} = $props();

	let rootEl = $state<HTMLDivElement | undefined>();
	const transform = $state({ tx: 0, ty: 0, tk: 1 });

	/** The grid's tile, in WORLD px — the same 64 the token carries, restated
	 *  here because the token's value is what one tile looks like at zoom 1 and
	 *  this is the number that gets scaled. Keep them equal or the grid changes
	 *  size the moment a canvas first renders. */
	const GRID_WORLD_PX = 64;
	const svgSize = $state({ w: 800, h: 600 });

	const nodePositions = $state(new Map<string, () => { x: number; y: number } | null>());
	const boundsRegistry = $state(new Map<symbol | string, () => { minX: number; minY: number; maxX: number; maxY: number } | null>());
	// `$state` so registering a handler also changes the cursor: on a canvas that
	// can rubber-band, a grab cursor promises a pan the left button won't do.
	const selectionHandler = $state<{ current?: SelectionHandler }>({});

	/**
	 * Viewport coordinates → canvas coordinates. The element rect comes off
	 * first: this used to invert the transform alone, which is only right for a
	 * canvas pinned to the top-left of the window — every consumer that needed a
	 * real answer (the scene viewport's drop handler, the compositor's) was
	 * subtracting the rect itself, and a rubber-band built on the unfixed helper
	 * lands one sidebar to the left of the pointer.
	 */
	function screenToCanvas(sx: number, sy: number): { x: number; y: number } {
		const r = rootEl?.getBoundingClientRect();
		// The rect and the pointer are VISUAL px; `transform` and the SVG below are
		// LAYOUT px. Identical until an ancestor sets `zoom`, and then off by
		// exactly that factor — see `cssZoom`.
		const z = cssZoom(rootEl);
		return {
			x: ((sx - (r?.left ?? 0)) / z - transform.tx) / transform.tk,
			y: ((sy - (r?.top ?? 0)) / z - transform.ty) / transform.tk
		};
	}

	const cameraImpl = new CanvasCameraImpl(
		transform,
		svgSize,
		nodePositions,
		boundsRegistry,
		{
			get min() {
				return minZoom;
			},
			get max() {
				return maxZoom;
			},
		},
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
		// A getter, not the value: the context object is built once, so a plain
		// copy would pin consumers to the callback the host passed on mount.
		get onSelectionChange() {
			return onSelectionChange;
		},
		screenToCanvas,
	});

	let panning = $state(false);
	let selectingActive = false;
	let panOrigin = { x: 0, y: 0 };
	let panStart = { tx: 0, ty: 0 };

	// Space-to-pan, the gesture every canvas tool shares. Tracked here rather
	// than in the host so it works on any canvas, and cleared on blur so an
	// Alt+Tab mid-hold doesn't leave the canvas stuck in pan mode.
	let spaceHeld = $state(false);

	$effect(() => {
		function down(e: KeyboardEvent) {
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
			if (e.code === 'Space') {
				spaceHeld = true;
				// Space would otherwise scroll the page under the canvas.
				if (e.target === document.body || rootEl?.contains(e.target as Node)) e.preventDefault();
			}
		}
		function up(e: KeyboardEvent) {
			if (e.code === 'Space') spaceHeld = false;
		}
		function blur() {
			spaceHeld = false;
		}
		window.addEventListener('keydown', down);
		window.addEventListener('keyup', up);
		window.addEventListener('blur', blur);
		return () => {
			window.removeEventListener('keydown', down);
			window.removeEventListener('keyup', up);
			window.removeEventListener('blur', blur);
		};
	});

	/**
	 * Panning wins over selecting when the gesture asks for it: middle-drag,
	 * space-drag, or a modifier held. Without that arbitration a canvas with a
	 * marquee registered can never be panned by hand, which is how every drawing
	 * tool does it and why they all reserve a second gesture for the pan.
	 */
	function wantsPan(e: PointerEvent): boolean {
		return tool === 'pan' || e.button === 1 || spaceHeld || e.altKey || e.metaKey || e.ctrlKey;
	}

	function onPointerDown(e: PointerEvent) {
		// A node normally owns its own drag. The hand tool is the exception: it
		// pans from anywhere, including from on top of something, which is what
		// makes it usable on a canvas too full to find bare ground on.
		if (!wantsPan(e) && (e.target as Element).closest('[data-canvas-node]')) return;

		// Right-click belongs to whatever context menu the host renders, and a
		// rubber-band that starts under it swallows the click that opens it.
		if (e.button === 2) return;

		if (selectionHandler.current && !wantsPan(e)) {
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
		// Same conversion as the wheel: a visual-px drag delta written straight
		// into a layout-px offset makes the canvas trail the hand under `zoom`.
		const z = cssZoom(rootEl);
		transform.tx = panStart.tx + (e.clientX - panOrigin.x) / z;
		transform.ty = panStart.ty + (e.clientY - panOrigin.y) / z;
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
		// Layout px, like `transform` — zooming about a visual-space point walks
		// the canvas out from under the cursor a little more on every notch.
		const z = cssZoom(rootEl);
		const mx = (e.clientX - rect.left) / z;
		const my = (e.clientY - rect.top) / z;
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
		// delay one microtask so the graph layer has registered its bounds
		if (fitOnLoad && !fitted && svgSize.w > 0) {
			fitted = true;
			setTimeout(() => cameraImpl.fitAll(), 0);
		}
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="cv-root"
	class:cv-static={!allowPan}
	class:cv-panning={panning}
	class:cv-marquee={!!selectionHandler.current && !spaceHeld && tool !== 'pan'}
	bind:this={rootEl}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onwheel={onWheel}
	role="region"
	aria-label="Canvas"
>
	<!-- The ground, and it is IN the world rather than on the frame.
	     As a background on `.cv-root` the grid stayed nailed to the viewport, so
	     a pan slid the scene across a floor that never moved and the nodes read
	     as floating on top of a backdrop instead of standing somewhere. Both
	     halves of that matter: the position follows the camera, and the tile
	     scales with the zoom, so the grid is a fixed thing in WORLD space that
	     you travel over. A repeating gradient tiles forever, so there is no
	     extent to run off the end of and nothing to size to the content. -->
	{#if ground}
		<div
			class="cv-ground"
			style:background-position="{transform.tx}px {transform.ty}px"
			style:--glass-grid-size="{GRID_WORLD_PX * transform.tk}px"
			aria-hidden="true"
		></div>
	{/if}
	{@render children?.()}
</div>

<style>
	.cv-root {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		/* The AMBIENT half of the ground — the colour blobs, which are lighting in
		   the room rather than anything in the scene, so they stay put while the
		   camera moves. The grid is the other half and is a child element now
		   (`.cv-ground`), because the camera has to be able to move it: a floor
		   you cannot travel over is a wallpaper. `--glass-space` is the aurora
		   alone, and it is `none` in high contrast. */
		background-color: var(--bg);
		background-image: var(--glass-space);
		font-family: var(--mono);
		cursor: grab;
		user-select: none;
	}
	/* The travelling floor. Behind everything (first child, and the scene's own
	   layers are positioned) and deaf to the pointer, so it can never eat a click
	   meant for a node or swallow the marquee. */
	.cv-ground {
		position: absolute;
		inset: 0;
		background-image: var(--glass-grid);
		pointer-events: none;
	}
	/* `allowPan={false}` — so no grab cursor, for the reason stated where
	   `selectionHandler` is declared: a grab cursor promises a pan the button
	   will not do. `onPointerDown` already returns early here; only the CSS was
	   still advertising the gesture.

	   It reads as a bug rather than a nitpick when the canvas is DECORATION.
	   Three consumers pass `allowPan={false}` and two of them — the marketing
	   hero and the membrane — stretch the canvas across most of the viewport
	   under ordinary page content. The whole hero came up as a grab surface, and
	   a grab hand sitting over a call-to-action reads as "this does not click"
	   even where the click still lands.

	   Declared before the two below so they win on source order at equal
	   specificity: a static canvas may still register a marquee, and crosshair
	   is right when it does. */
	.cv-root.cv-static {
		cursor: default;
	}
	/* Rubber-band canvas: left-drag selects, so say so. Space, a modifier, or the
	   hand tool puts the grab cursor back — those are the gestures that pan. */
	.cv-root.cv-marquee {
		cursor: crosshair;
	}
	.cv-root.cv-panning {
		cursor: grabbing;
	}
</style>
