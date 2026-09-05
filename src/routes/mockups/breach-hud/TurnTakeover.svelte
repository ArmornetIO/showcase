<script lang="ts">
	// ── "IT IS YOUR TURN" ────────────────────────────────────────────────────────
	// The one moment the HUD is allowed to shout. It fires on the RISING edge of
	// `isMyTurn` and holds for 900ms, then hands the space back to the sentence
	// that normally lives there.
	//
	// It is mounted INSIDE the breech's centre grid cell, not over the board. A
	// full-screen takeover in a turn-based game is a modal you learn to wait out;
	// this one lands exactly where you are about to look anyway, so the ceremony
	// and the information are in the same place.
	//
	// Nothing here changes any element's layout size — the plate is absolutely
	// positioned inside a cell that is already fixed at two rows. The globe is
	// running a rAF loop underneath and a reflow on this beat is a visible hitch.

	interface Props {
		/** The seat's own colour — the ceremony belongs to whoever it is for. */
		color: string;
		round: number;
		seconds: number;
		/** The strip's own inner fill. The plate must OCCLUDE the row it covers,
		 *  not blend with it: drawn transparent, the headline lands on top of the
		 *  card sentence and the outcome band and all three become unreadable. */
		backing: string;
	}

	let { color, round, seconds, backing }: Props = $props();
</script>

<div
	class="takeover pointer-events-none absolute inset-0 grid place-items-center"
	style:background={backing}
	aria-hidden="true"
>
	<!-- The bracket ticks are gone: nothing else in this game wears them, and a
	     mark that appears once, for 900ms, on the one surface everybody is looking
	     at is the worst place to introduce a shape. The spine says it instead — the
	     same 3px stripe every card on screen uses for "this one is live". -->
	<span class="absolute inset-y-0 left-0 w-[3px]" style:background={color}></span>
	<span class="flex flex-col items-center gap-1">
		<b class="headline font-mono text-[1.25rem] leading-none font-black uppercase" style:color>
			your turn
		</b>
		<span
			class="font-mono text-[0.5rem] leading-none tracking-[0.22em] text-[var(--fg-dim)] uppercase"
		>
			round {round} · {seconds}s
		</span>
	</span>
</div>

<style>
	/* `letter-spacing` animates on the compositor's terms here because the element
	   is absolutely positioned in a fixed cell — it reflows only itself, and
	   nothing downstream can be pushed by it. */
	.takeover {
		animation: takeover-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.headline {
		animation: headline-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes takeover-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes headline-in {
		from {
			letter-spacing: 0.5em;
		}
		to {
			letter-spacing: 0.32em;
		}
	}

	/* The ceremony is the first thing to go: it is pure emphasis, and emphasis
	   delivered as motion is exactly what this query is asking us to stop doing.
	   The plate still appears — the information in it is not decorative. */
	@media (prefers-reduced-motion: reduce) {
		.takeover {
			animation: takeover-fade 120ms linear both;
		}
		.headline {
			animation: none;
			letter-spacing: 0.32em;
		}
		@keyframes takeover-fade {
			from {
				opacity: 0;
			}
			to {
				opacity: 1;
			}
		}
	}
</style>
