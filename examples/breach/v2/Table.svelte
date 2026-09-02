<script lang="ts">
	// The whole game, on one screen, with nothing hidden from anybody. Four
	// buildings across the top, the meters that move them in the header, the seat
	// whose turn it is underneath, and the record of what happened down the side.
	// A match is six rounds and there is no second screen.
	import { onMount } from 'svelte';
	import SeatBar from './SeatBar.svelte';
	import StepCard from './StepCard.svelte';
	import ThrowOverlay from './ThrowOverlay.svelte';
	import { Match, type Options } from './match.svelte.js';
	import {
		ALERT_CAP,
		ALERT_PER_WALL,
		CHAIN,
		ORDER,
		ROUNDS,
		SEATS,
		TRUST_CAP,
		OUTCOME_COLOR
	} from './rules.js';

	const { options = {} }: { options?: Options } = $props();

	const match = new Match(options);
	let feedEl = $state<HTMLElement | null>(null);

	// `onMount`, not `$effect`: start() reads the seat, and an effect that reads
	// the seat re-runs every time the turn passes.
	onMount(() => match.start());

	// New line, scroll to it. The feed is the only part of the screen that grows.
	$effect(() => {
		void match.feed.length;
		if (feedEl) feedEl.scrollTop = feedEl.scrollHeight;
	});

	const toggleBot = (k: (typeof ORDER)[number]) => {
		match.bots = match.bots.includes(k) ? match.bots.filter((b) => b !== k) : [...match.bots, k];
		// Handing a chair to the machine mid-turn should start it playing, not
		// wait for the next round to come back around.
		void match.maybeBot();
	};
</script>

