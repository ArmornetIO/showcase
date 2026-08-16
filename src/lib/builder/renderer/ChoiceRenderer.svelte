<script lang="ts">
	// The choice controls — one pick, many picks, or a segmented row.
	// Replaces the old AssessmentRenderer: the vendor-assessment widgets it also
	// drew now live in app-ui, and these three are generic form controls.
	import SegmentGroup from '$lib/primitives/actions/SegmentGroup.svelte';
	import RadioList from '$lib/primitives/forms/RadioList.svelte';
	import CheckboxList from '$lib/primitives/forms/CheckboxList.svelte';
	import type { ChoiceOption } from '$lib/primitives/forms/choice.types.js';
	import { accessors, parseJson } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s } = accessors(() => props);

	const options = $derived(
		parseJson<ChoiceOption[]>(props.options, [
			{ value: 'soc2', label: 'SOC 2 Type II' },
			{ value: 'iso27001', label: 'ISO 27001' },
			{ value: 'hipaa', label: 'HIPAA' }
		])
	);
	const selected = $derived(parseJson<string[]>(props.selected, []));

	// The builder canvas is a preview, not a form — selection is driven by the
	// props panel, so the controls' change handlers have nothing to do here.
	const noop = () => {};
</script>

{#if componentId === 'SegmentGroup'}
	<SegmentGroup {options} value={s('value', '')} onchange={noop} />
{:else if componentId === 'RadioList'}
	<RadioList {options} value={s('value', '')} onchange={noop} name="registry-preview" />
{:else if componentId === 'CheckboxList'}
	<CheckboxList {options} {selected} ontoggle={noop} />
{/if}
