<script lang="ts">
	// ── The play ticker ──────────────────────────────────────────────────────────
	// One permanent strip under the hand, saying what is about to happen or what
	// just did. It replaces two floating panels — the action bar and the card
	// sheet — that answered halves of the same question and each appeared and
	// vanished on its own schedule.
	//
	// Two panels was the problem, not their contents. A card sheet that pops in
	// when you click a card and out when you clear it is a panel you cannot look
	// at without first doing something, and the action bar underneath it moved
	// every time the sheet came and went. Between them they made the busiest
	// corner of the screen the least predictable one.
	//
	// So: always mounted, fixed height, same two rows in every state. It never
	// opens and it never closes — it CHANGES, which is a thing you can learn to
	// read at a glance and then stop looking at directly. The height is fixed for
	// exactly that reason: a bar that grows a line pushes the hand down mid-turn,
	// and the hand is the one thing on screen you are aiming with.
	//
	// Row one is the sentence — who, what, at what, and what the dice said.
	// Row two is the small print — cost, noise, where it can go, what it means.
	//
	// It has no close button. There is nothing to close: when nothing is armed
	// and nothing is being read, the idle state is still the most useful thing
	// this space can say, which is whose turn it is and what to do next.
	import { Button, Icon, type IconName } from 'showcase';
	import { OUTCOME_COLOR, OUTCOME_LABEL, SKILL_LABEL } from '../internal/rules.js';
	import { fxFor } from '../internal/fx.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		class?: string;
	}

	let { match, class: cls = '' }: Props = $props();

	const pct = (n: number) => `${Math.round(n * 100)}%`;

	const KIND_COLOR: Record<string, string> = {
		strike: '#FB7185',
		implant: '#F472B6',
		recon: '#38BDF8',
		control: '#A78BFA',
		econ: '#FBBF24',
		utility: '#34D399'
	};

	// What the bar is ABOUT. Armed beats inspected: a card you have picked up is
	// a card you are committing to, and one you are merely reading is not.
	const card = $derived(match.armed ?? match.inspected);
	const fx = $derived(card ? fxFor(card.key, match.seat.faction) : null);
	const hue = $derived(card ? KIND_COLOR[card.kind] : 'var(--fg-dim)');
	const apLeft = $derived(match.ap[match.seat.key] ?? 0);

	// ── The rim ────────────────────────────────────────────────────────────────
	// The banner takes the colour of whatever is happening in it, and that is the
	// difference between a thing you read and a thing you notice. A neutral strip
	// at the bottom of the screen is furniture — the eye files it once and stops
	// going back. Lit in the armed card's own kind-colour, the same hue the card
	// itself carries, it changes at the exact moment there is something new to
	// say, and the change is what you catch out of the corner of your eye.
	//
	// It falls back to the seat colour rather than to grey: even idle, this strip
	// belongs to somebody, and the board and the rail already say who in the same
	// hue.
	const rim = $derived(
		card ? hue : match.isMyTurn ? match.seat.color : match.activeKlass.color
	);
	/** A resolution is the one moment worth interrupting for. */
	const hot = $derived(!!match.armed || match.diceSpin);
</script>

