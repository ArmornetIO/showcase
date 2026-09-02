<script lang="ts">
	// The callout block the assessments UI already uses for guidance: a tinted
	// panel with a left accent bar, a small glyph, and a mono uppercase
	// over-label naming what you are looking at and which control it serves.
	//
	// Everything a section carries that is not its prose — evidence, control
	// guidance, a drift decision, reviewer objections — renders through this one
	// shape, collapsed behind a header toggle. Before, each of those invented
	// its own frame, and a section with three of them read as three competing
	// cards stacked on the policy text.

	import { Icon } from 'showcase';
	import type { IconName } from '$lib/icons/Icon.svelte';

	interface Props {
		icon: IconName;
		/** The over-label, e.g. "EVIDENCE · SOC 2 CC6.2 · 90D CADENCE". */
		label: string;
		accent?: string;
		/** Right-aligned status text on the label row. */
		status?: import('svelte').Snippet;
		children: import('svelte').Snippet;
	}

	let { icon, label, accent = 'var(--accent)', status, children }: Props = $props();
</script>

<div
	class="flex flex-col gap-2 mt-2.5 p-[0.7rem_0.9rem] rounded-[6px] border border-l-2 bg-[var(--bg-elev)]"
	style:border-color="var(--border)"
	style:border-left-color={accent}
>
	<div class="flex items-center gap-2 min-w-0">
		<span class="shrink-0" style:color={accent}><Icon name={icon} size={13} /></span>
		<span
			class="font-mono text-[0.6rem] tracking-[0.1em] uppercase truncate"
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
