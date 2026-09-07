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

	import { cubicOut } from 'svelte/easing';
	import { Backdrop, LogoForge, prefersReducedMotion } from 'showcase';
	import { BreachLobby } from './internal/lobby.svelte.js';
	import type { AssignmentMode } from './internal/lobby.svelte.js';
	import type { Faction, MatchSize } from './internal/rules.js';
	import ConnectionBanner from './hud/ConnectionBanner.svelte';
	import WelcomeCard from './lobby/WelcomeCard.svelte';
	import TeamPicker from './lobby/TeamPicker.svelte';
	import AgentSelect from './lobby/AgentSelect.svelte';
	import { arrivedOnLink, inviteURL, openTable } from './api.js';
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
		/** Whether a player may take a demonstrator's chair mid-match. Owned by
		 *  the match — a setting is a fact about the table, not about the screen
		 *  that happens to be asking — so it is read and written through, never
		 *  copied. */
		takeover?: boolean;
		ontakeover?: (v: boolean) => void;
	}

	let {
		lobby,
		socket = null,
		onjoin,
		onenter,
		takeover = false,
		ontakeover = () => {}
	}: Props = $props();

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
	let mode = $state<AssignmentMode>('lot');

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
	let titleDone = $state(prefersReducedMotion() || !!arrivedOnLink());

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
		void lobby.issue();
	});

	const stage = $derived(lobby.seated ? 'select' : 'sides');

	const titleUp = $derived(!titleDone && stage === 'sides');

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
			const table = await openTable({ size, mode });
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
		const seatId = lobby.firstOpenSeatOn(side);
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

	/** Fill the rest of the table with demonstrators. The host's answer to
	 *  "nobody else is coming", and one of the two ways the character gate
	 *  opens — the other being three more people arriving. */
	function fillWithAI() {
		if (socket?.live) socket.fillAI();
		else lobby.fillWithAI();
	}

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

	function pickMode(m: AssignmentMode) {
		mode = m;
		if (socket?.live) socket.setMode(m);
		else lobby.setMode(m);
	}

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

	{#if stage === 'sides'}
		<!-- Mounted UNDER the curtain rather than after it. The curtain used to be
		     the first arm of this chain, which meant there was nothing behind it to
		     fade to and the only way off the title was a cut. `inert` is what makes
		     that safe: the screen is on the page for the whole of the intro, and
		     without it the tab key reaches controls nobody can see.
		     This is the first screen now — picking a side is the first thing
		     anybody does, on a local table, and the rules live in the footer of
		     the next one. -->
		<div class="relative z-10 min-h-full grid" inert={titleUp}>
			<TeamPicker
				{lobby}
				{invite}
				{copied}
				busy={opening}
				error={openError}
				oncopy={copy}
				onpick={socket && !socket.live ? null : pickSide}
			/>
		</div>
	{:else}
		<!-- The host's levers used to float over this screen in their own panel,
		     pinned above the footer — a second bar of controls on a screen that
		     already ends in one, overlapping the seat strip on a short window.
		     AgentSelect's footer owns them now, beside the sentence explaining
		     why picking is closed, which is the thing they answer. -->
		<AgentSelect
			{lobby}
			{socket}
			{onenter}
			{invite}
			{copied}
			oncopy={copy}
			onfill={fillWithAI}
			onsize={pickSize}
			onmode={pickMode}
		/>
	{/if}

	<!-- The curtain. Over the backdrop, the banner and whichever screen is behind
	     it — it is the first thing on screen and there is nothing back there worth
	     reading yet. It ends itself on the card; everything else here is the way
	     out, and every one of them leaves through the same fade. -->
	{#if titleUp}
		<div class="absolute inset-0 z-40" out:curtain>
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
				<WelcomeCard oncomplete={() => (titleDone = true)} />
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
