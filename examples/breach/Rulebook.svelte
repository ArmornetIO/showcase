<script lang="ts">
	// ── BREACH · the rulebook ────────────────────────────────────────────────────
	// The game had no rules page. It had a beautiful board, seventeen cards with
	// sentences on them, and no single place that said what a turn IS — so a new
	// player's first question ("what does TECH mean") was answerable only by
	// reading `match.svelte.ts`.
	//
	// This is that page, and it is written to one rule: every number on it comes
	// out of the same modules the engine runs on. `HORIZON`, `HAND_SIZE`, the
	// odds, the roster, the whole deck — imported, never retyped. A rules
	// reference that keeps its own copy of the numbers is a rules reference that
	// silently starts lying the first time somebody rebalances a card.
	//
	// The one thing it does keep in prose is BEHAVIOUR: what a card does to the
	// board once it resolves. That cannot be derived from data, it lives in
	// `rulebook/notes.ts`, and where the printed flavour and the engine disagree
	// the note says which one the table will actually enforce.
	//
	// The furniture — contents rail, its collapse tab, the layout panel — is the
	// library's docs shell rather than a hand-rolled sidebar. The rail reads its
	// entries out of the rendered headings, so a section added below appears in
	// it without anybody remembering to also add a line to a list.
	import { DocsBreadcrumbs, DocsShell, Icon, type IconName } from 'showcase';
	import BoardTable from './rulebook/BoardTable.svelte';
	import DeckList from './rulebook/DeckList.svelte';
	import SeatTable from './rulebook/SeatTable.svelte';
	import { CATALOGUE } from './internal/deck.js';
	import { GARRISON_CAP } from './internal/fx.js';
	import { HAND_SIZE, HORIZON } from './internal/match.svelte.js';
	import { UPGRADE_ROUNDS } from './internal/upgrades.js';
	import {
		CHAIN,
		INITIATIVE,
		OUTCOME_LABEL,
		OUTCOME_COLOR,
		STRUCTURES,
		computeOdds,
		klassByKey,
		oddsAtLeast,
		powerOf,
		structureById
	} from './internal/rules.js';

	interface Props {
		/** Where the game itself lives, so the page can point back at it. */
		playHref?: string;
		/**
		 * Height of the host's fixed chrome. The contents rail is pinned to the
		 * viewport, so without this it slides under whatever the host floats at
		 * the top of the window.
		 */
		topOffset?: string;
	}

	let { playHref = '', topOffset = '0px' }: Props = $props();

	// ── A worked example, priced by the engine ─────────────────────────────────
	// The Maintainer opening on step 1 of the path with their power. It comes off
	// the character rather than out of `CATALOGUE` because a power was never in a
	// deck — the old lookup here searched the catalogue for it and would now find
	// nothing at all.
	// Every number below is `computeOdds` answering, not a hand-written figure.
	const maintainer = klassByKey('maintainer');
	const fixture = powerOf('maintainer')!;
	const forum = structureById('forum')!;
	const example = computeOdds({
		hardening: forum.hardening,
		skill: maintainer.skills[fixture.skill],
		abilityMod: fixture.mod,
		resourceMod: 0,
		holdMod: 0,
		defenceMod: 0
	});

	const pct = (n: number) => `${Math.round(n * 100)}%`;

	const BANDS = [
		{ key: 'botch', margin: '−5 or worse', means: 'It went wrong. Extra heat, and on an attack you lose one of your own figures and do not even scuff the wall.' },
		{ key: 'fail', margin: '0 or less', means: 'Short. A tie counts as a fail — ties go to the defender. An attack that just missed still chips 1 off the building.' },
		{ key: 'partial', margin: '+1 to +3', means: 'Half the printed effect, rounded up. An attack gets in, but the foothold is dislodgeable rather than persistent.' },
		{ key: 'clean', margin: '+4 to +7', means: 'Exactly what the card says.' },
		{ key: 'critical', margin: '+8 or better', means: 'The card and then some: +1 on effects, and an attack drives off two defenders instead of one.' }
	] as const;

	const DICE = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

	const seats = INITIATIVE.map(klassByKey);
</script>

