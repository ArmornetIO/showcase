<script lang="ts">
	// ── How BREACH works ─────────────────────────────────────────────────────────
	// Four stats, one formula, two ways to win. A player who cannot answer "what
	// is that number and what beats it" is not playing the game, they are pressing
	// the lit button — and every number below is already on their screen
	// somewhere, so this is naming what they can see rather than teaching new
	// material.
	//
	// The last block is the exception, and it is why this panel is not just a
	// prettier card face. Several printed sentences promise rules the engine never
	// grew, and a player who never leaves the board would otherwise be told the
	// print is true. The full list is on the rules page; the ones here are the
	// ones somebody would actually plan a turn around and lose.
	import { Panel } from 'showcase';
	import { OUTCOME_COLOR, type Klass, type Outcome } from './internal/rules.js';

	interface Props {
		seat: Klass;
		onclose: () => void;
	}

	let { seat, onclose }: Props = $props();

	const NUMBERS: Array<[string, string]> = [
		['AP', 'Action points. Three a round, each card costs one to three. Spending them all is what ends your turn.'],
		['HARDENING', 'The number on every building. An attack has to BEAT it — ties go to the defender. Blue raises it, red talks it down.'],
		['HEAT / DETECTION', 'One meter per region, 0–100. Red actions raise it; it cools 4 a round. At 80 the region gives up whatever is hiding in it. Red calls it heat, blue calls it detection — it is the same number.'],
		['REP / BANK / BUDGET / SIGNAL', 'Your class resource. Only the Maintainer’s REP does anything: it is added automatically to red attack rolls, up to 3, and spending it does not consume it. BANK, BUDGET and SIGNAL are printed and read by nothing.'],
		['YOUR POWER', 'Your character’s own move, on the sheet rather than in the deck. One charge a match. It is in no pile, so it cannot be shuffled away from you and your ally can never draw it.']
	];

	const BANDS: Array<[Outcome, string, string]> = [
		['critical', '+8 or better', 'the card, and then some'],
		['clean', '+4 to +7', 'exactly what the card says'],
		['partial', '+1 to +3', 'half the printed effect, rounded up'],
		['fail', '0 or under', 'nothing — a tie goes to the defender'],
		['botch', '−5 or worse', 'it goes wrong and costs you something']
	];

	const GROUND: Array<[string, string, string]> = [
		['STAGING GROUNDS', '#F472B6', "red's own: the relay implants call home to, the workshop the zero-day lives in, the farm the persona was grown on. Blue can reach it."],
		['COMMONS · FOUNDRY · MARCHES', '#38BDF8', "blue's estate. What red is trying to get into."],
		['THE OUTLANDS', '#FB923C', 'the supply chain. Neither side owns it, both sides live off it, and the payload path starts there.']
	];

	const CHAIN_NOTES: Array<[string, string, string]> = [
		['Order is an incentive, not a rule.', 'var(--fg)', 'The first four steps of the payload path are open whenever — take them in any order you like. Only the payload itself is gated, and it needs the other four held. Sequence is simply the cheapest line, because the step before a target pays on the roll.'],
		['Quarantine cuts the line.', '#A78BFA', 'A sealed building cannot be attacked at all, and the legs of the path either side of it are drawn CUT — nothing advances THROUGH it while the seal holds. It does not take ground back: a step red already stands on still counts towards red’s win while it is sealed.'],
		['A foothold pays on the next step.', '#F472B6', 'Holding the previous building is +1 on the attack, each implant you left there is another +1 (to 2), and playing a card on ground you ALREADY hold digs in instead of taking it twice — persistent, staged, and worth +2 more.'],
		['An implant you ignore is not neutral.', '#FB7185', 'Every round it stands, it burrows: −1 hardening off the building it is in, and heat as it works. Leave two in the same place and the wall comes down on its own. Cleanup is a move you have to spend.']
	];

	const WINNING: Array<[string, string, string]> = [
		['RED', '#FB7185', 'holds all five steps of the payload path — Maintainer Circle, Archive, Forge, Silos, Checkpoint — at once, before round 12. The first four in any order; the payload last, because it needs them.'],
		['BLUE', '#38BDF8', 'reaches the end of round 12 with the path incomplete. That is the only way blue wins: there is no second condition, no alternate objective, and no building whose capture ends it.']
	];

	// ── Where the print lies ─────────────────────────────────────────────────────
	// Checked against the Go engine in `internal/breach`, which is what an online
	// table resolves against. The rules page carries the full list; these are the
	// ones that change how you would play the turn in front of you.
	const LIES: Array<[string, string]> = [
		['The Keep', 'Its note says take it and you do not need the chain. There is no alternate victory — only the five chain steps and the clock.'],
		['Quarantine', '“Anything held inside it cannot advance the chain.” It blocks attacks THROUGH a building; it does not un-hold one red already has.'],
		['Segment', '“Cut a lane. Nothing crosses it.” Only on the Relay Beacon does it seal anything. Anywhere else it is a reveal-and-clean at one building.'],
		['Harden', '“+3 hardening, permanently.” The +3 is three figures on the wall, and a red hit knocks them off one at a time.'],
		['Rebuild From Source', '“Evicts any non-persistent foothold.” Nothing in the game removes a foothold. It pulls out implant figures.'],
		['Sleeper Implant', '“Hidden for 2 rounds.” There is no timer — it hides from Sweep and from the detection-80 reveal permanently.'],
		['Certificate Pressure', '“This round.” The softening runs for two.'],
		['Release Divergence', '“Only an artifact-to-source diff can see it.” Sweep finds it like anything else.'],
		['Attribution', 'The face reads WIN. It wipes the Maintainer’s REP and clears the Persona Farm; it does not end the match.'],
		['Contributor Sandbox', '“It is what taking it BUYS that matters.” It is off the chain, so it buys nothing.'],
		['The Observatory · Posture Bastion · Exploit Workshop', 'Their notes describe a free look, a lying map and a disarmed zero-day. None of the three is a rule.'],
		['Patience · Baseline', 'AP does not bank, and there is no free sweep. Two passives with no engine behind them.'],
		['Quiet upgrades', 'Clean Infrastructure and Commit Rights come off attack noise only. A control or econ card pays its printed noise forever.']
	];
