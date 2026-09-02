<script lang="ts">
	// One bound check, as the clause sees it.
	//
	// This is what replaced the runnable code block that used to sit in the
	// prose. The clause shows the command's NAME, never its body — a policy
	// clause reading `armornet keys rotate --confirm` was the original mistake.
	// The body is one disclosure away for whoever wants it, and lives properly in
	// the runbook it came from.
	//
	// What the card must answer, in order:
	//   1. is this proving the clause right now      → status, first and loudest
	//   2. what is it                                → name, kind, where it lives
	//   3. has it been steady or is it flapping      → the run strip
	//   4. what do I do about it                     → exactly one primary action

	import { ActionsMenu, Button, Chip, Icon, TerminalBlock, Tooltip } from 'showcase';
	import RunStrip from './RunStrip.svelte';
	import type { Command, CommandBinding } from './data.js';
	import { BINDING_STATUS, CATALOG, SOURCE, bindingStatus, catalogState, scheduleFits } from './looks.js';

	interface Props {
		command: Command;
		binding: CommandBinding;
		/** The clause's cadence — the yardstick this run is judged against. */
		cadence_days: number;
		running: boolean;
		onrun: () => void;
		onunbind: () => void;
		onhistory: () => void;
	}

	let { command, binding, cadence_days, running, onrun, onunbind, onhistory }: Props = $props();

	const status = $derived(bindingStatus(command, cadence_days, running));
	const look = $derived(BINDING_STATUS[status]);
	const catalog = $derived(catalogState(command));
	const last = $derived(command.runs[0] ?? null);
	const fits = $derived(scheduleFits(binding, cadence_days));

	let body_open = $state(false);

	/** What the body IS, in the fewest words that stay true. */
	const kind_label = $derived.by(() => {
		const b = command.body;
		if (b.kind === 'assertion') return 'assertion';
		if (b.kind === 'binary') return 'binary';
		if (b.kind === 'script') return b.interpreter;
		return b.lang;
	});

	const body_text = $derived.by(() => {
		const b = command.body;
		if (b.kind === 'inline') return b.code;
		if (b.kind === 'script') return b.source;
		if (b.kind === 'binary') return b.argv.join(' ');
		const p = Object.entries(b.params)
			.map(([k, v]) => `${k}=${v}`)
			.join(' ');
		return `${b.assert} ${p}`;
	});

	/** An assertion is evaluated, not executed. Saying "Run" would be a lie. */
	const verb = $derived(command.body.kind === 'assertion' ? 'Check now' : 'Run now');
</script>

<div class="flex flex-col gap-2 py-2 border-t border-[var(--border)] first:border-t-0 first:pt-0">
	<!-- Line 1: the verdict, then what produced it. -->
	<div class="flex items-center gap-2 flex-wrap min-w-0">
		<Tooltip content={look.blurb} placement="top">
			<span
				class="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.09em]"
				style:color={look.color}
			>
				<Icon name={look.icon} size={11} />
				{look.label}
			</span>
		</Tooltip>

		<span class="text-[0.82rem] text-[var(--fg)] truncate">{command.name}</span>

		<Chip look="ghost" color="default">{kind_label}</Chip>

		{#if binding.trigger.mode === 'scheduled'}
			<Tooltip
				content={fits
					? `Runs every ${binding.trigger.every_days} days · next ${binding.trigger.next_at}`
					: `Runs every ${binding.trigger.every_days} days — cannot keep a ${cadence_days}-day control fresh`}
				placement="top"
			>
				<Chip look="ghost" color={fits ? 'default' : 'warn'}>
					every {binding.trigger.every_days}d
				</Chip>
			</Tooltip>
		{:else}
			<Chip look="ghost" color="default">manual</Chip>
		{/if}

		<span class="flex-1"></span>

		<RunStrip runs={command.runs} onopen={onhistory} />
	</div>

	<!-- Line 2: the last outcome in words, and where the command actually lives. -->
	<div class="flex items-center gap-2 flex-wrap font-mono text-[0.58rem] text-[var(--fg-muted)]">
		{#if last}
			<span class="truncate">{last.detail}</span>
			<span class="text-[var(--fg-dim)]">·</span>
			<span class="text-[var(--fg-dim)]">{last.at} · {last.triggered_by}</span>
		{:else}
			<span class="text-[var(--fg-dim)]">no runs yet</span>
		{/if}

		<span class="flex-1"></span>

		{#if command.origin.provenance === 'discovered'}
			<Tooltip
				content="{SOURCE[command.origin.source_state].blurb} · {command.origin.path}"
				placement="top"
			>
				<span
					class="flex items-center gap-1 truncate"
					style:color={SOURCE[command.origin.source_state].color}
				>
					<Icon name="file-text" size={10} />
					{command.origin.doc_id}
				</span>
			</Tooltip>
		{:else}
			<span class="flex items-center gap-1 text-[var(--fg-dim)]">
				<Icon name="pencil" size={10} /> authored
			</span>
		{/if}
	</div>

	<!-- Why it cannot run, stated once, only when that is the situation. -->
	{#if catalog !== 'approved'}
		<p
			class="flex items-start gap-2 m-0 px-2 py-1.5 rounded-[4px] text-[0.72rem] leading-[1.5]"
			style:color="var(--fg-muted)"
			style:background="color-mix(in srgb, {CATALOG[catalog].color} 8%, transparent)"
		>
			<span class="shrink-0 mt-[1px]" style:color={CATALOG[catalog].color}>
				<Icon name="info" size={11} />
			</span>
			<span>
				{#if catalog === 'superseded'}
					Approved against <code class="font-mono">{command.approval?.approved_hash}</code>, but the
					repo now holds <code class="font-mono">{command.body_hash}</code>. It was edited after
					approval, so nothing will run it until a human reviews the change.
				{:else}
					{CATALOG.unapproved.blurb}
				{/if}
			</span>
		</p>
	{/if}

	<!-- Line 3: one primary action, plus the body on demand. -->
	<div class="flex items-center gap-2">
		<Button
			size="xs"
			variant={status === 'blocked' ? 'ghost' : 'primary'}
			disabled={running}
			onclick={onrun}
		>
			{running ? 'Running…' : status === 'blocked' ? 'Review the change' : verb}
		</Button>

		<button
			class="flex items-center gap-1 font-mono text-[0.58rem] text-[var(--fg-dim)] hover:text-[var(--fg)] bg-transparent border-0 cursor-pointer"
			onclick={() => (body_open = !body_open)}
			aria-expanded={body_open}
		>
			<Icon name={body_open ? 'chevron-down' : 'chevron-right'} size={11} />
			{body_open ? 'Hide' : 'Show'} what it does
		</button>

		<span class="flex-1"></span>

		<ActionsMenu
			items={[
				{ label: 'Open in its document', icon: 'file-text', onclick: () => {} },
				{ label: 'Change trigger', icon: 'clock', onclick: () => {} },
				{ kind: 'separator' },
				{
					label: 'Unbind from this clause',
					icon: 'x',
					destructive: true,
					onclick: onunbind
				}
			]}
		/>
	</div>

	{#if body_open}
		<TerminalBlock content={body_text} chrome={false} dense />
		<p class="m-0 font-mono text-[0.55rem] text-[var(--fg-dim)]">
			{command.summary}
		</p>
	{/if}
</div>
