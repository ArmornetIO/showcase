<script lang="ts">
	// The control claim and its proof — the reason a policy lives in here rather
	// than in a wiki.
	//
	// A clause claims a control. That claim is worth exactly as much as the
	// evidence behind it, and evidence is only worth anything inside the
	// control's cadence. So the callout states all three in one line of
	// over-label — which control, which framework, what cadence — and then shows
	// what is actually cited against it.
	//
	// The crosswalk row is the part that pays for the control model: a clause
	// claiming SOC 2 CC6.2 also answers ISO A.5.17 and PCI 8.3, so ONE run
	// satisfies three frameworks. Nobody needs to collect that evidence again.
	//
	// A GAP still gets said out loud — a clause that claims a control and cites
	// nothing is the most expensive state in GRC.

	import { Chip, Icon, Tooltip } from 'showcase';
	import type { Control, Evidence } from './data.js';
	import EvidenceChip from './EvidenceChip.svelte';
	import SectionCallout from './SectionCallout.svelte';
	import { FRESHNESS, alsoSatisfied, freshnessOf, worstFreshness } from './looks.js';

	interface Props {
		controls: Control[];
		cited: Evidence[];
		cadence_days: number;
		/** True when the clause carries a registered block that can produce proof. */
		can_run: boolean;
		onlink: () => void;
		ondetach: (evidence_id: string) => void;
		onrun: () => void;
	}

	let { controls, cited, cadence_days, can_run, onlink, ondetach, onrun }: Props = $props();

	const worst = $derived(worstFreshness(cited, cadence_days));
	const is_gap = $derived(controls.length > 0 && cited.length === 0);
	const accent = $derived(is_gap ? '#fb7185' : worst ? FRESHNESS[worst].color : 'var(--accent)');
	const oldest = $derived([...cited].sort((a, b) => b.age_days - a.age_days)[0] ?? null);
	const also = $derived(alsoSatisfied(controls));

	const label = $derived(
		controls.length > 0
			? `Claims ${controls.map((c) => `${c.framework} ${c.ref}`).join(' · ')} · ${cadence_days}d cadence`
			: `Evidence · ${cadence_days}d cadence`
	);
</script>

<SectionCallout icon="shield-check" {label} {accent}>
	{#snippet status()}
		{#if worst}
			<span
				class="flex items-center gap-1.5 shrink-0 font-mono text-[0.6rem]"
				style:color={FRESHNESS[worst].color}
			>
				<Icon name={FRESHNESS[worst].icon} size={11} />
				{FRESHNESS[worst].label}
			</span>
		{/if}
	{/snippet}

	<!-- What the claim is, in the standard's own words plus ours. -->
	{#each controls as c (c.control_id)}
		<div class="flex items-baseline gap-2 flex-wrap font-mono text-[0.64rem]">
			<span class="text-[var(--accent)]">{c.ref}</span>
			<span class="text-[var(--fg-muted)]">{c.name}</span>
			<span class="text-[var(--fg-dim)]">{c.framework} {c.framework_version}</span>
		</div>
	{/each}

	<!-- The round trip: one run, several frameworks answered. -->
	{#if also.length > 0}
		<div class="flex items-center gap-1.5 flex-wrap">
			<Tooltip content="Equivalent controls — the same evidence satisfies these" placement="top">
				<span
					class="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-[var(--fg-dim)]"
				>
					also satisfies
				</span>
			</Tooltip>
			{#each also as x (x.framework + x.ref)}
				<Chip look="ghost" color="cyan">{x.framework} {x.ref}</Chip>
			{/each}
		</div>
	{/if}

	<!-- The proof. -->
	{#if cited.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each cited as e (e.id)}
				<div class="min-w-0 basis-[min(100%,19rem)] grow">
					<EvidenceChip evidence={e} {cadence_days}>
						{#snippet trailing()}
							<button
								class="flex items-center justify-center w-[18px] h-[18px] rounded
								       text-[var(--fg-dim)] hover:text-[#fb7185]
								       hover:bg-[color-mix(in_srgb,#fb7185_12%,transparent)]"
								onclick={() => ondetach(e.id)}
								aria-label="Unlink {e.label}"
							>
								<Icon name="x" size={10} />
							</button>
						{/snippet}
					</EvidenceChip>
				</div>
			{/each}
		</div>

		{#if oldest}
			{@const f = freshnessOf(oldest.age_days, cadence_days)}
			{#if f === 'stale' || f === 'expired'}
				<p class="m-0 text-[0.75rem] leading-[1.6]" style:color="var(--palette-amber)">
					{oldest.label} has used {Math.round((oldest.age_days / cadence_days) * 100)}% of a
					{cadence_days}-day cadence.
					{#if can_run}
						Running the block below replaces it with a current proof.
					{:else}
						Re-collect it before this clause is cited in an audit.
					{/if}
				</p>
			{/if}
		{/if}
	{:else if is_gap}
		<p class="m-0 text-[0.75rem] leading-[1.6]" style:color="var(--palette-amber)">
			This clause claims {controls.map((c) => c.ref).join(', ')} and cites nothing — there is no proof
			the control operated.
			{#if can_run}
				The block below is registered; one run closes the gap.
			{/if}
		</p>
	{:else}
		<p class="m-0 text-[0.78rem] leading-[1.6] text-[var(--fg-muted)]">
			No evidence is cited on this clause yet.
		</p>
	{/if}

	<div class="flex items-center gap-2 flex-wrap">
		<button
			class="flex items-center gap-1.5 px-2 py-1 rounded-[4px] border font-mono text-[0.6rem]
			       uppercase tracking-[0.08em] text-[var(--accent)] border-[var(--border-accent)]
			       bg-[var(--accent-faint)] hover:bg-[var(--accent-faint-strong)]"
			onclick={onlink}
		>
			<Icon name="link" size={11} />
			Cite evidence
		</button>

		{#if can_run}
			<button
				class="flex items-center gap-1.5 px-2 py-1 rounded-[4px] border border-[var(--border)]
				       font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--fg-muted)]
				       hover:text-[var(--fg)] hover:border-[var(--border-strong)]"
				onclick={onrun}
			>
				<Icon name="play" size={11} />
				Run for fresh proof
			</button>
		{/if}
	</div>
</SectionCallout>
