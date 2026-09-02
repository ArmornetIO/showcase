<script lang="ts">
	// Multi-select list of assessment options. The box itself lives in
	// primitives/Checkbox — this owns the options and the selection, not the look.
	import Checkbox from './Checkbox.svelte';
	import type { ChoiceOption } from './choice.types.js';

	interface Props {
		options: ChoiceOption[];
		selected: string[];
		ontoggle: (v: string) => void;
		disabled?: boolean;
		indeterminate?: string[];
	}

	let { options, selected, ontoggle, disabled = false, indeterminate = [] }: Props = $props();
</script>

<div class="flex flex-col gap-[11px]">
	{#each options as opt (opt.value)}
		<Checkbox
			checked={selected.includes(opt.value)}
			indeterminate={indeterminate.includes(opt.value)}
			{disabled}
			onchange={() => ontoggle(opt.value)}
		>
			{opt.label}
		</Checkbox>
	{/each}
</div>
