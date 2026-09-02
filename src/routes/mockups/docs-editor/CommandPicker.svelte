<script lang="ts">
	// Binding a command to a clause — the sibling of EvidencePicker, and its
	// deliberate opposite.
	//
	// Citing evidence is RETROSPECTIVE: pick something that already happened and
	// score how old it is. Binding is PROSPECTIVE: pick something that WILL
	// happen, and the cadence question flips from "is this still current?" to
	// "does this run often enough?". So this sheet leads with what each command
	// has been doing lately, not with what it is.
	//
	// It is a sheet rather than a modal because two decisions are made here at
	// once — which command, and on what trigger — and a modal that grows a second
	// step becomes a wizard. The sheet just shows both.

	import { Button, Chip, EmptyState, Icon, SearchInput, SegmentGroup, SheetDrawer } from 'showcase';
	import RunStrip from './RunStrip.svelte';
	import type { Command, CommandKind, Provenance, Trigger } from './data.js';
	import { BINDING_STATUS, CATALOG, SOURCE, bindingStatus, catalogState } from './looks.js';

	interface Props {
		open: boolean;
		heading: string;
		/** The clause's controls, and the cadence a schedule is judged against. */
		control_refs: string[];
		cadence_days: number;
		pool: Command[];
		bound_ids: string[];
		onbind: (command_id: string, trigger: Trigger) => void;
		onclose: () => void;
	}

	let {
		open,
		heading,
		control_refs,
		cadence_days,
		pool,
		bound_ids,
		onbind,
		onclose
	}: Props = $props();

	let query = $state('');
	let kind_filter = $state<CommandKind | 'all'>('all');
	let origin_filter = $state<Provenance | 'all'>('all');
	/** Chosen command, which is what turns the sheet into its second half. */
	let picked = $state<string | null>(null);
	let mode = $state<'manual' | 'scheduled'>('manual');
	let every_days = $state(cadence_days);

	const KINDS: (CommandKind | 'all')[] = ['all', 'inline', 'script', 'binary', 'assertion'];
	const ORIGINS: (Provenance | 'all')[] = ['all', 'discovered', 'authored'];

	// Approved-and-proving first, then approved-but-unproven, then everything a
	// human has to touch. A drifted source sinks regardless.
	const RANK: Record<string, number> = {
		passing: 0,
		due: 1,
		never_run: 2,
		running: 3,
		overdue: 4,
		failing: 5,
		blocked: 6
	};

	const candidates = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return pool
			.filter((c) => !bound_ids.includes(c.command_id))
			.filter((c) => kind_filter === 'all' || c.body.kind === kind_filter)
			.filter((c) => origin_filter === 'all' || c.origin.provenance === origin_filter)
			.filter(
				(c) => !q || c.name.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q)
			)
			.sort((a, b) => {
				const ra = RANK[bindingStatus(a, cadence_days)] + (a.origin.source_state === 'tracking' ? 0 : 10);
				const rb = RANK[bindingStatus(b, cadence_days)] + (b.origin.source_state === 'tracking' ? 0 : 10);
				return ra - rb;
			});
	});

	const chosen = $derived(pool.find((c) => c.command_id === picked) ?? null);

	/** A schedule slower than the cadence cannot keep the control fresh. */
	const fits = $derived(mode === 'manual' || every_days <= cadence_days);

	function bodyLabel(c: Command): string {
		const b = c.body;
		if (b.kind === 'assertion') return b.assert.replace('_', ' ');
		if (b.kind === 'binary') return b.argv[0] ?? 'binary';
		if (b.kind === 'script') return b.interpreter;
		return b.lang;
	}

	function commit() {
		if (!chosen) return;
		onbind(
			chosen.command_id,
			mode === 'manual'
				? { mode: 'manual' }
				: { mode: 'scheduled', every_days, next_at: `in ${every_days} days` }
		);
	}
</script>

<SheetDrawer
	{open}
	{onclose}
	size="xl"
	title="Bind a check to “{heading}”"
	eyebrow="// operating evidence · bind"
	dismissible={false}
