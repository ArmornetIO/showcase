<script lang="ts">
	// DevCog — the portable dev toolbar. Two surfaces hang off one floating
	// cluster:
	//
	//   flags/  what this build is serving — feature flags, serve mode, perf
	//   qa/     what is wrong with this page — the element inspector and the
	//           nit batch, plus whatever page actions the host contributes
	//
	// This file owns only what both surfaces share: which panel is open, the
	// nits controller they both read, and the Escape ladder. Everything with
	// markup of its own lives in the domain folder it belongs to.
	import { onMount, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import DevCogCluster from './DevCogCluster.svelte';
	import type { FlagSnapshot } from './flags/engine.js';
	import FlagsPanel from './flags/FlagsPanel.svelte';
	import { DEFAULT_NIT_CONFIG, type NitConfig } from './qa/nits.js';
	import { NitsController } from './qa/nits.svelte.js';
	import NitLayer from './qa/NitLayer.svelte';
	import QaDrawer from './qa/QaDrawer.svelte';

	export type { FlagSnapshot };

	interface DevCogProps {
		snap: FlagSnapshot[];
		mode: string;
		modes?: readonly string[];
		flagLabel?: (key: string) => string | undefined;
		flagsHref?: string;
		onToggle: (key: string, enabled: boolean) => void;
		onModeChange: (mode: string) => void;
		showPerf?: boolean;
		qaContent?: Snippet;
		/** Storage key + AI-prompt branding for the nits tool. */
		nitConfig?: NitConfig;
	}

	let {
		snap,
		mode,
		modes = ['default'],
		flagLabel,
		flagsHref = '/admin/flags',
		onToggle,
		onModeChange,
		showPerf = false,
		qaContent,
		nitConfig = DEFAULT_NIT_CONFIG
	}: DevCogProps = $props();

	let flagsOpen = $state(false);
	let qaOpen = $state(false);

	// The batch is keyed to a storage slot, so the controller is built once from
	// the config it mounted with — a host swapping keys mid-session would strand
	// whatever is already captured.
	const nits = new NitsController(untrack(() => nitConfig));

	onMount(() => nits.load());

	function closeQa() {
		qaOpen = false;
		nits.stopInspect();
	}

	function toggleQa() {
		if (qaOpen) closeQa();
		else qaOpen = true;
	}

	// Escape unwinds one layer at a time, innermost first: pending note, then
	// the inspector, then the drawer, then the flags popup.
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (nits.escape()) return;
		if (qaOpen) {
			qaOpen = false;
			return;
		}
		if (flagsOpen) flagsOpen = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<DevCogCluster
	qaActive={qaOpen || nits.inspecting}
	qaCount={nits.count}
	{flagsOpen}
	onToggleQa={toggleQa}
	onToggleFlags={() => (flagsOpen = !flagsOpen)}
/>

{#if flagsOpen}
	<FlagsPanel
		{snap}
		{mode}
		{modes}
		{flagLabel}
		{flagsHref}
		{showPerf}
		{onToggle}
		{onModeChange}
		onClose={() => (flagsOpen = false)}
	/>
{/if}

{#if qaOpen}
	<QaDrawer {nits} content={qaContent} onClose={closeQa} />
{/if}

<NitLayer {nits} annotate={qaOpen} />
