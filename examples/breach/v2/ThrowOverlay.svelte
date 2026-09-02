<script lang="ts">
	// The roll, centre stage, one beat at a time: what you bring, what you are up
	// against, the dice, then the word. v1 itemised the modifier into four chips
	// and hid the target inside a bare "vs 13"; here both halves of the same
	// subtraction are printed side by side and neither of them moves until the
	// dice have landed on it.
	import Die from './Die.svelte';
	import { PACE, type Match } from './match.svelte.js';
	import { OUTCOME_COLOR, OUTCOME_LABEL, SEATS, SKILL_LABEL } from './rules.js';

	const { match }: { match: Match } = $props();

	const live = $derived(match.phase === 'rolling' || match.phase === 'verdict');
	const p = $derived(match.pending);
	const t = $derived(match.throw_);
	const actor = $derived(p ? SEATS[p.move.seat] : null);
	const ink = $derived(t ? OUTCOME_COLOR[t.outcome] : '#94a3b8');

	// The faces stop changing before the verdict does, so there is a moment where
	// the player has read the dice and the game has not said anything yet. That
	// moment is the whole point of slowing this down.
	let settled = $state(false);
	$effect(() => {
		if (!t) {
			settled = false;
			return;
		}
		const at = setTimeout(() => (settled = true), PACE.tumble * PACE.lock);
		return () => clearTimeout(at);
	});

	const wall = $derived(p?.target && p.move.effect === 'attack' ? match.wallOf(p.target) : null);

	interface Chip {
		label: string;
		value: number;
	}

	const chips = $derived.by((): Chip[] => {
		const o = p?.odds;
		if (!o || !p) return [];
		const out: Chip[] = [{ label: SKILL_LABEL[p.move.skill], value: o.skill }];
		if (o.card) out.push({ label: 'move', value: o.card });
		if (o.trust) out.push({ label: 'trust', value: o.trust });
		if (o.momentum) out.push({ label: 'held', value: o.momentum });
		return out;
	});

	const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
</script>

{#if live && p && actor}
	<div class="scrim">
		<div class="throw" style="--ink:{ink}; --seat:{actor.color}">
			<header>
				<span class="who">{actor.name}</span>
				<span class="what">{p.move.name}</span>
				{#if p.target}<span class="where">→ {p.target.name}</span>{/if}
			</header>

			{#if p.odds}
				<div class="sum">
					<div class="side">
						<span class="cap">you bring</span>
						<div class="chips">
							{#each chips as c (c.label)}
								<span class="chip"><b>{sign(c.value)}</b>{c.label}</span>
							{/each}
						</div>
						<span class="big">{sign(p.odds.modifier)}</span>
					</div>

					<div class="side right">
						<span class="cap">you must beat</span>
						{#if wall}
							<div class="chips">
								<span class="chip"><b>{wall.base}</b>base</span>
								{#if wall.hardened}<span class="chip up"><b>+{wall.hardened}</b>hardened</span>{/if}
								{#if wall.damage}<span class="chip down"><b>−{wall.damage}</b>damage</span>{/if}
								{#if wall.alert}<span class="chip up"><b>+{wall.alert}</b>alert</span>{/if}
							</div>
						{:else}
							<div class="chips"><span class="chip"><b>{p.odds.target}</b>difficulty</span></div>
						{/if}
						<span class="big">{p.odds.target}</span>
					</div>
				</div>

				<p class="need">
					dice need <b>{p.odds.needed}</b> — {Math.round(p.odds.chance * 100)}% to land,
					{Math.round(p.odds.chanceClean * 100)}% clean
				</p>
			{/if}

			<div class="dice" class:quiet={!t}>
				{#if t}
					<Die face={t.dice[0]} {settled} color={ink} />
					<Die face={t.dice[1]} settled={settled} delay={140} color={ink} />
				{:else}
					<span class="nodice">no roll — this one is certain</span>
				{/if}
			</div>

			{#if t && settled}
				<div class="verdict">
					<span class="maths">
						{t.dice[0]} + {t.dice[1]} = {t.total}
						<i>{sign(t.modifier)}</i>
						vs {t.target}
					</span>
					<strong>{OUTCOME_LABEL[t.outcome]}</strong>
					<span class="margin">margin {sign(t.margin)}</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgb(3 6 12 / 0.72);
		backdrop-filter: blur(3px);
		z-index: 40;
		animation: fade 0.35s ease both;
	}

	.throw {
		width: min(46rem, 92vw);
		padding: 1.6rem 1.8rem 1.9rem;
		border-radius: 1.1rem;
		background: linear-gradient(180deg, #0d141f, #070b12);
		border: 1px solid color-mix(in srgb, var(--ink) 32%, #1e293b);
		box-shadow: 0 30px 80px rgb(0 0 0 / 0.6);
		text-align: center;
		animation: rise 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	header {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		justify-content: center;
		flex-wrap: wrap;
		font-size: 0.82rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.who {
		color: var(--seat);
		font-weight: 700;
	}
	.what {
		color: #e2e8f0;
	}
	.where {
		color: #64748b;
	}

	.sum {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 1rem;
		margin: 1.2rem 0 0.4rem;
	}
	.sum::before {
		content: 'vs';
		grid-column: 2;
		align-self: center;
		color: #475569;
		font-size: 0.75rem;
		letter-spacing: 0.2em;
	}
	.side {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
	}
	.side.right {
		grid-column: 3;
		align-items: flex-end;
	}
	.cap {
		font-size: 0.66rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #475569;
	}
	.chips {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.chip {
		display: inline-flex;
		gap: 0.3rem;
		align-items: baseline;
		padding: 0.15rem 0.45rem;
		border-radius: 0.35rem;
		background: #131c29;
		border: 1px solid #1f2b3c;
		font-size: 0.7rem;
		color: #94a3b8;
	}
	.chip b {
		color: #cbd5e1;
		font-variant-numeric: tabular-nums;
	}
	.chip.up b {
		color: #7dd3fc;
	}
	.chip.down b {
		color: #fbbf24;
	}
	.big {
		font-size: 2.4rem;
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: #e2e8f0;
	}

	.need {
		margin: 0.2rem 0 0;
		font-size: 0.74rem;
		color: #64748b;
	}
	.need b {
		color: #cbd5e1;
	}

	.dice {
		display: flex;
		gap: 1.1rem;
		justify-content: center;
		margin: 1.4rem 0 0.5rem;
		min-height: 4.5rem;
		align-items: center;
	}
	.nodice {
		font-size: 0.78rem;
		color: #475569;
		letter-spacing: 0.08em;
	}

	.verdict {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.9rem;
		animation: fade 0.4s ease both;
	}
	.maths {
		font-size: 0.76rem;
		color: #64748b;
		font-variant-numeric: tabular-nums;
	}
	.maths i {
		color: #94a3b8;
		font-style: normal;
	}
	.verdict strong {
		font-size: 1.5rem;
		letter-spacing: 0.22em;
		color: var(--ink);
	}
	.margin {
		font-size: 0.72rem;
		color: #475569;
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}
</style>