>
	<!-- The premise: what this clause claims, and how often it must be proven. -->
	<div class="flex items-center gap-2 flex-wrap pb-3 border-b border-[var(--border)]">
		<span class="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-[var(--fg-dim)]">
			Claims
		</span>
		{#each control_refs as r (r)}
			<Chip look="ghost" color="accent">{r}</Chip>
		{/each}
		{#if control_refs.length === 0}
			<span class="font-mono text-[0.62rem] text-[var(--fg-dim)]">no control mapped</span>
		{/if}
		<span class="flex-1"></span>
		<span class="font-mono text-[0.6rem] text-[var(--fg-dim)] tabular-nums">
			must be proven every {cadence_days}d
		</span>
	</div>

	<div class="flex flex-col gap-2 py-3">
		<SearchInput bind:value={query} placeholder="Search commands by name or what they do…" />
		<div class="flex gap-3 flex-wrap">
			<div class="flex gap-0.5 p-0.5 rounded-md border border-[var(--border)] flex-wrap">
				{#each KINDS as k (k)}
					<button
						class="px-1.5 py-1 rounded font-mono text-[0.55rem] uppercase tracking-wide
						       {kind_filter === k
							? 'text-[var(--fg)] bg-[var(--surface-strong)]'
							: 'text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
						onclick={() => (kind_filter = k)}
					>
						{k}
					</button>
				{/each}
			</div>
			<div class="flex gap-0.5 p-0.5 rounded-md border border-[var(--border)] flex-wrap">
				{#each ORIGINS as o (o)}
					<button
						class="px-1.5 py-1 rounded font-mono text-[0.55rem] uppercase tracking-wide
						       {origin_filter === o
							? 'text-[var(--fg)] bg-[var(--surface-strong)]'
							: 'text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
						onclick={() => (origin_filter = o)}
					>
						{o}
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if candidates.length === 0}
		<EmptyState
			message="No command in the catalog matches"
			sub="Author a script or an assertion below, or point Armornet at a repo it has not scanned yet."
		/>
	{/if}

	<!-- One row per command. The run strip is the column that matters: it says
	     whether this thing has been steady, which no status word can. -->
	{#each candidates as c (c.command_id)}
		{@const st = bindingStatus(c, cadence_days)}
		{@const cat = catalogState(c)}
		{@const on = picked === c.command_id}
		<button
			class="flex items-center gap-3 w-full px-2 py-2.5 text-left border-b border-[var(--border)]
			       bg-transparent cursor-pointer transition-colors
			       {on ? 'bg-[var(--accent-faint)]' : 'hover:bg-[var(--surface-raised)]'}"
			onclick={() => (picked = on ? null : c.command_id)}
			aria-pressed={on}
		>
			<span class="shrink-0" style:color={BINDING_STATUS[st].color}>
				<Icon name={BINDING_STATUS[st].icon} size={13} />
			</span>

			<span class="flex flex-col gap-0.5 flex-1 min-w-0">
				<span class="flex items-center gap-2 min-w-0">
					<span class="text-[0.82rem] text-[var(--fg)] truncate">{c.name}</span>
					<Chip look="ghost" color="default">{bodyLabel(c)}</Chip>
					{#if cat !== 'approved'}
						<Chip look="ghost" color="warn">{CATALOG[cat].label}</Chip>
					{/if}
					{#if c.origin.source_state !== 'tracking'}
						<Chip look="ghost" color="warn">{SOURCE[c.origin.source_state].label}</Chip>
					{/if}
				</span>
				<span class="font-mono text-[0.58rem] text-[var(--fg-muted)] truncate">
					{c.summary}
				</span>
			</span>

			<span class="shrink-0 flex flex-col items-end gap-1">
				<RunStrip runs={c.runs} slots={6} />
				<span class="font-mono text-[0.55rem] text-[var(--fg-dim)]">
					{c.origin.provenance === 'discovered' ? c.origin.doc_id : 'authored'}
				</span>
			</span>
		</button>
	{/each}

	{#snippet footer()}
		<!-- The second decision, in the same surface. It only appears once the
		     first is made, so the footer is never asking about nothing. -->
		{#if chosen}
			<div class="flex items-center gap-3 flex-wrap w-full">
				<span class="font-mono text-[0.6rem] text-[var(--fg-dim)]">Runs</span>

				<SegmentGroup
					options={[
						{ value: 'manual', label: 'Manually' },
						{ value: 'scheduled', label: 'On a schedule' }
					]}
					value={mode}
					onchange={(v: string) => (mode = v as 'manual' | 'scheduled')}
				/>

				{#if mode === 'scheduled'}
					<label class="flex items-center gap-1.5 font-mono text-[0.6rem] text-[var(--fg-dim)]">
						every
						<input
							class="w-[3.5rem] px-1.5 py-1 rounded border border-[var(--border)]
							       bg-[var(--input-bg)] text-[var(--fg)] text-[0.62rem] tabular-nums outline-none
							       focus:border-[var(--border-accent)]"
							type="number"
							min="1"
							bind:value={every_days}
						/>
						days
					</label>

					{#if !fits}
						<span
							class="font-mono text-[0.58rem]"
							style:color="var(--palette-amber)"
						>
							slower than the {cadence_days}d cadence — it cannot keep this control fresh
						</span>
					{/if}
				{/if}

				<span class="flex-1"></span>
				<Button variant="ghost" size="sm" onclick={onclose}>Cancel</Button>
				<Button variant="primary" size="sm" onclick={commit}>
					Bind {chosen.name}
				</Button>
			</div>
		{:else}
			<div class="flex items-center gap-2 flex-wrap w-full">
				<span class="font-mono text-[0.58rem] text-[var(--fg-dim)]">
					{candidates.length} available · pick one to choose its trigger
				</span>
				<span class="flex-1"></span>
				<span class="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-[var(--fg-dim)]">
					Or author
				</span>
				<Button size="xs" variant="ghost">Write a script</Button>
				<Button size="xs" variant="ghost">Add an assertion</Button>
			</div>
		{/if}
	{/snippet}
</SheetDrawer>
