<script lang="ts">
	// One die. It tumbles on random faces and lands on the one the match already
	// rolled — the animation never decides anything, it just takes its time
	// showing you what happened.
	import { PIPS } from '../internal/fx.js';

	interface Props {
		/** The face it will land on. */
		face: number;
		/** Null while the throw is in the air. */
		settled: boolean;
		/** Staggers the two dice so they do not land in lockstep. */
		delay?: number;
		color?: string;
	}

	const { face, settled, delay = 0, color = '#e2e8f0' }: Props = $props();

	let shown = $state(face);

	$effect(() => {
		if (settled) {
			shown = face;
			return;
		}
		const t = setInterval(() => {
			shown = 1 + Math.floor(Math.random() * 6);
		}, 70);
		return () => clearInterval(t);
	});
</script>

<div class="die" class:settled style="--delay:{delay}ms; --ink:{color}">
	<svg viewBox="-1.6 -1.6 3.2 3.2" aria-label="die showing {shown}">
		{#each PIPS[shown] ?? [] as [x, y], i (i)}
			<circle cx={x} cy={y} r="0.2" />
		{/each}
	</svg>
</div>

<style>
	.die {
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 0.9rem;
		background: linear-gradient(155deg, #1b2432, #0b111a);
		border: 1px solid #2c3a4d;
		box-shadow:
			inset 0 1px 0 #3b4c63,
			0 10px 22px rgb(0 0 0 / 0.55);
		display: grid;
		place-items: center;
		animation: tumble 0.42s linear infinite;
		animation-delay: var(--delay);
	}

	.die.settled {
		animation: land 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: var(--delay);
		border-color: color-mix(in srgb, var(--ink) 55%, #2c3a4d);
		box-shadow:
			inset 0 1px 0 #3b4c63,
			0 0 26px color-mix(in srgb, var(--ink) 35%, transparent),
			0 10px 22px rgb(0 0 0 / 0.55);
	}

	svg {
		width: 74%;
		height: 74%;
		fill: var(--ink);
	}

	@keyframes tumble {
		0% {
			transform: translateY(0) rotate(0deg);
		}
		50% {
			transform: translateY(-1.1rem) rotate(160deg);
		}
		100% {
			transform: translateY(0) rotate(360deg);
		}
	}

	@keyframes land {
		0% {
			transform: translateY(-1.4rem) rotate(-24deg) scale(1.12);
		}
		60% {
			transform: translateY(0.16rem) rotate(3deg) scale(0.97);
		}
		100% {
			transform: translateY(0) rotate(0deg) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.die,
		.die.settled {
			animation: none;
		}
	}
</style>
