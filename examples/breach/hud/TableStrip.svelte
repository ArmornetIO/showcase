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
	import { Figure, Icon, Tooltip, type IconName } from 'showcase';
	import Pips from '$lib/display/progress/Pips.svelte';
	import { SKILL_GLYPH } from '$examples/breach/parts/skill-glyphs.js';
	import {
		SKILL_LABEL,
		TERRITORIES,
		klassByKey,
		powerOf,
		type Faction,
		type Skill
	} from '$examples/breach/internal/rules.js';
	import { fxFor } from '$examples/breach/internal/fx.js';
	import type { BreachMatch } from '$examples/breach/internal/match.svelte.js';
	import TeamFlag from '$examples/breach/hud/TeamFlag.svelte';
	import { PLATE_SHADOW_UP, gemEdge, gemFill, plateFill } from './hud-state.js';

	interface Props {
		match: BreachMatch;
		/** One side's chairs. The strip is drawn twice — reds to the left of the
		 *  scoreboard, blues to the right — so the two teams sit either side of the
		 *  score the way they do on every fixture board ever printed. In chair
		 *  order within the side, which is the order `presence.seats` is already in. */
		faction: Faction;
	}

	let { match, faction }: Props = $props();

	const seats = $derived(match.presence.seats.filter((s) => klassByKey(s.key).faction === faction));

	// The stack's three relation hues, kept verbatim. A seat's own colour cannot
	// carry this — the Maintainer is pink and so is an enemy.
	const ENEMY_HUE = '#FB7185';
	const ALLY_HUE = '#34D399';

	const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

	let open = $state<string | null>(null);

	/** The name you would use out loud. `player` for a human, the demonstrator for
	 *  a seat the autoplayer is holding, and `waiting` for an empty chair — the
	 *  same three cases the stack and the feed already write. */
	const nameOf = (seat: { relation: string; player: string | null; automatic: boolean }) =>
		seat.relation === 'self' ? 'you' : (seat.player ?? (seat.automatic ? 'demonstrator' : 'waiting'));

	/** Where they were last known to be, in the fewest words that are honest. */
	function seenAt(quietFor: number | null, focus: string | null): string {
		if (focus === null || quietFor === null) return 'never surfaced';
		const where = TERRITORIES[focus as keyof typeof TERRITORIES]?.name ?? focus;
		return quietFor === 0 ? where : `${where} · ${quietFor}r ago`;
	}
</script>

