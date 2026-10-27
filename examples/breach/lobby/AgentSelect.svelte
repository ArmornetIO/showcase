<script lang="ts">
	// ── Agent select ─────────────────────────────────────────────────────────
	// The screen that replaced the table of four chairs.
	//
	// WHAT CHANGED. The old lobby asked a player to solve a seating problem
	// before it let them look at a character: take chair R2, wait, be ISSUED
	// somebody. The right model for a board game, the wrong one for the thirty
	// seconds before a match — where the only question anybody has is "who am I
	// going to be". Side first, then character; the seat falls out of it and is
	// REPORTED, never offered as a control.
	//
	// THE GATE. Nothing is choosable until the table is full — every chair taken
	// by a person or a demonstrator. Letting the first arrival pick would hand
	// them their whole side's roster while three people who have not turned up
	// get the leftovers. That is not a draft, it is a race, and the reason the
	// roster is inert with a reason printed on it until `lobby.canChoose`.
	//
	// AUTHORITY. Every decision is routed through the socket when there is one
	// and applied locally when there is not. The component never decides
	// anything itself: a table with a server is one where two clients must not
	// be able to disagree about who holds what.

	import { Figure, Icon, Modal, StepSwitcher, gameDev } from 'showcase';
	import { MAPS, OFFERED_MAPS } from '../insider/maps.js';
	import { rosterFor, type BreachLobby, type LobbySeat } from '../internal/lobby.svelte.js';
	import {
		BENCH,
		INITIATIVE,
		isOffice,
		sizesFor,
		type Faction,
		type Klass,
		type MatchSize
	} from '../internal/rules.js';
	import type { TableSocket } from '../net.svelte.js';
	import { ORDINAL, SIDES } from './sides.js';
	import TeamFlag from '../hud/TeamFlag.svelte';
	import RoleBadge from '../hud/RoleBadge.svelte';
	import { teamFlags } from '../hud/team-flags.svelte.js';
	import Outfitter from '../outfitter/Outfitter.svelte';
	import MarksShop from '../outfitter/MarksShop.svelte';
	import Handle from './Handle.svelte';
	import Standings from './Standings.svelte';
	import { getLeaderboard, type Leader, type TableVariant } from '../api.js';
	import { handle } from './handle.svelte.js';
	import type { OutfitterState } from '../outfitter/outfitter.svelte.js';
	import Rank from './Rank.svelte';
	import SeatStrip from './SeatStrip.svelte';

	interface Props {
		lobby: BreachLobby;
		socket?: TableSocket | null;
		/** Your own editor. Owned above so the appearance survives leaving this
		 *  screen — a character rebuilt every time the lobby opened would not be
		 *  a character. */
		fit: OutfitterState;
		/** Take the character and go. Local tables only — a networked one starts
		 *  when the server says so. */
		onenter?: (klassKey: string) => void;
		/** The host's levers. They used to float over this screen in a panel of
		 *  their own, which put a second bar of controls above a screen that
		 *  already ends in a bar of controls. They belong in the footer with
		 *  everything else the table is waiting on. */
		invite?: string | null;
		copied?: boolean;
		/** Null while a table is being opened. */
		busy?: boolean;
		error?: string | null;
		/** A fill that has been asked for and is waiting on the table it will be
		 *  applied to. The button says so rather than looking un-pressed, which
		 *  is what made a host press it again into a half-open table. */
		filling?: boolean;
		oncopy?: () => void;
		onfill?: () => void;
		onsize?: (s: MatchSize) => void;
		/** Pick the game. Absent where the deployment does not offer a choice, or
		 *  once the table is open — the variant is fixed at open. */
		onvariant?: (v: TableVariant) => void;
		/** Move to a side. The rail's flags call this directly rather than
		 *  reopening the sides panel — switching is one click, and a panel that
		 *  opens only to be clicked once and dismissed is a dialog standing in
		 *  for a button. */
		onpickside?: (side: Faction) => void;
	}

	let {
		lobby,
		socket = null,
		fit,
		onenter,
		invite = null,
		copied = false,
		busy = false,
		filling = false,
		error = null,
		oncopy,
		onfill,
		onsize,
		onvariant,
		onpickside
	}: Props = $props();

	const VARIANT_OPTIONS = [
		{ value: 'ctf', label: 'CTF', description: 'The card game: take the buildings, hold the board.' },
		{ value: 'insider_threat', label: 'Insider Threat', description: 'First person. Walk the office on foot.' }
	];

	/** Insider Threat's map. Held in `gameDev.map` (the DevCog's GAME group sets
	 *  the same value) and kept in THIS browser: with one player-facing map there
	 *  is nothing for a table to disagree about. A second real map makes it table
	 *  config, sent like the variant. */
	const MAP_OPTIONS = OFFERED_MAPS.map((m) => ({
		value: m.id,
		label: m.dev ? `${m.label} · dev` : m.label,
		description: m.dev ? 'Dev session only.' : undefined
	}));

	/** Fixed order, so the two flags never swap places under the reader when the
	 *  side they hold changes. */
	const SIDE_ORDER = ['red', 'blue'] as const satisfies readonly Faction[];

	let hover = $state<string | null>(null);

	/** The studio opens OVER the stage rather than replacing it. Docked, it ate
	 *  the line-up — and the line-up is the thing a player is dressing for. */
	let dressing = $state(false);
	let shopping = $state(false);

	function undress() {
		// Something tried on but not bought comes off when the panel closes.
		fit.browse(fit.equipped(fit.category));
		dressing = false;
	}

	const side = $derived(lobby.yourSide);
	// In the office nobody knows their side until the shift starts, and most
	// will be loyal — so the kit shown is the loyal one.
	const roster = $derived(rosterFor(lobby.office ? 'blue' : side));
	/** Characters already spoken for, so the rail can grey them rather than
	 *  letting two people race for the same one. */
	const taken = $derived(
		// An office shares its characters, so nothing is ever spoken for there.
		lobby.office ? new Set<string>() : new Set(lobby.seats.map((s) => s.klassKey).filter(Boolean) as string[])
	);

	/** Everybody holding a chair, by id, so the roster can tell an arrival who
	 *  has sat down from one who has not. */
	const seatedIDs = $derived(
		new Set(lobby.seats.map((s) => (s.occupant.kind === 'human' ? s.occupant.id : '')).filter(Boolean))
	);

	/**
	 * Present at the table, holding no chair.
	 *
	 * The roster rendered `lobby.seats` and nothing else, which made arriving and
	 * SITTING DOWN look like the same act when they are two — a member is created
	 * by the first intent, a seat only by `take_seat`. Two people stood in this
	 * lobby reading four empty chairs and each concluded the other had never
	 * arrived, when the server had both of them present the whole time.
	 */
	const standing = $derived(
		(socket?.view?.members ?? []).filter((m) => m.present && !seatedIDs.has(m.user_id))
	);

	const mine = $derived(lobby.klassAt(lobby.youSeatId));
	/** Whose turn it is, when the mode is a draft. `null` means anybody may go. */
	const onTheClock = $derived(lobby.draftSeatId);
	const yourTurn = $derived(!onTheClock || onTheClock === lobby.youSeatId);

	const shown = $derived.by(() => {
		const peek = hover ? roster.find((k) => k.key === hover) : undefined;
		return peek ?? mine ?? roster[0];
	});
	const peeking = $derived(!!mine && shown.key !== mine.key);

	/** Seats in play at this size, per rank. A 1v1 draws one figure a side
	 *  rather than two with a hole where a chair used to be. */
	const ranks = $derived(
		Object.fromEntries(
			SIDE_ORDER.map((f) => [f, lobby.seatsOn(f).slice(0, lobby.size === '1v1' ? 1 : 2)])
		) as Record<Faction, LobbySeat[]>
	);

	/** Locked when a character is held and the table is past choosing. */
	const locked = $derived(!!mine && lobby.phase === 'ready');

	/** Whether THIS client may move the table's levers.
	 *
	 *  A local table has no server and therefore no host — the one person there
	 *  is the host by default, which is why the socket's absence reads as true.
	 *  The server enforces the same rule (`requireHost` in internal/breach), so
	 *  this only decides whether the control is DRAWN; it is not the check. */
	const isHost = $derived(!socket || socket.isHost);

	/** The rules stay open until the match does.
	 *
	 *  `waiting` is the phase where the server still accepts `set_size` and
	 *  `set_mode`. Settling them on the setup screen and freezing them there was
	 *  never a rule — it was just where the only controls existed, so a host who
	 *  opened a 2v2 and had one person show up had to open a new table. */
	const rulesOpen = $derived(isHost && lobby.phase === 'waiting');

	// The one rule set left in the footer, in the shape the shared control takes.
	// `blurb` becomes `description` and shows in the menu, so the gloss the
	// deleted setup screen printed under each card is not lost by moving the
	// choice here.
	// The sizes the table's GAME is played at: sides for the CTF, a head count
	// for Insider Threat. One lever, its options the game's.
	const SIZE_OPTIONS = $derived(
		sizesFor(lobby.variant).map((s) => ({
			value: s.id,
			// The bare head count: the tile's caption already says "players".
			label: isOffice(s.id) ? s.id[0] : s.label,
			description: s.blurb
		}))
	);

	function choose(k: Klass) {
		if (!lobby.canChoose || !yourTurn || locked || taken.has(k.key)) return;
		if (socket?.live) socket.choose(k.key);
		else lobby.choose(k.key);
	}

	/** What the primary button is waiting for, said out loud. A disabled button
	 *  with a fixed label is four people staring at a greyed-out control with
	 *  nothing saying which of them it is waiting on. */
	const primary = $derived.by(() => {
		if (!lobby.canChoose) return { label: lobby.blockedBecause ?? 'waiting', live: false };
		if (!mine) return { label: 'choose a character', live: false };
		if (socket?.live) {
			if (!lobby.startable) return { label: 'waiting for the table', live: false };
			return socket.isHost
				? { label: 'start the match', live: true }
				: { label: 'waiting for the host', live: false };
		}
		return { label: 'enter the match', live: true };
	});

	function go() {
		if (!primary.live) return;
		if (socket?.live) socket.start();
		else if (mine) onenter?.(mine.key);
	}

	// ── The narrow lobby is a different lobby ────────────────────────────────
	// Three columns collapsed into one is a desktop page on a phone: you scroll
	// past a roster and a portrait to reach the button that starts the game, and
	// the thing you came to press is the thing you cannot see. A phone game asks
	// one question per screen and keeps the answer under the thumb.
	//
	// Same data, same handlers, same rules — only the arrangement differs. The
	// breakpoint matches `Breach.svelte`'s and the `xl:` utilities; all three are
	// the same line and none may move alone.
	const WIDE = '(min-width: 1280px)';
	let compact = $state(
		typeof window !== 'undefined' ? !window.matchMedia(WIDE).matches : false
	);
	$effect(() => {
		const mq = window.matchMedia(WIDE);
		compact = !mq.matches;
		const on = (e: MediaQueryListEvent) => (compact = !e.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});

	type Step = 'side' | 'agent' | 'confirm';
	/** Starts wherever the table already put you: a rejoin that holds a character
	 *  must not be walked back through two questions it has already answered. */
	// svelte-ignore state_referenced_locally
	let step = $state<Step>(mine ? 'confirm' : 'side');

	function pickSideStep(f: Faction) {
		onpickside?.(f);
		step = 'agent';
	}

	function pickAgent(k: Klass) {
		choose(k);
		// Advanced only on success. `choose` refuses a taken character, a locked
		// table and somebody else's turn in the draft, and moving on regardless
		// would show a confirm screen for a character this player does not hold.
		if (lobby.klassAt(lobby.youSeatId)?.key === k.key) step = 'confirm';
	}

	// ── Standings ────────────────────────────────────────────────────────────
	// `null` means this server keeps no history — the button is not drawn. Asked
	// once up front for that answer, and again on every open, because the board
	// is the one thing on this screen that changes while you are away from it.
	let leaders = $state<Leader[] | null>(null);
	let standingsOpen = $state(false);
	// In an effect so it never runs during SSR, where a relative fetch throws.
	$effect(() => {
		void getLeaderboard().then((l) => (leaders = l));
	});
	async function openStandings() {
		standingsOpen = true;
		leaders = await getLeaderboard();
	}

	/** The keys printed on the footer's tiles. Ignored while typing (the name
	 *  field) and while a modal owns the screen. Enter only starts the match
	 *  from nowhere in particular — on a focused button it is that button's. */
	function onkey(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey || dressing || standingsOpen) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
		const k = e.key.toLowerCase();
		if (k === 'enter') {
			if (t?.closest('button, a')) return;
			go();
		} else if (k === 'c') dressing = true;
		else if (k === 's' && leaders !== null) void openStandings();
		else if (k === 'b' && isHost && !lobby.canChoose && !filling) onfill?.();
		else if (k === 'i' && isHost && !busy) oncopy?.();
		else return;
		e.preventDefault();
	}

	// Asked here, not left to whichever `Handle` happens to mount first: the
	// footer's name control is gated on the answer, so it cannot be the thing
	// that asks.
	void handle.load();
