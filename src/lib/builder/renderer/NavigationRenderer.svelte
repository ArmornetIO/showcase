<script lang="ts">
	// Navigation surfaces. Nothing here navigates — `isActive` is stubbed false
	// so the preview shows the resting state rather than the current route.
	import SidebarNav from '$lib/navigation/SidebarNav.svelte';
	import type { NavSection } from '$lib/navigation/SidebarNav.svelte';
	import Breadcrumbs from '$lib/navigation/Breadcrumbs.svelte';
	import type { BreadcrumbItem } from '$lib/navigation/Breadcrumbs.svelte';
	import EcoTabBar from '$lib/primitives/chrome/EcoTabBar.svelte';
	import type { EcoTab } from '$lib/primitives/chrome/EcoTabBar.svelte';
	import { accessors, parseJson } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s } = accessors(() => props);

	const sections = $derived(
		parseJson<NavSection[]>(props.sections, [
			{
				title: 'Main',
				items: [
					{ label: 'Dashboard', href: '/', icon: 'home' },
					{ label: 'Docs', href: '/docs', icon: 'file-text' }
				]
			}
		])
	);

	const crumbs = $derived(
		parseJson<BreadcrumbItem[]>(props.items, [
			{ label: 'Dashboard', href: '/' },
			{ label: 'Vendors', href: '/vendors' },
			{ label: 'Armornet' }
		])
	);

	const ecoTabs = $derived(
		parseJson<EcoTab[]>(props.tabs, [{ id: 'all' }, { id: 'npm', name: 'npm', mode: '3/5 active' }])
	);
</script>

{#if componentId === 'SidebarNav'}
	<SidebarNav {sections} isActive={() => false} />

{:else if componentId === 'Breadcrumbs'}
	<Breadcrumbs items={crumbs} separator={s('separator', '/')} />

{:else if componentId === 'EcoTabBar'}
	<EcoTabBar tabs={ecoTabs} active={s('active', 'all')} onchange={() => {}} />
{/if}
