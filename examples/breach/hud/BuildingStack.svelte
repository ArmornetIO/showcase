<script lang="ts">
	// ── The buildings ────────────────────────────────────────────────────────────
	// The hero stack, turned on the board. Deliberately the SAME card as the seats
	// — crest on the left, name and a state badge on the top line, glyph
	// medallions along the bottom — because a player who has learned to read one
	// column should not have to learn a second one six inches away.
	//
	// It replaces the payload-path ladder AND the target sheet, which answered
	// half a question each: the ladder knew which rungs were held and nothing
	// about their condition, the sheet knew everything about whichever ONE
	// building you last clicked.
	//
	// The crest is the real building. `Structure.piece` names a solid the board
	// already stands on the globe, so the thing in the hexagon here is the thing
	// you are looking at out there — not an icon chosen to represent it.
	//
	// Two behaviours a game does that a dashboard does not:
	//   UNDER ATTACK   the row pulses in the attacker's hue for the whole beat,
	//                  so you are looking at the right line when it changes.
	//   JUST CHANGED   the badge is replaced by the ping's own word — FOUND,
	//                  CLEARED, BURROWING — because a number that silently slides
	//                  from 19 to 18 is a number nobody saw move.
	import { Icon, PieceCrest, Tooltip } from 'showcase';
	import { CHAIN, TERRITORIES } from '../internal/rules.js';
	import { PING_STYLE } from '../internal/fx.js';
	import type { BreachMatch } from '../internal/match.svelte.js';
	

	interface Props {
		match: BreachMatch;
	}

	let { match }: Props = $props();

	const RED = '#FB7185';
	const BLUE = '#38BDF8';
	const SEAL = '#A78BFA';

	// The same crest the seats wear. One shape for "a thing on this board".
	const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

	/** The five objectives, in path order. `barFor` computes every number here and
	 *  is what the board's own plates are drawn from, so the two cannot disagree. */
	const rows = $derived(CHAIN.map((s) => ({ s, bar: match.barFor(s) })));

	const striking = $derived(
		match.activeFx && !match.activeFx.fogged
			? { id: match.activeFx.toId, hue: match.activeFx.fx.hue }
			: null
	);

	/** Newest ping per building. The match drops them itself after `PING_MS`. */
	const pinged = $derived(new Map(match.pings.map((p) => [p.structureId, PING_STYLE[p.kind]])));

	let lifted = $state<string | null>(null);
</script>

<!-- One medallion: glyph, then number. The skill chips on the seat cards are the
     same shape, and for the same reason — a bare figure needs a legend.
     And the same TOOLTIP: the library's, not a native `title`. A row of medallions
     where half open the styled panel and half open the OS's grey box after a
     second and a half is one row teaching two different things about itself. -->
