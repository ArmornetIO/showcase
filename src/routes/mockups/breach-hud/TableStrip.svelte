<script lang="ts">
	// ── THE TABLE, as four chips under the clock ─────────────────────────────────
	// The roster was a 250px rail down the left edge, permanently on screen, four
	// tall cards deep — everything about everybody, all match, whether or not you
	// were asking. Most of what it held is reference: skills do not change, the
	// character does not change, and the two facts that DO move turn by turn (who
	// is acting, what they have left to spend) are one line each.
	//
	// So the standing state is a strip of four chips where the turn-order pips used
	// to be — portrait, side, AP, and whether they are up — and the rest is a hover
	// card. The strip IS the initiative order: it is drawn in chair order, left to
	// right, and the one who is up is lit. That is the same information the R1/B1/
	// R2/B2 pips carried, said with faces instead of codes, which is why those pips
	// are gone from `TopClock` rather than sitting above this saying it twice.
	//
	// Hover, not click. A roster is something you consult mid-decision, with a card
	// already picked up — a panel you have to open and then close is a modal in the
	// middle of your turn, and the clock does not stop for it.
	import { Figure, Icon, Tooltip } from 'showcase';
	import { SKILL_GLYPH } from '$examples/breach/parts/skill-glyphs.js';
	import {
		SKILL_LABEL,
		TERRITORIES,
		klassByKey,
		type Skill
	} from '$examples/breach/internal/rules.js';
	import type { BreachMatch } from '$examples/breach/internal/match.svelte.js';
	import TeamFlag from '$examples/breach/hud/TeamFlag.svelte';
	import { PLATE_SHADOW_UP, gemEdge, gemFill, plateFill } from './hud-state.js';

	interface Props {
		match: BreachMatch;
	}

	let { match }: Props = $props();

	const seats = $derived(match.presence.seats);

	// The stack's three relation hues, kept verbatim. A seat's own colour cannot
	// carry this — the Maintainer is pink and so is an enemy.
	const ENEMY_HUE = '#FB7185';
	const ALLY_HUE = '#34D399';

	const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

	let open = $state<string | null>(null);

	/** Where they were last known to be, in the fewest words that are honest. */
	function seenAt(quietFor: number | null, focus: string | null): string {
		if (focus === null || quietFor === null) return 'never surfaced';
		const where = TERRITORIES[focus as keyof typeof TERRITORIES]?.name ?? focus;
		return quietFor === 0 ? where : `${where} · ${quietFor}r ago`;
	}
</script>