<!-- label + value. The same shape wherever a number appears in row two. -->
{#snippet field(label: string, value: string, tint?: string)}
	<span class="font-mono text-[0.5rem] tracking-wide uppercase text-[var(--fg-dim)] shrink-0">
		{label}
		<b class="ml-0.5 text-[0.58rem] tabular-nums" style:color={tint ?? 'var(--fg)'}>{value}</b>
	</span>
{/snippet}

<!-- One number and its caption, for the odds. -->
{#snippet stat(value: string, caption: string, tint: string, big = true)}
	<span class="flex items-baseline gap-1 shrink-0">
		<b
			class="font-mono {big ? 'text-[0.78rem]' : 'text-[0.6rem]'} font-bold tabular-nums"
			style:color={tint}
		>
			{value}
		</b>
		<span class="font-mono text-[0.5rem] uppercase text-[var(--fg-dim)]">{caption}</span>
	</span>
{/snippet}

<!-- ── The shape ────────────────────────────────────────────────────────────────
     A pointed banner, not a footer. A full-bleed strip along the bottom edge is
     read once as chrome and then looked past forever — it has the same
     silhouette as every browser status bar anyone has ever ignored. Bringing the
     ends in to a point and floating it under the hand makes it an OBJECT on the
     table instead of an edge of the window, and objects get looked at.

     Two layers rather than a border, because a clipped box has no edges left to
     draw one on: the outer element IS the rim and the inner one covers all but a
     pixel of it. Both are clipped to the same hexagon, so the point stays sharp
     at both ends. -->
<div
	class="pointer-events-none {cls}"
	style:--cap="18px"
	style:clip-path="polygon(0 50%, var(--cap) 0, calc(100% - var(--cap)) 0, 100% 50%, calc(100% - var(--cap)) 100%, var(--cap) 100%)"
	style:background={rim}
	style:opacity={hot ? 1 : 0.55}
	style:filter="drop-shadow(0 0 14px color-mix(in srgb, {rim} {hot ? 38 : 12}%, transparent))"
	style:transition="opacity 180ms ease, filter 180ms ease"
>
	<div
		class="pointer-events-auto m-px flex flex-col justify-center gap-0.5 overflow-hidden px-7"
		style:height="calc(100% - 2px)"
		style:clip-path="polygon(0 50%, var(--cap) 0, calc(100% - var(--cap)) 0, 100% 50%, calc(100% - var(--cap)) 100%, var(--cap) 100%)"
		style:background="color-mix(in srgb, var(--bg-elev, #0b0f16) 94%, {rim})"
		aria-live="polite"
	>
	<!-- ── Row one: the sentence ─────────────────────────────────────────────── -->
	<div class="flex items-center gap-2.5 whitespace-nowrap">
		{#if card && fx}
			<span class="shrink-0" style:color={fx.hue}>
				<Icon name={fx.icon as IconName} size={13} />
			</span>
			<span class="shrink-0 font-mono text-[0.7rem] font-bold">{card.name}</span>
			<span
				class="shrink-0 rounded px-1 py-px font-mono text-[0.46rem] font-bold tracking-[0.14em] uppercase"
				style:color={hue}
				style:background="color-mix(in srgb, {hue} 16%, transparent)"
			>
				{card.kind}
			</span>
		{:else if !match.isMyTurn}
			<!-- Whose turn, as their glyph in their colour — the same mark the rail
			     and the board use for them. -->
			<span class="flex shrink-0 items-center gap-1.5">
				<span style:color={match.activeKlass.color}>
					<Icon name={match.activeKlass.icon as IconName} size={13} />
				</span>
				<b
					class="font-mono text-[0.6rem] font-black tracking-widest"
					style:color={match.activeKlass.color}
				>
					{match.activeKlass.seat}
				</b>
				<span class="font-mono text-[0.6rem] text-[var(--fg-dim)]">is playing</span>
			</span>
		{:else}
			<span class="flex shrink-0 items-center gap-1.5">
				<span style:color={match.seat.color}>
					<Icon name={match.seat.icon as IconName} size={13} />
				</span>
				<b class="font-mono text-[0.6rem] font-black tracking-widest" style:color={match.seat.color}>
					your turn
				</b>
			</span>
		{/if}

		{#if match.armed && match.target}
			<span class="shrink-0 font-mono text-[0.66rem] text-[var(--fg-dim)]">→</span>
			<span class="truncate font-mono text-[0.7rem] font-semibold">{match.target.name}</span>
		{:else if match.armed}
			<!-- Armed, nothing aimed at yet. The board is already lighting the legal
			     sites, so this only has to point. -->
			<span class="shrink-0 font-mono text-[0.66rem] text-[var(--fg-dim)]">→</span>
			<Icon name="crestlink" size={12} />
		{/if}

		{#if match.armed && match.target && match.odds}
			{@const odds = match.odds}
			{#if match.blockReason}
				<!-- Say WHY. "Illegal target" tells a player they were wrong; "take The
				     Archive first — the payload needs the whole chain" tells them the
				     game. A sealed target is a warning rather than a refusal. -->
				<span
					class="truncate font-mono text-[0.58rem]"
					style:color={match.blockReason.kind === 'sealed' ? '#A78BFA' : '#FB7185'}
				>
					{match.blockReason.text}
				</span>
				{#if match.blockReason.kind === 'sealed'}
					<span
						class="shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.48rem] font-bold tracking-[0.14em] uppercase"
						style:color="#0b0f16"
						style:background="#A78BFA">sealed</span
					>
				{/if}
			{:else}
				<!-- The roll, ITEMISED. "+7" tells a player nothing about which of
				     their choices earned it; skill + card + trust + hold tells them the
				     game. -->
				<span class="shrink-0 font-mono text-[0.56rem] tabular-nums text-[var(--fg-dim)]">
					2d6
					<b style:color={match.seat.color} title={SKILL_LABEL[match.armed.skill]}>
						{odds.skill >= 0 ? '+' : ''}{odds.skill}
					</b>
					<span class="text-[0.48rem] uppercase">{SKILL_LABEL[match.armed.skill].slice(0, 3)}</span>
					{#if odds.abilityMod}<b class="text-[var(--fg)]">+{odds.abilityMod}</b>
						<span class="text-[0.48rem] uppercase">card</span>{/if}
					{#if odds.resourceMod}<b class="text-[var(--fg)]">+{odds.resourceMod}</b>
						<span class="text-[0.48rem] uppercase">{match.seat.resource}</span>{/if}
					{#if odds.holdMod}<b style:color="#F472B6">+{odds.holdMod}</b>
						<span class="text-[0.48rem] uppercase">hold</span>{/if}
					vs <b class="text-[var(--fg)]">{odds.target}</b>
				</span>

				<!-- Two numbers, because there are two questions: does it work at all,
				     and does it work properly. -->
				{@render stat(pct(odds.chance), 'any', OUTCOME_COLOR.partial)}
				{@render stat(pct(odds.chanceClean), 'clean', OUTCOME_COLOR.clean)}
				{#if odds.chanceBotch > 0.02}
					{@render stat(pct(odds.chanceBotch), 'botch', OUTCOME_COLOR.botch, false)}
				{/if}
			{/if}
		{/if}

		<span class="flex-1"></span>

		<!-- The reading of the dice, once they have stopped. The dice themselves are
		     thrown at the building and left lying on it — see Board. -->
		{#if match.diceSpin}
			<span
				class="shrink-0 animate-pulse font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]"
			>
				rolling…
			</span>
		{:else if match.lastRoll}
			{@const roll = match.lastRoll}
			<span class="flex shrink-0 items-center gap-1.5 font-mono text-[0.58rem] text-[var(--fg-dim)]">
				<span class="tabular-nums">
					{roll.dice[0]} + {roll.dice[1]} → <b class="text-[var(--fg)]">{roll.total}</b>
				</span>
				<b
					class="rounded px-1 font-bold tracking-[0.12em]"
					style:color="var(--bg-elev, #0b0f16)"
					style:background={OUTCOME_COLOR[roll.outcome]}
				>
					{OUTCOME_LABEL[roll.outcome]}
				</b>
				<span class="text-[0.54rem] tabular-nums">
					{roll.margin >= 0 ? '+' : ''}{roll.margin}
				</span>
			</span>
		{/if}

		<!-- ── Pass is contextual ────────────────────────────────────────────────
		     A spent seat already moves on by itself: the engine ends the turn
		     900ms after the last action point goes, and again when the clock hits
		     zero. So this is only ever "I am done early" — worth having, because
		     action points left and nothing worth doing is real and making three
		     people watch out 25 seconds of clock for it is not — but not worth a
		     permanent control. It appears when it is yours to give up. -->
		{#if match.isMyTurn && !match.busy && !match.pending && !match.winner}
			<Button size="xs" variant="ghost" onclick={() => match.endTurn()}>end turn</Button>
		{/if}
	</div>

	<!-- ── Row two: the small print ──────────────────────────────────────────────
	     Always one line, always the same height. What a card COSTS and what it
	     means lives here, so row one never has to grow to hold it. -->
	<div class="flex items-center gap-2.5 whitespace-nowrap">
		{#if card && fx}
			{@render field('cost', `${card.ap} AP`)}
			{#if card.mod}{@render field('roll', `+${card.mod}`, fx.hue)}{/if}
			{@render field(
				'noise',
				card.noise ? String(card.noise) : 'none',
				card.noise ? '#FBBF24' : '#34D399'
			)}
			<span class="h-2.5 w-px shrink-0 bg-[var(--border)]"></span>
			<!-- Not a list of building names: the board is already lighting exactly
			     where this can go. This only says how many, so you know whether it is
			     worth turning the globe round to look. -->
			<span
				class="shrink-0 font-mono text-[0.5rem] uppercase tracking-wide"
				style:color={match.inspectedSites ? fx.hue : '#FB7185'}
			>
				{match.inspectedSites
					? `${match.inspectedSites} site${match.inspectedSites === 1 ? '' : 's'} lit`
					: 'nowhere to play this yet'}
			</span>
			<span class="h-2.5 w-px shrink-0 bg-[var(--border)]"></span>
			<p class="m-0 truncate font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
				{card.text}
			</p>
			<span class="flex-1"></span>
			{#if !match.armed}
				<span
					class="shrink-0 font-mono text-[0.5rem] uppercase tracking-wide"
					style:color={fx.hue}
				>
					drag onto the world to play →
				</span>
			{/if}
		{:else if match.isMyTurn}
			{@render field('action points', String(apLeft), apLeft > 0 ? 'var(--fg)' : '#FB7185')}
			<span class="h-2.5 w-px shrink-0 bg-[var(--border)]"></span>
			<span class="font-mono text-[0.55rem] text-[var(--fg-dim)]">
				{apLeft > 0
					? 'click a card to read it · drag it onto the world to play'
					: 'nothing left to spend — the turn passes on its own'}
			</span>
		{:else}
			<span class="font-mono text-[0.55rem] text-[var(--fg-dim)]">
				waiting on {match.activeKlass.name}
			</span>
		{/if}
		</div>
	</div>
</div>
