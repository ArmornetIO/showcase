<script lang="ts">
	// ── Who is winning ───────────────────────────────────────────────────────────
	// The table, and nothing around it: it is shown inside the footer's
	// Standings modal, which owns the fetch and the question of whether a
	// leaderboard exists at all. It was a corner panel with its own expander —
	// a box pinned over the stage that you had to open to find out it was empty.
	import type { Leader } from '../api.js';
	import { handle } from './handle.svelte.js';

	interface Props {
		leaders: Leader[];
	}

	let { leaders }: Props = $props();
</script>

{#if leaders.length === 0}
	<p class="font-mono text-[0.7rem] text-[var(--fg-dim)]">No finished matches yet.</p>
{:else}
	<table class="w-full border-collapse font-mono text-[0.7rem]">
		<thead>
			<tr class="text-left text-[var(--fg-dim)]">
				<th class="pr-2 pb-1">#</th>
				<th class="pr-2 pb-1">player</th>
				<th class="pr-2 pb-1 text-right" title="wins">W</th>
				<th class="pr-2 pb-1 text-right" title="buildings held">B</th>
				<th class="pb-1 text-right" title="rounds survived">R</th>
			</tr>
		</thead>
		<tbody>
			{#each leaders as l (l.handle)}
				<tr class={l.handle === handle.value ? 'text-[var(--accent,#60a5fa)]' : ''}>
					<td class="pr-2 py-0.5">{l.rank}</td>
					<td class="pr-2 py-0.5 truncate max-w-[14rem]">{l.handle}</td>
					<td class="pr-2 py-0.5 text-right">{l.wins}</td>
					<td class="pr-2 py-0.5 text-right">{l.buildings_held}</td>
					<td class="py-0.5 text-right">{l.rounds}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
