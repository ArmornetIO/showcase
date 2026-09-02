<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import AlertBlade from './AlertBlade.svelte';
	import { alertBlade } from './alertBlade.svelte.js';

	export type BladePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

	interface AlertBladeHostProps {
		position?: BladePosition;
		draggable?: boolean;
	}

	let { position = 'bottom-right', draggable = false }: AlertBladeHostProps = $props();

	// ── Drag state ────────────────────────────────────────────────────────────
	let hostEl = $state<HTMLDivElement | null>(null);
	let dragPos = $state<{ x: number; y: number } | null>(null);
	let isDragging = $state(false);
	let dragOffset = { x: 0, y: 0 };

	// Fly direction flips based on side
	const flyX = $derived(position.endsWith('right') ? 80 : -80);

	// Stack direction: bottom positions grow upward (reverse), top positions grow down
	const stackDir = $derived(position.startsWith('bottom') ? 'column-reverse' : 'column');

	// When dragging we switch to explicit left/top; otherwise use corner classes
	const dragStyle = $derived(dragPos ? `left:${dragPos.x}px;top:${dragPos.y}px;` : '');

	function onPointerDown(e: PointerEvent) {
		if (!draggable || !hostEl) return;
		// Don't start a drag when interacting with a blade's own buttons
		if ((e.target as HTMLElement).closest('.blade')) return;

		const rect = hostEl.getBoundingClientRect();
		dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		// First drag: initialise from rendered corner position
		if (!dragPos) dragPos = { x: rect.left, y: rect.top };

		hostEl.setPointerCapture(e.pointerId);
		isDragging = true;
		e.preventDefault();
	}

	function onPointerMove(e: PointerEvent) {
		if (!isDragging || !hostEl) return;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		dragPos = {
			x: Math.max(0, Math.min(e.clientX - dragOffset.x, vw - hostEl.offsetWidth)),
			y: Math.max(0, Math.min(e.clientY - dragOffset.y, vh - hostEl.offsetHeight))
		};
	}

	function onPointerUp() {
		isDragging = false;
	}
</script>

<div
	bind:this={hostEl}
	class="blade-host"
	class:pos-top-left={!dragPos && position === 'top-left'}
	class:pos-top-right={!dragPos && position === 'top-right'}
	class:pos-bottom-left={!dragPos && position === 'bottom-left'}
	class:pos-bottom-right={!dragPos && position === 'bottom-right'}
	class:is-dragging={isDragging}
	class:is-draggable={draggable}
	style="{dragStyle}flex-direction:{stackDir};"
	aria-label="Notifications"
	aria-live="polite"
	role="region"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
>
	{#if draggable}
		<div class="drag-handle" aria-hidden="true">
			<span></span><span></span>
			<span></span><span></span>
			<span></span><span></span>
		</div>
	{/if}

	{#each alertBlade.items as item (item.id)}
		<div transition:fly={{ x: flyX, duration: 280, easing: cubicOut }}>
			<AlertBlade {...item} ondismiss={(id) => alertBlade.dismiss(id)} />
		</div>
	{/each}
</div>

<style>
	.blade-host {
		position: fixed;
		z-index: 9999;
		display: flex;
		gap: 8px;
		pointer-events: none;
	}
	.blade-host > :global(*) {
		pointer-events: auto;
	}

	/* ── Corner positions ────────────────────────────────────────────────── */
	.pos-bottom-right {
		bottom: calc(24px + env(safe-area-inset-bottom, 0px));
		right: 24px;
	}
	.pos-bottom-left {
		bottom: calc(24px + env(safe-area-inset-bottom, 0px));
		left: 24px;
	}
	.pos-top-right {
		top: 24px;
		right: 24px;
	}
	.pos-top-left {
		top: 24px;
		left: 24px;
	}

	/* ── Drag states ─────────────────────────────────────────────────────── */
	.is-draggable {
		pointer-events: auto;
	}
	.is-dragging {
		cursor: grabbing;
		user-select: none;
	}
	.is-draggable:not(.is-dragging) {
		cursor: grab;
	}

	/* Blades themselves always intercept pointer even when host is draggable */
	.is-draggable :global(.blade) {
		cursor: default;
	}

	/* ── Drag handle — 3×2 dot grid shown above blade stack ─────────────── */
	.drag-handle {
		display: grid;
		grid-template-columns: repeat(3, 4px);
		gap: 3px;
		padding: 6px 8px;
		align-self: center;
		opacity: 0.3;
		transition: opacity 0.15s;
		pointer-events: none;
	}
	.blade-host:hover .drag-handle {
		opacity: 0.7;
	}
	.drag-handle span {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--fg-dim);
	}
</style>
