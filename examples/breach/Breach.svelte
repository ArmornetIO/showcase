<script lang="ts">
	// ── BREACH ───────────────────────────────────────────────────────────────────
	// The whole app. It owns three things and nothing else: a match, the layout
	// the HUD is arranged in, and which overlay is open. Every rule lives behind
	// `internal/`; every pixel lives in a component. This file is the wiring.
	import { onMount } from 'svelte';
	import { BreachMatch } from './internal/match.svelte.js';
	import BoardStage from './BoardStage.svelte';
	import CardFan from './CardFan.svelte';
	import HeroDais from './HeroDais.svelte';
	import Lobby from './Lobby.svelte';
	import { BreachLobby } from './internal/lobby.svelte.js';
	import RulesOverlay from './RulesOverlay.svelte';
	import ActionBar from './hud/ActionBar.svelte';
	import CardDetail from './hud/CardDetail.svelte';
	import LogPanel from './hud/LogPanel.svelte';
	import ObjectiveLine from './hud/ObjectiveLine.svelte';
	import PathLadder from './hud/PathLadder.svelte';
	import TablePanel from './hud/TablePanel.svelte';
	import TargetSheet from './hud/TargetSheet.svelte';
	import Ticker from './hud/Ticker.svelte';

	interface Props {
		/** Bring your own engine — for a host that wants to script or observe the
		 *  match. Omit and the component owns one. */
		match?: BreachMatch;
		/** Bring your own table. A networked host would construct this from the
		 *  session's real occupants; left alone it is a local table you fill
		 *  yourself. */
		lobby?: BreachLobby;
	}

	let { match = new BreachMatch(), lobby = new BreachLobby() }: Props = $props();

	let rulesOpen = $state(false);

	// ── HUD insets ───────────────────────────────────────────────────────────────
	// The globe is fitted around the chrome, never under it. Measured rather than
	// guessed, so a panel that grows does not start hiding buildings.
	const EDGE = 16;
	const GAP = 12;
	const TICKER_H = 40;
	const VERDICT_TOP = 56;
	let leftW = $state(0);
	let rightW = $state(0);
	let verdictH = $state(0);
	let floating = $state(true);

	onMount(() => match.start());

	$effect(() => {
		const mq = window.matchMedia('(min-width: 1280px)');
		floating = mq.matches;
		const on = (e: MediaQueryListEvent) => (floating = e.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});

	const insets = $derived(
		floating
			? {
					top: (verdictH > 0 ? VERDICT_TOP + verdictH : TICKER_H) + GAP,
					right: rightW > 0 ? EDGE + rightW + GAP : 0,
					// Action bar plus the card sheet that stacks on top of it.
					bottom: EDGE + 320,
					left: leftW > 0 ? EDGE + leftW + GAP : 0
				}
			: { top: TICKER_H + GAP }
	);
</script>

<!-- Escape belongs to the window, not to whichever panel happens to hold focus.
     It clears whatever is open, outermost first. -->
<svelte:window
	onkeydown={(e) => {
		if (e.key !== 'Escape') return;
		if (rulesOpen) rulesOpen = false;
		else if (match.inspectKey) match.inspectKey = null;
		else if (match.selectedId) match.selectedId = null;
	}}
/>

<div class="relative flex flex-col h-screen overflow-hidden text-[var(--fg)]">
	<div class="relative flex-1 min-h-0">
		<Ticker {match} onrules={() => (rulesOpen = true)} />

		<BoardStage {match} {insets} top={TICKER_H} />

		<div
			bind:clientHeight={verdictH}
			class="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_86%,transparent)]
			       backdrop-blur-md shadow-[0_8px_28px_rgba(0,0,0,0.4)] px-3 py-1.5
			       xl:absolute xl:top-14 xl:left-1/2 xl:-translate-x-1/2 xl:z-[3]
			       xl:max-w-[min(92vw,54rem)] xl:flex-nowrap xl:whitespace-nowrap"
		>
			<ObjectiveLine {match} />
		</div>

		<!-- Left column. Who YOU are is not here any more — that is the dais, in
		     the middle, where you are already looking. What is left is the two
		     questions the middle cannot answer: who else is at this table, and
		     what has happened. -->
		<div
			bind:clientWidth={leftW}
			class="flex flex-col gap-3 xl:absolute xl:top-14 xl:bottom-[6.5rem] xl:left-4 xl:z-[3]
			       xl:w-[clamp(210px,18vw,250px)] xl:pointer-events-none"
		>
			<TablePanel {match} />
			<LogPanel {match} class="max-h-[40vh] xl:max-h-none flex-1 min-h-0" />
		</div>

		<!-- Right column: the objective, and the sheet for whatever is picked. -->
		<div
			bind:clientWidth={rightW}
			class="flex flex-col gap-3 xl:absolute xl:top-14 xl:bottom-[6.5rem] xl:right-4 xl:z-[3]
			       xl:w-[clamp(260px,25vw,340px)] xl:pointer-events-none"
		>
			<PathLadder {match} />
			<TargetSheet {match} onclose={() => (match.selectedId = null)} />
		</div>

		<CardDetail
			{match}
			class="absolute bottom-[20.5rem] left-1/2 -translate-x-1/2 z-[6] w-[min(94vw,40rem)]"
		/>

		<ActionBar
			{match}
			class="absolute bottom-[16.75rem] left-1/2 -translate-x-1/2 z-[6] w-[min(94vw,44rem)]
			       rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_86%,transparent)]
			       backdrop-blur-md shadow-[0_8px_28px_rgba(0,0,0,0.4)] px-3 py-2 pointer-events-auto"
		/>

		<!-- ── The felt ──────────────────────────────────────────────────────────
		     You in the middle, the hand fanning out either side of you with the
		     portrait as the keystone of the arc. `split` opens the gap; the
		     character stands in it. -->
		<div class="absolute inset-x-0 bottom-0 z-[5] h-[16.5rem] pointer-events-none">
			<div
				class="absolute inset-x-0 bottom-0 h-full"
				style:background="linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 45%, transparent 100%)"
			></div>

			<CardFan {match} split={0.78} class="h-full" />

			<div class="absolute left-1/2 bottom-3 -translate-x-1/2">
				<HeroDais {match} />
			</div>
		</div>
	</div>
</div>

{#if rulesOpen}
	<RulesOverlay seat={match.seat} onclose={() => (rulesOpen = false)} />
{/if}

<!-- The table assembles before the match does. The lobby owns who is here and
     which character they were issued; the match only ever hears the answer. -->
{#if match.stage === 'select'}
	<Lobby {lobby} onstart={(klassKey) => void match.takeSeat(klassKey)} />
{/if}
