<script lang="ts">
	// ── WHEN THE LEAD CHANGES ────────────────────────────────────────────────────
	// The scoreboard shows who is ahead; it cannot show that it just STOPPED being
	// the other side. A number that quietly ticks from 2 to 3 is the single most
	// consequential event in a match arriving with less ceremony than a card being
	// picked up.
	//
	// It lands where consequences already land — at the top of the battle log, in
	// the log's own row: crest well on the left, headline and detail on a plate to
	// the right, outcome stripe down the edge. A new visual language for the one
	// event that matters most would be the worst place to introduce one, and the
	// player has already learned to look here when something happens.
	//
	// The crest holds the team's emblem rather than a portrait, because a lead is
	// the one thing on this feed that belongs to a SIDE and not to a person.
	import { EMBLEMS, teamFlags } from './team-flags.svelte.js';
	import type { Faction } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';
	import { scoreOf } from './score.js';

	interface Props {
		match: BreachMatch;
		/** How long the card holds. Matches the objective line's announcement so
		 *  two banners fired by the same link do not outlive each other. */
		hold?: number;
	}

	let { match, hold = 4200 }: Props = $props();

	const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

	// `seen` is a PLAIN let, not `$state`, and that is load-bearing: this effect
	// reads the leader and writes the card, and a reactive marker read here would
	// subscribe the effect to its own output — the shape that takes a Svelte
	// client down with `effect_update_depth_exceeded`. Same trick, same reason, as
	// the objective line's announcement.
	let seen: Faction | null | undefined = undefined;
	let card = $state<{ faction: Faction; taken: number; held: number; round: number } | null>(null);

	$effect(() => {
		const { taken, held, leader } = scoreOf(match);
		// The first read is the state of the world, not a change in it — and a
		// slide back to level is a lead LOST, which the surviving scoreboard says
		// perfectly well on its own.
		if (seen === undefined || leader === seen || leader === null) {
			seen = leader;
			return;
		}
		const took = leader;
		seen = leader;
		card = { faction: took, taken, held, round: match.round };
		const id = setTimeout(() => (card = null), hold);
		return () => clearTimeout(id);
	});
</script>

{#if card}
	{@const flag = teamFlags.get(card.faction)}
	{@const em = EMBLEMS[flag.emblem]}
	<div
		class="lead-in relative flex items-stretch gap-2 overflow-hidden rounded-[10px] border py-1.5 pr-1.5 pl-2"
		style:border-color="color-mix(in srgb, {flag.color} 78%, transparent)"
		style:background="radial-gradient(120% 120% at 14% 30%,
			color-mix(in srgb, {flag.color} 26%, var(--bg-elev, #0b0f16)) 0%,
			var(--bg-elev, #0b0f16) 64%)"
		style:box-shadow="0 0 0 1px color-mix(in srgb, {flag.color} 40%, transparent), 0 14px 30px rgba(0,0,0,0.55)"
		role="status"
	>
		<span class="absolute inset-y-0 left-0 w-[3px]" style:background={flag.color}></span>

		<!-- The crest well, at the feed's size, with the banner in it. -->
		<div class="relative w-[68px] shrink-0 self-center">
			<span
				class="absolute inset-x-[9px] inset-y-0 opacity-50 blur-[10px]"
				style:background={flag.color}
				style:clip-path={HEX}
			></span>
			<div
				class="relative mx-auto grid h-[56px] w-[50px] place-items-center p-[1.5px]"
				style:clip-path={HEX}
				style:background="color-mix(in srgb, {flag.color} 70%, transparent)"
			>
				<div
					class="grid h-full w-full place-items-center"
					style:clip-path={HEX}
					style:background="color-mix(in srgb, {flag.color} 16%, var(--bg-elev, #0b0f16))"
				>
					<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
						<path
							d={em.d}
							fill={em.fill ? flag.color : 'none'}
							stroke={flag.color}
							stroke-width={em.fill ? 0 : 3}
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</div>
			</div>

			<!-- The round it happened on, in the feed's cost-gem corner. -->
			<span
				class="absolute -top-0.5 left-[1px] z-10 grid h-[19px] w-[19px] place-items-center rounded-full border-2 font-mono text-[0.56rem] font-black tabular-nums"
				style:color={flag.color}
				style:border-color="color-mix(in srgb, {flag.color} 60%, transparent)"
				style:background="color-mix(in srgb, {flag.color} 26%, var(--bg-elev, #0b0f16))"
			>
				{card.round}
			</span>

			<span
				class="mt-1 block text-center font-mono text-[0.6875rem] leading-[1.15] font-black tracking-[0.06em] text-[var(--fg)] uppercase"
			>
				lead
			</span>
		</div>

		<div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
			<div class="flex min-w-0 items-baseline gap-1.5">
				<span
					class="truncate font-mono text-[0.58rem] leading-none font-black"
					style:color={flag.color}
				>
					{flag.name}
				</span>
				<span class="flex-1"></span>
				<!-- The score at the moment it turned over, filled, where a feed row
				     puts its verdict. -->
				<span
					class="grid h-[15px] place-items-center rounded-full px-1.5 font-mono text-[0.44rem] leading-none font-black tracking-[0.12em] tabular-nums"
					style:color="var(--bg-elev, #0b0f16)"
					style:background={flag.color}
					style:box-shadow="0 0 10px color-mix(in srgb, {flag.color} 55%, transparent)"
				>
					{card.taken} – {card.held}
				</span>
			</div>
			<b
				class="font-mono text-[0.62rem] leading-none font-black tracking-[0.12em] uppercase"
				style:color="var(--fg)"
			>
				takes the lead
			</b>
			<span class="font-mono text-[0.5rem] font-black tracking-[0.12em] text-[var(--fg)] uppercase">
				{card.faction === 'red' ? 'links taken' : 'links held'} · {card.faction === 'red'
					? card.taken
					: card.held} of 5
			</span>
		</div>
	</div>
{/if}

<style>
	/* Arrives, it does not appear. The feed's rows slide under each other on a
	   lift; this one drops in from above the column it is heading. */
	.lead-in {
		animation: lead-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	@keyframes lead-in {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.lead-in {
			animation: none;
		}
	}
</style>
