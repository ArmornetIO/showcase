<script lang="ts">
	// Inputs and controls. Every handler is a no-op: the builder previews the
	// control's appearance and states, it does not run a form.
	import Input from '../../primitives/forms/Input.svelte';
	import Textarea from '../../primitives/forms/Textarea.svelte';
	import SearchInput from '../../primitives/forms/SearchInput.svelte';
	import PasswordInput from '../../primitives/forms/PasswordInput.svelte';
	import ChipInput from '../../primitives/forms/ChipInput.svelte';
	import FileUpload from '../../primitives/forms/FileUpload.svelte';
	import Checkbox from '../../primitives/forms/Checkbox.svelte';
	import Toggle from '../../primitives/forms/Toggle.svelte';
	import SettingRow from '../../primitives/forms/SettingRow.svelte';
	import Select from '../../primitives/forms/Select.svelte';
	import type { SelectOption } from '../../primitives/forms/Select.svelte';
	import ViewToggle from '../../primitives/actions/ViewToggle.svelte';
	import type { ViewToggleOption } from '../../primitives/actions/ViewToggle.svelte';
	import MeshLayoutPicker from '../../mesh-studio/layout/MeshLayoutPicker.svelte';
	import type { MeshLayoutId } from '../../mesh-studio/layout/mesh-layout.js';
	import { accessors, options, parseJson } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s, b, n, e } = accessors(() => props);

	const selectOptions = $derived(
		parseJson<SelectOption[]>(props.options, [
			{ value: 'global', label: 'Global (all registries)' },
			{ value: 'npm', label: 'NPM' },
			{ value: 'go', label: 'Go Modules' },
			{ value: 'pip', label: 'PIP' }
		])
	);

	const viewToggleOptions = $derived(
		options(s('options', 'grid:Grid,list:List')) as ViewToggleOption[]
	);

	const chips = $derived(parseJson<string[]>(props.value, ['prod', 'api']));
</script>

{#if componentId === 'Input'}
	<Input placeholder={s('placeholder', 'Enter value…')} />

{:else if componentId === 'Textarea'}
	<Textarea placeholder={s('placeholder', 'Enter text…')} rows={n('rows', 4)} />

{:else if componentId === 'SearchInput'}
	<SearchInput value="" placeholder={s('placeholder', 'Search…')} />

{:else if componentId === 'PasswordInput'}
	<PasswordInput
		placeholder={s('placeholder', 'Enter password…')}
		size={e('size', 'md')}
		status={e('status', 'default')}
		disabled={b('disabled')}
	/>

{:else if componentId === 'ChipInput'}
	<ChipInput value={chips} placeholder={s('placeholder', 'Add tag…')} disabled={b('disabled')} />

{:else if componentId === 'FileUpload'}
	<FileUpload
		placeholder={s('placeholder', 'Drag & drop, paste, or click to browse')}
		accept={s('accept', '*')}
		filename={s('filename', '')}
		disabled={b('disabled')}
	/>

{:else if componentId === 'Checkbox'}
	<Checkbox
		checked={b('checked')}
		indeterminate={b('indeterminate')}
		disabled={b('disabled')}
		onchange={() => {}}
	>
		{s('__children', 'Enabled')}
	</Checkbox>

{:else if componentId === 'Toggle'}
	<Toggle checked={b('checked')} disabled={b('disabled')} label={s('label', '')} />

{:else if componentId === 'SettingRow'}
	<SettingRow
		title={s('title', 'Require MFA')}
		description={s('description', '')}
		checked={b('checked', true)}
		disabled={b('disabled')}
		onchange={() => {}}
	/>

{:else if componentId === 'Select'}
	<Select
		options={selectOptions}
		placeholder={s('placeholder', '') || undefined}
		disabled={b('disabled')}
	/>

{:else if componentId === 'ViewToggle'}
	<ViewToggle options={viewToggleOptions} value={s('value', 'grid')} onchange={() => {}} />

{:else if componentId === 'MeshLayoutPicker'}
	<MeshLayoutPicker
		value={e<MeshLayoutId>('value', 'grouped')}
		label={s('label', 'Arrangement')}
		columns={n('columns', 2)}
		onchange={() => {}}
	/>
{/if}
