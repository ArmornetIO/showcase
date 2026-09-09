<script lang="ts">
	// ── The end of the match ─────────────────────────────────────────────────────
	// A match that ends is the only moment in BREACH where the board has nothing
	// left to decide, and it was being reported in two 0.8rem lines at opposite
	// corners of the screen — one in the seat plate, one in the objective rail —
	// which is how they ended up contradicting each other for a whole release
	// (see `outcome.ts`). Two captions is also the wrong shape for the thing: the
	// player's next decision is "again?", and neither corner was asking it.
	//
	// So it is a screen. It takes the viewport, it says which side won and by
	// which of the two victory conditions, it opens the fog — the match is
	// decided, so the gap between what red held and what blue could PROVE is
	// finally safe to draw, and it is the most interesting number of the match —
	// and it carries the only two things left to do.
	//
	// Dismissible on purpose. The final board is the trophy and a screen you
	// cannot get out from in front of is one you learn to close without reading;
	// the plate and the rail keep the record afterwards, in the same words.
	import { Icon } from 'showcase';
	import { CHAIN } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';
	import { outcomeOf, FACTION_TONE } from './outcome.js';
	import CrestVerdict from './CrestVerdict.svelte';
	import { plateFill, PLATE_SHADOW_UP, gemEdge, gemFill } from './hud-state.js';

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
	<!-- Above the rules overlay (z-75): if both are somehow up, the one that ended
	     the match is the one being answered. -->
	<div
		class="fixed inset-0 z-[80] grid place-items-center overflow-y-auto px-6 py-8
		       bg-[color-mix(in_srgb,var(--bg,#05080d)_78%,transparent)] backdrop-blur-md"
		role="presentation"
		onclick={onclose}
	>
		<!-- The card stops the click that would close the screen behind it. -->
		<div
			class="pointer-events-auto flex w-[min(94vw,40rem)] flex-col gap-4 rounded-xl border p-6"
			style:border-color="color-mix(in srgb, {over.tone} 42%, transparent)"
			style:background={plateFill(over.tone, 14)}
			style:box-shadow="{PLATE_SHADOW_UP}, 0 0 60px color-mix(in srgb, {over.tone} 22%, transparent)"
			role="presentation"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- WHO won, and by which condition. In the winner's hue rather than in
			     the verdict's: the side that won is a fact about the board, and only
			     the words under it are about the reader. -->
			<div class="flex items-center gap-2">
				<span
					class="rounded border px-1.5 py-0.5 font-mono text-[0.56rem] font-black tracking-[0.16em] uppercase"
					style:color={over.winTone}
					style:border-color={gemEdge(over.winTone)}
					style:background={gemFill(over.winTone)}
				>
					match over
				</span>
				<span class="font-mono text-[0.6rem] tracking-[0.14em] text-[var(--fg-dim)] uppercase">
					{claim}
				</span>
				<span class="flex-1"></span>
				<button
					type="button"
					class="grid h-6 w-6 place-items-center rounded-full text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
					onclick={onclose}
					aria-label="close"
				>
					<Icon name="x" size={14} />
				</button>
			</div>

			<!-- The verdict, and under it the event. The two are deliberately not the
			     same sentence: one is what happened to YOU, the other is what
			     happened, and a player who loses still deserves to be told which of
			     the two win conditions took the match. -->
			<div class="flex items-center gap-4">
				<!-- The shield the match opened on. It is BLUE's estate, so which of
				     the two pictures you get is decided by the winner and never by
				     the reader — a red player who took the payload is looking at a
				     broken shield and reading "you take it", which is the correct
				     pair of facts. -->
				<CrestVerdict
					state={over.winner === 'blue' ? 'held' : 'breached'}
					tone={over.tone}
					size={104}
					class="shrink-0"
				/>
				<span class="flex min-w-0 flex-col gap-1">
					<b
						class="font-mono text-[2rem] leading-none font-black tracking-[0.02em] uppercase"
						style:color={over.tone}
						style:text-shadow="0 0 38px color-mix(in srgb, {over.tone} 45%, transparent)"
					>
						{over.verdict}
					</b>
					<span class="font-mono text-[0.8rem] leading-snug text-[var(--fg)]">
						{over.event}
					</span>
				</span>
			</div>

			<p class="m-0 font-mono text-[0.68rem] leading-relaxed text-[var(--fg-dim)]">
				{over.sentence}
			</p>

			<div class="h-px w-full bg-[var(--border)]"></div>

			<!-- ── The path, unfogged ──────────────────────────────────────────────
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

			<div class="flex items-center gap-2 pt-1">
				<button
					type="button"
					onclick={onagain}
					class="rounded-lg border-2 px-4 py-2 font-mono text-[0.68rem] font-black tracking-[0.14em] uppercase transition-all"
					style:color={over.tone}
					style:border-color="color-mix(in srgb, {over.tone} 70%, transparent)"
					style:background="color-mix(in srgb, {over.tone} 18%, transparent)"
					style:box-shadow="0 0 22px color-mix(in srgb, {over.tone} 30%, transparent)"
				>
					new match
				</button>
				<button
					type="button"
					onclick={onclose}
					class="rounded-lg border px-4 py-2 font-mono text-[0.68rem] font-bold tracking-[0.14em] text-[var(--fg-muted)] uppercase transition-colors hover:text-[var(--fg)]"
					style:border-color="var(--border)"
				>
					look at the board
				</button>
				<span class="flex-1"></span>
				<span class="font-mono text-[0.52rem] tracking-[0.14em] text-[var(--fg-dim)] uppercase">
					esc to close
				</span>
			</div>
		</div>
	</div>
{/if}
