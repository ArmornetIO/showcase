<script lang="ts">
	// Seats, REPORTED. Four pips in initiative order; yours lights when you take
	// a side, and none of them is ever a button — that is the whole thesis of
	// the new flow. It doubles as the fill gauge: an unlit pip is a chair the
	// table is still waiting on.
	import type { BreachLobby } from '../internal/lobby.svelte.js';
	import { SIDES } from './sides.js';

	let { lobby }: { lobby: BreachLobby } = $props();
</script>

<div class="order" aria-label="Initiative order">
	{#each lobby.seats as seat (seat.id)}
		{@const k = lobby.klassAt(seat.id)}
		<div
			class="pip"
			class:live={seat.occupant.kind !== 'open'}
			class:you={seat.id === lobby.youSeatId}
			class:bot={seat.occupant.kind === 'ai'}
			style:--pipc={k ? k.color : SIDES[seat.side].tone}
			title={seat.occupant.kind === 'open' ? 'open' : seat.id}
		>
			<span>{seat.id}</span>
		</div>
	{/each}
	<span class="hint">turn order</span>
</div>

<style>
	.order {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.pip {
		width: 40px;
		height: 26px;
		display: grid;
		place-items: center;
		border-radius: 5px;
		border: 1px dashed rgb(255 255 255 / 0.12);
		background: transparent;
		transition: all 0.25s;
	}
	.pip.live {
		border-style: solid;
		border-color: color-mix(in srgb, var(--pipc) 65%, transparent);
		background: color-mix(in srgb, var(--pipc) 16%, transparent);
	}
	.pip.bot {
		border-style: dotted;
	}
	.pip.you {
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--pipc) 55%, transparent);
	}
	.pip span {
		font-family: ui-monospace, monospace;
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--pipc);
	}
	.pip:not(.live) span {
		color: #475569;
	}
	.hint {
		font-size: 0.5rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #475569;
		margin-left: 0.5rem;
	}
</style>
