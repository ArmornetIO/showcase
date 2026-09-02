<script lang="ts">
	/**
	 * Clusters — bounded regions that hold a composition together, and the
	 * alignment guides they offer while something is dragged inside one.
	 *
	 * Drawn above the artboard layer and below the items, so a cluster reads as
	 * the surface its members sit on. Dragging the title bar moves the cluster and
	 * everything inside it, exactly as a frame does; the difference is what the
	 * cluster does with its members while they are inside it — see `CanvasCluster`
	 * for why `free` and `stack` both exist.
	 *
	 * The padding box is drawn only while the cluster is selected. It is a
	 * composing aid, not a property of the picture, and a canvas of dashed inset
	 * rectangles is harder to read than the layout it is describing.
	 */
	import { builder } from './store.svelte.js';
	import type { CanvasCluster } from './store.svelte.js';

	let {
		scale = 1,
		interactive = true
	}: {
		/** Canvas zoom, so the chrome can stay a constant size on screen. */
		scale?: number;
		interactive?: boolean;
	} = $props();

	type ClusterDrag =
		| { kind: 'move'; id: string; px: number; py: number; x: number; y: number }
		| { kind: 'resize'; id: string; px: number; py: number; w: number; h: number };

	let drag = $state<ClusterDrag | null>(null);

	function startMove(e: PointerEvent, c: CanvasCluster) {
		if (e.button !== 0 || c.locked) return;
		e.stopPropagation();
		builder.selectCluster(c.id);
		drag = { kind: 'move', id: c.id, px: e.clientX, py: e.clientY, x: c.x, y: c.y };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function startResize(e: PointerEvent, c: CanvasCluster) {
		if (e.button !== 0 || c.locked) return;
		e.stopPropagation();
		builder.selectCluster(c.id);
		drag = { kind: 'resize', id: c.id, px: e.clientX, py: e.clientY, w: c.w, h: c.h };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function move(e: PointerEvent) {
		if (!drag) return;
		const dx = (e.clientX - drag.px) / scale;
		const dy = (e.clientY - drag.py) / scale;
		const c = builder.clusters.find((cl) => cl.id === drag!.id);
		if (!c) return;
		if (drag.kind === 'move') {
			builder.setClusterRect(c.id, drag.x + dx, drag.y + dy, c.w, c.h);
		} else {
			builder.setClusterRect(c.id, c.x, c.y, drag.w + dx, drag.h + dy);
		}
	}

	function end() {
		if (!drag) return;
		builder.snapCluster(drag.id);
		drag = null;
	}

	function label(c: CanvasCluster): string {
		if (c.layout === 'free') return 'free';
		return c.direction === 'vertical' ? 'stack ↓' : 'stack →';
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="clusters" onpointermove={move} onpointerup={end}>
	{#each builder.clusters as c (c.id)}
		{#if c.visible}
			{@const selected = builder.selectedClusterId === c.id}
			<div
				class="cluster"
				class:cluster--selected={selected}
				class:cluster--locked={c.locked}
				style:left="{c.x}px"
				style:top="{c.y}px"
				style:width="{c.w}px"
				style:height="{c.h}px"
			>
				{#if selected}
					<div class="cluster-pad" style:inset="{c.padding}px"></div>
				{/if}

				<!-- Chrome divided by the zoom so the label stays readable when the
				     camera is far out — the cluster scales, its name should not. -->
				<div
					class="cluster-bar"
					style:transform="scale({1 / scale})"
					style:transform-origin="left bottom"
					role="button"
					tabindex="-1"
					onpointerdown={(e) => interactive && startMove(e, c)}
					onclick={(e) => {
						// The compositor deselects on a background click and this click
						// bubbles to it, which would clear the cluster we just selected.
						e.stopPropagation();
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') builder.selectCluster(c.id);
					}}
				>
					<span class="cluster-name">{c.name}</span>
					<span class="cluster-mode">{label(c)}</span>
					{#if c.locked}<span class="cluster-lock">⊘</span>{/if}
				</div>

				{#if selected && interactive && !c.locked}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="cluster-resize"
						style:transform="scale({1 / scale})"
						style:transform-origin="right bottom"
						onpointerdown={(e) => startResize(e, c)}
					></div>
				{/if}
			</div>
		{/if}
	{/each}

	<!-- Guides live for the length of one gesture, so they are drawn last and
	     over everything the cluster owns. -->
	{#each builder.guides as g, i (i)}
		<div
			class="guide guide--{g.kind}"
			style:left={g.axis === 'x' ? `${g.at}px` : `${g.from}px`}
			style:top={g.axis === 'x' ? `${g.from}px` : `${g.at}px`}
			style:width={g.axis === 'x' ? '0' : `${g.to - g.from}px`}
			style:height={g.axis === 'x' ? `${g.to - g.from}px` : '0'}
			style:border-left-width={g.axis === 'x' ? `${1 / scale}px` : '0'}
			style:border-top-width={g.axis === 'y' ? `${1 / scale}px` : '0'}
		></div>
	{/each}
</div>

<style>
	.clusters {
		position: absolute;
		inset: 0;
		/* The layer itself is inert; the clusters and their chrome opt in. */
		pointer-events: none;
	}

	.cluster {
		position: absolute;
		border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
		background: color-mix(in srgb, var(--accent) 3%, transparent);
		border-radius: var(--radius-control);
	}
	.cluster--selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent);
	}
	.cluster--locked {
		border-style: dashed;
	}

	/* The content box the padding guides snap to. */
	.cluster-pad {
		position: absolute;
		border: 1px dashed color-mix(in srgb, var(--accent) 30%, transparent);
		border-radius: 2px;
		pointer-events: none;
	}

	.cluster-bar {
		position: absolute;
		left: 0;
		bottom: 100%;
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 2px 4px;
		white-space: nowrap;
		pointer-events: auto;
		cursor: grab;
		user-select: none;
	}
	.cluster-bar:active {
		cursor: grabbing;
	}

	.cluster-name {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-muted);
	}
	.cluster--selected .cluster-name {
		color: var(--accent);
	}
	.cluster-mode,
	.cluster-lock {
		font-family: var(--mono);
		font-size: 9px;
		color: var(--fg-dim);
	}

	.cluster-resize {
		position: absolute;
		right: -5px;
		bottom: -5px;
		width: 10px;
		height: 10px;
		background: var(--bg-elev);
		border: 1px solid var(--accent);
		border-radius: 1px;
		pointer-events: auto;
		cursor: nwse-resize;
	}

	.guide {
		position: absolute;
		border: 0 solid var(--accent);
		pointer-events: none;
	}
	/* A padding guide is a property of the cluster; an edge or centre guide is a
	   relationship between two items. Different colours so you can tell at a
	   glance which one caught you. */
	.guide--padding {
		border-color: color-mix(in srgb, var(--accent) 60%, transparent);
	}
	.guide--center {
		border-color: var(--palette-amber);
	}
	.guide--edge {
		border-color: var(--accent);
	}
</style>
