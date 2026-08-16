<script lang="ts">
	import { getContext } from 'svelte';
	import { CANVAS_CTX } from './canvas-camera.js';
	import type { CanvasContextValue } from './canvas-camera.js';

	let {
		width  = 160,
		height = 100,
	}: {
		width?:  number;
		height?: number;
	} = $props();

	const { transform, svgSize, nodePositions, boundsRegistry, camera } =
		getContext<CanvasContextValue>(CANVAS_CTX);

	// World-space bounding box of all registered content
	const worldBounds = $derived.by(() => {
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		let any = false;
		for (const get of boundsRegistry.values()) {
			const b = get();
			if (!b) continue;
			any = true;
			if (b.minX < minX) minX = b.minX;
			if (b.minY < minY) minY = b.minY;
			if (b.maxX > maxX) maxX = b.maxX;
			if (b.maxY > maxY) maxY = b.maxY;
		}
		return any ? { minX, minY, maxX, maxY } : null;
	});

	// Scale factor from world space to minimap space
	const mmScale = $derived.by(() => {
		if (!worldBounds) return 1;
		const wb = worldBounds;
		const scaleX = width  / (wb.maxX - wb.minX || 1);
		const scaleY = height / (wb.maxY - wb.minY || 1);
		return Math.min(scaleX, scaleY) * 0.9;
	});

	// Viewport rect in minimap coordinates
	const viewportRect = $derived.by(() => {
		if (!worldBounds) return null;
		const wb = worldBounds;
		const { tx, ty, tk } = transform;
		const { w, h } = svgSize;
		// world coords of viewport corners
		const wx0 = -tx / tk;
		const wy0 = -ty / tk;
		const wx1 = wx0 + w / tk;
		const wy1 = wy0 + h / tk;
		const s = mmScale;
		const ox = (width  - (wb.maxX - wb.minX) * s) / 2;
		const oy = (height - (wb.maxY - wb.minY) * s) / 2;
		return {
			x: ox + (wx0 - wb.minX) * s,
			y: oy + (wy0 - wb.minY) * s,
			w: (wx1 - wx0) * s,
			h: (wy1 - wy0) * s,
		};
	});

	// Dots: one per registered node position
	const dots = $derived.by(() => {
		if (!worldBounds) return [];
		const wb = worldBounds;
		const s = mmScale;
		const ox = (width  - (wb.maxX - wb.minX) * s) / 2;
		const oy = (height - (wb.maxY - wb.minY) * s) / 2;
		const result: { x: number; y: number }[] = [];
		for (const getPos of nodePositions.values()) {
			const p = getPos();
			if (!p) continue;
			result.push({
				x: ox + (p.x - wb.minX) * s,
				y: oy + (p.y - wb.minY) * s,
			});
		}
		return result;
	});

	function onMinimapClick(e: MouseEvent) {
		if (!worldBounds) return;
		const el = e.currentTarget as HTMLElement;
		const rect = el.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		const wb = worldBounds;
		const s = mmScale;
		const ox = (width  - (wb.maxX - wb.minX) * s) / 2;
		const oy = (height - (wb.maxY - wb.minY) * s) / 2;
		const worldX = wb.minX + (mx - ox) / s;
		const worldY = wb.minY + (my - oy) / s;
		camera.flyTo({ x: worldX, y: worldY }, { duration: 300 });
	}
</script>

<button type="button" class="cv-minimap" aria-label="Canvas minimap — click to recenter"
	style:width="{width}px" style:height="{height}px"
	onclick={onMinimapClick}>
	<svg {width} {height}>
		{#each dots as d}
			<circle cx={d.x} cy={d.y} r="3" fill="var(--accent)" opacity="0.6" />
		{/each}
		{#if viewportRect}
			{@const vr = viewportRect}
			<rect
				x={vr.x} y={vr.y}
				width={Math.max(4, vr.w)} height={Math.max(4, vr.h)}
				fill="rgba(94,234,212,0.08)"
				stroke="rgba(94,234,212,0.45)"
				stroke-width="1"
			/>
		{/if}
	</svg>
</button>

<style>
	.cv-minimap {
		appearance: none;
		-webkit-appearance: none;
		display: block;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		text-align: inherit;
		position: absolute;
		bottom: 20px;
		right: 16px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
		z-index: 10;
		cursor: crosshair;
	}
</style>
