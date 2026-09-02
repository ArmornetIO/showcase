<script lang="ts">
	// Linking evidence to a clause — the verb the old mockup was missing.
	//
	// DESIGN DECISION. A file picker would be the obvious build and the wrong
	// one. What makes a citation good is not its name, it is whether it still
	// falls inside the cadence of the control THIS clause maps to — so the same
	// evidence row is a strong citation under a 365-day control and a worthless
	// one under a 90-day control. The picker therefore scores every candidate
	// against the target clause's cadence, sorts by that, and states out loud
	// when something is already past cadence instead of quietly listing it.
	//
	// SURFACE. A sheet, not a modal — the same one the risk register's editor
	// uses (RiskEditorDrawer). A modal is a box that asks one question and gets
	// out of the way; this asks several at once (which evidence, is it current,
	// what does it already cover, and should I collect something new instead)
	// and a sheet has the room for that without shrinking the rows to fit.
	// It is also not dismissible by scrim click: curating citations is work.

	import { Button, Chip, Icon, SearchInput, SheetDrawer } from 'showcase';
	import type { Control, Evidence, EvidenceKind } from './data.js';
	import EvidenceChip from './EvidenceChip.svelte';
	import { EVIDENCE_KIND, freshnessOf } from './looks.js';

	interface Props {
		open: boolean;
		heading: string;
		controls: Control[];
		cadence_days: number;
		pool: Evidence[];
		linked_ids: string[];
		onlink: (evidence_id: string) => void;
		onclose: () => void;
	}

	let { open, heading, controls, cadence_days, pool, linked_ids, onlink, onclose }: Props = $props();

	let query = $state('');
	let kind_filter = $state<EvidenceKind | 'all'>('all');

	const KINDS: (EvidenceKind | 'all')[] = [
		'all',
		'run_output',
		'attestation',
		'config_capture',
		'document'
	];

	const ORDER = { fresh: 0, aging: 1, stale: 2, expired: 3 } as const;

	const candidates = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return pool
			.filter((e) => !linked_ids.includes(e.id))
			.filter((e) => kind_filter === 'all' || e.kind === kind_filter)
			.filter((e) => !q || e.label.toLowerCase().includes(q) || e.source.toLowerCase().includes(q))
			.sort((a, b) => {
				const fa = ORDER[freshnessOf(a.age_days, cadence_days)];
				const fb = ORDER[freshnessOf(b.age_days, cadence_days)];
				return fa === fb ? a.age_days - b.age_days : fa - fb;
			});
	});

	const usable = $derived(
		candidates.filter((e) => freshnessOf(e.age_days, cadence_days) !== 'expired')
	);
</script>

<SheetDrawer
	{open}
	{onclose}
	size="lg"
	title="Cite evidence for “{heading}”"
	eyebrow="// operating evidence · cite"
	dismissible={false}
>
	<!-- What we are citing against, and the yardstick every row below is scored
	     by. It stays at the top of the body rather than in the header rail: it is
	     the premise of the list, and reads as its column heading. -->
	<div class="flex items-center gap-2 flex-wrap pb-3 border-b border-[var(--border)]">
		<span class="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-[var(--fg-dim)]">
			Claims
		</span>
		{#each controls as c (c.control_id)}
			<Chip look="ghost" color="accent">{c.framework} {c.ref}</Chip>
		{/each}
		{#if controls.length === 0}
			<span class="font-mono text-[0.62rem] text-[var(--fg-dim)]">no control mapped</span>
		{/if}
		<span class="flex-1"></span>
		<span class="font-mono text-[0.6rem] text-[var(--fg-dim)] tabular-nums">
			{cadence_days}d cadence
		</span>
	</div>

	<!-- Tools. Search gets its own row: cramming it beside six filter buttons
	     truncated the placeholder to "Search evidence by nam". -->
	<div class="flex flex-col gap-2 py-3">
		<SearchInput bind:value={query} placeholder="Search evidence by name or source…" />
		<div class="flex gap-0.5 p-0.5 rounded-md border border-[var(--border)] self-start flex-wrap">
			{#each KINDS as k (k)}
				<button
					class="px-1.5 py-1 rounded font-mono text-[0.55rem] uppercase tracking-wide whitespace-nowrap
					       {kind_filter === k
						? 'text-[var(--fg)] bg-[var(--surface-strong)]'
						: 'text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
					onclick={() => (kind_filter = k)}
				>
					{k === 'all' ? 'All' : EVIDENCE_KIND[k].label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Candidates. The sheet owns the scroll, so the list is not boxed inside a
	     second scroller — one scrollbar, and the rows can be as tall as they need. -->
	<div>
		{#if candidates.length === 0}
			<p
				class="flex items-center justify-center gap-2 py-8 m-0 font-mono text-[0.66rem] text-[var(--fg-dim)]"
			>
				<Icon name="search" size={14} />
				Nothing in the evidence store matches. Collect something new below.
			</p>
		{/if}

		{#each candidates as e (e.id)}
			{@const f = freshnessOf(e.age_days, cadence_days)}
			<div
				class="flex items-center gap-3 py-2 border-b border-[var(--border)] {f === 'expired'
					? 'opacity-55'
					: ''}"
			>
				<div class="flex-1 min-w-0"><EvidenceChip evidence={e} {cadence_days} /></div>

				<span
					class="shrink-0 w-[9.5rem] text-right font-mono text-[0.58rem] tabular-nums"
					style:color={f === 'expired' ? 'var(--palette-red)' : 'var(--fg-dim)'}
				>
					{#if f === 'expired'}
						past cadence by {e.age_days - cadence_days}d
					{:else}
						{cadence_days - e.age_days}d of cadence left
					{/if}
				</span>

				<Button size="xs" variant="primary" onclick={() => onlink(e.id)}>Cite</Button>
			</div>
		{/each}
	</div>

	{#snippet footer()}
		<div class="flex items-center gap-2 flex-wrap w-full">
			<span class="font-mono text-[0.58rem] text-[var(--fg-dim)] tabular-nums">
				{usable.length} usable · {candidates.length - usable.length} past cadence
			</span>
			<span class="flex-1"></span>
			<span class="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-[var(--fg-dim)]">
				Or collect
			</span>
			{#each [{ icon: 'play', label: 'Run a procedure' }, { icon: 'user', label: 'Request attestation' }, { icon: 'upload', label: 'Upload' }] as a (a.label)}
				<Button size="xs" variant="ghost">
					<Icon name={a.icon as 'play'} size={11} />
					{a.label}
				</Button>
			{/each}
		</div>
	{/snippet}
</SheetDrawer>
