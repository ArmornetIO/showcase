<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		options: Option[];
		value: string;
		onchange: (v: string) => void;
		disabled?: boolean;
	}

	let { options, value, onchange, disabled = false }: Props = $props();
</script>

<!--
	flex-wrap lets the buttons drop to a second row when the parent is too
	narrow to hold them inline. max-w-full + min-w-0 keep the group from
	forcing horizontal page scroll inside flex/grid items without explicit width.
-->
<div class="flex flex-wrap max-w-full min-w-0" role="group">
	{#each options as opt, i (opt.value)}
		{@const isFirst = i === 0}
		{@const isLast = i === options.length - 1}
		{@const isSelected = value === opt.value}
		<button
			type="button"
			class="px-4 py-[0.4rem] font-[var(--mono)] text-[0.78rem] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)] transition-[background,color,border-color] duration-[0.12s]
				{isFirst ? 'rounded-l-[5px]' : ''}
				{isLast ? 'rounded-r-[5px]' : '-mr-px'}
				{disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
				{isSelected
				? 'bg-[var(--accent-faint)] !border-[var(--accent)] text-[var(--accent)] relative z-[1]'
				: (!disabled ? 'hover:bg-[var(--surface-raised)]' : '')}"
			disabled={disabled}
			onclick={() => { if (!disabled) onchange(opt.value); }}
		>
			{opt.label}
		</button>
	{/each}
</div>
