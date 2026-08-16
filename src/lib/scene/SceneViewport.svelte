<script lang="ts">
	// ── SceneViewport — the picture ───────────────────────────────────────────
	// One <Canvas> holding the mesh stage and the compositor stage, exactly as
	// the supply-chain demo and the builder each do separately. That they can
	// share one canvas is the reason a scene doesn't need nested viewports.
	//
	// Owns one interaction the model can't: DRAG-TO-PIN. MeshStudio does the
	// dragging (it already knows how); this listens for the release and converts
	// the node from solver-owned to operator-placed.
	import type { Snippet } from 'svelte';
	import Canvas from '../primitives/Canvas.svelte';
	import CameraControls from '../primitives/CameraControls.svelte';
	import GlobeFrame from '../mesh-studio/globe/GlobeFrame.svelte';
	import MeshStudio from '../mesh-studio/MeshStudio.svelte';
	import type { StudioNode, StudioEdge } from '../mesh-studio/studio.types.js';
	import SceneStage from './SceneStage.svelte';
	import type { CanvasCamera } from '../primitives/canvas-camera.js';
	import type { Scene, SceneObject, ActiveBurst } from './types.js';
	import type { Placed } from './place.js';

	let {
		scene,
		objects = [],
		bursts = [],
		placement,
		globePose = null,
		globeRadius = 0,
		selectedId = null,
		onSelect,
		camera = $bindable(),
		onPin,
		onMoveComponent,
		onUserCamera,
		onDropComponent,
		/** Off for the player: no grid, no dragging, no selection, no drop target —
		 *  an audience is not authoring. */
		interactive = true,
		children,
	}: {
		scene: Scene;
		objects?: SceneObject[];
		bursts?: ActiveBurst[];
		placement: Map<string, Placed>;
		globePose?: { yaw: number; pitch: number; viewDistance: number } | null;
		globeRadius?: number;
		selectedId?: string | null;
		/** Selection is REPORTED, never bound. MeshStudio and SceneStage both own a
		 *  local notion of it; binding here let the child update its copy while the
		 *  parent never heard, so clicking the canvas selected nothing. */
		onSelect?: (id: string | null) => void;
		camera?: CanvasCamera;
		onPin?: (id: string, x: number, y: number) => void;
		onMoveComponent?: (id: string, x: number, y: number) => void;
		/** The operator took the camera — the beat camera should stand down. */
		onUserCamera?: () => void;
		onDropComponent?: (componentId: string, x: number, y: number) => void;
		interactive?: boolean;
		/** Overlaid ON the stage, above the canvas — captions and the like. */
		children?: Snippet;
	} = $props();

	let vpEl = $state<HTMLDivElement | undefined>();

	/** Screen → canvas for the drop point. A pure inverse of `world*tk + t`, with
	 *  the element rect subtracted first — the shared `screenToCanvas` helper
	 *  omits that, which is why every layer that needs this does it itself. */
	function drop(e: DragEvent) {
		const componentId = e.dataTransfer?.getData('component-id');
		if (!componentId || !vpEl) return;
		e.preventDefault();
		const r = vpEl.getBoundingClientRect();
		const tk = camera?.transform.scale ?? 1;
		const tx = camera?.transform.tx ?? 0;
		const ty = camera?.transform.ty ?? 0;
		onDropComponent?.(componentId, (e.clientX - r.left - tx) / tk, (e.clientY - r.top - ty) / tk);
	}

	const isGlobe = $derived(scene.layout === 'globe');

	const HUB_ID = '__hub__';

	const componentObjects = $derived(objects.filter((o) => o.kind === 'component'));

	/** MeshStudio mutates x/y on drag, so it gets its own mutable array. Visual
	 *  fields are refreshed from the evaluated scene each frame; positions are
	 *  refreshed only when the solver has spoken, so a drag in progress is never
	 *  overwritten mid-gesture. */
	let liveNodes = $state<StudioNode[]>([]);

	$effect(() => {
		const evaluated = objects.filter((o) => o.kind === 'mesh.node');
		const place = placement;
		const next: StudioNode[] = [
			{
				id: HUB_ID,
				type: 'control-plane',
				state: 'healthy',
				label: 'control plane',
				x: scene.hub.x,
				y: scene.hub.y,
				r: scene.hub.r,
				glyphAsBody: false,
				flow: 0.8,
			},
			...evaluated.map((o) => {
				const p = place.get(o.id);
				// On the globe, perspective scale is most of what reads as roundness,
				// and the far face has to recede or it looks like a flat ring of discs.
				const scale = p?.scale ?? 1;
				const back = p?.front === false;
				return {
					id: o.id,
					type: o.node!.type,
					state: o.node!.state,
					label: o.node!.label,
					x: p?.x ?? scene.hub.x,
					y: p?.y ?? scene.hub.y,
					r: o.node!.r * scale,
					flow: o.node!.flow,
					// Visible through the shell, but not reachable through it.
					inert: back,
					opacity: back ? o.node!.opacity * (1 + (p?.depth ?? 0) * 0.86) : o.node!.opacity,
					blur: back ? -(p?.depth ?? 0) * 2.4 : 0,
					iconMarkup: o.node!.iconMarkup,
				} satisfies StudioNode;
			}),
		];
		// Paint back to front. MeshStudio renders in array order, so sorting by
		// depth IS the hidden-surface pass — the crest's 0 splits the shell.
		if (place.size && next.some((n) => place.get(n.id)?.depth !== undefined)) {
			next.sort((a, b) => (place.get(a.id)?.depth ?? 0) - (place.get(b.id)?.depth ?? 0));
		}
		liveNodes = next;
	});

	const edges = $derived(
		objects
			.filter((o) => o.kind === 'mesh.edge' && o.edge)
			.map(
				(o) =>
					({
						id: o.id,
						from: o.edge!.from,
						to: o.edge!.to,
						dataType: o.edge!.dataType,
						style: o.edge!.style,
						sig: o.edge!.sig,
						active: o.edge!.active,
						label: o.edge!.label || undefined,
					}) satisfies StudioEdge,
			),
	);

	/** A release is the moment a drag becomes an intent. Compare where the node
	 *  ended up against where the solver put it; a real difference means the
	 *  operator has taken ownership of that position. */
	function onRelease() {
		// Nothing to pin on a globe: a position there is a projection of the spin,
		// not a stored coordinate, so a "drag" has nowhere to be recorded.
		if (isGlobe || !interactive) return;
		for (const n of liveNodes) {
			if (n.id === HUB_ID) continue;
			const p = placement.get(n.id);
			if (!p) continue;
			if (Math.abs(p.x - n.x) > 0.5 || Math.abs(p.y - n.y) > 0.5) {
				onPin?.(n.id, n.x, n.y);
			}
		}
	}
