<script lang="ts">
	// ── Game events ──────────────────────────────────────────────────────────────
	// A named region of the board's chrome, for things that HAPPEN.
	//
	// The rest of the HUD answers standing questions — who is at the table, how
	// the buildings are doing, what I have to spend. Those panels are always
	// there and always full. An event is the opposite shape: nothing at all for
	// most of a turn, then something loud for three seconds, then nothing again.
	// Mixing the two is what put the entire announcement of a roll into a 0.6rem
	// line at the end of the action bar, because that was the only place with
	// room for something transient.
	//
	// So this column is empty by default and that is correct. It has no frame, no
	// label and no placeholder — an empty box with a heading is a box you learn to
	// stop looking at, and the whole value of the region is that something
	// appearing in it means something just happened.
	//
	// FIRST EVENT TYPE: the verdict. A card resolving — who, what, the dice, and
	// what the dice bought. `match.verdict` is published by `#stage` on the beat
	// clock the board is already animating to, so the panel starts and stops
	// itself.
	//
	// Adding the second type is adding a branch here. The region owns WHERE an
	// event goes and how long it lives; each event type owns what it looks like.
	import type { BreachMatch } from '../internal/match.svelte.js';
	import VerdictCard from './VerdictCard.svelte';

	interface Props {
		match: BreachMatch;
		/**
		 * Present the event as an object that lands on the table, rather than as
		 * the top of a reference column.
		 *
		 * On a narrow window there IS no column — the rails are a drawer, and a
		 * drawer is opened deliberately, between beats. A roll is the loudest
		 * three seconds the game has and it was playing behind a tap nobody had a
		 * reason to make on the beat it happened. So the region keeps its job
		 * (deciding where an event goes) and answers it differently: a small
		 * framed object that lands in a corner of the board, and is gone again on
		 * its own clock.
		 *
		 * A CORNER, and not the centre. Centred it was the size of the panel it
		 * replaced and took the whole board with it — which is the same mistake
		 * as the drawer wearing the opposite costume: the roll is a thing you
		 * catch out of the corner of your eye while you are looking at the board,
		 * not a screen you wait out. The dice stay full size (`terse` drops the
		 * prose instead of scaling them) because they are the part being watched.
		 *
		 * The frame is drawn HERE and not by the caller because it must not exist
		 * when there is no event — an empty bordered box parked on the board is
		 * furniture, and furniture is what the narrow layout is trying to lose.
		 */
		bubble?: boolean;
		class?: string;
	}

	let { match, bubble = false, class: cls = '' }: Props = $props();
</script>

<!-- `pointer-events-none` on the region, not just its contents: the board runs
     underneath this column and stays draggable through the empty space, which is
     most of the space most of the time. -->
{#if bubble}
	{#if match.verdict}
		<!-- Keyed the same way `VerdictCard` keys its own contents, so a second
		     resolution re-throws the bubble instead of morphing the first one's
		     numbers inside a frame that never moved. -->
		{#key match.verdict.id}
			<div class="pointer-events-none {cls}">
				<div class="moment">
					<VerdictCard {match} terse />
				</div>
			</div>
		{/key}
	{/if}
{:else}
	<div class="pointer-events-none flex flex-col items-end gap-2 {cls}">
		{#if match.verdict}
			<VerdictCard {match} />
		{/if}
	</div>
{/if}

<style>
	/* The throw, as a physical arrival: it comes in over the table, overshoots,
	   and settles. Two beats and no more — the card inside is already running a
	   3.2s clock of its own and a frame that is still moving when the dice stop
	   reads as lag rather than as weight. */
	.moment {
		border-radius: 0.9rem;
		border: 1px solid color-mix(in srgb, var(--fg-dim) 30%, transparent);
		background: color-mix(in srgb, var(--bg-elev, #0b0f16) 88%, transparent);
		padding: 0.5rem 0.6rem;
		box-shadow:
			0 16px 40px rgba(0, 0, 0, 0.6),
			inset 0 1px 0 color-mix(in srgb, var(--fg) 8%, transparent);
		backdrop-filter: blur(10px);
		animation: moment-land 420ms cubic-bezier(0.16, 1.2, 0.4, 1) both;
	}

	@keyframes moment-land {
		0% {
			opacity: 0;
			transform: translateY(-18px) scale(0.8);
		}
		62% {
			opacity: 1;
			transform: translateY(3px) scale(1.03);
		}
		100% {
			opacity: 1;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.moment {
			animation: none;
		}
	}
</style>
