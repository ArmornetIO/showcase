<script lang="ts">
	// DevCog — the portable dev console.
	//
	// It used to be two floating surfaces: a flags popup and a QA drawer, which
	// covered each other and could not be read together. Feature flags and serve
	// mode now have a real home on the host's admin page, so the popup is gone
	// entirely and what remains is one console about THIS PAGE — its canvas, its
	// render tunables, its page actions, its captures, its frame cost.
	//
	// This file owns only what the surfaces share: whether the console is open,
	// the one nits controller, and the Escape ladder. Everything with markup of
	// its own lives in the folder it belongs to.
	//
	// The inspector is deliberately NOT owned by the console. It arms from the
	// cluster and outlives the panel, because the thing you need to click is
	// usually underneath where the panel would be.
	import { onMount, untrack } from 'svelte';
	import DevCogCluster from './DevCogCluster.svelte';
	import Console from './console/Console.svelte';
	import { ConsoleState } from './console/console-state.svelte.js';
	import { DEFAULT_CONSOLE_CONFIG, type ConsoleConfig, type ToolGroup } from './console/types.js';
	import { DEFAULT_NIT_CONFIG, type NitConfig } from './qa/nits.js';
	import { NitsController } from './qa/nits.svelte.js';
	import NitLayer from './qa/NitLayer.svelte';
	import CaptureGroup from './console/CaptureGroup.svelte';
	import BrowseGroup from './console/BrowseGroup.svelte';
	import { loadAppIndex, type AppEntry } from './console/browse.js';
	import { claimPage } from './presence.js';
	import PerfPanel from '../perf/PerfPanel.svelte';

	interface DevCogProps {
		/** Host tool groups, merged with the built-ins and ordered by `order`. */
		groups?: ToolGroup[];
		/** Where flags and serve mode live. No link when the host has none. */
		flagsHref?: string;
		/** Storage keys + AI-prompt branding. */
		nitConfig?: NitConfig;
		consoleConfig?: ConsoleConfig;
		/**
		 * Set only by the framework's own mount (standalone.ts). A host never
		 * passes it: an app's console claims the page, the injected one yields.
		 */
		injected?: boolean;
	}

	let {
		groups = [],
		flagsHref,
		nitConfig = DEFAULT_NIT_CONFIG,
		consoleConfig = DEFAULT_CONSOLE_CONFIG,
		injected = false
	}: DevCogProps = $props();

	// Both are keyed to a storage slot, so they are built once from the config
	// they mounted with — swapping keys mid-session would strand what is stored.
	const nits = new NitsController(untrack(() => nitConfig));
	// Not `state`: that identifier collides with the `$state` rune in a Svelte
	// component and the compiler reads it as a store.
	const consoleState = new ConsoleState(untrack(() => consoleConfig));

	/** Null until the framework's app index answers, and when it never does. */
	let apps = $state<AppEntry[] | null>(null);

	onMount(() => {
		nits.load();
		consoleState.load();
		loadAppIndex().then((a) => (apps = a));
		return untrack(() => injected) ? undefined : claimPage();
	});

	// Escape unwinds one layer at a time, innermost first: pending note, then the
	// inspector, then the console. The inspector comes BEFORE the console on
	// purpose — it outlives the panel, so any other order would leave the page
	// armed with nothing on screen saying so.
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (nits.escape()) return;
		if (consoleState.open) consoleState.setOpen(false);
	}
</script>

<svelte:window onkeydown={onKeydown} />

<DevCogCluster
	inspecting={nits.inspecting}
	captureCount={nits.count}
	consoleOpen={consoleState.open}
	onToggleInspect={() => nits.toggleInspect()}
	onToggleConsole={() => consoleState.setOpen(!consoleState.open)}
/>

<!-- The built-in groups. Declared here rather than in a registry module
     because a group body is a snippet, and a snippet only exists in markup. -->
{#snippet captureContent(n: NitsController)}
	<CaptureGroup nits={n} />
{/snippet}

{#snippet perfContent()}
	<PerfPanel />
{/snippet}

{#snippet browseContent()}
	<BrowseGroup apps={apps ?? []} />
{/snippet}

{#if consoleState.open}
	<!-- Closing the console does NOT disarm the inspector. That reversal is the
	     point of moving it to the cluster. -->
	<Console
		groups={[
			...groups,
			{
				id: 'capture',
				label: 'CAPTURE',
				glyph: '◎',
				order: 50,
				// The only group allowed to scroll: a batch of forty captures
				// cannot fit any viewport, and pretending otherwise would mean
				// dropping captures to satisfy a layout rule.
				scrolls: true,
				count: nits.count,
				content: captureContent
			},
			{ id: 'perf', label: 'PERF', glyph: '⌁', order: 60, content: perfContent },
			{
				id: 'browse',
				label: 'BROWSE',
				glyph: '⇄',
				order: 70,
				available: !!apps?.length,
				gate: 'This server publishes no app index.',
				content: browseContent
			}
		]}
		state={consoleState}
		{nits}
		{flagsHref}
		onClose={() => consoleState.setOpen(false)}
	/>
{/if}

<NitLayer {nits} annotate={consoleState.open} />
