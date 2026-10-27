<script lang="ts">
	// ── A rank ───────────────────────────────────────────────────────────────
	// One side of the versus screen: its seats, standing in a row, each drawn as
	// the person sitting in it rather than as the character they were dealt.
	//
	// Every figure here comes from `resolve(lookAt(seat), …)` — the seat's own
	// appearance plus the role badge pinned on from the seat's klass and side.
	// That is the whole split working: the body, the hat and every colour are
	// the player's, and the one thing that says which side they are on is the
	// one thing they cannot touch.
	//
	// It is also why this component can draw three people whose outfitters this
	// client will never run. Nothing here reads the local editor.
	import { DEFAULT_ART, Figure } from 'showcase';
	import { resolve } from '../internal/appearance.js';
	import { SIDE_TONE } from '../internal/badge.js';
	import { PLATE_SHADOW_UP, plateFill } from '../hud/hud-state.js';
	import Handle from './Handle.svelte';
	import type { BreachLobby, LobbySeat } from '../internal/lobby.svelte.js';
	import type { Faction } from '../internal/rules.js';

	interface Props {
		lobby: BreachLobby;
		seats: LobbySeat[];
		side: Faction;
		/** Blue stands facing red. Flipping the row rather than the figures keeps
		 *  every face pointing into the middle without a second camera. */
		mirrored?: boolean;
	}

	let { lobby, seats, side, mirrored = false }: Props = $props();

	const tone = $derived(SIDE_TONE[side]);

	/**
	 * Which way this rank is looking.
	 *
	 * Turning the CAMERA rather than flipping the rendered row, because a
	 * mirrored figure is a figure whose badge is mirrored too — and a mark that
	 * reads backwards on one side of the screen is the one thing this whole
	 * scheme cannot afford. Negating the default yaw turns the model in world
	 * space, so both ranks face the middle and every mark still reads forwards.
	 */
	const yaw = $derived(mirrored ? -DEFAULT_ART.yaw : DEFAULT_ART.yaw);

	function figureFor(seat: LobbySeat) {
		const name = seat.occupant.kind === 'open' ? 'Open' : seat.occupant.name;
		return resolve(lobby.lookAt(seat.id), { key: seat.id, name }, seat.klassKey, seat.side);
	}
</script>

<div class="rank" class:mirrored style:--sc={tone} style:--dais-shadow={PLATE_SHADOW_UP}>
	{#each seats as seat (seat.id)}
		{@const you = seat.id === lobby.youSeatId}
		{@const empty = seat.occupant.kind === 'open'}
		{@const f = figureFor(seat)}
		{@const klass = lobby.klassAt(seat.id)}
		{@const clock = lobby.draftSeatId === seat.id}

		<div class="seat" class:you class:empty class:clock>
			<div class="body">
				{#if empty}
					<!-- An empty chair is drawn as an empty chair. A ghosted figure
					     standing in for nobody reads as a player who has arrived.
					     Nothing stands here, so this is the one seat whose ground is
					     drawn by the page rather than by the figure. -->
					<span class="vacant"></span>
					<span class="dais" style:background={plateFill(tone, 8)}></span>
				{:else}
					<!-- The platform is the FIGURE's, not the seat's. Drawn here as an
					     ellipse under the element it landed under the frame's swing
					     margin instead of under the boots, and every player in the
					     line-up hovered a finger's width above their own ground. -->
					<Figure klass={f.skin} crop="hero" shadow ground={tone} art={{ ...f.art, yaw }} />
				{/if}
			</div>

			<div class="plate">
				{#if you}
					<!-- Read-only: renaming moved to the footer, where the screen
					     keeps the things that are yours to change. -->
					<Handle readonly />
				{:else}
					<span class="name">{empty ? 'open' : f.skin.name}</span>
				{/if}
				{#if klass}
					<span class="role">{klass.name}</span>
				{:else if !empty}
					<span class="role pending">no role yet</span>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	/* Both ranks crowd the middle, where the VS is. Pushed to the outer edges
	   they are two separate groups on one screen; pulled in they are a
	   confrontation, which is the only reason to arrange them this way. */
	.rank {
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		gap: 4px;
		min-height: 0;
		height: 100%;
	}
	.rank.mirrored {
		justify-content: flex-start;
	}

	/* `align-content: end` rather than a full-height row: the highlight has to
	   hug the person, and a seat stretched to the rank's height draws a tall
	   empty box above somebody's head. Everyone stands ON the same line, which
	   is what makes a line-up read as one. */
	.seat {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		align-content: end;
		gap: 6px;
		flex: 1 1 0;
		min-width: 0;
		max-width: 420px;
		max-height: 100%;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
	}

	.seat.empty {
		opacity: 0.55;
	}
	@media (prefers-reduced-motion: reduce) {
		.seat.clock {
			animation: none;
		}
	}

	.body {
		position: relative;
		display: grid;
		place-items: end center;
		min-height: 0;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
	}
	/* Only the empty seat's ground is a box under the element, so only it needs
	   the room reserved. A figure's platform is inside its own frame. */
	.seat.empty .body {
		padding-bottom: 14px;
	}
	.vacant {
		width: 64px;
		height: 64px;
		border: 1px dashed color-mix(in srgb, var(--sc) 45%, transparent);
		border-radius: 50%;
	}

	/* An ellipse, not a rectangle: the figures are lit from above in a dark
	   room, so the ground under one reads as a pool rather than a slab. */
	.dais {
		position: absolute;
		bottom: 0;
		left: 50%;
		translate: -50% 0;
		width: min(86%, 150px);
		height: 26px;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--sc) 40%, transparent);
		box-shadow: var(--dais-shadow);
		pointer-events: none;
	}
	/* On the clock in a draft. A pulse rather than a badge: everybody at the
	   table is looking at the figures, so the figure is where the clock goes.
	   On the whole body, because the ground moved inside the figure's own frame
	   and a halo around the silhouette is the same signal without reaching
	   through a component to animate one of its ellipses. */
	.seat.clock .body {
		animation: breathe 1.6s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			filter: drop-shadow(0 0 14px color-mix(in srgb, var(--sc) 60%, transparent));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.seat.clock .body {
			animation: none;
		}
	}

	/* The only thing that marks your own figure. An outline around the body was
	   a box drawn around a person — this is a nameplate that lights up, which is
	   the same signal without the cage. */
	.plate {
		display: grid;
		gap: 1px;
		justify-items: center;
		text-align: center;
		padding: 5px 8px;
		border: 1px solid transparent;
		border-radius: 6px;
		/* Fixed, so a two-line plate and a one-line "open" push their figures
		   down by the same amount. Without it the rank stands on a staircase. */
		min-height: 34px;
		align-content: start;
	}
	.seat.you .plate {
		border-color: color-mix(in srgb, var(--sc) 55%, transparent);
		background: color-mix(in srgb, var(--sc) 12%, transparent);
	}
	.name {
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.role {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--sc);
	}
	.role.pending {
		color: var(--fg-dim);
	}
</style>
