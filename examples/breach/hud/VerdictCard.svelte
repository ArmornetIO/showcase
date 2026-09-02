<script lang="ts">
	// ── The announcement ─────────────────────────────────────────────────────────
	// What a move looks like when it happens.
	//
	// The beats were always there — `#stage` spends 3.2 seconds walking a
	// resolution through arrive, dice, verdict, consequence, and a server verdict
	// replays through the SAME method, so every browser at the table is already
	// running the same clock frame for frame. What was missing was somewhere to
	// say it: the whole announcement of a roll was a 0.6rem line at the end of
	// the action bar. Three seconds of choreography resolving into nine pixels.
	//
	// So this is that clock, drawn large. It reads `match.verdict` and nothing
	// else; it decides nothing, and deleting it changes no rule.
	//
	// It is `pointer-events-none` throughout. A modal here would be the worst of
	// both worlds — the board is doing the interesting part underneath, and a
	// verdict you have to dismiss is one you learn to dismiss without reading.
	//
	// It no longer floats over the middle of the board. It is the first event
	// type in `GameEventsOverlay`, which is a COLUMN — so the type sizes here are
	// scaled for a panel rather than for a caption over a globe.
	import { Icon, type IconName } from 'showcase';
	import { OUTCOME_COLOR, OUTCOME_LABEL, TERRITORIES } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		class?: string;
	}

	let { match, class: cls = '' }: Props = $props();

	const v = $derived(match.verdict);

	/** Pips, not a numeral: two dice read as two dice. */
	const PIPS: Record<number, [number, number][]> = {
		1: [[1, 1]],
		2: [
			[0, 0],
			[2, 2]
		],
		3: [
			[0, 0],
			[1, 1],
			[2, 2]
		],
		4: [
			[0, 0],
			[2, 0],
			[0, 2],
			[2, 2]
		],
		5: [
			[0, 0],
			[2, 0],
			[1, 1],
			[0, 2],
			[2, 2]
		],
		6: [
			[0, 0],
			[2, 0],
			[0, 1],
			[2, 1],
			[0, 2],
			[2, 2]
		]
	};

	// While they are in the air the faces are the ones the board is already
	// tumbling, so the two readouts cannot disagree.
	//
	// The fallback is only legitimate for a throw that is actually happening —
	// `match.diceFaces` is this browser's tumble animation, not a fact. Reaching
	// for it when there is no throw drew two dice out of leftover animation
	// state, and the player it was hidden FROM saw numbers their opponent never
	// rolled. `v.throws` is the gate; see `Verdict.throws`.
	const faces = $derived<[number, number]>(v?.roll ? v.roll.dice : match.diceFaces);
	const region = $derived(
		v ? (TERRITORIES[v.territory as keyof typeof TERRITORIES]?.name ?? v.territory) : ''
	);
	const tone = $derived(v?.roll ? OUTCOME_COLOR[v.roll.outcome] : (v?.hue ?? 'var(--fg-dim)'));
</script>

