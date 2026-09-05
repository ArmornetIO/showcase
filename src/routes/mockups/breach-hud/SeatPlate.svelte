<script lang="ts">
	// ── THE MAST + THE LOADOUT ───────────────────────────────────────────────────
	// One plate, two sections, one spine.
	//
	// They used to be two Panels: two headers, two borders, two gutters — about
	// 34px of vertical space spent saying "these are different things", when they
	// are two halves of one question. "How long have I got" and "what have I got
	// to spend" are the same decision. So: one frame, one header, and a 2px rule
	// in the state colour where the border used to be.
	//
	// The mast reads `activeKlass` (whoever is on the clock) and the loadout reads
	// `seat` (you). They are NOT the same seat, and swapping them is the bug that
	// makes the plate lie during somebody else's turn.
	import { Figure, Icon, Tooltip, type IconName } from 'showcase';
	import Pips from '$lib/display/progress/Pips.svelte';
	import { klassByKey } from '$examples/breach/internal/rules.js';
	import TeamFlag from '$examples/breach/hud/TeamFlag.svelte';
	import { UPGRADE_KIND } from '$examples/breach/internal/upgrades.js';
	import { fxFor } from '$examples/breach/internal/fx.js';
	import type { BreachMatch } from '$examples/breach/internal/match.svelte.js';
	import { PLATE_SHADOW, gemEdge, gemFill, plateFill, type HudState } from './hud-state.js';

	interface Props {
		match: BreachMatch;
		state: HudState;
	}

	let { match, state }: Props = $props();

	const seat = $derived(match.seat);

	// Its own three-stop ramp, deliberately NOT the HUD state colour: standing
	// measures a different clock from the turn timer and must not go amber in
	// sympathy with it.
	const standTone = $derived(
		match.standing > 60 ? '#34D399' : match.standing > 30 ? '#FBBF24' : '#FB7185'
	);

	const power = $derived(match.power);
	const spent = $derived(match.powerCharges <= 0);
	const powerArmable = $derived(
		!!power &&
			!spent &&
			match.isMyTurn &&
			!match.busy &&
			!match.pending &&
			!match.winner &&
			(match.ap[seat.key] ?? 0) >= power.ap
	);

	const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
</script>

<!-- ── Content only ───────────────────────────────────────────────────────────
     This drew its own chamfered plate until the seat and the bar became one
     card. `BattleCentre` owns the rim, the fill and the shadow now — two plates
     stacked with a gap between them is two objects, and the whole point of the
     battle centre is that it is one.

     The mast that used to sit on top of this is gone: round, seconds and turn
     order are in `TopClock`. Keeping a second copy here was how the timer ended
     up somewhere nobody could find it — two half-prominent clocks instead of one
     unmissable one. -->