<div class="table">
	<header class="top">
		<div class="title">
			<h1>BREACH</h1>
			<span class="sub">short match — 2v2, {ROUNDS} rounds</span>
		</div>

		<div class="clock">
			<span class="cap">round</span>
			<div class="rounds">
				{#each { length: ROUNDS } as _, i (i)}
					<span class="tick" class:done={i + 1 < match.round} class:now={i + 1 === match.round}
					></span>
				{/each}
			</div>
			<b>{match.round}/{ROUNDS}</b>
		</div>

		<div class="meter alert">
			<span class="cap">alert</span>
			<div class="track">
				<span class="fill" style="width:{(match.alert / ALERT_CAP) * 100}%"></span>
			</div>
			<b>{match.alert}</b>
			<span class="effect">+{match.alertBonus} to every wall · one per {ALERT_PER_WALL}</span>
		</div>

		<div class="meter trust">
			<span class="cap">trust</span>
			<div class="pips">
				{#each { length: TRUST_CAP } as _, i (i)}
					<span class="pip" class:on={i < match.trust}></span>
				{/each}
			</div>
			<span class="effect">rides every red attack</span>
		</div>
	</header>

	<nav class="order" aria-label="initiative">
		{#each ORDER as k, i (k)}
			{@const s = SEATS[k]}
			<button
				class="chair"
				class:now={match.at === i}
				style="--seat:{s.color}"
				onclick={() => toggleBot(k)}
				title="click to hand this chair to the machine, or take it back"
			>
				<span class="cname">{s.name}</span>
				<span class="cwho">{match.bots.includes(k) ? 'auto' : 'you'}</span>
			</button>
		{/each}
	</nav>

	<main class="chain">
		{#each CHAIN as s, i (s.id)}
			<StepCard {match} step={s} index={i} />
		{/each}
	</main>

	<div class="lower">
		<SeatBar {match} />

		<aside class="feed" bind:this={feedEl}>
			{#each match.feed as e, i (i)}
				<p class="line" style="--ink:{e.outcome ? OUTCOME_COLOR[e.outcome] : '#334155'}">
					<span class="rd">R{e.round}</span>
					<span class="sn" style="color:{SEATS[e.seat].color}">{SEATS[e.seat].name}</span>
					<span class="tx">{e.text}</span>
				</p>
			{/each}
		</aside>
	</div>
</div>

<ThrowOverlay {match} />

{#if match.winner}
	<div class="over" class:red={match.winner === 'red'}>
		<div class="card">
			<strong>{match.winner === 'red' ? 'RED TOOK THE CHAIN' : 'BLUE HELD'}</strong>
			<p>
				{match.winner === 'red'
					? 'Every artifact downstream now ships their code, signed by the people who built it.'
					: `Six rounds, and red got ${match.depth} of ${CHAIN.length} buildings.`}
			</p>
			<button onclick={() => location.reload()}>play again</button>
		</div>
	</div>
{/if}

<style>
	.table {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		height: 100vh;
		padding: 1rem 1.2rem 1.1rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 2rem;
		flex-wrap: wrap;
	}
	.title {
		display: flex;
		flex-direction: column;
		margin-right: auto;
	}
	h1 {
		margin: 0;
		font-size: 1.1rem;
		letter-spacing: 0.4em;
		color: #e2e8f0;
	}
	.sub {
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #475569;
	}

	.cap {
		font-size: 0.6rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #475569;
	}

	.clock,
	.meter {
		display: grid;
		gap: 0.25rem;
		justify-items: start;
	}
	.clock b,
	.meter b {
		font-size: 0.8rem;
		color: #cbd5e1;
		font-variant-numeric: tabular-nums;
	}
	.rounds {
		display: flex;
		gap: 0.22rem;
	}
	.tick {
		width: 1.1rem;
		height: 0.24rem;
		border-radius: 0.12rem;
		background: #1c2735;
	}
	.tick.done {
		background: #334155;
	}
	.tick.now {
		background: #e2e8f0;
	}

	.track {
		width: 9rem;
		height: 0.35rem;
		border-radius: 0.2rem;
		background: #131c29;
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #fb923c, #ef4444);
		transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.effect {
		font-size: 0.62rem;
		color: #475569;
	}

	.pips {
		display: flex;
		gap: 0.25rem;
	}
	.pip {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		border: 1px solid #334155;
		transition: background 0.4s ease;
	}
	.pip.on {
		background: #f87171;
		border-color: #f87171;
	}

	.order {
		display: flex;
		gap: 0.4rem;
	}
	.chair {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		padding: 0.3rem 0.6rem;
		border-radius: 0.4rem;
		background: #0b111a;
		border: 1px solid #1c2735;
		font: inherit;
		cursor: pointer;
		transition:
			border-color 0.3s ease,
			background 0.3s ease;
	}
	.chair.now {
		border-color: var(--seat);
		background: color-mix(in srgb, var(--seat) 10%, #0b111a);
	}
	.cname {
		font-size: 0.7rem;
		color: var(--seat);
	}
	.cwho {
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #475569;
	}

	.chain {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.7rem;
	}

	.lower {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 20rem;
		gap: 0.9rem;
		flex: 1;
		min-height: 0;
	}

	.feed {
		overflow-y: auto;
		padding: 0.8rem 0.9rem;
		border-radius: 0.9rem;
		background: #070b12;
		border: 1px solid #141d29;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.line {
		margin: 0;
		font-size: 0.7rem;
		line-height: 1.5;
		padding-left: 0.6rem;
		border-left: 2px solid var(--ink);
		color: #7f8ea3;
	}
	.rd {
		color: #334155;
		margin-right: 0.35rem;
	}
	.sn {
		font-weight: 600;
		margin-right: 0.3rem;
	}
	.tx {
		color: #7f8ea3;
	}

	.over {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgb(3 6 12 / 0.86);
		z-index: 60;
		animation: fade 0.7s ease both;
	}
	.card {
		text-align: center;
		display: grid;
		gap: 0.9rem;
		padding: 2.4rem 3rem;
		border-radius: 1rem;
		border: 1px solid #1e293b;
		background: #080d15;
	}
	.card strong {
		font-size: 1.5rem;
		letter-spacing: 0.3em;
		color: #60a5fa;
	}
	.over.red .card strong {
		color: #f87171;
	}
	.card p {
		margin: 0;
		max-width: 28rem;
		font-size: 0.8rem;
		line-height: 1.6;
		color: #64748b;
	}
	.card button {
		justify-self: center;
		font: inherit;
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		padding: 0.5rem 1.4rem;
		border-radius: 0.4rem;
		background: transparent;
		border: 1px solid #24324a;
		color: #cbd5e1;
		cursor: pointer;
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
