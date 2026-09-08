<script lang="ts">
	// ── BREACH ───────────────────────────────────────────────────────────────────
	// The whole app. It owns three things and nothing else: a match, the layout
	// the HUD is arranged in, and which overlay is open. Every rule lives behind
	// `internal/`; every pixel lives in a component. This file is the wiring.
	import { onMount } from 'svelte';
	import { BreachMatch } from './internal/match.svelte.js';
	import BoardStage from './BoardStage.svelte';
	import CardFan from './CardFan.svelte';
	import Lobby from './Lobby.svelte';
	import { BreachLobby } from './internal/lobby.svelte.js';
	import type { Seated } from './internal/presence.js';
	import RulesOverlay from './RulesOverlay.svelte';
	import LogFeed from './hud/LogFeed.svelte';
	import ObjectiveLine from './hud/ObjectiveLine.svelte';
	import BuildingStack from './hud/BuildingStack.svelte';
	import GameEventsOverlay from './hud/GameEventsOverlay.svelte';
	import { TableSocket } from './net.svelte.js';
	import { openLocalTable } from './internal/local-table.js';
	// ── The HUD ──────────────────────────────────────────────────────────────
	// One state ladder, derived once here and passed down. Three surfaces each
	// calling the pure function would agree; passing it makes "they cannot
	// disagree" structural rather than merely true.
	import { hudState } from './hud/hud-state.js';
	import BattleCentre from './hud/BattleCentre.svelte';
	import TableStrip from './hud/TableStrip.svelte';
	import TopClock from './hud/TopClock.svelte';
	import LeadChange from './hud/LeadChange.svelte';
	import TurnVignette from './hud/TurnVignette.svelte';
	import TextScale from './hud/TextScale.svelte';
	import { hudScale } from './hud/hud-scale.svelte.js';

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

	// And LEAVING one is the server's decision too, which is what `new_match`
	// was missing: it sends the intent and the server drops the match and puts
	// the table back in its lobby, but a client that reset nothing stayed on the
	// finished board — with `stage` still `play`, so the effect above then
	// refused to enter the match that followed. Hung off the snapshot rather
	// than the click because the other three screens never made one.
	$effect(() => {
		const view = socket?.view;
		if (!view || view.phase !== 'setup' || match.stage === 'select') return;
		match.reset();
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
	/** How far the top cluster floats off the top edge — the `top-4` the column
	 *  is pinned at. Its HEIGHT is measured rather than constant: the table
	 *  strips grow a hover card, and the cluster is as tall as the taller of the
	 *  strips and the clock. */
	const TOP_EDGE = 16;
	/** The battle centre's height, in px. A CONSTANT rather than a measurement,
	 *  and that is the point: the card is deliberately fixed — nothing the match
	 *  does changes its height — so measuring it would reintroduce exactly the
	 *  movement the fixed height exists to stop. The felt is lifted by it and the
	 *  globe is inset past it from this one number, so the three cannot drift. */
	const PLAY_H = 76;
	/** How far the card floats off the bottom edge. Deliberately NOT zero: a
	 *  shape touching the frame is a shape welded to it, and the whole point is
	 *  that this reads as an object on the table rather than an edge of the
	 *  window. */
	const PLAY_GAP = 14;
	/** Card fan, in px. Matches the `h-[16.5rem]` the felt is drawn at. */
	const FELT_H = 264;

	// ── The floor scrim ──────────────────────────────────────────────────────
	// It has to reach the bottom EDGE of the window, and its stops are derived
	// rather than typed, for the same reason: the gradient was a child of the
	// felt, so its 0.88 stop landed `--play-block` above the floor and met
	// undarkened board there in a straight line the full width of the screen. A
	// scrim that terminates is a bar. Running it past the frame is what makes it
	// read as the board going dark toward the floor instead of a panel lying on
	// it — and deriving the stops keeps the profile OVER THE HAND exactly the one
	// it was tuned at, which is the part a taller box would otherwise stretch.
	const SCRIM_H = FELT_H + PLAY_H + PLAY_GAP * 2;
	const at = (px: number) => `${((px / SCRIM_H) * 100).toFixed(1)}%`;
	const SCRIM = `linear-gradient(to top,
		rgba(0,0,0,0.92) 0%,
		rgba(0,0,0,0.88) ${at(PLAY_H + PLAY_GAP * 2)},
		rgba(0,0,0,0.5) ${at(PLAY_H + PLAY_GAP * 2 + FELT_H * 0.45)},
		transparent 100%)`;

	let leftW = $state(0);
	let rightW = $state(0);
	let topH = $state(0);
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
					top: (topH > 0 ? TOP_EDGE + topH : TOP_EDGE) + GAP,
					right: rightW > 0 ? EDGE + rightW + GAP : 0,
					// The hand, and the battle centre under it. Both are fixed
					// heights, so this is the only place the two numbers have to agree.
					bottom: EDGE + FELT_H + PLAY_H + PLAY_GAP * 2,
					left: leftW > 0 ? EDGE + leftW + GAP : 0
				}
			: { top: TOP_EDGE + GAP }
	);

	// ── The "your turn" moment ───────────────────────────────────────────────
	// Fires ONCE per turn that is mine. Owned here rather than inside the two
	// surfaces it drives, so the wash and the plate cannot disagree about when
	// the moment is.
	//
	// Latched on WHICH TURN it is, not on a boolean. `busy` was in that boolean,
	// and `busy` falls at the end of every resolution — so the plate replayed the
	// arrival after each card, and worst of all after the LAST one, announcing
	// "your turn" into the 900ms gap before the out-of-AP effect ends it. Being
	// mid-turn is not a new turn. `round:phase` is, and both halves are kept
	// current on a networked table as well as a local one.
	//
	// `busy` no longer decides WHETHER the moment happens, only that it is not
	// happening right now: a turn can arrive while somebody else's resolution is
	// still playing out, and the ceremony belongs after that, not under it.
	//
	// Plain `let`, not `$state`: an effect that writes state it also reads is an
	// effect that re-runs itself, and this one only ever needs to remember which
	// turn it last announced.
	let arriving = $state(false);
	let vignette = $state(0);
	let announced: string | null = null;

	/** The wash at rest, held for the remainder of a turn that is mine. */
	const WASH_HELD = 0.18;
	/** The wash at the moment of arrival, before it settles to `WASH_HELD`. */
	const WASH_ARRIVAL = 0.35;

	$effect(() => {
		const mine = match.isMyTurn && match.stage === 'play' && !match.winner;
		if (!mine) {
			announced = null;
			arriving = false;
			vignette = 0;
			return;
		}
		const turn = `${match.round}:${match.phase}`;
		// Read before the latch so the effect re-runs when the resolution ends.
		if (match.busy) {
			// A resolution is on screen and the plate is not — but the wash is the
			// turn, not the moment, so it holds. Jumping it to the settled level
			// rather than leaving it wherever the ceremony got to is what stops a
			// card played inside the first second from freezing the arrival state:
			// the teardown below has just cancelled the timer that would have.
			arriving = false;
			if (announced === turn) vignette = WASH_HELD;
			return;
		}
		if (announced === turn) return;
		announced = turn;
		arriving = true;
		vignette = WASH_ARRIVAL;
		// The plate hands the space back to the sentence; the wash settles to a
		// level it holds for the rest of the turn. 1080ms of ceremony total —
		// under the ~1.2s at which a player starts hunting for the information
		// themselves.
		const drop = setTimeout(() => (arriving = false), 900);
		const settle = setTimeout(() => (vignette = WASH_HELD), 1080);
		return () => {
			clearTimeout(drop);
			clearTimeout(settle);
		};
	});

	/** One ladder, every surface. See `hud/hud-state.ts`. */
	const hud = $derived(hudState(match));

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
     felt sits exactly on top of the battle centre, and a pair of hard-coded rems
     that drift leave either a gap under the cards or a card drawn over them. -->
