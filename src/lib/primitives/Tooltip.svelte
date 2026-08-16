<script lang="ts">
	import type { Snippet } from 'svelte';

	export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

	interface TooltipProps {
		/** Plain text label. Ignored when `tip` snippet is provided. */
		content?: string;
		/** Which side of the trigger to attach to. */
		placement?: TooltipPlacement;
		/** Milliseconds to wait before showing. */
		delay?: number;
		/** Rich tooltip body — overrides `content` when provided. */
		tip?: Snippet;
		/** The trigger element. */
		children: Snippet;
	}

	let { content, placement = 'top', delay = 0, tip, children }: TooltipProps = $props();

	let anchorEl = $state<HTMLElement | null>(null);
	let tipEl = $state<HTMLElement | null>(null);
	let visible = $state(false);
	let x = $state(0);
	let y = $state(0);
	let timer: ReturnType<typeof setTimeout> | null = null;

	const GAP = 8;
	const MARGIN = 8;

	function place() {
		// Measure the first child so the wrapper's display:contents doesn't affect layout.
		const ref = anchorEl?.firstElementChild ?? anchorEl;
		if (!ref) return;
		const r = ref.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		if (placement === 'top' || placement === 'bottom') {
			x = r.left + r.width / 2;
			y = placement === 'top' ? r.top - GAP : r.bottom + GAP;
			// The panel is center-anchored (translateX(-50%)), so it spans
			// [x - w/2, x + w/2]. Clamp x to keep it fully on-screen — otherwise a
			// trigger near the right (or left) edge clips the label. Wrapping to a
			// second line is already handled by the panel's max-width + white-space.
			const half = (tipEl?.offsetWidth ?? 0) / 2;
			if (half) x = Math.min(Math.max(x, half + MARGIN), vw - half - MARGIN);
		} else {
			x = placement === 'left' ? r.left - GAP : r.right + GAP;
			y = r.top + r.height / 2;
			const half = (tipEl?.offsetHeight ?? 0) / 2;
			if (half) y = Math.min(Math.max(y, half + MARGIN), vh - half - MARGIN);
		}
	}

	function show() {
		if (window.matchMedia('(pointer: coarse)').matches) return;
		if (delay) {
			timer = setTimeout(() => {
				place();
				visible = true;
			}, delay);
		} else {
			place();
			visible = true;
		}
	}

	function hide() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		visible = false;
	}

	// Reposition on scroll/resize while open so the tooltip tracks its anchor.
	$effect(() => {
		if (!visible) return;
		// Re-place now that the panel is in the DOM so its measured width/height
		// can be clamped against the viewport edges.
		place();
		const reposition = () => place();
		window.addEventListener('scroll', reposition, { passive: true, capture: true });
		window.addEventListener('resize', reposition, { passive: true });
		return () => {
			window.removeEventListener('scroll', reposition, { capture: true });
			window.removeEventListener('resize', reposition);
		};
	});
</script>

<!--
  display:contents makes the wrapper invisible to layout so it never
  disturbs flex/grid containers or wraps inline content unexpectedly.
-->
<span
	class="anchor"
	role="none"
	bind:this={anchorEl}
	onmouseenter={show}
	onmouseleave={hide}
	onfocusin={show}
	onfocusout={hide}
>
	{@render children()}
</span>

{#if visible && (content || tip)}
	<div
		class="tooltip tip-{placement}"
		role="tooltip"
		bind:this={tipEl}
		style="left:{x}px;top:{y}px"
	>
		<span class="arrow" aria-hidden="true"></span>
		{#if tip}
			{@render tip()}
		{:else}
			{content}
		{/if}
	</div>
{/if}

<style>
	/* ── Anchor wrapper ──────────────────────────────────────────────────────── */
	.anchor {
		display: contents;
	}

	/* ── Tooltip panel ───────────────────────────────────────────────────────── */
	.tooltip {
		position: fixed;
		z-index: 9000;
		/* Size to content (up to max-width) rather than shrink-to-fit against the
		   right-edge `left` offset — otherwise a trigger near the viewport edge
		   collapses the panel to a sliver and breaks words mid-character. */
		width: max-content;
		max-width: 220px;
		padding: 0.35rem 0.6rem;
		background: var(--bg-elev);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		font-family: var(--sans);
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--fg);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45);
		pointer-events: none;
		white-space: normal;
		word-break: break-word;
		animation: tooltip-in 0.1s ease forwards;
	}

	@keyframes tooltip-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* ── Placement transforms ────────────────────────────────────────────────── */
	/* Each shifts the panel so the arrow edge stays on the anchor point. */
	.tip-top {
		transform: translateX(-50%) translateY(-100%);
	}
	.tip-bottom {
		transform: translateX(-50%);
	}
	.tip-left {
		transform: translateX(-100%) translateY(-50%);
	}
	.tip-right {
		transform: translateY(-50%);
	}

	/* ── Arrow ───────────────────────────────────────────────────────────────── */
	.arrow {
		position: absolute;
		width: 7px;
		height: 7px;
		background: var(--bg-elev);
	}

	.tip-top .arrow {
		bottom: -4px;
		left: 50%;
		margin-left: -3.5px;
		border-bottom: 1px solid var(--border-strong);
		border-right: 1px solid var(--border-strong);
		transform: rotate(45deg);
	}
	.tip-bottom .arrow {
		top: -4px;
		left: 50%;
		margin-left: -3.5px;
		border-top: 1px solid var(--border-strong);
		border-left: 1px solid var(--border-strong);
		transform: rotate(45deg);
	}
	.tip-left .arrow {
		right: -4px;
		top: 50%;
		margin-top: -3.5px;
		border-top: 1px solid var(--border-strong);
		border-right: 1px solid var(--border-strong);
		transform: rotate(45deg);
	}
	.tip-right .arrow {
		left: -4px;
		top: 50%;
		margin-top: -3.5px;
		border-bottom: 1px solid var(--border-strong);
		border-left: 1px solid var(--border-strong);
		transform: rotate(45deg);
	}
</style>
