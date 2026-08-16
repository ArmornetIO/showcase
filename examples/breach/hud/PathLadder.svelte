<script lang="ts">
	// ── The payload path ─────────────────────────────────────────────────────────
	// Red reads it as a route; blue reads it as the list of things it has failed
	// to prove yet. Each rung picks the building on the board — aiming a card
	// should not require finding a 23px piece on a spinning sphere, so the globe
	// turns to face whatever you picked here.
	import { Icon, Panel } from 'showcase';
	import { BAR_TONE } from '../internal/fx.js';
	import { CHAIN } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
	}

	let { match }: Props = $props();

	/** What the rung says about itself, in one word. */
	function statusOf(id: string, isNext: boolean): { word: string; hue: string } {
		const f = match.visibleOn(id);
		if (f) return { word: f.staged ? 'staged' : f.sleeper ? 'sleeper' : 'held', hue: '#F472B6' };
		return isNext
			? { word: 'next', hue: 'var(--accent)' }
			: { word: 'clear', hue: 'var(--fg-dim)' };
	}
</script>

{#snippet route()}
	<span class="font-mono text-[0.54rem] tracking-widest uppercase text-[var(--fg-dim)]">
		outlands → core
	</span>
{/snippet}

{#snippet objective()}
	<div
		class="flex items-start gap-2 font-mono text-[0.54rem] leading-snug text-[var(--fg-dim)]"
	>
		<Icon name={match.seat.faction === 'red' ? 'flag' : 'shield'} size={12} />
		<span>
			{match.seat.faction === 'red'
				? 'Take all five in order, then push into the core before round 12.'
				: 'Reveal a standing foothold and play Attribution, or evict every one by round 12.'}
		</span>
	</div>
{/snippet}

<Panel
	title="payload path"
	padding="dense"
	actions={route}
	footer={objective}
	class="pointer-events-auto"
>
	<ol class="flex flex-col gap-1 m-0 p-0 list-none">
		{#each CHAIN as step (step.id)}
			{@const foothold = match.visibleOn(step.id)}
			{@const isNext = match.chainNext?.id === step.id && match.seat.faction === 'red'}
			{@const bar = match.barFor(step)}
			{@const leverage = match.seat.faction === 'red' ? match.leverageFor(step) : 0}
			{@const status = statusOf(step.id, isNext)}
			<li>
				<button
					type="button"
					onclick={() => (match.selectedId = step.id)}
					class="w-full flex items-center gap-2 rounded border px-2 py-1 text-left"
					style:border-color={foothold
						? 'color-mix(in srgb, #F472B6 45%, transparent)'
						: isNext
							? 'color-mix(in srgb, var(--accent) 40%, transparent)'
							: 'var(--border)'}
					style:background={foothold
						? 'color-mix(in srgb, #F472B6 10%, transparent)'
						: 'transparent'}
				>
					<span
						class="grid place-items-center w-4 h-4 rounded-full font-mono text-[0.5rem] font-bold shrink-0"
						style:background={foothold ? '#F472B6' : 'var(--border)'}
						style:color={foothold ? '#0b0f16' : 'var(--fg-dim)'}
					>
						{step.chain}
					</span>

					<span class="flex-1 min-w-0 font-mono text-[0.62rem] truncate">{step.name}</span>

					<!-- The same condition bar the board draws, at ladder scale. -->
					<span
						class="w-9 h-[5px] shrink-0 rounded-full overflow-hidden border"
						style:border-color="color-mix(in srgb, {BAR_TONE[bar.tone]} 40%, transparent)"
						style:background="color-mix(in srgb, black 55%, transparent)"
						title="hardening {bar.value} of {bar.base}"
					>
						<span
							class="block h-full rounded-full"
							style:width="{Math.max(6, Math.min(100, (bar.value / Math.max(1, bar.base)) * 100))}%"
							style:background={BAR_TONE[bar.tone]}
						></span>
					</span>

					<!-- What the ground already held is worth against this step. A chain
					     compounds, and a number nobody can see does not feel like it. -->
					{#if leverage > 0 && !foothold}
						<span
							class="font-mono text-[0.5rem] font-bold tabular-nums px-1 rounded"
							style:color="#0b0f16"
							style:background="#F472B6"
							title="leverage from the ground you already hold"
						>
							+{leverage}
						</span>
					{/if}

					<span class="font-mono text-[0.52rem] tracking-widest uppercase" style:color={status.hue}>
						{status.word}
					</span>
					<span class="font-mono text-[0.6rem] tabular-nums text-[var(--fg-dim)]">{bar.value}</span>
				</button>
			</li>
		{/each}
	</ol>
</Panel>