<div
	class="hud-type relative flex flex-col h-screen overflow-hidden text-[var(--fg)]"
	style:--hud-zoom={hudScale.value}
	style:--play-h="{PLAY_H}px"
	style:--play-gap="{PLAY_GAP}px"
	style:--play-block="{PLAY_H + PLAY_GAP * 2}px"
>
	<TurnVignette color={match.seat.color} level={vignette} />

	<div class="relative flex-1 min-h-0">
		<BoardStage {match} {insets} top={TOP_EDGE} />

		<!-- ── The scoreboard ────────────────────────────────────────────────────
		     Round, score and clock top centre, with the two sides either side of
		     it the way a fixture board has always drawn them. A single run of four
		     chips put an enemy next to your ally and made the split something you
		     had to read off the flags.

		     Measured rather than constant: the strips grow a hover card, so the
		     cluster is as tall as the taller of the two. -->
		<div
			bind:clientHeight={topH}
			class="hud-scaled flex flex-col items-center gap-2
			       xl:absolute xl:top-4 xl:left-1/2 xl:-translate-x-1/2 xl:z-[3]
			       xl:max-w-[min(96vw,62rem)]"
		>
			<div class="flex items-start gap-2">
				<TableStrip {match} faction="red" />
				<TopClock {match} state={hud} />
				<TableStrip {match} faction="blue" />
			</div>
		</div>

		<!-- ── The two rails are one width ───────────────────────────────────────
		     They were 250px and 340px. Nothing justified the 90px — the buildings
		     carry one more stat than a feed row, not a third more content — and it
		     cost twice: the right rail reached far enough in to sit under the seat
		     chips at the top of the screen, and two rails of different widths read
		     as a page that could not decide where its margins were. Same clamp
		     both sides; change it in both places or not at all. -->
		<!-- Left column: what has happened. -->
		<div
			bind:clientWidth={leftW}
			class="hud-scaled flex flex-col gap-3 xl:absolute xl:top-4 xl:bottom-7 xl:left-4 xl:z-[3]
			       xl:w-[clamp(220px,19vw,268px)] xl:pointer-events-none"
		>
			<!-- Above the feed rather than inside it: the log is fogged and derived
			     from rows this viewer can prove, and a lead is a fact about the board
			     that every seat can see. It leaves after a few seconds — the
			     scoreboard is the standing record. -->
			<LeadChange {match} />
			<!-- The feed takes what is left of the column and scrolls inside it, so a
			     long match cannot push the lead card off the top. -->
			<LogFeed {match} class="max-h-[40vh] xl:max-h-none flex-1 min-h-0" />
		</div>

		<!-- Right column: the objective ladder, and under it whatever just
		     happened. `overflow-x-clip` on the ladder rather than leaving it to
		     compute — setting only `overflow-y` forces the other axis to `auto`,
		     and any child that leans a pixel right grows a horizontal scrollbar. -->
		<div
			bind:clientWidth={rightW}
			class="hud-scaled flex flex-col gap-3 xl:absolute xl:top-4 xl:bottom-7 xl:right-4 xl:z-[3]
			       xl:w-[clamp(220px,19vw,268px)] xl:pointer-events-none"
		>
			<!-- Not `flex-1`: that made the ladder eat the column and pushed the two
			     strips below it to the floor, a screen away from what they are about.
			     It sizes to content and scrolls only if it outgrows the space, and the
			     spacer at the end takes whatever is left. -->
			<div class="flex min-h-0 shrink flex-col gap-3 xl:overflow-y-auto xl:overflow-x-clip">
				<BuildingStack {match} />
			</div>

			<!-- The objective, as a strip under the ladder it is about. It floated
			     top centre in a panel of its own, which put "take 4 more links" a
			     screen away from the four links. Same width as the buildings by
			     being IN the column, so the two stay in step without a shared
			     measurement. -->
			<!-- `min-w-0` + `overflow-x-clip`, and not for tidiness: the objective's
			     announcement state ("LINK TAKEN — <building>") is one nowrap line, and
			     a flex child defaults to `min-width: auto`, so it refuses to shrink
			     below its content and pushes itself off the right edge of the screen.
			     The buildings above cannot show it because they wrap. -->
			<div
				class="min-w-0 shrink-0 overflow-x-clip rounded-lg border border-[var(--border)]
				       bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_86%,transparent)]
				       px-2.5 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.4)] backdrop-blur-md"
			>
				<ObjectiveLine {match} />
			</div>

			<!-- The dice, under the buildings. This floated in its own region to the
			     LEFT of this column, because the column was full — the seat plate held
			     the bottom of it. That plate is in the battle centre now, so the
			     events land here instead of hovering over the board beside the thing
			     they are about. A resolution is always AT a building, and the building
			     it hit is in the ladder directly above. -->
			<div class="min-w-0 shrink-0 overflow-x-clip">
				<GameEventsOverlay {match} class="w-full" />
			</div>

			<span class="flex-1"></span>
		</div>

		<!-- ── The felt ──────────────────────────────────────────────────────────
		     The hand, and nothing else. Lifted off the floor by exactly the battle
		     centre's height, so the two are stacked rather than overlapping: the
		     card reads what the hand is doing, and a card drawn ON the cards it is
		     describing covers them.

		     Deliberately NOT `hud-scaled`. `CardFan` positions its drag ghost by
		     mixing client coordinates with layout offsets, and it already carries
		     a note about getting that wrong under an ancestor `zoom` — a second
		     zoom over it is how the card flies off toward the corner instead of
		     following the cursor. -->
		<!-- Under the felt AND under the battle centre, so the card sits on a
		     darkened base rather than on a seam. See `SCRIM` for why it is a
		     sibling of the hand instead of a child of it. -->
		<div
			class="absolute inset-x-0 bottom-0 z-[4] pointer-events-none"
			style:height="{SCRIM_H}px"
			style:background={SCRIM}
		></div>

		<div class="absolute inset-x-0 bottom-[var(--play-block)] z-[5] h-[16.5rem] pointer-events-none">
			<CardFan {match} class="h-full" />
		</div>

		<!-- ── The battle centre ─────────────────────────────────────────────────
		     Your seat and the move you are making, stacked and centred: who you
		     are on top, what you are about to do underneath.

		     They were in two different corners — the plate pinned bottom-right,
		     the bar bound between the rails — which meant the two things a player
		     uses on their own turn were the furthest apart on the board. Centred,
		     they are one object with one silhouette, and the rails go back to
		     being what they are: reference you consult, not controls you drive.

		     The socket and any refusal go INTO the card rather than floating
		     anywhere. It is already the "what is happening right now" surface, so
		     a dropped table is the same kind of sentence as whose turn it is —
		     which is why the two floating notices above the board are gone. -->
		<BattleCentre
			{match}
			state={hud}
			takeover={arriving}
			{socket}
			{refusal}
			onrules={() => (rulesOpen = true)}
			class="hud-scaled absolute bottom-[var(--play-gap)] left-1/2 z-[6]
			       w-[min(94vw,54rem)] -translate-x-1/2"
		/>

		<!-- Outside every `hud-scaled` subtree on purpose — a control that scales
		     itself is a control you cannot find your way back from. -->
		<TextScale class="pointer-events-auto absolute bottom-6 left-4 z-[7]" />
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

