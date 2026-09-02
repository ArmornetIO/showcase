<script lang="ts">
	// ── The dais ─────────────────────────────────────────────────────────────────
	// Everything you used to read in the top-left corner, as objects you look at
	// instead of sentences you parse. There is no prose on this component at all —
	// a glyph, a number, and a tooltip for the one time somebody wants the words.
	//
	//   above     the upgrade track. Three slots, unlocking at rounds 3/6/9. A
	//             locked slot shows the round it lands on, so the curve is legible
	//             from turn one without a tutorial.
	//   rings     turn clock outside, standing inside. Yours, so they are on you.
	//   plate     the character. Lights on your turn.
	//   shoulders passive sigil and the class resource.
	//   below     action points, the four skills as glyph + number, and the
	//             character's own move.
	import { Icon, ProgressBar, type IconName } from 'showcase';
	import { fxFor } from './internal/fx.js';
	import type { BreachMatch } from './internal/match.svelte.js';
	import { UPGRADE_KIND } from './internal/upgrades.js';
	import type { Skill } from './internal/rules.js';
	import { SKILL_GLYPH } from './parts/skill-glyphs.js';

	interface Props {
		match: BreachMatch;
		size?: number;
	}

	let { match, size = 108 }: Props = $props();

	const seat = $derived(match.seat);
	const live = $derived(match.stage === 'play' && !match.winner && match.isMyTurn);

	const frac = $derived(match.turnLeft / match.turnMs);
	const clockTone = $derived(frac > 0.4 ? seat.color : frac > 0.17 ? '#FBBF24' : '#FB7185');
	const standTone = $derived(
		match.standing > 60 ? '#34D399' : match.standing > 30 ? '#FBBF24' : '#FB7185'
	);

	const ring = $derived(size / 2 - 3);
	const arc = (r: number) => 2 * Math.PI * r;
	const plate = $derived(size - 20);
	const skills = $derived(Object.keys(seat.skills) as Skill[]);

	const power = $derived(match.power);
	const spent = $derived(match.powerCharges <= 0);
	const powerArmable = $derived(
		!!power &&
			!spent &&
			live &&
			!match.busy &&
			!match.pending &&
			(match.ap[seat.key] ?? 0) >= power.ap
	);
</script>

