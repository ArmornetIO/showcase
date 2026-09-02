<script lang="ts">
	// ── The title card ───────────────────────────────────────────────────────────
	// The name of the thing, said once, after the mark has finished forging and
	// before the room exists. A film says its title to the held frame at the end
	// of its cold open, not over the action — so this mounts on `LogoForge`'s
	// `oncomplete` rather than alongside it, and the chrome mark it lands under is
	// still standing there, lit and settled.
	//
	// It does not fade itself out. It says its piece and hands back, and the HOST
	// takes the whole curtain away in one move — mark, room and type together, so
	// the scene leaves as one object rather than dissolving into its parts. The
	// card is on screen for under a second and a half either way: the reader has
	// already watched nine seconds of curtain and is here to open a table.
	//
	// The type sits below the crest rather than over it. Centring it would mean
	// fading the mark to make room, which throws away the frame the forge spent
	// its entire runtime arriving at.

	interface Props {
		/** The card is over. The host cuts to whatever is behind the curtain —
		 *  waiting on this rather than on a duration copied out of the CSS. */
		oncomplete?: () => void;
	}

	let { oncomplete }: Props = $props();

	// Timings, ms. Here and not in the stylesheet because one of them is also the
	// life of the component: the host is cut off at `TOTAL`, and a duration that
	// disagreed with the animation would either clip the type mid-fade or hold a
	// finished card on screen.
	const RULE_AT = 140;
	const WORD_AT = 240;
	const IN_MS = 480;
	const HOLD_MS = 620;
	const TOTAL = WORD_AT + IN_MS + HOLD_MS;

	$effect(() => {
		const id = setTimeout(() => oncomplete?.(), TOTAL);
		return () => clearTimeout(id);
	});
</script>

<div
	class="card"
	style:--in="{IN_MS}ms"
	style:--rule-at="{RULE_AT}ms"
	style:--word-at="{WORD_AT}ms"
>
	<span class="kicker">Welcome to</span>
	<span class="rule"></span>
	<span class="word">Breach</span>
</div>

<style>
	/* Anchored to the bottom of the frame, not to the mark: the crest is rendered
	   at a fixed px size and the card is not, so hanging one off the other puts
	   the type at a different height on every viewport. The scrim underneath is
	   what makes the gap safe — the mark's blurred reflection washes through this
	   band, and unbacked type over it reads as double-exposed. */
	.card {
		position: absolute;
		inset-inline: 0;
		bottom: 11%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.55rem;
		pointer-events: none;
		text-align: center;
	}
	.card::before {
		content: '';
		position: absolute;
		inset: -140% -10% -180%;
		background: radial-gradient(60% 60% at 50% 50%, rgba(3, 5, 10, 0.92), transparent 72%);
		z-index: -1;
	}

	.kicker {
		font-family: var(--mono, ui-monospace, monospace);
		font-size: var(--t-micro, 0.6875rem);
		letter-spacing: 0.42em;
		/* The tracking is applied to the right of every glyph including the last,
		   which walks a centred line off centre by half an em. */
		text-indent: 0.42em;
		text-transform: uppercase;
		color: var(--fg-dim, #97a3aa);
		animation: rise var(--in) cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}

	/* Drawn out from the middle rather than faded in. A rule that appears is a
	   divider; one that opens is the card assembling itself. */
	.rule {
		width: min(320px, 46vw);
		height: 1px;
		background: linear-gradient(
			to right,
			transparent,
			var(--accent, #5eead4) 24%,
			var(--accent, #5eead4) 76%,
			transparent
		);
		opacity: 0.55;
		transform-origin: center;
		animation: open var(--in) cubic-bezier(0.2, 0.7, 0.2, 1) var(--rule-at) both;
	}

	/* The brand sans at its heaviest, NOT `--mono-display`. That token names
	   Orbitron and this app loads no webfont, so it resolves to the monospace
	   fallback — a typewriter title one frame before a screen set in Inter. The
	   weight and the tracking carry the display voice instead. */
	.word {
		font-family: var(--sans-brand, var(--sans, system-ui));
		font-size: clamp(1.7rem, 5.4vw, 3.1rem);
		font-weight: 900;
		text-transform: uppercase;
		color: var(--fg, #e2e8f0);
		text-shadow: 0 0 26px rgba(94, 234, 212, 0.28);
		/* Settles INWARD from wide. Letters arriving at their spacing is the whole
		   gesture of a title; a straight fade is a label appearing. */
		animation: settle var(--in) cubic-bezier(0.16, 0.84, 0.24, 1) var(--word-at) both;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes open {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}
	@keyframes settle {
		from {
			opacity: 0;
			letter-spacing: 0.52em;
			text-indent: 0.52em;
		}
		to {
			opacity: 1;
			letter-spacing: 0.16em;
			text-indent: 0.16em;
		}
	}

	/* The host skips the whole curtain under this preference, so this is a floor
	   and not a policy — it only ever applies to a card somebody mounted anyway. */
	@media (prefers-reduced-motion: reduce) {
		.kicker,
		.rule,
		.word {
			animation-duration: 1ms;
			animation-delay: 0ms;
		}
	}
</style>
