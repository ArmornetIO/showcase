<script lang="ts">
	// ── BREACH ───────────────────────────────────────────────────────────────────
	// The whole app. It owns three things and nothing else: a match, the layout
	// the HUD is arranged in, and which overlay is open. Every rule lives behind
	// `internal/`; every pixel lives in a component. This file is the wiring.
	import { onMount, untrack } from 'svelte';
	import { BreachMatch } from './internal/match.svelte.js';
	import BoardStage from './BoardStage.svelte';
	import CardFan from './CardFan.svelte';
	import Lobby from './Lobby.svelte';
	import InsiderThreat from './InsiderThreat.svelte';
	import type { Refusal } from './insider/OfficeHud.svelte';
	import { BreachLobby } from './internal/lobby.svelte.js';
	import type { Seated } from './internal/presence.js';
	import RulesOverlay from './RulesOverlay.svelte';
	import MatchOver from './hud/MatchOver.svelte';
	import LogFeed from './hud/LogFeed.svelte';
	import ObjectiveLine from './hud/ObjectiveLine.svelte';
	import BuildingStack from './hud/BuildingStack.svelte';
	import GameEventsOverlay from './hud/GameEventsOverlay.svelte';
	import { TableSocket } from './net.svelte.js';
	import { stampTableLink } from './api.js';
	import { resolve } from './internal/appearance.js';
	import { openLocalTable } from './internal/local-table.js';
	import { LocalOffice } from './internal/local-office.svelte.js';
	import { Simulation, recordDressed, recordReactions, simRecord } from './internal/sim.svelte.js';
	import { klassByKey, seatOrder } from './internal/rules.js';
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
	import GameMenu from './hud/GameMenu.svelte';
	import { Button } from 'showcase';
	import { hudScale } from './hud/hud-scale.svelte.js';

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

	// ── The live table ───────────────────────────────────────────────────────
	// Owned here rather than in the lobby, because the BOARD needs it too. Null
	// for a local game, and everything below degrades to the single-player
	// behaviour this file has always had.
	let socket = $state<TableSocket | null>(null);

	/** The last thing the server said no to. Held here rather than read off the
	 *  socket: `lastError` is a latch that keeps its value until the next one,
	 *  and a refusal is worth saying once. */
	let refusal = $state<string | null>(null);
	/** The same, stamped, for the office: it says each refusal under the
	 *  crosshair, so two identical ones in a row are two. */
	let officeRefusal = $state<Refusal | null>(null);

	// The HUD draws the person in each chair, not the role's stock build — and
	// only the lobby knows who that is and what they are wearing.
	// Assigned once, on purpose: figureOf is a plain field the HUD reads while
	// rendering, so it must exist before the first frame — an $effect would set
	// it after. `match` is never swapped for another instance.
	// svelte-ignore state_referenced_locally
	match.figureOf = (klassKey) => {
		const seat = lobby.seats.find((s) => s.klassKey === klassKey);
		if (!seat) return null;
		const name = seat.occupant.kind === 'open' ? 'Open' : seat.occupant.name;
		return resolve(lobby.lookAt(seat.id), { key: seat.id, name }, seat.klassKey, seat.side);
	};

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
				officeRefusal = { text: message, at: performance.now() };
			}
		});
		s.connect();
		stampTableLink(tableID);
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

	// A scripted table's autopilot, in a dev session only (internal/sim.svelte.ts).
	let sim = $state<Simulation | null>(null);
	$effect(() => {
		const s = socket;
		if (!s || !simRecord) return;
		const run = new Simulation(s);
		sim = run;
		void run.find();
		const beat = setInterval(() => run.step(match.isMyTurn && match.stage === 'play' && !match.winner), 500);
		return () => clearInterval(beat);
	});
	$effect(() => recordReactions(socket?.reactions ?? []));

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
		if (!klassKey) return;
		if (view.config.variant === 'insider_threat') match.enterOffice(klassKey);
		else void match.takeSeat(klassKey);
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

	// ── The end of the match ─────────────────────────────────────────────────
	// Opened by the match ending rather than by a click, and closable — the final
	// board is worth looking at, and the rail keeps a way back to the screen.
	//
	// `overSeen` is a PLAIN let: this effect writes `resultOpen`, and a reactive
	// latch read here would subscribe it to its own output (see ObjectiveLine for
	// the same note and the crash it prevents).
	let resultOpen = $state(false);
	let overSeen = false;
	$effect(() => {
		const won = !!match.winner;
		if (won === overSeen) return;
		overSeen = won;
		resultOpen = won;
	});

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

	// ── The hand, on a hand-sized screen ─────────────────────────────────────
	// A card is a fixed 136×188 and the fan spaces them 132 apart, so the hand is
	// 556px wide at EVERY window width — measured identical on a 1440 desktop and
	// a 375 phone, where it ran from x=-90 to x=465 and threw two of four cards
	// off the edges. The fan cannot reflow (it is an arc, not a row), so on a
	// narrow window it is scaled and tightened instead.
	//
	// `zoom` rather than `transform: scale`, and that is load-bearing: `CardFan`
	// places its drag ghost through `cssZoom()`, which reads `currentCSSZoom`.
	// A transform is invisible to it and the dragged card would fly off toward
	// the corner instead of following the finger.
	const COMPACT_ZOOM = 0.78;
	/** Centre-to-centre, compact. Tighter than `spread`'s 132 so a seven-card
	 *  hand still lands inside 375px once the zoom is applied: 6×54+136 = 460,
	 *  scaled to 359. The cards overlap, which is what a held hand looks like —
	 *  the lifted one comes forward and is read on its own. */
	const COMPACT_SPREAD = 54;
	const COMPACT_FELT_H = Math.round(FELT_H * COMPACT_ZOOM);

	/** Nothing stands in the top-left any more: the tactical rail is two buttons
	 *  lying flat above the hand when compact, not a nine-item column running the
	 *  height of the board. Kept as a named zero so the reason the clock and the
	 *  objective span the full width is written down rather than inferred. */
	const RAIL_GUTTER = 8;

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
	/** How tall the objective strip is on a narrow window. Measured for the same
	 *  reason `topH` is: it wraps to a second line when a link is announced, and
	 *  the globe is fitted under whatever it actually turned out to be. */
	let objH = $state(0);
	/** The reading matter, on a window with no room to stand it beside the board. */
	let railsOpen = $state(false);

	/** The battle centre's height. A CONSTANT on the wide HUD by design (see
	 *  `PLAY_H`) — but that card is `min(94vw, 54rem)`, so on a phone it is a
	 *  third of the width it was tuned at and its contents wrap to two and three
	 *  lines. Measured only where it is allowed to vary. */
	let playH = $state(PLAY_H);

	/** How much of the bottom edge the phone's own hardware has taken.
	 *
	 *  `env()` resolves in CSS and nowhere else, so it cannot be read into the
	 *  px arithmetic the canvas insets are made of. A zero-width probe styled
	 *  `height: var(--safe-b)` is the value made measurable — without it the
	 *  bottom inset under-counts by the home indicator, and the globe puts
	 *  buildings back under the exact strip we just lifted them out of. */
	let safeB = $state(0);

	/** Everything welded to the floor on a narrow window: the hand, the battle
	 *  centre under it, the gaps either side, and the hardware below that. */
	const COMPACT_FLOOR_H = $derived(
		// `playH` is a LAYOUT height and the card it measures sits under the HUD's
		// `zoom`, so at any text scale but 1 the two disagree — and the number is
		// spent fitting the globe above it, where disagreeing means buildings back
		// under the card.
		COMPACT_FELT_H + Math.round(playH * hudScale.value) + PLAY_GAP * 2 + safeB
	);

	/** The one place the wide/compact line is drawn. The `xl:` utilities below are
	 *  the same number written in Tailwind's dialect; they have to agree, so
	 *  neither is allowed to move on its own. */
	const WIDE = '(min-width: 1280px)';
	const isWide = () => typeof window !== 'undefined' && window.matchMedia(WIDE).matches;

	/** Read at INIT and not only in the effect below. `$effect` runs after the
	 *  first paint, so starting this `true` draws one frame of the desktop
	 *  three-column HUD on a phone before correcting itself — and that frame is
	 *  the whole layout moving, which reads as the game booting broken. */
	let floating = $state(isWide());
	/** The narrow HUD is not "the wide one, smaller". It is a different
	 *  arrangement, so it gets a name rather than `!floating` at nine call sites. */
	const compact = $derived(!floating);

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
		// The street plays no cards: no rules engine and no deal, or the card
		// match's demonstrators play a game underneath that nobody can see.
		if (lobby.variant === 'insider_threat') {
			match.enterOffice(key);
			return;
		}
		if (!socket && !match.remote) {
			try {
				// Who the lobby actually seated where, so a character dealt to the
				// other side's chair plays that side here as it would on a server.
				const seating = seatOrder(lobby.size).flatMap((home) => {
					const chair = lobby.seats.find((s) => s.id === klassByKey(home).seat);
					return chair?.klassKey ? [{ klass: chair.klassKey, side: chair.side }] : [];
				});
				const { port } = await openLocalTable(match, { human: [key], seat: key, seating });
				match.remote = port;
			} catch (err) {
				console.warn('breach: rules module unavailable, using the local resolver', err);
			}
		}
		await match.takeSeat(key);
	}

	/** Out of the street, back to the lobby. A hosted table asks the server
	 *  (host only), and the reset reaches every screen through the `setup`
	 *  effect above. An offline one resets itself, and stands its demonstrators
	 *  up: a full table would be dealt again and walk straight back in. */
	function leaveStreet() {
		if (socket) {
			match.newMatch();
			return;
		}
		match.reset();
		lobby.reset();
		for (const s of lobby.seats) if (s.occupant.kind === 'ai') lobby.leave(s.id);
	}

	/** An offline street's office: the rules module hosting the match, so its
	 *  bots do their real jobs (internal/local-office.svelte.ts). */
	let localOffice = $state<LocalOffice | null>(null);
	/** The office this screen is in, hosted or local. */
	const office = $derived(socket?.view?.office ?? localOffice?.view ?? undefined);

	/** Everybody else in the street, where the office has them: a person as
	 *  their client relays them, a bot as the office relays its walk. A bot
	 *  standing still sends nothing, so it carries no `at` and never goes
	 *  stale; before its first step it stands where the view put it. */
	const streetOthers = $derived.by(() => {
		const mine = socket?.view?.your_seat;
		const bot = new Set((office?.players ?? []).filter((p) => p.bot).map((p) => p.seatId));
		const people = lobby.seats.flatMap((s) => {
			const p = socket?.poses[s.id];
			return p && s.id !== mine && !bot.has(s.id) ? [{ ...p, seat: s.id }] : [];
		});
		const bots = (office?.players ?? []).flatMap((p) => {
			if (!p.bot || p.escorted) return [];
			const walked = socket?.poses[p.seatId] ?? localOffice?.poses[p.seatId];
			if (walked) return [{ x: walked.x, y: walked.y, z: walked.z, yaw: walked.yaw, seat: p.seatId }];
			return p.at ? [{ x: p.at.x, y: 0, z: p.at.z, yaw: 0, seat: p.seatId }] : [];
		});
		return [...people, ...bots];
	});

	/** Each seat as the lobby dressed it, for the street to draw. Bare — no
	 *  character, no side — because in the office who is what is the game, and
	 *  a role badge on a body would hand it out. */
	const streetFigures = $derived(
		Object.fromEntries(
			lobby.seats.flatMap((s) =>
				s.occupant.kind === 'open' ? [] : [[s.id, resolve(lobby.lookAt(s.id), { key: s.id, name: s.occupant.name })]]
			)
		)
	);
	$effect(() => recordDressed(Object.keys(streetFigures), (seat) => lobby.lookAt(seat)));

	/** The office's moves, routed to whichever host holds the match. */
	const officeActions = $derived.by(() => {
		const s = socket;
		if (!s) return localOffice?.actions;
		return {
			channel: (st: string, a: string) => s.channel(st, a),
			lift: (seat: string) => s.lift(seat),
			cancel: () => s.cancel(),
			sweep: () => s.sweep(),
			signature: (site?: string, seat?: string) => s.signature(site, seat),
			callMeeting: () => s.callMeeting(),
			vote: (seat: string) => s.vote(seat)
		};
	});
	/** A hosted office walks in when the server starts the match; an offline
	 *  street when the local lobby deals. */
	const inStreet = $derived(
		lobby.variant === 'insider_threat' && (socket ? !!socket.view?.office : match.stage !== 'select')
	);

	// An offline street deals its office on the way in and drops it on the way
	// out. The seating is read untracked: the lobby is settled by now, and a
	// lobby write must not deal the match again.
	$effect(() => {
		if (!inStreet || socket) return;
		let gone = false;
		let opened: LocalOffice | null = null;
		const seated = untrack(() => lobby.seats.filter((s) => s.occupant.kind !== 'open'));
		const me = untrack(() => lobby.youSeatId || seated.find((s) => s.occupant.kind === 'human')?.id || '');
		const seats = seated.map((s) => ({
			ID: s.id,
			Handle: s.occupant.kind === 'open' ? '' : s.occupant.name,
			KlassKey: s.klassKey ?? '',
			Bot: s.occupant.kind === 'ai'
		}));
		// A fresh clone without `make build-breach-rules-wasm` has no module: the
		// street is then a walk with nobody in it, as it was before there was one.
		LocalOffice.open(seats, me).then(
			(o) => {
				if (gone) o.close();
				else localOffice = opened = o;
			},
			(err) => console.warn('breach: rules module unavailable, the office is empty', err)
		);
		return () => {
			gone = true;
			opened?.close();
			localOffice = null;
		};
	});

	onMount(() => match.start());

	$effect(() => {
		const mq = window.matchMedia(WIDE);
		floating = mq.matches;
		const on = (e: MediaQueryListEvent) => (floating = e.matches);
		mq.addEventListener('change', on);
		// A rotate into landscape can widen past the breakpoint with the drawer
		// still open, which would leave it pinned over a HUD that has its rails
		// back. It is a narrow-window control; it closes with the window.
		if (mq.matches) railsOpen = false;
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
			: {
					// The narrow HUD keeps the same promise as the wide one — no building
					// is ever laid under a panel — and it is the promise this branch used
					// to break. Returning only `top` fitted the globe to the full height
					// of the window while 368px of hand and battle centre sat welded over
					// the bottom of it, so on a 375px screen 14 of 19 buildings were
					// under the cards and the landscape board was ENTIRELY under them.
					top: TOP_EDGE + topH + (objH > 0 ? objH + GAP : 0) + GAP,
					bottom: COMPACT_FLOOR_H + PLAY_GAP
				}
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
		if (resultOpen) resultOpen = false;
		else if (rulesOpen) rulesOpen = false;
		else if (match.inspectKey) match.inspectKey = null;
		else if (match.selectedId) match.selectedId = null;
	}}
