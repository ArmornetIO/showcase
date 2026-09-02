<script lang="ts">
	/**
	 * Artboards — named, bounded regions standing in for a screen.
	 *
	 * Drawn under everything (items keep their own z-index above this layer) so a
	 * frame reads as the ground a composition sits on rather than a box drawn over
	 * it. Dragging the title bar moves the frame AND whatever is inside it, which
	 * is the only reason the relationship exists; see `CanvasFrame` for why
	 * membership is positional instead of a parent pointer.
	 *
	 * Clipping is opt-in per frame. Off, a frame is an annotation you can overflow
	 * while composing; on, it is a viewport and tells you what actually fits.
	 */
	import { builder, FRAME_PRESETS } from './store.svelte.js';
	import type { CanvasFrame } from './store.svelte.js';

	let {
		scale = 1,
		interactive = true
	}: {
		/** Canvas zoom, so the chrome can stay a constant size on screen. */
		scale?: number;
		interactive?: boolean;
	} = $props();

	type FrameDrag =
		| { kind: 'move'; id: string; px: number; py: number; x: number; y: number }
		| { kind: 'resize'; id: string; px: number; py: number; w: number; h: number };

	let drag = $state<FrameDrag | null>(null);
	let hostEl = $state<HTMLDivElement | undefined>();

	function startMove(e: PointerEvent, f: CanvasFrame) {
		if (e.button !== 0 || f.locked) return;
		e.stopPropagation();
		builder.selectFrame(f.id);
		drag = { kind: 'move', id: f.id, px: e.clientX, py: e.clientY, x: f.x, y: f.y };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function startResize(e: PointerEvent, f: CanvasFrame) {
		if (e.button !== 0 || f.locked) return;
		e.stopPropagation();
		builder.selectFrame(f.id);
		drag = { kind: 'resize', id: f.id, px: e.clientX, py: e.clientY, w: f.w, h: f.h };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function move(e: PointerEvent) {
		if (!drag) return;
		const dx = (e.clientX - drag.px) / scale;
		const dy = (e.clientY - drag.py) / scale;
		const f = builder.frames.find((fr) => fr.id === drag!.id);
		if (!f) return;
		if (drag.kind === 'move') {
			builder.setFrameRect(f.id, drag.x + dx, drag.y + dy, f.w, f.h);
		} else {
			builder.setFrameRect(f.id, f.x, f.y, drag.w + dx, drag.h + dy);
		}
	}

	function end() {
		if (!drag) return;
		// A hand-resized frame is no longer a named viewport.
		if (drag.kind === 'resize') builder.updateFrame(drag.id, { preset: 'custom' });
		builder.snapFrame(drag.id);
		drag = null;
	}

	function sizeLabel(f: CanvasFrame): string {
		const preset = FRAME_PRESETS[f.preset];
		return f.preset === 'custom' ? `${Math.round(f.w)}×${Math.round(f.h)}` : preset.label;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="frames" bind:this={hostEl} onpointermove={move} onpointerup={end}>
	{#each builder.frames as f (f.id)}
		{#if f.visible}
			{@const selected = builder.selectedFrameId === f.id}
			<div
				class="frame"
				class:frame--selected={selected}
				class:frame--clip={f.clip}
				class:frame--locked={f.locked}
				style:left="{f.x}px"
				style:top="{f.y}px"
				style:width="{f.w}px"
				style:height="{f.h}px"
			>
				<!-- Chrome divided by the zoom so the label stays readable when the
				     camera is far out — the frame scales, its name should not. -->
				<div
					class="frame-bar"
					style:transform="scale({1 / scale})"
					style:transform-origin="left bottom"
					role="button"
					tabindex="-1"
					onpointerdown={(e) => interactive && startMove(e, f)}
					onclick={(e) => {
						// The compositor deselects on a background click, and this
						// click bubbles to it — so the frame we just selected was
						// being cleared before the panel could show it.
						e.stopPropagation();
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') builder.selectFrame(f.id);
					}}
				>
					<span class="frame-name">{f.name}</span>
					<span class="frame-size">{sizeLabel(f)}</span>
					{#if f.locked}<span class="frame-lock">⊘</span>{/if}
				</div>

				{#if selected && interactive && !f.locked}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="frame-resize"
						style:transform="scale({1 / scale})"
						style:transform-origin="right bottom"
						onpointerdown={(e) => startResize(e, f)}
					></div>
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.frames {
		position: absolute;
		inset: 0;
		/* The layer itself is inert; the frames and their chrome opt in. */
		pointer-events: none;
	}

	.frame {
		position: absolute;
		border: 1px solid var(--border, rgba(94, 234, 212, 0.22));
		background: rgba(255, 255, 255, 0.012);
		border-radius: 2px;
	}
	.frame--selected {
		border-color: var(--accent, #5eead4);
		box-shadow: 0 0 0 1px rgba(94, 234, 212, 0.25);
	}
	.frame--clip {
		overflow: hidden;
	}
	.frame--locked {
		border-style: dashed;
	}

	.frame-bar {
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
	.frame-bar:active {
		cursor: grabbing;
	}

	.frame-name {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-muted, #9fb3c8);
	}
	.frame--selected .frame-name {
		color: var(--accent);
	}
	.frame-size,
	.frame-lock {
		font-family: var(--mono);
		font-size: 9px;
		color: var(--fg-dim);
	}

	.frame-resize {
		position: absolute;
		right: -5px;
		bottom: -5px;
		width: 10px;
		height: 10px;
		background: var(--bg-elev, #0a1120);
		border: 1px solid var(--accent, #5eead4);
		border-radius: 1px;
		pointer-events: auto;
		cursor: nwse-resize;
	}
</style>