{#snippet crumbs()}
	<DocsBreadcrumbs
		items={[{ label: 'BREACH', href: playHref || null }, { label: 'Rules & deck' }]}
	/>
{/snippet}

<DocsShell breadcrumbs={crumbs} {topOffset}>
	<div class="mx-auto flex w-full max-w-[68rem] min-w-0 flex-col gap-12">
		<header class="flex flex-col items-start gap-3">
			<h1 class="m-0 text-3xl font-black tracking-tight">BREACH — rules &amp; deck</h1>
			<p class="m-0 max-w-[68ch] text-[0.95rem] leading-relaxed text-[var(--fg-dim)]">
				A 2v2 card skirmish about a software supply-chain attack. One side is trying to get a
				payload through five buildings; the other side is trying to run out the clock
				while finding out what is already inside. Everything below is what the engine actually
				does — where a card’s printed sentence promises more than the code delivers, it says so.
			</p>
			{#if playHref}
				<a
					class="flex items-center gap-2 rounded-md border border-[var(--border-strong)]
					       px-3 py-2 font-mono text-[0.65rem] uppercase tracking-widest
					       hover:border-[var(--accent)] hover:text-[var(--accent)]"
					href={playHref}
				>
					<Icon name="flag" size={12} /> Play BREACH
				</a>
			{/if}
		</header>

		<!-- ── 1 ────────────────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-3">
			<h2 id="minute" class="m-0 scroll-mt-8 text-lg font-black">The game in a minute</h2>
			<ol class="m-0 flex list-decimal flex-col gap-2 pl-5 text-[0.88rem] leading-relaxed">
				<li>
					Four chairs: two RED (the attackers) and two BLUE (the defenders). They act in a fixed
					alternating order and each gets 3 action points per round.
				</li>
				<li>
					The board is {STRUCTURES.length} buildings across five regions. {CHAIN.length} of them
					are the <b>payload path</b>, numbered 1–{CHAIN.length}.
				</li>
				<li>
					Red wins by holding all {CHAIN.length} steps of the path at once. Steps 1–{CHAIN.length - 1}
					may be taken in <b>any order</b>, but holding the step before a target is worth
					<b>+1 to +5</b> on the roll, so going in order is a choice rather than a rule.
					The last step is the exception: the payload needs the whole chain, and taking it
					is the win.
				</li>
				<li>
					Blue wins by surviving to the end of round {HORIZON}. Blue cannot remove a foothold
					red has taken; blue can only make the next one harder and slower.
				</li>
				<li>
					Every card play is a 2d6 roll. Attacks roll against the target building’s hardening;
					everything else rolls against a difficulty printed on the card.
				</li>
				<li>
					Red is playing in the dark on purpose: blue does not see red’s footholds until blue
					<b>finds</b> them, or until red gets loud enough to give them away.
				</li>
			</ol>
		</section>

		<!-- ── 2 ────────────────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-3">
			<h2 id="table" class="m-0 scroll-mt-8 text-lg font-black">The table</h2>
			<p class="m-0 text-[0.88rem] leading-relaxed">
				Turn order is fixed and it alternates: red, blue, red, blue. That interleave is a rule,
				not a seating accident — it is why a red plan has to survive a blue turn in the middle
				of it.
			</p>
			<ol class="m-0 flex list-none flex-wrap items-center gap-2 p-0">
				{#each seats as k, i (k.key)}
					<li class="flex items-center gap-2">
						<span
							class="flex items-center gap-2 rounded-md border border-[var(--border-strong)] px-2.5 py-1.5"
							style:background="color-mix(in srgb, {k.color} 12%, transparent)"
						>
							<Icon name={k.icon as IconName} size={13} />
							<b class="text-[0.78rem]" style:color={k.color}>{k.name}</b>
							<span class="font-mono text-[0.6rem] text-[var(--fg-dim)]">{k.seat}</span>
						</span>
						{#if i < seats.length - 1}<Icon name="chevron-right" size={12} />{/if}
					</li>
				{/each}
			</ol>
			<p class="m-0 text-[0.88rem] leading-relaxed text-[var(--fg-dim)]">
				After the last chair acts, the round ends and <b>upkeep</b> runs: AP refills to 3, heat
				decays by 4 everywhere, temporary effects lapse, damaged buildings repair 1, red’s
				implants burrow deeper, and any region that has gone loud gives up what is hiding in it.
				A turn clock (30 seconds by default) ends your turn for you if you sit on it.
			</p>
			<p class="m-0 text-[0.88rem] leading-relaxed text-[var(--fg-dim)]">
				A <b>1v1</b> table is the same order with the back two chairs left in the box: the
				Maintainer and the Architect act, the Handler and the Threat Hunter do not. The cards
				stay — a pile belongs to a side, so the Maintainer draws and plays the Handler’s cards
				too, priced through the Maintainer’s skills, which is not the same card. What goes
				missing is the absent seat’s turns, its skill spread and its <b>power</b>: red at 1v1 has
				no Zero-Day Reserve and blue has no Attribution. The horizon does not move to compensate.
			</p>
		</section>

		<!-- ── 3 · the section this page exists for ─────────────────────────── -->
		<section class="flex flex-col gap-3">
			<h2 id="you-vs-card" class="m-0 scroll-mt-8 text-lg font-black">
				What YOU have vs what a CARD has
			</h2>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed">
				This is the part the board never explains. A card is not self-contained: it names a
				skill, and <em>you</em> supply the rating. The same Zero-Day in two different hands is
				two different cards, and that is the whole design.
			</p>
			<div class="grid gap-4 md:grid-cols-2">
				<div class="rounded-lg border border-[var(--border)] p-4">
					<h3 class="m-0 mb-2 font-mono text-[0.65rem] uppercase tracking-widest text-[var(--accent)]">
						A seat (you) has
					</h3>
					<dl class="m-0 flex flex-col gap-2 text-[0.82rem] leading-snug">
						<div>
							<dt class="font-bold">Four skill ratings</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								SOCIAL, TECH, OPSEC, ANALYSIS — roughly −1 to +4. Whichever one a card names
								is added to that card’s roll. Nothing else uses them.
							</dd>
						</div>
						<div>
							<dt class="font-bold">3 action points a round</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								Cards cost 1–3 AP. Unspent AP is lost at the end of the round. Upgrades can
								raise it to 4.
							</dd>
						</div>
						<div>
							<dt class="font-bold">A hand of {HAND_SIZE} cards</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								Drawn from your SIDE’s shared pile, not your own. Play one, draw one
								immediately. When the pile runs out the discards are reshuffled back in.
							</dd>
						</div>
						<div>
							<dt class="font-bold">A resource</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								REP, BANK, BUDGET or SIGNAL. Only the Maintainer’s REP does anything today —
								see the seats section.
							</dd>
						</div>
						<div>
							<dt class="font-bold">One power</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								Your character’s own move, printed on the sheet rather than dealt. One charge a
								match. It is never in a pile, so it cannot be shuffled away from you and your
								ally can never draw it.
							</dd>
						</div>
						<div>
							<dt class="font-bold">A passive and an upgrade track</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								Three upgrades, unlocked automatically at rounds {UPGRADE_ROUNDS.join(', ')}.
								Nothing to buy and nothing to choose.
							</dd>
						</div>
					</dl>
				</div>
				<div class="rounded-lg border border-[var(--border)] p-4">
					<h3 class="m-0 mb-2 font-mono text-[0.65rem] uppercase tracking-widest text-[var(--accent)]">
						A card has
					</h3>
					<dl class="m-0 flex flex-col gap-2 text-[0.82rem] leading-snug">
						<div>
							<dt class="font-bold">A cost, top-left</dt>
							<dd class="m-0 text-[var(--fg-dim)]">Action points, 1–3.</dd>
						</div>
						<div>
							<dt class="font-bold">A skill, under the name</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								The glyph and number on the card face is <em>your</em> rating in the skill this
								card rolls on. Green is good for you, red is bad.
							</dd>
						</div>
						<div>
							<dt class="font-bold">A power, bottom-left</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								For an attack, the bonus it adds to the roll. For anything else, the size of the
								effect (hardening moved, rounds sealed, REP gained).
							</dd>
						</div>
						<div>
							<dt class="font-bold">A noise, bottom-right</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								How much heat playing it makes. Failing multiplies it. Blue cards never make
								any.
							</dd>
						</div>
						<div>
							<dt class="font-bold">A difficulty, or none</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								Attacks roll against the target building. Everything else has a fixed DC
								printed in the card’s data (shown per card below).
							</dd>
						</div>
						<div>
							<dt class="font-bold">Where it may be played</dt>
							<dd class="m-0 text-[var(--fg-dim)]">
								Whose ground, and sometimes a named list of buildings. See “Where a card may be
								played”.
							</dd>
						</div>
					</dl>
				</div>
			</div>
		</section>

		<!-- ── 4 ────────────────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-3">
			<h2 id="turn" class="m-0 scroll-mt-8 text-lg font-black">A turn, step by step</h2>
			<ol class="m-0 flex list-decimal flex-col gap-2 pl-5 text-[0.88rem] leading-relaxed">
				<li><b>Pick a card</b> from your hand of {HAND_SIZE}. The board lights up every building it could legally be played on.</li>
				<li><b>Drop it on a building.</b> A greyed-out building is a hard no — a rule forbids it. A lit building that is <em>sealed</em> is a soft no: you are allowed to try, and it will be swatted.</li>
				<li><b>The AP is spent</b> and the card leaves your hand. You draw a replacement immediately, so you are always looking at {HAND_SIZE}.</li>
				<li><b>Your figures cross the map</b> to the building, and 2d6 are rolled.</li>
				<li><b>The outcome is read off the margin</b> — botch, fail, partial, clean or critical — and applied.</li>
				<li><b>Heat moves</b> if it was a red card. Then you may play again if you still have AP, or end your turn.</li>
			</ol>
			<p class="m-0 text-[0.88rem] leading-relaxed text-[var(--fg-dim)]">
				You may play as many cards as you can pay for. Three 1-AP cards or one 3-AP card is the
				real decision most turns.
			</p>
		</section>

		<!-- ── 5 ────────────────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-4">
			<h2 id="roll" class="m-0 scroll-mt-8 text-lg font-black">How a roll works</h2>
			<p class="m-0 text-[0.88rem] leading-relaxed">
				<b>Every card rolls.</b> Two six-sided dice, plus everything you bring, measured against a
				target number.
			</p>
			<div class="rounded-lg border border-[var(--border-strong)] p-4 font-mono text-[0.8rem] leading-relaxed">
				2d6
				<span class="text-[var(--accent)]">+ your rating in the card’s skill</span>
				<span class="text-[var(--accent)]">+ the card’s own bonus</span>
				<span class="text-[var(--accent)]">+ roll upgrades</span>
				<span class="text-[#F472B6]">+ REP (red attacks only, max 3)</span>
				<span class="text-[#F472B6]">+ leverage (red attacks on the path only)</span>
				<br />
				<span class="text-[var(--fg-dim)]">versus</span>
				the building’s live hardening <span class="text-[var(--fg-dim)]">(attacks)</span> or the
				card’s DC <span class="text-[var(--fg-dim)]">(everything else)</span>
			</div>
			<p class="m-0 text-[0.88rem] leading-relaxed">
				The <b>margin</b> is your total minus the target, and the margin is what decides how well
				it went. There is no flat pass/fail:
			</p>
			<table class="w-full border-collapse text-left">
				<thead>
					<tr class="font-mono text-[0.55rem] uppercase tracking-widest text-[var(--fg-dim)]">
						<th class="py-1 pr-3 font-normal">Outcome</th>
						<th class="py-1 pr-3 font-normal">Margin</th>
						<th class="py-1 font-normal">What it means</th>
					</tr>
				</thead>
				<tbody class="text-[0.82rem]">
					{#each BANDS as b (b.key)}
						<tr class="border-t border-[var(--border)] align-top">
							<td class="py-1.5 pr-3 font-mono font-black" style:color={OUTCOME_COLOR[b.key]}
								>{OUTCOME_LABEL[b.key]}</td
							>
							<td class="py-1.5 pr-3 font-mono tabular-nums text-[var(--fg-dim)]">{b.margin}</td>
							<td class="py-1.5 leading-snug">{b.means}</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<h3 class="m-0 mt-2 text-sm font-black">What 2d6 can actually do</h3>
			<p class="m-0 text-[0.85rem] leading-relaxed text-[var(--fg-dim)]">
				Worth internalising, because it is the difference between a plan and a hope. The dice
				alone average 7, and a +4 modifier is worth more than any single card in the deck.
			</p>
			<div class="overflow-x-auto">
				<table class="border-collapse text-left font-mono text-[0.72rem]">
					<thead>
						<tr class="text-[var(--fg-dim)]">
							<th class="py-1 pr-3 font-normal">Dice reach</th>
							{#each DICE as d (d)}
								<th class="px-1.5 py-1 text-right font-normal tabular-nums">{d}+</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						<tr class="border-t border-[var(--border)]">
							<td class="py-1 pr-3 text-[var(--fg-dim)]">Chance</td>
							{#each DICE as d (d)}
								<td class="px-1.5 py-1 text-right tabular-nums">{pct(oddsAtLeast(d))}</td>
							{/each}
						</tr>
					</tbody>
				</table>
			</div>

			<h3 class="m-0 mt-2 text-sm font-black">Worked example</h3>
			<div class="rounded-lg border border-[var(--border)] p-4 text-[0.84rem] leading-relaxed">
				<p class="m-0 mb-2">
					<b style:color={maintainer.color}>{maintainer.name}</b> opens with
					<b>{fixture.name}</b> against the <b>{forum.name}</b> — step 1 of the payload path,
					round 1, nothing bought or softened yet.
				</p>
				<ul class="m-0 flex list-none flex-col gap-0.5 p-0 font-mono text-[0.75rem]">
					<li>
						skill ({fixture.skill}) {example.skill >= 0 ? '+' : ''}{example.skill}
						· card {example.abilityMod >= 0 ? '+' : ''}{example.abilityMod} · REP +{example.resourceMod}
						· leverage +{example.holdMod}
						<b> = {example.modifier >= 0 ? '+' : ''}{example.modifier}</b>
					</li>
					<li>target — {forum.name} hardening <b>{example.target}</b></li>
					<li>
						so the dice must reach <b>{example.needed}</b> to get in at all, and
						<b>{example.neededClean}</b> for a clean hit
					</li>
					<li>
						<span style:color={OUTCOME_COLOR.partial}>{pct(example.chance)}</span> to take it ·
						<span style:color={OUTCOME_COLOR.clean}>{pct(example.chanceClean)}</span> for a
						persistent foothold ·
						<span style:color={OUTCOME_COLOR.botch}>{pct(example.chanceBotch)}</span> to come
						apart
					</li>
				</ul>
				<p class="m-0 mt-2 text-[var(--fg-dim)]">
					The game shows you all of this before you commit — the odds panel is not a nicety,
					it is the interface for the only real decision you make.
				</p>
			</div>
		</section>

		<!-- ── 6 ────────────────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-3">
			<h2 id="where" class="m-0 scroll-mt-8 text-lg font-black">Where a card may be played</h2>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed">
				Three kinds of ground: red’s own staging grounds, blue’s estate, and the neutral supply
				chain between them. <b>You may not act on your own ground</b> unless the card says
				otherwise — which is why blue’s wall-building cards name blue explicitly, and why blue’s
				two reaches into red territory (Segment and Attribution, both powers) are such a big
				deal.
			</p>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed">
				Some cards additionally name a fixed list of buildings. Both restrictions are printed
				per card below.
			</p>
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="rounded-lg border border-[#94A3B8]/30 p-3">
					<b class="text-[0.82rem]">Hard block — greyed out</b>
					<p class="m-0 mt-1 text-[0.8rem] leading-snug text-[var(--fg-dim)]">
						Wrong side of the board, wrong building, or the path step before it is not held
						yet. The card will not drop. Rules should be unplayable.
					</p>
				</div>
				<div class="rounded-lg border border-[#A78BFA]/40 p-3">
					<b class="text-[0.82rem]">Sealed — lit, and it will fail</b>
					<p class="m-0 mt-1 text-[0.8rem] leading-snug text-[var(--fg-dim)]">
						A quarantine is in the way. You are allowed to run at it: the card is spent, the AP
						is burned, no roll happens, and the noise goes up by more than a normal play. That
						is the defender’s payoff for having sealed it.
					</p>
				</div>
			</div>
		</section>

		<!-- ── 7 ────────────────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-3">
			<h2 id="footholds" class="m-0 scroll-mt-8 text-lg font-black">
				Attacks, footholds and leverage
			</h2>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed">
				Only red’s <b>strike</b> and <b>implant</b> cards are attacks — they are the only ones
				that roll against a building instead of a fixed number, and the only ones that can take
				a foothold.
			</p>
			<ul class="m-0 flex list-none flex-col gap-2 pl-0 text-[0.85rem] leading-relaxed">
				<li class="border-l-2 border-[#F472B6]/50 pl-3">
					<b>A hit takes the building.</b> A partial gets you in but the foothold is
					<em>dislodgeable</em>; a clean or better makes it <em>persistent</em>. One blue
					defender is driven off (two on a critical), and your figures take their place.
				</li>
				<li class="border-l-2 border-[#F472B6]/50 pl-3">
					<b>A miss still hurts the wall.</b> A plain fail chips 1 permanent point off the
					building’s hardening. A botch does not even manage that and costs you one of your own
					figures. Upkeep repairs 1 chip per building per round, so wearing something down means
					keeping the pressure <em>on it</em> rather than chipping at everything once.
				</li>
				<li class="border-l-2 border-[#F472B6]/50 pl-3">
					<b>Attacking a building you already hold digs in.</b> It becomes persistent and
					<em>staged</em> — which is worth +2 on your next step of the path. That is the real
					choice a foothold creates: push on now at the odds you have, or spend a turn and push
					on at better ones.
				</li>
				<li class="border-l-2 border-[#F472B6]/50 pl-3">
					<b>Leverage compounds.</b> Attacking step N of the path, you get +1 for holding step
					N−1 at all, +1 per implant figure still standing there (max +2), and +2 if that
					foothold is staged. A chain of five independent fights would be five unrelated
					fights; this is what makes it an intrusion.
				</li>
				<li class="border-l-2 border-[#F472B6]/50 pl-3">
					<b>Nothing removes a foothold.</b> Not one card in the deck. Once red is in, red is
					in — blue can only reveal it, clear the implant figures out of it, and seal the door
					so the chain cannot advance through it.
				</li>
			</ul>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed text-[var(--fg-dim)]">
				Implant figures are separate from the foothold. Left alone, each one burrows at the top
				of every round: −1 more hardening and +2 heat, each, compounding, until a blue card pulls
				them out. Up to {GARRISON_CAP} figures of one side can stand on a building.
			</p>
		</section>

		<!-- ── 8 ────────────────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-3">
			<h2 id="heat" class="m-0 scroll-mt-8 text-lg font-black">Heat, detection and the fog</h2>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed">
				There are no hit points in BREACH. You are never damaged, you are <em>found out</em>. Heat
				is one number per region, 0–100, and it is the same number both sides are looking at —
				red calls it HEAT, blue calls it DETECTION.
			</p>
			<ul class="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[0.85rem] leading-relaxed">
				<li>Only red makes heat. Blue’s cards never move it.</li>
				<li>
					A card’s noise pip is multiplied on the way in. Succeeding costs the printed amount;
					failing roughly doubles it and botching triples it. The exact figures per card are in
					the deck list.
				</li>
				<li>Running at a sealed building is the loudest, least productive thing you can do.</li>
				<li>Every implant left standing adds 2 a round on its own.</li>
				<li>Heat decays 4 per region at the top of every round — you can go quiet again.</li>
				<li>
					<b>At 80, the region gives everything up.</b> Every hidden foothold in it is revealed
					at upkeep. Sleepers are the one exception.
				</li>
				<li>
					A foothold taken while the region is already at 80+ is <b>born revealed</b>. Loud
					attacks do not just risk exposure later; they hand it over immediately.
				</li>
			</ul>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed">
				The fog is asymmetric and total. Red sees the whole board. Blue sees only footholds it
				has revealed, and its battle log gets the honest but useless line “detection rose in the
				Foundry, +12, cause unknown”. A row blue may not read is <em>absent</em> from what the
				server sends, not greyed out in it. At the end of the match the log is unfogged and blue
				finds out what was actually going on.
			</p>
			<ul class="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[0.85rem] leading-relaxed">
				<li>
					<b>An attack that was repelled reaches blue as “contact”.</b> Blue is owed the fact
					that something ran at the wall — walls make a noise — but not which card did it.
					“Somebody tried the Forge” and “red has burned its Zero-Day” are different reads, and
					the second is one blue has to earn.
				</li>
				<li>
					<b>Softening and chip damage are red’s books.</b> Blue is shown each building’s live
					hardening and never the breakdown, because a wall that quietly dropped 3 the turn
					before a strike would name red’s next target for free. What blue loses is <em>why</em>
					the number moved, not the number.
				</li>
				<li>
					<b>A spectator gets the pieces and nothing else.</b> Anybody with the link who never
					sits down sees revealed footholds, figures standing in the open and every building’s
					condition — no feed and no hand. A bystander handed blue’s private feed is the fog
					gone for the price of a second browser tab.
				</li>
			</ul>
		</section>

		<!-- ── 9 ────────────────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-3">
			<h2 id="blue" class="m-0 scroll-mt-8 text-lg font-black">How blue actually fights back</h2>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed">
				Blue has no attacks and cannot evict a foothold, which reads as hopeless until you see
				what blue is really doing: making every remaining step of the path cost more time than
				red has.
			</p>
			<ul class="m-0 flex list-none flex-col gap-2 pl-0 text-[0.85rem] leading-relaxed">
				<li class="border-l-2 border-[#38BDF8]/50 pl-3">
					<b>Wall</b> — Harden posts 3 defender figures, each worth +1 hardening, on a building.
					Red gets that number back down by taking them off it.
				</li>
				<li class="border-l-2 border-[#38BDF8]/50 pl-3">
					<b>Seal</b> — Quarantine shuts a building for up to 3 rounds. Attacks on it are blocked
					before the roll, implants inside it stop burrowing, and <em>the payload path cannot
					advance through it</em>. This is blue’s clock-burner. It does not take ground back: a
					step red already holds still counts towards red’s win while it is sealed.
				</li>
				<li class="border-l-2 border-[#34D399]/50 pl-3">
					<b>Reveal</b> — Sweep looks at a whole region; Diff, Attestation and Rebuild look at one
					building but read deep. Revealing does not remove anything, but it is the only way blue
					learns where the chain has got to.
				</li>
				<li class="border-l-2 border-[#34D399]/50 pl-3">
					<b>Clean</b> — the same reveal cards pull implant figures out of the tree. One on a
					partial, all of them on a clean. This is what stops the burrowing and takes red’s
					leverage away.
				</li>
				<li class="border-l-2 border-[#38BDF8]/50 pl-3">
					<b>Counter-attack</b> — Segment on the Relay Beacon reveals <em>every</em> hidden
					foothold on the board. Attribution on the Persona Farm wipes the Maintainer’s REP.
					These two are the only reason blue ever walks into red’s territory, and they are
					powers: one charge each, per match, and no second copy anywhere.
				</li>
			</ul>
		</section>

		<!-- ── 10 ───────────────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-3">
			<h2 id="ending" class="m-0 scroll-mt-8 text-lg font-black">How it ends</h2>
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="rounded-lg border border-[#F472B6]/40 p-4">
					<b class="text-[0.85rem] text-[#F472B6]">Red — payload delivered</b>
					<p class="m-0 mt-1 text-[0.82rem] leading-snug text-[var(--fg-dim)]">
						Red holds a foothold on all {CHAIN.length} steps of the path at the same time.
						Checked after every action, so it can happen mid-turn.
					</p>
				</div>
				<div class="rounded-lg border border-[#38BDF8]/40 p-4">
					<b class="text-[0.85rem] text-[#38BDF8]">Blue — horizon reached</b>
					<p class="m-0 mt-1 text-[0.82rem] leading-snug text-[var(--fg-dim)]">
						Round {HORIZON} ends with the path incomplete. Whatever red got in with is still in;
						it simply ran out of time to finish.
					</p>
				</div>
			</div>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed text-[var(--fg-dim)]">
				Running out of cards is not one of them — a dry pile reshuffles its discards. The end
				screen unfogs the whole log: red finds out which quiet turns blue never noticed, blue
				finds out how close it was.
			</p>
		</section>

		<section class="flex flex-col gap-4">
			<h2 id="board" class="m-0 scroll-mt-8 text-lg font-black">The board</h2>
			<BoardTable />
		</section>

		<section class="flex flex-col gap-4">
			<h2 id="seats" class="m-0 scroll-mt-8 text-lg font-black">The four seats</h2>
			<SeatTable />
		</section>

		<section class="flex flex-col gap-4">
			<h2 id="deck" class="m-0 scroll-mt-8 text-lg font-black">The deck, and the four powers</h2>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed text-[var(--fg-dim)]">
				{CATALOGUE.length} card types. Each side has its own pile and both seats on a side draw
				from it, so your ally can draw the card you wanted.
			</p>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed text-[var(--fg-dim)]">
				Four moves are not in either pile. The Obfuscated Test Fixture, the Zero-Day Reserve,
				Segment and Attribution are <b>powers</b>: they live on their character’s sheet, roll down
				exactly the same path as a card, and have one charge each instead of a place in a deck.
				A power cannot be drawn, discarded, reshuffled or handed to an ally, because there is no
				pile for it to be in. They are listed below after the cards of the seat that carries them,
				with an accent border.
			</p>
			<DeckList />
		</section>

		<!-- ── 14 ───────────────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-3">
			<h2 id="print" class="m-0 scroll-mt-8 text-lg font-black">Where the print lies</h2>
			<p class="m-0 max-w-[70ch] text-[0.88rem] leading-relaxed">
				Card faces, character sheets and building notes were written before some of the engine
				was, and a good many sentences promise things the code never learned to do. Every entry
				below was checked against <code class="text-[0.8rem]">internal/breach</code> — the Go
				engine an online table actually resolves against. They are collected here so nobody plans
				a turn around one.
			</p>

			<h3 class="m-0 mt-1 text-sm font-black">Cards and powers</h3>
			<ul class="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[0.85rem] leading-relaxed">
				<li>
					<b>Sleeper Implant</b> — “cannot be found by a sweep for 2 rounds”. There is no timer:
					it hides from sweeps permanently, and from the detection-80 auto-reveal too. Diff,
					Attestation and Rebuild still find it.
				</li>
				<li>
					<b>Release Divergence</b> — “only an artifact-to-source diff can see it”. It leaves an
					ordinary foothold with no sleeper flag, so Sweep turns it up like anything else.
				</li>
				<li>
					<b>Certificate Pressure</b> — “the Checkpoint loses 4 hardening this round”. The
					softening runs for <em>two</em> rounds, lapsing at the top of the round after next.
				</li>
				<li>
					<b>Rebuild From Source</b> — “evicts any non-persistent foothold in the Foundry”. It
					evicts implant <em>figures</em>, at the one building you played it on. No move in the
					game removes a foothold, and none of them read the Foundry as a unit.
				</li>
				<li>
					<b>Harden</b> — “+3 hardening, permanently”. The +3 is three figures standing on the
					wall, and a red hit knocks them off one at a time.
				</li>
				<li>
					<b>Quarantine</b> — “anything held inside it cannot advance the chain”. A seal stops
					red attacking <em>through</em> a building, but the victory check never reads the
					quarantine list. Sealing a chain step red is already standing on does not take it back,
					and red still wins the moment the other four are held.
				</li>
				<li>
					<b>Segment</b> — “cut a lane for 2 rounds. Nothing crosses it — including everything of
					yours that used it”. Only the Relay Beacon branch seals anything. Played anywhere else
					it is a plain reveal-and-clean at one building, with no lane, and it never costs blue a
					thing.
				</li>
				<li>
					<b>Attribution</b> — the face reads WIN. It resets the Maintainer’s REP to 0 and clears
					red’s figures off the Persona Farm; it does not end the match.
				</li>
			</ul>

			<h3 class="m-0 mt-1 text-sm font-black">Buildings</h3>
			<p class="m-0 max-w-[70ch] text-[0.85rem] leading-relaxed text-[var(--fg-dim)]">
				A building’s note is flavour with no rule under it unless something targets the building
				by name. These four read as rules and are not.
			</p>
			<ul class="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[0.85rem] leading-relaxed">
				<li>
					<b>The Observatory</b> — “blue may spend a turn here to look at any region”. There is
					no such move. No card or power names the Observatory, and none of them does anything
					different for having been played on it: Sweep there reads the Outlands, exactly as it
					would from any other building in the Outlands.
				</li>
				<li>
					<b>The Keep</b> — “take the Keep and you do not need the chain”. There is no alternate
					victory: red wins by holding the {CHAIN.length} chain steps and by nothing else. The
					Keep is off the chain, so taking it is worth exactly as much as taking any other
					off-chain building.
				</li>
				<li>
					<b>Exploit Workshop</b> — “burn it down and it cannot be spent at all”. Nothing in the
					game takes a move away from a player. Blue cannot disarm the Zero-Day by attacking a
					building — it is a power on the Handler’s sheet.
				</li>
				<li>
					<b>Posture Bastion</b> — “bend it and the map lies to Blue”. There is no
					misinformation mechanic, and taking the Bastion does not start one. Every number blue
					is shown is the true one; what the fog withholds from blue is detail — which rows,
					which footholds, how a wall came to be lower — never a false figure.
				</li>
				<li>
					<b>Contributor Sandbox</b> — “it is what taking it BUYS that matters”. It buys
					nothing. Leverage is paid only for holding the previous <em>chain</em> step, and the
					Sandbox has no chain position, so a foothold there is worth 0 towards any attack.
				</li>
			</ul>

			<h3 class="m-0 mt-1 text-sm font-black">Sheets, tracks and labels</h3>
			<ul class="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[0.85rem] leading-relaxed">
				<li>
					<b>The Handler’s “Patience”</b> — AP does not bank. It is overwritten with 3 plus your
					track at the top of every round.
				</li>
				<li>
					<b>The Threat Hunter’s “Baseline”</b> — there is no free sweep, and no notion of the
					territory you are standing in. Play the card.
				</li>
				<li>
					<b>The Maintainer’s “Trust Accrual”</b> — wrong twice. REP goes up by 1 every round no
					matter how loud you were, not 2 for a quiet one; and it is not spent 1-for-1, it is
					applied automatically as up to +3 on red attack rolls and never consumed. A Maintainer
					on 9 REP has the same +3 as one on 3.
				</li>
				<li>
					<b>Quiet upgrades buy nothing on a red support card.</b> The Handler’s Clean
					Infrastructure (+3 quiet) and the Maintainer’s Commit Rights (+2 quiet) come off the
					noise of a <em>strike or implant</em> only. Every control and econ card — Co-maintainer
					Pressure, Certificate Pressure, Earnest Contribution — uses its raw printed noise
					forever.
				</li>
				<li>
					<b>BANK, BUDGET and SIGNAL</b> — printed on three of the four sheets and read by
					nothing. BUDGET and SIGNAL are seeded at 2 and never looked at again; BANK is never
					even seeded. Only REP is wired up.
				</li>
				<li>
					<b>A card’s kind is mostly a label.</b> Only <code>strike</code> and
					<code>implant</code> change how a move resolves — they are the two that roll against a
					building and can take a foothold. <code>control</code> and <code>econ</code> are read
					only by the demonstrator when it picks a card. Nothing anywhere reads
					<code>recon</code> or <code>utility</code>.
				</li>
			</ul>
		</section>
	</div>
</DocsShell>
