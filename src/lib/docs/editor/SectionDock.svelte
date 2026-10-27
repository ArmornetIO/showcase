<script lang="ts" module>
	import type { IconName } from '../../icons/Icon.svelte';

	/** One affordance docked to a section — evidence, checks, comments, a pending decision. */
	export interface DockItem {
		id: string;
		icon: IconName;
		/** Accessible name and hover text; should say what the state MEANS, not the icon. */
		label: string;
		/** Shown as a badge; 0 or absent shows none. */
		count?: number;
		/** Tone when lit. Defaults to the accent. */
		tone?: string;
		/** Lit at rest because the section carries something here. */
		lit?: boolean;
		/** Separated from the items above it by a rule — for an alarm, not a tool. */
		alarm?: boolean;
	}
</script>

<script lang="ts">
	// The rail docked to a section's right edge. It replaces a side panel: every icon
	// is about the thing it is attached to, so there is no "which section is the panel
	// showing" to hold in your head.
	//
	// Icons light for CONTENT, not for open state, so a document scanned at rest
	// already shows where its work is outstanding.
	import Icon from '../../icons/Icon.svelte';

	interface Props {
		items: DockItem[];
		/** The item whose panel is open under the section, if any. */
		open: string | null;
		ontoggle: (id: string) => void;
	}

	let { items, open, ontoggle }: Props = $props();

	function lit(tone: string) {
		return `color:${tone};border-color:color-mix(in srgb, ${tone} 45%, transparent);background:color-mix(in srgb, ${tone} 12%, transparent)`;
	}
</script>

<div class="flex w-[44px] flex-col items-center gap-1.5 py-1">
	{#each items as it (it.id)}
		{@const tone = it.tone ?? 'var(--accent)'}
		{@const on = open === it.id || !!it.lit || !!it.alarm}
		{#if it.alarm}
			<span class="h-px w-4 bg-[var(--border)]"></span>
		{/if}
		<button
			type="button"
			class="relative flex h-[26px] w-[26px] items-center justify-center rounded-[5px] border {on
				? ''
				: 'border-transparent text-[var(--fg-dim)] hover:border-[var(--border-strong)] hover:text-[var(--accent)]'}"
			style={on ? lit(tone) : ''}
			onclick={() => ontoggle(it.id)}
			aria-pressed={open === it.id}
			aria-label={it.label}
			title={it.label}
		>
			<Icon name={it.icon} size={13} />
			{#if it.count}
				<span
					class="absolute -top-1 -right-1 h-[13px] min-w-[13px] rounded-full px-[3px] text-center font-(family-name:--mono) text-[0.5rem] leading-[13px]"
					style:color="var(--bg)"
					style:background={tone}
				>
					{it.count}
				</span>
			{/if}
		</button>
	{/each}
</div>
