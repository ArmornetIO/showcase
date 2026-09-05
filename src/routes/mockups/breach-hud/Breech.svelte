<script lang="ts">
	// ── THE BREECH ───────────────────────────────────────────────────────────────
	// One sentence and the key that fires it.
	//
	// It was three zones on a fixed grid — a solid AP block, a two-row middle, a
	// commit column — which is a lot of structure for what is, read aloud, a
	// single line: "Living off the Land, at the Maintainer Circle, 72%." The
	// dividers were doing the work that word order already does, and splitting a
	// sentence into panels is what made an 1100px strip feel empty in the middle
	// and cramped at both ends.
	//
	// So: one row, big type, left to right, no internal walls. Everything that is
	// not the sentence is either small and trailing (what it costs, what you have
	// left) or not text at all — the distribution is a hairline along the bottom
	// EDGE of the plate rather than a chart in a row of its own.
	//
	// The one rule kept from the old bar: FIXED HEIGHT, always mounted. A strip
	// that grows a line pushes the board around mid-turn.
	import { Icon, IconToolbar, type IconName } from 'showcase';
	import { OUTCOME_COLOR } from '$examples/breach/internal/rules.js';
	import { fxFor } from '$examples/breach/internal/fx.js';
	import type { BreachMatch } from '$examples/breach/internal/match.svelte.js';
	import type { TableSocket } from '$examples/breach/net.svelte.js';
	import { KIND_COLOR, ON_ACCENT, plateFill, type HudState } from './hud-state.js';
	import { noticeFor } from './notice.js';
	import TurnTakeover from './TurnTakeover.svelte';

	interface Props {
		match: BreachMatch;
		state: HudState;
		/** True for the 900ms after the turn passes to you. Owned by the page so
		 *  the vignette and this plate cannot disagree about when the moment is. */
		takeover?: boolean;
		/** Reported IN the bar, not above it — see `notice.ts`. */
		socket?: TableSocket | null;
		refusal?: string | null;
		/** Opens the rules overlay. The bar owns the button; the host owns what it does. */
		onrules?: () => void;
		class?: string;
	}

	let {
		match,
		state,
		takeover = false,
		socket = null,
		refusal = null,
		onrules = () => {},
		class: cls = ''
	}: Props = $props();

	// The interruption, if there is one. It REPLACES the sentence rather than
	// sitting beside it: there is no case where "reconnecting" and the odds on a
	// card are both worth reading, because if the board may be stale then the odds
	// computed from it are the first thing to stop trusting.
	const notice = $derived(noticeFor(match, socket, refusal));

	// Armed beats inspected: a card you have picked up is one you are committing
	// to, and one you are merely reading is not.
	const card = $derived(match.armed ?? match.inspected);
	const fx = $derived(card ? fxFor(card.key, match.seat.faction) : null);
	const kindHue = $derived(card ? (KIND_COLOR[card.kind] ?? match.seat.color) : 'var(--fg-muted)');
	const ap = $derived(match.ap[match.seat.key] ?? 0);

	// What the key says and whether it does anything. One derivation rather than
	// five `{#if}`s in the markup, because every branch has to agree about
	// `disabled` and a label that lies about it is worse than no key.
	const key = $derived.by(() => {
		if (match.winner) return { label: 'match over', live: false, blocked: false };
		if (match.busy || match.pending) return { label: 'resolving', live: false, blocked: false };
		if (!match.isMyTurn) return { label: 'waiting', live: false, blocked: false };
		if (match.blockReason?.kind === 'hard') return { label: 'blocked', live: false, blocked: true };
		if (match.ready) return { label: 'commit', live: true, blocked: false };
		if (!match.armed) return { label: 'arm', live: false, blocked: false };
		return { label: 'commit', live: false, blocked: false };
	});
</script>

<!-- ── Content only ───────────────────────────────────────────────────────────
     This drew its own chamfered plate with its own rim and shadow. It does not
     any more: it is the lower half of ONE card, and `BattleCentre` owns the
     frame. Two plates with a gap between them is two objects, and the seat you
     are playing and the move you are making are not two things.

     `relative` IS wanted here, unlike the old outer wrapper — the takeover plate
     positions against this row. -->
