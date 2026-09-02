<script lang="ts">
	// ── My seat ──────────────────────────────────────────────────────────────────
	// Everything the dais used to hold in the middle of the screen, moved to the
	// corner and given WORDS.
	//
	// The dais was a medallion: rings, sigils and glyphs, every one of them
	// carrying its meaning in a `title` attribute. That is fine for the two or
	// three marks a player checks every turn and wrong for the rest — a zap sigil
	// that turns out to be a named passive, a bare numeral that turns out to be
	// REP, and three grey squares reading 3/6/9 that never explained themselves at
	// all. Tooltips are not a legend; they are a legend you have to go looking for
	// one item at a time.
	//
	// So: same numbers, same glyphs, same hues, but every one of them reachable —
	// each dial names itself in a real tooltip instead of a native `title`, and
	// what used to be six labelled rows is one line of six circles.
	//
	// The rule that got it there: a thing keeps its own row only if you need it at
	// a glance. A meter does. The passive does not — it is always on and never
	// changes for the whole match, so it is a sigil on the name. The skills did
	// not either, and they are gone entirely; see the gap below for why.
	import { Icon, Panel, RadialProgress, Tooltip, type IconName } from 'showcase';
	import { fxFor } from '../internal/fx.js';
	import { UPGRADE_KIND } from '../internal/upgrades.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
	}

	let { match }: Props = $props();

	const seat = $derived(match.seat);
	const live = $derived(match.stage === 'play' && !match.winner && match.isMyTurn);

	const frac = $derived(match.turnLeft / match.turnMs);
	const clockTone = $derived(frac > 0.4 ? seat.color : frac > 0.17 ? '#FBBF24' : '#FB7185');
	const standTone = $derived(
		match.standing > 60 ? '#34D399' : match.standing > 30 ? '#FBBF24' : '#FB7185'
	);

	const power = $derived(match.power);
	const spent = $derived(match.powerCharges <= 0);
	const powerArmable = $derived(
		!!power &&
			!spent &&
			live &&
			!match.busy &&
			!match.pending &&
			(match.ap[seat.key] ?? 0) >= power.ap
	);

	// Same hexagon crest as the stack in the other corner. One character, one
	// shape, wherever they are drawn.
	const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
</script>

