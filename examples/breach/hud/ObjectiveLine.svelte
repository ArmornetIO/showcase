<script lang="ts">
	// ── The objective line ───────────────────────────────────────────────────────
	// What YOUR side is trying to do, and how far along it is.
	//
	// It used to be a score — "0/5 held — next is Maintainer Circle" — which is the
	// state of the path rather than an objective: it says where the game IS and
	// leaves the player to work out what to do about it. The two seats are also not
	// playing the same game, so one line written from red's point of view left blue
	// reading somebody else's scoreboard.
	//
	//   RED   a SET to collect. Four links in any order, then the payload. The
	//         count is the objective, because there is no prescribed next.
	//   BLUE  a CLOCK to survive. The same five marks, counting what blue can
	//         PROVE rather than what red holds, led by the horizon — blue does not
	//         win by taking anything, it wins by the round counter running out.
	//
	// ── No steps ─────────────────────────────────────────────────────────────────
	// This deliberately does NOT say "step 2 of 5, take The Archive next". The
	// ordering rule is gone: every link is open whenever, and only the payload is
	// gated (on holding the other four). Numbering the objectives would reinstate
	// in the HUD the exact constraint the rules removed — the player would read a
	// queue and play a queue, which is the thing that left red with one legal
	// target and blue with one place to defend.
	//
	// What survives of order is an INCENTIVE, not a sequence: holding the link
	// before a target is worth +1..+5 on the roll. That belongs on the building it
	// applies to — the buildings column shows it as `+n leverage` — and not up
	// here, where it would read as an instruction.
	import { CHAIN } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		class?: string;
	}

	let { match, class: cls = '' }: Props = $props();

	const red = $derived(match.seat.faction === 'red');

	// Red counts what it holds; blue counts what it can prove. The gap between
	// those two numbers is the whole game, which is why neither seat is ever shown
	// the other's figure.
	const done = $derived(red ? match.chainHeld : match.chainShown);
	const held = $derived(done.length);
	const left = $derived(Math.max(0, match.rounds - match.round));

	/** The links still needed before the payload is even attemptable. The payload
	 *  itself is excluded — it is the delivery, not a prerequisite for itself. */
	const linksLeft = $derived(
		CHAIN.filter(
			(s) => s.chain !== CHAIN.length && !match.chainHeld.some((h) => h.id === s.id)
		).length
	);

	// The ramp reads as stakes rather than as danger, which is what lets one scale
	// serve both seats: a nearly-complete chain is the loudest thing on the board
	// whichever side of it you are on.
	const tone = $derived(held >= 4 ? '#FB7185' : held >= 2 ? '#FBBF24' : '#34D399');
	const winTone = $derived(match.winner === 'red' ? '#FB7185' : '#34D399');

	// ── When a link goes ─────────────────────────────────────────────────────
	// A building changing hands is the biggest single event in a match, and it
	// used to arrive as a digit quietly incrementing. This is the announcement.
	//
	// `seen` is a PLAIN let, not `$state`, and that is load-bearing: this effect
	// reads the count and writes the banner, and a reactive marker read here would
	// subscribe the effect to its own output — the shape that takes a Svelte
	// client down with `effect_update_depth_exceeded`.
	let seen = -1;
	let announce = $state<{ n: number; name: string; payload: boolean } | null>(null);

	$effect(() => {
		const n = held;
		const taken = done[n - 1];
		// The first run is not an advance, and neither is a new match winding the
		// count back to zero — either would fire a banner for a building nobody
		// just took.
		if (seen < 0 || n <= seen) {
			seen = n;
			return;
		}
		seen = n;
		if (!taken) return;
		announce = { n, name: taken.name, payload: taken.chain === CHAIN.length };
		const id = setTimeout(() => (announce = null), 3600);
		return () => clearTimeout(id);
	});
</script>