</script>

<svelte:window onkeydown={onkey} />

<div class="select" data-step={compact ? step : null} style:--tone={SIDES[side].tone} style:--pick={shown?.color ?? '#64748B'}>
	<header>
		<button
			type="button"
			class="back"
			disabled={step === 'side'}
			aria-label="Back a step"
			onclick={() => (step = step === 'confirm' ? 'agent' : 'side')}
		>
			<svg viewBox="0 0 20 20" aria-hidden="true" fill="none"
				><path
					d="M12.5 4.5L7 10l5.5 5.5"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
		</button>
		<div class="brand">
			<span class="mark" aria-hidden="true"></span>
			<div>
				<div class="title">Agent Select</div>
				<div class="sub">
					Breach · {lobby.office ? `${lobby.seats.length} players` : lobby.seats.length === 2 ? '1v1' : '2v2'} · {lobby.mode}
				</div>
			</div>
		</div>

		<div class="gate" class:open={lobby.canChoose}>
			<div class="gate-h">{lobby.canChoose ? 'Table full' : 'Filling'}</div>
			<div class="gate-s">
				{lobby.canChoose ? 'characters are open' : (lobby.blockedBecause ?? '')}
			</div>
		</div>

		<div class="order">
			<SeatStrip {lobby} />
		</div>
	</header>

	<div class="body">
		<aside class="rail">
			<!-- Both flags, not just yours. The side was a screen you passed
			     through, so once you were here the other one had stopped existing
			     — and changing your mind meant going back to a place there was no
			     way back to. Yours is lit and says its call; the other is the
			     control that moves you, which is the whole of "switch sides"
			     without a second screen to hold it. -->
			<div class="flags">
				{#if lobby.office}
					<!-- The office has no sides to choose: which side anybody is on is
					     dealt in secret when the shift starts. One control, to sit down. -->
					<button
						type="button"
						class="flag"
						class:on={lobby.seated}
						style:--sc="#94A3B8"
						disabled={lobby.seated || !onpickside || locked || !lobby.firstTakeableSeatOn('red')}
						onclick={() => pickSideStep('red')}
					>
						<span class="fl-head">
							<span class="fl-titles">
								<span class="fl-tag">The office</span>
								<span class="fl-name">{lobby.seated ? `Desk ${lobby.youSeatId}` : 'Take a desk'}</span>
							</span>
						</span>
						<span class="fl-blurb">Coworkers locked in for the shift. One of you is the insider.</span>
						<span class="fl-sub">
							{lobby.seats.filter((s) => s.occupant.kind === 'open').length} of {lobby.seats.length} desks open
						</span>
					</button>
				{:else}
				{#each SIDE_ORDER as f (f)}
					{@const yours = f === side && lobby.seated}
					{@const n = lobby.countOn(f)}
					{@const full = n.taken >= n.total && !yours}
					<!-- Your own flag stays live in the click-through. On the wide layout it
					     is inert because all three panes are already on screen and re-picking
					     the side you hold does nothing — stepping through, it is the only
					     thing on the screen that means "yes, this one", and disabled it
					     leaves the first step with no way forward at all once both sides are
					     full. -->
					<button
						type="button"
						class="flag"
						class:on={yours}
						style:--sc={SIDES[f].tone}
						disabled={(!compact && yours) || full || !onpickside || locked}
						title={full ? `${SIDES[f].label} is full` : SIDES[f].blurb}
						onclick={() => pickSideStep(f)}
					>
						<!-- The FLAG, at the size of the decision. The HUD has drawn
						     these two banners beside every seat and every score since the
						     match starts — the one screen where you actually choose a side
						     was the only place showing a colour word instead. A player who
						     picks "Blue" and then spends the match reading a chevron on a
						     blue swallowtail has been shown two different things and told
						     they are one.

						     `TeamFlag` and not a copy of it: the flags are renameable
						     (`team-flags.svelte.ts`), so a picker with its own artwork is a
						     picker that goes stale the first time somebody names a side. -->
						<span class="fl-head">
							<TeamFlag faction={f} size={compact ? 'banner' : 'card'} />
							<span class="fl-titles">
								<span class="fl-tag">{SIDES[f].label}</span>
								<span class="fl-name">{teamFlags.get(f).name}</span>
							</span>
						</span>
						<!-- What the side actually plays like. It was a `title` — a
						     tooltip, on the screen where the decision is made, on a device
						     with no hover. Drawn only on the step layout, where the card is
						     half a screen tall; in the 288px rail beside the roster it
						     would be the tallest thing on the pane. -->
						<span class="fl-blurb">{SIDES[f].blurb}</span>
						<span class="fl-sub">
							{#if yours}
								{SIDES[f].call}
							{:else if full}
								side full
							{:else}
								{n.total - n.taken} open — switch
							{/if}
						</span>
					</button>
				{/each}
				{/if}
			</div>

			<div class="label">
				Available <span>{roster.filter((k) => !taken.has(k.key)).length}</span>
			</div>
			<div class="tiles" aria-disabled={!lobby.canChoose}>
				{#each roster as k (k.key)}
					{@const gone = taken.has(k.key) && mine?.key !== k.key}
					<button
						type="button"
						class="tile"
						class:on={mine?.key === k.key}
						class:gone
						disabled={!lobby.canChoose || !yourTurn || locked || gone}
						style:--kc={k.color}
						onclick={() => pickAgent(k)}
						onmouseenter={() => (hover = k.key)}
						onmouseleave={() => (hover = null)}
						onfocus={() => (hover = k.key)}
						onblur={() => (hover = null)}
					>
						<!-- The badge, not a body: a figure is whatever its player dressed it
						     as, so only the chest mark says which role this tile is. -->
						<span class="art"><RoleBadge klassKey={k.key} {side} size={36} /></span>
						<span class="meta">
							<span class="name">{k.name.replace(/^The /, '')}</span>
							<span class="sub">{gone ? 'taken' : k.resource}</span>
						</span>
						{#if mine?.key === k.key}<span class="check">✓</span>{/if}
					</button>
				{/each}

				{#each BENCH.filter((b) => b.faction === side) as b (b.name)}
					<div class="tile locked" title={b.note}>
						<span class="art empty">?</span>
						<span class="meta">
							<span class="name">{b.name}</span>
							<span class="sub">not in the box</span>
						</span>
					</div>
				{/each}
			</div>
		</aside>

		<main class="stage">
			<div class="glow"></div>
			<div class="grid" aria-hidden="true"></div>

			<!-- The whole table stands here, not just the character you are
			     hovering. Four people on one floor is what a player is choosing
			     INTO; a lone portrait is a catalogue entry. -->
			<div class="lineup">
				{#if lobby.office}
					<!-- Coworkers, not two teams: everybody on one floor. -->
					<Rank {lobby} seats={lobby.seats} side="red" mirrored={false} />
				{:else}
					<Rank {lobby} seats={ranks.red} side="red" mirrored={false} />
					<div class="vs"><span class="vs-mark">VS</span></div>
					<Rank {lobby} seats={ranks.blue} side="blue" mirrored />
				{/if}
			</div>

			{#if shown}
				<div class="plate">
					<div class="tag">
						{#if peeking && mine}
							Previewing · you hold {mine.name.replace(/^The /, '')}
						{:else if !lobby.canChoose}
							{lobby.blockedBecause}
						{:else if lobby.office}
							Loyal kit · the insider plays it the other way
						{:else}
							{SIDES[shown.faction].label} side
						{/if}
					</div>
					<h1 style:color={shown.color}>{shown.name}</h1>
					<p class="line">{shown.tagline}</p>
					{#if !lobby.office}
						<div class="seat">
							<span class="dot" style:background={shown.color}></span>
							Seat <b>{shown.seat}</b> · acts {ORDINAL[INITIATIVE.indexOf(shown.key)]} · spends
							<b>{shown.resource}</b>
						</div>
					{/if}
				</div>
			{/if}
		</main>

		<!-- No skills or passive here: they are the card game's numbers, and
		     the sheet read the same in a mode that never rolls them. The
		     character's own screens carry them where they apply. -->
		<aside class="detail">
			<div class="label">Table</div>
			<div class="roster">
				{#each lobby.seats as seat (seat.id)}
					{@const k = lobby.klassAt(seat.id)}
					{@const you = seat.id === lobby.youSeatId}
					{@const foe = seat.side !== side}
					<div class="row" class:you class:foe>
						<span class="chip" style:--kc={k ? k.color : '#334155'}>
							{#if k && (!foe || lobby.phase === 'ready')}
								<Figure klass={k} crop="chip" />
							{:else}
								<span class="q">?</span>
							{/if}
						</span>
						<span class="text">
							<b>
								{#if seat.occupant.kind === 'open'}
									Empty seat
								{:else if k && (!foe || lobby.phase === 'ready')}
									{k.name.replace(/^The /, '')}
								{:else}
									Choosing…
								{/if}
							</b>
							<i>
								<!-- The name as well as "you". The table names a player — it is how
								     the other three refer to them — and this row was the one place
								     it could have been read, so a player learned their own name
								     only by a housemate reading it off THEIR screen. -->
								{#if you}
									you{seat.occupant.kind === 'human' && seat.occupant.name
										? ` · ${seat.occupant.name}`
										: ''}
								{:else if seat.occupant.kind === 'ai'}
									<!-- Its name, not its category. Four rows reading
									     "demonstrator" is one opponent repeated; the whole
									     point of naming them is that the table has four
									     players in it. -->
									{seat.occupant.name}
								{:else if seat.occupant.kind === 'human'}
									{seat.occupant.name}
								{:else}
									waiting
								{/if}
							</i>
						</span>
						<span class="state" class:ok={!!k}>
							{k ? 'locked' : onTheClock === seat.id ? 'picking' : ''}
						</span>
					</div>
				{/each}
				{#each standing as m (m.user_id)}
					{@const isYou = m.user_id === socket?.view?.you_id}
					<div class="row standing" class:you={isYou}>
						<span class="chip"><span class="q">◦</span></span>
						<span class="text">
							<b>{m.name}</b>
							<i>{isYou ? 'you · pick a side to sit down' : 'here · no chair yet'}</i>
						</span>
						<span class="state">standing</span>
					</div>
				{/each}
			</div>
		</aside>
	</div>

	<footer>
		<!-- ── You ───────────────────────────────────────────────────────────
		     A player card, not a label beside a pencil. Every lobby a player
		     has used opens on their own banner in the corner: who they are, the
		     side they are on, the character they hold — the three facts the
		     rest of the screen is arranging around them. -->
		<div class="me" style:--kc={mine?.color ?? SIDES[side].tone} style:--sc={mine?.color ?? SIDES[side].tone}>
			<span class="me-badge">
				{#if mine}
					<RoleBadge klassKey={mine.key} {side} size={30} />
				{:else if lobby.seated && !lobby.office}
					<!-- Your side before your character: the half of the answer
					     you already have, rather than a question mark. -->
					<TeamFlag faction={side} size="card" />
				{:else}
					<span class="q">?</span>
				{/if}
			</span>
			<span class="me-text">
				<Handle />
				<span class="me-sub">
					{#if !lobby.seated}
						not seated
					{:else if lobby.office}
						desk {lobby.youSeatId}{mine ? ` · ${mine.name.replace(/^The /, '')}` : ''}
					{:else}
						<b style:color={SIDES[side].tone}>{teamFlags.get(side).name}</b>
						· {mine ? mine.name.replace(/^The /, '') : 'no character'}
					{/if}
				</span>
			</span>
		</div>

		<!-- ── The match ─────────────────────────────────────────────────────
		     One card for the table's rules. The host turns them; everybody
		     else reads them, because "what are we about to play" is a question
		     the whole table has, not only the person holding the levers. -->
		<div class="match">
			<span class="card-k">match</span>
			{#if rulesOpen}
				<div class="match-row">
					{#if onvariant}
						<StepSwitcher
							variant="tile"
							icon="layers"
							caption="game"
							label="Game"
							options={VARIANT_OPTIONS}
							value={lobby.variant}
							onpick={(v) => onvariant(v as TableVariant)}
							width="150px"
						/>
					{/if}
					<StepSwitcher
						variant="tile"
						icon="users"
						caption={lobby.office ? 'players' : 'teams'}
						label="Match size"
						options={SIZE_OPTIONS}
						value={lobby.size}
						onpick={(v) => onsize?.(v as MatchSize)}
						width="92px"
					/>
				</div>
			{:else}
				<span class="match-ro">
					{VARIANT_OPTIONS.find((o) => o.value === lobby.variant)?.label ?? lobby.variant}
					· {sizesFor(lobby.variant).find((s) => s.id === lobby.size)?.label ?? lobby.size}
					{#if !isHost}<i>host's call</i>{/if}
				</span>
			{/if}
			{#if lobby.variant === 'insider_threat' && MAP_OPTIONS.length > 1}
				<StepSwitcher
					variant="tile"
					icon="globe"
					caption="map"
					label="Map"
					options={MAP_OPTIONS}
					value={gameDev.map ?? MAPS[0].id}
					onpick={(v) => (gameDev.map = v === MAPS[0].id ? null : v)}
					width="150px"
				/>
			{/if}
			{#if rulesOpen}
				<!-- ── No mode picker ────────────────────────────────────────────
				     The engine still knows three ways to hand characters out and a
				     host may still set them (`setMode` routes to the server, which
				     allows all three). This SCREEN offers one, because the other two
				     delete it: by-lot deals four characters in a ceremony nobody
				     participates in, and free pick is a menu. The draft — turn order,
				     on the clock, reading what the table has already taken — is the
				     minute this screen exists for, and a control offering to skip it
				     is a control most tables press once and never see the screen
				     again. -->
			{/if}
		</div>

		<!-- The slack. Everything left of it is anchored left and everything
		     right of it is anchored right, so a match card that grows or shrinks
		     with the game moves nothing but this gap. -->
		<div class="hint">
			{#if error}
				<span class="err">{error}</span>
			{:else if !lobby.seated}
				<!-- Ahead of the seats-still-open line, which describes the TABLE and
				     reads as something to wait out. This is the reader's own missing
				     act: arriving put them in the room, and nothing on screen said
				     the chair was still a decision they had to make. -->
				<b>You are not seated.</b> Pick <b>red</b> or <b>blue</b> to take a chair.
			{:else if !lobby.canChoose}
				<!-- Deliberately silent. The header already counts the open seats and
				     the footer already offers the bots; a sentence restating both is
				     the same fact told a third time. -->
			{:else if !yourTurn}
				Waiting on seat <b>{onTheClock}</b> to choose.
			{:else if mine}
				<b style:color={mine.color}>{mine.name}</b> — yours.
			{:else}
				Take a character. Your seat is already decided.
			{/if}
		</div>

		<!-- ── Actions ───────────────────────────────────────────────────────
		     Tiles with their key on them. A row of identical uppercase pills
		     made the one that unblocks the table (bots, invite) look exactly as
		     optional as the one that changes your shirt. -->
		<div class="acts">
			{#if isHost && !lobby.canChoose && onfill}
				<button type="button" class="act hot" disabled={filling} onclick={onfill}>
					<Icon name="cpu" size={15} />
					<span>{filling ? 'filling…' : 'fill with bots'}</span>
					<kbd>B</kbd>
				</button>
			{/if}
			<!-- Host only. A player who followed a link is already at the table —
			     handing them the link that got them here is an invitation to a
			     room they are standing in. Before there is a table this is what
			     creates one, so it reads as the act rather than as a clipboard. -->
			{#if isHost && oncopy}
				<button type="button" class="act" class:hot={!lobby.canChoose && !onfill} disabled={busy} onclick={oncopy}>
					<Icon name={copied ? 'check' : invite ? 'copy' : 'link'} size={15} />
					<span>
						{#if busy}
							opening…
						{:else if !invite}
							invite
						{:else}
							{copied ? 'copied' : 'copy invite'}
						{/if}
					</span>
					<kbd>I</kbd>
				</button>
			{/if}
			<button type="button" class="act" onclick={() => (dressing = true)}>
				<Icon name="palette" size={15} />
				<span>customise</span>
				<kbd>C</kbd>
			</button>
			{#if leaders !== null}
				<button type="button" class="act" onclick={openStandings}>
					<Icon name="bar-chart-2" size={15} />
					<span>standings</span>
					<kbd>S</kbd>
				</button>
			{/if}
		</div>

		<!-- The fill meter rides on the button it is blocking. "3 seats still
		     open" on a dead button is a sentence; a bar with three dark
		     segments is a gauge the eye reads before the words. -->
		<button type="button" class="go" class:ready={primary.live} disabled={!primary.live} onclick={go}>
			<span class="fill" aria-hidden="true">
				{#each lobby.seats as s (s.id)}
					<i
						class:on={s.occupant.kind !== 'open'}
						class:locked={!!lobby.klassAt(s.id)}
						style:--sc={SIDES[s.side].tone}
					></i>
				{/each}
			</span>
			<span class="go-row">
				<span class="go-label">{primary.label}</span>
				{#if primary.live}<kbd>↵</kbd>{/if}
			</span>
		</button>
	</footer>
</div>

<!-- The studio. Over everything, because the rails and the footer are the
     lobby's controls and none of them apply while you are dressing.
     The library's `Modal` rather than a hand-rolled scrim and box: it is the
     same picture, and it brings the focus trap, Escape and backdrop dismissal
     that the hand-rolled one had to re-earn one keydown handler at a time.
     The shop sits after it so it opens on top. -->
<Modal open={dressing} size="full" title="The Outfitter" onclose={undress}>
	<Outfitter
		{fit}
		klassKey={mine?.key}
		klassName={mine?.name}
		{side}
		ondone={undress}
		onshop={() => (shopping = true)}
	/>
</Modal>
<MarksShop open={shopping} {fit} side={mine ? side : null} onclose={() => (shopping = false)} />

<Modal open={standingsOpen} size="md" title="Standings" onclose={() => (standingsOpen = false)}>
	{#if leaders}<Standings {leaders} />{/if}
</Modal>

<style>
	.select {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		/* Not opaque. The lobby paints Current Field behind all three screens, and
		   a select screen with a solid plate would be the one place the room stops
		   moving — which reads as the app having frozen at the exact moment it is
		   waiting on other people. */
		background: radial-gradient(
				120% 90% at 50% 0%,
				color-mix(in srgb, var(--tone) 12%, transparent),
				transparent 60%
			),
			rgb(5 7 12 / 0.82);
		color: #e2e8f0;
		overflow: hidden;
	}

	header {
		display: flex;
		align-items: center;
		gap: 2rem;
		padding: 0.85rem 1.5rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.07);
		background: rgb(0 0 0 / 0.35);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex: 1;
	}
	.mark {
		width: 26px;
		height: 26px;
		clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%);
		background: linear-gradient(160deg, var(--tone), color-mix(in srgb, var(--tone) 30%, #0b1220));
	}
	.title {
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: 0.24em;
		text-transform: uppercase;
	}
	.brand .sub {
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #64748b;
		margin-top: 2px;
	}
	.gate {
		text-align: center;
	}
	.gate-h {
		font-family: ui-monospace, monospace;
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #fbbf24;
	}
	.gate.open .gate-h {
		color: #34d399;
	}
	.gate-s {
		font-size: 0.53rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #64748b;
		margin-top: 4px;
	}
	.order {
		flex: 1;
		display: flex;
		justify-content: flex-end;
	}

	.body {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 288px minmax(0, 1fr) 320px;
	}
	.rail,
	.detail {
		padding: 1.1rem 1.1rem 1.4rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.rail {
		border-right: 1px solid rgb(255 255 255 / 0.06);
		background: linear-gradient(90deg, rgb(0 0 0 / 0.4), transparent);
	}
	.detail {
		border-left: 1px solid rgb(255 255 255 / 0.06);
		background: linear-gradient(270deg, rgb(0 0 0 / 0.4), transparent);
	}

	/* Two flags, STACKED. The one you hold keeps the full plate treatment the
	   single one had; the other is dimmed to a control, so the pair reads as
	   "you are here, that is over there" rather than as two equal choices you
	   have somehow both got.

	   Side by side is what this was, and it stopped working the moment the card
	   grew a banner: 1fr of a 288px rail is ~133px, which is narrower than a
	   46px flag plus a team name — so the second card was clipped off the rail's
	   right edge and the pane grew a horizontal scrollbar. The rail is a tall
	   thin column with room to spare below the roster; height is the axis it has
	   and width is the one it does not. */
	.flags {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.4rem;
	}
	.flag {
		position: relative;
		display: block;
		width: 100%;
		min-width: 0;
		text-align: left;
		padding: 0.7rem 0.7rem 0.7rem 0.85rem;
		border-radius: 9px;
		border: 1px solid rgb(255 255 255 / 0.08);
		background: rgb(255 255 255 / 0.02);
		cursor: pointer;
		transition: all 0.15s;
	}
	.flag:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--sc) 55%, transparent);
		background: color-mix(in srgb, var(--sc) 10%, transparent);
	}
	/* Yours. Disabled because there is nowhere to go, so it must not look like a
	   dead control — it is a plate that happens to be a button. */
	.flag.on {
		cursor: default;
		border-color: color-mix(in srgb, var(--sc) 55%, transparent);
		background: linear-gradient(
			100deg,
			color-mix(in srgb, var(--sc) 20%, transparent),
			transparent 72%
		);
	}
	.flag:disabled:not(.on) {
		opacity: 0.4;
		cursor: default;
	}
	/* The banner leads and the words follow it. Baseline-aligned to the flag's
	   own centre rather than to the top of the block: the swallowtail is a wide
	   short shape and a name hung off its top edge reads as a caption under a
	   picture instead of as the name ON the flag. */
	.fl-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.fl-titles {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 3px;
	}
	/* The engine's word for the side, kept small and above. It is how every other
	   surface in the game is keyed — the spines, the pips, the score — so
	   dropping it entirely would leave the one screen that names the team unable
	   to say which half of the board it is. */
	.fl-tag {
		display: block;
		font-size: 0.5rem;
		font-weight: 800;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--sc) 70%, #94a3b8);
	}
	.fl-name {
		display: block;
		font-size: 0.86rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--sc);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.fl-sub {
		display: block;
		font-size: 0.66rem;
		color: #94a3b8;
		margin-top: 6px;
	}
	/* Off by default. The rail is a 288px column with a roster under it; this
	   line only exists for the layout where the two flags ARE the screen. */
	.fl-blurb {
		display: none;
	}

	.label {
		font-size: 0.55rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: #64748b;
		margin-top: 0.5rem;
		display: flex;
		gap: 0.4rem;
	}
	.label span {
		color: #334155;
	}
	.tiles {
		display: grid;
		gap: 0.4rem;
	}
	.tiles[aria-disabled='true'] {
		opacity: 0.55;
	}
	.tile {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0;
		border-radius: 9px;
		border: 1px solid rgb(255 255 255 / 0.08);
		background: rgb(255 255 255 / 0.02);
		cursor: pointer;
		overflow: hidden;
		text-align: left;
		transition: all 0.18s;
	}
	.tile:hover:not(:disabled) {
		background: color-mix(in srgb, var(--kc) 10%, transparent);
		border-color: color-mix(in srgb, var(--kc) 40%, transparent);
		transform: translateX(3px);
	}
	.tile.on {
		border-color: var(--kc);
		background: linear-gradient(100deg, color-mix(in srgb, var(--kc) 26%, transparent), transparent 75%);
	}
	.tile:disabled {
		cursor: default;
	}
	.tile.gone {
		opacity: 0.3;
	}
	.tile.locked {
		opacity: 0.4;
	}
	.art {
		width: 64px;
		height: 64px;
		flex: none;
		display: grid;
		place-items: center;
		background: linear-gradient(180deg, color-mix(in srgb, var(--kc, #334155) 22%, transparent), transparent);
	}
	.art.empty {
		font-size: 1.1rem;
		font-weight: 800;
		color: #334155;
	}
	.meta {
		display: grid;
		gap: 2px;
		padding-right: 0.6rem;
		min-width: 0;
	}
	.name {
		font-size: 0.8rem;
		font-weight: 700;
	}
	.meta .sub {
		font-family: ui-monospace, monospace;
		font-size: 0.53rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #64748b;
	}
	.check {
		position: absolute;
		top: 6px;
		right: 8px;
		font-size: 0.7rem;
		color: var(--kc);
	}

	.stage {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		min-height: 0;
		overflow: hidden;
	}
	/* Both ranks crowd the middle, where the VS is. Pushed to the outer edges
	   they are two groups on one screen; pulled in they are a confrontation. */
	.lineup {
		flex: 1;
		min-height: 0;
		width: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: end;
		gap: 4px;
		padding: 1.4rem 0.5rem 0;
	}
	/* On the ground line with the figures, not centred in the box: it marks
	   where the two ranks meet, and that is down where they are standing. */
	.vs {
		align-self: end;
		padding: 0 6px 78px;
		font-family: var(--mono, ui-monospace, monospace);
		font-size: 0.9rem;
		letter-spacing: 0.26em;
		color: #64748b;
	}

	.glow {
		position: absolute;
		left: 50%;
		bottom: 8%;
		width: 70%;
		aspect-ratio: 1;
		transform: translateX(-50%);
		border-radius: 50%;
		background: radial-gradient(circle, color-mix(in srgb, var(--pick) 26%, transparent), transparent 62%);
		filter: blur(8px);
		transition: background 0.4s;
	}
	.grid {
		position: absolute;
		inset: auto 0 0 0;
		height: 42%;
		background-image:
			linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgb(255 255 255 / 0.05) 1px, transparent 1px);
		background-size: 46px 46px;
		mask-image: linear-gradient(transparent, #000 60%, transparent);
		transform: perspective(340px) rotateX(62deg);
		transform-origin: bottom;
	}
	.plate {
		position: relative;
		text-align: center;
		padding: 0.6rem 1rem 1.4rem;
		width: 100%;
	}
	.tag {
		font-size: 0.53rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: #64748b;
	}
	.plate h1 {
		font-size: clamp(1.7rem, 3.8vw, 2.8rem);
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin: 0.15rem 0 0;
		line-height: 1;
		text-shadow: 0 0 42px color-mix(in srgb, var(--pick) 45%, transparent);
	}
	.line {
		margin: 0.45rem 0 0;
		font-size: 0.8rem;
		color: #94a3b8;
		font-style: italic;
	}
	.seat {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.7rem;
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		border: 1px solid rgb(255 255 255 / 0.09);
		background: rgb(255 255 255 / 0.03);
		font-family: ui-monospace, monospace;
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #94a3b8;
	}
	.seat b {
		color: #e2e8f0;
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.roster {
		display: grid;
		gap: 0.3rem;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.35rem 0.5rem;
		border-radius: 7px;
		border: 1px solid transparent;
		background: rgb(255 255 255 / 0.02);
	}
	.row.you {
		border-color: color-mix(in srgb, var(--tone) 45%, transparent);
		background: color-mix(in srgb, var(--tone) 10%, transparent);
	}
	/* Dashed, because a standing member is not a chair — the roster reads as a
	   list of seats and these rows must not be mistaken for more of them. */
	.row.standing {
		background: none;
		border-style: dashed;
		border-color: rgb(255 255 255 / 0.14);
	}
	.row.foe {
		opacity: 0.55;
	}
	.chip {
		width: 30px;
		height: 30px;
		flex: none;
		display: grid;
		place-items: center;
		border-radius: 6px;
		overflow: hidden;
		background: color-mix(in srgb, var(--kc) 18%, transparent);
	}
	.q {
		font-size: 0.75rem;
		font-weight: 800;
		color: #475569;
	}
	.text {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	.text b {
		font-size: 0.72rem;
		font-weight: 700;
	}
	.text i {
		font-size: 0.53rem;
		font-style: normal;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #64748b;
	}
	.state {
		font-size: 0.5rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #64748b;
	}
	.state.ok {
		color: #34d399;
	}

	/* ── The command bar ──────────────────────────────────────────────────────
	   Panels, not a line of text: you, the match, the actions, the button. Each
	   is a framed card so the eye lands on four things rather than scanning a
	   dozen same-weight labels for the one it wants. */
	footer {
		position: relative;
		display: flex;
		align-items: stretch;
		gap: 0.75rem;
		padding: 0.75rem 1.25rem;
		border-top: 1px solid color-mix(in srgb, var(--tone) 30%, transparent);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--tone) 7%, transparent), transparent 70%),
			rgb(0 0 0 / 0.55);
		backdrop-filter: blur(6px);
	}
	/* A lit seam along the top edge, in the side's colour: the bar belongs to
	   the team you are on. */
	footer::before {
		content: '';
		position: absolute;
		inset: -1px 15% auto;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--tone), transparent);
		opacity: 0.8;
	}
	/* The dev cluster is fixed bottom-right over everything; without the room
	   it sits on top of the start button. */
	:global(body:has([data-devcog])) footer {
		padding-right: 76px;
	}

	.me,
	.match,
	.acts {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.7rem;
		border-radius: 10px;
		border: 1px solid rgb(255 255 255 / 0.07);
		background: rgb(255 255 255 / 0.025);
	}

	/* Fixed, not sized to its text: it is the bar's left anchor, and a card
	   that resized with a longer character name shoved the match card along
	   with it. */
	.me {
		flex: none;
		width: 248px;
		border-color: color-mix(in srgb, var(--kc) 35%, transparent);
		background: linear-gradient(100deg, color-mix(in srgb, var(--kc) 16%, transparent), transparent 80%);
	}
	.me-badge {
		width: 52px;
		height: 44px;
		flex: none;
		display: grid;
		place-items: center;
		border-radius: 8px;
		background: color-mix(in srgb, var(--kc) 22%, rgb(0 0 0 / 0.4));
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--kc) 50%, transparent);
	}
	.me-text {
		display: grid;
		gap: 3px;
		min-width: 0;
		--fg: #f1f5f9;
	}
	/* Handle draws its name at a caption size; on the card it is the title. */
	.me-text :global(.text) {
		font-size: 0.82rem;
		font-weight: 800;
	}
	/* While renaming, the field's rule line takes the subtitle's slot, so the
	   card stays two lines tall instead of growing a third. */
	.me-text:has(:global(form)) .me-sub {
		display: none;
	}
	.me-sub {
		font-size: 0.52rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #64748b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.me-sub b {
		font-weight: 800;
	}

	.card-k {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.48rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: #475569;
	}
	.match {
		padding: 0.3rem 0.6rem 0.3rem 0.4rem;
	}
	.match-row {
		display: flex;
		gap: 0.2rem;
	}
	.match-ro {
		display: grid;
		gap: 2px;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #e2e8f0;
	}
	.match-ro i {
		font-style: normal;
		font-size: 0.5rem;
		letter-spacing: 0.16em;
		color: #64748b;
	}

	.acts {
		gap: 0.3rem;
		padding: 0.3rem;
	}
	.act {
		position: relative;
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 4px;
		min-width: 74px;
		height: 100%;
		padding: 0.4rem 0.55rem 0.35rem;
		border-radius: 7px;
		border: 1px solid transparent;
		background: transparent;
		color: #94a3b8;
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}
	.act:hover:not(:disabled),
	.act:focus-visible {
		background: rgb(255 255 255 / 0.06);
		border-color: rgb(255 255 255 / 0.12);
		color: #f8fafc;
	}
	/* The action that unblocks the table, lit in the side's colour. */
	.act.hot {
		color: color-mix(in srgb, var(--tone) 60%, #fff);
		border-color: color-mix(in srgb, var(--tone) 45%, transparent);
		background: color-mix(in srgb, var(--tone) 14%, transparent);
	}
	.act:disabled {
		opacity: 0.5;
		cursor: default;
	}
	kbd {
		position: absolute;
		top: 3px;
		right: 4px;
		min-width: 13px;
		padding: 0 3px;
		border-radius: 3px;
		border: 1px solid rgb(255 255 255 / 0.14);
		border-bottom-width: 2px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.48rem;
		line-height: 1.5;
		color: #64748b;
	}

	.hint {
		align-self: center;
		font-size: 0.75rem;
		color: #94a3b8;
		/* Takes the slack so the cards stay left and the button stays right —
		   without it the children space out and the hint drifts around as its
		   own text changes length. */
		flex: 1;
	}
	.err {
		color: #fb7185;
	}

	/* ── The button ───────────────────────────────────────────────────────────
	   Angled, oversized, and carrying the fill meter. Dead, it is a gauge of
	   what the table is waiting on; live, it is the brightest thing on screen
	   and breathes so the room knows who it is waiting on now. */
	.go {
		position: relative;
		display: grid;
		align-content: center;
		gap: 7px;
		min-width: 260px;
		padding: 0.6rem 1.6rem 0.65rem;
		clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px);
		border: 0;
		background: rgb(255 255 255 / 0.05);
		color: #64748b;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		cursor: not-allowed;
		transition:
			background 0.25s,
			color 0.25s;
	}
	.fill {
		display: flex;
		gap: 4px;
	}
	.fill i {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: rgb(255 255 255 / 0.1);
		transition: background 0.3s;
	}
	.fill i.on {
		background: color-mix(in srgb, var(--sc) 55%, transparent);
	}
	.fill i.locked {
		background: var(--sc);
		box-shadow: 0 0 8px var(--sc);
	}
	.go-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
	}
	.go kbd {
		position: static;
		color: inherit;
		border-color: currentColor;
		opacity: 0.6;
	}
	.go.ready {
		cursor: pointer;
		color: #05070c;
		background: linear-gradient(100deg, var(--pick), color-mix(in srgb, var(--pick) 70%, #fff));
		animation: breathe 1.8s ease-in-out infinite;
	}
	.go.ready .fill i {
		background: rgb(0 0 0 / 0.35);
		box-shadow: none;
	}
	.go.ready:hover {
		filter: brightness(1.12);
	}
	@keyframes breathe {
		50% {
			filter: brightness(1.15) drop-shadow(0 0 14px color-mix(in srgb, var(--pick) 70%, transparent));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.go.ready {
			animation: none;
		}
	}

	/* ── Below the table breakpoint ───────────────────────────────────────────
	   One column, read top to bottom: pick, then who you picked, then the
	   button. The three-column grid held all three tracks at their desktop
	   widths, so on a phone the portrait and the character sheet were not
	   cramped — they were off the right edge entirely, and the only control
	   that starts a match went with them.

	   1280px is the same line `Breach.svelte` draws for the HUD. There is no
	   second one, deliberately: two breakpoints in one screen is two layouts
	   nobody can hold in their head at once. */
	@media (max-width: 1279.98px) {
	/* ── One question at a time ──────────────────────────────────────────────
	   The same three panes the wide layout puts side by side, revealed one at a
	   time instead of stacked into a column you scroll. Nothing here restyles
	   anything — the flags, the tiles, the stage and the detail keep every rule
	   they already had; the step only decides which of them is on screen.

	   Display, not opacity or a transform: a hidden pane must not hold height in
	   the flex column, and `.tiles` must not stay in the tab order behind the
	   screen you are actually on. */
	.select[data-step] .back {
		display: grid;
	}
	.select[data-step='side'] .label,
	.select[data-step='side'] .tiles,
	.select[data-step='side'] .stage,
	.select[data-step='side'] .detail {
		display: none;
	}
	/* The flags stay up on every step: a side is switchable until the match
	   starts, and a screen with no flags on it left no way back to one. */
	.select[data-step='agent'] .stage,
	.select[data-step='agent'] .detail {
		display: none;
	}
	.select[data-step='confirm'] .rail > :not(.flags) {
		display: none;
	}
	.select[data-step='confirm'] .body .rail {
		flex: 0 0 auto;
	}

	/* ── The side step is a CHOICE, not a header ─────────────────────────────
	   On this step the flags are the only thing on screen, and they were still
	   drawn at the size they are in a 288px rail beside a roster — two short
	   chips pinned to the top of the frame with two thirds of the window empty
	   underneath them. A screen whose whole question is "which of these two"
	   should be two of these two.

	   `grid-auto-rows: 1fr` and not `50%`: the rail keeps its padding and its
	   gap, and halves that do not know about either overflow the pane by exactly
	   the sum of the two.

	   The stacking is the base rule's, not this one's — see `.flags`. */
	.select[data-step='side'] .flags {
		flex: 1 1 auto;
		min-height: 0;
		grid-auto-rows: 1fr;
		gap: 0.7rem;
	}
	.select[data-step='side'] .flag {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.15rem;
		padding: 1.1rem 1.2rem;
		border-radius: 14px;
	}
	.select[data-step='side'] .fl-head {
		gap: 0.9rem;
	}
	.select[data-step='side'] .fl-name {
		font-size: 1.3rem;
		letter-spacing: 0.08em;
		white-space: normal;
	}
	.select[data-step='side'] .fl-tag {
		font-size: 0.56rem;
	}
	.select[data-step='side'] .fl-blurb {
		display: block;
		margin-top: 0.8rem;
		font-size: 0.76rem;
		line-height: 1.45;
		color: #cbd5e1;
	}
	.select[data-step='side'] .fl-sub {
		margin-top: 0.55rem;
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	/* The pane on screen is the whole screen, and the footer stays welded to the
	   bottom of the frame — the primary action is never something you scroll to
	   find. */
	.select[data-step] .body {
		flex: 1 1 auto;
		min-height: 0;
	}
	.select[data-step] .rail,
	.select[data-step] .stage,
	.select[data-step] .detail {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
	}

	.back {
		display: none;
		place-items: center;
		width: 44px;
		height: 44px;
		flex: none;
		margin-inline-end: 0.25rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
	}
	.back svg {
		width: 20px;
		height: 20px;
	}
	.back:disabled {
		opacity: 0.3;
		cursor: default;
	}

		header {
			flex-wrap: wrap;
			gap: 0.5rem 0.9rem;
			padding: max(0.6rem, var(--safe-t)) max(0.9rem, var(--safe-r)) 0.6rem
				max(0.9rem, var(--safe-l));
		}
		.brand {
			gap: 0.5rem;
			min-width: 0;
		}
		.mark {
			width: 20px;
			height: 20px;
		}
		.title {
			font-size: 0.72rem;
			letter-spacing: 0.16em;
		}
		.brand .sub {
			font-size: 0.5rem;
		}
		.gate {
			flex: 0 1 auto;
			min-width: 0;
			text-align: right;
		}
		.gate-h {
			font-size: 0.7rem;
		}
		.gate-s {
			font-size: 0.46rem;
			letter-spacing: 0.12em;
		}
		/* Its own row. The pips are fixed-width chips and the title's tracking
		   does not compress, so sharing a line is what pushed the seat strip
		   past the right edge. */
		.order {
			flex: 1 0 100%;
			justify-content: flex-start;
		}

		/* A flex column, not a one-column grid. The grid sized the middle track
		   from its item's MINIMUM contribution, which is zero for a box that
		   sets `min-height: 0` and clips its overflow — so the portrait row
		   collapsed to 0px and the character was never drawn at all. A column
		   of unshrinkable items takes its height from its content and cannot
		   do that. */
		.body {
			display: flex;
			flex-direction: column;
			overflow-y: auto;
			overflow-x: hidden;
		}
		.rail,
		.stage,
		.detail {
			flex: none;
		}
		/* One scroller for the whole column, not one per panel: three stacked
		   scroll regions means the reader has to find the right one before the
		   page will move at all. */
		.rail,
		.detail {
			overflow: visible;
			padding: 0.9rem max(0.9rem, var(--safe-r)) 1rem max(0.9rem, var(--safe-l));
		}
		.rail {
			border-right: 0;
			border-bottom: 1px solid rgb(255 255 255 / 0.06);
			background: linear-gradient(180deg, rgb(0 0 0 / 0.4), transparent);
		}
		.detail {
			border-left: 0;
			border-top: 1px solid rgb(255 255 255 / 0.06);
			background: linear-gradient(0deg, rgb(0 0 0 / 0.4), transparent);
		}

		/* Stated, because the desktop rule sets `min-height: 0` so the stage can
		   shrink inside a full-height column — here there is nothing to shrink
		   into and that zero is the thing that loses the portrait. */
		.stage {
			min-height: min-content;
		}
		/* The line-up stops being the flexible row of a full-height column, so
		   it has to carry a height of its own. */
		.lineup {
			flex: none;
			height: clamp(200px, 38vh, 340px);
			padding-top: 1rem;
		}
		.plate {
			padding: 0.5rem max(0.9rem, var(--safe-r)) 1rem max(0.9rem, var(--safe-l));
		}
		.plate h1 {
			font-size: clamp(1.35rem, 6.5vw, 2rem);
		}
		.line {
			font-size: 0.75rem;
		}

		footer {
			flex-wrap: wrap;
			gap: 0.5rem 0.7rem;
			padding: 0.6rem max(0.9rem, var(--safe-r)) max(0.6rem, var(--safe-b))
				max(0.9rem, var(--safe-l));
		}
		.me,
		.match,
		.acts {
			flex: 1 1 auto;
			flex-wrap: wrap;
		}
		/* No keys on a phone, and the tile labels are what a thumb aims at. */
		kbd,
		.card-k {
			display: none;
		}
		.act {
			min-height: 48px;
			flex: 1 0 auto;
		}
		.hint {
			flex: 1 0 100%;
			font-size: 0.68rem;
		}
		/* Full width, and tall enough to be hit by a thumb. */
		.go {
			flex: 1 0 100%;
			min-width: 0;
			min-height: 52px;
			padding: 0.6rem 1rem;
			font-size: 0.72rem;
		}
	}
</style>
