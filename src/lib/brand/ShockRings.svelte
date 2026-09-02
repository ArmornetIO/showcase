<script lang="ts">
	// ── Rings off a point ────────────────────────────────────────────────────────
	// A shock leaving a place, or falling into one. Three near-identical blocks of
	// ring maths lived inline in the forge scene — the hub's pulse, the
	// detonation, and the one ring that travels the other way — and they differed
	// only in numbers. This is the one of them.
	//
	// Two rules are worth keeping when you tune it. A single expanding circle
	// reads as a ripple in a pond, so a shock wants COUNT above one and a stagger
	// between them. And the stroke thins as the ring fades, because a shock
	// dissipates; hold the width and it reads as a hoop being drawn.
	//
	// Time is passed in as ms SINCE THE EVENT, not as a scene clock. A host that
	// can scrub therefore gets a scrubbable shock for free, and a host that fires
	// one on an interaction passes `now - firedAt`.
	import { clamp01, outCubic } from './nanite.js';

	interface Props {
		/** Rendered width, px. Coordinates are the forged cut's 200×220 box. */
		size?: number;
		/** The point the rings leave from, in box units. */
		cx: number;
		cy: number;
		/** Ms since the event. Before 0 and after the last ring lands, nothing
		 *  renders. */
		t: number;
		/** Which way. `out` is a shock; `in` is the one thing in a collapse that
		 *  travels toward the middle, which is why it reads at all. */
		direction?: 'out' | 'in';
		count?: number;
		/** Ms between rings — one number for an even pulse, or one per ring when
		 *  the spacing itself should be uneven (which is what turns a pulse into a
		 *  detonation). */
		stagger?: number | number[];
		/** How long one ring takes to travel `reach`. */
		duration?: number;
		/** Start radius and travel, box units. */
		from?: number;
		reach?: number;
		/** `quint` is a hit — full speed on the first frame. `cubic` is a shove. */
		ease?: 'quint' | 'cubic';
		/** Peak opacity, and how sharply it falls off. A high `tail` puts the whole
		 *  ring's life in its first third, which is what a blast looks like. */
		peak?: number;
		tail?: number;
		/** Stroke width as `[base, gain]` — `base + gain × opacity`. */
		width?: [number, number];
		color?: string;
		/** The first ring's colour, when the leading edge of a detonation should be
		 *  hotter than what follows it. */
		leadColor?: string;
		/** Screen-blend, for a shock that has to stay bright over what it crosses. */
		blend?: boolean;
		/** Px to lift the artboard by, so the rings are centred on the same point
		 *  every other layer in the scene is registered against. */
		offsetY?: number;
	}

	let {
		size = 470,
		cx,
		cy,
		t,
		direction = 'out',
		count = 3,
		stagger = 190,
		duration = 900,
		from = 4,
		reach = 210,
		ease = 'cubic',
		peak = 0.5,
		tail = 1,
		width = [1, 3],
		color = 'var(--accent)',
		leadColor,
		blend = false,
		offsetY = 0
	}: Props = $props();

	/** Violent out. `outCubic` is a shove; this is a hit. */
	const outQuint = (x: number) => 1 - Math.pow(1 - x, 5);

	const rings = $derived.by(() => {
		const curve = ease === 'quint' ? outQuint : outCubic;
		const offs = Array.isArray(stagger)
			? stagger.slice(0, count)
			: Array.from({ length: count }, (_, i) => i * stagger);
		return offs.map((off) => {
			const p = clamp01((t - off) / duration);
			if (p <= 0 || p >= 1) return { r: 0, o: 0 };
			// Inward, the ring ARRIVES on the frame the thing it is chasing does, so
			// its radius runs from `reach` to nothing and its opacity climbs as it
			// closes — a ring that faded on the way in would be gone before it got
			// anywhere. 1.6 is the collapse's own curve; matched, so the ring and
			// what it is falling onto reach the middle together.
			if (direction === 'in') return { r: from + Math.pow(1 - p, 1.6) * reach, o: peak * p };
			return { r: from + curve(p) * reach, o: Math.pow(1 - p, tail) * peak };
		});
	});

	const live = $derived(rings.some((r) => r.o > 0.002));
</script>

{#if live}
	<!-- `overflow: visible` and a viewBox that is only the artboard: a shock that
	     is clipped at the mark's own bounds is a disc, and a disc is the one shape
	     this must not draw. -->
	<svg
		class="shock"
		style:--dy="{offsetY}px"
		width={size}
		height={size}
		viewBox="0 0 200 220"
		aria-hidden="true"
	>
		{#each rings as s, i (i)}
			{#if s.o > 0.002}
				<circle
					{cx}
					{cy}
					r={s.r}
					fill="none"
					stroke={i === 0 && leadColor ? leadColor : color}
					stroke-width={width[0] + width[1] * s.o}
					opacity={s.o}
					style={blend ? 'mix-blend-mode: screen' : undefined}
				/>
			{/if}
		{/each}
	</svg>
{/if}

<style>
	.shock {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%) translateY(calc(-1 * var(--dy, 0px)));
		pointer-events: none;
		overflow: visible;
	}
</style>