<style>
	/* ── The type, and why it was never heavy ────────────────────────────────────
	   Every label on this HUD asks for `font-mono` + `font-black`. Tailwind v4's
	   `font-mono` is the SYSTEM stack — SF Mono on a Mac — and SF Mono ships no
	   black. So the browser was quietly serving 600, or synthesising a smeared
	   bold, on the exact type that has to survive at 8px over a lit plate.

	   Two rules, in one place, rather than a `font-family` on two hundred spans:

	   1. Numerals stay MONOSPACED, on the real mono face, which does ship a 700.
	      Tabular figures are load-bearing here — a clock counting down and a score
	      changing must not reflow the plate they sit in.

	   2. WORDS — every uppercase label, name and verb — go to the UI face at 700.
	      It has an x-height built for small sizes. Orbitron would be heavier still
	      and is right where the game shouts (a title, a takeover); as a label face
	      at 8px it is exactly the arcade-first legibility trade this HUD keeps
	      losing. */
	.hud-type :global(.font-mono) {
		font-family: var(--mono);
	}

	.hud-type :global(.font-mono.uppercase.font-black) {
		font-family: var(--sans);
		font-weight: 700;
	}

	/* Applied per CLUSTER rather than once at the root: the rails are pinned to
	   their corners and the battle centre is centred on a translate, so each one
	   grows from where it is anchored instead of the whole HUD growing off the
	   left edge of the screen. */
	.hud-type :global(.hud-scaled) {
		zoom: var(--hud-zoom, 1);
	}
</style>