{#snippet chip(text: string, hue: string)}
	<span
		class="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[0.56rem] font-bold uppercase tracking-[0.16em]"
		style:color={hue}
		style:border-color="color-mix(in srgb, {hue} 45%, transparent)"
		style:background="color-mix(in srgb, {hue} 12%, transparent)"
	>
		{text}
	</span>
{/snippet}

<!-- Five marks — but a SET, not a sequence, so they fill by count rather than in
     place. The last is drawn apart and wider because it is a different kind of
     thing: the four links are interchangeable and the payload is the gate. That
     shape says "collect four, then deliver" without a word of instruction. -->
{#snippet pips()}
	<span class="flex shrink-0 items-center gap-1">
		{#each CHAIN as rung, i (rung.id)}
			{@const payload = rung.chain === CHAIN.length}
			{@const on = payload ? held >= CHAIN.length : i < held}
			{#if payload}
				<span class="mx-0.5 h-2 w-px bg-[var(--border)]"></span>
			{/if}
			<span
				class="h-1.5 rounded-full transition-all duration-500"
				class:w-4={payload}
				class:w-1.5={!payload}
				style:background={on ? tone : 'transparent'}
				style:box-shadow="inset 0 0 0 1px {on
					? tone
					: payload
						? `color-mix(in srgb, ${tone} 55%, transparent)`
						: 'var(--border)'}"
			></span>
		{/each}
	</span>
{/snippet}

<div
	class="flex flex-wrap items-center gap-x-3 gap-y-1 {cls}"
	class:objective-advanced={!!announce}
>
	{#if match.winner}
		{@render chip('match over', winTone)}
		<span class="font-mono text-[0.78rem]">
			{match.winner === 'red'
				? 'Payload delivered — the chain was completed before the horizon.'
				: 'The estate held — the horizon passed with the chain unfinished.'}
		</span>
		<span class="flex-1"></span>
		<button
			type="button"
			onclick={() => match.newMatch()}
			class="rounded border px-2 py-0.5 font-mono text-[0.56rem] font-bold uppercase tracking-[0.14em]"
			style:color={winTone}
			style:border-color="color-mix(in srgb, {winTone} 45%, transparent)"
		>
			new match
		</button>
	{:else if announce}
		<!-- The announcement takes the whole line for three and a half seconds, and
		     replaces rather than joins: a banner competing with the standing readout
		     is two things shouting, and the readout will still be there after. -->
		{@render chip(
			announce.payload ? 'payload' : red ? 'link taken' : 'link lost',
			tone
		)}
		<span class="font-mono text-[0.86rem] font-bold tracking-wide" style:color={tone}>
			{announce.name}
		</span>
		<span class="font-mono text-[0.7rem] tabular-nums text-[var(--fg-dim)]">
			{held}/{CHAIN.length}
		</span>
		{@render pips()}
		<span class="flex-1"></span>
		<span class="font-mono text-[0.62rem] tabular-nums text-[var(--fg-dim)]">
			{red
				? linksLeft > 0
					? `${linksLeft} more before the payload`
					: 'the payload is open'
				: `${left} rounds to hold`}
		</span>
	{:else}
		{@render chip(red ? 'payload chain' : 'the horizon', tone)}
		{@render pips()}

		{#if red}
			<!-- The objective as a SET and a gate, which is what the rules actually
			     are. No "next": there isn't one. -->
			<span class="min-w-0 font-mono text-[0.78rem]">
				<b class="font-bold tabular-nums" style:color={tone}>{held}/{CHAIN.length}</b>
				<span class="text-[var(--fg-dim)]">held —</span>
				{#if linksLeft > 0}
					<span class="text-[var(--fg-dim)]">take</span>
					<b class="font-semibold" style:color={tone}>{linksLeft}</b>
					<span class="text-[var(--fg-dim)]">
						more {linksLeft === 1 ? 'link' : 'links'}, in any order, to open the payload
					</span>
				{:else if held < CHAIN.length}
					<b class="font-semibold" style:color={tone}>the payload is open</b>
					<span class="text-[var(--fg-dim)]">— deliver it to win</span>
				{:else}
					<span class="text-[var(--fg-dim)]">delivered</span>
				{/if}
			</span>
		{:else}
			<!-- Blue's objective is a deadline, so the deadline leads. What it has
			     proven is progress toward evicting, not toward winning. -->
			<span class="min-w-0 font-mono text-[0.78rem]">
				<b class="font-bold tabular-nums" style:color={tone}>{left}</b>
				<span class="text-[var(--fg-dim)]">
					{left === 1 ? 'round to hold' : 'rounds to hold'} —
				</span>
				<b class="font-bold tabular-nums" style:color={tone}>{held}/{CHAIN.length}</b>
				<span class="text-[var(--fg-dim)]">proven compromised</span>
				{#if match.footholds.length - match.chainShown.length > 0}
					<span class="text-[0.62rem] uppercase tracking-wide text-[var(--fg-dim)]">
						· {match.footholds.length - match.chainShown.length} anomalies unexplained
					</span>
				{/if}
			</span>
		{/if}

		<span class="flex-1"></span>
		<span class="font-mono text-[0.62rem] tabular-nums text-[var(--fg-dim)]">
			{left} rounds to horizon
		</span>
	{/if}
</div>

<style>
	/* The advance, as motion rather than as a word. One firm pulse — it has to
	   pull the eye off whatever it was on, and a loop would keep pulling it back
	   for as long as the banner stood. */
	.objective-advanced {
		animation: objective-advance 620ms cubic-bezier(0.2, 0.9, 0.25, 1);
	}

	@keyframes objective-advance {
		0% {
			transform: scale(1);
			filter: brightness(1);
		}
		18% {
			transform: scale(1.045);
			filter: brightness(1.7);
		}
		100% {
			transform: scale(1);
			filter: brightness(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.objective-advanced {
			animation: none;
		}
	}
</style>
