<script lang="ts">
	// The checks bound to a clause — the sibling of EvidenceRail, and its
	// deliberate opposite.
	//
	// Evidence linking is RETROSPECTIVE: pick an artifact that already exists and
	// score how old it is. Binding a check is PROSPECTIVE: pick something that
	// will happen, and the cadence question flips from "is this still current?"
	// to "does this run often enough?".
	//
	// Which is why a binding does NOT close a gap. Citations are terminal — they
	// are the proof. Bindings are generative — they MAKE the proof, later. A
	// clause that claims a control and has a bound check that has never run is
	// still a clause with no evidence, and saying otherwise would be the single
	// most expensive lie this UI could tell.

	import { Button, EmptyState } from 'showcase';
	import CommandCard from './CommandCard.svelte';
	import SectionCallout from './SectionCallout.svelte';
	import type { Command, CommandBinding } from './data.js';
	import { BINDING_STATUS, bindingStatus, worstBindingStatus } from './looks.js';

	interface Props {
		bindings: CommandBinding[];
		by_command: Map<string, Command>;
		cadence_days: number;
		/** Which binding is mid-flight, if any. */
		running_id: string | null;
		onbind: () => void;
		onunbind: (binding_id: string) => void;
		onrun: (binding_id: string) => void;
		onhistory: (binding_id: string) => void;
	}

	let {
		bindings,
		by_command,
		cadence_days,
		running_id,
		onbind,
		onunbind,
		onrun,
		onhistory
	}: Props = $props();

	const pairs = $derived(
		bindings
			.map((b) => ({ binding: b, command: by_command.get(b.command_id) }))
			.filter((p): p is { binding: CommandBinding; command: Command } => !!p.command)
	);

	const worst = $derived(
		worstBindingStatus(
			pairs.map((p) => bindingStatus(p.command, cadence_days, running_id === p.binding.binding_id))
		)
	);

	const accent = $derived(worst ? BINDING_STATUS[worst].color : 'var(--fg-dim)');

	/** Bindings the store holds but the repo has not been told about yet. */
	const unprojected = $derived(pairs.filter((p) => !p.binding.projected).length);

	const label = $derived(
		pairs.length === 0
			? 'Checks · none bound'
			: `Checks · ${pairs.length} bound · judged against ${cadence_days}d cadence`
	);
</script>

<SectionCallout icon="zap" {label} {accent}>
	{#snippet status()}
		{#if worst}
			<span class="font-mono text-[0.58rem] uppercase tracking-[0.08em]" style:color={accent}>
				{BINDING_STATUS[worst].label}
			</span>
		{/if}
	{/snippet}

	{#if pairs.length === 0}
		<EmptyState
			message="Nothing proves this clause yet"
			sub="Bind a command from a runbook, or an assertion about the repo — its runs become the evidence cited here."
		/>
	{:else}
		<div class="flex flex-col">
			{#each pairs as p (p.binding.binding_id)}
				<CommandCard
					command={p.command}
					binding={p.binding}
					{cadence_days}
					running={running_id === p.binding.binding_id}
					onrun={() => onrun(p.binding.binding_id)}
					onunbind={() => onunbind(p.binding.binding_id)}
					onhistory={() => onhistory(p.binding.binding_id)}
				/>
			{/each}
		</div>
	{/if}

	<div class="flex items-center gap-2">
		<Button size="xs" variant="ghost" onclick={onbind}>Bind a check</Button>

		<span class="flex-1"></span>

		<!-- Bindings save instantly because they are ours; the repo learns about
		     them on the next commit. Said quietly, because it is bookkeeping. -->
		{#if unprojected > 0}
			<span class="font-mono text-[0.55rem] text-[var(--fg-dim)]">
				{unprojected} not yet written to frontmatter
			</span>
		{/if}
	</div>
</SectionCallout>
