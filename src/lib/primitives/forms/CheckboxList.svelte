<script lang="ts">
	// Multi-select list of options. The box itself lives in primitives/Checkbox —
	// this owns the options and the selection, not the look.
	//
	// Shift-click sets every option between the last box clicked and this one to
	// the state this one is moving to — the file-manager gesture. It goes through
	// `ontoggle` alone, once per option that changes, so a caller keeps its one
	// callback and gets ranges for free.
	import type { Snippet } from 'svelte';
	import Checkbox from './Checkbox.svelte';
	import type { ChoiceOption } from './choice.types.js';

	interface Props {
		options: ChoiceOption[];
		selected: string[];
		ontoggle: (v: string) => void;
		disabled?: boolean;
		indeterminate?: string[];
		/** What sits beside each box, when the label alone is not enough — a
		 *  swatch, a size. Defaults to the option's label. */
		row?: Snippet<[ChoiceOption]>;
	}

	let { options, selected, ontoggle, disabled = false, indeterminate = [], row }: Props = $props();

	let anchor = -1;

	function toggle(i: number, range: boolean) {
		const on = !selected.includes(options[i].value);
		if (range && anchor >= 0) {
			const [a, b] = anchor < i ? [anchor, i] : [i, anchor];
			for (const o of options.slice(a, b + 1)) if (selected.includes(o.value) !== on) ontoggle(o.value);
		} else ontoggle(options[i].value);
		anchor = i;
	}

	/**
	 * A shift-click is handled here, on the way down, and never reaches the box.
	 * Leaving it to the checkbox's own change event failed in two ways: a browser
	 * may not activate a label at all while Shift is held, and a row whose label
	 * holds its own button (a name you click to pick) swallowed the click. So
	 * any shift-click inside a row is the range, wherever it lands.
	 */
	function shiftClick(e: MouseEvent) {
		if (!e.shiftKey || disabled) return;
		const at = (e.target as Element).closest<HTMLElement>('[data-i]');
		if (!at) return;
		e.preventDefault();
		e.stopPropagation();
		toggle(Number(at.dataset.i), true);
	}
</script>

<div class="flex flex-col gap-[11px]" role="group" onclickcapture={shiftClick}>
	{#each options as opt, i (opt.value)}
		<div data-i={i}>
			<Checkbox
				checked={selected.includes(opt.value)}
				indeterminate={indeterminate.includes(opt.value)}
				{disabled}
				onchange={() => toggle(i, false)}
			>
				{#if row}{@render row(opt)}{:else}{opt.label}{/if}
			</Checkbox>
		</div>
	{/each}
</div>
