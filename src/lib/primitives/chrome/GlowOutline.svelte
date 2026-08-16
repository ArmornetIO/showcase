<script lang="ts">
	import type { Snippet } from 'svelte';

	interface GlowOutlineProps {
		children: Snippet;
		/** Animation speed in seconds per revolution. Default 5s. */
		speed?: number;
	}

	let { children, speed = 5 }: GlowOutlineProps = $props();
</script>

<span class="glow-outline" style="--go-speed:{speed}s">
	{@render children()}
</span>

<style>
	@property --go-angle {
		syntax: '<angle>';
		initial-value: 0deg;
		inherits: false;
	}

	@keyframes go-spin {
		to {
			--go-angle: 360deg;
		}
	}

	.glow-outline {
		position: relative;
		display: inline-flex;
		align-items: center;
		/* 1px padding acts as the border thickness */
		padding: 1px;
		border-radius: 4px;
		background: conic-gradient(
			from var(--go-angle),
			#ff0066,
			#ff6600,
			#ffcc00,
			#00ff88,
			#00aaff,
			#aa00ff,
			#ff0066
		);
		animation: go-spin var(--go-speed, 5s) linear infinite;
		/* soft outer bloom */
		filter: drop-shadow(0 0 4px rgba(120, 80, 255, 0.35))
			drop-shadow(0 0 10px rgba(0, 200, 255, 0.15));
	}

	/* inner fill so only the 1px ring is the gradient */
	.glow-outline::after {
		content: '';
		position: absolute;
		inset: 1px;
		border-radius: 3px;
		background: var(--bg-elev);
		z-index: 0;
		pointer-events: none;
	}

	/* children sit above the mask */
	.glow-outline :global(> *) {
		position: relative;
		z-index: 1;
	}
</style>
