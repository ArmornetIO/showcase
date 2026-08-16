<script lang="ts">
	// Containers and chrome. The two that take children (Panel, and anything
	// with a header snippet) render a `__children` string rather than nesting
	// real canvas items — the builder has no nesting model.
	import Panel from '$lib/primitives/chrome/Panel.svelte';
	import Tabs from '$lib/navigation/Tabs.svelte';
	import type { Tab } from '$lib/navigation/Tabs.svelte';
	import LayoutHeader from '$lib/primitives/chrome/LayoutHeader.svelte';
	import ActionBar from '$lib/primitives/actions/ActionBar.svelte';
	import type { ActionBarAction } from '$lib/primitives/actions/ActionBar.svelte';
	import IconToolbar from '$lib/layout/IconToolbar.svelte';
	import { accessors, parseJson } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s, e } = accessors(() => props);

	const tabs = $derived(
		parseJson<Tab[]>(props.tabs, [
			{ id: 'overview', label: 'Overview' },
			{ id: 'logs', label: 'Logs' },
			{ id: 'config', label: 'Config' }
		])
	);

	const actions = $derived(
		parseJson<Array<{ label: string; variant?: string }>>(props.actions, [
			{ label: 'Save', variant: 'primary' },
			{ label: 'Cancel', variant: 'ghost' }
		])
	);

</script>

{#if componentId === 'Panel'}
	<Panel>
		{#snippet header()}
			<span class="panel-header">{s('__header', 'Panel Title')}</span>
		{/snippet}
		<p class="panel-body">{s('__children', 'Panel body content.')}</p>
	</Panel>

{:else if componentId === 'Tabs'}
	<Tabs {tabs} active={s('active', tabs[0]?.id ?? 'overview')} />

{:else if componentId === 'LayoutHeader'}
	<LayoutHeader eyebrow={s('eyebrow', '// vendor management')} />

{:else if componentId === 'ActionBar'}
	<ActionBar
		actions={actions.map((a) => ({
			label: a.label,
			variant: (a.variant as ActionBarAction['variant']) ?? 'ghost',
			onclick: () => {}
		}))}
	/>

{:else if componentId === 'IconToolbar'}
	<IconToolbar
		items={[
			{ icon: 'users', label: 'Assignees', onclick: () => {} },
			{ icon: 'shield-check', label: 'Frameworks', onclick: () => {} },
			{ divider: true },
			{ icon: 'share-2', label: 'Share', onclick: () => {} },
			{ icon: 'download', label: 'Export', onclick: () => {} }
		]}
		orientation={e('orientation', 'vertical')}
	/>
{/if}

<style>
	.panel-header {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}

	.panel-body {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--fg-dim);
		margin: 0;
		white-space: pre-wrap;
	}
</style>
