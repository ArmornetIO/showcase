<script lang="ts">
	// ── SceneCaptions — the narration, on the stage ───────────────────────────
	// Shared by the editor viewport and the player, deliberately: captions are the
	// thing the audience actually reads, and authoring them in a panel where they
	// never appear is authoring blind. Sharing one component also means preview
	// fidelity cannot drift from what ships.
	import type { Beat } from './types.js';

	let {
		beat,
		beatIndex = 0,
		beatCount = 1,
		progress = 0,
		/** Chapter ticks + progress bar are for the kiosk; the editor has a
		 *  timeline for that and doesn't need them twice. */
		chrome = true,
	}: {
		beat?: Beat;
		beatIndex?: number;
		beatCount?: number;
		progress?: number;
		chrome?: boolean;
	} = $props();
</script>

{#if beat}
	<div class="cap-wrap" aria-live="polite">
		{#key beat.id}
			<div class="cap-in">
				<p class="headline">{beat.caption}</p>
				{#if beat.sub}<p class="sub">{beat.sub}</p>{/if}
			</div>
		{/key}
	</div>
{/if}

{#if chrome}
	<div class="chapters" role="presentation">
		{#each { length: beatCount } as _, i (i)}
			<span class="chapter" class:chapter--done={i <= beatIndex}></span>
		{/each}
	</div>
	<div class="progress" role="presentation">
		<div class="progress-fill" style:width="{progress * 100}%"></div>
	</div>
{/if}

<style>
	.cap-wrap {
		position: absolute;
		left: 0;
		right: 0;
		bottom: clamp(1.6rem, 6vh, 4rem);
		display: flex;
		justify-content: center;
		padding: 0 1.25rem;
		pointer-events: none;
		z-index: 6;
	}
	.cap-in {
		max-width: 34rem;
		text-align: center;
		animation: cap-rise 560ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	.headline {
		margin: 0;
		font-size: clamp(1rem, 3.2vw, 1.6rem);
		line-height: 1.25;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--fg);
		text-wrap: balance;
		text-shadow: 0 2px 18px rgba(0, 0, 0, 0.75);
	}
	.sub {
		margin: 0.45rem 0 0;
		font-size: clamp(0.72rem, 2vw, 0.9rem);
		line-height: 1.4;
		color: var(--fg-dim);
		text-wrap: balance;
	}

	.chapters {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0.7rem;
		display: flex;
		justify-content: center;
		gap: 0.3rem;
		z-index: 6;
		pointer-events: none;
	}
	.chapter {
		width: 0.9rem;
		height: 2px;
		border-radius: 1px;
		background: rgba(255, 255, 255, 0.16);
		transition: background 300ms ease;
	}
	.chapter--done {
		background: var(--accent);
	}

	.progress {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		background: rgba(255, 255, 255, 0.08);
		z-index: 6;
		pointer-events: none;
	}
	.progress-fill {
		height: 100%;
		background: var(--accent);
		opacity: 0.7;
	}

	@keyframes cap-rise {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cap-in {
			animation-duration: 1ms;
		}
	}
</style>
