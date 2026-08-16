<script lang="ts">
	// ── Card — one ability as a playing card ─────────────────────────────────────
	// The face carries NO rules text. A hand of paragraphs cannot be read at a
	// glance however well the paragraphs are written, and a fanned card only ever
	// shows its top corner and its name anyway. So the face is the three things a
	// player compares cards on — cost, power, noise — plus a glyph they learn to
	// recognise. The sentence lives in the detail panel, one click away.
	//
	//   top-left     COST, the gem you check first, in the corner that survives fanning
	//   art          the glyph, big, in the card's own hue
	//   name         the line you say out loud
	//   bottom-left  POWER — roll bonus for anything that rolls, effect size otherwise
	//   bottom-right NOISE — what playing it costs you in being seen
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/index.js';
	import type { Ability } from './game.js';
	import type { CardFx } from './fx.js';

	interface Props {
		ability: Ability;
		fx: CardFx;
		/** Cost-gem colour — the seat's own hue, so a hand reads as one player's. */
		seatColor: string;
		affordable: boolean;
		disabled: boolean;
		armed: boolean;
		/** Lifted out of the fan: hovered, armed, or in flight. */
		raised: boolean;
		/** Rendered as the thing under the cursor rather than a card in the fan. */
		ghost?: boolean;
		icon: IconName;
		/** The seat's rating in the skill this card rolls on. */
		skillMod: number;
	}

	let {
		ability,
		fx,
		seatColor,
		affordable,
		disabled,
		armed,
		raised,
		ghost = false,
		icon,
		skillMod
	}: Props = $props();

	const NOISE_HUE = '#FBBF24';
	const QUIET_HUE = '#34D399';
</script>

<div
	class="relative flex flex-col items-center w-[136px] h-[188px] rounded-[12px] border overflow-hidden select-none"
	class:opacity-40={!affordable || disabled}
	style:border-color={armed || ghost
		? `color-mix(in srgb, ${fx.hue} 78%, transparent)`
		: 'var(--border)'}
	style:background="radial-gradient(120% 80% at 50% 18%,
	         color-mix(in srgb, {fx.hue} 26%, var(--bg-elev, #0b0f16)) 0%,
	         var(--bg-elev, #0b0f16) 62%)"
	style:box-shadow={raised || ghost
		? `0 0 0 1px color-mix(in srgb, ${fx.hue} 40%, transparent), 0 16px 34px rgba(0,0,0,0.5)`
		: '0 6px 16px rgba(0,0,0,0.4)'}
>
	<!-- Kind, as a band across the top rather than a chip. It is the card's
	     category and it wants to be scannable down a fanned hand, not read. -->
	<div
		class="w-full flex items-center justify-center gap-1 py-[3px] pl-6 font-mono text-[0.44rem] font-bold tracking-[0.2em] uppercase"
		style:color={fx.hue}
		style:background="color-mix(in srgb, {fx.hue} 16%, transparent)"
	>
		{ability.kind}
		<!-- The one thing a player must know before choosing: does this LEAVE
		     something on the board, or does it just happen? -->
		{#if fx.leaves !== 'nothing'}
			<span
				class="px-[3px] rounded-[2px] tracking-[0.1em]"
				style:color="var(--bg-elev, #0b0f16)"
				style:background={fx.hue}
				title={fx.leaves === 'implant'
					? 'stays on the board, hidden, until a review pulls it out'
					: 'stays on the board as posted defenders'}>{fx.leaves === 'implant' ? 'stays' : 'posts'}</span
			>
		{/if}
	</div>

	<!-- COST, in the true top-left corner — the one part of a card that is never
	     covered by the card fanned in front of it. -->
	<span
		class="absolute top-[3px] left-[3px] grid place-items-center w-[22px] h-[22px] rounded-full border font-mono text-[0.66rem] font-bold tabular-nums"
		style:color={seatColor}
		style:border-color="color-mix(in srgb, {seatColor} 60%, transparent)"
		style:background="color-mix(in srgb, {seatColor} 26%, var(--bg-elev, #0b0f16))"
		title="action points">{ability.ap}</span
	>

	<!-- Art -->
	<div class="relative grid place-items-center flex-1 w-full">
		<span
			class="absolute w-[74px] h-[74px] rounded-full blur-[14px] opacity-45"
			style:background={fx.hue}
		></span>
		<span
			class="relative grid place-items-center w-[54px] h-[54px] rounded-full border-2"
			style:color={fx.hue}
			style:border-color="color-mix(in srgb, {fx.hue} 55%, transparent)"
			style:background="color-mix(in srgb, {fx.hue} 14%, var(--bg-elev, #0b0f16))"
		>
			<Icon name={icon} size={26} />
		</span>
	</div>

	<!-- Name, on its own plate so it reads over the art glow. -->
	<div
		class="w-full px-1.5 py-1 text-center border-y border-[var(--border)]
		       bg-[color-mix(in_srgb,black_35%,transparent)]"
	>
		<span class="font-mono text-[0.56rem] font-bold leading-tight">{ability.name}</span>
		<!-- Which of YOUR skills carries this card, and what it is worth in your
		     hands. The single most useful thing on the face once a player knows
		     their own numbers — the same card is a different card in another seat. -->
		<div class="flex items-center justify-center gap-1 mt-0.5">
			<span class="font-mono text-[0.4rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]"
				>{ability.skill}</span
			>
			<span
				class="font-mono text-[0.46rem] font-bold tabular-nums"
				style:color={skillMod > 0 ? '#34D399' : skillMod < 0 ? '#FB7185' : 'var(--fg-dim)'}
				>{skillMod >= 0 ? '+' : ''}{skillMod}</span
			>
		</div>
	</div>

	<!-- The numbers. Same three corners on every card in the game. -->
	<div class="relative w-full h-[30px] shrink-0">
		<!-- POWER -->
		<span
			class="absolute bottom-1 left-1.5 flex items-baseline gap-[3px]"
			title={fx.powerLabel === 'ATK' ? 'added to the attack roll' : 'size of the effect'}
		>
			<span class="font-mono text-[0.86rem] font-bold leading-none tabular-nums" style:color={fx.hue}
				>{fx.power > 0 && fx.powerLabel !== 'RNDS' && fx.powerLabel !== 'RGN' ? '+' : ''}{fx.power}</span
			>
			<span class="font-mono text-[0.42rem] tracking-[0.1em] text-[var(--fg-dim)]"
				>{fx.powerLabel}</span
			>
		</span>
		<!-- NOISE -->
		<span class="absolute bottom-1 right-1.5 flex items-baseline gap-[3px]" title="heat generated">
			<span
				class="font-mono text-[0.86rem] font-bold leading-none tabular-nums"
				style:color={ability.noise ? NOISE_HUE : QUIET_HUE}>{ability.noise || 0}</span
			>
			<span class="font-mono text-[0.42rem] tracking-[0.1em] text-[var(--fg-dim)]"
				>{ability.noise ? 'HEAT' : 'QUIET'}</span
			>
		</span>
	</div>
</div>