{#snippet die(n: number, spinning: boolean)}
	<span
		class="relative grid h-[42px] w-[42px] grid-cols-3 grid-rows-3 gap-[2px] rounded-[9px] border-2 p-[6px]"
		class:animate-pulse={spinning}
		style:border-color="color-mix(in srgb, {tone} 70%, transparent)"
		style:background="color-mix(in srgb, {tone} 14%, var(--bg-elev, #0b0f16))"
		style:box-shadow="0 0 22px color-mix(in srgb, {tone} 35%, transparent)"
		aria-label="die showing {n}"
	>
		{#each PIPS[n] ?? [] as [cx, cy] (`${cx}-${cy}`)}
			<span
				class="h-full w-full rounded-full"
				style:grid-column={cx + 1}
				style:grid-row={cy + 1}
				style:background={tone}
			></span>
		{/each}
	</span>
{/snippet}

{#if v}
	<!-- Keyed on the announcement id so a second resolution restarts the entrance
	     instead of morphing out of the first one's numbers. -->
	{#key v.id}
		<div
			class="pointer-events-none flex flex-col items-center gap-3 {cls}"
			role="status"
			aria-live="polite"
		>
			<!-- WHO, and at WHAT. Fogged moves name nobody — the component was
			     never told, so there is nothing here to slip out. -->
			<div class="flex items-center gap-2 font-mono text-[0.62rem] tracking-[0.16em] uppercase">
				{#if v.fogged}
					<span class="text-[var(--fg-dim)]">something in</span>
					<b style:color={v.hue}>{region}</b>
				{:else}
					<b style:color={v.hue}>{v.actor}</b>
					<span class="text-[var(--fg-dim)]">{v.seat}</span>
					<Icon name="chevron-right" size={11} />
					<b class="text-[var(--fg)]">{v.target}</b>
				{/if}
			</div>

			<!-- The verb, big. `fx.word` is the one-word reading of the card and it
			     was previously only ever drawn 40px tall on the board itself, where
			     it competes with a spinning globe. -->
			<div
				class="font-mono text-[1.6rem] font-black leading-none tracking-[0.06em] uppercase"
				style:color={tone}
				style:text-shadow="0 0 34px color-mix(in srgb, {tone} 55%, transparent)"
			>
				{v.sealed ? 'blocked' : (v.fogged && !v.roll ? '—' : v.word)}
			</div>

			{#if !v.fogged && v.card}
				<div class="-mt-1 font-mono text-[0.6rem] tracking-[0.12em] text-[var(--fg-dim)]">
					{v.card}
				</div>
			{/if}

			<!-- THE DICE. The reason this component exists. -->
			{#if v.sealed}
				<div
					class="font-mono text-[0.66rem] tracking-[0.14em] uppercase"
					style:color="#A78BFA"
				>
					the seal held — no roll
				</div>
			{:else if v.stage !== 'cast' && !v.throws}
				<!-- The fog took the throw. Saying so is the honest reading — two
				     dice drawn here would be this browser's animation state wearing
				     the costume of a result. -->
				<div class="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]">
					no reading — hidden
				</div>
			{:else if v.stage !== 'cast'}
				<div class="flex items-center gap-3">
					{@render die(faces[0], v.stage === 'rolling')}
					{@render die(faces[1], v.stage === 'rolling')}

					{#if v.roll && v.stage !== 'rolling'}
						<!-- The arithmetic, spelled out. A total with no working shown is
						     a number you have to trust; the modifier is the half the
						     player actually influenced. -->
						<div class="flex flex-col gap-1 pl-1">
							<div class="flex items-baseline gap-1.5 font-mono tabular-nums">
								<span class="text-[0.62rem] text-[var(--fg-dim)]">
									{faces[0]} + {faces[1]}
									{#if v.roll.total - faces[0] - faces[1] !== 0}
										<span style:color={v.hue}>
											{v.roll.total - faces[0] - faces[1] > 0 ? '+' : ''}{v.roll.total -
												faces[0] -
												faces[1]}
										</span>
									{/if}
									=
								</span>
								<b class="text-[1.15rem] font-black leading-none" style:color={tone}>
									{v.roll.total}
								</b>
							</div>
							<span
								class="font-mono text-[0.55rem] tracking-[0.1em] uppercase tabular-nums text-[var(--fg-dim)]"
							>
								margin {v.roll.margin >= 0 ? '+' : ''}{v.roll.margin}
							</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- The word for it, and only once the dice have stopped. -->
			{#if v.roll && v.stage !== 'rolling'}
				<div
					class="rounded-md px-3 py-1 font-mono text-[0.8rem] font-black tracking-[0.22em] uppercase"
					style:color="var(--bg-elev, #0b0f16)"
					style:background={tone}
					style:box-shadow="0 0 26px color-mix(in srgb, {tone} 45%, transparent)"
				>
					{OUTCOME_LABEL[v.roll.outcome]}
				</div>
			{:else if v.stage === 'rolling'}
				<div
					class="font-mono text-[0.66rem] tracking-[0.24em] uppercase text-[var(--fg-dim)]"
				>
					rolling…
				</div>
			{/if}
		</div>
	{/key}
{/if}
