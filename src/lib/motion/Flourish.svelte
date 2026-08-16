<script lang="ts">
	// ── Flourish — a decoupled click-flourish overlay ────────────────────────────
	// Drop this inside ANY `position: relative` element and bump `trigger` to play.
	// It knows nothing about the side nav (or anything else) — it just fills its
	// parent and paints particles. The consumer owns *when* it fires: increment
	// `trigger` on the interaction you care about and the animation replays.
	//
	//   <button style="position:relative" onclick={() => n++}>
	//     Save
	//     <Flourish kind="sparkle" trigger={n} />
	//   </button>
	//
	// Point bursts (sparkle / firework) emanate from `anchorX`/`anchorY`; sweeps
	// (shimmer / aurora) span the whole box. `trigger` starts at 0 and stays quiet
	// until the first real bump, so mounting never fires an unprompted burst.
	import type { FlourishKind } from './effects.js';

	interface Props {
		/** Which effect to play. `none` renders nothing. */
		kind?: FlourishKind;
		/** Replay key — increment to play again. 0 = idle (nothing shown). */
		trigger?: number;
		/** Origin of point bursts. Any CSS length/percent. Default: centre. */
		anchorX?: string;
		anchorY?: string;
		/** Accent colour for the particles. Defaults to the theme accent. */
		color?: string;
		/**
		 * Play the effect backwards — particles converge instead of scattering,
		 * sweeps run the other way. Every effect is authored as an outward burst,
		 * so this is a pure `animation-direction` flip rather than a second set of
		 * keyframes: the closing half of a lifecycle is the opening half in
		 * reverse, and stays that way for free as effects are added.
		 */
		reverse?: boolean;
	}

	let {
		kind = 'sparkle',
		trigger = 0,
		anchorX = '50%',
		anchorY = '50%',
		color = 'var(--accent)',
		reverse = false
	}: Props = $props();

	// Deterministic particle fields — no Math.random, so SSR/hydration stay stable
	// and the shape is reproducible frame to frame.
	const SPARKS = Array.from({ length: 7 }, (_, i) => {
		const a = (i / 7) * Math.PI * 2 + 0.6;
		const r = 20 + (i % 3) * 7;
		return { tx: Math.cos(a) * r, ty: Math.sin(a) * r, d: (i % 4) * 40, s: 0.7 + (i % 3) * 0.2 };
	});
	const FIREWORKS = Array.from({ length: 12 }, (_, i) => {
		const a = (i / 12) * Math.PI * 2;
		const r = 30 + (i % 2) * 10;
		return { tx: Math.cos(a) * r, ty: Math.sin(a) * r, d: (i % 3) * 30 };
	});
</script>

