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
	import { Icon, type IconName } from 'showcase';
	import { SKILL_GLYPH } from './parts/skill-glyphs.js';
	import type { Ability } from './internal/rules.js';
	import type { CardFx } from './internal/fx.js';

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
	<!-- Kind, as a colour bar and a glyph — no word. The hue already says what
	     family this is, and a fanned hand is scanned, not read. `stays` survives
	     as a pip because "does this LEAVE something on the board" is the one
	     thing a player must know before choosing, and there is no colour for it. -->
	<div
		class="w-full flex items-center justify-center gap-1 py-[5px] pl-6"
		style:background="color-mix(in srgb, {fx.hue} 20%, transparent)"
	>
		{#if fx.leaves !== 'nothing'}
			<span
				class="grid place-items-center w-[13px] h-[13px] rounded-full"
				style:color="var(--bg-elev, #0b0f16)"
				style:background={fx.hue}
				title={fx.leaves === 'implant'
					? 'stays on the board, hidden, until a review pulls it out'
					: 'stays on the board as posted defenders'}
			>
				<Icon name={fx.leaves === 'implant' ? 'lock' : 'shield'} size={9} />
			</span>
		{/if}
	</div>

	<!-- COST, in the true top-left corner — the one part of a card that is never
	     covered by the card fanned in front of it. -->
	<span
		class="absolute top-[3px] left-[3px] grid place-items-center w-[26px] h-[26px] rounded-full border-2 font-mono text-[0.8rem] font-black tabular-nums z-10"
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

	<!-- Name, on its own plate so it reads over the art glow. Heavier and larger
	     than it was: it is the only word on the card now, so it can afford the
	     weight, and a hand of four names at 9px was unreadable at a glance. -->
	<div
		class="w-full px-1.5 py-1 text-center border-y border-[var(--border)] overflow-hidden
		       bg-[color-mix(in_srgb,black_45%,transparent)]"
	>
		<span
			class="block font-mono text-[0.58rem] font-black leading-[1.15] overflow-hidden"
			style:display="-webkit-box"
			style:-webkit-line-clamp="2"
			style:-webkit-box-orient="vertical"
			title={ability.name}>{ability.name}</span
		>
		<!-- Which of YOUR skills carries this card, as the glyph and the number.
		     The same card is a different card in another seat, and this is the
		     line that says so — without spelling out "opsec". -->
		<div class="flex items-center justify-center gap-1 mt-0.5">
			<span style:color={skillMod > 0 ? '#34D399' : skillMod < 0 ? '#FB7185' : 'var(--fg-dim)'}>
				<Icon name={SKILL_GLYPH[ability.skill]} size={10} />
			</span>
			<span
				class="font-mono text-[0.58rem] font-black tabular-nums"
				style:color={skillMod > 0 ? '#34D399' : skillMod < 0 ? '#FB7185' : 'var(--fg-dim)'}
				>{skillMod >= 0 ? '+' : ''}{skillMod}</span
			>
		</div>
	</div>

	<!-- The two numbers, in the two bottom corners, on every card in the game.
	     Hearthstone-sized on purpose: attack bottom-left, cost of being seen
	     bottom-right, both readable from across a table. The labels are gone —
	     a player learns two corners in one hand, and the tooltip still has the
	     words for the first time they wonder. -->
	<div class="relative w-full h-[34px] shrink-0">
		<span
			class="absolute bottom-0.5 left-1 grid place-items-center w-[26px] h-[26px] rounded-full"
			style:color="var(--bg-elev, #0b0f16)"
			style:background={fx.hue}
			style:box-shadow="0 0 10px color-mix(in srgb, {fx.hue} 55%, transparent)"
			title="{fx.powerLabel === 'ATK' ? 'added to the attack roll' : 'size of the effect'} · {fx.powerLabel}"
		>
			<b class="font-mono text-[0.9rem] font-black leading-none tabular-nums">
				{fx.power}
			</b>
		</span>

		<span
			class="absolute bottom-0.5 right-1 grid place-items-center w-[26px] h-[26px] rounded-full border-2"
			style:color={ability.noise ? NOISE_HUE : QUIET_HUE}
			style:border-color="color-mix(in srgb, {ability.noise ? NOISE_HUE : QUIET_HUE} 65%, transparent)"
			style:background="var(--bg-elev, #0b0f16)"
			title={ability.noise ? `makes ${ability.noise} heat` : 'makes no heat — quiet'}
		>
			<b class="font-mono text-[0.9rem] font-black leading-none tabular-nums">
				{ability.noise || 0}
			</b>
		</span>
	</div>
</div>
