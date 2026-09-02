<script lang="ts">
	// ── Battle log, as a kill feed ───────────────────────────────────────────────
	// Replaces the log PANEL, which was a Panel wrapping a Timeline wrapping a row
	// per event — three nested surfaces to say one thing, and the thing was a
	// sentence. You read it. In a match you do not read a log, you glance at it
	// and want four facts: who, what, where, how much.
	//
	// So it is the same card as the seats and the buildings, and it is almost
	// entirely glyphs:
	//
	//     [actor] [move] → [building]   −1   CLEAN
	//
	// All four come off `LogEntry` as VALUES — `actor`, `card`, `structure`,
	// `delta` — because the alternative is parsing `title`/`subject`/`qualifiers`
	// back into data, and a parser is a second schema nobody maintains.
	//
	// Nothing is fogged HERE. `match.feed` is already this seat's rows, and the
	// engine withholds the sharp facts by never setting them (`#played`), so a
	// row that names nobody is one this component was never told about. Absence
	// is the fog; there is no check to forget.
	import { Figure, Icon, PieceCrest, Tooltip, type IconName } from 'showcase';
	import {
		OUTCOME_COLOR,
		OUTCOME_LABEL,
		TERRITORIES,
		abilityByKey,
		klassByKey,
		structureById
	} from '../internal/rules.js';
	import { fxFor } from '../internal/fx.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		/** Newest first, and only this many — a feed is a glance, not an archive. */
		limit?: number;
		class?: string;
	}

	let { match, limit = 8, class: cls = '' }: Props = $props();

	// `log` is stored newest-first, so this is a slice and not a sort.
	const shown = $derived(match.feed.slice(0, limit));

	/** Hover lift, same as the other two stacks. Keyed by row id. */
	let lifted = $state<string | null>(null);
	const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

	/** The hue a row with nobody in it takes. Deliberately off the roster: an
	 *  anonymous row must not borrow a faction's colour and imply one. */
	const UNKNOWN = '#64748B';

	/**
	 * The PERSON holding a character.
	 *
	 * The hero name is the character they were issued this match and changes
	 * between them; "priya" is who you are actually watching. A table that has
	 * named nobody falls back to the character rather than to HeroStack's
	 * "waiting" — this row is proof they did not wait.
	 */
	function personOf(key: string): string {
		if (key === match.seat.key) return 'you';
		const seated = match.players[key];
		if (seated) return seated.kind === 'ai' ? 'demonstrator' : seated.name;
		return klassByKey(key).name.replace(/^The /, '');
	}
</script>