/>

<!-- Insider Threat is a different game, not a different board: past the lobby it
     replaces the whole stage. Before then the lobby sits over the board as it
     does for every table. -->
{#if inStreet}
	<InsiderThreat
		others={streetOthers}
		figures={streetFigures}
		pilot={!!sim?.seat}
		onpose={socket ? (p) => socket?.pose(p) : localOffice ? (p) => localOffice?.pose(p) : undefined}
		onleave={!socket || socket.isHost ? leaveStreet : undefined}
		{office}
		reactions={socket?.reactions ?? localOffice?.reactions}
		act={officeActions}
		refusal={socket ? officeRefusal : localOffice?.refusal}
	/>
{:else}
<!-- `--play-h` is published here rather than written into two class strings: the
     felt sits exactly on top of the battle centre, and a pair of hard-coded rems
     that drift leave either a gap under the cards or a card drawn over them. -->
<div
	class="hud-type relative flex h-[100dvh] flex-col overflow-hidden text-[var(--fg)]"
	style:--hud-zoom={hudScale.value}
	style:--play-h="{PLAY_H}px"
	style:--play-gap="{PLAY_GAP}px"
	style:--play-block="{(compact ? playH : PLAY_H) + PLAY_GAP * 2 + (compact ? safeB : 0)}px"
	style:--rail-gutter="{RAIL_GUTTER}px"
>
	<!-- The safe-area probe. Zero-width, inert, and the only way the home
	     indicator's height becomes a number JavaScript can add up. -->
	<div
		aria-hidden="true"
		class="pointer-events-none absolute w-0"
		style:height="var(--safe-b)"
		bind:clientHeight={safeB}
	></div>
	<TurnVignette color={match.seat.color} level={vignette} />

	<div class="relative flex-1 min-h-0">
		<BoardStage {match} {insets} {compact} top={TOP_EDGE} />

		<!-- ── The scoreboard ────────────────────────────────────────────────────
		     Round, score and clock top centre, with the two sides either side of
		     it the way a fixture board has always drawn them. A single run of four
		     chips put an enemy next to your ally and made the split something you
		     had to read off the flags.

		     Measured rather than constant: the strips grow a hover card, so the
		     cluster is as tall as the taller of the two. -->
		<!-- Absolute at EVERY width, not just `xl:`. Below the breakpoint this used
		     to fall back to a static block, and a static block is painted BEFORE a
		     positioned sibling — so the board, which is absolute, covered the whole
		     HUD. On a phone the centre of the screen resolved to a row of the
		     building ladder and the globe was not visible at all. -->
		<!-- Bounded by its own left and right edges when compact, rather than centred
		     on the whole viewport: the tactical rail holds the left gutter, and a
		     cluster centred on `100vw` runs its last 38px underneath it — the seconds
		     numeral goes half-hidden behind an opaque column.

		     `--hud-zoom` is pinned at 1 or less here for a reason worth writing down:
		     `zoom` multiplies computed lengths, so ANY viewport-relative ceiling on a
		     `hud-scaled` element is a lie — at 1.4 the box resolves 100vw and then
		     paints at 140vw. On a phone the clock is already at the width of the
		     screen, so there is nothing to grow into; the text scale still grows
		     everything in the drawer, which is where the reading is. -->
		<div
			bind:clientHeight={topH}
			class="hud-scaled absolute z-[3] flex flex-col items-center gap-2 top-[calc(var(--safe-t)+0.5rem)]
			       xl:top-4 {compact
				? 'right-2 left-[var(--rail-gutter)]'
				: 'left-1/2 max-w-[min(96vw,62rem)] -translate-x-1/2'}"
			style:--hud-zoom={compact ? Math.min(hudScale.value, 1) : undefined}
		>
			<div class="flex items-start gap-2">
				<!-- The two seat rosters are 168px each beside a clock that already
				     fills a 375px screen — the row measured 1038px wide at every window
				     width, clipped off BOTH edges of every phone. They are reference,
				     and reference is what the drawer is for; the clock stays, because
				     round, score and time are what you read between taps. -->
				{#if floating}
					<TableStrip {match} faction="red" />
				{/if}
				<TopClock {match} state={hud} />
				{#if floating}
					<TableStrip {match} faction="blue" />
				{/if}
			</div>
		</div>

		<!-- ── The two rails are one width ───────────────────────────────────────
		     They were 250px and 340px. Nothing justified the 90px — the buildings
		     carry one more stat than a feed row, not a third more content — and it
		     cost twice: the right rail reached far enough in to sit under the seat
		     chips at the top of the screen, and two rails of different widths read
		     as a page that could not decide where its margins were. Same clamp
		     both sides; change it in both places or not at all. -->
		{#if floating}
		<!-- Left column: what has happened. -->
		<div
			bind:clientWidth={leftW}
			class="hud-scaled pointer-events-none absolute top-4 bottom-7 left-4 z-[3] flex
			       w-[clamp(220px,19vw,268px)] flex-col gap-3"
		>
			<!-- Above the feed rather than inside it: the log is fogged and derived
			     from rows this viewer can prove, and a lead is a fact about the board
			     that every seat can see. It leaves after a few seconds — the
			     scoreboard is the standing record. -->
			<LeadChange {match} />
			<!-- The feed takes what is left of the column and scrolls inside it, so a
			     long match cannot push the lead card off the top. -->
			<LogFeed {match} class="min-h-0 flex-1" />
		</div>

		<!-- Right column: the objective ladder, and under it whatever just
		     happened. `overflow-x-clip` on the ladder rather than leaving it to
		     compute — setting only `overflow-y` forces the other axis to `auto`,
		     and any child that leans a pixel right grows a horizontal scrollbar. -->
		<div
			bind:clientWidth={rightW}
			class="hud-scaled pointer-events-none absolute top-4 right-4 bottom-7 z-[3] flex
			       w-[clamp(220px,19vw,268px)] flex-col gap-3"
		>
			<!-- Not `flex-1`: that made the ladder eat the column and pushed the two
			     strips below it to the floor, a screen away from what they are about.
			     It sizes to content and scrolls only if it outgrows the space, and the
			     spacer at the end takes whatever is left. -->
			<div class="flex min-h-0 shrink flex-col gap-3 overflow-x-clip overflow-y-auto">
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
			<!-- `pointer-events-auto`: the column turns them off so the globe can be
			     dragged through the rail, and this strip is the one thing in it that
			     is pressed — its result button was inert on any screen wide enough
			     for the column to exist. -->
			<div
				class="pointer-events-auto min-w-0 shrink-0 overflow-x-clip rounded-lg border border-[var(--border)]
				       bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_86%,transparent)]
				       px-2.5 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.4)] backdrop-blur-md"
			>
				<ObjectiveLine {match} onresult={() => (resultOpen = true)} />
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
		{:else}
			<!-- ── The narrow HUD ────────────────────────────────────────────────
			     Not the wide one shrunk. Each rail is 220px of reading matter and a
			     phone is 375px across, so they do not stand beside the board — they
			     leave it. What stays on the glass is what a player acts on between
			     taps: the clock above, the objective (which names the thing you are
			     trying to do), and the hand. The feed, the ladder and the dice are
			     what you CONSULT, and consulting is what the drawer is for. -->
			<div
				bind:clientHeight={objH}
				class="hud-scaled pointer-events-auto absolute right-2 left-[var(--rail-gutter)] z-[3] overflow-x-clip rounded-lg
				       border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_86%,transparent)]
				       px-2.5 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.4)] backdrop-blur-md"
				style:top="calc(var(--safe-t) + {topH + 20}px)"
			>
				<ObjectiveLine {match} terse onresult={() => (resultOpen = true)} />
			</div>

			<!-- 44px square, which is the floor a finger reliably hits — and the
			     reason this is not one of the 26px icon buttons the HUD uses where
			     there is a mouse to aim with. -->
			<button
				type="button"
				class="pointer-events-auto absolute right-2 z-[8] grid h-11 w-11 place-items-center rounded-full
				       border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_92%,transparent)]
				       text-[var(--fg-muted)] shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md"
				style:top="calc(var(--safe-t) + {topH + objH + 32}px)"
				aria-expanded={railsOpen}
				aria-label={railsOpen ? 'Close the intel drawer' : 'Open the intel drawer'}
				onclick={() => (railsOpen = !railsOpen)}
			>
				<svg viewBox="0 0 20 20" class="h-5 w-5" aria-hidden="true" fill="none">
					{#if railsOpen}
						<path
							d="M5 5l10 10M15 5L5 15"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
						/>
					{:else}
						<path
							d="M3 5.5h14M3 10h14M3 14.5h14"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
						/>
					{/if}
				</svg>
			</button>

			{#if railsOpen}
				<!-- Bounded top AND bottom by the same two numbers the globe is fitted
				     to, so the drawer can never reach over the hand it was opened
				     instead of. It scrolls inside that box; a long match grows the feed,
				     not the panel. -->
				<div
					class="hud-scaled pointer-events-auto absolute right-2 z-[7] flex w-[min(88vw,320px)] flex-col
					       gap-3 overflow-x-clip overflow-y-auto rounded-lg border border-[var(--border)]
					       bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_94%,transparent)] p-2
					       shadow-[0_18px_48px_rgba(0,0,0,0.6)] backdrop-blur-md"
					style:top="calc(var(--safe-t) + {topH + objH + 84}px)"
					style:bottom="{COMPACT_FLOOR_H + PLAY_GAP}px"
				>
					<!-- The seat rosters, evicted from the top row where the two of them
					     plus the clock measured 1038px. -->
					<!-- Stacked, not side by side. Two 168px chips in a 320px drawer get
					     flex-shrunk to ~73px each and every name turns into an ellipsis —
					     and the strip's hover card, which is 248px and centred on the
					     chip, is then cut by the drawer's own `overflow-x-clip`. -->
					<!-- Who you are, and the rule that is always on. The plate carries
					     both when there is a rail's worth of width; compact it drops
					     them, because they were settled in the lobby and never move
					     again — and a fact you cannot get back to is a fact that was
					     deleted. This is where it got to. -->
					<div class="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-2">
						<b
							class="font-mono text-[0.68rem] leading-none font-black tracking-[0.06em] uppercase"
							style:color={match.seat.color}
						>
							{match.seat.name}
						</b>
						<div class="mt-1.5 font-mono text-[0.56rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]">
							passive · {match.seat.passive.name}
						</div>
						<div class="mt-1 text-[0.68rem] leading-snug text-[var(--fg-muted)]">
							{match.seat.passive.text}
						</div>
					</div>
					<div class="flex shrink-0 flex-col items-stretch gap-2">
						<TableStrip {match} faction="red" />
						<TableStrip {match} faction="blue" />
					</div>
					<LeadChange {match} />
					<!-- The objective in full sentences, which the strip on the glass
					     no longer has room to be. The strip is the readout you glance
					     at mid-turn; this is the rule, spelled out, in the panel a
					     player opens BECAUSE they want it spelled out. -->
					<div
						class="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1.5"
					>
						<ObjectiveLine {match} onresult={() => (resultOpen = true)} />
					</div>
					<div class="shrink-0"><BuildingStack {match} /></div>
					<LogFeed {match} class="min-h-[8rem] flex-1" />
					<div class="flex shrink-0 justify-center pt-1">
						<TextScale />
					</div>
				</div>
			{/if}

			<!-- ── The moment, centre stage ──────────────────────────────────────
			     The dice were in the drawer. They are the loudest three seconds the
			     game has and they were playing behind a tap nobody had a reason to
			     make on the beat they happened — the drawer is reference, and
			     reference is consulted BETWEEN moves, not during one.

			     So on a narrow window the roll is not a panel entry. It is thrown
			     onto the table and gone again on its own clock, with nothing to
			     dismiss.

			     Bottom RIGHT, at the corner of the board rather than over the
			     middle of it. Centred, the chip is exactly the panel it replaced
			     wearing a different costume — it covers the globe on the one beat
			     the globe is doing the interesting part, and a player ends up
			     waiting it out instead of watching it. Bottom-left is the tactical
			     rail's corner when compact, so this takes the other one, sitting
			     directly on the floor the hand is measured to.

			     `max-w` rather than a width: a chip that is the same size whatever
			     is in it has to be sized for the longest verb, and then a two-word
			     result rattles around inside a box built for `exfiltrated`. -->
			<div
				class="pointer-events-none absolute right-2 z-[7] flex max-w-[min(52vw,13rem)] justify-end"
				style:bottom="{COMPACT_FLOOR_H + PLAY_GAP}px"
			>
				<GameEventsOverlay {match} bubble />
			</div>
		{/if}

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
			style:height="{compact ? COMPACT_FLOOR_H : SCRIM_H}px"
			style:background={SCRIM}
		></div>

		<div
			class="pointer-events-none absolute inset-x-0 bottom-[var(--play-block)] z-[5]"
			style:height="{compact ? COMPACT_FELT_H : FELT_H}px"
		>
			<CardFan
				{match}
				scale={compact ? COMPACT_ZOOM : 1}
				spread={compact ? COMPACT_SPREAD : 132}
				class="h-full"
			/>
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
		<!-- Wrapped so the height can be MEASURED. `PLAY_H` is a deliberate constant
		     on the wide HUD and stays one there — but the card is `min(94vw, 54rem)`,
		     so on a phone it is a third of the width it was tuned at and its contents
		     wrap to two and three lines. The globe is fitted above whatever it
		     actually became; assuming 76px there is how the buildings end up back
		     under it. Lifted clear of the home indicator by `--safe-b`. -->
		<div
			bind:clientHeight={playH}
			class="hud-scaled absolute left-1/2 z-[6] w-[min(94vw,54rem)] -translate-x-1/2"
			style:bottom="calc(var(--safe-b) + {PLAY_GAP}px)"
		>
			<BattleCentre
				{match}
				state={hud}
				takeover={arriving}
				{compact}
				{socket}
				{refusal}
				onrules={() => (rulesOpen = true)}
				class="w-full"
			/>
		</div>

		<!-- Outside every `hud-scaled` subtree on purpose — a control that scales
		     itself is a control you cannot find your way back from.

		     Bottom-left only where there is a bottom-left to be in. On a narrow
		     window the battle centre is the full width of the screen and this sat on
		     top of the seat plate; it is a preference, so it goes where the other
		     things you consult went. -->
		{#if floating}
			<GameMenu title="Breach" class="pointer-events-auto absolute bottom-6 left-4 z-[7]">
				<TextScale class="justify-self-start" />
				<Button onclick={() => (rulesOpen = true)}>Rules</Button>
			</GameMenu>
		{/if}
	</div>
</div>
{/if}

{#if rulesOpen}
	<RulesOverlay seat={match.seat} onclose={() => (rulesOpen = false)} />
{/if}

<!-- `match.newMatch()` and not `reset()`: on a hosted table this is a request the
     server answers for all four screens, and the reset rides in on the snapshot
     (see the `setup` effect above). -->
{#if resultOpen}
	<MatchOver
		{match}
		onclose={() => (resultOpen = false)}
		onagain={() => {
			resultOpen = false;
			match.newMatch();
		}}
	/>
{/if}

<!-- The table assembles before the match does. The lobby owns who is here and
     which character they were issued; the match only ever hears the answer. -->
{#if match.stage === 'select'}
	<Lobby
		{lobby}
		{socket}
		onjoin={join}
		onenter={(key) => void enter(key)}
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