</script>

<svelte:window onpointerup={onRelease} />

<div class="vp">
	<!-- A wheel or a background drag means the operator wants the camera. -->
	<div
		class="vp-in"
		bind:this={vpEl}
		onwheelcapture={() => onUserCamera?.()}
		onpointerdowncapture={(e) => {
			// Only a true background drag takes the camera. Pressing a node or a
			// stage component is SELECTION, and hijacking the camera for that
			// silently disabled the beat camera for the rest of the session.
			const el = e.target as HTMLElement | null;
			if (!el?.closest('[data-node]') && !el?.closest('.stage-item')) onUserCamera?.();
		}}
		ondragover={(e) => {
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		}}
		ondrop={drop}
		role="presentation"
	>
		<Canvas bind:camera minZoom={0.2} maxZoom={3}>
			{#if isGlobe && globePose}
				<!-- Same pose the nodes project with, or the web slides off them. -->
				<GlobeFrame
					cx={scene.hub.x}
					cy={scene.hub.y}
					radius={globeRadius}
					yaw={globePose.yaw}
					pitch={globePose.pitch}
					viewDistance={globePose.viewDistance}
				/>
			{/if}
			<MeshStudio
				concept="instrument"
				bind:nodes={liveNodes}
				{edges}
				selectedId={interactive ? selectedId : null}
				onSelect={(id) => interactive && onSelect?.(id)}
				showGrid={interactive && !isGlobe}
				allowNodeDrag={interactive && !isGlobe}
				allowLinkDraw={false}
				edgeCurve="bow"
				depthSortedParticles={isGlobe}
			/>
			<SceneStage
				components={componentObjects}
				{bursts}
				{placement}
				selectedId={interactive ? selectedId : null}
				{interactive}
				onSelect={(id) => interactive && onSelect?.(id)}
				onMove={(id, x, y) => onMoveComponent?.(id, x, y)}
			/>
			{#if interactive}<CameraControls />{/if}
		</Canvas>
		{@render children?.()}
	</div>
</div>

<style>
	.vp {
		position: relative;
		flex: 1;
		min-height: 0;
		min-width: 0;
		background: var(--bg);
	}
	.vp-in {
		position: absolute;
		inset: 0;
	}
</style>
