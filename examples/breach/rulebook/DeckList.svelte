<script lang="ts">
	// ── The deck, one move at a time ─────────────────────────────────────────────
	// Every card in the game with everything printed on it, plus the sentence the
	// face has no room for. Driven off `CATALOGUE` rather than a copy of it, so a
	// balance change in `cards.yaml` is a change on this page too — a rules
	// reference that has to be maintained alongside the rules is a rules
	// reference that will be wrong by Thursday.
	//
	// A seat's POWER is listed here too, after its cards. It is not in `CATALOGUE`
	// — that is the whole point of a power — but a player reading "every card the
	// Maintainer brings" and finding no Obfuscated Test Fixture has been told
	// something false about the game, so both come off `Move` and render down one
	// path.
	import { Icon, type IconName } from 'showcase';
	import CardFace from '../CardFace.svelte';
	import { SKILL_GLYPH } from '../parts/skill-glyphs.js';
	import { CATALOGUE } from '../internal/deck.js';
	import { fxFor } from '../internal/fx.js';
	import {
		INITIATIVE,
		SKILL_LABEL,
		TERRITORIES,
		klassByKey,
		powerOf,
		structureById,
		type Ability,
		type Faction,
		type Owner
	} from '../internal/rules.js';
	import { CARD_NOTES, heatFor } from './notes.js';

	/** A card or a power, flattened to what this page prints. `copies` and `uses`
	 *  are the one place the two genuinely differ. */
	interface Move {
		ability: Ability;
		side: Faction;
		copies: number | null;
		uses: number | null;
	}

	const bySeat = $derived(
		INITIATIVE.map((key) => {
			const klass = klassByKey(key);
			const cards: Move[] = CATALOGUE.filter((c) => c.owner === key).map((c) => ({
				ability: c.ability,
				side: c.side,
				copies: c.copies,
				uses: null
			}));
			const power = powerOf(key);
			const moves = power
				? [...cards, { ability: power, side: klass.faction, copies: null, uses: power.uses }]
				: cards;
			return { klass, cards, moves };
		})
	);

	/** The ownership rule in words. `canTarget` computes it; this says it. */
	function groundFor(m: Move): string {
		const enemy: Owner = m.side === 'red' ? 'blue' : 'red';
		const allowed = m.ability.on ?? (['neutral', enemy] as Owner[]);
		const words: Record<Owner, string> = {
			red: 'red’s own ground',
			blue: 'blue’s estate',
			neutral: 'neutral ground'
		};
		return allowed.map((o) => words[o]).join(' or ');
	}

	function targetsFor(m: Move): string {
		if (!m.ability.targets) return 'any building the ground rule allows';
		return m.ability.targets.map((id) => structureById(id)?.name ?? id).join(', ');
	}

	const LEAVES: Record<string, string> = {
		implant: 'implant figures that stay hidden and burrow',
		garrison: 'defender figures that stand there and add hardening',
		nothing: 'nothing — the squad does the job and withdraws'
	};
</script>