<div class="pointer-events-auto flex w-[480px] items-stretch gap-1.5">
	{#each seats as seat (seat.key)}
		{@const k = klassByKey(seat.key)}
		{@const you = seat.relation === 'self'}
		{@const enemy = seat.relation === 'enemy'}
		{@const edge = you ? 'var(--accent)' : enemy ? ENEMY_HUE : ALLY_HUE}
		{@const up = seat.active}
		<div
			role="group"
			class="relative flex-1"
			onmouseenter={() => (open = seat.key)}
			onmouseleave={() => (open = null)}
		>
			<!-- ── The chip ──────────────────────────────────────────────────────
			     Focusable, because a hover card that only answers to a pointer is a
			     panel a keyboard cannot read at all — and this one holds the only
			     copy of the skills now. -->
			<button
				type="button"
				class="flex w-full items-center gap-1.5 overflow-hidden rounded-[10px] border py-1 pr-1.5 pl-2 text-left transition-colors"
				style:border-color={up ? `color-mix(in srgb, ${seat.color} 78%, transparent)` : 'var(--border)'}
				style:background={plateFill(seat.color, up ? 26 : 14)}
				style:box-shadow={up
					? `0 0 0 1px color-mix(in srgb, ${seat.color} 40%, transparent), inset 3px 0 0 0 ${edge}, 0 8px 20px rgba(0,0,0,0.5)`
					: `inset 3px 0 0 0 ${edge}`}
				onfocus={() => (open = seat.key)}
				onblur={() => (open = null)}
				aria-expanded={open === seat.key}
			>
				<span class="relative w-[26px] shrink-0">
					<span
						class="absolute inset-0 blur-[7px]"
						style:background={seat.color}
						style:clip-path={HEX}
						style:opacity={up ? 0.6 : 0.3}
					></span>
					<span
						class="relative grid h-[30px] w-[26px] place-items-center p-[1.5px]"
						style:clip-path={HEX}
						style:background="color-mix(in srgb, {seat.color} 70%, transparent)"
					>
						<span
							class="relative block h-full w-full overflow-hidden"
							style:clip-path={HEX}
							style:background="color-mix(in srgb, {seat.color} 18%, var(--bg-elev, #0b0f16))"
						>
							<span class="absolute inset-x-0 top-0 aspect-square">
								<Figure klass={k} crop="chip" />
							</span>
						</span>
					</span>
				</span>

				<span class="flex min-w-0 flex-1 flex-col gap-1">
					<span class="flex min-w-0 items-center gap-1">
						<TeamFlag faction={k.faction} class="shrink-0" />
						<b
							class="truncate font-mono text-[0.5rem] leading-none font-black tracking-[0.06em] uppercase"
							style:color={up ? seat.color : 'var(--fg-muted)'}
						>
							{seat.seat}
						</b>
					</span>

					<!-- AP as a rail, because it is the one number here that moves
					     inside a round and the only thing a glance is asking. -->
					<span class="flex items-center gap-[2px]">
						{#each { length: seat.apMax } as _, i (i)}
							<span
								class="h-[4px] flex-1"
								style:background={i < seat.ap
									? seat.color
									: 'color-mix(in srgb, var(--fg) 14%, transparent)'}
							></span>
						{/each}
					</span>
				</span>
			</button>

			<!-- Filled while it is theirs, hollow with the count of chairs until it
			     is — the hero card's power corner, at chip scale. -->
			<span
				class="pointer-events-none absolute -top-1 -right-1 grid h-[15px] min-w-[15px] place-items-center rounded-full border px-1.5 font-mono text-[0.44rem] leading-none font-black tracking-[0.12em] uppercase tabular-nums"
				style:color={up ? 'var(--bg-elev, #0b0f16)' : 'var(--fg-dim)'}
				style:border-color={up ? seat.color : 'var(--border)'}
				style:background={up ? seat.color : 'var(--bg-elev, #0b0f16)'}
				style:box-shadow={up ? `0 0 10px color-mix(in srgb, ${seat.color} 55%, transparent)` : 'none'}
			>
				{up ? 'now' : `+${seat.order}`}
			</span>

			<!-- ── The hover card ────────────────────────────────────────────────
			     Everything the rail used to hold permanently. It hangs BELOW the
			     strip and over the board, which is empty sky at the top of the
			     screen — the one place a 250px panel costs nothing. -->
			{#if open === seat.key}
				<div
					class="absolute top-full left-1/2 z-[40] mt-2 w-[248px] -translate-x-1/2 overflow-hidden rounded-[10px] border p-2.5"
					style:border-color="color-mix(in srgb, {seat.color} 60%, transparent)"
					style:background={plateFill(seat.color, 20)}
					style:box-shadow="inset 3px 0 0 0 {edge}, {PLATE_SHADOW_UP}"
				>
					<div class="flex items-center gap-2">
						<span class="relative w-[44px] shrink-0">
							<span
								class="absolute inset-x-[2px] inset-y-0 blur-[9px]"
								style:background={seat.color}
								style:clip-path={HEX}
								style:opacity="0.5"
							></span>
							<span
								class="relative mx-auto grid h-[48px] w-[42px] place-items-center p-[1.5px]"
								style:clip-path={HEX}
								style:background="color-mix(in srgb, {seat.color} 70%, transparent)"
							>
								<span
									class="relative block h-full w-full overflow-hidden"
									style:clip-path={HEX}
									style:background="color-mix(in srgb, {seat.color} 18%, var(--bg-elev, #0b0f16))"
								>
									<span class="absolute inset-x-0 top-0 aspect-square">
										<Figure klass={k} crop="bust" />
									</span>
								</span>
							</span>
						</span>

						<span class="flex min-w-0 flex-1 flex-col gap-1">
							<b
								class="truncate font-mono text-[0.7rem] leading-none font-black"
								style:color={you ? seat.color : 'var(--fg)'}
							>
								{you ? 'you' : (seat.player ?? (seat.automatic ? 'demonstrator' : 'waiting'))}
							</b>
							<span
								class="truncate font-mono text-[0.5rem] tracking-[0.22em] text-[var(--fg-dim)] uppercase"
							>
								{seat.name}
							</span>
							<span class="flex items-center gap-1.5">
								<TeamFlag faction={k.faction} showName />
							</span>
						</span>
					</div>

					<div class="mt-2 flex items-center justify-between gap-2">
						<span class="font-mono text-[0.5rem] tracking-[0.22em] text-[var(--fg-dim)] uppercase">
							{up ? 'acting now' : `${seat.order} chair${seat.order === 1 ? '' : 's'} away`}
						</span>
						<span class="flex items-baseline gap-1" style:color={seat.color}>
							<b class="font-mono text-[0.72rem] leading-none font-black tabular-nums">
								{seat.ap}/{seat.apMax}
							</b>
							<span class="font-mono text-[0.44rem] tracking-[0.12em] uppercase opacity-80">ap</span>
						</span>
					</div>

					<!-- The four glyphs the cards roll against, at the size the rail
					     drew them — this is the only copy of them now. -->
					<div class="mt-2 flex flex-wrap items-center gap-1.5">
						{#each Object.keys(k.skills) as Skill[] as skill (skill)}
							{@const v = k.skills[skill]}
							<Tooltip placement="bottom">
								{#snippet tip()}
									<b
										class="font-mono text-[0.6rem] tracking-[0.14em] uppercase"
										style:color={seat.color}
									>
										{SKILL_LABEL[skill]} {v >= 0 ? '+' : ''}{v}
									</b>
								{/snippet}
								<span
									class="flex items-center gap-1 border-b-2 pr-2 pb-0.5"
									style:color={v > 0 ? seat.color : v < 0 ? ENEMY_HUE : 'var(--fg-dim)'}
									style:border-color={v > 0
										? seat.color
										: v < 0
											? ENEMY_HUE
											: 'color-mix(in srgb, var(--fg) 14%, transparent)'}
								>
									<Icon name={SKILL_GLYPH[skill]} size={12} />
									<b class="font-mono text-[0.68rem] leading-none font-black tabular-nums">
										{v >= 0 ? '+' : ''}{v}
									</b>
								</span>
							</Tooltip>
						{/each}
					</div>

					<div
						class="mt-2 truncate font-mono text-[0.5rem] tracking-[0.12em] text-[var(--fg-dim)] uppercase"
					>
						last seen · {seenAt(seat.quietFor, seat.focus)}
					</div>
				</div>
			{/if}
		</div>
	{/each}
</div>
