<script lang="ts">
	// ── The hand ─────────────────────────────────────────────────────────────────
	// Fanned on the felt at the bottom of the screen, where a hand of cards goes.
	// Each card is dealt into its slot from the dispenser at the right edge; until
	// it arrives it is parked off-screen with the same transform the transition
	// animates, so the deal costs one CSS property and no keyframes.
	//
	// Click a card to read it. Drag it onto the world to play it — the drop target
	// is a building, which is the whole reason the map is there.
	//
	// Listeners go on the WINDOW rather than on the card, and the pointerdown is
	// prevented. Pointer capture on the card is the tidier-looking version and it
	// loses the drag the moment the browser decides the gesture was a text
	// selection — which, over a card made of text, it will.
	import { cssZoom, type IconName } from 'showcase';
	import { fxFor } from './internal/fx.js';
	import { structureById } from './internal/rules.js';
	import type { BreachMatch } from './internal/match.svelte.js';
	import { DRAG_GHOST_ID, nodeUnder } from './aim.js';
	import CardFace from './CardFace.svelte';

	interface Props {
		match: BreachMatch;
		/** Horizontal spacing between card centres. */
		spread?: number;
		/**
		 * Opens a gap in the middle of the arc, in card-slots. `0` is one
		 * continuous fan; `0.72` parts it wide enough for a character to stand in.
		 */
		split?: number;
		class?: string;
	}

	let { match, spread = 132, split = 0, class: cls = '' }: Props = $props();

	let hoverKey = $state<string | null>(null);

	/** The seat's hand, as instances. Cards come off the deck now, so two copies
	 *  of the same card can be held at once — every read below is by instance,
	 *  and the `{#each}` is keyed on `uid` rather than the card's key. A shared
	 *  key in a keyed each block is not a cosmetic problem in Svelte, it throws. */
	const hand = $derived(match.handOf(match.seat.key));

	/**
	 * Where the ghost is DRAWN, as distinct from where the pointer IS.
	 *
	 * `match.drag` keeps client coordinates because the hit-test needs them —
	 * `elementFromPoint` and every rect it compares against speak that space. The
	 * ghost is a `fixed` element inside this component's subtree, so its `left`
	 * is a layout offset, and under an ancestor `zoom` (the front page shrinks
	 * the whole HUD with one) the two are not the same number: fed client px the
	 * card flew toward the top-left corner, away from the cursor holding it.
	 */
	let fanEl = $state<HTMLDivElement | null>(null);
	let ghostAt = $state({ x: 0, y: 0 });

	function trackGhost(event: PointerEvent) {
		const z = cssZoom(fanEl);
		ghostAt = { x: event.clientX / z, y: event.clientY / z };
	}

	function startDrag(event: PointerEvent, key: string) {
		if (match.busy || match.winner || !match.isMyTurn) return;
		const ability = match.inHand(match.seat.key, key);
		if (!ability || (match.ap[match.seat.key] ?? 0) < ability.ap) return;
		event.preventDefault();
		match.armedKey = key;
		match.drag = { key, x: event.clientX, y: event.clientY, over: null };
		trackGhost(event);
		window.addEventListener('pointermove', moveDrag);
		window.addEventListener('pointerup', endDrag);
		window.addEventListener('pointercancel', endDrag);
	}

	function moveDrag(event: PointerEvent) {
		if (!match.drag) return;
		// The card in flight is under the cursor, so it would always be the hit.
		// Hide it for the probe rather than offsetting the probe — an offset probe
		// aims at somewhere the player is not pointing.
		const ghost = document.getElementById(DRAG_GHOST_ID);
		if (ghost) ghost.style.display = 'none';
		const over = nodeUnder(event.clientX, event.clientY, match.aimIds);
		if (ghost) ghost.style.display = '';
		match.drag = { ...match.drag, x: event.clientX, y: event.clientY, over };
		trackGhost(event);
	}

	function endDrag() {
		window.removeEventListener('pointermove', moveDrag);
		window.removeEventListener('pointerup', endDrag);
		window.removeEventListener('pointercancel', endDrag);
		const flight = match.drag;
		match.drag = null;
		if (!flight) return;
		const ability = match.inHand(match.seat.key, flight.key);
		const target = flight.over ? structureById(flight.over) : null;
		// Dropped on nothing: the card goes back and nothing is spent.
		if (!ability || !target) return;
		if (match.blockedReason(ability, target)?.kind === 'hard') return;
		match.selectedId = target.id;
		// Through `resolve`, never `perform`. `perform` is the local RULES ENGINE;
		// on a networked table the server owns that, and calling it here rolled
		// dice, spent AP and planted a foothold in this browser while the server's
		// board never moved — a phantom breach the next snapshot silently undid.
		// `resolve` is the seam that knows the difference: a request when there is
		// a server, the engine when there is not.
		match.resolve();
	}
