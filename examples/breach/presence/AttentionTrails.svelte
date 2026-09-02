<script lang="ts">
	// ── Mode: attention trails ───────────────────────────────────────────────────
	// Where their hands keep going back to.
	//
	// Every other mode reports a fact. This one makes you infer one: a seat's
	// recent sightings are dropped on the regions they happened in and joined in
	// order, so over a few rounds you can see that the Hunter has been circling
	// the Foundry, or that the Architect has not left the Commons. Nothing here
	// says what they DID. Pattern is the whole payload.
	//
	// ── Fog ──────────────────────────────────────────────────────────────────────
	// `seat.trail` is derived from the fogged feed and carries territories only,
	// so this mode cannot draw a sighting the viewer has not earned and cannot
	// point at a building even when it has. The traces that could not be
	// attributed do not appear here at all — they are somebody else's mode
	// (`contested`), which is exactly the distinction that keeps "someone was in
	// the Commons" from being rendered as a named seat.
	import type { PresenceModel, SeatPresence } from '../internal/presence.js';
	import type { TerritoryAnchor } from './anchors.js';

	interface Props {
		model: PresenceModel;
		anchors: TerritoryAnchor[];
		width: number;
		height: number;
	}

	let { model, anchors, width, height }: Props = $props();

	/** Each seat keeps the same clock position inside every region, so a trail is
	 *  followable across the board — the Hunter is always at four o'clock. A
	 *  random or packed layout would make the same seat move within a region for
	 *  reasons that are not about the game. */
	function orbit(seat: SeatPresence, a: TerritoryAnchor) {
		const angle = (seat.initiative / model.seats.length) * Math.PI * 2 - Math.PI / 2;
		const r = a.r * 0.46;
		return { x: a.x + Math.cos(angle) * r, y: a.y + Math.sin(angle) * r };
	}

	const trails = $derived(
		model.seats
			.filter((s) => s.trail.length > 0)
			.map((seat) => {
				const points = seat.trail
					.map((t) => {
						const a = anchors.find((x) => x.territory === t.territory);
						return a ? { ...orbit(seat, a), trace: t, facing: a.facing } : null;
					})
					.filter((p): p is NonNullable<typeof p> => !!p);
				return { seat, points };
			})
			.filter((t) => t.points.length > 0)
	);

	/** Newest first in the model, so the path is drawn oldest → newest and reads
	 *  in the direction the seat actually moved. */
	const pathOf = (pts: Array<{ x: number; y: number }>) =>
		pts
			.slice()
			.reverse()
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
			.join(' ');
</script>

<svg class="absolute inset-0 pointer-events-none" {width} {height} aria-hidden="true">
	{#each trails as { seat, points } (seat.key)}
		<g>
			<!-- The drift. Faint on purpose: the marks are the evidence, the line
			     between them is an interpretation and should not shout louder than
			     what it is interpreting. -->
			{#if points.length > 1}
				<path
					d={pathOf(points)}
					fill="none"
					stroke={seat.color}
					stroke-width="1"
					stroke-dasharray="2 4"
					opacity={0.3 * seat.intensity}
					stroke-linecap="round"
				/>
			{/if}

			{#each points as p, i (`${seat.key}-${p.trace.round}-${p.trace.territory}`)}
				{@const o = p.trace.weight * p.facing}
				<!-- Newest sighting is a solid mark; older ones hollow out as they
				     age, so "where they are" and "where they have been" are the same
				     glyph at two strengths rather than two glyphs to learn. -->
				<circle
					cx={p.x}
					cy={p.y}
					r={i === 0 ? 4.5 : 3}
					fill={i === 0 ? seat.color : 'transparent'}
					stroke={seat.color}
					stroke-width="1.2"
					opacity={Math.min(0.95, 0.25 + o)}
				/>
				{#if i === 0 && seat.active}
					<circle
						cx={p.x}
						cy={p.y}
						r="9"
						fill="none"
						stroke={seat.color}
						stroke-width="1"
						opacity={0.5 * p.facing}
					/>
				{/if}
			{/each}

			<!-- Only the head of the trail is labelled. Four seats × eight traces
			     with a caption each is a wall of text on a spinning globe. -->
			{#if points[0]}
				<text
					x={points[0].x + 7}
					y={points[0].y + 3}
					class="font-mono"
					font-size="7"
					letter-spacing="1"
					fill={seat.color}
					opacity={Math.min(0.9, 0.35 + points[0].trace.weight * points[0].facing)}
				>
					{seat.seat}
				</text>
			{/if}
		</g>
	{/each}
</svg>