{#if kind !== 'none' && trigger > 0}
	{#key trigger}
		<span
			class="fx"
			class:reverse
			style="--fx-color:{color}; --ax:{anchorX}; --ay:{anchorY}"
			aria-hidden="true"
		>
			{#if kind === 'sparkle'}
				<span class="origin">
					{#each SPARKS as p (p.tx)}
						<span class="spark" style="--tx:{p.tx}px; --ty:{p.ty}px; --d:{p.d}ms; --s:{p.s}"
						></span>
					{/each}
				</span>
			{:else if kind === 'firework'}
				<span class="origin">
					<span class="fw-flash"></span>
					{#each FIREWORKS as p, k (k)}
						<span class="fw-spark" style="--tx:{p.tx}px; --ty:{p.ty}px; --d:{p.d}ms"></span>
					{/each}
				</span>
			{:else if kind === 'shimmer'}
				<span class="clip">
					<span class="shimmer"></span>
				</span>
				<span class="origin">
					<span class="tw" style="--tw-x:6px"></span>
					<span class="tw" style="--tw-x:26px"></span>
					<span class="tw" style="--tw-x:46px"></span>
				</span>
			{:else if kind === 'aurora'}
				<span class="clip">
					<span class="aura-bloom"></span>
				</span>
				<span class="origin">
					<span class="orbit"><i></i><i></i></span>
				</span>
			{/if}
		</span>
	{/key}
{/if}

<style>
	.fx {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border-radius: inherit;
		z-index: 4;
	}
	.clip {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: inherit;
	}
	.origin {
		position: absolute;
		left: var(--ax);
		top: var(--ay);
		width: 0;
		height: 0;
	}

	/* Reverse — every particle animation runs backwards, so bursts implode and
	   sweeps retreat. `forwards` fill then holds the *start* frame (scale 0,
	   opacity 0), which is exactly the "sucked in and gone" resting state.
	   Applied to all descendants so new effects inherit it without edits. */
	.fx.reverse :is(span, i) {
		animation-direction: reverse;
	}

	/* ── Sparkle ─────────────────────────────────────────────── */
	.spark {
		position: absolute;
		width: 6px;
		height: 6px;
		margin: -3px;
		background: radial-gradient(
			circle,
			#fff,
			color-mix(in oklab, var(--fx-color) 80%, #fff) 60%,
			transparent 72%
		);
		clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
		transform: translate(0, 0) scale(0);
		opacity: 0;
		animation: spark 0.72s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
		animation-delay: var(--d);
	}
	@keyframes spark {
		0% {
			transform: translate(0, 0) scale(0) rotate(0deg);
			opacity: 0;
		}
		25% {
			opacity: 1;
		}
		60% {
			transform: translate(var(--tx), var(--ty)) scale(var(--s)) rotate(60deg);
			opacity: 1;
		}
		100% {
			transform: translate(calc(var(--tx) * 1.25), calc(var(--ty) * 1.25)) scale(0) rotate(120deg);
			opacity: 0;
		}
	}

	/* ── Firework ────────────────────────────────────────────── */
	.fw-flash {
		position: absolute;
		width: 26px;
		height: 26px;
		margin: -13px;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			#fff,
			color-mix(in oklab, var(--fx-color) 70%, transparent) 45%,
			transparent 70%
		);
		transform: scale(0);
		opacity: 0.9;
		animation: fwFlash 0.5s ease-out forwards;
	}
	@keyframes fwFlash {
		0% {
			transform: scale(0);
			opacity: 0.95;
		}
		100% {
			transform: scale(1.8);
			opacity: 0;
		}
	}
	.fw-spark {
		position: absolute;
		width: 3px;
		height: 3px;
		margin: -1.5px;
		border-radius: 50%;
		background: color-mix(in oklab, var(--fx-color) 60%, #fff);
		box-shadow: 0 0 6px color-mix(in oklab, var(--fx-color) 80%, #fff);
		transform: translate(0, 0);
		opacity: 0;
		animation: fwSpark 0.8s cubic-bezier(0.15, 0.75, 0.25, 1) forwards;
		animation-delay: var(--d);
	}
	@keyframes fwSpark {
		0% {
			transform: translate(0, 0) scale(1);
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		100% {
			transform: translate(var(--tx), var(--ty)) scale(0.4);
			opacity: 0;
		}
	}

	/* ── Shimmer ─────────────────────────────────────────────── */
	.shimmer {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			100deg,
			transparent 20%,
			rgba(255, 255, 255, 0.55) 48%,
			color-mix(in oklab, var(--fx-color) 60%, #fff) 52%,
			transparent 80%
		);
		mix-blend-mode: screen;
		transform: translateX(-120%);
		animation: shimmer 0.85s cubic-bezier(0.3, 0, 0.2, 1) forwards;
	}
	@keyframes shimmer {
		to {
			transform: translateX(120%);
		}
	}
	.tw {
		position: absolute;
		top: 0;
		left: var(--tw-x);
		width: 5px;
		height: 5px;
		margin: -2.5px 0 0 -2.5px;
		background: #fff;
		clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
		opacity: 0;
		transform: scale(0);
		animation: twinkle 0.7s ease-out forwards;
	}
	.tw:nth-child(2) {
		animation-delay: 0.12s;
	}
	.tw:nth-child(3) {
		animation-delay: 0.22s;
	}
	@keyframes twinkle {
		0% {
			opacity: 0;
			transform: scale(0) rotate(0);
		}
		45% {
			opacity: 1;
			transform: scale(1.1) rotate(35deg);
		}
		100% {
			opacity: 0;
			transform: scale(0) rotate(70deg);
		}
	}

	/* ── Aurora Glow ─────────────────────────────────────────── */
	.aura-bloom {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--fx-color) 26%, transparent),
			color-mix(in oklab, #a78bfa 26%, transparent),
			color-mix(in oklab, var(--fx-color) 26%, transparent)
		);
		background-size: 200% 100%;
		opacity: 0;
		transform: translateY(60%);
		animation: aurora 1.1s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
	}
	@keyframes aurora {
		0% {
			opacity: 0;
			transform: translateY(60%);
			background-position: 0% 0;
		}
		35% {
			opacity: 1;
			transform: translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateY(0);
			background-position: 100% 0;
		}
	}
	.orbit {
		position: absolute;
		width: 0;
		height: 0;
	}
	.orbit i {
		position: absolute;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 8px 1px color-mix(in oklab, var(--fx-color) 80%, #fff);
		animation: orbit 1.1s ease-out forwards;
	}
	.orbit i:nth-child(2) {
		animation-delay: 0.15s;
		animation-duration: 1.25s;
	}
	@keyframes orbit {
		0% {
			transform: rotate(0deg) translateX(4px) scale(0.4);
			opacity: 0;
		}
		30% {
			opacity: 1;
		}
		100% {
			transform: rotate(320deg) translateX(15px) scale(0);
			opacity: 0;
		}
	}

	/* Motion is the whole point of this overlay — for a reduced-motion viewer the
	   honest thing is to paint nothing at all rather than flash a 1ms burst. The
	   selection itself is still conveyed by the consumer's active state. */
	@media (prefers-reduced-motion: reduce) {
		.fx {
			display: none;
		}
	}
</style>