<div class="pointer-events-auto flex min-h-0 flex-col gap-1.5 {cls}">
	<span class="pl-0.5 font-mono text-[0.5rem] uppercase tracking-[0.22em] text-[var(--fg-dim)]">
		battle log
		<span class="ml-1 text-[var(--fg-dim)] opacity-60">round {match.round}</span>
	</span>

	<div class="flex min-h-0 flex-col overflow-y-auto overflow-x-clip pr-1">
		{#each shown as r (r.id)}
			{@const actor = r.actor ? klassByKey(r.actor) : null}
			{@const card = r.card ? abilityByKey(r.card) : null}
			{@const target = r.structure ? structureById(r.structure) : null}
			{@const region = r.where ? TERRITORIES[r.where].name : null}
			{@const fx = card && actor ? fxFor(card.key, actor.faction) : null}
			{@const tone = r.outcome ? OUTCOME_COLOR[r.outcome] : 'var(--fg-dim)'}
			{@const hue = actor?.color ?? UNKNOWN}
			<!-- Hoisted, not read inline: a snippet is its own scope, so narrowing
			     `r.delta` in the `{#if}` below does not reach the tooltip inside it. -->
			{@const delta = r.delta ?? 0}
			<!-- Kept apart from the value above because zero is a real answer and
			     `?? 0` cannot tell it from an absent one. A row that moved the wall
			     nothing is a row that HAPPENED — it says the attack landed and the
			     wall did not care — and hiding it is how the feed comes to imply
			     every attack did damage. -->
			{@const hasDelta = r.delta !== undefined}
			{@const up = lifted === r.id}
			<!-- The seat card, exactly — same frame, same crest well, same gem, same
			     two-line plate. Only the bottom row differs: the seats carry four skill
			     chips there and a feed row carries what it did and to what, which is
			     the same slot answering the same question one tense later. -->
			<div
				role="group"
				onmouseenter={() => (lifted = r.id)}
				onmouseleave={() => (lifted = null)}
				class="relative -mt-2 first:mt-0 flex items-stretch gap-2 rounded-[10px] border overflow-hidden
				       pl-2 pr-1.5 py-1.5 transition-[left] duration-150"
				class:left-1={up}
				style:z-index={up ? 5 : 1}
				style:border-color={up ? `color-mix(in srgb, ${hue} 78%, transparent)` : 'var(--border)'}
				style:background="radial-gradient(120% 120% at 14% 30%,
					color-mix(in srgb, {hue} 26%, var(--bg-elev, #0b0f16)) 0%,
					var(--bg-elev, #0b0f16) 64%)"
				style:box-shadow={up
					? `0 0 0 1px color-mix(in srgb, ${hue} 40%, transparent), 0 14px 30px rgba(0,0,0,0.55)`
					: '0 6px 16px rgba(0,0,0,0.45)'}
			>
				<!-- The outcome down the edge. On a seat card this stripe is allegiance
				     — the fact you sort on before reading anything — and on a feed row
				     that fact is whether it worked. -->
				<span class="absolute inset-y-0 left-0 w-[3px]" style:background={tone}></span>

				<!-- ── Portrait ────────────────────────────────────────────────── -->
				<div class="relative shrink-0 w-[50px] self-center">
					<span
						class="absolute inset-0 blur-[10px] opacity-50"
						style:background={hue}
						style:clip-path={HEX}
					></span>
					<div
						class="relative grid place-items-center h-[56px] p-[1.5px]"
						style:clip-path={HEX}
						style:background="color-mix(in srgb, {hue} 70%, transparent)"
					>
						<div
							class="relative w-full h-full overflow-hidden grid place-items-center"
							style:clip-path={HEX}
							style:background="color-mix(in srgb, {hue} 16%, var(--bg-elev, #0b0f16))"
						>
							{#if actor}
								<span class="absolute inset-x-0 top-0 aspect-square">
									<Figure klass={actor} crop="bust" />
								</span>
							{:else}
								<!-- Nobody to draw. A fogged row still gets the well, because the
								     shape of the card is what says "somebody acted". -->
								<b class="font-mono text-[0.9rem] font-black text-[var(--fg-dim)]">?</b>
							{/if}
						</div>
					</div>

					<!-- COST GEM. On a seat it is action points; here it is the round it
					     landed on — the one number a feed row has that a seat card does
					     not, and the one you use to age it. -->
					<span
						class="absolute -top-0.5 -left-1 grid place-items-center w-[19px] h-[19px] rounded-full border-2
						       font-mono text-[0.56rem] font-black tabular-nums z-10"
						style:color={hue}
						style:border-color="color-mix(in srgb, {hue} 60%, transparent)"
						style:background="color-mix(in srgb, {hue} 26%, var(--bg-elev, #0b0f16))"
						title="round {r.round ?? match.round}">{r.round ?? match.round}</span
					>
				</div>

				<!-- ── Plate ───────────────────────────────────────────────────────── -->
				<div class="flex min-w-0 flex-1 flex-col gap-1 justify-center">
					<div class="flex items-baseline gap-1.5 min-w-0">
						<!-- The PERSON, where the seat card puts the character. Who you are
						     watching does not change between matches; which character they
						     were issued does. -->
						<span
							class="font-mono text-[0.58rem] font-black leading-none truncate"
							style:color={hue}
							title={actor ? `${personOf(actor.key)} — playing ${actor.name}` : 'unidentified'}
						>
							{actor ? personOf(actor.key) : 'unknown'}
						</span>
						{#if actor}
							<span class="font-mono text-[0.44rem] tracking-[0.12em] uppercase text-[var(--fg-dim)]">
								{actor.seat}
							</span>
						{/if}
						<span class="flex-1"></span>
						<!-- The verdict, filled, where the seat card puts "now". Only where
						     dice were thrown: a round opening has no verdict to state, and a
						     chip that says INFO is a chip nobody reads twice. -->
						{#if r.outcome}
							<span
								class="grid place-items-center h-[15px] px-1.5 rounded-full font-mono text-[0.44rem] font-black tracking-[0.12em] uppercase"
								style:color="var(--bg-elev, #0b0f16)"
								style:background={tone}
								style:box-shadow="0 0 10px color-mix(in srgb, {tone} 55%, transparent)"
							>
								{OUTCOME_LABEL[r.outcome]}
							</span>
						{/if}
					</div>

					<!-- The move, under the person — the seat card's second line, which is
					     also its "and what about them". Rows nobody played (a round
					     opening, a region giving somebody up) have no card, and their own
					     prose is the closest thing to one they have. -->
					<span
						class="flex items-center gap-1 font-mono text-[0.44rem] tracking-[0.1em] uppercase truncate"
						style:color={fx ? fx.hue : 'var(--fg-dim)'}
					>
						<Icon name={(fx ? fx.icon : r.icon) as IconName} size={9} />
						<span class="truncate">{card ? card.name : `${r.title} ${r.subject}`}</span>
					</span>

					<!-- Where the seats carry four skill chips: what it hit, and for how
					     much. Same chip shape, same size, same row. -->
					<div class="flex items-center gap-1">
						{#if target || region}
							<Tooltip placement="top">
								{#snippet tip()}
									<span class="flex flex-col gap-1">
										<b class="font-mono text-[0.6rem] uppercase tracking-[0.14em]">
											{target ? target.name : region}
										</b>
										<span class="text-[0.62rem] leading-snug">
											{target
												? `${target.role} · ${region ?? TERRITORIES[target.territory].name}`
												: 'The fog gives up the region and never the building.'}
										</span>
									</span>
								{/snippet}
								<span
									class="flex items-center gap-1 rounded px-1 py-px border min-w-0"
									style:color="var(--fg-dim)"
									style:border-color="var(--border)"
								>
									{#if target}
										<span class="shrink-0 -my-px">
											<PieceCrest piece={target.piece} color="#94A3B8" size={13} />
										</span>
									{:else}
										<Icon name="eye-off" size={9} />
									{/if}
									<span class="font-mono text-[0.44rem] uppercase tracking-[0.06em] truncate">
										{target ? target.name.replace(/^The /, '') : region}
									</span>
								</span>
							</Tooltip>
						{/if}

						<span class="flex-1"></span>

						<!-- HOW MUCH. The reason anybody glances at a feed mid-turn. -->
						{#if hasDelta}
							<Tooltip placement="left">
								{#snippet tip()}
									<span class="flex flex-col gap-1">
										<b class="font-mono text-[0.6rem] uppercase tracking-[0.14em]" style:color={tone}>
											{delta === 0 ? 'hardening unchanged' : `hardening ${delta > 0 ? '+' : ''}${delta}`}
										</b>
										<span class="text-[0.62rem] leading-snug">
											{delta === 0
												? 'The wall did not move. The attempt still happened and still made noise — it just bought nothing.'
												: delta < 0
													? 'Off the wall. What an attack has to beat here just got easier by that much.'
													: 'Onto the wall. Blue reinforced it by that much.'}
										</span>
									</span>
								{/snippet}
								<span
									class="flex items-center gap-1 rounded px-1 py-px border shrink-0"
									style:color={tone}
									style:border-color="color-mix(in srgb, {tone} 40%, transparent)"
									style:background="color-mix(in srgb, {tone} 12%, transparent)"
								>
									<Icon name="shield" size={9} />
									<b class="font-mono text-[0.5rem] font-black tabular-nums leading-none">
										{delta > 0 ? '+' : ''}{delta}
									</b>
								</span>
							</Tooltip>
						{/if}
					</div>
				</div>
			</div>
		{/each}

		{#if !shown.length}
			<span class="px-1 py-2 font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--fg-dim)]">
				nothing has happened yet
			</span>
		{/if}
	</div>
</div>
