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
	import { Figure, Icon, Pips, Tooltip, type IconName } from 'showcase';
	import { kitFor } from './kit.js';
	import { klassByKey } from '../internal/rules.js';
	import TeamFlag from './TeamFlag.svelte';
	import { UPGRADE_KIND } from '../internal/upgrades.js';
	import { fxFor } from '../internal/fx.js';
	import type { BreachMatch } from '../internal/match.svelte.js';
	import type { TableSocket } from '../net.svelte.js';
	import SeatStatus from './SeatStatus.svelte';
	import { noticeFor } from './notice.js';
	import { gemEdge, gemFill, plateFill, type HudState } from './hud-state.js';

	interface Props {
		match: BreachMatch;
		state: HudState;
		/** Passed straight through to `SeatStatus` — the header's right half is the
		 *  only place on this card that reports the moment. */
		takeover?: boolean;
		socket?: TableSocket | null;
		refusal?: string | null;
		onrules?: () => void;
	}

	let {
		match,
		state,
		takeover = false,
		socket = null,
		refusal = null,
		onrules = () => {}
	}: Props = $props();

	// When the card has something to SAY rather than something to show. The turn
	// arriving, a dropped table, a refusal, the match ending — each one owns the
	// card for as long as it lasts, and `notice` already ranks them (`notice.ts`).
	const notice = $derived(noticeFor(match, socket, refusal));
	const moment = $derived(takeover || notice !== null);

	const seat = $derived(match.seat);

	// Its own three-stop ramp, deliberately NOT the HUD state colour: standing
	// measures a different clock from the turn timer and must not go amber in
	// sympathy with it.
	const standTone = $derived(
		match.standing > 60 ? '#34D399' : match.standing > 30 ? '#FBBF24' : '#FB7185'
	);

	const power = $derived(match.power);
	const spent = $derived(match.powerCharges <= 0);
	// A signature on cooldown is waiting, not gone — see HeroDais.
	const cooling = $derived(spent && match.powerReadyIn > 0);
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
<!-- Label then value, on one line. A readout in a header cannot afford the
     stacked caption the body columns used — and at this size the label reads as
     the value's unit, which is what it always was. -->
{#snippet readout(label: string, value: string, tone: string, pips = false)}
	<!-- The AP gem's clothes, at plate scale. A bare label-and-number pair sets
	     its own width from the label, so `EXPOSURE` and `TRUST ACCRUAL` were the
	     two widest things in a row that had already run out of card. Inside a
	     bordered pill the pair is one object with a floor and a ceiling, and it
	     matches the badge the seat chips wear for exactly this job. -->
	<span
		class="flex shrink-0 items-center gap-1.5 rounded-full border-2 px-2 py-[3px]"
		style:border-color={gemEdge(tone)}
		style:background={gemFill(tone)}
	>
		<span
			class="shrink-0 font-mono text-[0.5rem] leading-none font-black tracking-[0.14em] text-[var(--fg-muted)] uppercase"
		>
			{label}
		</span>
		{#if pips}
			<Pips
				total={3}
				filled={Math.min(match.res[seat.key] ?? 0, 3)}
				shape="diamond"
				size={11}
				gap={3}
				color={seat.color}
			/>
		{/if}
		<b class="font-mono text-[0.82rem] leading-none font-black tabular-nums" style:color={tone}>
			{value}
		</b>
	</span>
{/snippet}

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
	<div class="flex items-center gap-2 px-3 pt-2">
		<!-- `shrink-0` on the identity half and `min-w-0` on the status half: the
		     header is a flex row whose right side holds a sentence, and without a
		     `min-w-0` a flex child refuses to shrink below its content — so the
		     sentence pushed the row wider than the card instead of truncating, and
		     ran out under everything to its right. -->
		<span class="flex shrink-0 items-center gap-2">
			<b
				class="truncate font-mono text-[0.6875rem] leading-none font-black tracking-[0.06em] uppercase"
				style:color={seat.color}
			>
				{seat.name}
			</b>
			<!-- The passive rides up here, where `YOUR SEAT` was. That label named
			     the card you are already looking at — it is the only card on screen
			     with your character in it — while the passive was taking a whole
			     line inside the identity block for a rule that never changes all
			     match. Swapping them is what lets that block stop being 600px. -->
			<Tooltip placement="bottom">
				{#snippet tip()}
					<span class="flex flex-col gap-1">
						<b class="font-mono text-[0.6rem] tracking-[0.14em] uppercase" style:color={seat.color}>
							passive · {seat.passive.name}
						</b>
						<span class="text-[0.62rem] leading-snug">{seat.passive.text}</span>
					</span>
				{/snippet}
				<span
					class="flex shrink-0 items-center gap-1 rounded-full border-2 px-1.5 py-[1px] font-mono text-[0.5rem] leading-none font-black tracking-[0.12em] text-[var(--fg)] uppercase"
					style:border-color={gemEdge(seat.color)}
					style:background={gemFill(seat.color)}
				>
					<Icon name="zap" size={9} />
					{seat.passive.name}
				</span>
			</Tooltip>

			<!-- ── The readouts ────────────────────────────────────────────────
			     Back on the header's LEFT, beside the passive. They spent one pass in
			     the body row, where five `shrink-0` sections already added up past
			     the card — so the two gems, which are the least urgent things on the
			     plate, were the ones hanging off its right edge.

			     Left of the divider is the right side of the argument anyway: these
			     are facts about your seat that hold all match, and the half opposite
			     is reserved for the moment. -->
			{#if !moment}
				{@render readout(match.standingLabel, `${match.standing}`, standTone)}
				{@render readout(seat.resource, `${match.res[seat.key] ?? 0}`, seat.color, true)}
			{/if}
		</span>

		<!-- ── The half opposite ────────────────────────────────────────────────
		     What you are about to do: whose turn it is, the card you are holding,
		     the building you are pointing it at, and why the engine will refuse it.

		     This is the sentence the play row used to carry along the floor of the
		     screen, and it is the one thing down there that was never a
		     restatement. Without it the card is five standing facts and no verb —
		     you can arm a signature and get no confirmation that you did, which is
		     indistinguishable from a control that does not work.

		     Only when there is no `moment`: a ceremony takes the whole card and
		     mounts this at `big`, and two copies of the same line would then be on
		     screen at once. -->
		{#if !moment}
			<SeatStatus {match} {state} {socket} {refusal} class="min-w-0 flex-1 justify-end" />
		{/if}
	</div>

	<div class="px-3 pt-1.5 pb-2">
			<!-- ── THE LOADOUT ──────────────────────────────────────────────────── -->
	<!-- Never dimmed. Everything below this line is a FACT ABOUT YOUR SEAT — your
	     standing, your resource, what your track has come online, what your
	     signature costs. None of it stops being true because somebody else is acting,
	     and washing it out on their turn made your own panel look disabled at the
	     exact moment you have time to study it. Whose turn it is is said once, in
	     the header, in words. -->
	<!-- ── A ROW, not a column ────────────────────────────────────────────────
	     This was laid out for a 340px rail: five things stacked. In the battle
	     centre the plate is more than twice as wide and half as tall, and the
	     column left holes in it — a REP line with 600px of nothing after it, track
	     slots flung to the far edge. So the sections sit side by side, divided by
	     rules rather than by stacking, which is what a wide short plate wants. -->
	<!-- ── THE MOMENT TAKES THE CARD ──────────────────────────────────────────
	     When there is something to SAY — the turn arriving, the table dropping, a
	     refusal, the match ending — the loadout goes and the words take the whole
	     card. Not an overlay and not a lane in the header: the gems, the track and
	     the signature are hidden for those seconds, because a ceremony sharing a
	     row with three controls is a caption, and the reason to run one at all is
	     that it is the only thing on the card.

	     They come straight back. Everything here is a standing fact about your
	     seat — none of it changed while the words were up. -->
	{#if moment}
		<div class="flex min-h-[46px] w-full items-center">
			<SeatStatus {match} {state} {takeover} {socket} {refusal} big class="min-w-0 flex-1" />
		</div>
	{:else}
	<!-- `min-w-0` and a real gap budget: the row is five sections wide and every
	     one of them was `shrink-0`, so the moment they added up past the card they
	     kept their size and spilled out of it instead of tightening. -->
	<div class="flex min-w-0 items-center justify-between gap-3">
		<!-- `shrink-0`, not `flex-1`. The identity block claiming the row's slack is
		     what pushed the divider 300px right of the content it divides; the
		     slack belongs between the sections, not inside one. -->
		<div class="flex shrink-0 flex-col gap-2">
		<div class="flex items-center gap-2.5">
			<!-- ── The character, not a glyph ─────────────────────────────────
			     This was the seat's mode icon in a hexagon — the same generic mark
			     the nav uses for a person. The game already draws the actual figure
			     in the hero stack, from the same skin, and the plate for the seat
			     YOU are playing is the last place on screen that should show a
			     stand-in for you. Same well, same crop, same art as the stack: one
			     character, drawn once, cropped differently. -->
			<!-- 46px, not 54. The crest is what sets this row's height, and with the
			     three readouts moved to the header the row has nothing else asking to
			     be tall — the whole card comes down with it. -->
			<div class="relative w-[46px] shrink-0">
				<span
					class="absolute inset-x-[2px] inset-y-0 blur-[9px]"
					style:background={seat.color}
					style:clip-path={HEX}
					style:opacity="0.5"
				></span>
				<div
					class="relative mx-auto grid h-[46px] w-[42px] place-items-center p-[1.5px]"
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
							<Figure
								klass={klassByKey(seat.key)}
								crop="bust"
								art={{ worn: kitFor(seat.key), trim: seat.color }}
							/>
						</span>
					</div>
				</div>
			</div>

			<!-- The identity row's right half used to be empty. Standing lives here
			     now — the crest says WHO and the number beside it says how that seat
			     is doing, which is one thought, not two. It also pulls the plate's
			     biggest numeral up next to its biggest glyph instead of leaving a
			     band of dead air between them. -->
			<!-- Banner, seat code, and the meter directly under them.
			     This column held the passive as a second line and then handed the
			     standing bar a full-width row BELOW the whole identity block — two
			     stacked rows sized for a plate that is no longer that tall, which is
			     where the 300px of nothing left of the divider came from. The
			     passive is in the header now and the bar is up here beside the
			     crest, so the block is as wide as its widest line and no wider. -->
			<span class="flex min-w-0 flex-col gap-2">
				<span class="flex min-w-0 items-center gap-1.5">
					<TeamFlag faction={seat.faction} size="plate" showName />
					<span
						class="font-mono text-[0.5rem] font-black tracking-[0.22em] text-[var(--fg)] uppercase"
					>
						· <b style:color={seat.color}>{seat.seat}</b>
					</span>
				</span>

				<!-- 176px, not "whatever is left". A bar reads as a proportion and had
				     no use for the 400px it was being handed. -->
				<span
					class="block h-[8px] w-[176px] overflow-hidden bg-[var(--surface-strong)]"
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
			</span>
		</div>
		</div>

		<span class="h-12 w-px shrink-0 bg-[var(--border)]"></span>

		<!-- ── The track, as a charge rail ──────────────────────────────────────
		     Rectangles rather than rings: the slots fill from the bottom like an
		     ult charging, and they share the bar language the rest of the plate is
		     built from. `pct` is rounds, not a percentage — which is why the
		     readout in the middle is a glyph and not a number.

		     The caption over the rail and the status word under each slot are gone
		     — `2/3 ONLINE` says both in the header, and those two lines were the
		     reason the slots were 42px in a 66px row. `self-stretch` now, matching
		     the signature: this half of the plate is two controls, both full
		     height, and nothing else. -->
		<div class="flex shrink-0 self-stretch">
			<span class="flex items-stretch gap-1.5">
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
						<span class="flex items-stretch">
							<span
								class="relative grid w-[52px] place-items-center overflow-hidden rounded-[8px] border"
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
								<!-- `+1` when it is online, `R6` when it is not — the same
								     corner saying what it gives you or when it arrives. The
								     `1 AWAY` line that used to sit under the slot said the
								     second of those twice. -->
								<b
									class="absolute right-1 bottom-1 font-mono text-[0.5rem] leading-none font-black tabular-nums"
									style:color={open ? kind.hue : '#FBBF24'}
								>
									{open ? `+${upgrade.value}` : `R${upgrade.at}`}
								</b>
							</span>
						</span>
					</Tooltip>
				{/each}
			</span>
		</div>

		<!-- ── The signature ────────────────────────────────────────────────────
		     A move with no pile to sit in, so it lives on the sheet.

		     It was a 200px card floating in the row with its own rim, fill, spine
		     and shadow — a panel inside a panel, in a section that had room for
		     neither. It is built like the TRACK now: a caption above, one slot, a
		     state word under it. Those three lines are the section, so the slot
		     simply takes the section: `flex-1`, full height, nothing around it.

		     ALWAYS lit, on everybody's turn. Your signature costing 2 AP is a fact
		     about your character, not about the clock, and greying it out between
		     turns made the one genuinely big control on this panel look broken.
		     Only SPENT changes the fill — the one state where the thing really is
		     gone — and armability rides the glow.

		     `disabled` still gates the click. Looking available and being clickable
		     are different questions and only the second one is the button's. -->
		<span class="h-12 w-px shrink-0 bg-[var(--border)]"></span>

		{#if power}
			{@const pfx = fxFor(power.key, seat.faction)}
			{@const armed = match.armedKey === power.key}
			<!-- No caption over it and no state word under it. Those two lines are
			     what the TRACK needs — three slots that have to be told apart and a
			     countdown that has to be read — and this section holds exactly one
			     thing, whose name is written across it in the hue of the move. The
			     label was naming what the reader is already looking at, and `READY`
			     was saying in a word what the glow says without one.
			     `self-stretch` in an `items-center` row: it fills its side, top to
			     bottom, which is the whole point of putting it here. -->
			<button
				type="button"
				disabled={!powerArmable}
				onclick={() => {
					match.armedKey = power.key;
					match.inspectKey = power.key;
				}}
				class="relative flex min-w-[190px] flex-1 items-center gap-2.5 self-stretch overflow-hidden rounded-[8px] border px-2.5 text-left transition-all disabled:cursor-default"
					style:color={spent ? 'var(--fg-dim)' : pfx.hue}
					style:border-color={spent
						? 'color-mix(in srgb, var(--fg) 14%, transparent)'
						: armed || powerArmable
							? `color-mix(in srgb, ${pfx.hue} 78%, transparent)`
							: `color-mix(in srgb, ${pfx.hue} 55%, transparent)`}
					style:background={spent
						? 'repeating-linear-gradient(45deg, transparent 0 5px, color-mix(in srgb, var(--fg) 8%, transparent) 5px 10px)'
						: `color-mix(in srgb, ${pfx.hue} 22%, transparent)`}
					style:box-shadow={armed
						? `0 0 0 1px color-mix(in srgb, ${pfx.hue} 40%, transparent), 0 0 26px color-mix(in srgb, ${pfx.hue} 50%, transparent)`
						: powerArmable
							? `0 0 18px color-mix(in srgb, ${pfx.hue} 35%, transparent)`
							: 'none'}
					title={power.text}
				>
				<span class="shrink-0"><Icon name={pfx.icon as IconName} size={26} /></span>
				<span class="flex min-w-0 flex-1 flex-col gap-1.5">
					<b
						class="truncate font-mono text-[0.75rem] leading-none font-black tracking-[0.06em] uppercase"
					>
						{#if cooling}
							back in {match.powerReadyIn}
						{:else}{spent ? 'spent' : power.name}{/if}
					</b>
					<!-- AP under the name rather than in a column of its own: the button
					     is 228px now, not the width of the section, and the move's own
					     prose has gone to the info glyph. A signature is one line — what
					     it is called and what it costs. -->
					<span class="flex items-center gap-2">
						<b class="font-mono text-[0.68rem] leading-none font-black tabular-nums">
							{power.ap} AP
						</b>
						{#if !spent}
							<Pips
								total={power.uses}
								filled={match.powerCharges}
								shape="diamond"
								size={9}
								gap={3}
								color={pfx.hue}
							/>
						{/if}
					</span>
				</span>

				<!-- What it DOES, on demand. It was a truncated line of prose under the
				     name — the only text on the plate that could not be read in full
				     anyway, spending a third of the widest control to half-say it. -->
				<Tooltip placement="top">
					{#snippet tip()}
						<span class="flex flex-col gap-1">
							<!-- The category is named HERE and not on the key. "Signature" is
							     the game's own word for it (spec/glossary.md) and it is worth
							     teaching — but the key is one control holding one thing, and a
							     label over it would name what the reader is already reading. -->
							<b class="font-mono text-[0.6rem] tracking-[0.14em] uppercase" style:color={pfx.hue}>
								signature · {power.name} · {power.ap} ap
							</b>
							<span class="text-[0.62rem] leading-snug">{power.text}</span>
						</span>
					{/snippet}
					<span class="shrink-0 opacity-70"><Icon name="info" size={14} /></span>
				</Tooltip>
			</button>
		{/if}

		<span class="h-12 w-px shrink-0 bg-[var(--border)]"></span>

		<!-- No commit key and no end key. Dragging a card onto a building already
		     resolves on release, and a selection made while a card is armed commits
		     it — the buttons were a third path to a move you have two ways to make,
		     sitting permanently on screen to be pressed occasionally.

		     What is left is the two things you OPEN or SWITCH rather than read.
		     They came off the top strip when it went; a capability with no route
		     to it is a regression, and neither of these has another route. -->
		<Tooltip placement="top">
			{#snippet tip()}
				<span class="text-[0.62rem] leading-snug">How a turn works, and what the dice do.</span>
			{/snippet}
			<button
				type="button"
				class="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
				onclick={onrules}
				aria-label="rules"
			>
				<Icon name="info" size={15} />
			</button>
		</Tooltip>

		<!-- Empty chairs already play themselves. This hands over YOURS as well, so
		     one person can sit still and watch a fog-of-war game happen around them.
		     Lit while it is on, because a spectator who cannot tell they have
		     stopped playing files the whole game as broken. -->
		<Tooltip placement="top">
			{#snippet tip()}
				<span class="text-[0.62rem] leading-snug">
					{match.auto
						? 'Your seat is playing itself. Press to take it back.'
						: 'Hand your seat to the demonstrator and watch.'}
				</span>
			{/snippet}
			<button
				type="button"
				class="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full transition-colors"
				style:color={match.auto ? '#34D399' : 'var(--fg-muted)'}
				style:background={match.auto ? 'color-mix(in srgb, #34D399 16%, transparent)' : 'transparent'}
				onclick={() => (match.auto = !match.auto)}
				aria-pressed={match.auto}
				aria-label={match.auto ? 'watching' : 'watch'}
			>
				<Icon name="play" size={13} />
			</button>
		</Tooltip>
	</div>
	{/if}
	</div>
</div>

<style>
	/* The only meter on this HUD with a heartbeat, because it is the only one
	   that ends the match. Opacity only — nothing that reflows, on the beat the
	   globe is least able to spare a layout pass. The turn clock's own 2 Hz pulse
	   is not here: the clock moved to `TopClock` and took its animation with it. */
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
		.pulse-soft {
			animation: none;
		}
	}
</style>