<div class="flex flex-col">
	<!-- ── The nameplate ──────────────────────────────────────────────────────
	     A full-bleed slab of saturated colour with near-black type on it, running
	     the whole width of the card. At 54rem wide that is the loudest object on
	     the screen, and it was spending all of it on two facts that never change
	     within a turn. Nothing else in this game fills like that.

	     So it is a caption line: the rails' 0.5rem/0.22em label, the seat's name
	     in its own hue, and whose turn it is as the same round bordered gem the
	     hero cards use for AP. The CHANGE still carries the meaning — the gem
	     lights when the turn is yours — it just no longer shouts it. -->
	<div class="flex items-center justify-between gap-2 px-3 pt-2">
		<span class="flex min-w-0 items-baseline gap-2">
			<b
				class="truncate font-mono text-[0.6875rem] leading-none font-black tracking-[0.06em] uppercase"
				style:color={seat.color}
			>
				{seat.name}
			</b>
			<span class="font-mono text-[0.5rem] tracking-[0.22em] text-[var(--fg-dim)] uppercase">
				your seat
			</span>
		</span>
		<!-- Not `<klass> up` — the clock says that already. -->
		<span
			class="shrink-0 rounded-full border-2 px-1.5 py-[1px] font-mono text-[0.5rem] leading-none font-black tracking-[0.12em] uppercase"
			style:color={match.isMyTurn ? state.color : 'var(--fg-dim)'}
			style:border-color={match.isMyTurn
				? gemEdge(state.color)
				: 'color-mix(in srgb, var(--fg) 14%, transparent)'}
			style:background={match.isMyTurn ? gemFill(state.color) : 'transparent'}
			style:transition="color 200ms ease, background 200ms ease, border-color 200ms ease"
		>
			{match.isMyTurn ? 'your turn' : 'waiting'}
		</span>
	</div>

	<div class="px-3 pt-2 pb-3">
			<!-- ── THE LOADOUT ──────────────────────────────────────────────────── -->
	<!-- Never dimmed. Everything below this line is a FACT ABOUT YOUR SEAT — your
	     standing, your resource, what your track has come online, what your hero
	     power costs. None of it stops being true because somebody else is acting,
	     and washing it out on their turn made your own panel look disabled at the
	     exact moment you have time to study it. Whose turn it is is said once, in
	     the header, in words. -->
	<!-- ── A ROW, not a column ────────────────────────────────────────────────
	     This was laid out for a 340px rail: five things stacked. In the battle
	     centre the plate is more than twice as wide and half as tall, and the
	     column left holes in it — a REP line with 600px of nothing after it, track
	     slots flung to the far edge. So the sections sit side by side, divided by
	     rules rather than by stacking, which is what a wide short plate wants. -->
	<div class="flex items-center gap-4">
		<div class="flex min-w-0 flex-1 flex-col gap-2">
		<div class="flex items-center gap-2.5">
			<!-- ── The character, not a glyph ─────────────────────────────────
			     This was the seat's mode icon in a hexagon — the same generic mark
			     the nav uses for a person. The game already draws the actual figure
			     in the hero stack, from the same skin, and the plate for the seat
			     YOU are playing is the last place on screen that should show a
			     stand-in for you. Same well, same crop, same art as the stack: one
			     character, drawn once, cropped differently. -->
			<div class="relative w-[52px] shrink-0">
				<span
					class="absolute inset-x-[2px] inset-y-0 blur-[9px]"
					style:background={seat.color}
					style:clip-path={HEX}
					style:opacity="0.5"
				></span>
				<div
					class="relative mx-auto grid h-[54px] w-[48px] place-items-center p-[1.5px]"
					style:clip-path={HEX}
					style:background="color-mix(in srgb, {seat.color} 75%, transparent)"
				>
					<div
						class="relative h-full w-full overflow-hidden"
						style:clip-path={HEX}
						style:background="color-mix(in srgb, {seat.color} 18%, var(--bg-elev, #0b0f16))"
					>
						<!-- Square and top-anchored, exactly as the stack crops it: a
						     taller-than-wide well zooms the bust until you are looking
						     at a shoulder. -->
						<span class="absolute inset-x-0 top-0 aspect-square">
							<Figure klass={klassByKey(seat.key)} crop="bust" />
						</span>
					</div>
				</div>
			</div>

			<!-- The identity row's right half used to be empty. Standing lives here
			     now — the crest says WHO and the number beside it says how that seat
			     is doing, which is one thought, not two. It also pulls the plate's
			     biggest numeral up next to its biggest glyph instead of leaving a
			     band of dead air between them. -->
			<div class="flex min-w-0 flex-1 items-center justify-between gap-2">
				<span class="flex min-w-0 flex-col gap-1">
					<!-- The banner, and the seat code after it. This read `RED SIDE · R1`
					     — the engine's word for a hue, printed at the player. The side
					     has a name now (see `team-flags`), and the hue it is drawn in is
					     the same one the whole half of the screen is already wearing. -->
					<span class="flex min-w-0 items-center gap-1.5">
						<TeamFlag faction={seat.faction} size="plate" showName />
						<span class="font-mono text-[0.5rem] tracking-[0.22em] text-[var(--fg-dim)] uppercase">
							· <b style:color={seat.color}>{seat.seat}</b>
						</span>
					</span>
					<!-- A rule that is always running and never changes for the whole
					     match — so it is the one thing here that does not need to be
					     readable at a glance. -->
					<Tooltip placement="bottom">
						{#snippet tip()}
							<span class="flex flex-col gap-1">
								<b class="font-mono text-[0.6rem] tracking-[0.14em] uppercase" style:color={seat.color}>
									passive · {seat.passive.name}
								</b>
								<span class="text-[0.62rem] leading-snug">{seat.passive.text}</span>
							</span>
						{/snippet}
						<!-- The rails' badge, not a tinted rectangle: a square-cornered
						     colour wash is the one shape this HUD does not use anywhere
						     else. -->
						<span
							class="flex w-fit items-center gap-1 rounded-full border-2 px-1.5 py-[1px] font-mono text-[0.5rem] leading-none font-black tracking-[0.12em] uppercase"
							style:color={seat.color}
							style:border-color={gemEdge(seat.color)}
							style:background={gemFill(seat.color)}
						>
							<Icon name="zap" size={8} />
							{seat.passive.name}
						</span>
					</Tooltip>
				</span>

				<span class="flex shrink-0 flex-col items-end gap-1 leading-none">
					<b
						class="font-mono text-[1.75rem] leading-none font-black tabular-nums"
						style:color={standTone}
					>
						{match.standing}
					</b>
					<span
						class="font-mono text-[0.5rem] leading-none tracking-[0.22em] uppercase"
						style:color={standTone}
					>
						{match.standingLabel}
					</span>
				</span>
			</div>
		</div>

		<!-- The bar the number above belongs to. Full width, because it is the only
		     meter here that ends the match. -->
		<div class="flex flex-col gap-1">
			<span class="hidden items-baseline justify-between">
				<span
					class="font-mono text-[11px] font-extrabold tracking-[0.14em] uppercase"
					style:color={standTone}
				>
					{match.standingLabel}
				</span>
				<b class="font-mono text-[20px] leading-none font-black tabular-nums" style:color={standTone}>
					{match.standing}
				</b>
			</span>
			<span
				class="block h-[8px] w-full overflow-hidden bg-[var(--surface-strong)]"
				class:pulse-soft={match.standing <= 30}
				style:clip-path="polygon(3px 0, 100% 0, calc(100% - 3px) 100%, 0 100%)"
			>
				<span
					class="block h-full"
					style:width="{match.standing}%"
					style:background={standTone}
					style:transition="width 300ms ease"
				></span>
			</span>
		</div>
		</div>

		<span class="h-12 w-px shrink-0 bg-[var(--border)]"></span>

		<!-- ── Resource ─────────────────────────────────────────────────────── -->
		<Tooltip placement="top">
			{#snippet tip()}
				<span class="text-[0.62rem] leading-snug">
					{seat.faction === 'red'
						? `You hold ${match.res[seat.key] ?? 0}. Only 3 ever rides a single roll.`
						: 'Held, and read by nothing — only the Maintainer’s is wired into a roll.'}
				</span>
			{/snippet}
			<span class="flex shrink-0 flex-col items-center gap-1">
				<span class="font-mono text-[0.5rem] tracking-[0.22em] text-[var(--fg-dim)] uppercase">
					{seat.resource}
				</span>
				<Pips
					total={3}
					filled={Math.min(match.res[seat.key] ?? 0, 3)}
					shape="diamond"
					size={8}
					gap={3}
					color={seat.color}
				/>
				<b
					class="font-mono text-[14px] leading-none font-black tabular-nums"
					style:color={(match.res[seat.key] ?? 0) > 0 ? seat.color : 'var(--fg-muted)'}
				>
					{match.res[seat.key] ?? 0}
				</b>
			</span>
		</Tooltip>

		<span class="h-12 w-px shrink-0 bg-[var(--border)]"></span>

		<!-- ── The track, as a charge rail ──────────────────────────────────────
		     Rectangles rather than rings: the slots fill from the bottom like an
		     ult charging, and they share the bar language the rest of the plate is
		     built from. `pct` is rounds, not a percentage — which is why the
		     readout in the middle is a glyph and not a number. -->
		<div class="flex shrink-0 flex-col items-center gap-1">
			<span class="font-mono text-[0.5rem] tracking-[0.22em] text-[var(--fg-dim)] uppercase">
				track
			</span>
			<span class="flex items-start gap-1.5">
				{#each match.track() as upgrade (upgrade.key)}
					{@const open = match.round >= upgrade.at}
					{@const kind = UPGRADE_KIND[upgrade.kind]}
					{@const away = Math.max(0, upgrade.at - match.round)}
					{@const pct = Math.min(1, match.round / upgrade.at)}
					<Tooltip placement="top">
						{#snippet tip()}
							<span class="flex flex-col gap-1">
								<b
									class="font-mono text-[0.6rem] tracking-[0.14em] uppercase"
									style:color={open ? kind.hue : 'var(--fg-muted)'}
								>
									{upgrade.name}
								</b>
								<span class="text-[0.62rem] leading-snug">{upgrade.text}</span>
								<span class="font-mono text-[0.56rem] leading-snug text-[var(--fg-muted)]">
									{open
										? `Online since round ${upgrade.at} — +${upgrade.value} ${kind.label}.`
										: `Unlocks at round ${upgrade.at}: ${away} round${away === 1 ? '' : 's'} away.`}
								</span>
							</span>
						{/snippet}
						<span class="flex flex-col items-center gap-0.5">
							<span
								class="relative grid h-[42px] w-[52px] place-items-center overflow-hidden rounded-[8px] border"
								style:border-color={open
									? `color-mix(in srgb, ${kind.hue} 75%, transparent)`
									: 'color-mix(in srgb, #FBBF24 55%, transparent)'}
								style:background={open
									? `color-mix(in srgb, ${kind.hue} 22%, transparent)`
									: 'color-mix(in srgb, #FBBF24 8%, var(--bg-elev, #0b0f16))'}
							>
								<!-- The countdown, filling from the floor. Amber because it is
								     coming, not because it is a warning. -->
								{#if !open}
									<span
										class="absolute inset-x-0 bottom-0"
										style:height="{Math.round(pct * 100)}%"
										style:background="color-mix(in srgb, #FBBF24 22%, transparent)"
									></span>
								{/if}
								<!-- A locked slot is CHARGING, not disabled — so it wears the
								     amber it is filling with, at full strength, rather than the
								     dim grey that made three quarters of this rail read as
								     switched off. The lock glyph and the countdown say it is not
								     ready yet; they do not need a wash to help. -->
								<span class="relative" style:color={open ? kind.hue : '#FBBF24'}>
									<Icon name={(open ? upgrade.icon : 'lock') as IconName} size={14} />
								</span>
								<b
									class="absolute right-0.5 bottom-0.5 font-mono text-[0.5rem] leading-none font-black tabular-nums"
									style:color={open ? kind.hue : '#FBBF24'}
								>
									{open ? `+${upgrade.value}` : `R${upgrade.at}`}
								</b>
							</span>
							<span
								class="font-mono text-[0.5rem] leading-none tracking-[0.22em] uppercase"
								style:color={open ? kind.hue : '#FBBF24'}
							>
								{open ? 'online' : `${away} away`}
							</span>
						</span>
					</Tooltip>
				{/each}
			</span>
		</div>

		<!-- ── The ult key ──────────────────────────────────────────────────────
		     A move with no pile to sit in, so it lives on the sheet — and it is a
		     card's worth of information, so it gets a card's row.

		     ALWAYS solid, on everybody's turn. Your hero power costing 2 AP is a
		     fact about your character, not about the clock, and greying it out
		     between your turns made the one genuinely big button on this panel
		     look broken. Only SPENT changes the fill — that is the one state where
		     the thing really is gone — and armability rides the glow, which says
		     "now" without taking the button away.

		     `disabled` still gates the click. Looking available and being clickable
		     are different questions and only the second one is the button's. -->
		<span class="h-12 w-px shrink-0 bg-[var(--border)]"></span>

		{#if power}
			{@const pfx = fxFor(power.key, seat.faction)}
			{@const armed = match.armedKey === power.key}
			<button
				type="button"
				disabled={!powerArmable}
				onclick={() => {
					match.armedKey = power.key;
					match.inspectKey = power.key;
				}}
				class="relative flex w-[200px] shrink-0 items-center gap-2 overflow-hidden rounded-[10px] border py-2 pr-2.5 pl-3 text-left transition-all disabled:cursor-default"
				style:color={spent ? 'var(--fg-dim)' : pfx.hue}
				style:border-color={spent
					? 'color-mix(in srgb, var(--fg) 14%, transparent)'
					: armed || powerArmable
						? `color-mix(in srgb, ${pfx.hue} 78%, transparent)`
						: gemEdge(pfx.hue)}
				style:background={spent
					? 'repeating-linear-gradient(45deg, transparent 0 5px, color-mix(in srgb, var(--fg) 8%, transparent) 5px 10px)'
					: plateFill(pfx.hue, 26)}
				style:box-shadow={armed
					? `0 0 0 1px color-mix(in srgb, ${pfx.hue} 40%, transparent), 0 0 26px color-mix(in srgb, ${pfx.hue} 50%, transparent)`
					: powerArmable
						? `0 0 18px color-mix(in srgb, ${pfx.hue} 35%, transparent)`
						: PLATE_SHADOW}
				title={power.text}
			>
				<!-- A card, not a key. It was a fully saturated gradient slab with
				     near-black type — the loudest thing on the plate, for a move you
				     use once a match. The rails' own vocabulary says this exactly:
				     tinted fill, hue border, hue stripe, hue type. The glow still
				     does the "now" that the fill used to over-say. -->
				<span
					class="absolute inset-y-0 left-0 w-[3px]"
					style:background={spent ? 'color-mix(in srgb, var(--fg) 20%, transparent)' : pfx.hue}
				></span>
				<span class="shrink-0"><Icon name={pfx.icon as IconName} size={15} /></span>
				<span
					class="min-w-0 flex-1 truncate font-mono text-[0.62rem] leading-none font-black tracking-[0.06em] uppercase"
				>
					{power.name}
				</span>
				{#if spent}
					<b class="shrink-0 font-mono text-[0.5rem] font-black tracking-[0.12em] uppercase">
						spent
					</b>
				{:else}
					<b class="shrink-0 font-mono text-[0.62rem] leading-none font-black tabular-nums">
						{power.ap} AP
					</b>
					<Pips
						total={power.uses}
						filled={match.powerCharges}
						shape="diamond"
						size={7}
						gap={2}
						color={pfx.hue}
					/>
				{/if}
			</button>
		{/if}
	</div>
	</div>
</div>

<style>
	/* The CS bomb-timer read. 2 Hz, scale only — nothing that reflows, because
	   this fires on the beat the globe is least able to spare a layout pass. */
	.pulse {
		animation: pulse-scale 500ms ease-in-out infinite;
	}
	@keyframes pulse-scale {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.06);
		}
	}

	.pulse-soft {
		animation: pulse-fade 1400ms ease-in-out infinite;
	}
	@keyframes pulse-fade {
		0%,
		100% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse,
		.pulse-soft {
			animation: none;
		}
	}
</style>
