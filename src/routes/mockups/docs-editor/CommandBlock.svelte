<script lang="ts">
	// A fenced block as it appears in a PROCEDURE or a dev note — inert.
	//
	// This is half of what the old CodeStep was. The other half (running it,
	// its trigger, its history) moved to CommandCard, because those things
	// belong to a BINDING, not to prose. A block in a runbook is documentation
	// that happens to be executable elsewhere; putting a Run button here would
	// mean the same command could be run from two places with two different
	// cadences and no clause to score the result against.
	//
	// What it does say is the one fact prose cannot: whether this block has been
	// promoted into the catalog, and therefore whether anything can act on it.

	import { Chip, Icon, TerminalBlock, Tooltip } from 'showcase';
	import type { CodeBlock, Command } from './data.js';
	import { CATALOG, catalogState } from './looks.js';

	interface Props {
		block: CodeBlock;
		/** The catalog entry this block became, if it was ever promoted. */
		command: Command | null;
	}

	let { block, command }: Props = $props();

	const catalog = $derived(command ? catalogState(command) : null);
	const look = $derived(catalog ? CATALOG[catalog] : null);
</script>

<figure class="my-3.5">
	<figcaption
		class="flex items-center gap-2 flex-wrap px-1 pb-1.5 font-mono text-[0.55rem] text-[var(--fg-dim)]"
	>
		<Chip look="ghost" color="default">{block.lang}</Chip>

		{#if command && look}
			<Tooltip content={look.blurb} placement="top">
				<span class="flex items-center gap-1.5" style:color={look.color}>
					<Icon name={look.icon} size={10} />
					{command.name}
				</span>
			</Tooltip>
			<span class="text-[var(--fg-dim)]">·</span>
			<span>{command.runs.length} run{command.runs.length === 1 ? '' : 's'}</span>
		{:else}
			<!-- Not in the catalog. Nothing will execute it, and that is the
			     default — a fenced block is prose until a human says otherwise. -->
			<span class="flex items-center gap-1.5">
				<Icon name="code" size={10} />
				not in the catalog
			</span>
		{/if}
	</figcaption>

	<TerminalBlock content={block.code} chrome={false} dense />
</figure>
