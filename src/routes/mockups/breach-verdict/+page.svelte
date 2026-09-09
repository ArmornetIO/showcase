<script lang="ts">
	// ── BREACH · the end of a match ──────────────────────────────────────────────
	// A match ends once, twenty-odd minutes in, and only ONE of the two endings
	// happens — so the only way to judge the pair is to stand them next to each
	// other. This is the bench: four boards parked at their last frame, one per
	// seat × ending, and the crest on its own at the sizes anything asks it for.
	//
	// Real `BreachMatch` objects with a winner written onto them, not props. The
	// screen reads chain progress, the round it ended on and the seat's faction
	// off the match, so a mock would be a second opinion about what a finished
	// board looks like — the same argument `breach-hud` makes one page over.
	//
	// ── The switcher is ABOVE the screen it switches ─────────────────────────
	// `MatchOver` is a full-viewport overlay. The first cut of this page put the
	// case buttons in the document under it, which meant the only ending you
	// could ever see was whichever one loaded first — the scrim ate every click.
	// So the bar is `fixed` at z-[90], one rung over the screen at z-[80].
	import { BreachMatch, MatchOver, CrestVerdict } from '$examples/breach/index.js';
	import { CHAIN } from '$examples/breach/internal/rules.js';
	import type { Faction } from '$examples/breach/internal/rules.js';

	/** A board at the last frame of a match. `links` is how far red got — five is
	 *  the payload, anything less is blue running the clock out. `seen` is how
	 *  many of those blue had evidence for, which is the number the screen's
	 *  "blue could prove" line is about. */
	function ended(
		winner: Faction,
		seat: string,
		round: number,
		links: number,
		seen: number
	): BreachMatch {
		const m = new BreachMatch();
		m.seatKey = seat;
		m.stage = 'play';
		m.round = round;
		m.footholds = CHAIN.slice(0, links).map((s, i) => ({
			structure_id: s.id,
			seat_key: 'maintainer',
			persistent: true,
			revealed: i < seen,
			sleeper: false,
			placed_round: 2,
			staged: false
		}));
		m.winner = winner;
		return m;
	}

	const CASES = [
		{
			label: 'blue seat · red won',
			note: 'the screenshot that started this. Verdict and event have to agree: you lose it, and what happened is that the payload landed.',
			match: ended('red', 'hunter', 9, CHAIN.length, 2)
		},
		{
			label: 'blue seat · blue won',
			note: 'the win. The estate held, so the crest is whole — and blue is the side whose shield it is.',
			match: ended('blue', 'hunter', 12, 3, 2)
		},
		{
			label: 'red seat · red won',
			note: 'you take it, over a BROKEN shield: the picture is decided by the winner, never by the reader.',
			match: ended('red', 'maintainer', 9, CHAIN.length, 2)
		},
		{
			label: 'red seat · blue won',
			note: 'you lose it — the horizon passed with the chain unfinished.',
			match: ended('blue', 'maintainer', 12, 3, 2)
		}
	];

	let shown = $state(0);
	let open = $state(true);
	const active = $derived(CASES[shown]);

	function pick(i: number) {
		shown = i;
		open = true;
	}

	// Remounted per case: the break plays once and holds, so a shard left where
	// the last case parked it would show the tail of an animation rather than the
	// animation.
	const key = $derived(`${shown}-${open}`);
</script>

<svelte:head><title>BREACH — the end of a match</title></svelte:head>

<!-- One rung above the overlay, so the endings can be flipped through with the
     screen up. -->
<div
	class="fixed inset-x-0 top-0 z-[90] flex flex-wrap items-center gap-2 border-b border-[var(--border)]
	       bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_92%,transparent)] px-4 py-2 backdrop-blur-md"
>
	<span class="font-mono text-[0.56rem] tracking-[0.18em] text-[var(--fg-dim)] uppercase">
		/ ending
	</span>
	{#each CASES as c, i (c.label)}
		<button
			type="button"
			onclick={() => pick(i)}
			class="rounded border px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.1em] uppercase transition-colors"
			style:color={i === shown ? 'var(--fg)' : 'var(--fg-dim)'}
			style:border-color={i === shown ? 'var(--accent)' : 'var(--border)'}
		>
			{c.label}
		</button>
	{/each}
	<span class="flex-1"></span>
	<button
		type="button"
		onclick={() => (open = !open)}
		class="rounded border border-[var(--border)] px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.1em] text-[var(--fg-dim)] uppercase"
	>
		{open ? 'hide the screen' : 'show the screen'}
	</button>
</div>

<div class="min-h-screen bg-[var(--bg,#05080d)] px-8 pt-16 pb-8 text-[var(--fg)]">
	<div class="mx-auto flex max-w-[62rem] flex-col gap-6">
		<div class="flex flex-col gap-1">
			<h1 class="m-0 font-mono text-[1.1rem] font-black tracking-[0.14em] uppercase">
				the end of a match
			</h1>
			<p class="m-0 font-mono text-[0.68rem] leading-relaxed text-[var(--fg-dim)]">
				One shield, two states. <b class="text-[var(--fg)]">Held</b> is the mark the lobby's forge
				lands on, intact and lit; <b class="text-[var(--fg)]">breached</b> is that same component
				cut into wedges and clipped, so a change to the logo turns up in both without anybody
				redrawing a broken one. Which picture you get is decided by who won — the shield is blue's
				estate — and never by whether the reader won.
			</p>
			<p class="m-0 font-mono text-[0.62rem] text-[var(--fg-muted)]">{active.note}</p>
		</div>

		<div
			class="flex flex-wrap items-end gap-10 rounded-xl border border-[var(--border)] bg-[var(--bg-elev,#0b0f16)] p-6"
		>
			{#each [{ s: 'held' as const, tone: '#34D399' }, { s: 'breached' as const, tone: '#EF4444' }] as v (v.s)}
				<div class="flex flex-col items-center gap-2">
					{#key key}
						<CrestVerdict state={v.s} tone={v.tone} size={148} />
					{/key}
					<span class="font-mono text-[0.56rem] tracking-[0.16em] text-[var(--fg-dim)] uppercase">
						{v.s}
					</span>
				</div>
			{/each}
			{#each [104, 72, 48] as s (s)}
				<div class="flex flex-col items-center gap-2">
					{#key key}
						<CrestVerdict state="breached" tone="#EF4444" size={s} />
					{/key}
					<span class="font-mono text-[0.56rem] text-[var(--fg-dim)]">{s}px</span>
				</div>
			{/each}
		</div>
	</div>
</div>

{#if open}
	{#key key}
		<MatchOver match={active.match} onclose={() => (open = false)} onagain={() => (open = false)} />
	{/key}
{/if}
