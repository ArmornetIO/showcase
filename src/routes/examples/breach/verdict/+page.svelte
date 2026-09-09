<script lang="ts">
	// ── The end screen, both ways at once ────────────────────────────────────────
	// A match ends once, twenty-odd minutes in, and only one of the two endings
	// happens — so the only way to judge the pair is to stand them next to each
	// other. This route is the bench: four matches parked at their last frame,
	// one per seat colour × ending, plus the crest on its own at three sizes.
	//
	// Real `BreachMatch` objects with a winner written onto them, not props — the
	// screen reads chain progress, the round it ended on and the seat's own
	// faction off the match, and a mock would be a second opinion about what a
	// finished board looks like.
	import { BreachMatch, MatchOver, CrestVerdict } from '$examples/breach/index.js';
	import { CHAIN } from '$examples/breach/internal/rules.js';
	import type { Faction } from '$examples/breach/internal/rules.js';

	/** A board parked at the last frame of a match. `links` is how far red got —
	 *  five of them is the payload, and anything less is blue running the clock
	 *  out. */
	function ended(winner: Faction, seat: string, round: number, links: number): BreachMatch {
		const m = new BreachMatch();
		m.seatKey = seat;
		m.stage = 'play';
		m.round = round;
		m.footholds = CHAIN.slice(0, links).map((s) => ({
			structure_id: s.id,
			seat_key: 'maintainer',
			persistent: true,
			// Two of them unrevealed, so the screen's "blue could prove" line has
			// something to be about.
			revealed: s.chain !== undefined && s.chain <= 2,
			sleeper: false,
			placed_round: 2,
			staged: false
		}));
		m.winner = winner;
		return m;
	}

	const CASES: Array<{ label: string; note: string; match: BreachMatch }> = [
		{
			label: 'red seat · red won',
			note: 'you take it — and the shield you are looking at is the one you broke',
			match: ended('red', 'maintainer', 9, CHAIN.length)
		},
		{
			label: 'blue seat · red won',
			note: 'the screenshot that started this: the verdict and the event have to agree',
			match: ended('red', 'hunter', 9, CHAIN.length)
		},
		{
			label: 'blue seat · blue won',
			note: 'you take it — the estate held, so the crest is whole',
			match: ended('blue', 'hunter', 12, 3)
		},
		{
			label: 'red seat · blue won',
			note: 'you lose it — the horizon passed with the chain unfinished',
			match: ended('blue', 'maintainer', 12, 3)
		}
	];

	let shown = $state(0);
	const active = $derived(CASES[shown]);

	// Remounted on every switch: the break plays once and holds, so a shard that
	// stayed where the last case left it would show the tail of an animation
	// rather than the animation.
	const key = $derived(`${shown}`);
</script>

<svelte:head><title>BREACH — the end of a match</title></svelte:head>

<div class="min-h-screen bg-[var(--bg,#05080d)] p-8 text-[var(--fg)]">
	<div class="mx-auto flex max-w-[62rem] flex-col gap-6">
		<div class="flex flex-col gap-1">
			<h1 class="m-0 font-mono text-[1.1rem] font-black tracking-[0.14em] uppercase">
				the end of a match
			</h1>
			<p class="m-0 font-mono text-[0.68rem] leading-relaxed text-[var(--fg-dim)]">
				One shield, two states. <b class="text-[var(--fg)]">Held</b> is the mark the lobby's forge
				lands on, intact and lit; <b class="text-[var(--fg)]">breached</b> is that same component
				cut into wedges and clipped, so a change to the logo turns up in both. Which picture you
				get is decided by who won — never by whether the reader did.
			</p>
		</div>

		<!-- The crest on its own, at the three sizes anything would ask it for. -->
		<div
			class="flex flex-wrap items-end gap-10 rounded-xl border border-[var(--border)] bg-[var(--bg-elev,#0b0f16)] p-6"
		>
			{#each [{ s: 'held' as const, tone: '#34D399' }, { s: 'breached' as const, tone: '#EF4444' }] as v (v.s)}
				<div class="flex flex-col items-center gap-2">
					{#key key}
						<CrestVerdict state={v.s} tone={v.tone} size={148} />
					{/key}
					<span
						class="font-mono text-[0.56rem] tracking-[0.16em] text-[var(--fg-dim)] uppercase"
					>
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

		<!-- The whole screen, per case. Only one at a time: it is a full-viewport
		     overlay, and two of them would be stacked scrims. -->
		<div class="flex flex-wrap gap-2">
			{#each CASES as c, i (c.label)}
				<button
					type="button"
					onclick={() => (shown = i)}
					class="rounded border px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.1em] uppercase transition-colors"
					style:color={i === shown ? 'var(--fg)' : 'var(--fg-dim)'}
					style:border-color={i === shown ? 'var(--accent)' : 'var(--border)'}
				>
					{c.label}
				</button>
			{/each}
		</div>
		<p class="m-0 font-mono text-[0.62rem] text-[var(--fg-dim)]">{active.note}</p>
	</div>
</div>

{#key key}
	<MatchOver match={active.match} onclose={() => {}} onagain={() => {}} />
{/key}
