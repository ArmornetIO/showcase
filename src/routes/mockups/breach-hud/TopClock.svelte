<script lang="ts">
	// ── THE SCOREBOARD ───────────────────────────────────────────────────────────
	// Round, score, clock — one bar, top centre, in that order.
	//
	// The clock is here because that is where Valorant, CS and every other
	// competitive HUD put the round timer: the one number every player looks up
	// for without being prompted. It started in the right rail at 28px under a
	// heading, which is a perfectly legible place to put a number nobody can find.
	//
	// The score is here because the HUD could not answer "who is winning" at all.
	// It could answer "how many links are held" (right rail), "what is my
	// exposure" (seat plate) and "whose turn is it" (everywhere) — three readings
	// a player has to combine to get the one fact a scoreboard exists to state.
	// So the two sides sit side by side with their banners, the way a scoreboard
	// has always done it, and the leading number is the lit one.
	//
	// The two scores are the SAME five links from opposite ends: what red has
	// taken, and what blue still holds. That is not a presentation trick — it is
	// what `match.standing` already computes for each side, and a scoreboard whose
	// halves are measured in different units is two facts wearing one frame.
	import type { BreachMatch } from '$examples/breach/internal/match.svelte.js';
	import ScoreSplit from './ScoreSplit.svelte';
	import { scoreOf } from './score.js';
	import { CRITICAL_AT, PLATE_SHADOW_UP, plateFill, type HudState } from './hud-state.js';

	interface Props {
		match: BreachMatch;
		state: HudState;
	}

	let { match, state }: Props = $props();

	const running = $derived(match.stage === 'play' && !match.winner);
	const frac = $derived(match.turnLeft / match.turnMs);
	const critical = $derived(match.isMyTurn && frac <= CRITICAL_AT);
	const secs = $derived(running ? Math.ceil(match.turnLeft / 1000) : 0);

	const score = $derived(scoreOf(match));
</script>

<!-- 480px is the strip below it: the clock, the score and the four seat chips are
     one object at the top of the screen, and two plates that nearly line up read
     as a mistake in a way two that do not line up at all never would. -->
<div class="pointer-events-auto flex w-[480px] flex-col gap-1.5">
	<div
		class="relative flex items-stretch gap-3 overflow-hidden rounded-[10px] border px-3 py-1.5"
		style:border-color={running
			? `color-mix(in srgb, ${state.color} 70%, transparent)`
			: 'var(--border)'}
		style:background={plateFill(state.color)}
		style:box-shadow="inset 3px 0 0 0 {state.color}, 0 0 0 1px color-mix(in srgb, {state.color} 35%, transparent), {PLATE_SHADOW_UP}"
	>
		<!-- ── Round ─────────────────────────────────────────────────────────────
		     It was a caption line floating above the plate, which is where you put
		     a label, not a number — and this one is the horizon the whole match is
		     racing: blue wins by reaching it. Big, left, captioned underneath. -->
		<div class="flex w-[54px] shrink-0 flex-col items-center justify-center gap-1">
			<span class="flex items-baseline gap-0.5 leading-none">
				<b class="font-mono text-[1.5rem] leading-none font-black tabular-nums text-[var(--fg)]">
					{match.round}
				</b>
				<span class="font-mono text-[0.75rem] leading-none font-bold tabular-nums text-[var(--fg-muted)]">
					/{match.rounds}
				</span>
			</span>
			<span class="font-mono text-[0.5rem] leading-none tracking-[0.22em] text-[var(--fg-dim)] uppercase">
				round
			</span>
		</div>

		<span class="w-px shrink-0 self-stretch bg-[var(--border)]"></span>

		<!-- ── The score ─────────────────────────────────────────────────────── -->
		<ScoreSplit {score} />

		<span class="w-px shrink-0 self-stretch bg-[var(--border)]"></span>

		<!-- ── The seconds ───────────────────────────────────────────────────── -->
		<div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
			<div class="flex items-baseline gap-2">
				<b
					class="font-mono text-[2rem] leading-none font-black tabular-nums"
					class:pulse={critical}
					style:color={running ? state.color : 'var(--fg-muted)'}
					style:letter-spacing="-0.03em"
					style:text-shadow="0 0 22px color-mix(in srgb, {state.color} 45%, transparent)"
					style:opacity={match.busy ? 0.45 : 1}
				>
					{running ? String(secs).padStart(2, '0') : '--'}
				</b>
				<span
					class="min-w-0 flex-1 truncate text-right font-mono text-[0.5rem] tracking-[0.22em] text-[var(--fg-dim)] uppercase"
				>
					{match.busy ? 'resolving' : match.isMyTurn ? 'your turn' : `${match.activeKlass.name} up`}
				</span>
			</div>

			<!-- The drain, directly under the number it belongs to. Full width so the
			     emptying is legible peripherally — which is the only way anyone reads
			     a timer they are not currently staring at. -->
			<span
				class="block h-[5px] w-full overflow-hidden bg-[var(--surface-strong)]"
				style:clip-path="polygon(3px 0, 100% 0, calc(100% - 3px) 100%, 0 100%)"
			>
				<span
					class="block h-full"
					style:width="{Math.round((running ? Math.max(0, frac) : 0) * 100)}%"
					style:background={state.color}
					style:opacity={match.busy ? 0.4 : 1}
					style:transition="width 200ms linear"
				></span>
			</span>
		</div>
	</div>
</div>

<style>
	.pulse {
		animation: pulse-scale 500ms ease-in-out infinite;
	}
	@keyframes pulse-scale {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.07);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
		}
	}
</style>