<!-- The state badge. `hollow` for a state that is a PROSPECT rather than a fact:
     leverage is an offer and the payload gate is a condition, while held, sealed
     and dug in are things that have already happened. -->
{#snippet badge(hue: string, word: string, body: string, hollow = false)}
	<Tooltip placement="left">
		{#snippet tip()}
			<span class="flex flex-col gap-1">
				<b class="font-mono text-[0.6rem] uppercase tracking-[0.14em]" style:color={hue}>
					{word}
				</b>
				<span class="text-[0.62rem] leading-snug">{body}</span>
			</span>
		{/snippet}
		<span
			class="shrink-0 rounded-full px-1.5 py-px font-mono text-[0.44rem] font-black uppercase tracking-[0.12em]"
			style:color={hollow ? hue : 'var(--bg-elev, #0b0f16)'}
			style:background={hollow ? 'transparent' : hue}
			style:border={hollow ? `1px solid color-mix(in srgb, ${hue} 50%, transparent)` : 'none'}
		>
			{word === 'sealed' ? '' : word}
			{#if word === 'sealed'}<Icon name="lock" size={9} />{/if}
		</span>
	</Tooltip>
{/snippet}

{#snippet pip(
	icon: string,
	value: string,
	hue: string,
	label: string,
	body: string,
	lit = true
)}
	<Tooltip placement="top">
		{#snippet tip()}
			<span class="flex flex-col gap-1">
				<b class="font-mono text-[0.6rem] uppercase tracking-[0.14em]" style:color={hue}>
					{label} {value}
				</b>
				<span class="text-[0.62rem] leading-snug">{body}</span>
			</span>
		{/snippet}
		<span
			class="flex items-center gap-1 rounded border px-1 py-px"
			style:color={lit ? hue : 'var(--fg-dim)'}
			style:border-color={lit ? `color-mix(in srgb, ${hue} 40%, transparent)` : 'var(--border)'}
			style:background={lit ? `color-mix(in srgb, ${hue} 12%, transparent)` : 'transparent'}
		>
			<Icon name={icon as never} size={9} />
			<b class="font-mono text-[0.5rem] font-black tabular-nums leading-none">{value}</b>
		</span>
	</Tooltip>
{/snippet}

<!-- No panel around it, for the same reason the seats have none: the cards ARE
     the surface. A bordered plate behind a stack of bordered plates is two
     frames doing one frame's job, and it costs the stack the thing that makes it
     read as a deck — the outermost card having nothing behind it. -->
<div class="pointer-events-auto flex flex-col gap-1.5">
	<span class="pl-0.5 font-mono text-[0.5rem] uppercase tracking-[0.22em] text-[var(--fg-dim)]">
		the buildings
		<span class="ml-1 text-[var(--fg-dim)] opacity-60">
			{match.chainHeld.length} / {CHAIN.length} held
		</span>
	</span>

	<!-- `pr-1` is the lift's runway. A lifted card is `position:relative; left:4px`,
	     which does not change layout width but DOES count as scrollable overflow —
	     so in a column that scrolls, the deck feel bought a horizontal scrollbar
	     every time a row pulsed. Reserving the four pixels means the shift lands
	     inside the box instead of past it, and nothing gets clipped to achieve it. -->
	<div class="flex flex-col pr-1">
		{#each rows as { s, bar } (s.id)}
			{@const attack = striking?.id === s.id ? striking : null}
			{@const ping = pinged.get(s.id)}
			{@const isPayload = s.chain === CHAIN.length}
			{@const lev = match.leverageFor(s)}
			{@const heat = match.heat[s.territory] ?? 0}
			{@const tone = bar.held ? RED : bar.sealed ? SEAL : lev > 0 ? 'var(--accent)' : BLUE}
			{@const up = !!attack || lifted === s.id}
			<div
				role="group"
				onmouseenter={() => (lifted = s.id)}
				onmouseleave={() => (lifted = null)}
				class="bs-row relative -mt-2 flex items-stretch gap-2 overflow-hidden rounded-[10px]
				       border py-1.5 pl-2 pr-1.5 transition-[left] duration-150 first:mt-0"
				class:left-1={up}
				class:bs-striking={!!attack}
				style:z-index={up ? 5 : 1}
				style:--pulse={attack?.hue ?? 'transparent'}
				style:border-color={attack
					? `color-mix(in srgb, ${attack.hue} 80%, transparent)`
					: up
						? `color-mix(in srgb, ${tone} 70%, transparent)`
						: 'var(--border)'}
				style:background="radial-gradient(120% 120% at 14% 30%,
					color-mix(in srgb, {tone} 22%, var(--bg-elev, #0b0f16)) 0%,
					var(--bg-elev, #0b0f16) 64%)"
				style:box-shadow={up
					? `0 0 0 1px color-mix(in srgb, ${tone} 35%, transparent), 0 14px 30px rgba(0,0,0,0.55)`
					: '0 6px 16px rgba(0,0,0,0.45)'}
			>
				<!-- Whose ground this is, as one bar down the edge. The seats' card
				     carries the same stripe for the same job. -->
				<span
					class="absolute inset-y-0 left-0 w-[3px]"
					style:background={tone}
					title={bar.held ? 'red is standing on it' : bar.sealed ? 'sealed' : 'blue holds it'}
				></span>

				<!-- ── The building ──────────────────────────────────────────────
				     `piece` is the same solid the globe stands out there. -->
				<div class="relative w-[50px] shrink-0 self-center">
					<span
						class="absolute inset-0 blur-[10px]"
						style:background={tone}
						style:clip-path={HEX}
						style:opacity={bar.held ? 0.5 : 0.28}
					></span>
					<div
						class="relative grid h-[56px] place-items-center p-[1.5px]"
						style:clip-path={HEX}
						style:background="color-mix(in srgb, {tone} 70%, transparent)"
					>
						<div
							class="grid h-full w-full place-items-center overflow-hidden"
							style:clip-path={HEX}
							style:background="color-mix(in srgb, {tone} 16%, var(--bg-elev, #0b0f16))"
						>
							<PieceCrest piece={s.piece} color={tone} offline={!bar.held && lev === 0} />
						</div>
					</div>

					<!-- The step gem, where the seats wear their action points. Where
					     it sits on the path is the one fact that never changes. -->
					<Tooltip placement="right">
						{#snippet tip()}
							<span class="flex flex-col gap-1">
								<b class="font-mono text-[0.6rem] uppercase tracking-[0.14em]" style:color={tone}>
									step {bar.step} of {CHAIN.length}
								</b>
								<span class="text-[0.62rem] leading-snug">
									{bar.step === CHAIN.length
										? 'The payload. The only gated step — it needs every other rung held, and taking it wins.'
										: 'Open whenever. Holding the step before it is worth +1 to +5 on the roll, which is what makes order worth choosing rather than a rule.'}
								</span>
							</span>
						{/snippet}
						<!-- Named for the same reason the seats' AP is: a bare numeral in
						     this corner already means "action points" one column over. -->
						<span
							class="absolute -left-1 -top-0.5 z-10 flex items-center gap-[2px] rounded-full border-2 px-1
							       py-[1px] font-mono text-[0.5rem] font-black leading-none"
							style:color={tone}
							style:border-color="color-mix(in srgb, {tone} 60%, transparent)"
							style:background="color-mix(in srgb, {tone} 26%, var(--bg-elev, #0b0f16))"
						>
							<!-- LINK, not STEP. The order used to be a RULE — every rung
							     refused until the one before it was held — and "step 3" was
							     the player being told to wait. It is not a rule any more:
							     four of the five are open whenever, and this number now
							     only says who leverages whom, because holding a link is
							     worth +1..+5 on the one after it. The last is not a link at
							     all, it is the delivery, and it keeps its gate. -->
							{#if isPayload}
								<b class="tracking-[0.06em]">PAYLOAD</b>
							{:else}
								<span class="text-[0.4rem] tracking-[0.06em] opacity-80">LINK</span>
								<b class="tabular-nums">{bar.step}</b>
							{/if}
						</span>
					</Tooltip>
				</div>

				<!-- ── The plate ─────────────────────────────────────────────────── -->
				<div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
					<div class="flex min-w-0 items-baseline gap-1.5">
						<span
							class="truncate font-mono text-[0.58rem] font-black leading-none"
							style:color={tone}
							title={s.name}
						>
							{s.name}
						</span>
						<span class="flex-1"></span>

						{#if ping}
							<!-- For the second it is up, what just happened IS the state. -->
							<span
								class="bs-flash shrink-0 rounded-full px-1.5 py-px font-mono text-[0.44rem] font-black tracking-[0.12em] uppercase"
								style:color="var(--bg-elev, #0b0f16)"
								style:background={ping.color}
							>
								{ping.label}
							</span>
						{:else if bar.sealed}
							{@render badge(
								SEAL,
								'sealed',
								'A quarantine is up. An attack here is swatted before the dice land — the card is spent, the squad goes, and nothing happens.'
							)}
						{:else if bar.held}
							{@render badge(
								RED,
								bar.persistent ? 'dug in' : bar.staged ? 'staged' : 'held',
								bar.persistent
									? 'Red is on it and rooted. A partial success is dislodgeable; this one is not.'
									: bar.staged
										? 'Red spent a turn working this foothold rather than pushing on. Worth +2 on the next step.'
										: 'Red is standing on it. Blue cannot remove a foothold — only make the next one harder.'
							)}
						{:else if isPayload}
							<!-- The one gate left. Everything else on this list is open in
							     any order; the delivery is not, and saying so on the card is
							     better than saying it in a refusal after the click. -->
							{@render badge(
								'var(--accent)',
								match.chainHeld.length >= CHAIN.length - 1 ? 'open' : 'needs the chain',
								match.chainHeld.length >= CHAIN.length - 1
									? 'Every link is held. This is the delivery, and taking it wins the match.'
									: `The payload is the only gated target: it needs all four links held first. ${CHAIN.length - 1 - match.chainHeld.length} still to take.`,
								true
							)}
						{:else if lev > 0}
							<!-- Leverage, as the number it actually is. This slot used to say
							     "next", which is the vocabulary of an ordering rule that no
							     longer exists — red may take these four in any order. What
							     survives is the INCENTIVE: holding the link before a target
							     is worth +1..+5 on the roll, so the path still has a cheap
							     line through it without anybody being forced down it. -->
							{@render badge(
								'var(--accent)',
								`+${lev} leverage`,
								`Red holds the link before this one, which is worth +${lev} on an attack here. Not a requirement — any link may be taken in any order — just the cheapest way in.`,
								true
							)}
						{/if}
					</div>

					<!-- What it IS, under its name — the seats put the person here. -->
					<span
						class="truncate font-mono text-[0.44rem] uppercase tracking-[0.1em]"
						style:color={bar.regionColor}
						title={TERRITORIES[s.territory].name}
					>
						{s.role} · {bar.region}
					</span>

					<div class="flex items-center gap-1">
						<!-- Hardening: what an attack has to beat. The one number every
						     card on the board is measured against. -->
						{@render pip(
							'shield',
							String(bar.value),
							tone,
							'hardening',
							bar.value === bar.base
								? `What an attack roll has to beat here. Printed at ${bar.base} and untouched.`
								: `What an attack roll has to beat here — ${bar.value > bar.base ? 'up' : 'down'} from the printed ${bar.base}. Every blue defender posted adds 1, and softening cards take it off.`
						)}
						<!-- Figures standing on it, per side. -->
						{@render pip(
							'flag',
							String(bar.red),
							RED,
							'red',
							bar.red === 0
								? 'Red has nothing standing here.'
								: `${bar.red} red figure${bar.red === 1 ? '' : 's'} on this building. They stay until something pulls them out — no move in the game simply removes one.`,
							bar.red > 0
						)}
						{@render pip(
							'shield-check',
							String(bar.blue),
							BLUE,
							'blue',
							bar.blue === 0
								? 'Nobody is posted here. The wall is whatever the building is worth on its own.'
								: `${bar.blue} defender${bar.blue === 1 ? '' : 's'} posted. Each one is worth +1 hardening — which is what makes a garrison a board piece rather than a sticker.`,
							bar.blue > 0
						)}

						<span class="flex-1"></span>

						<!-- The region's alarm. Red's whole problem is that this climbs. -->
						{@render pip(
							heat > 25 ? 'eye' : 'eye-off',
							`${heat}`,
							heat > 60 ? RED : heat > 25 ? '#FBBF24' : '#34D399',
							'detection',
							`Across ${bar.region}, not this building — noise is regional. At 80 the region gives up what is hiding in it on its own.`,
							heat > 0
						)}
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	/* The attack tell. A ring rather than a fill: the row's own colours already
	   carry state, and a background that flashed too would make "held" and "under
	   attack" the same event. It rides the beat clock — the match keeps
	   `activeFx` up for the whole resolution, so this starts and stops itself. */
	.bs-striking {
		animation: bs-pulse 700ms ease-in-out infinite;
	}
	@keyframes bs-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--pulse) 60%, transparent);
		}
		50% {
			box-shadow: 0 0 0 5px color-mix(in srgb, var(--pulse) 0%, transparent);
		}
	}

	/* The result arrives loud and settles — the opposite curve to the pulse,
	   which is anticipation. */
	.bs-flash {
		animation: bs-pop 320ms ease-out;
	}
	@keyframes bs-pop {
		from {
			transform: scale(1.35);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bs-striking,
		.bs-flash {
			animation: none;
		}
	}
</style>