<div
	class="pointer-events-auto relative flex items-center gap-3 overflow-hidden px-6 {cls}"
	aria-live="polite"
>
		<!-- ── AP, always, on the left ────────────────────────────────────────
		     It used to appear as `−2 AP · 1 LEFT` at the far END of the bar, and
		     only once you had armed something — so the answer to "what can I
		     afford" was missing at exactly the moment you were deciding what to
		     pick up. It is a standing quantity with a ceiling, so it reads as
		     `2 / 3`, in the same place, every turn, whether or not anything is
		     armed. The cost of what you are holding rides it as a delta. -->
		<span class="flex shrink-0 items-baseline gap-1 leading-none">
			<b
				class="font-mono text-[1.75rem] leading-none font-black tabular-nums"
				style:color={ap > 0 ? 'var(--fg)' : OUTCOME_COLOR.botch}
				style:letter-spacing="-0.03em"
			>
				{ap}
			</b>
			<span
				class="font-mono text-[0.9rem] leading-none font-bold tabular-nums text-[var(--fg-muted)]"
			>
				/{match.maxAp()}
			</span>
			<span
				class="ml-0.5 font-mono text-[0.5rem] leading-none tracking-[0.22em] text-[var(--fg-dim)] uppercase"
			>
				ap
			</span>
			{#if match.armed}
				<b
					class="ml-1 font-mono text-[0.75rem] leading-none font-black tabular-nums"
					style:color={match.canPay ? state.color : OUTCOME_COLOR.botch}
				>
					−{match.armed.ap}
				</b>
			{/if}
		</span>

		<span class="h-7 w-px shrink-0 bg-[var(--border-strong)]"></span>

		{#if notice}
			<span class="shrink-0" style:color={notice.tone}>
				<Icon name={notice.kind === 'over' ? 'flag' : 'alert-triangle'} size={22} />
			</span>
			<!-- The headline never truncates; the detail does. They were both
			     `min-w-0 truncate`, which let flexbox eat the one word that carries
			     the meaning — `RECONNECTI…` — to protect a subtitle. -->
			<b
				class="shrink-0 font-mono text-[1.05rem] leading-none font-black tracking-[0.02em] uppercase"
				style:color={notice.tone}
			>
				{notice.text}
			</b>
			{#if notice.detail}
				<span class="min-w-0 truncate font-mono text-[0.68rem] text-[var(--fg-muted)]">
					{notice.detail}
				</span>
			{/if}
		{:else if card && fx}
			<!-- The sentence. Icon, card, target, odds — in the order you would say
			     it, with nothing between them but a space. -->
			<span class="shrink-0" style:color={fx.hue}>
				<Icon name={fx.icon as IconName} size={22} />
			</span>
			<b class="shrink-0 font-mono text-[1.05rem] leading-none font-black uppercase">
				{card.name}
			</b>
			{#if match.target}
				<span class="shrink-0 font-mono text-[1rem] text-[var(--fg-muted)]">→</span>
				<b
					class="min-w-0 truncate font-mono text-[1.05rem] leading-none font-bold uppercase"
					style:color="var(--fg-muted)"
				>
					{match.target.name}
				</b>
			{/if}

			<!-- ── No odds ──────────────────────────────────────────────────────
			     There was a `72% CHANCE IT WORKS` here, and a four-segment
			     distribution along the bottom edge under it. Both are gone.

			     A published hit probability is a specific and unusual design choice
			     — XCOM does it and it is divisive there — and taking it turns every
			     play into a arithmetic problem you can be WRONG at, which is not
			     what this game is about. The card says what it does, the building
			     shows what it is, and the dice decide. That is the whole loop, and
			     a percentage sitting in front of it only invites the player to
			     resent the roll afterwards. -->
			{#if match.blockReason}
				<span class="min-w-0 truncate font-mono text-[0.68rem] font-bold" style:color={state.color}>
					· {match.blockReason.text}
				</span>
			{/if}
		{:else if !match.isMyTurn}
			<span class="shrink-0" style:color={match.activeKlass.color}>
				<Icon name={match.activeKlass.icon as IconName} size={22} />
			</span>
			<b
				class="min-w-0 truncate font-mono text-[1.05rem] leading-none font-black uppercase"
				style:color={match.activeKlass.color}
			>
				{match.players[match.activeKlass.key]?.name ?? match.activeKlass.name} is acting
			</b>
		{:else}
			<span class="shrink-0" style:color={match.seat.color}>
				<Icon name={match.seat.icon as IconName} size={22} />
			</span>
			<b
				class="shrink-0 font-mono text-[1.05rem] leading-none font-black tracking-[0.06em] uppercase"
				style:color={match.seat.color}
			>
				your turn
			</b>
			<span class="min-w-0 truncate font-mono text-[0.68rem] text-[var(--fg-muted)]">
				{ap > 0 ? 'pick a card · drop it on the world' : 'nothing left to spend'}
			</span>
		{/if}

	<span class="flex-1"></span>

		<!-- Rules, in the bar rather than floating in a corner: it is the one thing
		     on this screen you OPEN rather than read, and this strip is already
		     where every control lives.

		     Watch used to sit beside it. It handed your seat to the autoplayer —
		     a demo affordance parked in the permanent furniture of a match, one
		     misclick from playing the game for you. -->
		<span class="hud-toolbar contents">
			<IconToolbar
				orientation="horizontal"
				items={[{ icon: 'info', label: 'rules', onclick: onrules }]}
				class="shrink-0"
			/>
		</span>

		{#if match.isMyTurn && !match.busy && !match.pending && !match.winner}
			<button
				type="button"
				class="shrink-0 rounded-full border-2 px-3 py-1.5 font-mono text-[0.5rem] font-black tracking-[0.12em] uppercase
				       transition-colors hover:text-[var(--fg)]"
				style:color="var(--fg-muted)"
				style:border-color="color-mix(in srgb, var(--fg) 22%, transparent)"
				onclick={() => match.endTurn()}
			>
				end
			</button>
		{/if}

		<!-- The one saturated mass on the screen, and it is a KEY — the thing you
		     press. Everything else that was filled like this is now tinted like the
		     rails, which is what makes this one read as the only button here. -->
		<button
			type="button"
			class="relative grid h-[40px] w-[116px] shrink-0 place-items-center rounded-[10px] font-mono text-[0.62rem] font-black
			       tracking-[0.18em] uppercase disabled:cursor-default"
			style:color={key.live ? ON_ACCENT : key.blocked ? '#FB7185' : 'var(--fg-muted)'}
			style:background={key.live
				? `linear-gradient(180deg, color-mix(in srgb, ${state.color} 100%, white 18%) 0%, ${state.color} 55%, color-mix(in srgb, ${state.color} 82%, black) 100%)`
				: key.blocked
					? 'repeating-linear-gradient(45deg, transparent 0 5px, color-mix(in srgb, #FB7185 18%, transparent) 5px 10px)'
					: 'color-mix(in srgb, var(--fg) 6%, transparent)'}
			style:box-shadow={key.live
				? `0 0 26px color-mix(in srgb, ${state.color} 60%, transparent)`
				: 'none'}
			style:transition="background 160ms ease, color 160ms ease, box-shadow 160ms ease"
			disabled={!key.live}
			onclick={() => match.resolve()}
			title={card?.text}
		>
			{key.label}
		</button>

		{#if takeover}
			<TurnTakeover
				color={match.seat.color}
				round={match.round}
				seconds={Math.ceil(match.turnLeft / 1000)}
				backing={plateFill(state.color)}
			/>
		{/if}
</div>

<style>
	/* The toolbar's own `--bg-elev` fill and border are a panel, and this bar is
	   already one — a box inside a box. Stripped here rather than in the library:
	   the chrome is right for a rail floating on its own, wrong for a rail sitting
	   inside a plate, and only the caller knows which it is. */
	.hud-toolbar :global(.icon-toolbar) {
		background: transparent;
		border-color: transparent;
		padding-inline: 0;
		height: auto;
	}
</style>
