<script lang="ts">
	// ── The lobby ────────────────────────────────────────────────────────────────
	// Three screens and the rule for moving between them. Nothing else — the
	// screens own their own layout and `BreachLobby` owns every rule about who
	// may do what.
	//
	//   TITLE    the mark forging itself, once, and then the game's name on the
	//            held frame. Not a screen you can be sent back to and not a
	//            decision — it is the curtain, and it is over the moment anybody
	//            touches anything.
	//   SETUP    the game master alone, before the room exists. Size and mode are
	//            settled here because settling them later means changing the game
	//            under people who already agreed to the last one. Ends with the
	//            table opened and a link to send.
	//   SIDES    everybody, on arrival. One decision: red or blue. The seat is a
	//            consequence, so it is never offered — see `TeamPicker`.
	//   SELECT   the agent-select screen, inert until the table is FULL. Nobody
	//            picks a character while chairs are open, because the first
	//            arrival would otherwise take the pick of a roster three absent
	//            players are also entitled to.
	//
	// The old screen did all of this at once: a table of four chairs you moved
	// yourself around, with the size and mode sitting beside three people who
	// had already sat down. Splitting it is the whole change.

	import { onMount, untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Backdrop, LogoForge, prefersReducedMotion } from 'showcase';
	import { BreachLobby } from './internal/lobby.svelte.js';
	import type { AssignmentMode } from './internal/lobby.svelte.js';
	import { defaultSizeFor, isOffice, type Faction, type MatchSize } from './internal/rules.js';
	import ConnectionBanner from './hud/ConnectionBanner.svelte';
	import WelcomeCard from './lobby/WelcomeCard.svelte';
	import AgentSelect from './lobby/AgentSelect.svelte';
	import StartScreen from './lobby/StartScreen.svelte';
	import InsiderStartScreen from './lobby/InsiderStartScreen.svelte';
	import { OutfitterState } from './outfitter/outfitter.svelte.js';
	import {
		MARKS_RETURN_PARAM,
		arrivedForHalloween,
		arrivedOnLink,
		arrivedFromStepper,
		hasSession,
		insiderThreatOffered,
		inviteURL,
		isCtfPath,
		isInsiderPath,
		openTable,
		pickInsider,
		toOnboarding,
		type TableVariant
	} from './api.js';
	import { TableSocket } from './net.svelte.js';

	interface Props {
		lobby: BreachLobby;
		/** The live table, when there is one. Owned by `Breach.svelte` because the
		 *  board needs it too — a socket that lives in the lobby is a socket the
		 *  match cannot reach. */
		socket?: TableSocket | null;
		/** Called with the table id when this screen opens one. */
		onjoin?: (tableID: string) => void;
		/** Take your seat and start playing, in a LOCAL game.
		 *
		 *  Networked play has no equivalent: the server decides when the match
		 *  begins and every client follows its snapshot. */
		onenter?: (klassKey: string) => void;
	}

	let { lobby, socket = null, onjoin, onenter }: Props = $props();

	// ── Where we are ─────────────────────────────────────────────────────────
	// No flag and no setup step. A visitor lands on the sides screen with a
	// LOCAL table, and the rules are the footer's — editable until the match
	// starts, which is what made the old "settle the rules while the room is
	// empty" screen redundant. Nothing is locked in any more, so there is
	// nothing for a screen to lock.
	//
	// The server table is opened LAZILY, by asking for an invite. Somebody who
	// only wanted a look never creates one.
	let invite = $state<string | null>(null);
	let opening = $state(false);
	let openError = $state<string | null>(null);
	let copied = $state(false);

	/** The local table's rules, and the ones a server table is opened WITH. The
	 *  footer edits these before there is a socket and sends intents after. */
	let size = $state<MatchSize>('2v2');

	// ── You ──────────────────────────────────────────────────────────────────
	// The local player's own character, owned HERE rather than inside the
	// outfitter panel. A figure rebuilt every time the panel opened would not be
	// a character — it would be a demo that resets, and the entire feature is
	// that this thing is yours and persists.
	//
	// Every committed change goes two places: onto the local lobby so the ranks
	// redraw immediately, and at the socket so everybody else's do. The local
	// write is the only one there is when there is no socket — a single-player
	// table is still a character — and when there is, the seat view that comes
	// back overwrites it with the RESOLVED look. That is the correct order: the
	// server filters a claim against what the account owns, so an item nobody
	// has is worn locally for one frame and then falls back to its default in
	// front of the person who tried it, rather than only in front of everybody
	// else.
	const fit = new OutfitterState({ key: 'you', name: 'You' });
	// Whether this character is somebody's CHOICE yet — stored on the server or
	// edited here. Until it is, you wear what the table deals you (see below).
	let chosen = false;
	fit.onchange = (look) => {
		chosen = true;
		lobby.setLook(lobby.youSeatId, look);
		socket?.dress(look);
	};
	// The other direction, and the reason the editor is not the authority: the
	// server hands back your STORED character when you arrive, and the resolved
	// one when a claim had to be filtered. `load` is silent, so adopting it
	// cannot bounce back out as another dress.
	//
	// In an effect because `lobby` is a prop: a bare assignment would wire the
	// callback onto whichever table was passed FIRST, and a screen handed a new
	// one would stop hearing about its own seat. Nothing reactive is written —
	// `onyourlook` is a plain field — so this cannot re-enter.
	$effect(() => {
		lobby.onyourlook = (look) => {
			chosen = true;
			fit.load(look);
		};
	});
	// A seat arrives after the character does — you dress before you have a
	// chair — so the look has to be re-filed under whatever seat you land in.
	//
	// `untrack` is load-bearing, not tidiness. `setLook` reads `looks` in order
	// to replace it, so an effect that both calls it and tracks what it touches
	// depends on the thing it writes and re-runs for ever — this shipped once as
	// `effect_update_depth_exceeded`, which froze the title curtain before any
	// of this screen was reachable. The only dependency wanted here is the seat.
	//
	// With nothing stored and nothing edited, the look filed is the one the table
	// DEALS this seat — the same outfit every other client draws for you from
	// your id, so nobody has to be told. It is loaded silently: a dealt outfit
	// only becomes yours, and goes on the wire, the first time you change it.
	$effect(() => {
		const seat = lobby.youSeatId;
		if (!seat) return;
		untrack(() => {
			const here = lobby.seats.find((s) => s.id === seat);
			if (!chosen && here) fit.load(lobby.dealtLook(here));
			lobby.setLook(seat, fit.appearance);
		});
	});
	// The table is opened WITH this, so the client's one mode is also the mode a
	// hosted table runs — the server's own default is by-lot and nothing on this
	// screen would ever change it now that the picker is gone.
	let mode = $state<AssignmentMode>('draft');

	/**
	 * Whether the curtain is still up.
	 *
	 * Starts already down when the reader has asked for reduced motion. The
	 * scene is a full-frame collapse with a white flash in the middle of it,
	 * which is the exact shape that preference exists to refuse — and unlike a
	 * transition there is no shortened version of it worth showing, because the
	 * whole thing IS the travel.
	 *
	 * It is never raised again. An arrival on an invite link skips it too, and
	 * not as an optimisation: the title would play over a room three people are
	 * already waiting in.
	 *
	 * That skip used to be implicit — an invited player's `stage` was past
	 * `setup`, and the curtain only covered `setup`. With the setup screen gone
	 * everybody starts on the same screen, so the condition has to be stated
	 * rather than inherited from where they happened to land.
	 */
	const fromStepper = arrivedFromStepper();
	let titleDone = $state(prefersReducedMotion() || !!arrivedOnLink() || !!fromStepper);

	/** Whether the forge has finished and the name is being said over the held
	 *  frame. A second flag rather than a stage, because it is not a place: it
	 *  runs INSIDE the curtain, and every way out of the curtain is also a way
	 *  out of this. */
	let welcoming = $state(false);

	/** Somebody following an invitation lands here with the table in the query,
	 *  and has no setup step at all — the rules were settled before they were
	 *  invited. Connecting IS joining. */
	$effect(() => {
		const id = arrivedOnLink();
		if (!id || socket) return;
		onjoin?.(id);
	});

	// The server's seating, poured into the object every screen already reads.
	$effect(() => {
		const view = socket?.view;
		if (!view) return;
		lobby.applyRemote(view);
	});

	// Hand out the characters once the table is full.
	//
	// Nothing called `issue()`. It is the ONLY thing that moves a table out of
	// `waiting` — dealing the roster for `lot`, or handing the pick back to this
	// screen for `draft` and `pick` by setting `draftSeatId`. Without it the
	// phase stayed `waiting` forever and `choose()` returned on its first line,
	// so every tile on the select screen sat there enabled, lit, and inert: the
	// table said CHARACTERS ARE OPEN and clicking one did nothing at all.
	//
	// It hid because the networked path never needed it. There the server issues
	// and the answer arrives through `applyRemote` above, which writes `phase`
	// directly — so the only table that was ever broken is the one with nobody
	// to ask.
	//
	// Offline only, and guarded on the socket EXISTING rather than being live: a
	// client that deals itself a roster while a server is deciding the same
	// question is the desync the authority split is here to prevent.
	$effect(() => {
		if (socket || !lobby.canChoose || lobby.phase !== 'waiting') return;
		// Every mode drafts the same way: Insider Threat's characters are picked
		// here like the CTF's, then "enter the match" walks into the office.
		void lobby.issue();
	});

	const titleUp = $derived(!titleDone);

	// ── The account, asked for during the curtain ────────────────────────────
	// A signed-out first-time visitor used to walk straight out of the title
	// into the agent-select screen and stay there: this screen only touches the
	// server when somebody asks for an invite, so the 401 that sends a player to
	// the stepper never fired. The game looked open and then refused the first
	// thing they pressed.
	//
	// The probe starts on mount, so it runs UNDER the title rather than in front
	// of it — the animation is the whole reason there is time to ask for free.
	// `null` means the host does not answer the question (the standalone
	// open-source build), and that visitor is left alone to play locally.
	// `onMount` rather than an effect: this is asked once, and an effect with no
	// reactive reads is a one-shot wearing a reaction's clothes.
	let account = $state<boolean | null>(null);
	onMount(() => void hasSession().then((v) => (account = v)));

	// The outfitter's wallet: the signed-in player's real balance and inventory,
	// or the demo account when there is no server. Coming back from a marks
	// payment starts a re-read, since the webhook that credits it may trail the
	// redirect; the parameter is dropped so a reload does not re-run it.
	onMount(() => {
		const params = new URLSearchParams(location.search);
		const returned = params.get(MARKS_RETURN_PARAM) === 'success';
		if (returned) {
			params.delete(MARKS_RETURN_PARAM);
			const q = params.toString();
			history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}`);
		}
		void fit.connect().then(() => {
			if (returned && fit.source === 'server') void fit.awaitMarks();
		});
	});

	// ── The start screen ─────────────────────────────────────────────────────
	// Between the title and everything else, so a visitor sees what the game is
	// before being asked to sign in. Skipped on an invite link for the same
	// reason the title is: a room is already waiting for that player.
	let started = $state(!!arrivedOnLink() || !!fromStepper);

	/** Insider Threat's start screen, and its table when Play is pressed, unless
	 *  the visitor arrived on the CTF's link or switches to it on the bar. CTF
	 *  where the deployment does not offer it, since the server would refuse the
	 *  table anyway. */
	const insiderOffered = insiderThreatOffered();
	let insider = $state(insiderOffered && (fromStepper ? fromStepper === 'insider' : !isCtfPath()));
	pickInsider(insider);

	function pickGame(on: boolean) {
		insider = on;
		pickInsider(on);
	}

	const titles = $derived(
		insiderOffered
			? [
					{ label: 'Insider', current: insider, select: () => pickGame(true) },
					{ label: 'CTF', current: !insider, select: () => pickGame(false) }
				]
			: undefined
	);

	function play() {
		pickVariant(insider ? 'insider_threat' : 'ctf');
		// Signed in, Enter game still goes through the stepper: its last step
		// teaches the picked game and opens the table.
		if (account) toOnboarding();
		else started = true;
	}

	// It stays up for a visitor known to be signed out even after Play, because
	// the next thing on screen is the sign-in page and the character select
	// flashing past on the way there reads as a broken page.
	const startUp = $derived(!started || account === false);

	// The redirect waits for Play, not for the curtain: it is the end of this
	// page, and the start screen is the only chance to show what is behind it.
	$effect(() => {
		if (started && account === false) toOnboarding();
	});

	/**
	 * Seat the first arrival, on a LOCAL table only.
	 *
	 * Picking a side is not a step any more — it is a thing you may do, from the
	 * flags in the rail, whenever you feel like it. Somebody who opens the game
	 * and wants to look at characters should be looking at characters, and
	 * choosing a character needs a seat, so the seat is given rather than
	 * demanded.
	 *
	 * NOT on a networked table, and that is a deliberate exception rather than
	 * an oversight — see the note in `Breach.svelte`. There, taking a chair on
	 * connect answers "which side are you on" for a player before their screen
	 * has finished painting, and four people racing into default chairs is the
	 * seating problem this whole flow was rebuilt to avoid. A local table has
	 * nobody to race.
	 */
	$effect(() => {
		if (socket || lobby.seated) return;
		const seatId = lobby.firstOpenSeatOn('red');
		if (!seatId) return;
		lobby.joinSide('red');
		// Remembered for the same reason `pickSide` remembers a deliberate pick:
		// this chair was taken against seating the server is about to throw away.
		// Without it a host who never touched a flag — the common case, since
		// this effect seats them for free — opened a table and was silently left
		// standing outside it, and `fill_ai` then took the chair they could see
		// themselves sitting in.
		localSide = 'red';
	});

	/**
	 * Turn the local table into a real one, and hand back a link.
	 *
	 * The point of no return, and now the ONLY thing that reaches the server
	 * before a match: asking to invite somebody is the moment a table has to
	 * exist for them to arrive at. It carries the rules the footer currently
	 * holds, so a table opened after five minutes of fiddling opens as what is
	 * on screen rather than as the defaults.
	 *
	 * The seating is rebuilt when the server answers — `applyRemote` overwrites
	 * whatever was local — so a side already picked is re-taken below rather
	 * than assumed to survive.
	 */
	async function openRoom() {
		if (invite || opening) return;
		opening = true;
		openError = null;
		try {
			const table = await openTable({ size, mode, variant: lobby.variant });
			invite = inviteURL(table.invite);
			onjoin?.(table.table_id);
		} catch (err) {
			openError = err instanceof Error ? err.message : 'could not open a table';
		} finally {
			opening = false;
		}
	}

	/** The side this client picked before the table was real, so it can be taken
	 *  again once the server owns the seating. Cleared the moment it is used —
	 *  a re-seat that fires twice would give the chair away and take it back. */
	let localSide = $state<Faction | null>(null);

	// Re-take the seat on the table the server just built. The local pick was
	// made against seating that no longer exists, and without this the host is
	// standing in a room they thought they were sitting in — which is the state
	// `fill_ai` then fills the chair they appear to occupy.
	$effect(() => {
		if (!socket?.live || !localSide) return;
		const seatId = lobby.firstOpenSeatOn(localSide);
		localSide = null;
		if (seatId) socket.takeSeat(seatId);
	});

	async function copy() {
		// Asking for the link is what opens the table, so this is the one caller
		// that must not bail on `invite` being null — it is null precisely
		// because nobody has asked yet.
		if (!invite) await openRoom();
		if (!invite) return;
		try {
			await navigator.clipboard.writeText(invite);
			copied = true;
			setTimeout(() => (copied = false), 1800);
		} catch {
			// Clipboard access can be refused — over plain http on a LAN address,
			// for one, which is exactly when somebody is inviting a person sitting
			// near them. The link is on screen and selectable, so this is a missing
			// convenience rather than a dead end.
			copied = false;
		}
	}

	/**
	 * Take a side.
	 *
	 * One decision, two ways to apply it. With a table the choice becomes a
	 * `take_seat` and the server answers with a seating everybody sees; without
	 * one the lobby seats you directly. The rule about WHICH chair a side gives
	 * you lives in `BreachLobby` either way, so the two paths cannot drift.
	 */
	function pickSide(side: Faction) {
		// Takeable, not open: on a table the host has filled there are no open
		// chairs left and this is a guest who arrived on the link. The server
		// allows displacing a demonstrator right up until the first move.
		const seatId = lobby.firstTakeableSeatOn(side);
		if (!seatId) return;
		if (socket?.live) socket.takeSeat(seatId);
		else {
			lobby.joinSide(side);
			// Remembered, not just applied: if this table is opened to the server
			// later, the local seating is thrown away and this is what re-takes
			// the chair.
			localSide = side;
		}
	}

	/** A fill asked for while a table was still being opened, held until it can
	 *  be sent. See `fillWithAI`. */
	let pendingFill = $state(false);

	/**
	 * Fill the rest of the table with demonstrators. The host's answer to
	 * "nobody else is coming", and one of the two ways the character gate opens
	 * — the other being three more people arriving.
	 *
	 * A fill asked for while a table is mid-open is DEFERRED rather than applied
	 * locally, because a local fill in that window is worse than no fill: the
	 * seating it writes is overwritten seconds later by `applyRemote`, so the
	 * host presses the button, watches the chairs fill, and then watches them
	 * empty again. Pressing it once more is the natural response and it lands on
	 * the real table before the host's own chair has been re-taken — which fills
	 * every seat with bots, closes the character gate, and leaves `pickSide` with
	 * no open chair to give. That is the locked lobby: a full table nobody can
	 * join, and the only way out is a new one.
	 *
	 * So the fill waits for the socket to be live AND for the host to be seated
	 * on the server's seating, then goes out as an intent like every other
	 * decision on this screen.
	 */
	function fillWithAI() {
		if (socket?.live) {
			socket.fillAI();
			return;
		}
		// A table exists or is on its way: hold the intent for the flush below.
		// Otherwise this is a genuinely local table and nothing is coming to
		// overwrite it — but the flag is still set, harmlessly, so that a host who
		// fills and THEN asks for an invite gets the bots they asked for on the
		// table that replaces this one.
		if (!socket && !opening) lobby.fillWithAI();
		pendingFill = true;
	}

	// Flush a deferred fill. Gated on `localSide` being cleared as well as on the
	// seat landing, so it can never overtake the re-seat above and fill the
	// chair that re-seat is on its way to take.
	$effect(() => {
		if (!pendingFill || !socket?.live || localSide || !lobby.seated) return;
		pendingFill = false;
		socket.fillAI();
	});

	/** The table's rules, changed after it was opened.
	 *
	 *  Routed the same way every other decision on this screen is: to the server
	 *  when there is one, locally when there is not. `lobby.setSize` rebuilds the
	 *  seating itself and says in its own doc that a networked table never calls
	 *  it — the server's seating arrives through `applyRemote` and overwrites
	 *  anything local, so calling both would draw a board that flickers between
	 *  two authorities.
	 *
	 *  These stay live until the match starts rather than being frozen at open.
	 *  The server already allowed it (`OpSetSize`/`OpSetMode` are host-only and
	 *  phase-gated, not open-once); the only thing that made the rules final was
	 *  that the controls existed on one screen you could never return to. A host
	 *  who opened a 2v2 and had one person turn up had to open a new table. */
	function pickSize(s: MatchSize) {
		size = s;
		if (socket?.live) socket.setSize(s);
		else lobby.setSize(s);
	}

	/** The game. Live until the characters are out, like size, and routed the
	 *  same way. Offered only where the deployment has the feature on — the
	 *  server enforces the same switch at both doors. */
	const offerVariant = insiderThreatOffered();
	function pickVariant(v: TableVariant) {
		if (socket?.live) {
			socket.setVariant(v);
			return;
		}
		lobby.variant = v;
		// The new game's own table when the old size is not one it is played at,
		// as the server does for a hosted table (`Table.resize`).
		if (isOffice(lobby.size) !== (v === 'insider_threat')) {
			size = defaultSizeFor(v);
			lobby.setSize(size);
		}
	}
	// Back from the stepper the start screen is skipped, so Play never set the
	// game picked there; the table would open as the CTF.
	if (fromStepper && !arrivedOnLink()) pickVariant(insider ? 'insider_threat' : 'ctf');

	// No `pickMode`. The character screen offers one way to hand characters out —
	// the draft — so the only thing that still sets a mode is `openTable` below,
	// which sends `mode` once when the table is created. `socket.setMode` and
	// `lobby.setMode` are untouched: the engine keeps all three, and a host with
	// a console can still change one.

	/**
	 * How the curtain leaves.
	 *
	 * An `out:` and nothing else — the setup screen is already mounted underneath
	 * and needs no entrance of its own. Two things fading at once against each
	 * other is a dissolve nobody asked for; one thing getting out of the way reads
	 * as the camera moving on.
	 *
	 * The scale is the whole trick and it is deliberately small. A title that only
	 * dims has been switched off; a title that also pushes very slightly toward
	 * the reader has been passed through. Any more than a few percent and it stops
	 * being a move and becomes a zoom.
	 *
	 * Reduced motion never reaches this: `titleDone` starts true there, so the
	 * curtain is never mounted and has nothing to leave.
	 */
	const curtain = (_node: Element) => ({
		duration: 460,
		easing: cubicOut,
		// `u` runs 1 → 0 on the way out.
		css: (u: number) => `opacity: ${u}; transform: scale(${1 + (1 - u) * 0.035});`
	});
</script>

<!-- Any key drops the curtain. Bound on the window rather than on the overlay
     because nothing in it is focusable by the time the reader reaches for the
     keyboard, and a skip you have to click first is not a skip. -->
<svelte:window
	onkeydown={(e) => {
		if (titleUp && !e.metaKey && !e.ctrlKey && !e.altKey) titleDone = true;
	}}
/>

<!-- ONE opaque, fixed root for all three screens.
     The board and its HUD are already mounted underneath — the lobby is an
     overlay over a live table, not a page that replaces it. Without the
     backdrop and the z-index the setup screen paints straight over a game in
     progress, which is exactly as legible as it sounds. -->
<div class="fixed inset-0 z-[70] overflow-y-auto bg-[var(--bg,#05080d)]">
	<!-- Current Field, from the backdrop engine the Backdrop Studio authors.
	     A pre-match menu is exactly what that engine is for: something with
	     motion in it so the room does not read as frozen while you wait for
	     three people, and nothing in it you could mistake for the board.
	     Behind everything and inert to the pointer — a background that can
	     swallow a click on a character is not a background. -->
	<div class="absolute inset-0 z-0 pointer-events-none">
		<Backdrop id="current-field" strength={0.9} />
	</div>

	<!-- The banner is mounted HERE rather than inside a screen: a dropped socket
	     is precisely when a screen might not render, and a connection warning
	     that disappears with the thing it is warning about is no warning. -->
	{#if socket}
		<div class="absolute top-3 left-1/2 -translate-x-1/2 z-30">
			<ConnectionBanner {socket} />
		</div>
	{/if}

	<!-- ONE screen. Side and character were two stages of a wizard, then a screen
	     with a panel over it, and both were the same mistake in different
	     shapes: a modal standing in for a control that is already on the page.
	     The rail's two flags ARE the side selector — for the first pick and for
	     every change after it — so there is nothing left for a separate screen
	     to do. `inert` while the curtain is up, so the tab key never reaches a
	     roster the reader cannot see. -->
	{#if startUp}
		<div class="relative z-10 min-h-full" inert={titleUp}>
			{#if insider}
				<InsiderStartScreen
					{account}
					leaving={started}
					scene={!titleUp}
					halloween={arrivedForHalloween()}
					onplay={play}
					{titles}
				/>
			{:else}
				<StartScreen {account} leaving={started} globe={!titleUp} onplay={play} {titles} />
			{/if}
		</div>
	{:else}
	<div class="relative z-10 min-h-full grid" inert={titleUp}>
		<!-- The host's levers used to float over this screen in their own panel,
		     pinned above the footer — a second bar of controls on a screen that
		     already ends in one, overlapping the seat strip on a short window.
		     AgentSelect's footer owns them now, beside the sentence explaining
		     why picking is closed, which is the thing they answer. -->
		<AgentSelect
			{lobby}
			{socket}
			{fit}
			{onenter}
			{invite}
			{copied}
			busy={opening}
			filling={pendingFill}
			error={openError}
			oncopy={copy}
			onfill={fillWithAI}
			onpickside={socket && !socket.live ? undefined : pickSide}
			onsize={pickSize}
			onvariant={offerVariant && (!socket || socket.live) ? pickVariant : undefined}
		/>
	</div>
	{/if}


	<!-- The curtain. Over the backdrop, the banner and whichever screen is behind
	     it — it is the first thing on screen and there is nothing back there worth
	     reading yet. It ends itself on the card; everything else here is the way
	     out, and every one of them leaves through the same fade. -->
	{#if titleUp}
		<!-- `overflow-hidden` because the root here scrolls: the curtain's own
		     bleeds — the title card's scrim, the forge's floor — would otherwise
		     grow the page and raise scrollbars over the cold open. -->
		<div class="absolute inset-0 z-40 overflow-hidden" out:curtain>
			<!-- The forge hands off to the card rather than to the setup screen: it
			     is the mark ARRIVING, and cutting away on the frame it arrives at
			     spends nine seconds of build on nothing. `oncomplete` already waits
			     out the lamp, so the held frame is lit before the name lands on it. -->
			<LogoForge oncomplete={() => (welcoming = true)} />
			<!-- A real button spanning the frame rather than a click handler on a
			     div: it is the same target either way for a pointer, and this one
			     is also reachable by the reader who never sees the scene. -->
			<button
				class="absolute inset-0 cursor-default"
				aria-label="Skip the title"
				onclick={() => (titleDone = true)}
			></button>
			<!-- After the button, so the type paints over it, and inert so the frame
			     stays one big skip target for the whole of the curtain. -->
			{#if welcoming}
				<WelcomeCard
					word={insiderOffered && isInsiderPath() ? 'Insider Threat' : undefined}
					oncomplete={() => (titleDone = true)}
				/>
			{/if}
			<span
				class="pointer-events-none absolute right-6 bottom-5 font-mono text-[0.58rem]
				       tracking-[0.16em] text-[var(--fg-dim)] uppercase opacity-70"
			>
				press any key to skip
			</span>
		</div>
	{/if}
</div>
