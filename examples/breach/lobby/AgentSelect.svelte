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

	import { Figure, StepSwitcher } from 'showcase';
	import {
		ASSIGNMENT_MODES,
		rosterFor,
		type AssignmentMode,
		type BreachLobby
	} from '../internal/lobby.svelte.js';
	import {
		BENCH,
		INITIATIVE,
		MATCH_SIZES,
		type Faction,
		type Klass,
		type MatchSize
	} from '../internal/rules.js';
	import type { TableSocket } from '../net.svelte.js';
	import { ORDINAL, SIDES } from './sides.js';
	// The existing four-number block, not a new one — it already renders in the
	// rail and the target sheet, and a fourth copy of the same row is how three
	// screens end up describing one character three ways.
	import SkillGrid from '../parts/SkillGrid.svelte';
	import SeatStrip from './SeatStrip.svelte';

	interface Props {
		lobby: BreachLobby;
		socket?: TableSocket | null;
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
		oncopy?: () => void;
		onfill?: () => void;
		onsize?: (s: MatchSize) => void;
		onmode?: (m: AssignmentMode) => void;
		/** Move to a side. The rail's flags call this directly rather than
		 *  reopening the sides panel — switching is one click, and a panel that
		 *  opens only to be clicked once and dismissed is a dialog standing in
		 *  for a button. */
		onpickside?: (side: Faction) => void;
	}

	let {
		lobby,
		socket = null,
		onenter,
		invite = null,
		copied = false,
		busy = false,
		error = null,
		oncopy,
		onfill,
		onsize,
		onmode,
		onpickside
	}: Props = $props();

	/** Fixed order, so the two flags never swap places under the reader when the
	 *  side they hold changes. */
	const SIDE_ORDER = ['red', 'blue'] as const satisfies readonly Faction[];

	let hover = $state<string | null>(null);

	const side = $derived(lobby.yourSide);
	const roster = $derived(rosterFor(side));
	/** Characters already spoken for, so the rail can grey them rather than
	 *  letting two people race for the same one. */
	const taken = $derived(new Set(lobby.seats.map((s) => s.klassKey).filter(Boolean) as string[]));

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

	// The two rule sets, in the shape the shared control takes. `blurb` becomes
	// `description` and shows in the menu, so the gloss the deleted setup screen
	// printed under each card is not lost by moving the choice into a footer.
	const SIZE_OPTIONS = MATCH_SIZES.map((s) => ({
		value: s.id,
		label: s.label,
		description: s.blurb
	}));
	const MODE_OPTIONS = ASSIGNMENT_MODES.map((m) => ({
		value: m.id,
		label: m.label,
		description: m.blurb
	}));

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
</script>

