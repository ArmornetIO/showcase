<script lang="ts">
	// ── The table, as a stack of hero cards ──────────────────────────────────────
	// Replaces the roster TABLE. The old panel was four rows of text with a colour
	// swatch and a pip strip: everything it knew, it said in words, and the words
	// were the same size whether they mattered or not. You read it. You could not
	// glance at it — and a HUD panel you have to read is one you stop looking at.
	//
	// The vocabulary here is deliberately NOT new. It is the one already on every
	// card in the game (`CardFace.svelte`), turned on a person:
	//
	//   cost gem, top-left       → action points they still have to spend on you
	//   art in a ringed well     → the character, in a hexagon instead of a circle
	//   name plate               → the character, and under it the person
	//   skill glyph + number     → the same four glyphs the cards roll against
	//   two bottom corners       → filled = when they act, outlined = whether seen
	//
	// A player who has learned to read a card can already read this, which is the
	// whole argument for reusing the language rather than inventing a second one.
	import { Figure, Icon, Tooltip } from 'showcase';
	import { SKILL_GLYPH } from '../parts/skill-glyphs.js';
	import { REFERENCE_DC, SKILL_DOES, pct, rollsOn, skillChance } from './skill-tips.js';
	import {
		SKILL_LABEL,
		TERRITORIES,
		klassByKey,
		type Skill
	} from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
	}

	let { match }: Props = $props();

	// The same two hues the card faces use for noise and quiet. Borrowed rather
	// than re-picked: on a card they mean "this will be heard" and "this will
	// not", and that is exactly what a seat's visibility means here.
	const SEEN_HUE = '#FBBF24';
	const HIDDEN_HUE = '#34D399';
	const ENEMY_HUE = '#FB7185';
	const ALLY_HUE = '#34D399';

	// Pointy-top. The flat-top hex reads as a button; this one reads as a crest,
	// which is the difference between a control and a portrait.
	const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

	const model = $derived(match.presence);
	/** Initiative order, all four — the stack is the only place a character is
	 *  drawn now that the dais is gone, so the viewer belongs in it. */
	const seats = $derived(model.seats);

	let lifted = $state<string | null>(null);

	/** Where they were last known to be, in the fewest words that are honest. */
	function seenAt(quietFor: number | null, focus: string | null): string {
		if (focus === null || quietFor === null) return 'never surfaced';
		const where = TERRITORIES[focus as keyof typeof TERRITORIES]?.name ?? focus;
		return quietFor === 0 ? where : `${where} · ${quietFor}r ago`;
	}
</script>

