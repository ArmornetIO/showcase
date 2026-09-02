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
	import { Backdrop, Button, LogoForge, Panel, prefersReducedMotion } from 'showcase';
	import { BreachLobby } from './internal/lobby.svelte.js';
	import type { AssignmentMode } from './internal/lobby.svelte.js';
	import type { Faction, MatchSize } from './internal/rules.js';
	import ConnectionBanner from './hud/ConnectionBanner.svelte';
	import HostSetup from './lobby/HostSetup.svelte';
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
	// One flag, not a state machine: `hosting` is false until the game master
	// has opened a table or chosen to play alone. Everything after that is
	// derived from the lobby, which is the thing the server also drives.
	let opened = $state(false);
	let invite = $state<string | null>(null);
	let opening = $state(false);
	let openError = $state<string | null>(null);
	let copied = $state(false);

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
	 * not as an optimisation: `stage` is already past `setup` for them, so the
	 * title would play over a room three people are waiting in.
	 */
	let titleDone = $state(prefersReducedMotion());

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
		opened = true;
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

	const stage = $derived(
		!opened && !socket ? 'setup' : lobby.seated ? 'select' : 'sides'
	);

	const titleUp = $derived(!titleDone && stage === 'setup');

	async function openRoom() {
		opening = true;
		openError = null;
		try {
			const table = await openTable({ size, mode });
			invite = inviteURL(table.invite);
			opened = true;
			onjoin?.(table.table_id);
			void copy();
		} catch (err) {
			openError = err instanceof Error ? err.message : 'could not open a table';
		} finally {
			opening = false;
		}
	}

	/** No server, no room, no waiting. The host takes a side and the rest of the
	 *  table is demonstrators the moment they do. */
	function playAlone() {
		lobby.setMode(mode);
		opened = true;
	}

	async function copy() {
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
		else lobby.joinSide(side);
	}

	/** Fill the rest of the table with demonstrators. The host's answer to
	 *  "nobody else is coming", and one of the two ways the character gate
	 *  opens — the other being three more people arriving. */
	function fillWithAI() {
		if (socket?.live) socket.fillAI();
		else lobby.fillWithAI();
	}

	const isHost = $derived(!socket || socket.isHost);

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

	{#if stage === 'setup'}
		<!-- Mounted UNDER the curtain rather than after it. The curtain used to be
		     the first arm of this chain, which meant there was nothing behind it to
		     fade to and the only way off the title was a cut. `inert` is what makes
		     that safe: the screen is on the page for the whole of the intro, and
		     without it the tab key reaches a form nobody can see. -->
		<div class="relative z-10 min-h-full grid" inert={titleUp}>
			<HostSetup
				{size}
				{mode}
				{takeover}
				busy={opening}
				error={openError}
				onsize={(s) => {
					size = s;
					lobby.setSize(s);
				}}
				onmode={(m) => {
					mode = m;
					lobby.setMode(m);
				}}
				{ontakeover}
				onopen={openRoom}
				onsolo={playAlone}
			/>
		</div>
	{:else if stage === 'sides'}
		<div class="relative z-10 min-h-full grid">
			<TeamPicker
				{lobby}
				{invite}
				{copied}
				oncopy={copy}
				onpick={socket && !socket.live ? null : pickSide}
			/>
		</div>
	{:else}
		<AgentSelect {lobby} {socket} {onenter} />

		<!-- The host's two levers, floated over the select screen rather than
		     given a panel of their own: each is pressed once, by one of the four. -->
		{#if isHost && !lobby.canChoose}
			<div class="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
				<Panel padding="dense">
					<div class="flex items-center gap-3">
						<span class="font-mono text-[0.55rem] text-[var(--fg-dim)]">
							{lobby.blockedBecause} — nobody may pick yet.
						</span>
						<Button size="xs" variant="primary" onclick={fillWithAI}>
							fill with demonstrators
						</Button>
						{#if invite}
							<Button size="xs" variant="ghost" onclick={copy}>
								{copied ? 'link copied' : 'copy invite'}
							</Button>
						{/if}
					</div>
				</Panel>
			</div>
		{/if}
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
