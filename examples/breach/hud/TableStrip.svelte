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
	import { Figure, Icon, Pips, Tooltip, type IconName } from 'showcase';
	import { kitFor } from './kit.js';
	import { SKILL_GLYPH } from '../parts/skill-glyphs.js';
	import {
		SKILL_LABEL,
		TERRITORIES,
		klassByKey,
		powerOf,
		type Faction,
		type Skill
	} from '../internal/rules.js';
	import { fxFor } from '../internal/fx.js';
	import type { BreachMatch } from '../internal/match.svelte.js';
	import TeamFlag from './TeamFlag.svelte';
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

<!-- One stat: the number, then its unit beneath in the caption size. `items-end`
     at the call site aligns the numerals' baselines across the row rather than
     the blocks' tops, which is what stops `NOW` and `3` from stepping. -->
{#snippet stat(value: string, unit: string, tone: string)}
	<span class="flex shrink-0 flex-col items-start gap-[3px]">
		<b
			class="font-mono text-[0.72rem] leading-none font-black tabular-nums uppercase"
			style:color={tone}
		>
			{value}
		</b>
		<span
			class="font-mono text-[0.44rem] leading-none font-black tracking-[0.14em] text-[var(--fg-dim)] uppercase"
		>
			{unit}
		</span>
	</span>
{/snippet}

<div class="pointer-events-auto flex items-stretch gap-1.5">
	{#each seats as seat (seat.key)}
		{@const k = klassByKey(seat.key)}
		{@const you = seat.relation === 'self'}
		{@const enemy = seat.relation === 'enemy'}
		{@const edge = you ? 'var(--accent)' : enemy ? ENEMY_HUE : ALLY_HUE}
		{@const up = seat.active}
		{@const power = powerOf(seat.key)}
		{@const kit = kitFor(k.key)}
		<div
			role="group"
			class="relative w-[168px]"
			onmouseenter={() => (open = seat.key)}
			onmouseleave={() => (open = null)}
		>
			<!-- ── The chip ──────────────────────────────────────────────────────
			     Focusable, because a hover card that only answers to a pointer is a
			     panel a keyboard cannot read at all — and this one holds the only
			     copy of the skills now.

			     NO EDGE SPINE. The rails draw one and so did this, as an `inset 3px`
			     shadow — which paints a square-ended bar across a 10px corner radius,
			     and at chip scale that reads as a block sitting ON the card rather
			     than an edge belonging to it. It was saying with-you / against-you,
			     which the strip now says by POSITION: your side is the pair left of
			     the scoreboard. -->
			<button
				type="button"
				class="flex w-full flex-col gap-1.5 rounded-[10px] border px-2.5 pt-3 pb-2 text-left transition-colors"
				style:border-color={up ? `color-mix(in srgb, ${seat.color} 78%, transparent)` : 'var(--border)'}
				style:background="linear-gradient(180deg,
					color-mix(in srgb, {seat.color} {up ? 46 : 26}%, transparent) 0px,
					color-mix(in srgb, {seat.color} {up ? 20 : 11}%, transparent) 22px,
					transparent 40px), {plateFill(seat.color, up ? 20 : 10)}"
				style:box-shadow={up
					? `0 0 0 1px color-mix(in srgb, ${seat.color} 40%, transparent), 0 8px 20px rgba(0,0,0,0.5)`
					: '0 6px 16px rgba(0,0,0,0.45)'}
				onfocus={() => (open = seat.key)}
				onblur={() => (open = null)}
				aria-expanded={open === seat.key}
			>
				<!-- ── The header ────────────────────────────────────────────────────
				     There is no header ELEMENT. A child span with its own fill is a
				     second rectangle inside a 10px radius however it is cut, and a rule
				     under it draws the same line again.

				     The header is painted onto the card itself: the first of the two
				     backgrounds on the button above is a vertical gradient that starts
				     at 26% of the seat's hue, is down to 11% by 22px — the bottom of
				     this line — and is gone by 40px. So the name sits in a lit band
				     that has no edges, because it is not a band; it is the card being
				     brighter where its title is. Lifts to 46% on the acting seat, which
				     is the same signal the border and the dot are already giving. -->
				<!-- ── One row, not two ──────────────────────────────────────────────
				     The portrait used to sit UNDER the name, which capped how tall it
				     could be: anything that cleared the card's top edge crossed the
				     name on the way. Beside the text it can be as tall as the card, so
				     the head clears the border with nothing in its path. -->
				<!-- ── The header ────────────────────────────────────────────────────
				     Banner, name and the acting dot, across the top of the card with
				     the flag in the corner — so the card is titled before it is read,
				     and the agent stands UNDER its own banner rather than beside it.

				     It could not be a row of its own while the head cleared the card's
				     top border: anything up there crossed the face on the way. The
				     figure sits inside the card now, so the top of the card is free
				     again and the header goes back where a header goes. -->
				<!-- The space under the header is the header's, not the card's: padded
				     here it stays put when the card's own bottom padding changes, and
				     the agent below keeps clear of the name at every card height. -->
				<span class="flex w-full min-w-0 items-center gap-1.5 pb-1.5">
					<TeamFlag faction={k.faction} class="shrink-0" />
					<b
						class="min-w-0 flex-1 truncate font-mono text-[0.64rem] leading-none font-black text-[var(--fg)]"
						style:text-shadow={up
							? `0 0 14px color-mix(in srgb, ${seat.color} 65%, transparent)`
							: 'none'}
						title={`${nameOf(seat)} — playing ${seat.name} (${seat.seat})`}
					>
						{nameOf(seat)}
					</b>

					<!-- Who is up, as one lit dot — the only thing besides the card's own
					     border carrying "now". -->
					<span
						class="h-[7px] w-[7px] shrink-0 rounded-full"
						style:background={up ? seat.color : 'color-mix(in srgb, var(--fg) 14%, transparent)'}
						style:box-shadow={up
							? `0 0 8px color-mix(in srgb, ${seat.color} 70%, transparent)`
							: 'none'}
						title={up ? 'acting now' : ''}
					></span>
				</span>

				<span class="flex w-full min-w-0 items-center gap-2">
				<!-- ── The socket, and the thing standing in it ──────────────────────
				     The hexagon is not a `clip-path` any more. It is a RING IN THE
				     WORLD — `crest.ts` — handed to `Figure` and drawn by the same
				     painter's pass as the body, so the rim lands in front of the chest
				     and behind the head because of where those things are, not because
				     a polygon said so.

				     The CSS version could only ever cut, and a cut is the wrong verb: a
				     window does not take your ears off when you lean out of it. Clipped
				     to the hole, a head crossing the opening lost everything outside it,
				     planed flat at exactly the hole's width. Every fix for that was a
				     wider hole, and past a certain width a hole is not a socket.

				     `-top` still carries the crown past the card's own top border and
				     `z-10` puts it over the header gradient. The card never clips, so
				     nothing has to be told to let the head through. -->
				<span class="relative h-[36px] w-[44px] shrink-0">

					<!-- No clip. The figure just stands here, and the ring it is
					     standing in comes down the `crest` option — one more solid in
					     the same assembly, culled, shaded and DEPTH-SORTED against the
					     body by the pass that was already doing that for its own arms.

					     `zoom` is how big the character is; the box is where it goes.
					     They are separate numbers now, which is the whole point — the
					     head stops being however wide the container happened to be.
					     The frame runs well past the feet and this box is what cuts it,
					     so what you see is head, shoulders and the ring across the
					     chest. The ring itself is NOT measured: `art` takes its bounds
					     off the body alone, so hanging scenery on a character never
					     reframes them. -->
					<!-- Shadow and glow, both off the SAME alpha.
					     `drop-shadow` takes the silhouette the crest and the figure make
					     together, so all three passes describe one object: a tight dark
					     one for contact, a wide soft one for lift, and a coloured one for
					     the light the crest is throwing.
					     The glow used to be a blurred `clip-path` hexagon in a span of its
					     own — a SECOND hexagon, 2D, at its own size, behind a 3D one. The
					     two never lined up, and what you saw at the bottom of every chip
					     was the flat one sticking out from under the real one. A glow has
					     to be cast BY the thing glowing or it is just another shape. -->
					<span
						class="pointer-events-none absolute -inset-x-[10px] -top-[8px] z-10 h-[40px]"
						style:filter="drop-shadow(0 1px 0.5px rgba(0,0,0,0.55)) drop-shadow(0 4px 6px rgba(0,0,0,0.45)) drop-shadow(0 0 {up
							? 7
							: 4}px color-mix(in srgb, {seat.color} {up ? 70 : 40}%, transparent))"
					>
						<!-- `crest: {}` takes the defaults, which are the ring's own
						     business — chest height, wider than the shoulders, leaning
						     back. The only thing this surface says about it is that it
						     wants one. -->
						<Figure
							klass={k}
							crop="bust"
							zoom={1.9}
							art={{ worn: kit, trim: seat.color, crest: {} }}
						/>
					</span>
				</span>

				<span class="flex min-w-0 flex-1 flex-col gap-1.5">
					<!-- Step two of the hierarchy: same weight as the name above, a step
					     down in size, and the seat's hue instead of white — so it reads
					     as the subtitle of the line above rather than a second heading. -->
					<span
						class="truncate font-mono text-[0.52rem] leading-none font-black tracking-[0.14em] uppercase"
						style:color="color-mix(in srgb, {seat.color} 75%, var(--fg))"
					>
						{seat.name.replace(/^The /, '')}
					</span>

					<!-- ── THE STAT LINE ────────────────────────────────────────────
					     Numeral first, unit under it, hairline between the columns: the
					     way a sports card, a Valorant scoreboard and an FM player panel
					     all lay out "a few small facts about one person". Both of these
					     were badges before — AP hanging off the portrait's corner and the
					     queue on the tab — and a badge says "notice me", which is wrong
					     for two numbers that are simply always there.

					     AP dims to `--fg-dim` at zero rather than turning red: spent is
					     the normal end state of a turn, not a fault. `UP` reads `NOW` in
					     the seat's hue on their turn and `+2` otherwise — the same value
					     the tab's pill carried, in the column where a number belongs. -->
					<span class="flex items-end gap-2">
						{@render stat(`${seat.ap}`, 'ap', seat.ap > 0 ? 'var(--fg)' : 'var(--fg-dim)')}
						<span class="h-[15px] w-px shrink-0 bg-[var(--border)]"></span>
						{@render stat(
							up ? 'now' : `+${seat.order}`,
							'up',
							up ? seat.color : 'var(--fg-muted)'
						)}

						<span class="min-w-0 flex-1"></span>

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
							<!-- `self-center`: the rest of the row is aligned on the
							     numerals' baseline, and a bordered square hung off that
							     baseline lands on the card's own border. -->
							<span
								class="grid h-[17px] w-[17px] shrink-0 self-center place-items-center rounded-[4px] border"
								style:color={spent ? 'var(--fg-dim)' : pfx.hue}
								style:border-color={spent
									? 'color-mix(in srgb, var(--fg) 14%, transparent)'
									: gemEdge(pfx.hue)}
								style:background={spent
									? 'repeating-linear-gradient(45deg, transparent 0 3px, color-mix(in srgb, var(--fg) 10%, transparent) 3px 6px)'
									: gemFill(pfx.hue)}
								title="{power.name}{spent ? ' — spent' : ''}"
							>
								<Icon name={pfx.icon as IconName} size={10} />
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
					style:box-shadow={PLATE_SHADOW_UP}
				>
					<!-- A real span, clipped by the card's own `overflow-hidden`, so the
					     stripe follows the corner instead of cutting across it. The card
					     is `absolute`, which makes it the containing block. -->
					<span class="absolute inset-y-0 left-0 w-[3px]" style:background={edge}></span>

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
										<Figure
											klass={k}
											crop="bust"
											art={{ worn: kitFor(k.key), trim: seat.color }}
										/>
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
