<script lang="ts">
	// ── The target sheet ─────────────────────────────────────────────────────────
	// The stat block for whatever building is picked, read through the seat's fog:
	// `occupancy` says "nothing proven" to blue and "clear" to red about the exact
	// same square, which is the asymmetry stated in one word.
	import { Icon, Panel } from 'showcase';
	import { TERRITORIES, meterName, CHAIN } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		/** Rendered as a close control when the host wants one. */
		onclose?: () => void;
		class?: string;
	}

	let { match, onclose, class: cls = '' }: Props = $props();

	const target = $derived(match.target);
	const foothold = $derived(target ? match.visibleOn(target.id) : undefined);

	const occupancy = $derived.by(() => {
		if (!target) return '';
		if (foothold)
			return `${foothold.sleeper ? 'sleeper' : 'foothold'}${foothold.persistent ? ' · persistent' : ''}`;
		return match.seat.faction === 'blue' ? 'nothing proven' : 'clear';
	});

	const stats = $derived(
		target
			? [
					{ label: 'Hardening', value: String(match.hardeningOf(target.id)) },
					{ label: 'Region', value: TERRITORIES[target.territory].name },
					{ label: meterName(match.seat.faction), value: `${match.heat[target.territory]}%` },
					{
						label: 'Controls',
						value: target.controls.length ? target.controls.join(', ') : 'none'
					},
					{
						label: 'Path step',
						value: target.chain ? `${target.chain} of ${CHAIN.length}` : 'off-path'
					}
				]
			: []
	);
</script>

{#if target}
	{#snippet head()}
		<div class="flex items-center gap-2">
			<span style:color={TERRITORIES[target.territory].color}>
				<Icon name={target.chain ? 'flag' : 'home'} size={13} />
			</span>
			<span class="flex-1 min-w-0 font-mono text-[0.72rem] font-bold truncate">{target.name}</span>
			<span
				class="font-mono text-[0.5rem] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded border"
				style:color={foothold ? '#F472B6' : 'var(--fg-dim)'}
				style:border-color={foothold
					? 'color-mix(in srgb, #F472B6 45%, transparent)'
					: 'var(--border)'}
			>
				{occupancy}
			</span>
			{#if onclose}
				<button
					type="button"
					onclick={onclose}
					class="font-mono text-[0.7rem] leading-none text-[var(--fg-dim)] hover:text-[var(--fg)]"
					aria-label="Clear target">✕</button
				>
			{/if}
		</div>
	{/snippet}

	<!-- `tone="accent"` rather than an inline border colour: a held building is a
	     card the player is acting on, which is exactly what the tone means. -->
	<Panel
		header={head}
		padding="dense"
		tone={foothold ? 'accent' : 'default'}
		class="pointer-events-auto {cls}"
	>
		<div class="flex flex-col gap-1.5">
			<span class="font-mono text-[0.5rem] tracking-widest uppercase text-[var(--fg-dim)]">
				{target.role} · {TERRITORIES[target.territory].real}
			</span>

			<dl class="grid grid-cols-2 gap-x-3 gap-y-0.5 m-0">
				{#each stats.slice(0, 4) as stat (stat.label)}
					<div class="flex justify-between gap-2 border-b border-[var(--border)] pb-0.5">
						<dt class="font-mono text-[0.5rem] tracking-wide uppercase text-[var(--fg-dim)]">
							{stat.label}
						</dt>
						<dd class="m-0 font-mono text-[0.6rem] font-semibold tabular-nums truncate">
							{stat.value}
						</dd>
					</div>
				{/each}
			</dl>

			<p class="m-0 font-mono text-[0.53rem] leading-snug text-[var(--fg-dim)]">{target.note}</p>
		</div>
	</Panel>
{/if}
