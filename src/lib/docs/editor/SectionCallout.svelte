<script lang="ts">
	// Everything a section carries that is not its prose — checks, evidence, a drift
	// decision, comments — renders through this one shape. Before, each invented its
	// own frame, and a section with three of them read as three competing cards
	// stacked on the text.
	import type { Snippet } from 'svelte';
	import Icon from '../../icons/Icon.svelte';
	import type { IconName } from '../../icons/Icon.svelte';

	interface Props {
		icon: IconName;
		/** The over-label, e.g. "CHECKS · 2 TOOLS". */
		label: string;
		accent?: string;
		/** Right-aligned on the label row. */
		status?: Snippet;
		children: Snippet;
	}

	let { icon, label, accent = 'var(--accent)', status, children }: Props = $props();
</script>

<div
	class="mt-2.5 flex flex-col gap-2 rounded-[6px] border border-l-2 border-[var(--border)] bg-[var(--bg-elev)] p-[0.7rem_0.9rem]"
	style:border-left-color={accent}
>
	<div class="flex min-w-0 items-center gap-2">
		<span class="shrink-0" style:color={accent}><Icon name={icon} size={13} /></span>
		<span
			class="truncate font-(family-name:--mono) text-[0.6rem] tracking-[0.1em] uppercase"
			style:color={accent}
		>
			{label}
		</span>
		{#if status}
			<span class="flex-1"></span>
			{@render status()}
		{/if}
	</div>
	{@render children()}
</div>
