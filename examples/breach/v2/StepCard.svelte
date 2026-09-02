<script lang="ts">
	// One building on the chain. The wall is printed as its own sum — base, what
	// blue put up, what red wore off, what the meter added — because the number
	// you have to beat is the number you plan against, and v1 showed it as an
	// oracle.
	import type { Match } from './match.svelte.js';
	import type { Step } from './rules.js';

	const { match, step, index }: { match: Match; step: Step; index: number } = $props();

	const w = $derived(match.wallOf(step));
	const held = $derived(match.held(step.id));
	const front = $derived(match.front?.id === step.id);
	const sealed = $derived(match.isSealed(step.id));
	const aimable = $derived(
		match.phase === 'aiming' &&
			!!match.armed &&
			match.targets(match.armed).some((s) => s.id === step.id)
	);
</script>

<button
	class="step"
	class:held
	class:front
	class:sealed
	class:aimable
	disabled={!aimable}
	onclick={() => aimable && match.commit(step)}
>
	<span class="ord">{index + 1}</span>

	<span class="name">{step.name}</span>
	<span class="role">{step.role}</span>

	<span class="wall">{w.total}</span>
	<span class="parts">
		<i>{w.base}</i>
		{#if w.hardened}<i class="up">+{w.hardened}</i>{/if}
		{#if w.damage}<i class="down">−{w.damage}</i>{/if}
		{#if w.alert}<i class="up">+{w.alert}</i>{/if}
	</span>

	<span class="flag">
		{#if held}RED HOLDS{:else if sealed}SEALED{:else if front}NEXT{:else}—{/if}
	</span>

	<span class="blurb">{step.blurb}</span>
</button>

<style>
	.step {
		--edge: #1e293b;
		position: relative;
		display: grid;
		gap: 0.28rem;
		justify-items: start;
		text-align: left;
		padding: 1rem 1rem 0.9rem;
		border-radius: 0.8rem;
		background: linear-gradient(180deg, #0c121c, #080d15);
		border: 1px solid var(--edge);
		color: inherit;
		font: inherit;
		cursor: default;
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease,
			transform 0.3s ease;
	}

	.step.front {
		--edge: #334155;
		box-shadow: inset 0 0 0 1px rgb(148 163 184 / 0.08);
	}
	.step.held {
		--edge: color-mix(in srgb, #f87171 45%, #1e293b);
		background: linear-gradient(180deg, #180f14, #0a0709);
	}
	.step.sealed {
		--edge: color-mix(in srgb, #60a5fa 45%, #1e293b);
	}
	.step.aimable {
		--edge: #7dd3fc;
		cursor: pointer;
		box-shadow: 0 0 0 1px #7dd3fc55, 0 0 26px #7dd3fc22;
	}
	.step.aimable:hover {
		transform: translateY(-2px);
	}

	.ord {
		position: absolute;
		top: 0.7rem;
		right: 0.85rem;
		font-size: 0.68rem;
		color: #334155;
		letter-spacing: 0.1em;
	}

	.name {
		font-size: 0.94rem;
		font-weight: 600;
		color: #e2e8f0;
	}
	.role {
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #475569;
	}

	.wall {
		margin-top: 0.5rem;
		font-size: 2rem;
		line-height: 1;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: #cbd5e1;
	}
	.parts {
		display: flex;
		gap: 0.3rem;
		font-size: 0.68rem;
		color: #475569;
		font-variant-numeric: tabular-nums;
	}
	.parts i {
		font-style: normal;
	}
	.parts .up {
		color: #7dd3fc;
	}
	.parts .down {
		color: #fbbf24;
	}

	.flag {
		margin-top: 0.35rem;
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		color: #475569;
	}
	.step.held .flag {
		color: #f87171;
	}
	.step.sealed .flag {
		color: #60a5fa;
	}
	.step.front .flag {
		color: #94a3b8;
	}

	.blurb {
		margin-top: 0.4rem;
		font-size: 0.7rem;
		line-height: 1.45;
		color: #52627a;
	}
</style>
