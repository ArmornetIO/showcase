<script lang="ts">
	// The seat whose turn it is, and the three things it can do. There is no
	// hand, no deck and no draw: a player's options are the same three buttons
	// every turn of the match, which is what makes a six-round game learnable in
	// one sitting.
	import type { Match } from './match.svelte.js';
	import { SEATS, SKILL_LABEL, pct, rolls, type Move } from './rules.js';

	const { match }: { match: Match } = $props();

	const seat = $derived(SEATS[match.seat]);
	const locked = $derived(match.phase === 'rolling' || match.phase === 'verdict' || match.botTurn);

	/** The roll the button is quoting: an attack is quoted against the step it is
	 *  forced to hit, everything else against its own difficulty. */
	const quote = (m: Move) => match.oddsFor(m, m.effect === 'attack' ? match.front : null);
</script>

<section class="bar" style="--seat:{seat.color}">
	<header>
		<div class="who">
			<span class="name">{seat.name}</span>
			<span class="tag">{seat.tagline}</span>
		</div>

		<div class="skills">
			{#each Object.entries(seat.skills) as [k, v] (k)}
				<span class="sk" class:zero={v <= 0}>
					{SKILL_LABEL[k as keyof typeof SKILL_LABEL]}<b>{v >= 0 ? `+${v}` : v}</b>
				</span>
			{/each}
		</div>

		<div class="ap" aria-label="{match.ap} action points left">
			{#each [0, 1] as i (i)}
				<span class="pip" class:on={i < match.ap}></span>
			{/each}
			<span class="aplabel">AP</span>
		</div>
	</header>

	{#if match.botTurn}
		<p class="auto">The machine is playing this chair.</p>
	{/if}

	<div class="moves">
		{#each match.moves as m (m.key)}
			{@const why = match.refusal(m)}
			{@const o = quote(m)}
			<button
				class="move"
				class:armed={match.armed?.key === m.key}
				disabled={!!why || locked}
				onclick={() => match.arm(m)}
			>
				<span class="top">
					<span class="mname">{m.name}</span>
					<span class="cost">{m.ap} AP</span>
				</span>

				<span class="odds">
					{#if o}
						{pct(o.chance)} to land · needs {o.needed} on 2d6
					{:else if rolls(m)}
						—
					{:else}
						no roll — it simply happens
					{/if}
					{#if m.alert > 0}<i class="loud">+{m.alert} alert</i>
					{:else if m.alert < 0}<i class="hush">{m.alert} alert</i>{/if}
					{#if m.uses !== undefined}<i class="once">{match.charges(m)} left</i>{/if}
				</span>

				<span class="text">{m.text}</span>
				{#if why}<span class="why">{why}</span>{/if}
			</button>
		{/each}
	</div>

	<footer>
		{#if match.phase === 'aiming'}
			<span class="hint">Pick a building.</span>
			<button class="ghost" onclick={() => match.cancel()}>cancel</button>
		{:else}
			<span class="hint">{match.ap} AP left this turn.</span>
			<button class="ghost" disabled={locked} onclick={() => match.endTurn()}>end turn</button>
		{/if}
	</footer>
</section>

<style>
	.bar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.1rem 0.9rem;
		border-radius: 0.9rem;
		background: linear-gradient(180deg, #0b111a, #070b12);
		border: 1px solid color-mix(in srgb, var(--seat) 30%, #1e293b);
		box-shadow: 0 0 40px color-mix(in srgb, var(--seat) 8%, transparent);
	}

	header {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.who {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin-right: auto;
	}
	.name {
		font-weight: 700;
		color: var(--seat);
		letter-spacing: 0.04em;
	}
	.tag {
		font-size: 0.72rem;
		color: #52627a;
	}

	.skills {
		display: flex;
		gap: 0.3rem;
	}
	.sk {
		display: inline-flex;
		gap: 0.25rem;
		align-items: baseline;
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		color: #475569;
		background: #101823;
		border: 1px solid #1c2735;
		border-radius: 0.3rem;
		padding: 0.12rem 0.35rem;
	}
	.sk b {
		color: #cbd5e1;
		font-variant-numeric: tabular-nums;
	}
	.sk.zero b {
		color: #475569;
	}

	.ap {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.pip {
		width: 0.62rem;
		height: 0.62rem;
		border-radius: 50%;
		border: 1px solid #334155;
		transition: background 0.3s ease;
	}
	.pip.on {
		background: var(--seat);
		border-color: var(--seat);
	}
	.aplabel {
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		color: #475569;
	}

	.auto {
		margin: 0;
		font-size: 0.72rem;
		color: #52627a;
		letter-spacing: 0.06em;
	}

	.moves {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.6rem;
	}

	.move {
		display: grid;
		gap: 0.3rem;
		justify-items: start;
		text-align: left;
		padding: 0.7rem 0.8rem 0.75rem;
		border-radius: 0.6rem;
		background: #0d141e;
		border: 1px solid #1c2735;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition:
			border-color 0.25s ease,
			transform 0.25s ease,
			opacity 0.25s ease;
	}
	.move:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--seat) 60%, #1c2735);
		transform: translateY(-1px);
	}
	.move.armed {
		border-color: var(--seat);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--seat) 50%, transparent);
	}
	.move:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.top {
		display: flex;
		width: 100%;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}
	.mname {
		font-size: 0.86rem;
		font-weight: 600;
		color: #e2e8f0;
	}
	.cost {
		font-size: 0.64rem;
		letter-spacing: 0.1em;
		color: #64748b;
	}

	.odds {
		display: flex;
		gap: 0.4rem;
		align-items: baseline;
		flex-wrap: wrap;
		font-size: 0.68rem;
		color: #7f8ea3;
		font-variant-numeric: tabular-nums;
	}
	.odds i {
		font-style: normal;
		font-size: 0.62rem;
		letter-spacing: 0.06em;
	}
	.loud {
		color: #fb923c;
	}
	.hush {
		color: #34d399;
	}
	.once {
		color: #a78bfa;
	}

	.text {
		font-size: 0.7rem;
		line-height: 1.45;
		color: #52627a;
	}
	.why {
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #7f1d1d;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.hint {
		font-size: 0.7rem;
		color: #52627a;
		margin-right: auto;
	}
	.ghost {
		font: inherit;
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 0.35rem 0.8rem;
		border-radius: 0.4rem;
		background: transparent;
		border: 1px solid #24324a;
		color: #94a3b8;
		cursor: pointer;
	}
	.ghost:hover:not(:disabled) {
		border-color: var(--seat);
		color: #e2e8f0;
	}
	.ghost:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
</style>