<div class="flex flex-col gap-1.5 pointer-events-auto">
	<span class="font-mono text-[0.5rem] tracking-[0.22em] uppercase text-[var(--fg-dim)] pl-0.5">
		the table
		<span class="ml-1 text-[var(--fg-dim)] opacity-60">{seats.length === 2 ? '1 v 1' : '2 v 2'}</span
		>
	</span>

	<!-- The stack. Cards overlap by a third of the gap they would otherwise take,
	     so the column holds four of them and still reads as a deck rather than a
	     list; the seat on the clock lifts clear of the ones behind it.

	     The lift is `left`, NOT `translate-x`. A transform makes the card the
	     containing block for its `position: fixed` descendants, and together with
	     `overflow-hidden` that clips the skill tooltips out of existence — they
	     stay in the DOM at the right size and paint nowhere at all. -->
	<div class="flex flex-col">
		{#each seats as seat (seat.key)}
			{@const k = klassByKey(seat.key)}
			{@const you = seat.relation === 'self'}
			{@const enemy = seat.relation === 'enemy'}
			<!-- Three relations, three colours, and none of them the seat's own hue:
			     the Maintainer is pink and so is an enemy, which is a bar that
			     changes meaning depending on who is reading it. -->
			{@const edge = you ? 'var(--accent)' : enemy ? ENEMY_HUE : ALLY_HUE}
			{@const up = seat.active || lifted === seat.key}
			<div
				role="group"
				onmouseenter={() => (lifted = seat.key)}
				onmouseleave={() => (lifted = null)}
				class="relative -mt-2 first:mt-0 flex items-stretch gap-2 rounded-[10px] border overflow-hidden
				       pl-2 pr-1.5 py-1.5 transition-[left] duration-150"
				class:left-1={up}
				style:z-index={up ? 5 : 1}
				style:border-color={up
					? `color-mix(in srgb, ${seat.color} 78%, transparent)`
					: 'var(--border)'}
				style:background="radial-gradient(120% 120% at 14% 30%,
					color-mix(in srgb, {seat.color} 26%, var(--bg-elev, #0b0f16)) 0%,
					var(--bg-elev, #0b0f16) 64%)"
				style:box-shadow={up
					? `0 0 0 1px color-mix(in srgb, ${seat.color} 40%, transparent), 0 14px 30px rgba(0,0,0,0.55)`
					: '0 6px 16px rgba(0,0,0,0.45)'}
			>
				<!-- Which way they are pointed, as one bar of colour down the edge.
				     The card faces put the kind bar across the top for the same
				     reason: it is the fact you sort on before you read anything. -->
				<span
					class="absolute inset-y-0 left-0 w-[3px]"
					style:background={edge}
					title={you ? 'you' : enemy ? 'against you' : 'with you'}
				></span>

				<!-- ── Portrait ──────────────────────────────────────────────────
				     The card's art well, hexagonal. Same glow-behind-the-frame so a
				     character in the stack and a card in the hand are lit alike. -->
				<div class="relative shrink-0 w-[50px] self-center">
					<span
						class="absolute inset-0 blur-[10px] opacity-50"
						style:background={seat.color}
						style:clip-path={HEX}
					></span>
					<div
						class="relative grid place-items-center h-[56px] p-[1.5px]"
						style:clip-path={HEX}
						style:background="color-mix(in srgb, {seat.color} 70%, transparent)"
					>
						<div
							class="relative w-full h-full overflow-hidden"
							style:clip-path={HEX}
							style:background="color-mix(in srgb, {seat.color} 16%, var(--bg-elev, #0b0f16))"
						>
							<!-- Square, like the picker's tile. The bust crop covers its
							     box and anchors to the top, so a taller-than-wide well
							     zooms it until you are looking at a shoulder. -->
							<span class="absolute inset-x-0 top-0 aspect-square">
								<Figure klass={k} crop="bust" />
							</span>
						</div>
					</div>

					<!-- AP, NAMED. Same corner as the card's cost gem and the same job —
					     what this one can still spend, which on a hero is what they have
					     left to spend ON YOU.
					     It says AP now. A bare numeral in a circle is the same mark this
					     HUD uses elsewhere for a path step and a round number, and three
					     meanings behind one shape is a shape nobody can read. Two letters
					     is the whole fix. -->
					<Tooltip placement="right">
						{#snippet tip()}
							<span class="flex flex-col gap-1">
								<b class="font-mono text-[0.6rem] uppercase tracking-[0.14em]" style:color={seat.color}>
									action points {seat.ap}/{seat.apMax}
								</b>
								<span class="text-[0.62rem] leading-snug">
									What {you ? 'you have' : `${seat.name} has`} left to spend this round. Refills at
									the top of every round; unspent points do not carry.
								</span>
							</span>
						{/snippet}
						<span
							class="absolute -top-0.5 -left-1 z-10 flex items-center gap-[2px] rounded-full border-2 px-1
							       py-[1px] font-mono text-[0.5rem] font-black leading-none"
							style:color={seat.color}
							style:border-color="color-mix(in srgb, {seat.color} 60%, transparent)"
							style:background="color-mix(in srgb, {seat.color} 26%, var(--bg-elev, #0b0f16))"
						>
							<span class="text-[0.4rem] tracking-[0.06em] opacity-80">AP</span>
							<b class="tabular-nums">{seat.ap}</b>
						</span>
					</Tooltip>
				</div>

				<!-- ── Plate ─────────────────────────────────────────────────────── -->
				<div class="flex min-w-0 flex-1 flex-col gap-1 justify-center">
					<div class="flex items-baseline gap-1.5 min-w-0">
						<span
							class="font-mono text-[0.58rem] font-black leading-none truncate"
							style:color={seat.color}
							title={seat.name}
						>
							{seat.name.replace(/^The /, '')}
						</span>
						<span class="font-mono text-[0.44rem] tracking-[0.12em] uppercase text-[var(--fg-dim)]">
							{seat.seat}
						</span>
						<span class="flex-1"></span>
						<!-- WHEN THEY ACT. Filled while it is theirs, hollow with the
						     count of chairs until it is — the card's power corner, whose
						     whole trick is that filled means "now, and at you". -->
						{#if seat.active}
							<span
								class="grid place-items-center h-[15px] px-1.5 rounded-full font-mono text-[0.44rem] font-black tracking-[0.12em] uppercase"
								style:color="var(--bg-elev, #0b0f16)"
								style:background={seat.color}
								style:box-shadow="0 0 10px color-mix(in srgb, {seat.color} 55%, transparent)"
								title="acting now">now</span
							>
						{:else}
							<span
								class="grid place-items-center h-[15px] min-w-[15px] px-1 rounded-full border font-mono text-[0.44rem] font-black tabular-nums"
								style:color="var(--fg-dim)"
								style:border-color="var(--border)"
								title="{seat.order} chair{seat.order === 1 ? '' : 's'} until they act"
								>+{seat.order}</span
							>
						{/if}
					</div>

					<!-- The person, under the character. Two facts, and only one of
					     them changes between matches. -->
					<span class="font-mono text-[0.44rem] tracking-[0.1em] uppercase truncate text-[var(--fg-dim)]">
						{you ? 'you' : (seat.player ?? (seat.automatic ? 'demonstrator' : 'waiting'))}
					</span>

					<div class="flex items-center gap-1">
						<!-- SKILLS, as the four glyphs the cards already roll against.
						     A card says "2d6 +2 OPS"; this says which of the four hands
						     at the table that +2 belongs to, in the same picture. -->
						{#each Object.keys(k.skills) as Skill[] as skill (skill)}
							{@const v = k.skills[skill]}
							{@const chance = skillChance(v)}
							{@const cards = rollsOn(seat.key, skill)}
							<Tooltip placement="right">
								{#snippet tip()}
									<span class="flex flex-col gap-1">
										<b
											class="font-mono text-[0.6rem] tracking-[0.14em] uppercase"
											style:color={seat.color}
										>
											{SKILL_LABEL[skill]} {v >= 0 ? '+' : ''}{v}
										</b>
										<span class="text-[0.62rem] leading-snug">{SKILL_DOES[skill]}</span>
										<!-- The card TYPES, never the hand: this panel draws
										     enemies, and what they are HOLDING is the one thing
										     the fog exists to keep. What they could ever hold is
										     printed in the rulebook.
										     Cards and odds share a line — they are one thought
										     ("what can they do with this, and how well"), and
										     splitting them was half of why this got long. -->
										<span class="font-mono text-[0.56rem] leading-snug text-[var(--fg-dim)]">
											{cards.length ? `${cards.join(', ')} — ` : 'No cards roll on it. '}<b
												class="text-[var(--fg)]">{pct(chance)}</b
											>
											vs a wall of {REFERENCE_DC}.
										</span>
									</span>
								{/snippet}
								<span
									class="flex items-center gap-px rounded px-1 py-px border"
									style:color={v > 0 ? seat.color : v < 0 ? ENEMY_HUE : 'var(--fg-dim)'}
									style:border-color={v > 0
										? `color-mix(in srgb, ${seat.color} 40%, transparent)`
										: 'var(--border)'}
									style:background={v > 0
										? `color-mix(in srgb, ${seat.color} 12%, transparent)`
										: 'transparent'}
								>
									<Icon name={SKILL_GLYPH[skill]} size={9} />
									<b class="font-mono text-[0.5rem] font-black tabular-nums leading-none">
										{v >= 0 ? '+' : ''}{v}
									</b>
								</span>
							</Tooltip>
						{/each}

						<span class="flex-1"></span>

						<!-- WHETHER THEY ARE SEEN. The card's noise corner, exactly: an
						     open eye in the noise hue is somebody who has shown you
						     where they are, a shut one in the quiet hue is somebody who
						     has not — and on this board that is the worse news. -->
						<span
							class="shrink-0"
							style:color={seat.focus ? SEEN_HUE : HIDDEN_HUE}
							title={seenAt(seat.quietFor, seat.focus)}
						>
							<Icon name={seat.focus ? 'eye' : 'eye-off'} size={11} />
						</span>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- The one line of prose on the board that says what the match is FOR. It
	     outlived the panel it was written for, twice now. -->
	<span class="font-mono text-[0.5rem] leading-snug text-[var(--fg-dim)] pl-0.5">
		{model.self.faction === 'red'
			? 'You and your ally are getting through. The two blue seats are trying to see you doing it.'
			: 'You and your ally are holding. The two red seats are already inside something and you have to prove which.'}
	</span>
</div>