<div class="pointer-events-auto flex items-stretch gap-1.5">
	{#each seats as seat (seat.key)}
		{@const k = klassByKey(seat.key)}
		{@const you = seat.relation === 'self'}
		{@const enemy = seat.relation === 'enemy'}
		{@const edge = you ? 'var(--accent)' : enemy ? ENEMY_HUE : ALLY_HUE}
		{@const up = seat.active}
		{@const power = powerOf(seat.key)}
		<div
			role="group"
			class="relative w-[152px]"
			onmouseenter={() => (open = seat.key)}
			onmouseleave={() => (open = null)}
		>
			<!-- ── The chip ──────────────────────────────────────────────────────
			     Focusable, because a hover card that only answers to a pointer is a
			     panel a keyboard cannot read at all — and this one holds the only
			     copy of the skills now. -->
			<button
				type="button"
				class="flex w-full flex-col overflow-hidden rounded-[10px] border text-left transition-colors"
				style:border-color={up ? `color-mix(in srgb, ${seat.color} 78%, transparent)` : 'var(--border)'}
				style:background={plateFill(seat.color, up ? 26 : 14)}
				style:box-shadow={up
					? `0 0 0 1px color-mix(in srgb, ${seat.color} 40%, transparent), inset 3px 0 0 0 ${edge}, 0 8px 20px rgba(0,0,0,0.5)`
					: `inset 3px 0 0 0 ${edge}`}
				onfocus={() => (open = seat.key)}
				onblur={() => (open = null)}
				aria-expanded={open === seat.key}
			>
				<!-- ── The tab ───────────────────────────────────────────────────────
				     The person's name, on the card's own tab, above the head it belongs
				     to. It was inline beside the portrait, sharing a 150px row with the
				     flag, the seat code, the AP rail and the signature glyph — five
				     things on one line, so the one you actually call them by was the
				     first to truncate.

				     A tab because the card already has one everywhere else in this game:
				     the buildings wear `LINK 1` on their top edge and the cards in hand
				     wear their kind there. Filling it is what the header does on a
				     building row, and it is the reason the name is legible at 0.56rem. -->
				<span
					class="flex w-full min-w-0 items-center gap-1 px-2 py-[3px]"
					style:background="color-mix(in srgb, {seat.color} {up ? 42 : 20}%, var(--bg-elev, #0b0f16))"
					style:transition="background 200ms ease"
				>
					<TeamFlag faction={k.faction} class="shrink-0" />
					<!-- White, always. It was the seat's own hue on a tint of that same
					     hue — a pink name on a pink tab — which is the one contrast
					     pairing this palette cannot make legible at 0.56rem. The tab is
					     already the colour; the text does not need to be it too. -->
					<b
						class="min-w-0 flex-1 truncate font-mono text-[0.56rem] leading-none font-black text-[var(--fg)]"
						title={`${nameOf(seat)} — playing ${seat.name} (${seat.seat})`}
					>
						{nameOf(seat)}
					</b>

					<!-- WHEN THEY ACT, on the tab rather than hanging off the corner.
					     It was a floating gem at `-top-1 -right-1`, which is the card
					     idiom — but a gem OVER a tab covers the tab, and what it covered
					     was the end of the header line. In the tab it is a word on a
					     line of words, and the line has somewhere to put it.

					     The seat codes that used to sit here are gone. `R1` labelled a
					     chair in a fixed order the strip already draws left to right,
					     next to a face and a name that identify the same seat better
					     than a code can. It survives in the chip's title for anyone
					     reading the board by seat. -->
					<span
						class="grid h-[13px] shrink-0 place-items-center rounded-full px-1.5 font-mono text-[0.44rem] leading-none font-black tracking-[0.12em] uppercase tabular-nums"
						style:color={up ? 'var(--bg-elev, #0b0f16)' : 'var(--fg-dim)'}
						style:background={up ? seat.color : 'color-mix(in srgb, var(--fg) 10%, transparent)'}
						style:box-shadow={up
							? `0 0 10px color-mix(in srgb, ${seat.color} 55%, transparent)`
							: 'none'}
						title={up ? 'acting now' : `${seat.order} chair${seat.order === 1 ? '' : 's'} until they act`}
					>
						{up ? 'now' : `+${seat.order}`}
					</span>
				</span>

				<span class="flex w-full items-center gap-1.5 py-1 pr-1.5 pl-2">
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
					<!-- The CHARACTER, under the person on the tab — the same order the
					     stack settled on. The archetype is fixed for the match and the
					     person is what changes, so the person gets the tab and this is
					     the caption. -->
					<span
						class="truncate font-mono text-[0.5rem] leading-none font-black tracking-[0.12em] text-[var(--fg)] uppercase"
					>
						{seat.name.replace(/^The /, '')}
					</span>

					<span class="flex items-center gap-1.5">
						<!-- AP as a rail, because it is the one number here that moves
						     inside a round and the only thing a glance is asking. -->
						<span class="flex min-w-0 flex-1 items-center gap-[2px]">
							{#each { length: seat.apMax } as _, i (i)}
								<span
									class="h-[4px] flex-1"
									style:background={i < seat.ap
										? seat.color
										: 'color-mix(in srgb, var(--fg) 14%, transparent)'}
								></span>
							{/each}
						</span>

						<!-- ── Their signature ──────────────────────────────────────
						     The one move that is not in anybody's hand, drawn in its own
						     hue so the four chips are told apart by MARK as well as by
						     colour — which matters at 26px, where two red portraits are
						     two red portraits.

						     Whether it is still charged is shown for your own side only.
						     What a seat COULD do is printed in the rulebook and the stack
						     has always drawn enemy skills; what they have SPENT is a move
						     that may never have surfaced, and the fog is the one thing on
						     this HUD that is never worth a convenience. -->
						{#if power}
							{@const pfx = fxFor(power.key, k.faction)}
							{@const known = seat.relation !== 'enemy'}
							{@const spent = known && match.chargesOf(power.key) <= 0}
							<span
								class="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border"
								style:color={spent ? 'var(--fg-dim)' : pfx.hue}
								style:border-color={spent
									? 'color-mix(in srgb, var(--fg) 14%, transparent)'
									: gemEdge(pfx.hue)}
								style:background={spent
									? 'repeating-linear-gradient(45deg, transparent 0 3px, color-mix(in srgb, var(--fg) 10%, transparent) 3px 6px)'
									: gemFill(pfx.hue)}
								title="{power.name}{spent ? ' — spent' : ''}"
							>
								<Icon name={pfx.icon as IconName} size={9} />
							</span>
						{/if}
					</span>
				</span>
				</span>
			</button>

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
								{nameOf(seat)}
							</b>
							<span
								class="truncate font-mono text-[0.5rem] font-black tracking-[0.22em] text-[var(--fg)] uppercase"
							>
								{seat.name}
							</span>
							<span class="flex items-center gap-1.5">
								<TeamFlag faction={k.faction} showName />
							</span>
						</span>
					</div>

					<div class="mt-2 flex items-center justify-between gap-2">
						<span class="font-mono text-[0.5rem] font-black tracking-[0.22em] text-[var(--fg)] uppercase">
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

					<!-- ── Their signature, in full ──────────────────────────────
					     The chip carries the glyph so the strip can be read without
					     stopping; this is the card that says what it DOES, which is the
					     whole reason to stop. -->
					{#if power}
						{@const pfx = fxFor(power.key, k.faction)}
						{@const known = seat.relation !== 'enemy'}
						{@const charges = match.chargesOf(power.key)}
						{@const spent = known && charges <= 0}
						<div
							class="relative mt-2 flex items-center gap-2 overflow-hidden rounded-[8px] border px-2 py-1.5"
							style:color={spent ? 'var(--fg-dim)' : pfx.hue}
							style:border-color={spent
								? 'color-mix(in srgb, var(--fg) 14%, transparent)'
								: gemEdge(pfx.hue)}
							style:background={spent
								? 'repeating-linear-gradient(45deg, transparent 0 5px, color-mix(in srgb, var(--fg) 8%, transparent) 5px 10px)'
								: plateFill(pfx.hue, 22)}
						>
							<span
								class="absolute inset-y-0 left-0 w-[3px]"
								style:background={spent ? 'color-mix(in srgb, var(--fg) 20%, transparent)' : pfx.hue}
							></span>
							<span class="shrink-0"><Icon name={pfx.icon as IconName} size={14} /></span>
							<span class="flex min-w-0 flex-1 flex-col gap-1">
								<b
									class="truncate font-mono text-[0.58rem] leading-none font-black tracking-[0.06em] uppercase"
								>
									{power.name}
								</b>
								<span
									class="font-mono text-[0.44rem] leading-none font-black tracking-[0.12em] text-[var(--fg)] uppercase"
								>
									signature · {power.ap} ap
								</span>
							</span>
							{#if known}
								<!-- Charges for your own side only. What a seat could do is in
								     the rulebook; what they have spent is a move that may
								     never have surfaced. -->
								<Pips
									total={power.uses}
									filled={charges}
									shape="diamond"
									size={7}
									gap={2}
									color={spent ? 'var(--fg-dim)' : pfx.hue}
								/>
							{/if}
						</div>
					{/if}

					<div
						class="mt-2 truncate font-mono text-[0.5rem] font-black tracking-[0.12em] text-[var(--fg)] uppercase"
					>
						last seen · {seenAt(seat.quietFor, seat.focus)}
					</div>
				</div>
			{/if}
		</div>
	{/each}
</div>
