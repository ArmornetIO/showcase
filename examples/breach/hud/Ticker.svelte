<script lang="ts">
	// ── The ticker ───────────────────────────────────────────────────────────────
	// Round, whose turn, how long they have left, and how loud each region has
	// got — the four facts that are true no matter what else is on screen.
	//
	// The clock drains only while the player is THINKING. A resolution playing
	// out is the game's time, not theirs, which is why it reads `busy`.
	import { Icon, ProgressBar, type IconName } from 'showcase';
	import { INITIATIVE, ROSTER, TERRITORIES, TERRITORY_ORDER } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		onrules: () => void;
		/** Extra controls dropped in before the region chips. */
		children?: import('svelte').Snippet;
	}

	let { match, onrules, children }: Props = $props();

	const frac = $derived(match.turnLeft / match.turnMs);
	const clockTone = $derived(
		frac > 0.4 ? match.activeKlass.color : frac > 0.17 ? '#FBBF24' : '#FB7185'
	);
</script>

<!-- A toggle that reads as pressed. Three of these sit in a row and they should
     all behave identically, which is exactly what a snippet is for. -->
{#snippet toggle(on: boolean, label: string, act: () => void, hue: string, icon?: IconName)}
	<button
		type="button"
		onclick={act}
		title={label}
		class="flex items-center gap-1 font-mono text-[0.54rem] font-bold tracking-[0.16em] uppercase
		       px-1.5 py-0.5 rounded border disabled:opacity-35"
		style:color={on ? hue : 'var(--fg-dim)'}
		style:border-color={on ? `color-mix(in srgb, ${hue} 55%, transparent)` : 'var(--border)'}
		style:background={on ? `color-mix(in srgb, ${hue} 14%, transparent)` : 'transparent'}
	>
		{#if icon}<Icon name={icon} size={10} />{/if}
		{label}
	</button>
{/snippet}

<div
	class="absolute inset-x-0 top-0 z-[3] h-10 flex items-center gap-3 px-4 border-b border-[var(--border)]
	       bg-gradient-to-b from-black/80 to-transparent backdrop-blur-[2px]
	       whitespace-nowrap overflow-hidden"
>
	<span class="shrink-0 font-mono text-[0.66rem] tracking-[0.14em]">BREACH · SUPPLY CHAIN</span>
	<span class="shrink-0 font-mono text-[0.62rem] text-[var(--fg-dim)]">
		ROUND <b class="text-[var(--fg)] tabular-nums">{match.round}</b>/12
	</span>

	<span class="w-px h-4 bg-[var(--border)]"></span>

	<!-- Initiative, in order, with the acting chair lit. -->
	<div class="flex items-center gap-1.5">
		{#each INITIATIVE as key, i (key)}
			{@const klass = ROSTER.find((r) => r.key === key)!}
			{@const acting = i === match.phase}
			<span
				class="font-mono text-[0.56rem] tracking-widest uppercase px-1.5 py-0.5 rounded border"
				style:color={acting ? klass.color : 'var(--fg-dim)'}
				style:border-color={acting
					? `color-mix(in srgb, ${klass.color} 55%, transparent)`
					: 'var(--border)'}
				style:background={acting
					? `color-mix(in srgb, ${klass.color} 14%, transparent)`
					: 'transparent'}
			>
				{klass.seat}
			</span>
		{/each}
	</div>

	<span class="font-mono text-[0.62rem] text-[var(--fg-dim)]">
		to act: <b style:color={match.activeKlass.color}>{match.activeKlass.name}</b>
	</span>

	{#if match.stage === 'play' && !match.winner}
		<span class="flex items-center gap-1.5" title="turn clock">
			<span class="w-16">
				<ProgressBar value={frac * 100} size="sm" color={clockTone} animate={false} />
			</span>
			<b
				class="font-mono text-[0.62rem] tabular-nums"
				style:color={clockTone}
				style:opacity={match.busy ? 0.45 : 1}
			>
				{Math.ceil(match.turnLeft / 1000)}s
			</b>
		</span>
	{/if}

	{@render toggle(false, 'rules', onrules, 'var(--accent)')}
	<!-- AUTO hands all four chairs to the demonstrator and stops the HUD following
	     the turn, so one person can sit in one seat and watch a fog-of-war game
	     happen around them. -->
	{@render toggle(
		match.auto,
		match.auto ? 'auto on' : 'auto off',
		() => (match.auto = !match.auto),
		'#34D399',
		'play'
	)}

	{#if children}{@render children()}{/if}

	<span class="flex-1"></span>

	<!-- The five regions. No names: the swatch IS the name, because it is the
	     same colour that region is painted on the globe, and a player learns the
	     five colours in one match. Ownership is the ring around it. What is left
	     is the only thing that changes — the number. -->
	{#each TERRITORY_ORDER as key (key)}
		{@const region = TERRITORIES[key]}
		{@const owner = region.owner}
		{@const heat = match.heat[key]}
		<span
			class="flex items-center gap-1"
			title="{region.name} · {region.real} · {owner === 'neutral'
				? 'contested'
				: `${owner} ground`} · heat {heat}"
		>
			<span
				class="w-2.5 h-2.5 rounded-[3px] border-2"
				style:background={region.color}
				style:border-color={owner === 'red'
					? '#F472B6'
					: owner === 'blue'
						? '#38BDF8'
						: 'transparent'}
			></span>
			<b
				class="font-mono text-[0.72rem] font-black tabular-nums leading-none"
				style:color={heat >= 70 ? '#FB7185' : heat >= 40 ? '#FBBF24' : 'var(--fg-dim)'}
			>
				{heat}
			</b>
		</span>
	{/each}
</div>