</script>

<div bind:this={fanEl} class="absolute inset-x-0 bottom-0 pointer-events-none {cls}">
	{#each hand as card, i (card.uid)}
		<!-- A HandCard is an instance: a uid and a key, not the card itself.
		     Resolving it through the match is also the ownership check. -->
		{@const ability = match.inHand(match.seat.key, card.key)}
		{#if ability}
		{@const count = hand.length}
		{@const raw = i - (count - 1) / 2}
		{@const offset = raw + (raw < 0 ? -split : split)}
		{@const affordable = (match.ap[match.seat.key] ?? 0) >= ability.ap}
		{@const playable = affordable && !match.busy && !match.winner && match.isMyTurn}
		{@const lifted =
			hoverKey === ability.key ||
			match.armedKey === ability.key ||
			match.inspectKey === ability.key}
		{@const dealt = i < match.dealtCount}
		{@const flying = match.drag?.key === ability.key}
		<div
			class="absolute left-1/2 bottom-0 pointer-events-auto select-none touch-none"
			style:transform={dealt
				? `translate(calc(-50% + ${offset * spread}px), ${flying ? 40 : lifted ? -58 : -18}px)
				   rotate(${flying ? 0 : offset * 5}deg)`
				: 'translate(calc(-50% + 62vw), -18px) rotate(220deg)'}
			style:opacity={dealt ? (flying ? 0.25 : 1) : 0}
			style:transition="transform 520ms cubic-bezier(0.16, 0.9, 0.3, 1), opacity 300ms ease-out"
			style:z-index={lifted ? 40 : 10 + i}
			style:cursor={playable ? 'grab' : 'default'}
			onpointerenter={() => (hoverKey = ability.key)}
			onpointerleave={() => (hoverKey = null)}
			onpointerdown={(e) => {
				match.armedKey = ability.key;
				match.inspectKey = ability.key;
				startDrag(e, ability.key);
			}}
			role="button"
			tabindex="0"
			aria-label={ability.name}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') match.inspectKey = ability.key;
			}}
		>
			<CardFace
				{ability}
				fx={fxFor(ability.key, match.seat.faction)}
				seatColor={match.seat.color}
				{affordable}
				disabled={!playable}
				armed={match.armedKey === ability.key}
				raised={lifted}
				icon={fxFor(ability.key, match.seat.faction).icon as IconName}
				skillMod={match.seat.skills[ability.skill]}
			/>
		</div>
		{/if}
	{/each}
</div>

<!-- The card under the cursor. Fixed to the viewport because it has left the
     fan's coordinate space, and id'd because the hit-test has to hide it. -->
{#if match.drag}
	{@const ability = match.inHand(match.seat.key, match.drag!.key)}
	{#if ability}
		<div
			id={DRAG_GHOST_ID}
			class="fixed z-[60] pointer-events-none -translate-x-1/2 -translate-y-1/2"
			style:left="{ghostAt.x}px"
			style:top="{ghostAt.y}px"
		>
			<CardFace
				{ability}
				fx={fxFor(ability.key, match.seat.faction)}
				seatColor={match.seat.color}
				affordable
				disabled={false}
				armed
				raised
				ghost
				icon={fxFor(ability.key, match.seat.faction).icon as IconName}
				skillMod={match.seat.skills[ability.skill]}
			/>
		</div>
	{/if}
{/if}