</script>

<!-- A titled block of prose. Six of these, identical in shape. -->
{#snippet section(title: string, body: import('svelte').Snippet)}
	<div class="flex flex-col gap-1">
		<span class="font-mono text-[0.56rem] tracking-[0.16em] uppercase text-[var(--fg-dim)]">
			/ {title}
		</span>
		{@render body()}
	</div>
{/snippet}

<!-- `lead — rest`, the shape every rule note in here uses. -->
{#snippet note(lead: string, hue: string, rest: string)}
	<div class="font-mono text-[0.55rem] leading-snug">
		<b style:color={hue}>{lead}</b>
		<span class="text-[var(--fg-dim)]">{rest}</span>
	</div>
{/snippet}

<div
	class="fixed inset-0 z-[75] grid place-items-center px-6 overflow-y-auto
	       bg-[color-mix(in_srgb,var(--bg,#05080d)_82%,transparent)] backdrop-blur-sm"
	role="presentation"
	onclick={onclose}
>
	<Panel padding="dense" class="w-[min(92vw,50rem)] my-8 pointer-events-auto">
		<div class="flex flex-col gap-3">
			<div class="flex items-center gap-2">
				<span class="font-mono text-[0.9rem] font-bold tracking-[0.16em]">HOW BREACH WORKS</span>
				<span class="flex-1"></span>
				<span class="font-mono text-[0.56rem] text-[var(--fg-dim)]">click anywhere to close</span>
			</div>

			<div class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
				{#snippet numbers()}
					<dl class="flex flex-col gap-1 m-0">
						{#each NUMBERS as [key, text] (key)}
							<div class="flex flex-col border-b border-[var(--border)] pb-1">
								<dt
									class="font-mono text-[0.56rem] font-bold tracking-wide"
									style:color="var(--accent)"
								>
									{key}
								</dt>
								<dd class="m-0 font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
									{text}
								</dd>
							</div>
						{/each}
					</dl>
				{/snippet}
				{@render section('the four numbers', numbers)}

				<div class="flex flex-col gap-2">
					{#snippet ground()}
						<div class="flex flex-col gap-1">
							{#each GROUND as [name, hue, text] (name)}
								{@render note(name, hue, ` — ${text}`)}
							{/each}
							<div class="font-mono text-[0.52rem] leading-snug text-[var(--fg-dim)]">
								You cannot play a card on your own ground. Everything else is fair.
							</div>
						</div>
					{/snippet}
					{@render section('whose ground', ground)}

					{#snippet attack()}
						<div
							class="rounded border border-[var(--border)] px-3 py-2 bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]"
						>
							<div class="font-mono text-[0.72rem] font-bold">
								2d6 + <span style:color={seat.color}>skill</span> +
								<span style:color="#F472B6">card</span> +
								<span style:color="#F472B6">resource</span>
								vs <span style:color="#38BDF8">hardening</span> or the card's DC
							</div>
							<div class="mt-1 font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
								<b class="text-[var(--fg)]">Every card rolls.</b> An attack is measured against the
								building; a control against its own difficulty. The number printed on the card is
								what a CLEAN roll gets you — everything else is measured against that, so one table
								covers the whole game.
							</div>
							<dl class="mt-2 flex flex-col gap-0.5 m-0">
								{#each BANDS as [outcome, band, what] (outcome)}
									<div class="flex items-baseline gap-2">
										<dt
											class="w-[52px] shrink-0 font-mono text-[0.5rem] font-bold tracking-[0.1em] uppercase"
											style:color={OUTCOME_COLOR[outcome]}
										>
											{outcome}
										</dt>
										<dd class="m-0 font-mono text-[0.5rem] tabular-nums text-[var(--fg)] w-[68px]">
											{band}
										</dd>
										<dd class="m-0 font-mono text-[0.5rem] text-[var(--fg-dim)]">{what}</dd>
									</div>
								{/each}
							</dl>
						</div>
					{/snippet}
					{@render section('an attack', attack)}

					{#snippet chain()}
						<div class="flex flex-col gap-1">
							{#each CHAIN_NOTES as [lead, hue, rest] (lead)}
								{@render note(lead, hue, ` ${rest}`)}
							{/each}
							<div class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
								Blue clears them by reading the code — <b class="text-[var(--fg)]">Diff the Tarball</b>
								and <b class="text-[var(--fg)]">Provenance Attestation</b> pull everything at a site
								on a clean roll, <b class="text-[var(--fg)]">Sweep</b> pulls one on a pass.
							</div>
						</div>
					{/snippet}
					{@render section('the chain, and cleaning it out', chain)}

					{#snippet cards()}
						<div class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
							Cost sits top-left, power bottom-left, noise bottom-right. Click a card to read what
							it does. <b class="text-[var(--fg)]">Drag it onto a building</b> to play it there — the
							legal sites light up while the card is in the air.
						</div>
					{/snippet}
					{@render section('the cards', cards)}

					{#snippet winning()}
						<div class="flex flex-col gap-1">
							{#each WINNING as [side, hue, text] (side)}
								{@render note(side, hue, ` ${text}`)}
							{/each}
						</div>
					{/snippet}
					{@render section('winning', winning)}
				</div>

				{#snippet lies()}
					<div class="flex flex-col gap-1">
						<div class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
							Some printed sentences promise rules the engine never grew. Do not plan a turn
							around one.
						</div>
						<dl class="m-0 grid gap-x-6 gap-y-1 sm:grid-cols-2">
							{#each LIES as [name, text] (name)}
								<div class="border-b border-[var(--border)] pb-1">
									<dt class="font-mono text-[0.55rem] font-bold tracking-wide text-[#FBBF24]">
										{name}
									</dt>
									<dd class="m-0 font-mono text-[0.53rem] leading-snug text-[var(--fg-dim)]">
										{text}
									</dd>
								</div>
							{/each}
						</dl>
					</div>
				{/snippet}
				{@render section('where the print lies', lies)}
			</div>
		</div>
	</Panel>
</div>
