<script lang="ts">
	// ── The board, as a list ─────────────────────────────────────────────────────
	// The globe is beautiful and it is a terrible reference: you cannot read a
	// hardening number off a sphere that is turning. Same nineteen buildings, in
	// a table, with the two facts a player actually needs — what it costs to
	// attack, and whether it is on the payload path.
	import { Icon } from 'showcase';
	import {
		CHAIN,
		STRUCTURES,
		TERRITORIES,
		TERRITORY_ORDER,
		type TerritoryKey
	} from '../internal/rules.js';

	const OWNER_WORD = {
		red: 'red’s own ground — blue may only reach it with Segment or Attribution',
		blue: 'blue’s estate — red’s objective, and where blue plays its own upkeep cards',
		neutral: 'nobody’s. Both sides may act here, and most of the game happens here'
	} as const;

	const inTerritory = (t: TerritoryKey) => STRUCTURES.filter((s) => s.territory === t);
</script>

<div class="flex flex-col gap-8">
	<!-- The chain first: it is the only thing on the board with an ORDER, and the
	     order is the whole game. -->
	<section class="rounded-lg border border-[#F472B6]/30 p-4">
		<h3 class="m-0 mb-1 text-sm font-black text-[#F472B6]">The payload path</h3>
		<p class="m-0 mb-3 text-[0.82rem] leading-snug text-[var(--fg-dim)]">
			Five buildings. Red may take the first four in any order — but holding the step before
			a target is worth +1 to +5 on the roll, so the order below is the cheap line rather than
			the only one. The last step is gated: the payload needs the whole chain, and taking it
			wins on the spot.
		</p>
		<ol class="m-0 flex list-none flex-wrap items-center gap-2 p-0">
			{#each CHAIN as s, i (s.id)}
				<li class="flex items-center gap-2">
					<span
						class="flex items-center gap-2 rounded-md border border-[var(--border-strong)] px-2.5 py-1.5"
						style:background="color-mix(in srgb, {TERRITORIES[s.territory].color} 10%, transparent)"
					>
						<b class="font-mono text-[0.7rem] tabular-nums" style:color={TERRITORIES[s.territory].color}
							>{s.chain}</b
						>
						<span class="text-[0.78rem] font-bold">{s.name}</span>
						<span class="font-mono text-[0.6rem] text-[var(--fg-dim)]">H{s.hardening}</span>
					</span>
					{#if i < CHAIN.length - 1}
						<Icon name="chevron-right" size={12} />
					{/if}
				</li>
			{/each}
			<li class="flex items-center gap-2">
				<Icon name="chevron-right" size={12} />
				<span
					class="rounded-md border border-[#F472B6]/50 px-2.5 py-1.5 font-mono text-[0.7rem]
					       uppercase tracking-widest text-[#F472B6]">protected core</span
				>
			</li>
		</ol>
	</section>

	{#each TERRITORY_ORDER as key (key)}
		{@const t = TERRITORIES[key]}
		<section class="flex flex-col gap-2">
			<header class="flex flex-wrap items-baseline gap-x-3 border-b border-[var(--border)] pb-2">
				<h3 class="m-0 text-sm font-black" style:color={t.color}>{t.name}</h3>
				<span class="font-mono text-[0.62rem] uppercase tracking-widest text-[var(--fg-dim)]"
					>{t.real}</span
				>
				<span class="w-full text-[0.78rem] leading-snug text-[var(--fg-dim)]">{t.blurb}</span>
				<span class="w-full text-[0.78rem] leading-snug">
					<b class="font-mono text-[0.6rem] uppercase tracking-widest" style:color={t.color}
						>Ground</b
					>
					<span class="ml-2 text-[var(--fg-dim)]">{OWNER_WORD[t.owner]}.</span>
				</span>
			</header>

			<table class="w-full border-collapse text-left">
				<thead>
					<tr class="font-mono text-[0.55rem] uppercase tracking-widest text-[var(--fg-dim)]">
						<th class="py-1 pr-3 font-normal">Building</th>
						<th class="py-1 pr-3 font-normal">What it really is</th>
						<th class="py-1 pr-3 font-normal text-right" title="the number an attack must beat"
							>Hard</th
						>
						<th class="py-1 pr-3 font-normal text-right">Step</th>
						<th class="py-1 font-normal">Controls standing on it</th>
					</tr>
				</thead>
				<tbody class="text-[0.78rem]">
					{#each inTerritory(key) as s (s.id)}
						<tr class="border-t border-[var(--border)] align-top">
							<td class="py-1.5 pr-3 font-bold">{s.name}</td>
							<td class="py-1.5 pr-3 text-[var(--fg-dim)]">{s.role}</td>
							<td class="py-1.5 pr-3 text-right font-mono tabular-nums">{s.hardening}</td>
							<td class="py-1.5 pr-3 text-right font-mono tabular-nums" style:color={t.color}
								>{s.chain ?? '—'}</td
							>
							<td class="py-1.5 font-mono text-[0.65rem] text-[var(--fg-dim)]"
								>{s.controls.join(', ') || '—'}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/each}
</div>
