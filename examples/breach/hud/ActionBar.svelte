<script lang="ts">
	// ── The action bar ───────────────────────────────────────────────────────────
	// What is armed, what it is aimed at, and what will happen. The roll is
	// ITEMISED on purpose: "+7" tells a player nothing about which of their
	// choices earned it, and skill + card + trust + leverage tells them the game.
	//
	// The dice themselves are thrown at the building and left lying on it — see
	// Board. What belongs here is only the reading of them, once they have stopped.
	import { Button, Icon, type IconName } from 'showcase';
	import { OUTCOME_COLOR, OUTCOME_LABEL, SKILL_LABEL } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		class?: string;
	}

	let { match, class: cls = '' }: Props = $props();

	const pct = (n: number) => `${Math.round(n * 100)}%`;

	const KIND_COLOR: Record<string, string> = {
		strike: '#FB7185',
		implant: '#F472B6',
		recon: '#38BDF8',
		control: '#A78BFA',
		econ: '#FBBF24',
		utility: '#34D399'
	};
</script>

<!-- One number and its caption. Three of these sit in a row and they are the
     same shape every time, which is what a snippet is for. -->
{#snippet stat(value: string, caption: string, hue: string, big = true)}
	<span class="flex items-baseline gap-1">
		<b class="font-mono {big ? 'text-[0.78rem]' : 'text-[0.6rem]'} font-bold tabular-nums" style:color={hue}>
			{value}
		</b>
		<span class="font-mono text-[0.5rem] uppercase text-[var(--fg-dim)]">{caption}</span>
	</span>
{/snippet}

<div class="flex items-center gap-3 {cls}">
	{#if match.armed && match.target && match.odds}
		{@const armed = match.armed}
		{@const odds = match.odds}
		<span
			class="font-mono text-[0.52rem] font-bold tracking-[0.14em] uppercase px-1.5 py-0.5 rounded"
			style:color={KIND_COLOR[armed.kind]}
			style:background="color-mix(in srgb, {KIND_COLOR[armed.kind]} 16%, transparent)"
		>
			{armed.name}
		</span>
		<span class="font-mono text-[0.66rem] text-[var(--fg-dim)]">→</span>
		<span class="font-mono text-[0.7rem] font-semibold truncate">{match.target.name}</span>

		{#if match.blockReason}
			<!-- Say WHY. "Illegal target" tells a player they were wrong; "take The
			     Archive first — the chain runs in order" tells them the game. A
			     sealed target is a warning rather than a refusal. -->
			<span
				class="font-mono text-[0.6rem]"
				style:color={match.blockReason.kind === 'sealed' ? '#A78BFA' : '#FB7185'}
			>
				{match.blockReason.text}
			</span>
			{#if match.blockReason.kind === 'sealed'}
				<span
					class="font-mono text-[0.5rem] font-bold tracking-[0.14em] uppercase px-1.5 py-0.5 rounded"
					style:color="#0b0f16"
					style:background="#A78BFA">sealed</span
				>
			{/if}
		{:else}
			<span class="font-mono text-[0.58rem] text-[var(--fg-dim)] tabular-nums">
				2d6
				<b style:color={match.seat.color} title={SKILL_LABEL[armed.skill]}>
					{odds.skill >= 0 ? '+' : ''}{odds.skill}
				</b>
				<span class="text-[0.5rem] uppercase">{SKILL_LABEL[armed.skill].slice(0, 3)}</span>
				{#if odds.abilityMod}<b class="text-[var(--fg)]">+{odds.abilityMod}</b>
					<span class="text-[0.5rem] uppercase">card</span>{/if}
				{#if odds.resourceMod}<b class="text-[var(--fg)]">+{odds.resourceMod}</b>
					<span class="text-[0.5rem] uppercase">{match.seat.resource}</span>{/if}
				{#if odds.holdMod}<b style:color="#F472B6">+{odds.holdMod}</b>
					<span class="text-[0.5rem] uppercase">hold</span>{/if}
				vs <b class="text-[var(--fg)]">{odds.target}</b>
			</span>

			<!-- Two numbers, because there are two questions: does it work at all,
			     and does it work properly. -->
			<span class="flex items-center gap-1.5">
				{@render stat(pct(odds.chance), 'any', OUTCOME_COLOR.partial)}
				{@render stat(pct(odds.chanceClean), 'clean', OUTCOME_COLOR.clean)}
				{#if odds.chanceBotch > 0.02}
					{@render stat(pct(odds.chanceBotch), 'botch', OUTCOME_COLOR.botch, false)}
				{/if}
			</span>
		{/if}
	{:else if match.armed}
		<!-- Armed, nothing aimed at yet. The board is already lighting the legal
		     sites, so this only has to name the card and point. -->
		<span
			class="font-mono text-[0.52rem] font-bold tracking-[0.14em] uppercase px-1.5 py-0.5 rounded"
			style:color={KIND_COLOR[match.armed.kind]}
			style:background="color-mix(in srgb, {KIND_COLOR[match.armed.kind]} 16%, transparent)"
		>
			{match.armed.name}
		</span>
		<span class="font-mono text-[0.66rem] text-[var(--fg-dim)]">→</span>
		<Icon name="crestlink" size={13} />
	{:else if !match.isMyTurn}
		<!-- Not your turn. Whose it is, as their glyph in their colour — the same
		     mark the rail and the board use for them. -->
		<span class="flex items-center gap-1.5" title="waiting on {match.activeKlass.name}">
			<span style:color={match.activeKlass.color}>
				<Icon name={match.activeKlass.icon as IconName} size={14} />
			</span>
			<b class="font-mono text-[0.6rem] font-black tracking-widest" style:color={match.activeKlass.color}>
				{match.activeKlass.seat}
			</b>
		</span>
	{/if}

	<span class="flex-1"></span>

	{#if match.diceSpin}
		<span
			class="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-[var(--fg-dim)] animate-pulse"
		>
			rolling…
		</span>
	{:else if match.lastRoll}
		{@const roll = match.lastRoll}
		<span class="flex items-center gap-1.5 font-mono text-[0.6rem] text-[var(--fg-dim)]">
			<span class="tabular-nums">
				{roll.dice[0]} + {roll.dice[1]} → <b class="text-[var(--fg)]">{roll.total}</b>
			</span>
			<b
				class="font-bold tracking-[0.12em] px-1 rounded"
				style:color="var(--bg-elev, #0b0f16)"
				style:background={OUTCOME_COLOR[roll.outcome]}
			>
				{OUTCOME_LABEL[roll.outcome]}
			</b>
			<span class="tabular-nums text-[0.55rem]">
				{roll.margin >= 0 ? '+' : ''}{roll.margin}
			</span>
		</span>
	{/if}

	<Button
		size="xs"
		variant="primary"
		disabled={!match.ready}
		onclick={() => match.resolve()}
	>
		resolve
	</Button>
	<Button
		size="xs"
		variant="ghost"
		disabled={match.busy || !!match.winner}
		onclick={() => match.endTurn()}
	>
		pass
	</Button>
</div>
