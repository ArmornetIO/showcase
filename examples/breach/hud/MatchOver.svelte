<script lang="ts">
	// ── The end of the match ─────────────────────────────────────────────────────
	// A match that ends is the only moment in BREACH where the board has nothing
	// left to decide, and it was being reported in two 0.8rem lines at opposite
	// corners of the screen — one in the seat plate, one in the objective rail —
	// which is how they ended up contradicting each other for a whole release
	// (see `outcome.ts`). Two captions is also the wrong shape for the thing: the
	// player's next decision is "again?", and neither corner was asking it.
	//
	// So it is a screen (GameOver.svelte), and what this mode puts in it is the
	// fog opened — the match is decided, so the gap between what red held and
	// what blue could PROVE is finally safe to draw, and it is the most
	// interesting number of the match. The plate and the rail keep the record
	// once it is closed, in the same words.
	import { CHAIN, klassByKey } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';
	import { outcomeOf, FACTION_TONE } from './outcome.js';
	import CrestVerdict from './CrestVerdict.svelte';
	import GameOver from './GameOver.svelte';
	import { gemEdge, gemFill } from './hud-state.js';

	interface Props {
		match: BreachMatch;
		/** Dismiss. Owned by the page — a new match arriving has to be able to
		 *  re-open this without the screen holding an opinion about it. */
		onclose: () => void;
		/** The page's reset, not `match.newMatch()` directly: on a networked table
		 *  the click and the reset are different events, and only the page knows
		 *  which one it is wiring. */
		onagain: () => void;
	}

	let { match, onclose, onagain }: Props = $props();

	const over = $derived(outcomeOf(match));

	/** Which links red finished standing on. Read off `chainHeld` — the truth —
	 *  rather than off this seat's fogged view. */
	const heldIds = $derived(new Set(match.chainHeld.map((s) => s.id)));
	/** What BLUE had evidence for — a revealed foothold — rather than what this
	 *  seat could see. Same reason as `Outcome.proven`. */
	const provenIds = $derived(
		new Set(match.footholds.filter((f) => f.revealed).map((f) => f.structure_id))
	);

	/** The side that won, named the way the rulebook names its win condition. */
	const claim = $derived(
		over?.winner === 'red' ? 'red completed the payload path' : 'blue ran out the horizon'
	);
</script>

