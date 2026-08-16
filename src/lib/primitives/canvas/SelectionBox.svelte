<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import { CANVAS_CTX } from './canvas-camera.js';
	import type { CanvasContextValue } from './canvas-camera.js';

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const { transform, nodePositions, selectionHandler, onSelectionChange } = ctx;

	let selBox = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

	const handler = {
		onStart(pos: { x: number; y: number }) {
			selBox = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
		},
		onMove(pos: { x: number; y: number }) {
			if (!selBox) return;
			selBox = { ...selBox, x1: pos.x, y1: pos.y };
		},
		onEnd() {
			if (!selBox) return;
			const minX = Math.min(selBox.x0, selBox.x1);
			const maxX = Math.max(selBox.x0, selBox.x1);
			const minY = Math.min(selBox.y0, selBox.y1);
			const maxY = Math.max(selBox.y0, selBox.y1);
			const selected: string[] = [];
			for (const [id, getPos] of nodePositions) {
				const p = getPos();
				if (p && p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
					selected.push(id);
				}
			}
			onSelectionChange?.(selected);
			selBox = null;
		},
	};

	selectionHandler.current = handler;
	onDestroy(() => { selectionHandler.current = undefined; });
</script>

{#if selBox}
	{@const { tx, ty, tk } = transform}
	{@const sx = Math.min(selBox.x0, selBox.x1) * tk + tx}
	{@const sy = Math.min(selBox.y0, selBox.y1) * tk + ty}
	{@const sw = Math.abs(selBox.x1 - selBox.x0) * tk}
	{@const sh = Math.abs(selBox.y1 - selBox.y0) * tk}
	<svg class="cv-sel-overlay">
		<rect x={sx} y={sy} width={sw} height={sh} class="cv-rubber-band" />
	</svg>
{/if}

<style>
	.cv-sel-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
	.cv-rubber-band {
		fill: rgba(94, 234, 212, 0.06);
		stroke: rgba(94, 234, 212, 0.5);
		stroke-width: 1;
		stroke-dasharray: 4 3;
	}
</style>
