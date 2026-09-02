<script lang="ts">
	// One citation, drawn with the console's existing furniture: the same
	// colour-square-plus-mono-row an agent gets in OverviewNodeInspector, with
	// the cadence burn-down handed to ProgressBar rather than hand-rolled.
	//
	// The accent is FRESHNESS, not kind. What a reviewer needs first is whether
	// the proof is still inside its cadence; what kind of artifact it is comes
	// second — so kind is a glyph and freshness is the colour.

	import { Icon, ProgressBar, Tooltip } from 'showcase';
	import type { Evidence } from './data.js';
	import { EVIDENCE_KIND, FRESHNESS, freshnessOf } from './looks.js';

	interface Props {
		evidence: Evidence;
		cadence_days: number;
		/** Drops the source line — for dense lists where the column repeats. */
		compact?: boolean;
		onclick?: () => void;
		/** Rendered at the trailing edge — a detach button, a link action. */
		trailing?: import('svelte').Snippet;
	}

	let { evidence, cadence_days, compact = false, onclick, trailing }: Props = $props();

	const kind = $derived(EVIDENCE_KIND[evidence.kind]);
	const fresh = $derived(freshnessOf(evidence.age_days, cadence_days));
	const look = $derived(FRESHNESS[fresh]);
</script>

<Tooltip
	content="{kind.label} · {evidence.source} · {evidence.age_days} of {cadence_days} cadence days used"
	placement="top"
>
	<div
		class="flex flex-col min-w-0 rounded border overflow-hidden bg-[var(--surface-raised)]"
		style:border-color="color-mix(in srgb, {look.color} 28%, var(--border))"
	>
		<div class="flex items-center gap-2 min-w-0">
			<svelte:element
				this={onclick ? 'button' : 'div'}
				type={onclick ? 'button' : undefined}
				role={onclick ? 'button' : undefined}
				tabindex={onclick ? 0 : undefined}
				onclick={onclick}
				class="flex flex-1 min-w-0 items-center gap-2 px-2 py-1.5 text-left
				       {onclick ? 'hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)]' : ''}"
			>
				<span
					class="flex items-center justify-center w-5 h-5 shrink-0 rounded border"
					style:color={look.color}
					style:background="color-mix(in srgb, {look.color} 14%, transparent)"
					style:border-color="color-mix(in srgb, {look.color} 35%, transparent)"
				>
					<Icon name={kind.icon} size={11} />
				</span>

				<span class="flex flex-col min-w-0 flex-1">
					<span class="truncate font-mono text-[0.66rem] leading-[1.35] text-[var(--fg)]">
						{evidence.label}
					</span>
					{#if !compact}
						<span class="truncate font-mono text-[0.55rem] leading-[1.3] text-[var(--fg-dim)]">
							{evidence.source}
						</span>
					{/if}
				</span>

				<span
					class="shrink-0 font-mono text-[0.6rem] font-semibold tabular-nums"
					style:color={look.color}
				>
					{evidence.age_days}d
				</span>
			</svelte:element>

			{#if trailing}
				<span class="flex items-center pr-1">{@render trailing()}</span>
			{/if}
		</div>

		<ProgressBar
			value={Math.min(evidence.age_days, cadence_days)}
			max={cadence_days}
			color={look.color}
			size="sm"
			animate={false}
		/>
	</div>
</Tooltip>
