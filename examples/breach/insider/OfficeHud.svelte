<script lang="ts">
	// ── The office HUD ────────────────────────────────────────────────────────
	// Everything Insider Threat puts over the first-person view: the scoreboard,
	// who you are, your actions, the work at the station you stand at, what you
	// perceived, your case file, the meeting, and the end. It renders the
	// server's view and sends intents; it decides nothing. A station offered here
	// is offered because office.gen.ts says it hosts that work — whether it
	// takes is the server's answer. Designed in showcase/src/routes/mockups/
	// office-hud; the radar and the waypoints are InsiderThreat.svelte's, since
	// they ride the camera.
	//
	// Keyboard only, and none of it needs the mouse: 1–9 pick work or a choice,
	// Q sweeps, R plays the signature (on whoever you aim at, where it takes a
	// person), B lifts from whoever is lit up in reach, M calls a meeting, X
	// stops work, J opens the case file, 0 skips a vote. Every press is
	// answered under the crosshair: what happened, or why not.
	import { Figure, HudCard, Icon, Pips, type IconName } from 'showcase';
	import { OFFICE_DATA, type OfficeStation } from '../internal/office.gen.js';
	import { klassByKey } from '../internal/rules.js';
	import { kitFor } from '../hud/kit.js';
	import type { FigureLook } from './figures.js';
	import ShiftOver from './ShiftOver.svelte';
	import { SHIFT_ICON, SHIFT_TONE, shiftRows } from './shift-list.js';
	import type { Perceived } from '../net.svelte.js';
	import type { OfficeView } from '../wire.gen.js';

	export interface OfficeActions {
		channel(station: string, act: string): void;
		lift(seat: string): void;
		cancel(): void;
		sweep(): void;
		signature(site?: string, seat?: string): void;
		callMeeting(): void;
		vote(seat: string): void;
	}

	/** A move the office said no to, stamped so two alike are said twice. */
	export interface Refusal {
		text: string;
		at: number;
	}

	interface Props {
		office: OfficeView;
		reactions: Perceived[];
		/** The station this player is standing at, if any. */
		near: OfficeStation | null;
		/** The zone this player is standing in. */
		zone: string;
		act: OfficeActions;
		/** This player's lobby character, for the plate. */
		look?: FigureLook;
		/** Whoever a lift would take: in reach, nearest the crosshair, in sight. */
		liftable?: string | null;
		/** Whoever the crosshair is on, in sight. */
		aimed?: string | null;
		refusal?: Refusal | null;
		/** Ends the match for the table. Absent for a player who may not. */
		onleave?: () => void;
	}
	let { office, reactions, near, zone, act, look, liftable = null, aimed = null, refusal = null, onleave }: Props = $props();

	const D = OFFICE_DATA;
	const nameOf = {
		station: (id: string) => D.stations.find((s) => s.id === id)?.name ?? id,
		zone: (k: string) => D.zones.find((z) => z.key === k)?.name ?? k,
		task: (k: string) => D.tasks.find((t) => t.key === k)?.name ?? D.milestones.find((m) => m.key === k)?.name ?? k,
		job: (k: string) => D.archetypes.find((a) => a.key === k)?.name ?? k,
		handle: (id: string) => office.players.find((x) => x.seatId === id)?.handle ?? id,
		seat: (id: string) => {
			const p = office.players.find((x) => x.seatId === id);
			return p ? `${p.handle} · ${nameOf.job(p.archetype)}` : id;
		}
	};

	// ── The clock ─────────────────────────────────────────────────────────────
	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(t);
	});
	const secs = (ms: number) => Math.max(0, Math.ceil((ms - now) / 1000));
	const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

	type Cooldown = { untilUnixMs: number; lengthMs: number; charges: number };
	/** One action's clock as the slot draws it: ready, and how far round the
	 *  next charge is. A banked charge (Patience) is ready while the rest come. */
	function cool(c: Cooldown | undefined) {
		if (!c?.lengthMs) return { ready: true, frac: 1, left: 0 };
		const wait = Number(c.untilUnixMs) - now - (c.charges - 1) * Number(c.lengthMs);
		return { ready: wait <= 0, frac: Math.min(1, 1 - wait / Number(c.lengthMs)), left: Math.max(0, Math.ceil(wait / 1000)) };
	}

	const me = $derived(office.me);
	const kit = $derived(me?.klassKey ? klassByKey(me.klassKey) : null);
	const hue = $derived(kit?.color ?? 'var(--accent)');
	/** Where the insider is on the worm's path. No `next` means every step is done. */
	const nextOrder = $derived(
		me?.next ? (D.milestones.find((m) => m.key === me.next!.milestone)?.order ?? 0) : D.milestones.length + 1
	);
	const playing = $derived(office.phase === 'playing' && !!me?.seatId && !me.escorted);

	// ── The scoreboard ───────────────────────────────────────────────────────
	/** The match clock: the worm has until it runs out, and holding out to it is
	 *  the loyal win. A meeting stops it, and then the view says what is left. */
	const left = $derived(
		office.phase === 'playing' ? secs(Number(office.endsUnixMs)) : Math.ceil(Number(office.leftMs) / 1000)
	);
	const urgency = $derived(office.phase !== 'playing' ? '' : left <= 30 ? 'red' : left <= 60 ? 'amber' : '');
	/** hud-state's one ladder: when the clock goes amber the chrome does too. */
	const chrome = $derived(urgency === 'red' ? 'var(--palette-red)' : urgency === 'amber' ? 'var(--palette-amber)' : 'var(--accent)');
	const heldPct = $derived(Math.min(100, 100 * (1 - left / D.tunables.matchS)));
	/** The team bar: every loyal list tick, shown on the worm counter's lag. */
	const barPct = $derived(office.barTarget ? Math.min(100, (100 * office.barShown) / office.barTarget) : 0);
	/** Who is nearer their finish, in the race's own fractions. The loyal side
	 *  has two: fill the bar, or hold out to the clock. */
	const wormAhead = $derived(office.wormShown / D.milestones.length > Math.max(heldPct, barPct) / 100);

	// ── Your shift ───────────────────────────────────────────────────────────
	const rows = $derived(shiftRows(me, D));
	const listDone = $derived(me?.list?.filter((it) => it.done).length ?? 0);

	// ── Work at this station ─────────────────────────────────────────────────
	/** What can be done here: its tasks, and — for the insider, at the right
	 *  kind of station — the worm's next step, listed as just another job. */
	const work = $derived.by(() => {
		if (!near) return [];
		// Lit when it is on your list here, so the prompt agrees with the list.
		const onList = (k: string) => !!me?.list?.some((it) => it.task === k && it.station === near.id && !it.done);
		const out = near.tasks.map((k) => ({ key: k, label: nameOf.task(k), mine: onList(k) }));
		const next = me?.next;
		if (next && next.stations.includes(near.id)) {
			out.push({ key: next.milestone, label: `${nameOf.task(next.milestone)}${next.ready ? '' : ' (worm still spreading)'}`, mine: true });
		}
		// Clean desk: a snapped key shows only to whoever stands at the desk.
		const drawer = me?.drawers?.find((d) => d.station === near.id);
		if (drawer?.papers) out.push({ key: 'swipe_papers', label: 'Swipe the papers from the open drawer', mine: false });
		if (drawer && fixer) out.push({ key: 'fix_drawer', label: 'Fix the drawer lock', mine: true });
		if (near.id === D.badges.reissueAt) out.push({ key: 'reissue_badge', label: 'Get your badge reissued', mine: false });
		// A hazard here: secure it, or for the insider, use it. Either charges
		// the Signature, and either looks like work to whoever is watching.
		const hz = me?.hazards?.find((h) => h.station === near.id);
		const kind = hz && D.hazards.kinds.find((k) => k.key === hz.kind);
		if (kind) out.unshift({ key: 'hazard', label: `${me?.insider ? kind.use : kind.secure} · +1 signature charge`, mine: true });
		return out;
	});
	/** Work in progress, as a ring round the reticle. The view says only when it
	 *  ends, so its start is when this HUD first saw it (a plain cache, not state). */
	let workFrom = { key: '', at: 0 };
	const working = $derived.by(() => {
		const c = me?.channel;
		if (!c) return null;
		const key = `${c.station}|${c.act}|${c.endsUnixMs}`;
		if (workFrom.key !== key) workFrom = { key, at: now };
		const ends = Number(c.endsUnixMs);
		const name = c.act === 'hazard' ? (me?.insider ? 'Using the hazard' : 'Securing the hazard') : nameOf.task(c.act);
		return { name, frac: Math.min(1, (now - workFrom.at) / Math.max(1, ends - workFrom.at)), left: secs(ends) };
	});
	/** Drawers are the fixing job's, or anybody's once nobody with it is left. */
	const fixer = $derived(
		me?.archetype === D.drawers.fixedBy || !office.players.some((p) => !p.escorted && p.archetype === D.drawers.fixedBy)
	);

	// ── Actions ──────────────────────────────────────────────────────────────
	/** SeatPlate's slot states: ready glows, locked is hatched, and a slot on
	 *  its cooldown draws its outline back round as the time comes. The
	 *  signature is its own wide key, charging amber from the floor. */
	const cds = $derived.by(() => {
		void now; // re-read on the clock, so a ring fills as it goes
		const c = me?.cooldowns;
		return { work: cool(c?.work), sweep: cool(c?.sweep), lift: cool(c?.lift), call: cool(c?.call) };
	});
	/** The Signature is paid in hazard charges, not waited for: secure (or, for
	 *  the insider, use) hazards to fill it. */
	const sigNeed = D.hazards.signatureCharges;
	const sigHave = $derived(Math.min(me?.charges ?? 0, sigNeed));
	const sigSay = $derived(`${sigHave}/${sigNeed} charges`);
	const slots = $derived<{ key: string; icon: IconName; name: string; ready: boolean; cd: ReturnType<typeof cool> }[]>([
		{ key: 'Q', icon: 'search', name: 'Sweep', ready: playing && cds.sweep.ready, cd: cds.sweep },
		{ key: 'B', icon: 'hand', name: 'Lift', ready: playing && cds.lift.ready && !!liftable && !me?.channel, cd: cds.lift },
		// Only the Manager's own call waits on a clock; a witness's is the window.
		{ key: 'M', icon: 'bell', name: 'Meeting', ready: playing && !!me?.canCall, cd: me?.windows?.length ? cool(undefined) : cds.call }
	]);
	const sigReady = $derived(sigHave >= sigNeed);

	// ── Under the crosshair: what just happened ──────────────────────────────
	/** One line under the reticle for a few seconds — the server's no, a result,
	 *  a finding that matters now — so no press goes unanswered. Newest wins. */
	const SAY_MS = 3500;
	let say = $state<{ text: string; tone: 'no' | 'ok' | 'news'; at: number } | null>(null);
	const tell = (text: string, tone: 'no' | 'ok' | 'news' = 'news') => (say = { text, tone, at: performance.now() });
	const saying = $derived.by(() => {
		void now; // re-read on the clock, so the line leaves on time
		return say && performance.now() - say.at < SAY_MS ? say : null;
	});
	/** "illegal: get closer first" → "Get closer first": the code is the wire's. */
	const plain = (s: string) => {
		const t = s.replace(/^[a-z_]+: /, '');
		return t.charAt(0).toUpperCase() + t.slice(1);
	};
	$effect(() => {
		if (refusal) tell(plain(refusal.text), 'no');
	});
	// A new finding or a new badge is said as it lands; what was there when the
	// HUD mounted is not news.
	let lastNote: string | null = null;
	$effect(() => {
		const n = me?.notes?.at(-1);
		const key = n ? JSON.stringify(n) : '';
		if (lastNote !== null && key && key !== lastNote) tell(urgent(n!), n!.kind === 'denied' || n!.kind === 'bumped' ? 'no' : 'news');
		lastNote = key;
	});
	let badgesHeld: number | null = null;
	$effect(() => {
		const held = me?.badges ?? [];
		if (badgesHeld !== null && held.length > badgesHeld) tell(`Got ${nameOf.handle(held[held.length - 1])}'s badge`, 'ok');
		badgesHeld = held.length;
	});

	// ── Pickers: a signature with more than one target, a vote ───────────────
	type Choice = { label: string; value: string };
	/** A strip above the action bar, not a modal: you keep walking and looking.
	 *  `confirm` is what R again picks. */
	let picker = $state<{ title: string; choices: Choice[]; confirm?: string; pick: (v: string) => void } | null>(null);

	/** Whoever is lit up in reach. The server checks the reach again, and the
	 *  roll decides whether it came away. */
	function lift() {
		if (!me) return;
		if (me.channel) return tell('Your hands are busy — X stops the work', 'no');
		if (!liftable) return tell('Nobody in reach — walk right up to them', 'no');
		if (!cds.lift.ready) return tell(`Lift ready in ${cds.lift.left}s`, 'no');
		act.lift(liftable);
		tell(`You reach for ${nameOf.handle(liftable)}'s badge`);
	}

	/** The signature on what is in front of you: whoever you aim at, the zone you
	 *  stand in, the one thing sealed. A list only when that does not decide. */
	function signature() {
		if (!me) return;
		if (!sigReady) return tell(`Signature at ${sigSay} — find a hazard to charge it`, 'no');
		const others = office.players.filter((p) => p.seatId !== me.seatId && !p.escorted);
		switch (me.klassKey) {
			case 'hunter':
				if (aimed) return act.signature(undefined, aimed);
				picker = {
					title: 'Attribution — aim at them, or name who',
					choices: others.map((p) => ({ label: nameOf.seat(p.seatId), value: p.seatId })),
					pick: (seat) => act.signature(undefined, seat)
				};
				return;
			case 'architect': {
				const zones = D.zones.filter((z) => z.key !== 'break');
				const here = zones.some((z) => z.key === zone) ? zone : undefined;
				picker = {
					title: here ? `Segment — R again seals the ${nameOf.zone(here)}` : 'Segment — seal which area',
					confirm: here,
					choices: zones.map((z) => ({ label: z.name, value: z.key })),
					pick: (z) => act.signature(z)
				};
				return;
			}
			case 'state':
				if (me.insider) break;
				if (office.sealed.length === 0) return tell('Nothing is sealed to break open', 'no');
				if (office.sealed.length === 1) return act.signature(office.sealed[0]);
				picker = {
					title: 'Break-glass — open which area',
					choices: office.sealed.map((z) => ({ label: nameOf.zone(z), value: z })),
					pick: (z) => act.signature(z)
				};
				return;
			case 'maintainer':
				if (!me.insider && !near) return tell('Stand at a station to leave a canary', 'no');
		}
		act.signature();
	}

	const voting = $derived(office.meeting?.stage === 'vote' && !office.meeting.myVote && me?.seatId !== office.meeting.defendant);
	/** Who you can vote for: everybody still in the building but you. */
	const candidates = $derived(office.players.filter((p) => !p.escorted && p.seatId !== me?.seatId));
	let caseOpen = $state(false);

	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
		press(e.code, e.key >= '0' && e.key <= '9' ? Number(e.key) : -1);
	}
	/** A key, or a tap on whatever shows that key: a phone has only the taps. */
	function press(code: string, n = -1) {
		if (code === 'KeyJ' && me?.seatId) caseOpen = !caseOpen;
		const open = picker;
		if (open) {
			const choice = n >= 1 && n <= open.choices.length ? open.choices[n - 1].value : code === 'KeyR' ? open.confirm : undefined;
			if (choice !== undefined) open.pick(choice);
			if (choice !== undefined || code === 'Escape') picker = null;
			return;
		}
		if (voting) {
			if (n === 0) act.vote('');
			else if (n >= 1 && n <= candidates.length) act.vote(candidates[n - 1].seatId);
			return;
		}
		if (!playing) return;
		if (n >= 1 && n <= work.length && near) act.channel(near.id, work[n - 1].key);
		else if (code === 'KeyQ') act.sweep();
		else if (code === 'KeyR') signature();
		else if (code === 'KeyB') lift();
		// Sent even when it will be refused: the refusal says why.
		else if (code === 'KeyM') act.callMeeting();
		else if (code === 'KeyX' && me?.channel) act.cancel();
	}
	$effect(() => {
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// ── What you perceived ────────────────────────────────────────────────────
	/** Public news as an icon and a noun: read in the corner of an eye. */
	const SAID: Record<string, { icon: IconName; say: string }> = {
		lobby_flicker: { icon: 'sun', say: 'Lobby · lights flicker' },
		bay_screens: { icon: 'activity', say: 'Bays · screens flash' },
		server_flicker: { icon: 'sun', say: 'Server room · lights flicker' },
		rack_amber: { icon: 'cpu', say: 'Rack monitor · amber' },
		all_green: { icon: 'check', say: 'Every screen · green' },
		strobe: { icon: 'zap', say: 'Strobe' },
		task_done: { icon: 'check', say: 'Job done' },
		worm_hint: { icon: 'activity', say: 'A monitor glitched' },
		noise: { icon: 'bell', say: 'Something clattered' },
		canary: { icon: 'bell', say: 'Canary tripped' },
		badge_log: { icon: 'key', say: 'Badge log · server room' },
		visitor_log: { icon: 'user', say: 'Visitor log · lobby' },
		badge_swipe: { icon: 'key', say: 'Server room door · badge of' },
		badge_reissue: { icon: 'key', say: 'New badge issued to' }
	};
	const said = (r: Perceived) =>
		`${SAID[r.key]?.say ?? r.key}${r.badge ? ` ${nameOf.handle(r.badge)}` : r.station ? ` · ${nameOf.station(r.station)}` : r.zone ? ` · ${nameOf.zone(r.zone)}` : ''}`;
	/** Notes that are not findings: what happened to you. */
	const HAPPENED: Record<string, (zone: string) => string> = {
		denied: (z) => `your badge does not open the ${nameOf.zone(z)}`,
		bumped: () => 'somebody reached for your badge'
	};
	type Note = NonNullable<OfficeView['me']>['notes'][number];
	/** A hazard you dealt with; `outcome` carries its kind. */
	const hazardName = (k: string) => D.hazards.kinds.find((x) => x.key === k)?.name.replace(/^An? /, '') ?? k;
	const noteOf = (n: Note) =>
		n.kind === 'secured' || n.kind === 'used'
			? `${clock(n.s)} · ${n.kind} ${hazardName(n.outcome)} · ${nameOf.station(n.station)}`
			: HAPPENED[n.kind]
			? `${clock(n.s)} · ${HAPPENED[n.kind](n.zone)}`
			: `${clock(n.s)} ${n.kind}${n.outcome ? ` (${n.outcome})` : ''} · ${n.found ? (n.station ? nameOf.station(n.station) : nameOf.zone(n.zone)) : `nothing in ${nameOf.zone(n.zone)}`}${n.fresh ? ' · worked in the last minute' : ''}`;
	/** A note as it is said the moment it lands. A door that should open for
	 *  your job and did not means your badge is gone, which only you can tell. */
	const urgent = (n: Note) => {
		const z = D.zones.find((x) => x.key === n.zone);
		if (n.kind === 'denied' && me && z?.badge?.includes(me.archetype)) return `Your badge was lifted — get it reissued at ${nameOf.station(D.badges.reissueAt)}`;
		return HAPPENED[n.kind] ? plain(HAPPENED[n.kind](n.zone)) : noteOf(n).replace(/^\S+ /, '');
	};
	/** The last few seconds of reactions, newest on top. The flash itself is on
	 *  the lamp or screen that did it (InsiderThreat.svelte), not over the view. */
	const recent = $derived.by(() => {
		void now; // re-read on the clock, so a line leaves on time
		return reactions.filter((r) => performance.now() - r.seen < 8000).slice(-4).reverse();
	});

	/** Which ending this is, so a closed end screen stays closed through the
	 *  snapshots that keep arriving and the next match's still opens. */
	const ending = $derived(
		office.phase === 'over' ? JSON.stringify([office.winner, office.reason, office.leftMs, office.reveal]) : ''
	);
	let dismissed = $state('');
</script>

<!-- Scoreboard, built as TopClock is: one plate, a spine in the moment's
     colour, halves split on a diagonal the way ScoreSplit splits red and blue,
     the leader's half lit. The dial sits on the seam and hangs below. -->
<div class="board" style:--hue={chrome}>
	<div class="half h-worm" class:ahead={wormAhead}>
		<span class="mark"><Icon name="cpu" size={64} /></span>
		<span class="num"><b>{office.wormShown}</b><i>/{D.milestones.length}</i></span>
		<span class="half-body">
			<span class="half-cap">WORM</span>
			<Pips total={D.milestones.length} filled={office.wormShown} shape="diamond" size={10} gap={4} variant="error" hollow label="Worm {office.wormShown} of {D.milestones.length}" />
		</span>
	</div>
	<div class="dial {urgency}" style:--drain="{100 - heldPct}%">
		<span class="secs">{clock(left)}</span>
		<span class="rnd">{office.phase === 'playing' ? 'LEFT' : 'PAUSED'}</span>
	</div>
	<!-- The loyal half: the team bar every loyal list tick fills. The clock in
	     the dial is the other way to win, by holding out to it. -->
	<div class="half h-door" class:ahead={!wormAhead}>
		<span class="mark"><Icon name="clipboard-check" size={64} /></span>
		<span class="half-body">
			<span class="half-cap">SHIFT</span>
			<span class="gauge"><span style:width="{barPct}%"></span></span>
		</span>
		<span class="num"><b>{office.barShown}</b><i>/{office.barTarget}</i></span>
	</div>
</div>
{#if office.sealed.length}
	<p class="sealed"><Icon name="lock" size={12} /> SEALED · {office.sealed.map(nameOf.zone).join(' · ').toUpperCase()}</p>
{/if}
{#if office.lastMeeting?.escorted && office.phase === 'playing'}
	<p class="banner">{nameOf.seat(office.lastMeeting.escorted)} was escorted out.</p>
{/if}

<!-- Over the reticle: what a key does to whoever is in front of you. Drawn on
     this screen only; the figure it names is lit in the world to match. -->
{#if playing && !me?.channel && (liftable || (aimed && me?.klassKey === 'hunter'))}
	<div class="ctx">
		{#if liftable}
			<button type="button" class:wait={!cds.lift.ready} onclick={() => press('KeyB')}><kbd class="cap">B</kbd>Lift · {nameOf.handle(liftable)}{cds.lift.ready ? '' : ` · ${cds.lift.left}s`}</button>
		{/if}
		{#if aimed && me?.klassKey === 'hunter'}
			<button type="button" class:wait={!sigReady} onclick={() => press('KeyR')}><kbd class="cap">R</kbd>Attribute · {nameOf.handle(aimed)}{sigReady ? '' : ` · ${sigSay}`}</button>
		{/if}
	</div>
{/if}
{#if saying}
	<p class="say {saying.tone}">{saying.text}</p>
{/if}
{#if working}
	<!-- Work in progress: the reticle fills round, and the way out is named. -->
	<span class="work-ring" style:--p="{100 * working.frac}%"></span>
	<p class="work-say">{working.name} · {working.left}s · <button type="button" class="stop" onclick={() => press('KeyX')}><kbd class="cap sm">X</kbd> stop</button> · walking off drops it</p>
{/if}

{#if playing && near && !me?.channel}
	<!-- Under the reticle: the work here is a prompt, not a card. -->
	<div class="prompt" class:resting={!cds.work.ready}>
		<p class="prompt-at">
			{nameOf.zone(zone).toUpperCase()} · {near.name.toUpperCase()}{cds.work.ready ? '' : ` · HANDS FREE IN ${cds.work.left}s`}
		</p>
		{#each work as w, i (w.key)}
			<button type="button" class="prompt-row" class:mine={w.mine} onclick={() => press('', i + 1)}><kbd class="cap">{i + 1}</kbd>{w.label}</button>
		{/each}
	</div>
{/if}

<div class="side">
	{#if playing && rows.length}
		<!-- Your shift: what to do, in order, each row in its waypoint's colour. -->
		<section class="shift" aria-label="Your shift">
			<p class="shift-cap"><span>YOUR SHIFT</span><span>{listDone}/{me?.list?.length ?? 0}</span></p>
			{#each rows as r (r.key)}
				<div class="row" class:done={r.done} class:next={r.next} class:waiting={r.after.length > 0} style:--tone="var({SHIFT_TONE[r.kind]})">
					<Icon name={r.done ? 'check' : SHIFT_ICON[r.kind]} size={14} />
					<span class="row-text">
						<b>{r.task}</b>
						<i>{r.after.length ? `after ${r.after.join(', ')}` : r.note ? `${r.station} · ${r.note}` : r.station}</i>
					</span>
					{#if r.next}<span class="row-next">NEXT</span>{/if}
				</div>
			{/each}
		</section>
	{/if}
	{#if recent.length}
		<div class="feed">
			{#each recent as r, i (r.id)}
				<p class="news" style:opacity={1 - i * 0.22}><Icon name={SAID[r.key]?.icon ?? 'info'} size={13} />{said(r)}</p>
			{/each}
		</div>
	{/if}
</div>

{#if me?.seatId}
	<!-- The plate: you, standing in TableStrip's socket made round, leaning out
	     of it; a rail out of its centre with who you are above and what you
	     have below. -->
	<div class="plate" style:--tone={hue}>
		<div class="medal">
			<span class="halo"></span>
			<span class="fig">
				<Figure
					klass={look?.skin ?? klassByKey(me.klassKey)}
					crop="bust"
					zoom={1.9}
					art={{ ...(look?.art ?? { worn: kitFor(me.klassKey), trim: hue }), crest: { sides: 40 } }}
				/>
			</span>
		</div>
		<div class="rail"></div>
		<div class="above">
			<b>{nameOf.handle(me.seatId)}</b>
			<span>{me.insider ? 'INSIDER' : nameOf.job(me.archetype)}</span>
			{#if me.escorted}<em>escorted out</em>{/if}
		</div>
		<div class="below">
			<span class="stat"><b>{me.rep}</b><i>REP</i></span>
			{#if me.papers}<span class="stat"><b>{me.papers}</b><i>PAPERS</i></span>{/if}
		</div>
		<!-- Insider: the worm's steps, done and next. Loyal: your shift list, done
		     and next. -->
		<div class="track" title={me.insider && me.next ? `${nameOf.task(me.next.milestone)} at ${me.next.stations.map(nameOf.station).join(' / ')} · spread ${me.next.spread}/${me.next.need}` : ''}>
			{#if me.insider}
				{#each D.milestones as m (m.key)}
					<span class="step" class:done={m.order < nextOrder} class:now={m.order === nextOrder} title={m.name}></span>
				{/each}
				{#if me.next}
					<i class="track-say">{me.next.ready ? `${nameOf.task(me.next.milestone)} · ready` : `spread ${me.next.spread}/${me.next.need}`}</i>
				{/if}
			{:else}
				{#each me.list ?? [] as it (it.task)}
					<span class="step" class:done={it.done} class:now={it.next} title={nameOf.task(it.task)}></span>
				{/each}
			{/if}
		</div>
	</div>

	<div class="bar">
		{#each slots as s (s.key)}
			<button type="button" class="slot" class:locked={!s.ready} title={s.name} onclick={() => press(`Key${s.key}`)}>
				{#if !s.cd.ready}<span class="ring" style:--p="{100 * s.cd.frac}%"></span>{/if}
				<Icon name={s.icon} size={18} />
				<b class="corner">{s.key}</b>
				<span class="slot-name">{s.name}{s.cd.ready ? '' : ` · ${s.cd.left}s`}</span>
			</button>
		{/each}
		<span class="divider"></span>
		<!-- The signature, as SeatPlate's: one wide key in the kit's hue, its name
		     across it. Each hazard charge fills it amber from the floor. -->
		<button type="button" class="sig" class:charging={!sigReady} style:--hue={hue} title={kit?.name} onclick={() => press('KeyR')}>
			{#if !sigReady}
				<span class="fill" style:height="{(100 * sigHave) / sigNeed}%"></span>
			{/if}
			<span class="sig-icon"><Icon name={sigReady ? 'zap' : 'lock'} size={24} /></span>
			<span class="sig-text">
				<b>{sigReady ? (kit?.name.replace(/^The /, '') ?? 'Signature') : sigSay}</b>
				<span>signature</span>
			</span>
			<b class="corner">R</b>
		</button>
		{#if me.badges?.length}
			<span class="divider"></span>
			<div class="badges">
				{#each me.badges as b (b)}<span class="badge-tok"><Icon name="key" size={12} />{nameOf.handle(b)}</span>{/each}
			</div>
		{/if}
	</div>

	<!-- Your private evidence, apart from the public news: green, and it stays. -->
	<button type="button" class="case" class:open={caseOpen} class:fresh={me.notes?.some((n) => n.fresh)} onclick={() => press('KeyJ')}>
		<span class="tag">CASE FILE</span>
		<span class="count">{me.notes?.length ?? 0}</span>
		<kbd class="cap sm">J</kbd>
		{#each (me.notes ?? []).slice(caseOpen ? -8 : -1) as n, i (i)}
			<span class="latest">{noteOf(n)}</span>
		{/each}
	</button>
{/if}

{#if picker}
	<!-- Over the action bar, not over the view: the game goes on while you pick. -->
	<div class="strip">
		<p class="strip-title">{picker.title}</p>
		<ol>
			{#each picker.choices as c, i (c.value)}<li class:here={c.value === picker.confirm}><button type="button" onclick={() => press('', i + 1)}><kbd>{i + 1}</kbd> {c.label}</button></li>{/each}
		</ol>
		<button type="button" class="mono" onclick={() => press('Escape')}>Esc to cancel</button>
	</div>
{/if}

{#if office.meeting}
	{@const mt = office.meeting}
	<!-- Docked to the side, undimmed: a meeting is for reading the room's faces. -->
	<div class="center docked">
		<HudCard eyebrow={mt.kind === 'trial' ? 'TRIAL' : 'MEETING'} title="{mt.stage === 'vote' ? 'Vote' : 'Discuss'} · {secs(Number(mt.endsUnixMs))}s">
			<p class="mono">called by {nameOf.seat(mt.calledBy)}</p>
			{#if mt.defendant}
				<p>Accused: <b>{nameOf.seat(mt.defendant)}</b> — evidence at the {nameOf.station(mt.evidence)}. They cannot vote; the most votes convicts.</p>
			{/if}
			<ol>
				{#each candidates as p, i (p.seatId)}
					<li><button type="button" disabled={!voting} onclick={() => press('', i + 1)}><kbd>{i + 1}</kbd> {nameOf.seat(p.seatId)}</button></li>
				{/each}
				{#if voting}<li><button type="button" onclick={() => press('', 0)}><kbd>0</kbd> skip</button></li>{/if}
			</ol>
			<p class="mono">
				{#if mt.myVote}you voted {mt.myVote === 'skip' ? 'to skip' : nameOf.seat(mt.myVote)}
				{:else if voting}1–{candidates.length} to vote · 0 to skip
				{:else if mt.stage === 'vote' && mt.defendant === me?.seatId}you are on trial — the room votes without you
				{:else}talk it through — voting opens when the timer ends{/if}
				· {mt.votesCast} in
			</p>
		</HudCard>
	</div>
{/if}

{#if ending && ending !== dismissed}
	<ShiftOver {office} {look} {onleave} onclose={() => (dismissed = ending)} />
{/if}

<style>
	p {
		margin: 0;
		font-size: var(--t-micro);
		color: var(--fg-dim);
	}
	/* Every key drawn here is also a tap target; dressed by its own class. */
	button {
		font: inherit;
		color: inherit;
		text-align: inherit;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		touch-action: manipulation;
	}
	button:disabled {
		cursor: default;
	}
	.strip > button {
		color: var(--fg-dim);
	}
	.mono,
	.tag,
	i {
		font-family: var(--mono);
		font-size: var(--t-micro);
		font-style: normal;
	}
	.tag,
	i {
		letter-spacing: 0.18em;
		color: var(--fg-dim);
	}

	/* ── Scoreboard: hud-state's plateFill and lifted shadow, TopClock's spine. */
	.board {
		position: absolute;
		top: var(--sp-4);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: stretch;
		height: 58px;
		padding: 4px;
		border: 1px solid color-mix(in srgb, var(--hue) 55%, transparent);
		border-radius: 10px;
		background: radial-gradient(120% 120% at 14% 30%, color-mix(in srgb, var(--hue) 18%, var(--bg-elev)) 0%, var(--bg-elev) 64%);
		box-shadow:
			inset 3px 0 0 0 var(--hue),
			0 14px 30px color-mix(in srgb, var(--bg) 80%, transparent);
	}
	.half {
		--side: var(--palette-red);
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		width: 190px;
		padding: 0 var(--sp-4);
		overflow: hidden;
		border-radius: 7px;
		background: color-mix(in srgb, var(--fg) 4%, transparent);
		clip-path: polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%);
		transition: background 260ms ease;
	}
	.half.h-door {
		--side: var(--palette-emerald);
		justify-content: flex-end;
		clip-path: polygon(18px 0, 100% 0, 100% 100%, 0 100%);
	}
	/* The wash is strongest at the seam and gone behind the numbers. */
	.half.ahead {
		background: linear-gradient(100deg, color-mix(in srgb, var(--side) 5%, transparent) 30%, color-mix(in srgb, var(--side) 30%, transparent));
	}
	.half.h-door.ahead {
		background: linear-gradient(280deg, color-mix(in srgb, var(--side) 5%, transparent) 30%, color-mix(in srgb, var(--side) 30%, transparent));
	}
	/* ScoreSplit's watermark, under the seam so it never sits under the numbers. */
	.mark {
		position: absolute;
		top: 50%;
		right: -6px;
		transform: translateY(-50%);
		color: var(--side);
		opacity: 0.06;
	}
	.h-door .mark {
		right: auto;
		left: -6px;
	}
	.ahead .mark {
		opacity: 0.12;
	}
	.num,
	.half-body {
		position: relative;
	}
	.num {
		display: flex;
		align-items: baseline;
		gap: 1px;
	}
	.num b {
		font-family: var(--mono);
		font-size: 1.75rem;
		font-weight: 900;
		line-height: 1;
		color: var(--fg-dim);
		font-variant-numeric: tabular-nums;
	}
	.ahead .num b {
		color: var(--fg);
		text-shadow: 0 0 14px color-mix(in srgb, var(--side) 80%, transparent);
	}
	.num i {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0;
	}
	.half-body {
		display: grid;
		gap: 6px;
	}
	.h-door .half-body {
		justify-items: end;
	}
	.half-cap {
		font-family: var(--mono);
		font-size: 0.55rem;
		font-weight: 900;
		letter-spacing: 0.22em;
		color: color-mix(in srgb, var(--side) 55%, var(--fg));
	}
	.gauge {
		display: block;
		width: 92px;
		height: 6px;
		background: var(--border);
		clip-path: polygon(3px 0, 100% 0, calc(100% - 3px) 100%, 0 100%);
	}
	.gauge span {
		display: block;
		height: 100%;
		margin-left: auto;
		background: var(--palette-emerald);
	}
	.dial {
		--ring: var(--accent);
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 84px;
		height: 84px;
		margin: -4px -14px -30px;
		border-radius: var(--r-pill);
		background: conic-gradient(var(--ring) var(--drain), var(--border) 0);
		box-shadow:
			0 0 0 4px var(--bg-elev),
			0 0 18px color-mix(in srgb, var(--ring) 40%, transparent);
	}
	.dial::before {
		content: '';
		position: absolute;
		inset: 5px;
		border-radius: inherit;
		background: var(--bg-elev);
	}
	.dial.amber {
		--ring: var(--palette-amber);
	}
	.dial.red {
		--ring: var(--palette-red);
		animation: throb 1s ease-in-out infinite;
	}
	@keyframes throb {
		50% {
			transform: scale(1.08);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dial.red {
			animation: none;
		}
	}
	.secs,
	.rnd {
		position: relative;
		grid-area: 1 / 1;
	}
	.secs {
		font-family: var(--sans-brand);
		font-size: 1.9rem;
		line-height: 1;
		color: var(--ring);
	}
	.rnd {
		align-self: end;
		margin-bottom: 14px;
		font-family: var(--mono);
		font-size: 0.45rem;
		font-weight: 900;
		letter-spacing: 0.2em;
		color: var(--fg-dim);
	}
	.sealed,
	.banner {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		font-family: var(--mono);
		letter-spacing: 0.18em;
		color: var(--palette-amber);
		white-space: nowrap;
	}
	.sealed {
		top: 120px;
	}
	.banner {
		top: 142px;
	}

	/* ── The prompt under the reticle ──────────────────────────────────────── */
	/* Over the reticle: the keys for whoever is in front of you. */
	.ctx {
		position: absolute;
		bottom: calc(50% + 24px);
		left: 50%;
		transform: translateX(-50%);
		display: grid;
		justify-items: center;
		gap: var(--sp-1);
	}
	.ctx button {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--t-small, 0.85rem);
		color: var(--fg);
		text-shadow: 0 1px 4px var(--bg);
	}
	.ctx button.wait {
		color: var(--fg-dim);
	}
	/* The answer to the last press, above everything at the reticle. */
	.say {
		position: absolute;
		bottom: calc(50% + 84px);
		left: 50%;
		transform: translateX(-50%);
		padding: 2px var(--sp-2);
		border-radius: var(--r-sm);
		background: color-mix(in srgb, var(--bg) 70%, transparent);
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: 0.06em;
		white-space: nowrap;
		color: var(--fg);
	}
	.say.no {
		color: var(--palette-amber);
	}
	.say.ok {
		color: var(--palette-emerald);
	}
	/* Work in progress: the reticle's own ring, filling round from the top. */
	.work-ring {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 34px;
		height: 34px;
		margin: -17px 0 0 -17px;
		padding: 3px;
		border-radius: var(--r-pill);
		background: conic-gradient(var(--accent) var(--p), color-mix(in srgb, var(--fg) 14%, transparent) 0);
		mask:
			linear-gradient(#000 0 0) content-box exclude,
			linear-gradient(#000 0 0);
		pointer-events: none;
	}
	.work-say {
		position: absolute;
		top: calc(50% + 28px);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		white-space: nowrap;
		font-family: var(--mono);
		color: var(--fg-muted);
		text-shadow: 0 1px 4px var(--bg);
	}
	/* A signature's choices, over the action bar: the view stays open. */
	.strip {
		position: absolute;
		bottom: calc(var(--sp-4) + 92px);
		left: 50%;
		transform: translateX(-50%);
		display: grid;
		justify-items: center;
		gap: var(--sp-1);
		padding: var(--sp-2) var(--sp-3);
		border: 1px solid var(--border);
		border-radius: 8px;
		background: color-mix(in srgb, var(--bg-elev) 88%, transparent);
	}
	.strip-title {
		font-family: var(--mono);
		letter-spacing: 0.1em;
		color: var(--fg);
	}
	.strip ol {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--sp-2) var(--sp-3);
		margin: 0;
	}
	.prompt {
		position: absolute;
		top: calc(50% + 28px);
		left: 50%;
		transform: translateX(-50%);
		display: grid;
		justify-items: start;
		gap: var(--sp-1);
	}
	.prompt-at {
		justify-self: center;
		font-family: var(--mono);
		letter-spacing: 0.2em;
		color: var(--accent);
	}
	.prompt-row {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--t-small, 0.85rem);
		color: var(--fg-muted);
		text-shadow: 0 1px 4px var(--bg);
	}
	.prompt-row.mine {
		color: var(--fg);
	}
	.prompt.resting .prompt-row {
		opacity: 0.45;
	}
	.cap {
		display: inline-grid;
		place-items: center;
		min-width: 22px;
		height: 22px;
		border: 1px solid var(--border-strong);
		border-bottom-width: 3px;
		border-radius: var(--r-sm);
		background: var(--bg-elev);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--t-micro);
	}
	.cap.sm {
		min-width: 18px;
		height: 18px;
	}

	/* ── Perception feed ───────────────────────────────────────────────────── */
	/* The right column: your shift on top, the news under it. */
	.side {
		position: absolute;
		top: 64px;
		right: var(--sp-4);
		display: grid;
		justify-items: end;
		gap: var(--sp-3);
	}
	.feed {
		display: grid;
		justify-items: end;
		gap: var(--sp-1);
	}

	/* ── Your shift ────────────────────────────────────────────────────────── */
	.shift {
		display: grid;
		gap: 2px;
		width: 260px;
		padding: var(--sp-2);
		font-family: var(--mono);
		background: linear-gradient(to left, color-mix(in srgb, var(--bg) 85%, transparent), color-mix(in srgb, var(--bg) 40%, transparent));
		border-right: 2px solid var(--accent);
	}
	.shift-cap {
		display: flex;
		justify-content: space-between;
		margin: 0 0 var(--sp-1);
		font-size: var(--t-micro);
		letter-spacing: 0.18em;
		color: var(--fg-dim);
	}
	.row {
		display: grid;
		grid-template-columns: 20px 1fr auto;
		align-items: center;
		gap: var(--sp-2);
		padding: 3px var(--sp-1);
		color: var(--tone);
		border-left: 2px solid transparent;
	}
	.row-text {
		display: grid;
		min-width: 0;
	}
	.row-text b {
		font-size: var(--t-small);
		font-weight: 500;
		color: var(--fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.row-text i {
		font-size: var(--t-micro);
		font-style: normal;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.row.next {
		border-left-color: var(--tone);
		background: color-mix(in srgb, var(--tone) 16%, transparent);
	}
	.row.next b {
		font-weight: 700;
	}
	.row-next {
		font-size: var(--t-micro);
		font-weight: 700;
		letter-spacing: 0.18em;
	}
	.row.waiting,
	.row.done {
		opacity: 0.5;
	}
	.row.done b {
		text-decoration: line-through;
	}
	.news {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-1) var(--sp-2);
		font-family: var(--mono);
		color: var(--fg);
		background: linear-gradient(to left, color-mix(in srgb, var(--bg) 80%, transparent), transparent);
		border-right: 2px solid var(--accent);
	}

	/* ── Your plate ────────────────────────────────────────────────────────── */
	.plate {
		position: absolute;
		left: var(--sp-4);
		bottom: var(--sp-4);
		width: 340px;
		height: 92px;
	}
	.medal {
		position: absolute;
		left: 0;
		top: 50%;
		z-index: 1;
		width: 84px;
		height: 84px;
		transform: translateY(-50%);
	}
	.halo {
		position: absolute;
		inset: 8px -6px -10px;
		border-radius: var(--r-pill);
		background: radial-gradient(closest-side, color-mix(in srgb, var(--tone) 40%, transparent), transparent);
	}
	/* Unclipped: wider than the medal so the head and the ring's far rim are
	   allowed past it. Shadow and glow off the one silhouette, TableStrip's
	   three passes. */
	.fig {
		position: absolute;
		left: -26px;
		right: -26px;
		top: -14px;
		height: 88px;
		filter: drop-shadow(0 1px 0.5px color-mix(in srgb, var(--bg) 80%, transparent))
			drop-shadow(0 6px 8px color-mix(in srgb, var(--bg) 70%, transparent))
			drop-shadow(0 0 7px color-mix(in srgb, var(--tone) 60%, transparent));
	}
	.rail {
		position: absolute;
		left: 42px;
		top: 50%;
		width: 290px;
		height: 1px;
		background: linear-gradient(to right, var(--tone), color-mix(in srgb, var(--tone) 50%, transparent) 70%, transparent);
	}
	.rail::after {
		content: '';
		position: absolute;
		left: 248px;
		top: -2px;
		width: 5px;
		height: 5px;
		transform: rotate(45deg);
		background: var(--tone);
	}
	.above,
	.below,
	.track {
		position: absolute;
		left: 98px;
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
	.above {
		bottom: calc(50% + 6px);
		align-items: baseline;
		gap: var(--sp-2);
	}
	.above b {
		font-family: var(--sans-brand);
		font-size: 1.05rem;
		color: var(--fg);
	}
	.above span {
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--tone);
	}
	.above em {
		font-family: var(--mono);
		font-size: var(--t-micro);
		font-style: normal;
		color: var(--palette-red);
	}
	.below {
		top: calc(50% + 7px);
	}
	.track {
		top: calc(50% + 28px);
		gap: 5px;
	}
	.track-say {
		margin-left: var(--sp-2);
		letter-spacing: 0.08em;
	}
	.stat {
		display: flex;
		align-items: center;
		gap: 5px;
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--t-micro);
	}
	.step {
		width: 18px;
		height: 4px;
		border-radius: var(--r-pill);
		background: var(--border-strong);
	}
	.step.done {
		background: color-mix(in srgb, var(--tone) 55%, transparent);
	}
	.step.now {
		background: var(--tone);
		box-shadow: 0 0 8px var(--tone);
	}

	/* ── Actions: SeatPlate's slot grammar. Tinted, not filled — 22% of the hue
	   inside, 75% on the edge, a glow when it is yours to press, the key
	   stamped in the corner where the card game stamps +1. ───────────────── */
	.bar {
		position: absolute;
		bottom: calc(var(--sp-4) + 14px);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: flex-start;
		gap: var(--sp-2);
	}
	.slot {
		--hue: var(--accent);
		position: relative;
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border: 1px solid color-mix(in srgb, var(--hue) 75%, transparent);
		border-radius: 8px;
		background: color-mix(in srgb, var(--hue) 22%, transparent);
		box-shadow: 0 0 14px color-mix(in srgb, var(--hue) 30%, transparent);
		color: var(--hue);
	}
	.slot.locked {
		color: var(--fg-dim);
		border-color: color-mix(in srgb, var(--fg) 14%, transparent);
		background: repeating-linear-gradient(45deg, transparent 0 5px, color-mix(in srgb, var(--fg) 8%, transparent) 5px 10px);
		box-shadow: none;
	}
	/* The cooldown: the slot's outline drawn back round from the top as the
	   time comes, over the hatched locked face. */
	.ring {
		position: absolute;
		inset: -3px;
		padding: 2px;
		border-radius: 10px;
		background: conic-gradient(var(--hue) var(--p), transparent 0);
		mask:
			linear-gradient(#000 0 0) content-box exclude,
			linear-gradient(#000 0 0);
		pointer-events: none;
	}
	.corner {
		position: absolute;
		right: 4px;
		bottom: 3px;
		font-family: var(--mono);
		font-size: 0.55rem;
		font-weight: 900;
		line-height: 1;
	}
	.slot-name {
		position: absolute;
		top: calc(100% + 4px);
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
		white-space: nowrap;
	}
	.divider {
		align-self: center;
		width: 1px;
		height: 40px;
		background: var(--border);
	}
	.sig {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		width: 200px;
		height: 52px;
		padding: 0 var(--sp-3);
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--hue) 78%, transparent);
		border-radius: 8px;
		background: color-mix(in srgb, var(--hue) 22%, transparent);
		box-shadow: 0 0 18px color-mix(in srgb, var(--hue) 35%, transparent);
		color: var(--hue);
	}
	.sig.charging {
		--hue: var(--palette-amber);
		background: color-mix(in srgb, var(--palette-amber) 8%, var(--bg-elev));
		border-color: color-mix(in srgb, var(--palette-amber) 55%, transparent);
		box-shadow: none;
	}
	.fill {
		position: absolute;
		inset: auto 0 0;
		background: color-mix(in srgb, var(--palette-amber) 22%, transparent);
	}
	.sig-icon,
	.sig-text {
		position: relative;
	}
	.sig-text {
		display: grid;
		gap: 5px;
	}
	.sig-text b {
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		line-height: 1;
		text-transform: uppercase;
	}
	.sig-text span {
		font-family: var(--mono);
		font-size: 0.6rem;
		line-height: 1;
		color: var(--fg-dim);
	}
	.badges {
		display: grid;
		gap: 3px;
		align-self: center;
	}
	.badge-tok {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px var(--sp-2);
		border: 1px solid var(--palette-amber);
		border-radius: var(--r-pill);
		color: var(--palette-amber);
		font-family: var(--mono);
		font-size: var(--t-micro);
	}

	/* ── Case file ─────────────────────────────────────────────────────────── */
	.case {
		position: absolute;
		right: var(--sp-4);
		bottom: var(--sp-4);
		display: grid;
		grid-template-columns: 1fr auto auto;
		justify-items: end;
		align-items: center;
		gap: var(--sp-1) var(--sp-2);
		max-width: 280px;
		padding: var(--sp-2) var(--sp-3);
		border-right: 2px solid var(--palette-emerald);
		background: linear-gradient(to left, color-mix(in srgb, var(--bg) 80%, transparent), transparent);
	}
	.case.open {
		background: linear-gradient(to left, color-mix(in srgb, var(--bg) 92%, transparent), color-mix(in srgb, var(--bg) 40%, transparent));
	}
	.case .tag {
		color: var(--palette-emerald);
	}
	.count {
		font-family: var(--sans-brand);
		color: var(--palette-emerald);
	}
	.case.fresh .count {
		text-shadow: 0 0 10px var(--palette-emerald);
	}
	.latest {
		grid-column: 1 / -1;
		font-size: var(--t-micro);
		font-family: var(--mono);
		color: var(--fg);
		text-align: right;
	}

	/* ── Pickers, the meeting, the end ─────────────────────────────────────── */
	.center {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--bg) 45%, transparent);
	}
	.center :global(> *) {
		width: min(420px, 90vw);
	}
	.center p {
		margin-top: var(--sp-1);
	}
	ol {
		margin: var(--sp-2) 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--sp-1);
		font-size: var(--t-micro);
	}
	.center.docked {
		place-items: center end;
		padding-right: var(--sp-5, 32px);
		background: none;
	}
	li.here {
		color: var(--accent);
	}
	kbd {
		font-family: var(--mono);
		padding: 0 var(--sp-1);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-sm);
	}
</style>