<div class="flex flex-col items-center gap-2 pointer-events-auto">
	<!-- ── Upgrades ────────────────────────────────────────────────────────────
	     Three slots. Lit ones carry their glyph and what they are worth; locked
	     ones carry the round they arrive, which is the only number that matters
	     about a thing you cannot use yet. -->
	<div class="flex items-center gap-1.5">
		{#each match.track() as upgrade (upgrade.key)}
			{@const open = match.round >= upgrade.at}
			{@const kind = UPGRADE_KIND[upgrade.kind]}
			<span
				class="relative grid place-items-center w-8 h-8 rounded-lg border-2 transition-all"
				style:color={open ? kind.hue : 'color-mix(in srgb, var(--fg) 25%, transparent)'}
				style:border-color={open
					? `color-mix(in srgb, ${kind.hue} 65%, transparent)`
					: 'color-mix(in srgb, var(--fg) 12%, transparent)'}
				style:background={open
					? `color-mix(in srgb, ${kind.hue} 16%, var(--bg-elev, #0b0f16))`
					: 'color-mix(in srgb, var(--fg) 4%, transparent)'}
				style:box-shadow={open
					? `0 0 12px color-mix(in srgb, ${kind.hue} 35%, transparent)`
					: 'none'}
				title="{upgrade.name} — {upgrade.text}{open ? '' : ` (round ${upgrade.at})`}"
			>
				{#if open}
					<Icon name={upgrade.icon as IconName} size={15} />
					<!-- What it is worth, on the corner. -->
					<b
						class="absolute -right-1 -bottom-1 grid place-items-center min-w-[15px] h-[15px] px-[3px]
						       rounded-full font-mono text-[0.55rem] font-black tabular-nums leading-none"
						style:color="var(--bg-elev, #0b0f16)"
						style:background={kind.hue}
					>
						{upgrade.value}
					</b>
				{:else}
					<!-- Locked: the round it lands, and nothing else. -->
					<span class="font-mono text-[0.62rem] font-black tabular-nums opacity-70">
						{upgrade.at}
					</span>
				{/if}
			</span>
		{/each}
	</div>

	<!-- ── The character ───────────────────────────────────────────────────────-->
	<div class="relative grid place-items-center" style:width="{size}px" style:height="{size}px">
		<svg class="absolute inset-0 -rotate-90" viewBox="0 0 {size} {size}" aria-hidden="true">
			<circle
				cx={size / 2}
				cy={size / 2}
				r={ring}
				fill="none"
				stroke="color-mix(in srgb, var(--fg) 12%, transparent)"
				stroke-width="3"
			/>
			{#if live}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={ring}
					fill="none"
					stroke={clockTone}
					stroke-width="3"
					stroke-linecap="round"
					stroke-dasharray={arc(ring)}
					stroke-dashoffset={arc(ring) * (1 - frac)}
					style:transition="stroke-dashoffset 200ms linear"
					style:opacity={match.busy ? 0.4 : 1}
				/>
			{/if}
			<circle
				cx={size / 2}
				cy={size / 2}
				r={ring - 5}
				fill="none"
				stroke="color-mix(in srgb, var(--fg) 8%, transparent)"
				stroke-width="2.5"
			/>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={ring - 5}
				fill="none"
				stroke={standTone}
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-dasharray={arc(ring - 5)}
				stroke-dashoffset={arc(ring - 5) * (1 - match.standing / 100)}
				style:transition="stroke-dashoffset 500ms ease"
			/>
		</svg>

		<span
			class="grid place-items-center rounded-full border-2 transition-all"
			style:width="{plate}px"
			style:height="{plate}px"
			style:color={seat.color}
			style:border-color="color-mix(in srgb, {seat.color} {live ? 75 : 30}%, transparent)"
			style:background="radial-gradient(circle at 50% 34%, color-mix(in srgb, {seat.color} {live
				? 34
				: 14}%, var(--bg-elev, #0b0f16)), var(--bg-elev, #0b0f16) 78%)"
			style:box-shadow={live
				? `0 0 28px color-mix(in srgb, ${seat.color} 34%, transparent)`
				: 'none'}
			title="{seat.name} — {seat.tagline}"
		>
			<Icon name={seat.icon as IconName} size={Math.round(size * 0.34)} />
		</span>

		<!-- Passive, as a sigil. Hovered once and then learned. -->
		<span
			class="absolute grid place-items-center w-6 h-6 rounded-full border-2"
			style:left="-4px"
			style:top="{Math.round(size * 0.17)}px"
			style:color={seat.color}
			style:border-color="color-mix(in srgb, {seat.color} 55%, transparent)"
			style:background="var(--bg-elev, #0b0f16)"
			title="{seat.passive.name} — {seat.passive.text}"
		>
			<Icon name="zap" size={12} />
		</span>

		<!-- The class resource. One numeral. -->
		<span
			class="absolute grid place-items-center min-w-[26px] h-[26px] px-1 rounded-full border-2"
			style:right="-6px"
			style:top="{Math.round(size * 0.15)}px"
			style:border-color="color-mix(in srgb, {seat.color} 55%, transparent)"
			style:background="var(--bg-elev, #0b0f16)"
			title="{match.res[seat.key] ?? 0} {seat.resource}"
		>
			<b class="font-mono text-[0.78rem] font-black tabular-nums" style:color={seat.color}>
				{match.res[seat.key] ?? 0}
			</b>
		</span>

		<!-- Standing, as a number on the chin — the ring says roughly, this says
		     exactly, and neither of them says a word. -->
		<span
			class="absolute -bottom-1 grid place-items-center min-w-[30px] h-[17px] px-1 rounded-full border"
			style:border-color="color-mix(in srgb, {standTone} 55%, transparent)"
			style:background="var(--bg-elev, #0b0f16)"
			title="{match.standingLabel} {match.standing}/100"
		>
			<b class="font-mono text-[0.6rem] font-black tabular-nums" style:color={standTone}>
				{match.standing}
			</b>
		</span>
	</div>

	<!-- Action points. Countable without counting. -->
	<ProgressBar
		type="pips"
		steps={match.maxAp()}
		filled={match.ap[seat.key] ?? 0}
		pipShape="diamond"
		pipSize={11}
		hollow
		color={seat.color}
		label="{match.ap[seat.key] ?? 0} of {match.maxAp()} action points"
	/>

	<!-- The four skills: a picture and a number, four times. -->
	<div class="flex items-center gap-1">
		{#each skills as skill (skill)}
			{@const base = seat.skills[skill]}
			{@const total = base + match.rollBonus}
			<span
				class="flex items-center gap-0.5 px-1.5 py-1 rounded-md border"
				style:border-color={total > 0
					? `color-mix(in srgb, ${seat.color} 40%, transparent)`
					: 'var(--border)'}
				style:background="color-mix(in srgb, var(--fg) 4%, transparent)"
				style:color={total > 0 ? seat.color : total < 0 ? '#FB7185' : 'var(--fg-dim)'}
				title="{skill} {total >= 0 ? '+' : ''}{total}{match.rollBonus
					? ` (${base} base, +${match.rollBonus} upgrades)`
					: ''}"
			>
				<Icon name={SKILL_GLYPH[skill]} size={11} />
				<b class="font-mono text-[0.66rem] font-black tabular-nums leading-none">
					{total >= 0 ? '+' : ''}{total}
				</b>
			</span>
		{/each}
	</div>

	<!-- ── The power ───────────────────────────────────────────────────────────
	     The character's own move, on the sheet rather than in the fan: there is
	     no pile for it to be in, which is the promise a discard used to break.
	     Spent, it greys and STAYS — it is bought back, not gone, and a control
	     that vanishes reads as lost. -->
	{#if power}
		{@const fx = fxFor(power.key, seat.faction)}
		{@const armed = match.armedKey === power.key}
		<button
			type="button"
			disabled={!powerArmable}
			onclick={() => {
				match.armedKey = power.key;
				match.inspectKey = power.key;
			}}
			class="relative grid place-items-center w-9 h-9 rounded-lg border-2 transition-all
			       disabled:cursor-default"
			style:color={spent ? 'color-mix(in srgb, var(--fg) 25%, transparent)' : fx.hue}
			style:border-color={spent
				? 'color-mix(in srgb, var(--fg) 12%, transparent)'
				: `color-mix(in srgb, ${fx.hue} ${armed ? 90 : 55}%, transparent)`}
			style:background={spent
				? 'color-mix(in srgb, var(--fg) 4%, transparent)'
				: `color-mix(in srgb, ${fx.hue} ${armed ? 28 : 14}%, var(--bg-elev, #0b0f16))`}
			style:box-shadow={armed ? `0 0 16px color-mix(in srgb, ${fx.hue} 40%, transparent)` : 'none'}
			style:opacity={spent || armed || powerArmable ? 1 : 0.55}
			title="{power.name} — {power.ap} AP · {spent
				? 'spent'
				: `${match.powerCharges} charge${match.powerCharges === 1 ? '' : 's'}`} — {power.text}"
		>
			<Icon name={fx.icon as IconName} size={16} />
			<!-- What is left of it, on the corner, the way an upgrade wears its value. -->
			<b
				class="absolute -right-1 -bottom-1 grid place-items-center min-w-[15px] h-[15px] px-[3px]
				       rounded-full font-mono text-[0.55rem] font-black tabular-nums leading-none"
				style:color="var(--bg-elev, #0b0f16)"
				style:background={spent ? 'color-mix(in srgb, var(--fg) 25%, transparent)' : fx.hue}
			>
				{match.powerCharges}
			</b>
		</button>
	{/if}
</div>
