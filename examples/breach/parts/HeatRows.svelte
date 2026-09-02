<script lang="ts">
	// ── The five regions, and how loud each has got ──────────────────────────────
	// Red calls it heat, blue calls it detection; it is the same number and that
	// is the joke. `compact` drops the names and lets the swatch carry the
	// identity — it is the same colour the region is painted on the globe, so a
	// narrow rail does not need the word as well.
	import { ProgressBar } from 'showcase';
	import {
		TERRITORIES,
		TERRITORY_ORDER,
		meterName,
		type Faction,
		type TerritoryKey
	} from '../internal/rules.js';

	interface Props {
		heat: Record<TerritoryKey, number>;
		/** Whose meter it is — only changes what the tooltip calls it. */
		faction: Faction;
		compact?: boolean;
	}

	let { heat, faction, compact = false }: Props = $props();

	/** Hot enough to act on, then hot enough to panic about. The region's own
	 *  colour until then, so a quiet board reads as a map rather than a warning. */
	function toneFor(t: TerritoryKey, value: number): string {
		if (value >= 70) return '#FB7185';
		if (value >= 40) return '#FBBF24';
		return TERRITORIES[t].color;
	}
</script>

<div class="flex flex-col gap-1.5">
	{#each TERRITORY_ORDER as key (key)}
		{@const region = TERRITORIES[key]}
		{@const value = heat[key]}
		{@const owner = region.owner}
		<div
			class="flex items-center gap-2"
			title="{region.name} · {region.real} · {owner === 'neutral'
				? 'contested'
				: `${owner} ground`} · {meterName(faction).toLowerCase()} {value}"
		>
			{#if compact}
				<!-- Ownership is the ring around the swatch, so the rail says whose
				     ground it is without spending a word on it. -->
				<span
					class="w-[9px] h-[9px] rounded-[2px] shrink-0 border"
					style:background={region.color}
					style:border-color={owner === 'red'
						? '#F472B6'
						: owner === 'blue'
							? '#38BDF8'
							: 'transparent'}
				></span>
			{:else}
				<span
					class="w-[68px] shrink-0 font-mono text-[0.54rem] tracking-wide uppercase text-[var(--fg-dim)]"
				>
					{region.name.replace('The ', '')}
				</span>
			{/if}

			<span class="flex-1">
				<ProgressBar value={Math.max(2, value)} size="sm" color={toneFor(key, value)} animate />
			</span>

			<!-- The number shows up when it starts to matter, and not before. -->
			<span
				class="w-5 text-right font-mono text-[0.54rem] tabular-nums"
				style:color={value >= 70 ? '#FB7185' : 'var(--fg-dim)'}
				style:opacity={compact && value < 40 ? 0 : 1}
			>
				{value}
			</span>
		</div>
	{/each}
</div>