<!-- Escape is not handled here. The page owns one ladder for every overlay, so a
     second listener would close this AND whatever is behind it on one press. -->
{#if over}
	<!-- z-80, above the rules overlay (z-75): if both are somehow up, the one that
	     ended the match is the one being answered. -->
	<GameOver
		eyebrow="match over"
		{claim}
		tone={over.tone}
		winTone={over.winTone}
		verdict={over.verdict}
		event={over.event}
		sentence={over.sentence}
		again={{ label: 'new match', run: onagain }}
		{onclose}
		closeLabel="look at the board"
	>
		<!-- The shield the match opened on. It is BLUE's estate, so which of the
		     two pictures you get is decided by the winner and never by the reader —
		     a red player who took the payload is looking at a broken shield and
		     reading "you take it", which is the correct pair of facts. -->
		{#snippet art()}
			<CrestVerdict
				state={over.winner === 'blue' ? 'held' : 'breached'}
				tone={over.tone}
				size={104}
				class="shrink-0"
			/>
		{/snippet}

		<!-- ── The path, unfogged ────────────────────────────────────────────────
		     Every link, whether red ended on it, and whether blue ever had the
		     evidence. A link red held and blue could not prove is the one the
		     blue player will want to argue about, and it is the single thing
		     this screen can show that no surface during the match may. -->
		<div class="flex flex-col gap-1.5">
			<span class="font-mono text-[0.5rem] tracking-[0.18em] text-[var(--fg-dim)] uppercase">
				/ the payload path
			</span>
			{#each CHAIN as rung (rung.id)}
				{@const held = heldIds.has(rung.id)}
				{@const proven = provenIds.has(rung.id)}
				<div class="flex items-center gap-2">
					<!-- Red's hue whoever won: a held link is ground RED is standing
					     on, and colouring it by the winner told a blue victory that
					     the links it failed to defend were somehow blue's. -->
					<span
						class="h-1.5 w-6 shrink-0 rounded-full"
						style:background={held ? FACTION_TONE.red : 'transparent'}
						style:box-shadow="inset 0 0 0 1px {held ? FACTION_TONE.red : 'var(--border)'}"
					></span>
					<b
						class="min-w-0 truncate font-mono text-[0.66rem] font-bold"
						style:color={held ? 'var(--fg)' : 'var(--fg-muted)'}
					>
						{rung.name}
					</b>
					<span class="flex-1"></span>
					<span class="font-mono text-[0.56rem] tracking-[0.12em] uppercase"
						style:color={held ? (proven ? '#FBBF24' : '#FB7185') : 'var(--fg-dim)'}
					>
						{held ? (proven ? 'held · seen' : 'held · unseen') : 'never taken'}
					</span>
				</div>
			{/each}
		</div>

		<!-- Three numbers, and only three: how long it ran, how far the path got,
		     and how much of that blue ever had on paper. -->
		<div class="flex flex-wrap items-center gap-2">
			{#snippet stat(label: string, value: string, hue: string)}
				<span
					class="flex items-center gap-1.5 rounded-full border-2 px-2 py-[3px]"
					style:border-color={gemEdge(hue)}
					style:background={gemFill(hue)}
				>
					<span
						class="font-mono text-[0.5rem] leading-none font-black tracking-[0.14em] text-[var(--fg-muted)] uppercase"
					>
						{label}
					</span>
					<b class="font-mono text-[0.82rem] leading-none font-black tabular-nums" style:color={hue}>
						{value}
					</b>
				</span>
			{/snippet}
			{@render stat('rounds', `${Math.min(over.round, over.horizon)}/${over.horizon}`, '#FBBF24')}
			{@render stat('links taken', `${over.held}/${over.total}`, FACTION_TONE.red)}
			{@render stat('blue could prove', `${over.proven}/${over.total}`, FACTION_TONE.blue)}
		</div>

		<!-- ── Every seat's score ────────────────────────────────────────────────
		     Straight off the rules' results, the same rows the leaderboard sums,
		     so a player never sees one number here and another there. A seat
		     that ended with a bot still shows — it just earns nobody a record. -->
		{#if match.results.length}
			<div class="flex flex-col gap-1.5">
				<span class="font-mono text-[0.5rem] tracking-[0.18em] text-[var(--fg-dim)] uppercase">
					/ the table
				</span>
				<div
					class="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-1 font-mono text-[0.62rem]"
				>
					<span></span>
					<span class="text-[0.5rem] tracking-[0.12em] text-[var(--fg-dim)] uppercase">result</span>
					<span class="text-right text-[0.5rem] tracking-[0.12em] text-[var(--fg-dim)] uppercase">
						buildings
					</span>
					<span class="text-right text-[0.5rem] tracking-[0.12em] text-[var(--fg-dim)] uppercase">
						rounds
					</span>
					{#each match.results as r (r.seat_key)}
						{@const k = klassByKey(r.seat_key)}
						{@const seated = match.players[r.seat_key]}
						<span class="flex min-w-0 items-center gap-2">
							<span
								class="h-1.5 w-1.5 shrink-0 rounded-full"
								style:background={FACTION_TONE[r.faction]}
							></span>
							<b class="truncate" style:color={r.seat_key === match.seatKey ? 'var(--fg)' : 'var(--fg-muted)'}>
								{seated?.name ?? k.name}
							</b>
							<span class="truncate text-[var(--fg-dim)]">
								{k.name}{seated?.kind === 'ai' ? ' · bot' : ''}
							</span>
						</span>
						<span
							class="font-black tracking-[0.1em] uppercase"
							style:color={r.won ? FACTION_TONE[r.faction] : 'var(--fg-dim)'}
						>
							{r.won ? 'won' : 'lost'}
						</span>
						<b class="text-right tabular-nums">{r.buildings_held}</b>
						<b class="text-right tabular-nums">{r.rounds}</b>
					{/each}
				</div>
			</div>
		{/if}
	</GameOver>
{/if}
