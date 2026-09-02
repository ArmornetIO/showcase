<script lang="ts">
	// ── BREACH ───────────────────────────────────────────────────────────────────
	// The whole app. It owns three things and nothing else: a match, the layout
	// the HUD is arranged in, and which overlay is open. Every rule lives behind
	// `internal/`; every pixel lives in a component. This file is the wiring.
	import { onMount } from 'svelte';
	import { BreachMatch } from './internal/match.svelte.js';
	import BoardStage from './BoardStage.svelte';
	import CardFan from './CardFan.svelte';
	import HeroStack from './hud/HeroStack.svelte';
	import MyStats from './hud/MyStats.svelte';
	import Lobby from './Lobby.svelte';
	import { BreachLobby } from './internal/lobby.svelte.js';
	import type { Seated } from './internal/presence.js';
	import RulesOverlay from './RulesOverlay.svelte';
	import PlayTicker from './hud/PlayTicker.svelte';
	import ConnectionBanner from './hud/ConnectionBanner.svelte';
	import LogFeed from './hud/LogFeed.svelte';
	import ObjectiveLine from './hud/ObjectiveLine.svelte';
	import BuildingStack from './hud/BuildingStack.svelte';
	import RefusalNotice from './hud/RefusalNotice.svelte';
	import GameEventsOverlay from './hud/GameEventsOverlay.svelte';
	import { PlayerPresence } from './presence/index.js';
	import Ticker from './hud/Ticker.svelte';
	import { TableSocket } from './net.svelte.js';
	import { openLocalTable } from './internal/local-table.js';

	interface Props {
		/** Bring your own engine — for a host that wants to script or observe the
		 *  match. Omit and the component owns one. */
		match?: BreachMatch;
		/** Bring your own table. A networked host would construct this from the
		 *  session's real occupants; left alone it is a local table you fill
		 *  yourself. */
		lobby?: BreachLobby;
		/** Let a player get up mid-match and take a demonstrator's chair. A match
		 *  setting, so it is decided out here and never mid-game; ignored when a
		 *  `match` is supplied, which brought its own answer with it. */
		takeover?: boolean;
	}

	let {
		takeover = false,
		match = new BreachMatch({ takeover }),
		lobby = new BreachLobby()
	}: Props = $props();

	// ── The live table ───────────────────────────────────────────────────────
	// Owned here rather than in the lobby, because the BOARD needs it too. Null
	// for a local game, and everything below degrades to the single-player
	// behaviour this file has always had.
	let socket = $state<TableSocket | null>(null);

	/** The last thing the server said no to. Held here rather than read off the
	 *  socket: `lastError` is a latch that keeps its value until the next one,
	 *  and a refusal is worth saying once. */
	let refusal = $state<string | null>(null);

	function join(tableID: string) {
		const s = new TableSocket(tableID, {
			// The server threw the dice; this is where they land. The snapshot rides
			// in the same frame and is applied first, so the beats are a replay of
			// something that has already happened — which is why a client that
			// dropped this entirely was still correct, just silent.
			onEvent: (res) => void match.playResolution(res),
			// Connection-level faults are the banner's, and it reads them off the
			// socket itself. Everything else is the table declining something a
			// player asked for — which used to land nowhere at all, so a refused
			// move was indistinguishable from a board that had stopped working.
			onError: (code, message) => {
				if (code === 'unreachable' || code === 'evicted') return;
				refusal = message;
			}
		});
		s.connect();
		// From here the server decides. `remote` turns the three methods that
		// change the board into requests; the answers arrive as snapshots.
		match.remote = {
			commit: (cardKey, siteID) => s.commit(cardKey, siteID),
			endTurn: () => s.endTurn(),
			newMatch: () => s.newMatch()
		};
		socket = s;
	}

	// The seating, poured into the object the lobby already reads.
	$effect(() => {
		const view = socket?.view;
		if (view) lobby.applyRemote(view);
	});

	// Connecting is NOT sitting down any more.
	//
	// This used to grab the first open chair the moment the socket went live, on
	// the reasoning that a member holding no seat looks seated locally and then
	// gets `fill empty seats` dropped into the chair they appear to occupy. That
	// was the right fix for a lobby that put you at R1 before it had heard from
	// anybody — and it is exactly wrong now: the arrival's one decision is which
	// SIDE they are on, and a client that takes a chair on connect answers that
	// question for them before the screen has finished painting. What the player
	// sees is both sides flash and one of them get chosen for them.
	//
	// The bug it was written against is gone at the source: `BreachLobby` now
	// starts with no seat at all (`youSeatId` is `''`), so there is no phantom
	// chair for `fill_ai` to collide with. Sitting down is `TeamPicker` sending
	// `take_seat`, and nothing else does it.

	// Two chairs or four. The match cannot derive it — `phase` indexes the seats
	// in play — and only the lobby knows, so it is handed over here. A networked
	// table skips this: its size rides in on every snapshot, and the two would
	// otherwise fight over the same field.
	$effect(() => {
		if (socket) return;
		match.size = lobby.size;
	});

	// Who is holding which character, and whether it is a person at all. The
	// lobby knows and the match does not, so the mapping is handed over here,
	// where both objects are in scope. Keyed by character rather than by seat,
	// because that is what every presence renderer already has in its hand.
	//
	// Both tables, not just the networked one: a solo table is mostly
	// demonstrators, and it is the table that most needs to say so.
	$effect(() => {
		const view = socket?.view;
		const players: Record<string, Seated> = {};
		if (view) {
			for (const seat of view.lobby.seats) {
				if (!seat.klass_key || seat.occupant.kind === 'open') continue;
				players[seat.klass_key] = {
					name: seat.occupant.name ?? seat.id,
					kind: seat.occupant.kind
				};
			}
		} else {
			// Only while the lobby is the authority. Once the match is up, the
			// seating can change from inside it — a player takes a demonstrator's
			// chair — and copying the lobby over the top would put them back.
			if (match.stage !== 'select') return;
			for (const seat of lobby.seats) {
				if (!seat.klassKey || seat.occupant.kind === 'open') continue;
				players[seat.klassKey] = { name: seat.occupant.name, kind: seat.occupant.kind };
			}
		}
		match.players = players;
	});

	// Entering the match is the SERVER's decision — it flips to `playing` when
	// the host starts, and every client follows. Dealing this browser its hand is
	// not: each one runs its own `takeSeat`, which is what throws the cards out
	// of the dispenser one at a time.
	$effect(() => {
		const view = socket?.view;
		if (!view || view.phase !== 'playing' || match.stage !== 'select') return;
		const klassKey = view.lobby.seats.find((s) => s.id === view.your_seat)?.klass_key;
		if (klassKey) void match.takeSeat(klassKey);
	});

	// The board itself. Applied on every snapshot, so a move by anybody at the
	// table lands on everybody's screen.
	$effect(() => {
		const remote = socket?.view?.match;
		if (remote) match.applyRemote(remote);
	});

	let rulesOpen = $state(false);

	// ── HUD insets ───────────────────────────────────────────────────────────────
	// The globe is fitted around the chrome, never under it. Measured rather than
	// guessed, so a panel that grows does not start hiding buildings.
	const EDGE = 16;
	const GAP = 12;
	const TICKER_H = 40;
	const VERDICT_TOP = 56;
	/** The play ticker's height, in px. A CONSTANT rather than a measurement:
	 *  the bar is deliberately fixed at two rows — see PlayTicker — so measuring
	 *  it would only reintroduce the movement the fixed height exists to stop.
	 *  The felt is lifted by it and the globe is inset past it from this one
	 *  number, so the three cannot drift apart. */
	const PLAY_H = 52;
	/** How far the banner floats off the bottom edge. It is deliberately NOT
	 *  zero: a shape touching the frame is a shape welded to it, and the whole
	 *  point of the pointed ends is that this reads as an object on the table
	 *  rather than an edge of the window. */
	const PLAY_GAP = 14;
	/** Card fan, in px. Matches the `h-[16.5rem]` the felt is drawn at. */
	const FELT_H = 264;
	let leftW = $state(0);
	let rightW = $state(0);
	let verdictH = $state(0);
	let floating = $state(true);

	/**
	 * Sitting down.
	 *
	 * On a networked table the server is already the authority and this is just
	 * `takeSeat`. On a LOCAL one it now opens the rules module first and hands
	 * the match a port backed by it — so an offline game is hosted by
	 * `internal/breach` itself rather than by this directory's copy of it, and
	 * every board this file renders came from the same engine that will rule on
	 * it. See internal/local-table.ts for why that shape works at all.
	 *
	 * The fallback is not politeness. `breach-rules.wasm` is a build artifact and
	 * is gitignored, so a fresh clone that has not run `make build-breach-rules-wasm`
	 * has no module to load. Failing soft to the legacy resolver keeps the
	 * example's promise — that it opens with no backend and no build ceremony —
	 * while the module is what you get when it is there.
	 */
	async function enter(key: string) {
		if (!socket && !match.remote) {
			try {
				const { port } = await openLocalTable(match, { human: [key], seat: key });
				match.remote = port;
			} catch (err) {
				console.warn('breach: rules module unavailable, using the local resolver', err);
			}
		}
		await match.takeSeat(key);
	}

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
					// The hand, and the ticker under it. Both are fixed heights, so
					// this is the only place the two numbers have to agree.
					bottom: EDGE + FELT_H + PLAY_H + PLAY_GAP * 2,
					left: leftW > 0 ? EDGE + leftW + GAP : 0
				}
			: { top: TICKER_H + GAP }
	);

	// ── Aiming IS committing ─────────────────────────────────────────────────
	// Dragging a card onto a building has always resolved on release — see
	// `CardFan.endDrag`. Clicking did not: it armed a card, selected a target,
	// and then waited for a button, which made the click path one step longer
	// than the drag path for the same move. The button was the step.
	//
	// So a selection made WHILE a card is armed commits it. Guarded on the
	// selection having actually changed, not merely being set: arming a card
	// while a building happens to already be selected must not fire a move
	// nobody aimed.
	let aimedAt: string | null = null;
	$effect(() => {
		const id = match.selectedId;
		const changed = id !== aimedAt;
		aimedAt = id;
		if (!changed || !id) return;
		// `ready` is the engine's own gate — armed, legal, affordable, my turn,
		// not mid-resolution. Reading it here rather than re-deriving any part of
		// it is what keeps the two paths agreeing about what a legal move is.
		if (match.ready) match.resolve();
	});
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

