<script lang="ts">
	// A game scene's dev tools in one mount: the DevCog carrying the GAME group,
	// and the frame HUD while `gameDev.fps` is on.
	//
	// For an app that has no DevCog of its own (BREACH): mounting one hands the
	// page from the injected framework console to this one (`devcog/presence`),
	// which is the only way a host group like GAME can render. The HUD is a
	// dynamic import so a session that never turns it on never downloads it —
	// the reason the barrel does not export it.
	//
	// The caller decides whether this is a dev session; nothing here checks.
	// `extra` is the game's own dev controls (Insider Threat's lighting cues),
	// under the shared ones in the same group, so none of it sits on screen.
	import type { Snippet } from 'svelte';
	import DevCog from '../devcog/DevCog.svelte';
	import ControlRow from '../devcog/controls/ControlRow.svelte';
	import GameDevControls from './GameDevControls.svelte';
	import { gameDev } from './game-dev.svelte.js';

	interface Props {
		extra?: { label: string; content: Snippet };
	}
	let { extra }: Props = $props();
</script>

{#snippet gameGroup()}
	<GameDevControls />
	{#if extra}
		<ControlRow label={extra.label} />
		{@render extra.content()}
	{/if}
{/snippet}

<DevCog
	groups={[
		{
			id: 'game',
			label: 'GAME',
			glyph: '◬',
			order: 40,
			available: gameDev.scenes.length > 0,
			gate: 'Needs a game scene on the page.',
			content: gameGroup
		}
	]}
/>

{#if gameDev.fps}
	{#await import('../perf/PerfHud.svelte') then { default: PerfHud }}
		<PerfHud onClose={() => (gameDev.fps = false)} />
	{/await}
{/if}
