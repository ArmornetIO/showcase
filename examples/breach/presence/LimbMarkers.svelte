<script lang="ts">
	// ── Mode: standing at the limb ───────────────────────────────────────────────
	// The other three, standing around the world you are all looking at.
	//
	// Red takes the left limb, blue the right, and you are already at the bottom
	// on the dais — so the table has a geometry, and "the Hunter is over there"
	// becomes a direction instead of a row in a list. When a seat acts, their
	// marker leans in and a line reaches from them to the REGION they touched.
	//
	// ── Fog ──────────────────────────────────────────────────────────────────────
	// The reach-line is the whole risk of this mode and it is handled upstream:
	// `seat.focus` is already the fogged answer, so a line only exists for an
	// action this seat may attribute. A red seat working quietly gives blue no
	// line at all — the marker just sits there, and the not-knowing is the point.
	// The line also terminates on a territory anchor, never a building, so even a
	// visible action does not point at the structure.
	import { Icon, type IconName } from 'showcase';
	import type { PresenceModel, SeatPresence } from '../internal/presence.js';
	import type { StageBox, TerritoryAnchor } from './anchors.js';
	import { limbAngle, onCircle } from './seating.js';

	interface Props {
		model: PresenceModel;
		stage: StageBox | null;
		anchors: TerritoryAnchor[];
	}

	let { model, stage, anchors }: Props = $props();

	/** Just outside the limb, and a little further out when idle — a seat that
	 *  acts leans IN, which is the only motion in this mode and so has to be the
	 *  one that means something. */
	const restR = 1.2;
	const leanR = 1.1;

	const marks = $derived.by(() => {
		if (!stage) return [];
		const others = model.seats.filter((s) => s.relation !== 'self');
		return others.map((seat) => {
			const angle = limbAngle(seat, model.seats);
			const lean = seat.active ? leanR : restR - 0.03 * seat.intensity;
			const at = onCircle(stage.cx, stage.cy, stage.r * lean, angle);
			const target = seat.focus ? anchors.find((a) => a.territory === seat.focus) : undefined;
			return { seat, angle, ...at, target };
		});
	});

	/** A reach-line is drawn with a slight bow so two seats reaching into the
	 *  same region do not overlay each other into one thick stripe. */
	function reach(x: number, y: number, t: TerritoryAnchor, bend: number) {
		const mx = (x + t.x) / 2;
		const my = (y + t.y) / 2;
		// Perpendicular offset, signed per seat.
		const dx = t.x - x;
		const dy = t.y - y;
		const len = Math.hypot(dx, dy) || 1;
		return `M ${x} ${y} Q ${mx - (dy / len) * bend} ${my + (dx / len) * bend} ${t.x} ${t.y}`;
	}

	/** How loud a reach-line is. Recency does most of the work, so an old sighting
	 *  is a ghost of a line and this round's is a statement. */
	const lineOpacity = (seat: SeatPresence, a: TerritoryAnchor) =>
		Math.min(0.75, seat.intensity * a.facing * (seat.active ? 1 : 0.7));
</script>

{#if stage}
	<svg
		class="absolute inset-0 pointer-events-none"
		width={stage.w}
		height={stage.h}
		aria-hidden="true"
	>
		<!-- Lines first, so a marker always sits on top of its own reach. -->
		{#each marks as { seat, x, y, target }, i (seat.key)}
			{#if target}
				<path
					d={reach(x, y, target, (i % 2 === 0 ? 1 : -1) * 26)}
					fill="none"
					stroke={seat.color}
					stroke-width={seat.active ? 1.6 : 1}
					stroke-dasharray={seat.active ? 'none' : '3 5'}
					opacity={lineOpacity(seat, target)}
					stroke-linecap="round"
				/>
				<!-- The landing. A ring on the region, sized to the region, so it
				     reads as "into there" rather than "at that point". -->
				<circle
					cx={target.x}
					cy={target.y}
					r={target.r * 0.5}
					fill="none"
					stroke={seat.color}
					stroke-width="1"
					stroke-dasharray="2 6"
					opacity={lineOpacity(seat, target) * 0.7}
				/>
			{/if}
		{/each}

		{#each marks as { seat, x, y } (seat.key)}
			{@const enemy = seat.relation === 'enemy'}
			<g transform="translate({x},{y})">
				{#if seat.active}
					<circle r="21" fill="none" stroke={seat.color} stroke-width="1" opacity="0.35" />
				{/if}

				<!-- Ally and enemy are the same badge in different clothes: a filled
				     body for the person beside you, a hollow one for the person
				     across from you. Shape carries it, colour confirms it. -->
				<circle
					r="14"
					fill={enemy ? '#04070d' : `color-mix(in srgb, ${seat.color} 26%, #04070d)`}
					stroke={seat.color}
					stroke-width={seat.active ? 1.8 : 1.1}
					opacity={0.55 + 0.45 * seat.intensity}
				/>

				<foreignObject x={-9} y={-9} width="18" height="18">
					<div class="flex items-center justify-center w-[18px] h-[18px]" style:color={seat.color}>
						<Icon name={seat.icon as IconName} size={12} />
					</div>
				</foreignObject>

				<text
					y="25"
					text-anchor="middle"
					class="font-mono"
					font-size="7.5"
					letter-spacing="1.2"
					fill={seat.active ? seat.color : 'var(--fg-dim)'}
				>
					{seat.seat}
				</text>

				<!-- Gone quiet. An enemy you have not seen for a while is the most
				     dangerous object on the board and should not look like an empty
				     slot, so the silence is labelled rather than left blank. -->
				{#if seat.quietFor === null || seat.quietFor >= 2}
					<text
						y="34"
						text-anchor="middle"
						class="font-mono"
						font-size="6"
						letter-spacing="1"
						fill="var(--fg-dim)"
						opacity="0.75"
					>
						{seat.quietFor === null ? 'unseen' : `quiet ${seat.quietFor}r`}
					</text>
				{/if}
			</g>
		{/each}
	</svg>
{/if}
