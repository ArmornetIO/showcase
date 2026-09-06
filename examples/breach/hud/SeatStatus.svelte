<script lang="ts">
	// ── WHAT IS HAPPENING, IN A SENTENCE ─────────────────────────────────────────
	// Everything the play row used to say, in the space to the right of the seat
	// card's divider: whose turn it is, what you are holding and where you are
	// pointing it, why the engine will refuse it, whether the table dropped, and
	// how the match ended.
	//
	// It had a strip of its own along the floor of the screen. The strip is gone —
	// the AP it also carried lives on your chip now — but this text is the one
	// thing down there that was never a restatement, so it moved rather than died.
	// It reads left to right in the order you would say it: icon, card, target.
	//
	// This is also the only surface on the card that CHANGES with the moment. The
	// half to the left of the divider is who you are, which is fixed for the whole
	// match; putting the moving half opposite it is what makes the divider mean
	// something.
	import { Icon, type IconName } from 'showcase';
	import { fxFor } from '../internal/fx.js';
	import type { BreachMatch } from '../internal/match.svelte.js';
	import type { TableSocket } from '../net.svelte.js';
	import { noticeFor } from './notice.js';
	import { plateFill, type HudState } from './hud-state.js';
	import TurnTakeover from './TurnTakeover.svelte';

	interface Props {
		match: BreachMatch;
		state: HudState;
		/** True for the 900ms after the turn passes to you. Owned by the page so the
		 *  vignette and this plate cannot disagree about when the moment is. */
		takeover?: boolean;
		socket?: TableSocket | null;
		refusal?: string | null;
		/** The card is showing nothing but this. Sets the type up a step and gives
		 *  the line real air — at header size the same words read as a caption of
		 *  the controls beside them, which is exactly what they are not. */
		big?: boolean;
		class?: string;
	}

	let {
		match,
		state,
		takeover = false,
		socket = null,
		refusal = null,
		big = false,
		class: cls = ''
	}: Props = $props();

	const head = $derived(big ? 'text-[1.35rem]' : 'text-[0.95rem]');
	const sub = $derived(big ? 'text-[0.8rem]' : 'text-[0.62rem]');
	const glyph = $derived(big ? 28 : 20);

	// The interruption, if there is one. It REPLACES the sentence rather than
	// sitting beside it: there is no case where "reconnecting" and what you are
	// aiming are both worth reading, because if the board may be stale then the
	// target you picked off it is the first thing to stop trusting.
	const notice = $derived(noticeFor(match, socket, refusal));

	// Armed beats inspected: a card you have picked up is one you are committing
	// to, and one you are merely reading is not.
	const card = $derived(match.armed ?? match.inspected);
	const fx = $derived(card ? fxFor(card.key, match.seat.faction) : null);
</script>

<!-- `relative` and `overflow-hidden` are load-bearing: the takeover plate covers
     exactly this element. In `big` it IS the card's content — the loadout is not
     mounted while a moment is running — so the ceremony gets the whole plate
     without ever being drawn over a control it would have to hide. -->
<div class="relative flex min-w-0 items-center gap-2 overflow-hidden {cls}" aria-live="polite">
	{#if notice}
		<span class="shrink-0" style:color={notice.tone}>
			<Icon name={notice.kind === 'over' ? 'flag' : 'alert-triangle'} size={glyph} />
		</span>
		<!-- The headline never truncates; the detail does. Both were `min-w-0
		     truncate`, which let flexbox eat the one word carrying the meaning —
		     `RECONNECTI…` — to protect a subtitle. -->
		<b
			class="shrink-0 font-mono {head} leading-none font-black tracking-[0.02em] uppercase"
			style:color={notice.tone}
		>
			{notice.text}
		</b>
		{#if notice.detail}
			<span class="min-w-0 truncate font-mono {sub} text-[var(--fg-muted)]">
				{notice.detail}
			</span>
		{/if}
	{:else if card && fx}
		<span class="shrink-0" style:color={fx.hue}>
			<Icon name={fx.icon as IconName} size={glyph} />
		</span>
		<b class="shrink-0 font-mono {head} leading-none font-black uppercase">
			{card.name}
		</b>
		{#if match.target}
			<span class="shrink-0 font-mono text-[0.9rem] text-[var(--fg-muted)]">→</span>
			<b
				class="min-w-0 truncate font-mono {head} leading-none font-bold text-[var(--fg-muted)] uppercase"
			>
				{match.target.name}
			</b>
		{/if}
		<!-- No published odds. The card says what it does, the building shows what
		     it is, and the dice decide; a percentage in front of that only invites
		     the player to resent the roll afterwards. -->
		{#if match.blockReason}
			<span class="min-w-0 truncate font-mono text-[0.62rem] font-bold" style:color={state.color}>
				· {match.blockReason.text}
			</span>
		{/if}
	{:else if !match.isMyTurn}
		<span class="shrink-0" style:color={match.activeKlass.color}>
			<Icon name={match.activeKlass.icon as IconName} size={glyph} />
		</span>
		<b
			class="min-w-0 truncate font-mono {head} leading-none font-black uppercase"
			style:color={match.activeKlass.color}
		>
			{match.players[match.activeKlass.key]?.name ?? match.activeKlass.name} is acting
		</b>
	{:else}
		<span class="shrink-0" style:color={match.seat.color}>
			<Icon name={match.seat.icon as IconName} size={glyph} />
		</span>
		<b
			class="shrink-0 font-mono {head} leading-none font-black tracking-[0.06em] uppercase"
			style:color={match.seat.color}
		>
			your turn
		</b>
		<span class="min-w-0 truncate font-mono {sub} text-[var(--fg-muted)]">
			{(match.ap[match.seat.key] ?? 0) > 0
				? 'pick a card · drop it on the world'
				: 'nothing left to spend'}
		</span>
	{/if}

	{#if takeover}
		<TurnTakeover
			color={match.seat.color}
			round={match.round}
			seconds={Math.ceil(match.turnLeft / 1000)}
			backing={plateFill(state.color)}
		/>
	{/if}
</div>