<!-- `--play-h` is published here rather than written into two class strings: the
     felt sits exactly on top of the ticker, and a pair of hard-coded rems that
     drift leave either a gap under the cards or a bar drawn over them. -->
<div
	class="relative flex flex-col h-screen overflow-hidden text-[var(--fg)]"
	style:--play-h="{PLAY_H}px"
	style:--play-gap="{PLAY_GAP}px"
	style:--play-block="{PLAY_H + PLAY_GAP * 2}px"
>
	<div class="relative flex-1 min-h-0">
		<Ticker {match} onrules={() => (rulesOpen = true)} />

		<BoardStage {match} {insets} top={TICKER_H} />

		<!-- The objective, and above it whatever the connection has to say.
		     Stacked in one measured column rather than floated separately: the
		     banner is mounted HERE, outside the lobby, because the lobby
		     unmounts when the match starts and a connection lost mid-match is
		     precisely when nothing else on screen will admit it. Sharing the
		     column means `verdictH` already accounts for it, so the globe's
		     insets move out of its way for free. -->
		<div
			bind:clientHeight={verdictH}
			class="flex flex-col items-center gap-2
			       xl:absolute xl:top-14 xl:left-1/2 xl:-translate-x-1/2 xl:z-[3]
			       xl:max-w-[min(92vw,54rem)]"
		>
			<ConnectionBanner {socket} />
			<RefusalNotice message={refusal} onexpire={() => (refusal = null)} />

			<div
				class="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_86%,transparent)]
				       backdrop-blur-md shadow-[0_8px_28px_rgba(0,0,0,0.4)] px-3 py-1.5
				       xl:flex-nowrap xl:whitespace-nowrap"
			>
				<ObjectiveLine {match} />
			</div>
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
			<!-- The panel-surface half of PlayerPresence: the roster mode is the
			     old table panel, now one of six answers to "who else is here". The
			     board-surface half mounts over the canvas, not in this column. -->
			<HeroStack {match} />
			<!-- The feed takes what is left of the column and scrolls inside it, so a
			     long match cannot push the seats off the top. -->
			<LogFeed {match} class="max-h-[40vh] xl:max-h-none flex-1 min-h-0" />
		</div>

		<!-- ── Game events ───────────────────────────────────────────────────────
		     Its own region, immediately left of the buildings column. Anchored off
		     the SAME width expression the right column uses rather than a measured
		     number: the two are adjacent by construction, so a change to one cannot
		     leave a gap or an overlap next to the other.
		     Top-aligned and unbounded downward — an event sizes itself and the
		     region is empty the rest of the time. -->
		<div
			class="hidden xl:absolute xl:top-14 xl:z-[4] xl:flex xl:w-[clamp(240px,22vw,320px)]
			       xl:right-[calc(clamp(260px,25vw,340px)+2rem)] xl:pointer-events-none"
		>
			<GameEventsOverlay {match} class="w-full" />
		</div>

		<!-- Right column: the objective, and the sheet for whatever is picked. -->
		<div
			bind:clientWidth={rightW}
			class="flex flex-col gap-3 xl:absolute xl:top-14 xl:bottom-[6.5rem] xl:right-4 xl:z-[3]
			       xl:w-[clamp(260px,25vw,340px)] xl:pointer-events-none"
		>
			<!-- One panel where the ladder and the target sheet used to be. They
			     answered half a question each: the ladder knew which rungs were
			     held and nothing about their condition, the sheet knew everything
			     about whichever ONE building you last clicked. -->
			<div class="flex min-h-0 flex-1 flex-col gap-3 xl:overflow-y-auto xl:overflow-x-clip">
				<BuildingStack {match} />
			</div>
			<!-- My own seat, pinned to the bottom of the column. `shrink-0` because
			     it is where the numbers you spend live: a ladder scrolled by a notch
			     still reads, a hero power sliced off the bottom edge does not. -->
			<div class="shrink-0"><MyStats {match} /></div>
		</div>

		<!-- ── The felt ──────────────────────────────────────────────────────────
		     The hand, and nothing else now. `split` used to open a gap in the
		     middle of the arc for the dais to stand in — with the dais moved to
		     the corner that gap is a hole in the hand, so the fan closes up.

		     Lifted off the floor by exactly the ticker's height, so the two are
		     stacked rather than overlapping: the bar reads what the hand is
		     doing, and a bar drawn ON the cards it is describing covers them. -->
		<div class="absolute inset-x-0 bottom-[var(--play-block)] z-[5] h-[16.5rem] pointer-events-none">
			<div
				class="absolute inset-x-0 bottom-0 h-full"
				style:background="linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 45%, transparent 100%)"
			></div>

			<CardFan {match} class="h-full" />
		</div>

		<!-- ── The play ticker ───────────────────────────────────────────────────
		     The floor of the screen, and the only panel down here now. It is
		     always mounted and always the same height — see PlayTicker for why
		     that is the whole point — so nothing above it ever moves because of
		     it. Above the felt's gradient so its text stays legible, and
		     pointer-enabled for the one button it carries. -->
		<PlayTicker
			{match}
			class="absolute bottom-[var(--play-gap)] left-1/2 z-[6] h-[var(--play-h)]
			       w-[min(94vw,52rem)] -translate-x-1/2"
		/>
	</div>
</div>

{#if rulesOpen}
	<RulesOverlay seat={match.seat} onclose={() => (rulesOpen = false)} />
{/if}

<!-- The table assembles before the match does. The lobby owns who is here and
     which character they were issued; the match only ever hears the answer. -->
{#if match.stage === 'select'}
	<Lobby
		{lobby}
		{socket}
		onjoin={join}
		onenter={(key) => void enter(key)}
		takeover={match.takeover}
		ontakeover={(v) => (match.takeover = v)}
	/>
{/if}