<div class="select" style:--tone={SIDES[side].tone} style:--pick={shown?.color ?? '#64748B'}>
	<header>
		<div class="brand">
			<span class="mark" aria-hidden="true"></span>
			<div>
				<div class="title">Agent Select</div>
				<div class="sub">
					Breach · {lobby.seats.length === 2 ? '1v1' : '2v2'} · {lobby.mode}
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
				{#each SIDE_ORDER as f (f)}
					{@const yours = f === side && lobby.seated}
					{@const n = lobby.countOn(f)}
					{@const full = n.taken >= n.total && !yours}
					<button
						type="button"
						class="flag"
						class:on={yours}
						style:--sc={SIDES[f].tone}
						disabled={yours || full || !onpickside || locked}
						title={full ? `${SIDES[f].label} is full` : SIDES[f].blurb}
						onclick={() => onpickside?.(f)}
					>
						<span class="fl-name">{SIDES[f].label}</span>
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
						onclick={() => choose(k)}
						onmouseenter={() => (hover = k.key)}
						onmouseleave={() => (hover = null)}
						onfocus={() => (hover = k.key)}
						onblur={() => (hover = null)}
					>
						<span class="art"><Figure klass={k} crop="bust" /></span>
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

			{#if shown}
				<div class="figure" class:idle={!mine}>
					<div class="hero"><Figure klass={shown} crop="hero" shadow /></div>
				</div>

				<div class="plate">
					<div class="tag">
						{#if peeking && mine}
							Previewing · you hold {mine.name.replace(/^The /, '')}
						{:else if !lobby.canChoose}
							{lobby.blockedBecause}
						{:else}
							{SIDES[shown.faction].label} side
						{/if}
					</div>
					<h1 style:color={shown.color}>{shown.name}</h1>
					<p class="line">{shown.tagline}</p>
					<div class="seat">
						<span class="dot" style:background={shown.color}></span>
						Seat <b>{shown.seat}</b> · acts {ORDINAL[INITIATIVE.indexOf(shown.key)]} · spends
						<b>{shown.resource}</b>
					</div>
				</div>
			{/if}
		</main>

		<aside class="detail">
			{#if shown}
				<div class="label">Skills</div>
				<SkillGrid klass={shown} />
				<div class="label">Passive</div>
				<div class="passive" style:--kc={shown.color}>
					<div class="pname">{shown.passive.name}</div>
					<p>{shown.passive.text}</p>
				</div>
			{/if}
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
									demonstrator
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
		<div class="levers">
			{#if rulesOpen}
				<div class="lever">
					<span class="lever-k">size</span>
					<StepSwitcher
						label="Match size"
						options={SIZE_OPTIONS}
						value={lobby.size}
						onpick={(v) => onsize?.(v as MatchSize)}
						width="150px"
					/>
				</div>
				<div class="lever">
					<span class="lever-k">characters</span>
					<StepSwitcher
						label="How characters are handed out"
						options={MODE_OPTIONS}
						value={lobby.mode}
						onpick={(v) => onmode?.(v as AssignmentMode)}
						width="150px"
					/>
				</div>
			{/if}
			{#if isHost && !lobby.canChoose && onfill}
				<button type="button" class="lv" onclick={onfill}>fill with demonstrators</button>
			{/if}
			<!-- Host only. A player who followed a link is already at the table —
			     handing them the link that got them here is an invitation to a
			     room they are standing in. Before there is a table this is what
			     creates one, so it reads as the act rather than as a clipboard. -->
			{#if isHost && oncopy}
				<button type="button" class="lv ghost" disabled={busy} onclick={oncopy}>
					{#if busy}
						opening…
					{:else if !invite}
						invite someone
					{:else}
						{copied ? 'link copied' : 'copy invite'}
					{/if}
				</button>
			{/if}
		</div>
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
				Nobody picks until every seat is taken — {lobby.blockedBecause}. The host can fill the rest
				with demonstrators.
			{:else if !yourTurn}
				Waiting on seat <b>{onTheClock}</b> to choose.
			{:else if mine}
				<b style:color={mine.color}>{mine.name}</b> — yours.
			{:else}
				Take a character. Your seat is already decided.
			{/if}
		</div>
		<button type="button" class="go" class:ready={primary.live} disabled={!primary.live} onclick={go}>
			{primary.label}
		</button>
	</footer>
</div>

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

	/* Two flags, side by side. The one you hold keeps the full plate treatment
	   the single one had; the other is dimmed to a control, so the pair reads as
	   "you are here, that is over there" rather than as two equal choices you
	   have somehow both got. */
	.flags {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}
	.flag {
		position: relative;
		display: block;
		width: 100%;
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
	.fl-name {
		display: block;
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--sc);
	}
	.fl-sub {
		display: block;
		font-size: 0.66rem;
		color: #94a3b8;
		margin-top: 2px;
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
	.figure {
		position: relative;
		flex: 1;
		min-height: 0;
		width: 100%;
		transition: opacity 0.3s;
	}
	.figure.idle {
		opacity: 0.72;
	}
	/* Pinned top and bottom: an SVG whose height resolves to `auto` falls back
	   to its own aspect ratio and grows straight past the stage. */
	.hero {
		position: absolute;
		top: 1.5rem;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: min(100%, 460px);
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

	.passive {
		border-radius: 9px;
		border: 1px solid color-mix(in srgb, var(--kc) 30%, transparent);
		background: linear-gradient(160deg, color-mix(in srgb, var(--kc) 12%, transparent), transparent);
		padding: 0.7rem 0.8rem;
	}
	.pname {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--kc);
	}
	.passive p {
		margin: 0.4rem 0 0;
		font-size: 0.72rem;
		line-height: 1.55;
		color: #94a3b8;
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

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 1.5rem;
		border-top: 1px solid rgb(255 255 255 / 0.07);
		background: rgb(0 0 0 / 0.4);
	}
	.hint {
		font-size: 0.75rem;
		color: #94a3b8;
		/* Takes the slack so the levers stay left and the button stays right —
		   without it the three children space out and the hint drifts around as
		   its own text changes length. */
		flex: 1;
	}

	/* ── The host's levers ────────────────────────────────────────────────────
	   In the footer, not floating over the roster. A panel pinned above this bar
	   put two rows of controls on a screen whose whole job is "look at the
	   characters", and the floating one covered the seat strip at short
	   viewport heights. */
	.levers {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.lever {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.lever-k {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #64748b;
	}
	.lv {
		padding: 0.34rem 0.7rem;
		border-radius: 6px;
		border: 1px solid rgb(255 255 255 / 0.12);
		background: rgb(255 255 255 / 0.05);
		color: #cbd5e1;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.15s;
	}
	.lv:hover {
		border-color: rgb(255 255 255 / 0.28);
		color: #f8fafc;
	}
	.err {
		color: #fb7185;
	}
	.lv:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.lv.ghost {
		background: transparent;
		border-color: rgb(255 255 255 / 0.08);
		color: #94a3b8;
	}
	.go {
		min-width: 210px;
		padding: 0.75rem 1.4rem;
		border-radius: 8px;
		border: 1px solid rgb(255 255 255 / 0.1);
		background: rgb(255 255 255 / 0.04);
		color: #475569;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		cursor: not-allowed;
		transition: all 0.2s;
	}
	.go.ready {
		cursor: pointer;
		color: #05070c;
		border-color: transparent;
		background: linear-gradient(100deg, var(--pick), color-mix(in srgb, var(--pick) 70%, #fff));
		box-shadow: 0 0 30px color-mix(in srgb, var(--pick) 40%, transparent);
	}
</style>
