<script lang="ts" module>
	export interface DocSegment {
		value: string;
		label: string;
		/** Hover text — for a choice whose label is shorter than its meaning. */
		hint?: string;
	}
</script>

<script lang="ts">
	// A quiet segmented switch for a document toolbar. One outline around the set
	// rather than a border per button: switching view is a glance-level act, not a
	// decision, so it does not get SegmentGroup's form-sized control.
	interface Props {
		options: DocSegment[];
		value: string;
		onchange: (value: string) => void;
		/** Names the group for assistive tech — the toolbar has more than one. */
		label: string;
	}

	let { options, value, onchange, label }: Props = $props();
</script>

<div
	class="flex items-center overflow-hidden rounded-[5px] border border-[var(--border)] font-(family-name:--mono)"
	role="group"
	aria-label={label}
>
	{#each options as o (o.value)}
		<button
			type="button"
			class="px-2 py-[3px] text-[0.6rem] transition-colors {value === o.value
				? 'bg-[var(--accent-faint)] text-[var(--accent)]'
				: 'text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
			title={o.hint}
			aria-pressed={value === o.value}
			onclick={() => onchange(o.value)}
		>
			{o.label}
		</button>
	{/each}
</div>