<div class="flex flex-col gap-10">
	{#each bySeat as group (group.klass.key)}
		<section class="flex flex-col gap-4">
			<header class="flex items-center gap-2 border-b border-[var(--border)] pb-2">
				<span
					class="grid place-items-center w-7 h-7 rounded-full border"
					style:color={group.klass.color}
					style:border-color="color-mix(in srgb, {group.klass.color} 55%, transparent)"
					style:background="color-mix(in srgb, {group.klass.color} 14%, transparent)"
				>
					<Icon name={group.klass.icon as IconName} size={14} />
				</span>
				<h3 class="m-0 text-base font-black" style:color={group.klass.color}>
					{group.klass.name}
				</h3>
				<span class="font-mono text-[0.62rem] uppercase tracking-widest text-[var(--fg-dim)]">
					{group.klass.seat} · {group.klass.faction} · {group.cards.length} card types
					{#if group.moves.length > group.cards.length}· 1 power{/if}
				</span>
			</header>

			{#each group.moves as move (move.ability.key)}
				{@const a = move.ability}
				{@const fx = fxFor(a.key, move.side)}
				{@const note = CARD_NOTES[a.key]}
				{@const attack = a.kind === 'strike' || a.kind === 'implant'}
				{@const heat = heatFor(a.kind, a.noise)}
				<!-- A power is bordered in the accent so it reads as a different KIND of
				     thing from the cards above it, not as the last card in the list. -->
				<article
					class="flex flex-col gap-4 rounded-lg border p-4 md:flex-row
					       bg-[color-mix(in_srgb,var(--bg-elev)_60%,transparent)]"
					style:border-color={move.uses === null ? 'var(--border)' : 'var(--accent)'}
				>
					<div class="shrink-0 self-start">
						<CardFace
							ability={a}
							{fx}
							seatColor={group.klass.color}
							affordable
							disabled={false}
							armed={false}
							raised={false}
							icon={fx.icon as IconName}
							skillMod={group.klass.skills[a.skill]}
						/>
					</div>

					<div class="flex min-w-0 flex-1 flex-col gap-3">
						<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<h4 class="m-0 text-sm font-black">{a.name}</h4>
							<span
								class="font-mono text-[0.6rem] uppercase tracking-widest"
								style:color={fx.hue}>{a.kind}</span
							>
							{#if move.uses === null}
								<span
									class="rounded-sm border border-[var(--border-strong)] px-1.5 py-0.5 font-mono
									       text-[0.55rem] uppercase tracking-widest text-[var(--fg-dim)]"
									title="how many sit in the side's draw pile"
									>×{move.copies}</span
								>
							{:else}
								<span
									class="rounded-sm border border-[var(--accent)] px-1.5 py-0.5 font-mono
									       text-[0.55rem] uppercase tracking-widest text-[var(--accent)]"
									title="a character's own move — on the sheet, never in a pile"
									>power · {move.uses} use</span
								>
							{/if}
						</div>

						<p class="m-0 text-[0.8rem] italic leading-snug text-[var(--fg-dim)]">
							“{a.text}”
						</p>

						{#if note}
							<div class="flex flex-col gap-1.5 text-[0.82rem] leading-snug">
								<p class="m-0">
									<b class="font-mono text-[0.6rem] uppercase tracking-widest text-[var(--accent)]"
										>In play</b
									>
									<span class="ml-2">{note.play}</span>
								</p>
								{#if note.partial}
									<p class="m-0">
										<b
											class="font-mono text-[0.6rem] uppercase tracking-widest text-[#FBBF24]"
											>Partial</b
										>
										<span class="ml-2">{note.partial}</span>
									</p>
								{/if}
								{#if note.miss}
									<p class="m-0">
										<b
											class="font-mono text-[0.6rem] uppercase tracking-widest text-[#FB7185]"
											>Miss</b
										>
										<span class="ml-2">{note.miss}</span>
									</p>
								{/if}
								{#if note.caveat}
									<p class="m-0 text-[var(--fg-dim)]">
										<b class="font-mono text-[0.6rem] uppercase tracking-widest">Note</b>
										<span class="ml-2">{note.caveat}</span>
									</p>
								{/if}
							</div>
						{/if}

						<dl
							class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[0.68rem]
							       sm:grid-cols-[auto_1fr_auto_1fr]"
						>
							<dt class="uppercase tracking-wide text-[var(--fg-dim)]">Cost</dt>
							<dd class="m-0">{a.ap} AP</dd>

							<dt class="uppercase tracking-wide text-[var(--fg-dim)]">Copies</dt>
							<dd class="m-0">
								{#if move.uses === null}
									{move.copies} in the {move.side} deck
								{:else}
									none — it is on the character sheet, not in any pile
								{/if}
							</dd>

							<dt class="uppercase tracking-wide text-[var(--fg-dim)]">Rolls on</dt>
							<dd class="m-0 flex items-center gap-1.5">
								<Icon name={SKILL_GLYPH[a.skill]} size={11} />
								{SKILL_LABEL[a.skill]}
								<span class="text-[var(--fg-dim)]"
									>({group.klass.name.replace('The ', '')} {group.klass.skills[a.skill] >= 0
										? '+'
										: ''}{group.klass.skills[a.skill]})</span
								>
							</dd>

							<dt class="uppercase tracking-wide text-[var(--fg-dim)]">Card bonus</dt>
							<dd class="m-0">{a.mod >= 0 ? '+' : ''}{a.mod} to the roll</dd>

							<dt class="uppercase tracking-wide text-[var(--fg-dim)]">Beat what</dt>
							<dd class="m-0">
								{attack ? 'the building’s live hardening' : `DC ${a.dc ?? 8}`}
							</dd>

							<dt class="uppercase tracking-wide text-[var(--fg-dim)]">Heat</dt>
							<dd class="m-0">
								{#if move.side === 'blue'}
									none — blue never makes heat
								{:else if !heat.hit && !heat.fail && !heat.botch}
									none, win or lose
								{:else}
									{heat.hit} hit · {heat.fail} fail · {heat.botch} botch
								{/if}
							</dd>

							<dt class="uppercase tracking-wide text-[var(--fg-dim)]">Playable on</dt>
							<dd class="m-0">{groundFor(move)}</dd>

							<dt class="uppercase tracking-wide text-[var(--fg-dim)]">Legal targets</dt>
							<dd class="m-0">{targetsFor(move)}</dd>

							<dt class="uppercase tracking-wide text-[var(--fg-dim)]">Leaves behind</dt>
							<dd class="m-0 sm:col-span-3">
								{#if fx.leaves === 'nothing'}
									{LEAVES.nothing}
								{:else}
									{fx.squad.count}
									{LEAVES[fx.leaves]}
								{/if}
							</dd>
						</dl>
					</div>
				</article>
			{/each}
		</section>
	{/each}

	<p class="m-0 font-mono text-[0.65rem] leading-relaxed text-[var(--fg-dim)]">
		Heat is per TERRITORY, not per building — a loud attack on the Dependency Mill raises the
		number over the whole {TERRITORIES.foundry.name}. It decays by 4 at the top of every round.
	</p>
</div>