{#snippet seatTag()}
	<span class="font-mono text-[0.5rem] tracking-widest uppercase" style:color={seat.color}>
		{seat.seat} · {live ? 'your turn' : 'waiting'}
	</span>
{/snippet}

<!-- One meter, as a dial. The same tile the progression slots use — the panel has
     one shape for "a number with a ceiling" rather than two, which is what let
     both sets end up on the same line.
     The glyph is what names it, and that is the part the old labelled rows needed
     a 4.6rem label column to do. -->
{#snippet dial(
	icon: IconName,
	value: number,
	max: number,
	badge: string,
	hue: string,
	variant: 'accent' | 'success' | 'warn' | 'error' | 'default',
	label: string,
	body: string
)}
	<Tooltip placement="top">
		{#snippet tip()}
			<span class="flex flex-col gap-1">
				<b class="font-mono text-[0.6rem] uppercase tracking-[0.14em]" style:color={hue}>
					{label} {badge}
				</b>
				<span class="text-[0.62rem] leading-snug">{body}</span>
			</span>
		{/snippet}
		<div class="relative grid h-[42px] w-[42px] place-items-center">
			<RadialProgress {value} {max} size={42} strokeWidth={3} {variant} showPercent={false} />
			<span class="absolute" style:color={hue}><Icon name={icon} size={15} /></span>
			<b
				class="absolute -bottom-0.5 -right-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full px-1
				       font-mono text-[0.5rem] font-black leading-none tabular-nums"
				style:color="var(--bg-elev, #0b0f16)"
				style:background={hue}
			>
				{badge}
			</b>
		</div>
	</Tooltip>
{/snippet}

<Panel title="my seat" padding="dense" actions={seatTag} class="pointer-events-auto">
	<div class="flex flex-col gap-2">
		<!-- ── Who ────────────────────────────────────────────────────────────── -->
		<div class="flex items-center gap-2.5">
			<div class="relative w-[42px] shrink-0">
				<span
					class="absolute inset-0 blur-[9px]"
					style:background={seat.color}
					style:clip-path={HEX}
					style:opacity={live ? 0.55 : 0.25}
				></span>
				<div
					class="relative grid h-[48px] place-items-center p-[1.5px]"
					style:clip-path={HEX}
					style:background="color-mix(in srgb, {seat.color} {live ? 80 : 45}%, transparent)"
				>
					<div
						class="grid h-full w-full place-items-center"
						style:clip-path={HEX}
						style:color={seat.color}
						style:background="color-mix(in srgb, {seat.color} {live
							? 26
							: 12}%, var(--bg-elev, #0b0f16))"
					>
						<Icon name={seat.icon as IconName} size={20} />
					</div>
				</div>
			</div>

			<div class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="flex items-center gap-1.5">
					<span
						class="min-w-0 truncate font-mono text-[0.7rem] font-black leading-none"
						style:color={seat.color}
					>
						{seat.name}
					</span>
					<!-- ── Passive ──────────────────────────────────────────────────
					     A sigil beside the name rather than a bordered block below it.
					     It is a rule that is ALWAYS running and never changes for the
					     whole match — so it is the one thing on this panel that does
					     not need to be readable at a glance, and the two lines it was
					     taking are two lines the six dials wanted.
					     It belongs on the name because that is what it is a property
					     OF: you do not have a passive, the Maintainer does. -->
					<Tooltip placement="bottom">
						{#snippet tip()}
							<span class="flex flex-col gap-1">
								<b
									class="font-mono text-[0.6rem] uppercase tracking-[0.14em]"
									style:color={seat.color}
								>
									passive · {seat.passive.name}
								</b>
								<span class="text-[0.62rem] leading-snug">{seat.passive.text}</span>
								<span class="font-mono text-[0.56rem] leading-snug text-[var(--fg-dim)]">
									Always on. Nothing spends it and nothing switches it off.
								</span>
							</span>
						{/snippet}
						<span
							class="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full border"
							style:color={seat.color}
							style:border-color="color-mix(in srgb, {seat.color} 50%, transparent)"
							style:background="color-mix(in srgb, {seat.color} 14%, transparent)"
						>
							<Icon name="zap" size={9} />
						</span>
					</Tooltip>
				</span>
				<span class="font-mono text-[0.46rem] tracking-[0.1em] uppercase text-[var(--fg-dim)]">
					{seat.faction} side · round {match.round} of 12
				</span>
				<!-- The turn clock, as a bar with the seconds written on it. It was
				     the outer ring, and a ring cannot say "29s". -->
				<div class="mt-0.5 flex items-center gap-1.5">
					<span class="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--surface-strong)]">
						<span
							class="block h-full rounded-full"
							style:width="{Math.round((live ? frac : 0) * 100)}%"
							style:background={clockTone}
							style:transition="width 200ms linear"
						></span>
					</span>
					<b class="font-mono text-[0.5rem] font-black tabular-nums" style:color={clockTone}>
						{live ? `${Math.ceil(match.turnLeft / 1000)}s` : '—'}
					</b>
				</div>
			</div>
		</div>

		<div class="h-px bg-[var(--border)]"></div>

		<!-- ── No skills row ───────────────────────────────────────────────────────
		     There was one here. It is gone, and the five-line tooltip that had to
		     prop it up went with it.

		     A skill is not a decision. You never pick one — you pick a CARD, and
		     the card decides which skill it rolls on. So `OPS +1` is an input to a
		     sum you cannot influence, and the sum is already printed twice, both
		     times closer to the moment you act: `CardFace` puts your modifier for
		     that skill on the face of every card that uses it, and the action bar
		     shows the finished throw — `2d6 +1 OPS +1 CARD vs 8 · 58%`.

		     Needing a legend was the tell. Four abstract numbers, none of them
		     actionable, none of them reachable except through a card that was
		     already showing you the one that mattered.

		     The `rollBonus` upgrades add to these is not lost — the progression
		     dials name each upgrade and what it is worth.

		     Other people's skills DO survive, in the hero stack — you cannot see
		     an enemy's hand, so their spread is the only read you get on what they
		     are dangerous at. There the number IS the information. -->

		<!-- ── Six dials, one line ────────────────────────────────────────────────
		     Three labelled rows became three dials, and then the progression slots
		     joined them. Each meter used to be a label column, a track and a figure
		     — nearly forty pixels of height to say one number, with the label doing
		     all the work because a bare track never said WHICH meter it was. The
		     glyph says it now.
		     Left to right: what I have this round, then what is coming. The rule in
		     the middle is the only thing separating them, because they answer
		     different questions and a run of six identical circles would not admit
		     it. -->
		<div class="flex items-center justify-between gap-1">
			{@render dial(
				'plus',
				match.ap[seat.key] ?? 0,
				match.maxAp(),
				`${match.ap[seat.key] ?? 0}/${match.maxAp()}`,
				seat.color,
				(match.ap[seat.key] ?? 0) > 0 ? 'accent' : 'error',
				'action points',
				`What you have left to spend this round. Refills to ${match.maxAp()} at the top of every round — unspent points do not carry.`
			)}

			<!-- `standingLabel` is the game's own word for it: exposure for red,
			     estate for blue. It was nowhere on screen before this panel. -->
			{@render dial(
				seat.faction === 'red' ? 'eye' : 'shield',
				match.standing,
				100,
				String(match.standing),
				standTone,
				match.standing > 60 ? 'success' : match.standing > 30 ? 'warn' : 'error',
				match.standingLabel,
				seat.faction === 'red'
					? 'How intact your cover is across the whole board. It falls as regions go loud, and it is the number blue is trying to push down.'
					: 'How much of your estate is still provably yours. It falls as red takes and holds ground.'
			)}

			<!-- The pool is uncapped, but only THREE of it can ever ride a roll —
			     `Math.min(res, 3)` in `oddsFor`. So the ring is against 3, which is
			     the number that actually decides anything, and the badge carries the
			     true total. A ring against the raw pool would fill forever and mean
			     less every round. -->
			{@render dial(
				'users',
				Math.min(match.res[seat.key] ?? 0, 3),
				3,
				String(match.res[seat.key] ?? 0),
				seat.color,
				(match.res[seat.key] ?? 0) > 0 ? 'accent' : 'default',
				seat.resource,
				seat.faction === 'red'
					? `You hold ${match.res[seat.key] ?? 0}. Only 3 ever rides a single roll, so the ring fills against 3 rather than the pile.`
					: `Held, and read by nothing. Only the Maintainer's REP is wired into a roll — this is printed on the sheet and goes no further.`
			)}

			<span class="mx-0.5 h-7 w-px shrink-0 bg-[var(--border)]"></span>

			<!-- ── Progression ────────────────────────────────────────────────
			     Same dials, same row. Three stacked rows became three slots, and
			     then the slots joined the meters: six circles reading left to
			     right as "what I have now" then "what is coming", which is the
			     order a player actually asks them in.
			     The ring is `RadialProgress` rather than a hand-drawn arc — a
			     countdown to a round is a progress value, and this is the
			     component for one. -->
			{#each match.track() as upgrade (upgrade.key)}
					{@const open = match.round >= upgrade.at}
					{@const kind = UPGRADE_KIND[upgrade.kind]}
					{@const away = Math.max(0, upgrade.at - match.round)}
					<Tooltip placement="top">
						{#snippet tip()}
							<span class="flex flex-col gap-1">
								<b
									class="font-mono text-[0.6rem] uppercase tracking-[0.14em]"
									style:color={open ? kind.hue : 'var(--fg-dim)'}
								>
									{upgrade.name}
								</b>
								<span class="text-[0.62rem] leading-snug">{upgrade.text}</span>
								<span class="font-mono text-[0.56rem] leading-snug text-[var(--fg-dim)]">
									{open
										? `Online since round ${upgrade.at} — +${upgrade.value} ${kind.label}.`
										: `Unlocks at round ${upgrade.at}: ${away} round${away === 1 ? '' : 's'} away. Nothing buys it sooner.`}
								</span>
							</span>
						{/snippet}
						<div class="relative grid h-[42px] w-[42px] place-items-center">
							<!-- Full once it is online; a countdown before that. The value
							     is ROUNDS, not a percentage, which is why the readout in the
							     middle is a glyph and not a number.
							     NOT `variant="default"` while locked: that stroke is
							     `--fg-dim`, the same grey as the track behind it, so the arc
							     vanished and every locked slot read as a finished circle —
							     the countdown, drawn invisibly. Amber for coming, green for
							     online. -->
							<RadialProgress
								value={open ? upgrade.at : match.round}
								max={upgrade.at}
								size={42}
								strokeWidth={3}
								variant={open ? 'success' : 'warn'}
								showPercent={false}
							/>
							<!-- The kind, in the kind's own hue. `variant` is a fixed
							     five-colour palette and the upgrade kinds are not in it, so
							     the hue rides the glyph rather than being approximated by
							     the nearest ring colour. -->
							<span
								class="absolute"
								style:color={open ? kind.hue : 'color-mix(in srgb, var(--fg) 30%, transparent)'}
							>
								<Icon name={(open ? upgrade.icon : 'lock') as IconName} size={15} />
							</span>
							<!-- What it is worth, on the corner — the same place a card wears
							     its power and the dais wore this. -->
							{#if open}
								<b
									class="absolute -bottom-0.5 -right-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full px-1
									       font-mono text-[0.5rem] font-black leading-none tabular-nums"
									style:color="var(--bg-elev, #0b0f16)"
									style:background={kind.hue}
								>
									+{upgrade.value}
								</b>
							{:else}
								<b
									class="absolute -bottom-0.5 -right-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full border px-1
									       font-mono text-[0.5rem] font-black leading-none tabular-nums text-[var(--fg-dim)]"
									style:border-color="var(--border)"
									style:background="var(--bg-elev, #0b0f16)"
								>
									{upgrade.at}
								</b>
							{/if}
						</div>
					</Tooltip>
			{/each}
		</div>

		<!-- ── Hero power ─────────────────────────────────────────────────────────
		     A move with no pile to sit in, so it lives on the sheet. It was a 36px
		     glyph; it is a card's worth of information, so it gets a card's row. -->
		{#if power}
			{@const fx = fxFor(power.key, seat.faction)}
			{@const armed = match.armedKey === power.key}
			<button
				type="button"
				disabled={!powerArmable}
				onclick={() => {
					match.armedKey = power.key;
					match.inspectKey = power.key;
				}}
				class="flex w-full items-center gap-2 rounded-md border-2 px-1.5 py-1.5 text-left transition-all
				       disabled:cursor-default"
				style:color={spent ? 'color-mix(in srgb, var(--fg) 25%, transparent)' : fx.hue}
				style:border-color={spent
					? 'color-mix(in srgb, var(--fg) 12%, transparent)'
					: `color-mix(in srgb, ${fx.hue} ${armed ? 90 : 50}%, transparent)`}
				style:background={spent
					? 'color-mix(in srgb, var(--fg) 4%, transparent)'
					: `color-mix(in srgb, ${fx.hue} ${armed ? 24 : 12}%, var(--bg-elev, #0b0f16))`}
				style:box-shadow={armed ? `0 0 16px color-mix(in srgb, ${fx.hue} 40%, transparent)` : 'none'}
				style:opacity={spent || armed || powerArmable ? 1 : 0.6}
				title={power.text}
			>
				<span class="grid h-7 w-7 shrink-0 place-items-center rounded border"
					style:border-color="color-mix(in srgb, {fx.hue} 45%, transparent)"
					style:background="color-mix(in srgb, {fx.hue} 14%, transparent)"
				>
					<Icon name={fx.icon as IconName} size={14} />
				</span>
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="font-mono text-[0.46rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]">
						hero power
					</span>
					<span class="truncate font-mono text-[0.6rem] font-black leading-none">
						{power.name}
					</span>
				</span>
				<span class="flex shrink-0 flex-col items-end gap-0.5">
					<b class="font-mono text-[0.55rem] font-black tabular-nums leading-none">
						{power.ap} AP
					</b>
					<span class="font-mono text-[0.44rem] tracking-[0.1em] uppercase text-[var(--fg-dim)]">
						{spent ? 'spent' : `${match.powerCharges} charge${match.powerCharges === 1 ? '' : 's'}`}
					</span>
				</span>
			</button>
		{/if}
	</div>
</Panel>
