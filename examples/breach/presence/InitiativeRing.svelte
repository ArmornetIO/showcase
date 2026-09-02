<script lang="ts">
	// ── Mode: initiative ring ────────────────────────────────────────────────────
	// When they act, as a shape rather than a sentence.
	//
	// BREACH runs R1 → B1 → R2 → B2, which means every player is sandwiched
	// between two enemies and never acts next to their ally. That is a real
	// tactical fact — it is why a red plan has to survive a blue turn in the
	// middle of it — and in a vertical list it is completely invisible. Bent into
	// a ring around the world, it is the first thing you read.
	//
	// The active pip drains with the turn clock, so "whose turn" and "how much of
	// it is left" are one object instead of two. Nothing here is fogged, because
	// nothing here is secret: turn order is fixed and AP is public.
	import { Icon, type IconName } from 'showcase';
	import type { PresenceModel } from '../internal/presence.js';
	import type { StageBox } from './anchors.js';
	import { onCircle } from './seating.js';

	interface Props {
		model: PresenceModel;
		stage: StageBox | null;
	}

	let { model, stage }: Props = $props();

	/** The ring sits just outside the limb, across the TOP arc only — the bottom
	 *  of the screen is the felt, and a pip down there would be competing with
	 *  the player's own hand. */
	const RADIUS = 1.04;
	const angleOf = (i: number) => Math.PI * (1 + (i + 0.5) / model.seats.length);

	const pips = $derived(
		stage
			? model.seats.map((seat, i) => ({
					seat,
					...onCircle(stage.cx, stage.cy, stage.r * RADIUS, angleOf(i))
				}))
			: []
	);

	/** The arc the pips sit on, drawn faintly so the ring reads as one object and
	 *  not four unrelated dots. */
	const track = $derived.by(() => {
		if (!stage || pips.length < 2) return '';
		const r = stage.r * RADIUS;
		const a = onCircle(stage.cx, stage.cy, r, angleOf(0));
		const b = onCircle(stage.cx, stage.cy, r, angleOf(model.seats.length - 1));
		return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
	});

	const R_PIP = 13;
	const CIRC = 2 * Math.PI * (R_PIP + 4);
</script>

{#if stage}
	<svg
		class="absolute inset-0 pointer-events-none"
		width={stage.w}
		height={stage.h}
		aria-hidden="true"
	>
		<path d={track} fill="none" stroke="var(--border)" stroke-width="1" opacity="0.5" />

		{#each pips as { seat, x, y } (seat.key)}
			<g transform="translate({x},{y})" opacity={seat.active ? 1 : 0.68}>
				<!-- The turn clock, wrapped around whoever is spending it. Drawn as a
				     stroke offset rather than an arc path so it drains smoothly at
				     five ticks a second without rebuilding geometry. -->
				{#if seat.active}
					<circle
						r={R_PIP + 4}
						fill="none"
						stroke={seat.color}
						stroke-width="2"
						stroke-linecap="round"
						stroke-dasharray={CIRC}
						stroke-dashoffset={CIRC * (1 - model.clock)}
						transform="rotate(-90)"
						opacity="0.9"
					/>
				{/if}

				<circle
					r={R_PIP}
					fill="color-mix(in srgb, {seat.color} 18%, #04070d)"
					stroke={seat.color}
					stroke-width={seat.active ? 1.6 : 1}
					opacity={seat.relation === 'self' ? 1 : 0.9}
				/>

				<!-- Your own chair gets a ring rather than a different colour: you
				     must be able to find yourself in the order at a glance without
				     the ring growing a second colour language. -->
				{#if seat.relation === 'self'}
					<circle r={R_PIP + 7} fill="none" stroke={seat.color} stroke-width="1" opacity="0.45" />
				{/if}

				<foreignObject x={-8} y={-8} width="16" height="16">
					<div class="flex items-center justify-center w-4 h-4" style:color={seat.color}>
						<Icon name={seat.icon as IconName} size={11} />
					</div>
				</foreignObject>

				<text
					y={R_PIP + 12}
					text-anchor="middle"
					class="font-mono"
					font-size="7.5"
					letter-spacing="1.2"
					fill={seat.active ? seat.color : 'var(--fg-dim)'}
				>
					{seat.seat}
				</text>
			</g>
		{/each}
	</svg>
{/if}
