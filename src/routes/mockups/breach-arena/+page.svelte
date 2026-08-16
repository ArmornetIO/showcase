<script lang="ts">
	// ── /mockups/breach-map ──────────────────────────────────────────────────────
	// BREACH — the console's overview re-imagined as a PER-PLAYER HUD for a 2v2
	// supply-chain skirmish. Same page furniture, same globe, every readout
	// re-pointed at the seat you are sitting in:
	//
	//   overview ticker      → round / phase / initiative
	//   posture verdict      → the payload path's state, from your side of it
	//   vendor coverage card → your class, passive and resource
	//   agent mesh card      → your action points and the heat you are carrying
	//   live feed            → the battle log
	//   agent+proxy activity → your hand, and the objective it is aimed at
	//   node inspector       → the target sheet for the building you picked
	//
	// The board is the real four-territory globe with the real settlement pieces,
	// so the map is not a metaphor for the supply chain — it IS the supply chain,
	// with dice on it.
	//
	// Fog of war is per seat: a red seat sees its own implants, a blue seat sees
	// only what it has revealed. Switching seats switches what the page knows,
	// which is the single most important thing this mockup has to prove.
	import { MeshCanvas, Timeline, StatusDot, Icon, makeTerrain } from '$lib/index.js';
	import type {
		StudioNode,
		StudioEdge,
		MeshLayoutId,
		TerritoryStyle,
		TimelineEvent,
		IconName
	} from '$lib/index.js';
	import {
		ROSTER,
		INITIATIVE,
		BENCH,
		STRUCTURES,
		CHAIN,
		CORE_ID,
		TERRITORIES,
		TERRITORY_ORDER,
		canTarget,
		klassByKey,
		computeOdds,
		outcomeFor,
		succeeded,
		scaleEffect,
		OUTCOME_LABEL,
		OUTCOME_COLOR,
		SKILL_LABEL,
		SKILL_BLURB,
		roll2d6,
		structureById,
		meterName,
		type Ability,
		type Klass,
		type Outcome,
		type Skill,
		type Structure,
		type TerritoryKey
	} from './game.js';
	import BoardFx from './BoardFx.svelte';
	import Card from './Card.svelte';
	import FirstPerson, { type MeshHandle, type Scene } from './FirstPerson.svelte';
	import type { CanvasCamera } from '$lib/primitives/canvas-camera.js';
	import { untrack } from 'svelte';
	import {
		BAR_TONE,
		BEATS,
		GARRISON_CAP,
		QUIET_BEATS,
		fxFor,
		wait,
		type ActiveFx,
		type BoardPing,
		type GarrisonUnit,
		type StatusBar
	} from './fx.js';

	// ── Live match state ─────────────────────────────────────────────────────────
	// Everything the server would stream back. Seeded mid-match on purpose: an
	// empty board says nothing about how the game reads once there is something
	// hidden on it.
	interface Foothold {
		structure_id: string;
		seat_key: string;
		persistent: boolean;
		revealed: boolean;
		sleeper: boolean;
		placed_round: number;
		/** A turn was spent working this foothold rather than pushing on — it is
		 *  pre-positioned, and worth +2 on the next step of the chain. */
		staged: boolean;
	}

	// ── Stages ───────────────────────────────────────────────────────────────────
	// A game starts by choosing who you are. The select screen exists to make the
	// class an identity rather than a dropdown — you sit down as somebody, and the
	// deal that follows is what hands you their tools.
	type Stage = 'select' | 'deal' | 'play';
	let stage = $state<Stage>('select');

	let round = $state(1);
	let phase = $state(0); // index into INITIATIVE
	let seatKey = $state('maintainer'); // whose HUD is on screen
	let layout = $state<MeshLayoutId>('globe');
	let selectedId = $state<string | null>(null);
	let armedKey = $state<string | null>(null);
	let lastRoll = $state<{
		dice: [number, number];
		total: number;
		hit: boolean;
		outcome: Outcome;
		margin: number;
	} | null>(null);

	// ── Presentation state ───────────────────────────────────────────────────────
	// `busy` is the input lock. It is held for exactly as long as a resolution is
	// SAYING something and not one frame longer — see the beat table in fx.ts.
	let busy = $state(false);
	let activeFx = $state<ActiveFx | null>(null);
	let fxSeq = 0;

	// ── First person ─────────────────────────────────────────────────────────────
	// The board camera, handed to the POV scene so it can drive the globe pose and
	// the viewport as one gesture. Both are bindings the canvas already offers; the
	// scene owns neither, it borrows them for a second and a half.
	let boardMesh = $state<MeshHandle | null>(null);
	let boardCamera = $state<CanvasCamera>();
	let fp = $state<{
		enter(s: Scene): Promise<void>;
		hold(ms?: number): Promise<void>;
		leave(): Promise<void>;
		cut(): void;
	} | null>(null);
	/** A POV scene is on screen, so the HUD gets out of the way.
	 *
	 *  Owned by the page rather than read off the component, because it is the
	 *  PAGE's chrome that has to recede — a scene component that reached out and
	 *  dimmed panels it does not own would be the wrong thing in the wrong file.
	 *  All the flag does is bury every panel under a scrim while the board itself
	 *  is lifted above it; nothing is unmounted, so nothing has to be measured
	 *  again on the way back. */
	let povLive = $state(false);

	/**
	 * WHERE in a resolution the first-person scene sits.
	 *
	 * The same shot means four different things depending on when it is cut in, and
	 * all four are worth having:
	 *
	 *   prelude   Before the board moves. A title card for the card being played:
	 *             here is who is about to do this, and to what. The board then plays
	 *             out exactly as it always does, untouched.
	 *   roll      Opens once the squad has crossed and is standing at the building.
	 *             The dice are then thrown, and you WATCH THEM LAND from inside the
	 *             body — which is the version where the shot is not decoration,
	 *             because the thing being decided happens while you are in there.
	 *   verdict   Opens after the dice have settled. You are put in the body for the
	 *             consequence and nothing else: ward or breach, at eye level.
	 *   full      Opens before anything and stays up for the whole resolution — the
	 *             squad arrives, the dice fly, the verdict lands, all of it seen
	 *             from the ground. One long animation.
	 *
	 * Anything that opens mid-resolution stays open to the end; only `prelude`
	 * closes early. That is the rule that keeps this from needing a scheduler — a
	 * scene has one place it starts, and the end of the resolution is the end of it.
	 */
	type PovBeat = 'prelude' | 'roll' | 'verdict' | 'full';

	/**
	 * Cards that get a POV scene, and the reason it is a table rather than a flag on
	 * the card.
	 *
	 * A first-person cut is the most expensive punctuation the board has, and its
	 * value is entirely in how rarely it fires — put one on every attack and the
	 * fourth one is a loading screen. So the list is short on purpose and lives here
	 * rather than in `fx.ts`: which cards deserve a cutaway, and where in the beat
	 * it belongs, is an editorial call about pacing rather than a property of the
	 * card, and the moment it sits next to `hue` and `word` somebody will fill it in
	 * for all seventeen.
	 *
	 * Zero-Day Reserve earns the first one. It is a single operator rather than a
	 * squad, it is burned in one use, and it costs the Handler their whole turn —
	 * the one card in the deck where stopping the board to look through somebody's
	 * eyes is proportionate to what is being spent.
	 */
	const POV_CARDS: Partial<Record<string, PovBeat>> = { zeroday: 'full' };
	/** Faces shown while the dice tumble; the real roll replaces them on settle. */
	let diceFaces = $state<[number, number]>([1, 1]);
	let diceSpin = $state(false);
	let auto = $state(false);
	let winner = $state<'red' | 'blue' | null>(null);
	let rulesOpen = $state(false);

	// ── The clock ────────────────────────────────────────────────────────────────
	// A turn ends when the turn is over — when the action points are gone, or when
	// the time is. Making a player click END TURN after spending their last AP is
	// asking them to confirm something the board already knows, and a game with no
	// clock is a game where one seat can think for as long as it likes while three
	// people watch.
	//
	// The clock does NOT run while a resolution is playing: animation time is the
	// game's to spend, not the player's.
	const TURN_MS = 30_000;
	const TURN_TICK = 200;
	let turnLeft = $state(TURN_MS);

	$effect(() => {
		// Reset on every change of turn. Reads phase and round only, so writing
		// turnLeft here cannot re-trigger it.
		void phase;
		void round;
		untrack(() => (turnLeft = TURN_MS));
	});

	$effect(() => {
		if (stage !== 'play' || winner) return;
		const t = setInterval(() => {
			if (busy) return;
			turnLeft = Math.max(0, turnLeft - TURN_TICK);
		}, TURN_TICK);
		return () => clearInterval(t);
	});

	// Out of time.
	$effect(() => {
		if (turnLeft > 0 || busy || winner || stage !== 'play') return;
		const seatOut = activeKlass.name;
		// The feed variant reads `subject` and `qualifiers`, not `title` — so the
		// fact has to be in the subject or it does not appear on screen at all.
		push('all', {
			when: `R${round}`,
			title: 'out of time',
			subject: `${seatOut} — out of time`,
			icon: 'clock',
			tone: 'warn',
			qualifiers: ['turn passed', `${ap[activeKlass.key] ?? 0} AP unspent`]
		});
		endTurn();
	});

	// Out of action points. A short beat first so the last card's result is read
	// before the board moves on.
	$effect(() => {
		if (busy || winner || stage !== 'play') return;
		if ((ap[activeKlass.key] ?? 0) > 0) return;
		const id = setTimeout(() => endTurn(), 900);
		return () => clearTimeout(id);
	});

	// ── Dragging a card onto the world ───────────────────────────────────────────
	// A card is a thing, and the whole point of making it a thing is that it can be
	// moved TO somewhere. Pointer events rather than HTML5 drag-and-drop: the drop
	// target is an SVG <g> inside a canvas that is being spun and projected, and
	// the native API has no useful answer for that. `elementFromPoint` does.
	let drag = $state<{ key: string; x: number; y: number; over: string | null } | null>(null);
	let hoverKey = $state<string | null>(null);
	/** The card whose full text is open at the bottom of the screen. */
	let inspectKey = $state<string | null>(null);
	/** How many of the hand have arrived from the dispenser. */
	let dealtCount = $state(0);

	/**
	 * Take a chair and deal. The cards are fired one at a time from the dispenser
	 * at the right edge — 130ms apart, which is fast enough to read as one motion
	 * and slow enough that you watch each card land somewhere different.
	 */
	async function takeSeat(key: string) {
		seatKey = key;
		phase = Math.max(0, INITIATIVE.indexOf(key));
		armedKey = null;
		inspectKey = null;
		dealtCount = 0;
		stage = 'deal';
		await wait(280);
		const hand = ROSTER.find((r) => r.key === key)?.abilities ?? [];
		for (let i = 0; i < hand.length; i++) {
			dealtCount = i + 1;
			await wait(130);
		}
		await wait(420);
		stage = 'play';
	}

	/** Re-deal on a seat swap so a switched chair still gets its hand thrown to it
	 *  rather than appearing fully formed. */
	function switchSeat(key: string) {
		if (busy) return;
		void takeSeat(key);
	}

	/** Back to round one with an empty board. Everything a match accumulates lives
	 *  in these eleven values, which is the argument for keeping them together. */
	function newMatch() {
		busy = false;
		activeFx = null;
		// A scene left running would hold the camera seized into the next match —
		// the globe would sit still, on the surface, looking at a building nobody
		// has played yet.
		fp?.cut();
		winner = null;
		auto = false;
		round = 1;
		phase = 0;
		footholds = [];
		heat = { staging: 0, outlands: 0, commons: 0, foundry: 0, marches: 0 };
		ap = { maintainer: 3, state: 3, architect: 3, hunter: 3 };
		res = { maintainer: 0, state: 0, architect: 2, hunter: 2 };
		hardened = {};
		softened = {};
		quarantined = [];
		expiry = {};
		log = [...OPENING];
		selectedId = null;
		armedKey = null;
		inspectKey = null;
		lastRoll = null;
		dealtCount = 0;
		garrison = [];
		chip = {};
		stage = 'select';
	}

	/**
	 * What the card is over. Deliberately forgiving: an SVG <g> only hit-tests on
	 * the pixels it actually paints, so aiming at the middle of a building lands
	 * in the gap between its roof and its caption and hits nothing at all. So the
	 * exact hit is tried first, and otherwise the nearest LEGAL building within
	 * reach wins — a card is thrown at a place, not threaded onto a stroke.
	 */
	function nodeUnder(x: number, y: number, legal: string[]): string | null {
		const exact = document.elementFromPoint(x, y)?.closest('[data-node]');
		const id = exact?.getAttribute('data-node');
		if (id && legal.includes(id)) return id;

		let best: string | null = null;
		let bestD = Infinity;
		for (const el of document.querySelectorAll('[data-node]')) {
			const nid = el.getAttribute('data-node');
			if (!nid || !legal.includes(nid)) continue;
			const r = el.getBoundingClientRect();
			if (r.width === 0 && r.height === 0) continue;
			const cx = r.left + r.width / 2;
			const cy = r.top + r.height / 2;
			const d = Math.hypot(cx - x, cy - y);
			// Reach scales with the drawn size, so a building the camera has flown
			// into does not have the same snap radius as one at the limb.
			const reach = Math.max(52, Math.max(r.width, r.height) * 0.7);
			if (d < reach && d < bestD) {
				bestD = d;
				best = nid;
			}
		}
		return best;
	}

	/**
	 * Listeners go on the WINDOW rather than on the card, and the pointerdown is
	 * prevented. Pointer capture on the card is the tidier-looking version and it
	 * loses the drag the moment the browser decides the gesture was a text
	 * selection — which, over a card made of text, it will.
	 */
	function startDrag(e: PointerEvent, key: string) {
		if (busy || winner || !isMyTurn) return;
		const a = seat.abilities.find((x) => x.key === key);
		if (!a || (ap[seat.key] ?? 0) < a.ap) return;
		e.preventDefault();
		armedKey = key;
		drag = { key, x: e.clientX, y: e.clientY, over: null };
		window.addEventListener('pointermove', moveDrag);
		window.addEventListener('pointerup', endDrag);
		window.addEventListener('pointercancel', endDrag);
	}

	function moveDrag(e: PointerEvent) {
		if (!drag) return;
		// The card in flight is under the cursor, so it would always be the hit.
		// Hide it for the duration of the probe rather than offsetting the probe —
		// an offset probe aims at somewhere the player is not pointing.
		const ghost = document.getElementById('breach-drag-ghost');
		if (ghost) ghost.style.display = 'none';
		const over = nodeUnder(e.clientX, e.clientY, aimIds);
		if (ghost) ghost.style.display = '';
		drag = { ...drag, x: e.clientX, y: e.clientY, over };
	}

	function endDrag() {
		window.removeEventListener('pointermove', moveDrag);
		window.removeEventListener('pointerup', endDrag);
		window.removeEventListener('pointercancel', endDrag);
		if (!drag) return;
		const { key, over } = drag;
		drag = null;
		const a = seat.abilities.find((x) => x.key === key);
		const t = over ? structureById(over) : null;
		if (!a || !t) return; // dropped on nothing: the card goes back, nothing is spent
		if (blockedReason(a, t)?.kind === 'hard') return;
		selectedId = t.id;
		void perform(seat, a, t);
	}

	$effect(() => {
		if (!diceSpin) return;
		const t = setInterval(() => {
			diceFaces = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
		}, 70);
		return () => clearInterval(t);
	});

	// Round one, nothing held, nothing known. The board earns its state during the
	// match instead of arriving with someone else's game already on it.
	let footholds = $state<Foothold[]>([]);

	let heat = $state<Record<TerritoryKey, number>>({
		staging: 0,
		outlands: 0,
		commons: 0,
		foundry: 0,
		marches: 0
	});
	let ap = $state<Record<string, number>>({ maintainer: 3, state: 3, architect: 3, hunter: 3 });
	let res = $state<Record<string, number>>({ maintainer: 0, state: 0, architect: 2, hunter: 2 });
	/** Blue control effects: extra hardening bought with Harden, per structure. */
	let hardened = $state<Record<string, number>>({});
	/** Red control effects: hardening talked, signed or pressured away. This is the
	 *  half of an intrusion that never touches a keyboard, and it has to be worth
	 *  points or nobody plays it. */
	let softened = $state<Record<string, number>>({});
	let quarantined = $state<string[]>([]);
	/** Round each temporary effect lapses on. Without these the board only ever
	 *  ratchets, and a game where nothing expires has no reason to hurry. */
	let expiry = $state<Record<string, number>>({});
	/** Damage. An attack that fails still hits the wall, and the wall remembers:
	 *  every miss chips 1 off the building's hardening, and upkeep repairs 1 a
	 *  round. Without this a failed attack changes nothing on the board and the
	 *  health bar is a decoration — with it, a building can be worn down by
	 *  attacks that all "failed", which is how attrition actually reads. */
	let chip = $state<Record<string, number>>({});

	/** Everyone standing on the board. A card's squad marches, fights, and then
	 *  STAYS — this is the list of who is where. */
	let garrison = $state<GarrisonUnit[]>([]);
	let unitSeq = 0;

	/**
	 * One-shot markers on the board. Discovering something, cleaning something out
	 * and an implant burrowing all happen OUTSIDE a card's resolve animation —
	 * they fall out of upkeep, or out of a recon card's side effects — and each of
	 * them is a thing the player needs to see happen at a place. A ping is the
	 * cheapest way to say "this, here, now" without inventing a second timeline.
	 */
	let pings = $state<BoardPing[]>([]);
	let pingSeq = 0;
	function ping(structureId: string, kind: BoardPing['kind']) {
		const p = { id: `p${pingSeq++}`, structureId, kind, at: performance.now() };
		pings = [...pings, p];
		setTimeout(() => (pings = pings.filter((x) => x.id !== p.id)), 1600);
	}

	const atStructure = (id: string, faction: 'red' | 'blue') =>
		garrison.filter((g) => g.structureId === id && g.faction === faction);

	/**
	 * Leave something behind — but only for the cards that should. An action card
	 * (`leaves: 'nothing'`) sends its squad, the squad does the job, and the squad
	 * withdraws: a sweep looks and moves on, a zero-day is burned, a contributor
	 * merges the patch and goes home. Nothing to draw tomorrow.
	 *
	 * A combat card leaves an implant or a garrison, and that is a piece on the
	 * board with a life of its own.
	 */
	function deploy(actor: Klass, a: Ability, structureId: string, count: number) {
		const fx = fxFor(a.key, actor.faction);
		if (fx.leaves === 'nothing' || count <= 0) return;
		const mine = atStructure(structureId, actor.faction);
		const room = Math.max(0, GARRISON_CAP - mine.length);
		const n = Math.min(count, room);
		if (n <= 0) return;
		garrison = [
			...garrison,
			...Array.from({ length: n }, () => ({
				uid: `u${unitSeq++}`,
				structureId,
				faction: actor.faction,
				leaves: fx.leaves as 'implant' | 'garrison',
				shape: fx.squad.shape,
				hue: fx.hue,
				revealed: actor.faction === 'blue',
				phase: (unitSeq * 137) % 360
			}))
		];
	}

	/** Take units off a building. Returns how many actually fell. */
	function rout(
		structureId: string,
		faction: 'red' | 'blue',
		n: number,
		kind?: 'implant' | 'garrison'
	) {
		const doomed = atStructure(structureId, faction)
			.filter((g) => !kind || g.leaves === kind)
			.slice(0, n)
			.map((g) => g.uid);
		if (!doomed.length) return 0;
		garrison = garrison.filter((g) => !doomed.includes(g.uid));
		return doomed.length;
	}

	// The log is fogged like everything else. A shared feed that prints "obfuscated
	// fixture planted in The Archive" to the defender hands them the game in a
	// sidebar — so every row carries WHO may read it, and red's quiet work leaves
	// blue nothing but a detection number that went up.
	type LogEntry = TimelineEvent & { see: 'all' | 'red' | 'blue' };

	const OPENING: LogEntry[] = [
		{
			id: 'l0',
			see: 'all',
			when: 'R1',
			title: 'match opened —',
			subject: 'nothing is held',
			icon: 'clock',
			tone: 'info',
			qualifiers: ['12 rounds', '3 AP each', 'the path starts in the Outlands']
		}
	];

	let log = $state<LogEntry[]>([...OPENING]);

	// ── Seat, fog, derived board facts ───────────────────────────────────────────
	const seat = $derived<Klass>(ROSTER.find((r) => r.key === seatKey) ?? ROSTER[0]);
	const activeKlass = $derived<Klass>(
		ROSTER.find((r) => r.key === INITIATIVE[phase]) ?? ROSTER[0]
	);
	const isMyTurn = $derived(activeKlass.key === seat.key);

	/** The card whose full text is open at the bottom of the screen. */
	const inspected = $derived(seat.abilities.find((a) => a.key === inspectKey) ?? null);
	/** How many sites the INSPECTED card could be played on — counted from the
	 *  card being read, not from whatever happens to be armed, so the panel does
	 *  not say "0 sites" the moment a card stops being held. */
	const inspectedSites = $derived(
		inspected
			? STRUCTURES.filter((s) => blockedReason(inspected, s)?.kind !== 'hard').length
			: 0
	);
	/** Which buildings a card may legally be played on. Shown as rings the moment
	 *  the card leaves the hand — a drag with no legal-target read is a guess. */
	/**
	 * Which buildings the armed card may be played on.
	 *
	 * Driven by ARMING, not by dragging: the moment you pick a card up the board
	 * should answer "where can this go", and a player should never have to read a
	 * list of site names to find out. Legal sites get lit and everything else gets
	 * dimmed, which is a question the board can answer faster than any sentence.
	 */
	const aimIds = $derived.by(() => {
		const d = drag;
		const a = d ? seat.abilities.find((x) => x.key === d.key) : armed;
		if (!a || busy || winner || !isMyTurn) return [];
		// Sealed sites stay lit — you are allowed to run at a wall, and the wall
		// working is the defender's whole payoff.
		return STRUCTURES.filter((s) => blockedReason(a, s)?.kind !== 'hard').map((s) => s.id);
	});

	/** What THIS seat is allowed to know. Red sees its side's work; blue sees only
	 *  what it has turned over. The whole game lives in the gap between the two. */
	const visible = $derived(
		footholds.filter((f) => (seat.faction === 'red' ? true : f.revealed))
	);
	const visibleOn = (id: string) => visible.find((f) => f.structure_id === id);

	/** The log through the same fog. Rows addressed to the other side never render
	 *  — not dimmed, not redacted-with-a-blur, absent. */
	const feed = $derived(log.filter((e) => e.see === 'all' || e.see === seat.faction));

	/** Standing forces through the same fog. Blue's are the wall and everyone can
	 *  see a wall; red's are only on the board once their foothold has been turned
	 *  over. Derived rather than stored, so a reveal anywhere reveals the people
	 *  too and there is no second thing to keep in step. */
	const visibleGarrison = $derived(
		garrison
			.filter(
				(g) =>
					seat.faction === 'red' ||
					g.faction === 'blue' ||
					!!footholds.find((f) => f.structure_id === g.structureId)?.revealed
			)
			.map((g) => ({ ...g, revealed: true }))
	);

	/** Chain progress as RED knows it, and as BLUE can prove it. */
	const chainHeld = $derived(CHAIN.filter((s) => footholds.some((f) => f.structure_id === s.id)));
	const chainShown = $derived(CHAIN.filter((s) => visibleOn(s.id)));
	const chainNext = $derived(CHAIN.find((s) => !footholds.some((f) => f.structure_id === s.id)));

	const territoryOf = (id: string) => structureById(id)?.territory ?? 'marches';
	const hardeningOf = (id: string) => {
		const s = structureById(id);
		if (!s) return 0;
		// The Architect's passive is a standing wall, not an action — it has to show
		// up in the number a player reads off the sheet or it may as well not exist.
		const reproducible = ap.architect > 0 && (id === 'forge' || id === 'silos') ? 2 : 0;
		// Every blue figure POSTED on the building is worth a point of it. This is
		// what makes the garrison a board piece rather than a sticker: the number an
		// attacker has to beat is partly just how many people are stood there, and
		// taking them off it is how the number comes back down.
		const defenders = garrison.filter(
			(g) => g.structureId === id && g.faction === 'blue' && g.leaves === 'garrison'
		).length;
		// A building never defends at less than 4 — even a fully socially-engineered
		// project still has someone who might read the diff.
		return Math.max(
			4,
			s.hardening +
				(hardened[id] ?? 0) +
				reproducible +
				defenders -
				(softened[id] ?? 0) -
				(chip[id] ?? 0)
		);
	};

	/**
	 * A building's health bar. `max` is what it stands at when nothing has been
	 * done to it, so the fill reads as condition rather than as an absolute — a
	 * Checkpoint at 13 and a Sandbox at 6 are both "intact", and both should look
	 * it. Anything above max overfills and shows the reinforced overhang.
	 */
	function barFor(s: Structure): StatusBar {
		const value = hardeningOf(s.id);
		const f = visibleOn(s.id);
		return {
			id: s.id,
			name: s.name,
			step: s.chain ?? null,
			regionColor: TERRITORIES[s.territory].color,
			region: TERRITORIES[s.territory].name,
			value,
			base: s.hardening,
			held: !!f,
			persistent: !!f?.persistent,
			staged: !!f?.staged,
			sealed: quarantined.includes(s.id),
			tone: f ? 'bad' : value < s.hardening ? 'warn' : 'ok',
			red: visibleGarrison.filter((g) => g.structureId === s.id && g.faction === 'red').length,
			blue: visibleGarrison.filter((g) => g.structureId === s.id && g.faction === 'blue').length
		};
	}

	/** Which links on the payload path are cut. A sealed building severs the leg
	 *  INTO it and the leg out of it — nothing gets in or out is the whole point,
	 *  and the board should show both ends. */
	const severedLinks = $derived.by(() => {
		const out: Array<{ from: string; to: string }> = [];
		CHAIN.forEach((s, i) => {
			const next = CHAIN[i + 1];
			if (!next) return;
			if (quarantined.includes(s.id) || quarantined.includes(next.id)) {
				out.push({ from: s.id, to: next.id });
			}
		});
		return out;
	});

	/** Bars are drawn for the payload path, whatever is selected, and anything
	 *  known to be held. Sixteen bars on a spinning globe is wallpaper; these are
	 *  the buildings whose condition is the game. */
	const boardBars = $derived.by(() => {
		const ids = new Set<string>(CHAIN.map((s) => s.id));
		if (selectedId) ids.add(selectedId);
		for (const f of visible) ids.add(f.structure_id);
		if (drag?.over) ids.add(drag.over);
		return [...ids].map((id) => structureById(id)).filter((s): s is Structure => !!s).map(barFor);
	});

	const armed = $derived<Ability | null>(
		seat.abilities.find((a) => a.key === armedKey) ?? null
	);
	const target = $derived(selectedId ? structureById(selectedId) : undefined);
	/**
	 * Why a card cannot be played here — the kill chain, enforced.
	 *
	 * `canTarget` answers whose ground it is. This answers whether the operation
	 * has actually reached that far, which is the part that makes an intrusion a
	 * SEQUENCE instead of a shopping list: you cannot attack the registry because
	 * you fancy it, you attack it because you already hold the build runner that
	 * feeds it. And a sealed building is not attackable at all — that is what
	 * "blocking the attempt" has to mean, or quarantine is just +4 hardening with
	 * a nicer name.
	 *
	 * Returns null when the play is legal, otherwise the sentence to show.
	 */
	/**
	 * Two kinds of "no".
	 *
	 *   hard    the operation has not reached that far — the chain runs in order,
	 *           or it is not your side of the board. Nothing lights up and the card
	 *           will not drop. This is a rule, and rules should be un-playable.
	 *
	 *   sealed  a quarantine is in the way. This one you ARE allowed to try, and
	 *           you should be: it is the defender's move, and a defender's move
	 *           that silently greys out a target is a move nobody ever sees work.
	 *           Commit into it and the squad goes, the dice fly, and the seal
	 *           slams them out of the air.
	 */
	type Block = { kind: 'hard' | 'sealed'; text: string };

	function attackBlocked(actor: Klass, a: Ability, s: Structure): Block | null {
		if (a.kind !== 'strike' && a.kind !== 'implant') return null;
		if (quarantined.includes(s.id))
			return { kind: 'sealed', text: `${s.name} is sealed — the roll will be blocked` };
		if (!s.chain) return null;
		const prev = CHAIN.find((c) => c.chain === (s.chain ?? 0) - 1);
		if (!prev) return null; // the first step is always open
		if (!footholds.some((f) => f.structure_id === prev.id))
			return { kind: 'hard', text: `take ${prev.name} first — the chain runs in order` };
		if (quarantined.includes(prev.id))
			return { kind: 'sealed', text: `the line from ${prev.name} is cut — the roll will be blocked` };
		return null;
	}

	function blockedReason(a: Ability, s: Structure): Block | null {
		if (!canTarget(a, s, seat.faction))
			return { kind: 'hard', text: 'not your side of the board' };
		return attackBlocked(seat, a, s);
	}

	const blockReason = $derived(armed && target ? blockedReason(armed, target) : null);
	const legalTarget = $derived(!!armed && !!target && blockReason?.kind !== 'hard');
	/**
	 * The roll, for any card and any seat. An attack is measured against the
	 * building's live hardening; everything else against the card's own DC — but
	 * both go through one function, so a player learns one set of bands and reads
	 * every card in the game with it.
	 */
	/**
	 * LEVERAGE — what a foothold is worth once you have it.
	 *
	 * A chain of five independently hard fights is five unrelated fights. A real
	 * intrusion compounds: the ground you already hold is where you attack the
	 * next thing FROM, with the credentials and the access you took off the last
	 * one. So holding a step pays on the step after it, and the ways of paying map
	 * onto what an attacker actually does with a foothold:
	 *
	 *   +1  you hold the previous step at all — you are attacking from inside
	 *   +1  per implant you left standing there, to 2 — persistence you can use
	 *   +2  the foothold is STAGED: you spent a turn digging in rather than
	 *       pushing on, and pre-positioned for the next move
	 *
	 * It also makes blue's cleanup matter twice: pulling an implant does not just
	 * stop it burrowing, it takes a point off every future attack launched from
	 * that building.
	 */
	function leverageFor(s: Structure): number {
		if (!s.chain) return 0;
		const prev = CHAIN.find((c) => c.chain === (s.chain ?? 0) - 1);
		if (!prev) return 0;
		const f = footholds.find((x) => x.structure_id === prev.id);
		if (!f || quarantined.includes(prev.id)) return 0;
		const implants = garrison.filter(
			(g) => g.structureId === prev.id && g.faction === 'red' && g.leaves === 'implant'
		).length;
		return 1 + Math.min(2, implants) + (f.staged ? 2 : 0);
	}

	function oddsFor(actor: Klass, a: Ability, t: Structure) {
		const attacking = a.kind === 'strike' || a.kind === 'implant';
		return computeOdds({
			holdMod: attacking && actor.faction === 'red' ? leverageFor(t) : 0,
			hardening: attacking ? hardeningOf(t.id) : undefined,
			dc: a.dc,
			skill: actor.skills[a.skill],
			abilityMod: a.mod,
			// Accrued trust rides an attack, not a control — you cannot spend a
			// reputation to make a build more reproducible.
			resourceMod: attacking && actor.faction === 'red' ? Math.min(res[actor.key] ?? 0, 3) : 0,
			defenceMod: attacking && quarantined.includes(t.id) ? 4 : 0
		});
	}

	const odds = $derived(armed && target ? oddsFor(seat, armed, target) : null);
	const canPay = $derived(!!armed && (ap[seat.key] ?? 0) >= armed.ap);

	// ── The board ────────────────────────────────────────────────────────────────
	// Built once, seeded — a landscape that redraws itself every turn is a
	// different world every turn, and a board game needs the ground to stay put.
	const terrain = makeTerrain({ seed: 20260809, octaves: 4, frequency: 9, gain: 0.5 });
	const NODE_CLEARANCE = 10;
	const nodeFootprint = (n: StudioNode) => (n.r ?? 22) + NODE_CLEARANCE;

	const nodes = $derived.by((): StudioNode[] => [
		{
			id: CORE_ID,
			type: 'control-plane',
			state: chainHeld.length >= 4 ? 'degraded' : 'healthy',
			label: 'PROTECTED CORE',
			value: `${seat.faction === 'red' ? chainHeld.length : chainShown.length}/${CHAIN.length}`,
			valueLabel: 'chain',
			iconKey: 'crestlink',
			glyphAsBody: true,
			x: 0,
			y: 0,
			r: 42
		},
		...STRUCTURES.map((s): StudioNode => {
			const f = visibleOn(s.id);
			const hot = heat[s.territory] >= 55;
			return {
				id: s.id,
				type: 'agentic',
				// A building Blue has not turned over still looks fine — the ONLY tell
				// is the heat on the region it stands in. That asymmetry is the game.
				state: f ? 'offline' : hot ? 'degraded' : 'healthy',
				label: s.name,
				value: String(hardeningOf(s.id)),
				valueLabel: 'hard',
				strokeColor: f
					? f.sleeper
						? '#FB923C'
						: '#F472B6'
					: quarantined.includes(s.id)
						? '#94A3B8'
						: TERRITORIES[s.territory].color,
				piece: s.piece,
				x: 0,
				y: 0,
				r: s.chain ? 28 : 23
			};
		})
	]);

	const edges = $derived.by((): StudioEdge[] => [
		// The payload path, drawn as the lane it is: forum → archive → forge →
		// silos → checkpoint → core. A lit segment is one Red already owns.
		...CHAIN.map((s, i) => {
			const to = CHAIN[i + 1]?.id ?? CORE_ID;
			const held = footholds.some((f) => f.structure_id === s.id);
			const shown = !!visibleOn(s.id);
			return {
				id: `chain-${s.id}`,
				from: s.id,
				to,
				dataType: 'lifecycle' as const,
				style: (held && shown ? 'energy' : 'latent') as StudioEdge['style'],
				active: held && shown,
				sig: held && shown ? 0.85 : 0.15
			};
		}),
		// Everything off the path still answers to the core.
		...STRUCTURES.filter((s) => !s.chain).map((s) => ({
			id: `link-${s.id}`,
			from: CORE_ID,
			to: s.id,
			dataType: 'lifecycle' as const,
			style: 'latent' as StudioEdge['style'],
			active: false,
			sig: 0.1
		}))
	]);

	const groupKeyOf = (n: StudioNode) =>
		n.id === CORE_ID ? 'marches' : (structureById(n.id)?.territory ?? 'marches');
	const styleOf = (k: string | number): TerritoryStyle | null =>
		(TERRITORIES[k as TerritoryKey] as TerritoryStyle) ?? null;

	// ── Actions ──────────────────────────────────────────────────────────────────
	// Its own prefix, so a played row can never collide with a seeded one.
	let logSeq = 0;
	function push(see: LogEntry['see'], e: TimelineEvent) {
		log = [{ ...e, see, id: `play-${logSeq++}` }, ...log].slice(0, 40);
	}

	/** What a red action looks like from the other side of the table: a number
	 *  moved and nobody can say why. This is the only thing blue is owed. */
	function pushHeatTell(t: TerritoryKey, added: number) {
		if (added <= 0) return;
		push('blue', {
			when: `R${round}`,
			title: 'detection rose in',
			subject: TERRITORIES[t].name,
			icon: 'activity',
			tone: 'warn',
			qualifiers: [`+${added}`, 'cause unknown']
		});
	}

	/** Where an action comes FROM on the map. A vector with no origin is a colour
	 *  appearing on a building; with one it is a move, and the player can read who
	 *  made it and from what they already hold. */
	function originFor(actor: Klass, t: Structure): string | null {
		// Blue's people come from the control plane; red's come from the last
		// ground they already hold, which is what makes a chain feel like a chain.
		const first = actor.faction === 'blue' ? 'keep' : lastHeldId();
		if (first && first !== t.id) return first;
		// Nothing held yet, or the ground they hold IS the target. Come from a
		// neighbour in the same region — a squad that spawns on top of the building
		// it is attacking never reads as having gone anywhere.
		const neighbour = STRUCTURES.find((s) => s.territory === t.territory && s.id !== t.id);
		return neighbour?.id ?? CORE_ID;
	}

	function lastHeldId(): string | null {
		const held = CHAIN.filter((s) => footholds.some((f) => f.structure_id === s.id));
		return held.length ? held[held.length - 1].id : null;
	}

	/** A ripple has to land somewhere, and for a fogged action it must NOT be the
	 *  building that was touched — that is the fact being withheld. Any other
	 *  building in the same region says "over there" without saying which. */
	const foggedAnchorId = $derived.by(() => {
		const id = activeFx?.toId;
		const t = id ? structureById(id)?.territory : null;
		if (!t) return null;
		return STRUCTURES.find((s) => s.territory === t && s.id !== id)?.id ?? id ?? null;
	});

	/** Nothing but a strike or an implant rolls dice. A control is bought, and
	 *  buying one is most of what both sides actually spend their turns doing. */
	const rollsDice = (actor: Klass, a: Ability) =>
		actor.faction === 'red' && (a.kind === 'strike' || a.kind === 'implant');

	function resolve() {
		if (busy || !armed || !target || !odds || !legalTarget || !canPay) return;
		void perform(seat, armed, target);
	}

	/**
	 * One resolution, played out rather than applied. The state change is the same
	 * either way — what the beats buy is that the player watches it happen to a
	 * place on a map instead of noticing a number is different.
	 *
	 * `actor` is separate from the seat being VIEWED, because when the other three
	 * chairs play themselves the fog has to be computed between the two.
	 */
	async function perform(actor: Klass, a: Ability, t: Structure) {
		busy = true;
		armedKey = null;
		ap[actor.key] -= a.ap;

		// Everything rolls now. An attack asks "did it get through"; a control asks
		// "how well did it go" — same dice, same bands, and the difference is only
		// what the roll is measured against.
		const attacking = rollsDice(actor, a);
		const beats = attacking ? BEATS : QUIET_BEATS;
		// Fog rule: an action by the other side is never SHOWN, only felt. No
		// vector to trace back to an actor, no building, no word — and if it made
		// no noise at all, not even a ripple. A quiet turn is quiet on both screens.
		const fogged = actor.faction !== seat.faction;

		// ── The POV scene ────────────────────────────────────────────────────────
		// Where the operator comes FROM is the whole difference between a zoom and
		// taking control of somebody: the scene establishes on them standing at that
		// building, dives into them, and only then turns onto the target. Same call
		// `activeFx` makes for the vector, so the figure the camera flies into is
		// standing exactly where the squad is about to set off from.
		//
		// Fog outranks all of it. A POV of the OTHER side's operator would hand the
		// viewing seat the actor, the building and the card in one shot — everything
		// the fog rule exists to withhold — so the scene is simply not played, and
		// blue learns a zero-day was burned the same way they learn anything: by the
		// heat it left behind.
		const povAt: PovBeat | undefined = fogged || !fp ? undefined : POV_CARDS[a.key];
		const povFrom = povAt ? originFor(actor, t) : null;

		async function povOpen() {
			if (!fp) return;
			const pov = fxFor(a.key, actor.faction);
			povLive = true;
			await fp.enter({
				fromId: povFrom,
				structureId: t.id,
				actor: actor.name,
				seat: actor.seat,
				subject: t.name,
				origin: povFrom ? structureById(povFrom)?.name : undefined,
				card: a.name,
				word: pov.word,
				hue: pov.hue,
				shape: pov.squad.shape
			});
		}

		/** Always safe to call — a no-op unless a scene is up. In a `finally` inside
		 *  because a scene cut short (a new match, a component torn down mid-dive)
		 *  must still give the HUD back: a panel stack left buried under a scrim is
		 *  an unrecoverable page. */
		async function povClose() {
			if (!povLive || !fp) return;
			try {
				await fp.leave();
			} finally {
				povLive = false;
			}
		}

		if (povAt === 'prelude') {
			await povOpen();
			await fp!.hold();
			await povClose();
		} else if (povAt === 'full') {
			// Opened and left open. Everything below plays out underneath the visor —
			// BoardFx draws below this overlay, so the squad, the dice and the verdict
			// are all still on screen, seen from the ground instead of from orbit.
			await povOpen();
		}
		const showFx = !fogged || a.noise > 0;
		activeFx = showFx
			? {
					id: ++fxSeq,
					fromId: originFor(actor, t),
					toId: t.id,
					fx: fxFor(a.key, actor.faction),
					fogged,
					outcome: 'pending',
					beats,
					startedAt: performance.now()
				}
			: null;

		// Ran at a seal. The card is spent, the squad goes, the dice fly — and the
		// barrier swats them out of the air before they can land on anything. The
		// attacker gets nothing and the defender gets to watch their move work,
		// which is the point: a control that silently greys a target out is a
		// control nobody ever sees succeed.
		const seal = attackBlocked(actor, a, t);
		if (seal?.kind === 'sealed') {
			if (activeFx) {
				activeFx = {
					...activeFx,
					sealed: true,
					roll: { dice: roll2d6().dice, total: 0, color: '#A78BFA' },
					arenaIds: STRUCTURES.filter((s) => s.territory === t.territory).map((s) => s.id)
				};
			}
			await wait(beats.diceStart);
			diceSpin = true;
			await wait(beats.diceSettle - beats.diceStart);
			diceSpin = false;
			lastRoll = null;
			// Rattling a sealed door is not free — it is the loudest thing you can do
			// and the least productive.
			heat[t.territory] = Math.min(100, heat[t.territory] + (a.noise + 1) * 6);
			ping(t.id, 'sealed');
			push('all', {
				when: `R${round} · ${a.name}`,
				title: 'blocked',
				subject: `${t.name} — the seal held`,
				icon: 'lock',
				tone: 'ok',
				major: true,
				qualifiers: ['no roll', `${a.ap} AP wasted`, `+${(a.noise + 1) * 6} detection`]
			});
			await wait(beats.unlock - beats.diceSettle);
			await povClose();
			activeFx = null;
			busy = false;
			return;
		}

		const o = oddsFor(actor, a, t);
		const r = roll2d6();
		const total = r.total + o.modifier;
		const margin = total - o.target;
		const outcome = outcomeFor(margin);
		const hit = succeeded(outcome);

		// The dice start once the squad is already swinging. Rolling while they are
		// still crossing asks the player to read two things at once, and they will
		// watch the dice and miss the board every time.
		// The throw. Handing the real numbers to the renderer at the moment the dice
		// leave the hand is what makes them worth watching — it tumbles random faces
		// on the way in and lands on THESE, so what settles on the terrain is the
		// number the game actually used.
		// Split at `arrive` so the scene can open with the squad already standing at
		// the building and the dice still in the hand — the one moment in the beat
		// where being put behind somebody's eyes buys you the thing that is about to
		// be decided rather than a replay of it.
		await wait(beats.arrive);
		if (povAt === 'roll') await povOpen();
		await wait(beats.diceStart - beats.arrive);
		lastRoll = null;
		if (activeFx) {
			activeFx = {
				...activeFx,
				roll: { dice: r.dice, total, color: OUTCOME_COLOR[outcome] },
				// The dice are rolled into the middle of the REGION, not at the house.
				// The renderer averages these to find open ground.
				arenaIds: STRUCTURES.filter((s) => s.territory === t.territory).map((s) => s.id)
			};
		}
		diceSpin = true;
		await wait(beats.diceSettle - beats.diceStart);
		diceSpin = false;
		diceFaces = r.dice;
		lastRoll = { dice: r.dice, total, hit, outcome, margin };

		// The number is known and nothing has been done about it yet. Cutting in
		// here puts the player in the body for the consequence alone.
		if (povAt === 'verdict') await povOpen();

		if (!attacking) {
			await wait(Math.max(0, beats.verdict - beats.diceSettle));
			activeFx = activeFx ? { ...activeFx, outcome: hit ? 'breach' : 'ward' } : null;
			await wait(Math.max(0, beats.after - beats.verdict));
			// They arrive and they stay — but only if the attempt worked. A botched
			// deployment leaves nobody on the ground.
			if (hit) deploy(actor, a, t.id, fxFor(a.key, actor.faction).squad.count);
			if (actor.faction === 'blue') applyBlue(actor, a, t.id, outcome);
			else applyRedSupport(actor, a, t.id, outcome);
			await wait(beats.unlock - beats.after);
			await povClose();
			activeFx = null;
			busy = false;
			return;
		}

		await wait(beats.verdict - beats.diceSettle);
		// An attack that FAILED is public whoever threw it — walls make a noise. So
		// the ward is shown even to the side that was not told an attack was coming.
		activeFx = activeFx
			? { ...activeFx, outcome: hit ? 'breach' : 'ward', fogged: hit ? activeFx.fogged : false }
			: null;

		await wait(beats.after - beats.verdict);
		applyStrike(actor, a, t, o.target, total, outcome);

		await wait(beats.unlock - beats.after);
		await povClose();
		activeFx = null;
		busy = false;
	}

	function applyStrike(
		actor: Klass,
		a: Ability,
		target: Structure,
		targetNumber: number,
		total: number,
		outcome: Outcome
	) {
		const margin = total - targetNumber;
		const hit = succeeded(outcome);
		const t = target.territory;
		// A botch is loud in a way even a failure is not — you did not just miss,
		// you tripped something on the way in.
		const added = hit ? a.noise : outcome === 'botch' ? a.noise * 3 : a.noise * 2;
		heat[t] = Math.min(100, heat[t] + added * 6);
		const squad = fxFor(a.key, actor.faction).squad.count;

		// Who is left standing. A win puts the attackers on the building and takes
		// a defender off it; a loss costs the attacker a body and leaves the wall
		// worn. Either way somebody stays there — that is what makes the next turn
		// a position rather than a fresh start.
		if (hit) {
			// A critical drives off two, not one: the difference between getting in
			// and getting in without anybody left to write it up.
			const routed = rout(target.id, 'blue', outcome === 'critical' ? 2 : 1, 'garrison');
			deploy(actor, a, target.id, squad);
			if (routed) {
				push('all', {
					when: `R${round}`,
					title: 'driven off',
					subject: `${target.name} — 1 defender`,
					icon: 'users',
					tone: 'warn',
					qualifiers: [`hardening ${hardeningOf(target.id)}`]
				});
			}
		} else {
			deploy(actor, a, target.id, Math.max(0, squad - 1));
		}

		if (hit) {
			const already = footholds.find((f) => f.structure_id === target.id);
			if (already) {
				// ── Capitalising ──────────────────────────────────────────────────
				// You are already in. Attacking it again is not taking it twice, it is
				// spending a turn DEEPENING it — the foothold goes persistent and gets
				// staged, which is worth +2 on the next step of the chain. That is the
				// choice a foothold is supposed to create: push on now at the odds you
				// have, or work this one and push on at better ones.
				footholds = footholds.map((f) =>
					f.structure_id === target.id ? { ...f, persistent: true, staged: true } : f
				);
				const next = CHAIN.find((c) => c.chain === (target.chain ?? 0) + 1);
				push(heat[t] >= 80 ? 'all' : actor.faction, {
					when: `R${round} · ${a.name}`,
					title: 'dug in at',
					subject: target.name,
					icon: 'flame',
					tone: 'bad',
					major: true,
					qualifiers: [
						OUTCOME_LABEL[outcome].toLowerCase(),
						'persistent · staged',
						next ? `${next.name} +2` : 'ready for the core'
					]
				});
				ping(target.id, 'tick');
				checkVictory();
				return;
			}
			{
				footholds = [
					...footholds,
					{
						structure_id: target.id,
						seat_key: actor.key,
						// A partial gets you in and nothing more — it can be dislodged the
						// moment anybody thinks to try.
						persistent: outcome === 'clean' || outcome === 'critical',
						// Heat is what gives you away. A quiet hit is a hit nobody logged.
						revealed: heat[t] >= 80,
						sleeper: a.key === 'sleeper',
						placed_round: round,
						staged: false
					}
				];
			}
			const seen = heat[t] >= 80;
			push(seen ? 'all' : actor.faction, {
				when: `R${round} · ${a.name}`,
				title: 'held',
				subject: target.name,
				icon: outcome === 'critical' ? 'flame' : 'zap',
				tone: 'bad',
				major: outcome === 'critical',
				qualifiers: [
					OUTCOME_LABEL[outcome].toLowerCase(),
					`roll ${total} vs ${targetNumber}`,
					outcome === 'partial' ? 'dislodgeable' : 'persistent',
					`+${added * 6} heat`
				]
			});
			if (!seen) pushHeatTell(t, added * 6);
		} else {
			// The wall held, and the wall took a hit doing it. A botch does not even
			// manage that — you came apart on the approach, and the wall is untouched.
			const dealt = outcome === 'botch' ? 0 : 1;
			if (dealt) chip[target.id] = (chip[target.id] ?? 0) + dealt;
			if (outcome === 'botch') rout(target.id, actor.faction, 1);
			// A repelled attack is the one thing blue always learns about: something
			// hit the wall, and walls make a noise.
			push('all', {
				when: `R${round} · ${seat.faction === actor.faction ? a.name : 'contact'}`,
				title: outcome === 'botch' ? 'came apart at' : 'repelled at',
				subject: target.name,
				icon: 'shield',
				tone: 'ok',
				major: outcome === 'botch',
				qualifiers: [
					OUTCOME_LABEL[outcome].toLowerCase(),
					`roll ${total} vs ${targetNumber}`,
					dealt ? `−1 hardening → ${hardeningOf(target.id)}` : 'the wall was not touched',
					`+${added * 6} detection`
				]
			});
		}
		checkVictory();
	}

	/** Red's quiet turns. No dice, no foothold — they change the number the NEXT
	 *  roll is made against, which is exactly how the real thing works. */
	function applyRedSupport(actor: Klass, a: Ability, id: string, outcome: Outcome) {
		const s = structureById(id);
		if (!s) return;
		const base = Math.abs(fxFor(a.key, actor.faction).power);
		const got = scaleEffect(outcome, base);

		if (!got) {
			// A botched approach is louder than a quiet failure — being caught trying
			// is worse than not trying.
			const noise = outcome === 'botch' ? a.noise * 3 + 6 : a.noise * 3;
			heat[s.territory] = Math.min(100, heat[s.territory] + noise);
			push('red', {
				when: `R${round} · ${a.name}`,
				title: outcome === 'botch' ? 'blew it at' : 'got nowhere at',
				subject: s.name,
				icon: 'x',
				tone: 'warn',
				qualifiers: [OUTCOME_LABEL[outcome].toLowerCase(), `+${noise} heat`]
			});
			pushHeatTell(s.territory, noise);
			return;
		}

		if (a.key === 'contribution') {
			res[actor.key] += got;
			push('red', {
				when: `R${round} · ${a.name}`,
				title: 'contributed to',
				subject: s.name,
				icon: 'check',
				tone: 'info',
				qualifiers: [
					OUTCOME_LABEL[outcome].toLowerCase(),
					`+${got} REP`,
					'indistinguishable from help'
				]
			});
			return;
		}

		softened[id] = (softened[id] ?? 0) + got;
		expiry[`soft:${id}`] = round + 2;
		heat[s.territory] = Math.min(100, heat[s.territory] + a.noise * 6);
		push('red', {
			when: `R${round} · ${a.name}`,
			title: 'weakened',
			subject: s.name,
			icon: 'wrench',
			tone: 'warn',
			qualifiers: [
				OUTCOME_LABEL[outcome].toLowerCase(),
				`−${got} hardening`,
				`now ${hardeningOf(id)}`,
				'2 rounds'
			]
		});
		pushHeatTell(s.territory, a.noise * 6);
	}

	function applyBlue(actor: Klass, a: Ability, id: string, outcome: Outcome) {
		const s = structureById(id);
		if (!s) return;
		const base = Math.abs(fxFor(a.key, actor.faction).power);
		const got = scaleEffect(outcome, base);

		if (!got) {
			// Blue's failures are quiet, and that is their own problem: the budget is
			// spent, the wall is where it was, and red learns nothing either.
			push('blue', {
				when: `R${round} · ${a.name}`,
				title: outcome === 'botch' ? 'went wrong at' : 'achieved nothing at',
				subject: s.name,
				icon: 'x',
				tone: 'warn',
				qualifiers: [OUTCOME_LABEL[outcome].toLowerCase(), 'AP spent']
			});
			return;
		}
		if (a.key === 'harden') {
			// No separate bookkeeping: the +3 IS the three figures that just took up
			// position, and they are on the board where red can go and remove them.
			push('blue', {
				when: `R${round} · Harden`,
				title: 'reinforced',
				subject: s.name,
				icon: 'shield',
				tone: 'ok',
				qualifiers: [`hardening ${hardeningOf(id)}`, `${atStructure(id, 'blue').length} on the wall`]
			});
			return;
		}
		if (a.key === 'segment' && id === 'beacon') {
			// Sinkholing the callback. Everything red has planted is still planted —
			// it just cannot phone home any more, and a thing that has stopped
			// behaving normally is a thing you can finally see.
			quarantined = [...new Set([...quarantined, id])];
			expiry[`quar:${id}`] = round + 2;
			const exposed = footholds.filter((f) => !f.revealed).length;
			footholds = footholds.map((f) => ({ ...f, revealed: true }));
			push('all', {
				when: `R${round} · Segment`,
				title: 'sinkholed —',
				subject: 'the Relay Beacon',
				icon: 'radio',
				tone: 'ok',
				major: true,
				qualifiers: [`${exposed} implant${exposed === 1 ? '' : 's'} went dark and showed`]
			});
			return;
		}
		if (a.key === 'attribute' && id === 'personas') {
			// Burning the identity where it was made. The Maintainer's whole passive
			// is trust it spent two years accruing; this is the card that spends it.
			res.maintainer = 0;
			rout('personas', 'red', GARRISON_CAP);
			push('all', {
				when: `R${round} · Attribution`,
				title: 'burned the identity at',
				subject: s.name,
				icon: 'fingerprint',
				tone: 'ok',
				major: true,
				qualifiers: ['REP reset to 0', 'the persona cannot be worn twice']
			});
			return;
		}
		if (a.key === 'quarantine') {
			quarantined = [...new Set([...quarantined, id])];
			expiry[`quar:${id}`] = round + got;
			ping(id, 'sealed');
			// A sealed building is visible from the outside — red can see the door shut.
			push('all', {
				when: `R${round} · Quarantine`,
				title: 'sealed',
				subject: s.name,
				icon: 'lock',
				tone: 'warn',
				qualifiers: [
					OUTCOME_LABEL[outcome].toLowerCase(),
					`${got} round${got === 1 ? '' : 's'}`,
					'chain cannot advance through it'
				]
			});
			return;
		}
		// Recon: sweep a territory, diff an artifact, attest a chain. Each one turns
		// hidden state into shared state — which is the only currency blue has.
		const scope =
			a.key === 'sweep'
				? STRUCTURES.filter((x) => x.territory === s.territory).map((x) => x.id)
				: [id];
		// A partial look finds one thing; a clean one finds everything in scope.
		const candidates = footholds.filter(
			(f) => scope.includes(f.structure_id) && !f.revealed && !(a.key === 'sweep' && f.sleeper)
		);
		const found =
			outcome === 'partial' ? candidates.slice(0, 1) : candidates;
		footholds = footholds.map((f) =>
			found.some((g) => g.structure_id === f.structure_id) ? { ...f, revealed: true } : f
		);
		for (const f of found) ping(f.structure_id, 'reveal');

		// The code review. This is the counter to an implant, and it is the reason
		// the implant is allowed to sit there indefinitely in the first place: it
		// stays until somebody actually reads the tree. How MUCH of the tree you
		// got through is the roll: a clean deep read pulls everything, a partial
		// one pulls what was near the top.
		const deep = a.key !== 'sweep' && (outcome === 'clean' || outcome === 'critical');
		let pulled = 0;
		for (const sid of scope) {
			const implants = garrison.filter(
				(g) => g.structureId === sid && g.faction === 'red' && g.leaves === 'implant'
			);
			if (!implants.length) continue;
			const take = deep ? implants.length : 1;
			const gone = rout(sid, 'red', take, 'implant');
			if (gone) ping(sid, 'cleared');
			pulled += gone;
		}
		if (pulled) {
			push('all', {
				when: `R${round} · ${a.name}`,
				title: 'pulled out of the tree',
				subject: `${pulled} implant${pulled === 1 ? '' : 's'}`,
				icon: 'trash',
				tone: 'ok',
				major: true,
				qualifiers: [deep ? 'read in full' : 'one found on a pass']
			});
		}
		// A reveal is public — that is what makes it worth anything. A sweep that
		// found nothing is blue's own business.
		push(found.length ? 'all' : 'blue', {
			when: `R${round} · ${a.name}`,
			title: found.length ? 'uncovered' : 'found nothing at',
			subject: found.length
				? found.map((f) => structureById(f.structure_id)?.name).join(', ')
				: a.key === 'sweep'
					? TERRITORIES[s.territory].name
					: s.name,
			icon: found.length ? 'eye' : 'search',
			tone: found.length ? 'bad' : 'info',
			major: found.length > 0,
			qualifiers: found.length
				? [OUTCOME_LABEL[outcome].toLowerCase(), 'foothold revealed']
				: [OUTCOME_LABEL[outcome].toLowerCase(), 'sleepers are inert, not absent']
		});
	}

	function endTurn() {
		if (busy || winner) return;
		armedKey = null;
		lastRoll = null;
		const next = (phase + 1) % INITIATIVE.length;
		if (next === 0) upkeep();
		phase = next;
		// Hot seat: the HUD follows the turn. Under AUTO it does not — you stay in
		// your chair and watch the other three play, which is the only way a fog-of-
		// war game can be demonstrated to one person.
		if (!auto) seatKey = INITIATIVE[next];
	}

	/**
	 * Start of round. Everything here is a clock the players do not have to wind:
	 * AP refills, temporary effects lapse, detection cools, and a region that has
	 * gone loud enough gives up whatever is hiding in it.
	 */
	function upkeep() {
		round += 1;
		for (const k of Object.keys(ap)) ap[k] = 3;
		// Trust accrues to whoever spent the round being useful.
		res.maintainer += 1;

		for (const [k, until] of Object.entries(expiry)) {
			if (round < until) continue;
			const [kind, id] = k.split(':');
			if (kind === 'soft') delete softened[id];
			if (kind === 'quar') {
				quarantined = quarantined.filter((q) => q !== id);
				// The seal lapses and the people manning it stand down with it.
				rout(id, 'blue', GARRISON_CAP, 'garrison');
			}
			delete expiry[k];
		}

		// Detection decays. Without this red can never go quiet again, and a game
		// where nothing cools is a game with one strategy in it.
		for (const t of TERRITORY_ORDER) heat[t] = Math.max(0, heat[t] - 4);

		// Repairs. Damage a building took holding the line comes back a point a
		// round, so wearing one down means keeping the pressure ON it rather than
		// chipping at everything once.
		for (const id of Object.keys(chip)) {
			chip[id] -= 1;
			if (chip[id] <= 0) delete chip[id];
		}

		// ── Dwell ────────────────────────────────────────────────────────────────
		// What an implant DOES while nobody deals with it. Left alone it burrows:
		// a point of hardening a round off the building it is in, and a little heat
		// as it works. This is the whole reason cleanup is a move — an implant you
		// ignore is not neutral, it is compounding, and a defender who spends every
		// turn building walls somewhere else loses the building it is standing in.
		//
		// A sealed building is the exception: nothing gets in or out, including the
		// implant's own callback, so it does nothing while the seal holds.
		const burrowing = garrison.filter(
			(g) => g.faction === 'red' && g.leaves === 'implant' && !quarantined.includes(g.structureId)
		);
		const bySite = new Map<string, number>();
		for (const g of burrowing) bySite.set(g.structureId, (bySite.get(g.structureId) ?? 0) + 1);
		for (const [sid, n] of bySite) {
			const s = structureById(sid);
			if (!s) continue;
			chip[sid] = (chip[sid] ?? 0) + n;
			heat[s.territory] = Math.min(100, heat[s.territory] + n * 2);
			ping(sid, 'tick');
			push(
				footholds.find((f) => f.structure_id === sid)?.revealed ? 'all' : 'red',
				{
					when: `R${round}`,
					title: 'burrowed deeper into',
					subject: s.name,
					icon: 'flame',
					tone: 'bad',
					qualifiers: [`${n} implant${n === 1 ? '' : 's'}`, `−${n} hardening → ${hardeningOf(sid)}`]
				}
			);
		}
		// Blue is told a number moved, not what moved it.
		for (const [sid, n] of bySite) {
			const s = structureById(sid);
			if (s && !footholds.find((f) => f.structure_id === sid)?.revealed) {
				pushHeatTell(s.territory, n * 2);
			}
		}

		// A region loud enough stops keeping secrets — the automation that makes
		// noise matter without blue having to spend a card on a hunch.
		for (const t of TERRITORY_ORDER) {
			if (heat[t] < 80) continue;
			const ids = STRUCTURES.filter((s) => s.territory === t).map((s) => s.id);
			const out = footholds.filter((f) => ids.includes(f.structure_id) && !f.revealed && !f.sleeper);
			if (!out.length) continue;
			footholds = footholds.map((f) =>
				out.some((g) => g.structure_id === f.structure_id) ? { ...f, revealed: true } : f
			);
			for (const f of out) ping(f.structure_id, 'reveal');
			push('all', {
				when: `R${round}`,
				title: 'surfaced in',
				subject: TERRITORIES[t].name,
				icon: 'eye',
				tone: 'bad',
				major: true,
				qualifiers: [`detection ${heat[t]}`, `${out.length} exposed`]
			});
		}

		push('all', {
			when: `R${round}`,
			title: 'round opened',
			subject: `Round ${round}`,
			icon: 'clock',
			tone: 'info',
			qualifiers: ['3 AP each', `${12 - round} rounds to the horizon`]
		});
		checkVictory();
	}

	function checkVictory() {
		if (winner) return;
		if (CHAIN.every((s) => footholds.some((f) => f.structure_id === s.id))) {
			winner = 'red';
			push('all', {
				when: `R${round}`,
				title: 'payload delivered to',
				subject: 'PROTECTED CORE',
				icon: 'flame',
				tone: 'bad',
				major: true,
				qualifiers: ['every step of the path held']
			});
			auto = false;
			return;
		}
		if (round > 12) {
			winner = 'blue';
			push('all', {
				when: `R${round}`,
				title: 'horizon reached —',
				subject: 'the estate held',
				icon: 'shield',
				tone: 'ok',
				major: true,
				qualifiers: ['the path was never completed']
			});
			auto = false;
		}
	}

	// ── The other three chairs ───────────────────────────────────────────────────
	// Not an opponent — a demonstrator. It plays the line the game is trying to
	// teach: red softens a target it cannot yet beat and strikes when the odds turn,
	// blue sweeps whatever region is loudest and otherwise builds walls.
	function aiChoice(actor: Klass): { a: Ability; t: Structure } | null {
		const afford = actor.abilities.filter((x) => x.ap <= (ap[actor.key] ?? 0));
		if (!afford.length) return null;
		// The demonstrator plays the same rules — including the chain order, which
		// is why watching it is worth anything.
		// The demonstrator does not run at walls it can see.
		const legal = (x: Ability, s: Structure) =>
			canTarget(x, s, actor.faction) && !attackBlocked(actor, x, s);
		const goal = CHAIN.find((s) => !footholds.some((f) => f.structure_id === s.id)) ?? CHAIN[0];

		if (actor.faction === 'red') {
			const strike = afford.find(
				(x) => (x.kind === 'strike' || x.kind === 'implant') && legal(x, goal)
			);
			if (strike) {
				const o = oddsFor(actor, strike, goal);
				// Take the shot when it is worth taking; otherwise spend the turn making
				// it worth taking. That single threshold is the whole personality.
				if (o.chance >= 0.45) return { a: strike, t: goal };
			}
			const soften = afford.find((x) => x.kind === 'control' && legal(x, goal));
			if (soften && !softened[goal.id]) return { a: soften, t: goal };
			const econ = afford.find((x) => x.kind === 'econ');
			if (econ) return { a: econ, t: structureById('forum') ?? goal };
			return strike ? { a: strike, t: goal } : null;
		}

		// Blue now has somewhere to go on the offensive, and it takes the shot when
		// the shot is worth taking: once red is holding ground, sinkholing the relay
		// exposes the lot, which is worth more than another point of wall.
		const held = footholds.length;
		const segment = afford.find((x) => x.key === 'segment');
		const beacon = structureById('beacon');
		if (segment && beacon && held >= 2 && !quarantined.includes('beacon')) {
			return { a: segment, t: beacon };
		}

		const hottest = TERRITORY_ORDER.filter((t) => TERRITORIES[t].owner !== 'red').reduce((x, y) =>
			heat[x] >= heat[y] ? x : y
		);
		const sweep = afford.find((x) => x.key === 'sweep');
		if (sweep && heat[hottest] >= 35) {
			const anchor = STRUCTURES.find((s) => s.territory === hottest && legal(sweep, s));
			if (anchor) return { a: sweep, t: anchor };
		}
		const harden = afford.find((x) => x.key === 'harden');
		if (harden && legal(harden, goal)) return { a: harden, t: goal };
		const any = afford.find((x) => legal(x, goal));
		if (any) return { a: any, t: goal };
		// Nothing legal at the goal — take whatever the first legal pairing is.
		for (const x of afford) {
			const t = STRUCTURES.find((s) => legal(x, s));
			if (t) return { a: x, t };
		}
		return null;
	}

	async function aiTurn() {
		const actor = activeKlass;
		const pick = aiChoice(actor);
		if (!pick) {
			endTurn();
			return;
		}
		// Show what it is aiming at before it fires — an AI that resolves instantly
		// is indistinguishable from a bug.
		selectedId = pick.t.id;
		await wait(420);
		await perform(actor, pick.a, pick.t);
		await wait(260);
		endTurn();
	}

	$effect(() => {
		if (!auto || busy || winner) return;
		// Re-armed on every phase change; the timeout is the pace of the demo.
		const p = phase;
		void p;
		const id = setTimeout(() => void aiTurn(), 900);
		return () => clearTimeout(id);
	});

	// ── HUD insets — the globe is fitted around the chrome, never under it ───────
	// The arena's whole thesis is that the board is the interface, so the chrome
	// it has to dodge is two narrow rails and a strip of felt. The globe gets the
	// rest, which is most of the screen.
	const EDGE = 12;
	const GAP = 10;
	const TICKER_H = 28;
	// The felt is 200px tall but the globe is only fitted above 150 of it: the
	// hero portrait is MEANT to overlap the world's lower edge — you are standing
	// at the foot of it — and that only reads if the sphere runs behind them.
	const FELT_FIT = 150;
	let leftW = $state(0);
	let rightW = $state(0);
	let floating = $state(true);
	$effect(() => {
		const mq = window.matchMedia('(min-width: 1280px)');
		floating = mq.matches;
		const on = (e: MediaQueryListEvent) => (floating = e.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});
	const hudInsets = $derived(
		floating
			? {
					top: TICKER_H + GAP,
					right: rightW > 0 ? EDGE + rightW + GAP : 0,
					bottom: FELT_FIT,
					left: leftW > 0 ? EDGE + leftW + GAP : 0
				}
			: { top: TICKER_H + GAP }
	);

	// ── Geometry, stated inline ──────────────────────────────────────────────────
	// This mockup lives in a gitignored directory, and Tailwind only picks such a
	// directory up when the dev server boots with it already present — so a
	// utility this file is the FIRST in the repo to use may simply not exist in
	// the generated sheet on a server that was already running. Anything the
	// LAYOUT depends on is therefore an inline style rather than a class: the
	// arena then lands correctly on a cold server, a warm one, and in a
	// screenshot harness, which a mockup built to be compared side by side has to.
	const RAIL_W = 124;
	const SPINE_W = 86;
	const FELT_H = 200;
	/** Shared by the two rails and the panels that fly out of them. */
	const RAIL_TOP = TICKER_H + 8;

	// ── Arena disclosure state ───────────────────────────────────────────────────
	// Everything the old board printed permanently is behind one of these. The
	// rule is that the map mode carries no prose: a rail tile, a diamond or a
	// building is clicked, and the sentence arrives then.
	/** Which seat's sheet is open in the rail flyout. */
	let sheetKey = $state<string | null>(null);
	/** The battle log, which is a history and therefore never ambient. */
	let logOpen = $state(false);
	const sheet = $derived(sheetKey ? (ROSTER.find((r) => r.key === sheetKey) ?? null) : null);

	/** How exposed a seat is, 0–100 — the one number its rail bar carries.
	 *  Red is measured on the noise it has made; blue on how much of the path it
	 *  has actually managed to see. Same bar, opposite meaning, which is the
	 *  asymmetry the whole game is about. */
	function pressureOf(k: Klass): number {
		if (k.faction === 'red') return Math.max(...TERRITORY_ORDER.map((t) => heat[t]));
		return Math.round((chainShown.length / CHAIN.length) * 100);
	}

	/** Every precondition on committing the armed card, in one place — the commit
	 *  button reads it, and so does the odds it prints on itself. */
	const ready = $derived(!!armed && !!target && legalTarget && canPay && !busy && !winner);

	/** The turn clock as a 0–1 fraction, plus the colour it has earned. Drives the
	 *  ring around the portrait, which is the only clock this layout has. */
	const clockFrac = $derived(turnLeft / TURN_MS);
	const clockTone = $derived(
		clockFrac > 0.4 ? seat.color : clockFrac > 0.17 ? '#FBBF24' : '#FB7185'
	);
	const clockLive = $derived(stage === 'play' && !winner && isMyTurn);

	// ── Target sheet anchoring ───────────────────────────────────────────────────
	// A stat block belongs beside the building it describes, not in a rail on the
	// far side of the screen. The globe spins and the camera flies to a selection,
	// so the anchor is tracked per frame off the same `[data-node]` boxes BoardFx
	// measures — when the piece moves, its sheet moves with it.
	let anchor = $state<{ x: number; y: number } | null>(null);
	$effect(() => {
		if (!selectedId) {
			anchor = null;
			return;
		}
		const id = selectedId;
		let raf = 0;
		const track = () => {
			const el = document.querySelector(`[data-node="${id}"]`);
			if (el) {
				const r = el.getBoundingClientRect();
				anchor = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
			}
			raf = requestAnimationFrame(track);
		};
		raf = requestAnimationFrame(track);
		return () => cancelAnimationFrame(raf);
	});

	const PANEL =
		'rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_86%,transparent)] backdrop-blur-md shadow-[0_8px_28px_rgba(0,0,0,0.4)]';
	const EYEBROW = 'font-mono text-[0.58rem] tracking-[0.16em] uppercase text-[var(--fg-dim)]';
	const KIND_COLOR: Record<string, string> = {
		strike: '#FB7185',
		implant: '#F472B6',
		recon: '#38BDF8',
		control: '#A78BFA',
		econ: '#FBBF24',
		utility: '#34D399'
	};
	const pct = (n: number) => `${Math.round(n * 100)}%`;

	const targetStats = $derived.by(() => {
		if (!target) return [];
		const f = visibleOn(target.id);
		return [
			{ label: 'Hardening', value: String(hardeningOf(target.id)) },
			{ label: 'Region', value: TERRITORIES[target.territory].name },
			{ label: meterName(seat.faction), value: `${heat[target.territory]}%` },
			{ label: 'Controls', value: target.controls.length ? target.controls.join(', ') : 'none' },
			{ label: 'Path step', value: target.chain ? `${target.chain} of ${CHAIN.length}` : 'off-path' },
			{
				label: 'Occupancy',
				value: f
					? `${f.sleeper ? 'sleeper' : 'foothold'}${f.persistent ? ' · persistent' : ''}`
					: seat.faction === 'blue'
						? 'nothing proven'
						: 'clear'
			}
		];
	});
</script>

<svelte:head>
	<title>BREACH · Arena — supply-chain skirmish</title>
</svelte:head>

<!-- Escape belongs to the window, not to whichever panel happens to hold focus.
     It clears whatever is open, outermost first. -->
<svelte:window
	onkeydown={(e) => {
		if (e.key !== 'Escape') return;
		if (rulesOpen) rulesOpen = false;
		else if (logOpen) logOpen = false;
		else if (sheetKey) sheetKey = null;
		else if (inspectKey) inspectKey = null;
		else if (selectedId) selectedId = null;
	}}
/>

<div class="relative flex flex-col h-screen overflow-hidden text-[var(--fg)]">
	<div class="relative flex-1 min-h-0">
		<!-- ── Ticker ────────────────────────────────────────────────────────────-
		     28px, and nothing on it is a sentence. The round is twelve pips because
		     "ROUND 1/12" is a number a player has to read and twelve dots filling up
		     is a fuse they can feel. Initiative moved to the rail, where it is the
		     order the seats are stacked in; the turn clock moved onto the hero, who
		     is the thing running out of time. -->
		<div
			class="absolute inset-x-0 top-0 z-[3] flex items-center gap-3 px-3 border-b border-[var(--border)]
			       bg-gradient-to-b from-black/85 to-transparent backdrop-blur-[2px]
			       whitespace-nowrap overflow-hidden"
			style:height="{TICKER_H}px"
		>
			<span class="shrink-0 font-mono text-[0.6rem] font-bold tracking-[0.18em]">BREACH</span>
			<!-- Twelve pips. Filled is spent, and the last three are already the
			     colour of the trouble they represent. -->
			<span class="flex items-center gap-[3px]" title="round {round} of 12">
				{#each Array(12) as _, i (i)}
					<span
						class="w-[5px] h-[5px] rounded-[1px]"
						style:background={i < round
							? i >= 9
								? '#FB7185'
								: 'var(--fg)'
							: 'color-mix(in srgb, var(--fg) 18%, transparent)'}
					></span>
				{/each}
			</span>
			<!-- The horizon only speaks when it is close enough to change a decision.
			     Eight rounds out it is a number nobody acts on; three rounds out it
			     is the only thing on the board that matters. -->
			{#if !winner && 12 - round <= 3}
				<span
					class="font-mono text-[0.54rem] font-bold tracking-[0.16em] uppercase px-1.5 py-px rounded animate-pulse"
					style:color="#FB7185"
					style:background="color-mix(in srgb, #FB7185 16%, transparent)"
					>{Math.max(0, 12 - round)} to horizon</span
				>
			{/if}

			<span class="flex-1"></span>

			<!-- Seat switcher. A demonstrator's control, not a player's — four pips,
			     because the seat you are in is already stated by the character
			     standing at the bottom of the screen. -->
			<span class="flex items-center gap-1">
				{#each ROSTER as k (k.key)}
					<button
						type="button"
						onclick={() => switchSeat(k.key)}
						title="sit in {k.name}"
						class="font-mono font-bold tracking-[0.1em] uppercase py-px rounded border"
						style:width="22px"
						style:font-size="0.48rem"
						style:color={k.key === seatKey ? k.color : 'var(--fg-dim)'}
						style:border-color={k.key === seatKey
							? `color-mix(in srgb, ${k.color} 60%, transparent)`
							: 'var(--border)'}
						style:background={k.key === seatKey
							? `color-mix(in srgb, ${k.color} 16%, transparent)`
							: 'transparent'}>{k.seat}</button
					>
				{/each}
			</span>

			<span class="w-px h-3.5 bg-[var(--border)]"></span>

			<!-- Three icons. The log is a history and histories are looked up, never
			     watched; AUTO hands all four chairs to the demonstrator. -->
			{#snippet hudChip(
				on: boolean,
				name: IconName,
				label: string,
				act: () => void,
				hue = 'var(--accent)'
			)}
				<button
					type="button"
					onclick={act}
					title={label}
					aria-label={label}
					class="grid place-items-center rounded border"
					style:width="22px"
					style:height="18px"
					style:color={on ? hue : 'var(--fg-dim)'}
					style:border-color={on ? `color-mix(in srgb, ${hue} 55%, transparent)` : 'var(--border)'}
					style:background={on ? `color-mix(in srgb, ${hue} 14%, transparent)` : 'transparent'}
				>
					<Icon {name} size={11} />
				</button>
			{/snippet}
			{@render hudChip(logOpen, 'clipboard-list', 'battle log', () => (logOpen = !logOpen))}
			{@render hudChip(auto, 'play', 'auto-play all seats', () => (auto = !auto), '#34D399')}
			{@render hudChip(rulesOpen, 'info', 'rules', () => (rulesOpen = !rulesOpen))}
		</div>

		<!-- ── The board ─────────────────────────────────────────────────────────-
		     `typeLabels` off: every building here is already called something, and
		     stamping AGENTIC over each one says nothing twice. -->
		<!-- ── Everything else gets out of the way ───────────────────────────────
		     A scrim between the board and the HUD, rather than an opacity on each
		     panel: one element, and it cannot miss a panel somebody adds later.
		     The z-ordering is the whole mechanism — the board is lifted above the
		     scrim, the scrim is above every panel, and nothing is unmounted, so the
		     insets the canvas is fitted to never change and the globe does not
		     resize itself on the way in or out.

		     Lifted only WHILE a scene runs. Left permanently above the panels, the
		     canvas would sit over them and swallow every click meant for a card. -->
		<div
			class="pointer-events-none absolute inset-0 z-[10] bg-[#04070d] transition-opacity duration-300"
			style:opacity={povLive ? 0.92 : 0}
		></div>
		<div class="absolute inset-x-0 bottom-0 {povLive ? 'z-[20]' : ''}" style:top="{TICKER_H}px">
			<MeshCanvas
				bind:this={boardMesh}
				bind:camera={boardCamera}
				{nodes}
				{edges}
				bind:layout
				hubId={CORE_ID}
				globeControls
				layoutPicker
				globeLabel="Breach board"
				{hudInsets}
				globeFill={0.94}
				radiusOf={nodeFootprint}
				autoRotate
				autoRotateSpeed={0.0016}
				axialTilt={(23 * Math.PI) / 180}
				insetLeafLabels
				typeLabels={false}
				focusOnSelect
				focusDurationMs={700}
				bind:selectedId
				{groupKeyOf}
				globeTerritories
				territoryOf={styleOf}
				{terrain}
			/>
			<!-- Combat feedback rides ON TOP of the canvas, anchored to live node
			     boxes — see BoardFx. It never intercepts a pointer, so the globe is
			     still draggable mid-resolution. -->
			<BoardFx
				active={activeFx}
				{foggedAnchorId}
				{aimIds}
				aimHoverId={drag?.over ?? selectedId}
				aimHue={armed ? fxFor(armed.key, seat.faction).hue : seat.color}
				bars={boardBars}
				garrison={visibleGarrison}
				{pings}
				severed={severedLinks}
			/>
			<!-- The POV scene. A sibling of the canvas for the same reason BoardFx
			     is one: it reads the drawn `[data-node]` boxes out of the DOM, so it
			     has to sit where those are reachable and in the same box they are
			     measured against. Idle it is an invisible, inert div. -->
			<FirstPerson
				bind:this={fp}
				mesh={boardMesh}
				camera={boardCamera}
				insets={hudInsets}
			/>
		</div>

		<!-- ── The verdict, once ─────────────────────────────────────────────────-
		     The old board printed the score across the top of the world for all
		     twelve rounds. The score is five diamonds on the right rail now, and
		     this speaks exactly once, when there is finally something to say. -->
		{#if winner}
			{@const tone = winner === 'red' ? '#FB7185' : '#34D399'}
			<div
				class="{PANEL} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
				       flex flex-col items-center gap-2 px-8 py-6 text-center"
				style:z-index="8"
				style:border-color="color-mix(in srgb, {tone} 55%, var(--border))"
			>
				<span
					class="font-mono text-[0.56rem] font-bold tracking-[0.24em] uppercase"
					style:color={tone}>match over</span
				>
				<span class="font-mono leading-snug" style:font-size="0.95rem" style:max-width="26rem">
					{winner === 'red'
						? 'Payload delivered — the path was completed before the horizon.'
						: 'The estate held — the horizon passed with the path unfinished.'}
				</span>
				<button
					type="button"
					onclick={newMatch}
					class="mt-1 font-mono text-[0.6rem] font-bold tracking-[0.16em] uppercase px-4 py-1.5 rounded border"
					style:color={tone}
					style:border-color="color-mix(in srgb, {tone} 45%, transparent)"
					style:background="color-mix(in srgb, {tone} 12%, transparent)">new match</button
				>
			</div>
		{/if}

		<!-- ── Left rail — the table and the ground ──────────────────────────────-
		     The four panels this replaces answered one question between them —
		     who is at this table and how are they doing — and made a player
		     assemble the answer out of a seat switcher, an ally/enemy list, a
		     stack of heat bars and a ticker. It is one column now: four seats in
		     initiative order over the five regions they are fighting on.

		     Nothing here is a sentence. A tile carries a colour, a glyph, a
		     two-character seat code, three pips and one bar; the name, the skills
		     and the passive arrive when the tile is clicked. -->
		<div
			bind:clientWidth={leftW}
			class="flex gap-2"
			style:position={floating ? 'absolute' : 'static'}
			style:flex-direction={floating ? 'column' : 'row'}
			style:flex-wrap={floating ? 'nowrap' : 'wrap'}
			style:top={floating ? `${RAIL_TOP}px` : null}
			style:bottom={floating ? `${FELT_H}px` : null}
			style:left={floating ? `${EDGE}px` : null}
			style:width={floating ? `${RAIL_W}px` : null}
			style:z-index={floating ? 3 : null}
			style:pointer-events={floating ? 'none' : null}
		>
			<!-- The table, stacked in INITIATIVE order — so the rail is also the turn
			     tracker, and "who goes after me" is a spatial fact rather than a
			     second widget. -->
			<div class="{PANEL} pointer-events-auto shrink-0 flex flex-col gap-1 p-1.5">
				{#each INITIATIVE as key (key)}
					{@const k = klassByKey(key)}
					{@const you = k.key === seat.key}
					{@const enemy = k.faction !== seat.faction}
					{@const acting = activeKlass.key === k.key}
					{@const p = pressureOf(k)}
					{@const hot = p >= 70}
					<button
						type="button"
						onclick={() => (sheetKey = sheetKey === k.key ? null : k.key)}
						title="{k.name} · {enemy ? 'enemy' : you ? 'you' : 'ally'}"
						class="relative flex items-center gap-1.5 rounded border pl-2 pr-1.5 text-left transition-all"
						class:py-1={!you}
						class:py-0.5={you}
						style:border-color={acting
							? `color-mix(in srgb, ${k.color} 65%, transparent)`
							: sheetKey === k.key
								? 'color-mix(in srgb, var(--fg) 30%, transparent)'
								: 'var(--border)'}
						style:background={acting
							? `color-mix(in srgb, ${k.color} 12%, transparent)`
							: 'transparent'}
					>
						<!-- Side, as a stripe down the edge. Two of these are yours and two
						     are not, and that is legible before a single glyph resolves. -->
						<span
							class="absolute inset-y-1 left-0 rounded-full"
							style:width="3px"
							style:background={enemy ? '#FB7185' : '#34D399'}
							style:opacity={you ? 1 : 0.65}
						></span>

						{#if you}
							<!-- Your own tile is a marker, not a readout. Everything about you
							     is already standing at the bottom of the screen at four times
							     this size — saying it twice is how the old board filled up. -->
							<span class="font-mono text-[0.5rem] tracking-[0.14em]" style:color={k.color}>▸</span>
							<span
								class="flex-1 font-mono text-[0.48rem] font-bold tracking-[0.16em] uppercase"
								style:color={k.color}>you</span
							>
							<span class="font-mono text-[0.46rem] tracking-widest text-[var(--fg-dim)]"
								>{k.seat}</span
							>
						{:else}
							<span style:color={k.color} class="shrink-0">
								<Icon name={k.icon as IconName} size={13} />
							</span>
							<div class="flex-1 min-w-0 flex flex-col gap-[3px]">
								<div class="flex items-center gap-1">
									<span class="font-mono text-[0.5rem] font-bold tracking-widest" style:color={k.color}
										>{k.seat}</span
									>
									<span class="flex-1"></span>
									<!-- What they have left to spend on you this round. Fogged for
									     an enemy: knowing an enemy is out of AP is knowing you are
									     safe, and that is not something the table tells you. -->
									<span class="flex items-center gap-[2px]">
										{#each [0, 1, 2] as i (i)}
											<span
												class="rounded-full"
												style:width="4px"
												style:height="4px"
												style:background={enemy
													? i < (ap[k.key] ?? 0)
														? 'color-mix(in srgb, var(--fg) 30%, transparent)'
														: 'color-mix(in srgb, var(--fg) 10%, transparent)'
													: i < (ap[k.key] ?? 0)
														? k.color
														: 'var(--border)'}
											></span>
										{/each}
									</span>
								</div>
								<!-- One bar. Red is measured on the noise it has made, blue on
								     how much of the path it has proven — same bar, opposite
								     meaning, which is the asymmetry the game is about. -->
								<span class="rounded-full bg-[var(--border)] overflow-hidden" style:height="3px">
									<span
										class="block h-full rounded-full transition-all duration-500"
										style:width="{Math.max(3, p)}%"
										style:background={hot ? '#FB7185' : k.color}
									></span>
								</span>
							</div>
						{/if}
					</button>
				{/each}
			</div>

			<!-- The ground. Five regions, no names — the colour IS the name, because
			     it is the same colour that region is painted on the globe. -->
			<div class="{PANEL} pointer-events-auto shrink-0 flex flex-col gap-1.5 px-2 py-2">
				{#each TERRITORY_ORDER as t (t)}
					{@const own = TERRITORIES[t].owner}
					{@const h = heat[t]}
					<div
						class="flex items-center gap-1.5"
						title="{TERRITORIES[t].name} · {TERRITORIES[t].real} · {own === 'neutral'
							? 'contested'
							: `${own} ground`} · {meterName(seat.faction).toLowerCase()} {h}"
					>
						<!-- Region swatch, with ownership as the ring around it. -->
						<span
							class="rounded-[2px] shrink-0 border"
							style:width="9px"
							style:height="9px"
							style:background={TERRITORIES[t].color}
							style:border-color={own === 'red'
								? '#F472B6'
								: own === 'blue'
									? '#38BDF8'
									: 'transparent'}
						></span>
						<span class="flex-1 h-[5px] rounded-full bg-[var(--border)] overflow-hidden">
							<span
								class="block h-full rounded-full transition-all duration-500"
								style:width="{Math.max(2, h)}%"
								style:background={h >= 70 ? '#FB7185' : h >= 40 ? '#FBBF24' : TERRITORIES[t].color}
							></span>
						</span>
						<!-- The number shows up when it starts to matter, and not before. -->
						<span
							class="text-right font-mono text-[0.5rem] tabular-nums"
							style:width="16px"
							style:color={h >= 70 ? '#FB7185' : 'var(--fg-dim)'}
							style:opacity={h >= 40 ? 1 : 0}>{h}</span
						>
					</div>
				{/each}
			</div>
		</div>

		<!-- ── Seat sheet — the depth behind a rail tile ─────────────────────────-
		     Clicking a tile is the whole disclosure model in one gesture: the rail
		     says who and how much, this says who they ARE. Fog still applies — an
		     enemy's hand is never in here, only what the table can see. -->
		{#if sheet}
			{@const enemy = sheet.faction !== seat.faction}
			<div
				class="{PANEL} absolute flex flex-col gap-2 p-3"
				style:z-index="7"
				style:top="{RAIL_TOP}px"
				style:left="{EDGE + RAIL_W + 8}px"
				style:width="248px"
				style:border-color="color-mix(in srgb, {sheet.color} 45%, var(--border))"
			>
				<div class="flex items-start gap-2">
					<span
						class="mt-0.5 grid place-items-center w-8 h-8 rounded border shrink-0"
						style:color={sheet.color}
						style:border-color="color-mix(in srgb, {sheet.color} 45%, transparent)"
						style:background="color-mix(in srgb, {sheet.color} 12%, transparent)"
					>
						<Icon name={sheet.icon as IconName} size={16} />
					</span>
					<div class="flex flex-col gap-0.5 min-w-0 flex-1">
						<span class="font-mono text-[0.74rem] font-bold" style:color={sheet.color}
							>{sheet.name}</span
						>
						<span class="font-mono text-[0.54rem] leading-snug text-[var(--fg-dim)]"
							>{sheet.tagline}</span
						>
					</div>
					<button
						type="button"
						onclick={() => (sheetKey = null)}
						class="font-mono text-[0.7rem] leading-none text-[var(--fg-dim)] hover:text-[var(--fg)]"
						aria-label="Close seat sheet">✕</button
					>
				</div>
				<div class="flex items-center gap-1.5">
					<span
						class="font-mono text-[0.44rem] font-bold tracking-[0.16em] uppercase px-1 py-px rounded"
						style:color={sheet.key === seat.key ? sheet.color : enemy ? '#FB7185' : '#34D399'}
						style:background="color-mix(in srgb, {sheet.key === seat.key
							? sheet.color
							: enemy
								? '#FB7185'
								: '#34D399'} 16%, transparent)"
						>{sheet.key === seat.key ? 'you' : enemy ? 'enemy' : 'ally'}</span
					>
					<span class="font-mono text-[0.5rem] tracking-widest uppercase text-[var(--fg-dim)]"
						>seat {sheet.seat} · {sheet.faction === 'red' ? 'attacker' : 'defender'}</span
					>
				</div>
				<!-- Skills. The same card in two different pairs of hands is not the
				     same card, and this is where a player sees why. -->
				<div class="grid grid-cols-4 gap-1">
					{#each Object.keys(sheet.skills) as k (k)}
						{@const v = sheet.skills[k as Skill]}
						<div
							class="flex flex-col items-center gap-0.5 py-1 rounded border border-[var(--border)]"
							title={SKILL_BLURB[k as Skill]}
						>
							<span
								class="font-mono text-[0.76rem] font-bold leading-none tabular-nums"
								style:color={v > 0 ? sheet.color : v < 0 ? '#FB7185' : 'var(--fg-dim)'}
								>{v >= 0 ? '+' : ''}{v}</span
							>
							<span class="font-mono text-[0.42rem] tracking-[0.1em] text-[var(--fg-dim)]"
								>{SKILL_LABEL[k as Skill].slice(0, 3)}</span
							>
						</div>
					{/each}
				</div>
				<div
					class="flex flex-col gap-0.5 rounded border border-[var(--border)] px-2 py-1.5
					       bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]"
				>
					<span class="font-mono text-[0.5rem] tracking-[0.16em] uppercase" style:color={sheet.color}
						>passive · {sheet.passive.name}</span
					>
					<span class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]"
						>{sheet.passive.text}</span
					>
				</div>
				{#if sheet.key !== seat.key}
					<button
						type="button"
						onclick={() => {
							switchSeat(sheet!.key);
							sheetKey = null;
						}}
						class="font-mono text-[0.5rem] font-bold tracking-[0.16em] uppercase py-1 rounded border"
						style:color={sheet.color}
						style:border-color="color-mix(in srgb, {sheet.color} 45%, transparent)"
						>sit here</button
					>
				{/if}
			</div>
		{/if}

		<!-- ── Battle log — a history, and histories are looked up ───────────────-
		     It was a permanent panel eating a third of the left column to show two
		     lines of text. It is a keypress and an icon now. -->
		{#if logOpen}
			<div
				class="{PANEL} absolute flex flex-col gap-2 p-3"
				style:z-index="7"
				style:top="{RAIL_TOP}px"
				style:left="{EDGE + RAIL_W + 8}px"
				style:bottom="{FELT_H}px"
				style:width="300px"
			>
				<div class="flex items-center justify-between gap-2 shrink-0">
					<span class={EYEBROW}>/ battle log</span>
					<span
						class="flex items-center gap-1.5 font-mono text-[0.54rem] tracking-widest uppercase text-[var(--fg-dim)]"
					>
						<StatusDot status="healthy" glow />
						round {round}
					</span>
					<button
						type="button"
						onclick={() => (logOpen = false)}
						class="font-mono text-[0.7rem] leading-none text-[var(--fg-dim)] hover:text-[var(--fg)]"
						aria-label="Close log">✕</button
					>
				</div>
				<div class="flex-1 min-h-0 overflow-y-auto pr-1">
					<Timeline events={feed} variant="feed" />
				</div>
			</div>
		{/if}

		<!-- ── Right spine — the score and the one button ────────────────────────-
		     The payload path was a 340px panel listing five buildings that are
		     already drawn, named and bar-charted on the globe six inches to its
		     left. What a player actually reads off it is "how many have they got",
		     so that is what is left: five diamonds, filled or hollow.

		     Under them, the button. It is here, at this height, in this size, in
		     every state of the game — a fixed thing your hand learns, which is
		     most of what makes a card game feel fast. -->
		<div
			bind:clientWidth={rightW}
			class="flex flex-col items-center gap-3"
			style:position={floating ? 'absolute' : 'static'}
			style:top={floating ? `${RAIL_TOP}px` : null}
			style:bottom={floating ? `${FELT_H}px` : null}
			style:right={floating ? `${EDGE}px` : null}
			style:width={floating ? `${SPINE_W}px` : null}
			style:z-index={floating ? 3 : null}
			style:pointer-events={floating ? 'none' : null}
		>
			<!-- Five diamonds, top to bottom, Outlands → Core. Hovering one lights
			     the matching building; clicking flies the globe to it. -->
			<div class="{PANEL} pointer-events-auto shrink-0 flex flex-col items-center gap-1.5 px-2 py-2.5">
				{#each CHAIN as s (s.id)}
					{@const f = visibleOn(s.id)}
					{@const isNext = chainNext?.id === s.id && seat.faction === 'red'}
					{@const bar = barFor(s)}
					{@const lev = seat.faction === 'red' ? leverageFor(s) : 0}
					<button
						type="button"
						onclick={() => (selectedId = s.id)}
						title="{s.chain}. {s.name} — {f
							? f.staged
								? 'staged'
								: f.sleeper
									? 'sleeper'
									: 'held'
							: isNext
								? 'next'
								: 'clear'} · hardening {bar.value}{lev > 0 && !f ? ` · +${lev} leverage` : ''}"
						class="relative grid place-items-center transition-transform hover:scale-110"
						class:animate-pulse={isNext}
						style:width="32px"
						style:height="32px"
					>
						<!-- The diamond itself. Held is solid; next is an outline waiting
						     to be filled; the rest are barely there. -->
						<span
							class="absolute rotate-45 rounded-[3px] border-2 transition-colors"
							style:inset="5px"
							style:border-color={f
								? '#F472B6'
								: isNext
									? 'var(--accent)'
									: 'color-mix(in srgb, var(--fg) 22%, transparent)'}
							style:background={f
								? '#F472B6'
								: isNext
									? 'color-mix(in srgb, var(--accent) 18%, transparent)'
									: 'transparent'}
						></span>
						<span
							class="relative font-mono text-[0.5rem] font-bold tabular-nums"
							style:color={f ? '#0b0f16' : isNext ? 'var(--accent)' : 'var(--fg-dim)'}
							>{s.chain}</span
						>
						<!-- Leverage rides on the diamond as a spur, because it is a fact
						     about this step and nowhere else. -->
						{#if lev > 0 && !f}
							<span
								class="absolute -right-0.5 -top-0.5 font-mono text-[0.4rem] font-bold px-[3px] rounded-full"
								style:color="#0b0f16"
								style:background="#F472B6">+{lev}</span
							>
						{/if}
					</button>
				{/each}
			</div>

			<span class="flex-1"></span>

			<!-- ── The button ────────────────────────────────────────────────────-
			     One primary action, and it carries its own odds. A player deciding
			     whether to commit is asking "will this work" — printing the answer
			     ON the commit control is the shortest possible distance between the
			     question and the click. -->
			<div class="pointer-events-auto flex flex-col items-center gap-2 shrink-0">
				{#if diceSpin}
					<span
						class="font-mono text-[0.5rem] tracking-[0.16em] uppercase text-[var(--fg-dim)] animate-pulse"
						>rolling</span
					>
				{:else if lastRoll}
					<!-- The dice are thrown at the building and left lying on it — see
					     BoardFx. Only the verdict comes back here. -->
					<span class="flex flex-col items-center gap-0.5">
						<b
							class="font-mono text-[0.46rem] font-bold tracking-[0.14em] uppercase px-1.5 py-px rounded"
							style:color="var(--bg-elev, #0b0f16)"
							style:background={OUTCOME_COLOR[lastRoll.outcome]}>{OUTCOME_LABEL[lastRoll.outcome]}</b
						>
						<span class="font-mono text-[0.5rem] tabular-nums text-[var(--fg-dim)]"
							>{lastRoll.dice[0]}+{lastRoll.dice[1]} · {lastRoll.margin >= 0
								? '+'
								: ''}{lastRoll.margin}</span
						>
					</span>
				{/if}

				<button
					type="button"
					disabled={!ready}
					onclick={resolve}
					title={armed && target
						? blockReason
							? blockReason.text
							: `commit ${armed.name} against ${target.name}`
						: 'arm a card, then pick a building'}
					class="relative grid place-items-center rounded-full border-2 transition-all
					       disabled:cursor-not-allowed"
					style:width="68px"
					style:height="68px"
					style:color={ready ? seat.color : 'var(--fg-dim)'}
					style:border-color={ready
						? seat.color
						: 'color-mix(in srgb, var(--fg) 16%, transparent)'}
					style:background={ready
						? `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${seat.color} 30%, transparent), color-mix(in srgb, ${seat.color} 10%, transparent))`
						: 'color-mix(in srgb, var(--fg) 4%, transparent)'}
					style:box-shadow={ready ? `0 0 22px color-mix(in srgb, ${seat.color} 35%, transparent)` : 'none'}
				>
					{#if ready && odds}
						<span class="font-mono text-[1.05rem] font-bold leading-none tabular-nums"
							>{pct(odds.chance)}</span
						>
						<span
							class="absolute bottom-2.5 font-mono text-[0.42rem] tracking-[0.16em] uppercase opacity-70"
							>commit</span
						>
					{:else if blockReason}
						<Icon name="lock" size={20} />
					{:else}
						<span class="font-mono text-[0.48rem] tracking-[0.16em] uppercase">commit</span>
					{/if}
				</button>

				<button
					type="button"
					disabled={busy || !!winner}
					onclick={endTurn}
					title="the turn ends on its own when your AP or your clock runs out"
					class="font-mono text-[0.5rem] tracking-[0.16em] uppercase px-3 py-1 rounded border border-[var(--border)]
					       text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-35">pass</button
				>
			</div>
		</div>

		<!-- ── Target sheet — anchored to the building it describes ──────────────-
		     This used to be a card in a rail on the far right, which meant reading
		     a building's stats involved looking away from the building. It is
		     pinned beside the piece now and tracks it per frame, so the globe can
		     keep turning underneath and the sheet stays attached to its subject. -->
		{#if target && anchor}
			{@const f = visibleOn(target.id)}
			<div
				class="{PANEL} fixed flex flex-col gap-1.5 p-2.5 pointer-events-auto"
				style:z-index="7"
				style:width="210px"
				style:left="{Math.min(Math.max(anchor.x + 26, 8), (typeof window !== 'undefined' ? window.innerWidth : 1600) - 226)}px"
				style:top="{Math.min(Math.max(anchor.y - 40, 36), (typeof window !== 'undefined' ? window.innerHeight : 900) - 210)}px"
				style:border-color={f ? 'color-mix(in srgb, #F472B6 50%, var(--border))' : 'var(--border)'}
			>
				<div class="flex items-center gap-1.5">
					<span style:color={TERRITORIES[target.territory].color}>
						<Icon name={target.chain ? 'flag' : 'home'} size={12} />
					</span>
					<span class="flex-1 min-w-0 font-mono text-[0.66rem] font-bold truncate">{target.name}</span>
					<button
						type="button"
						onclick={() => (selectedId = null)}
						class="font-mono text-[0.66rem] leading-none text-[var(--fg-dim)] hover:text-[var(--fg)]"
						aria-label="Clear target">✕</button
					>
				</div>
				<span class="font-mono text-[0.46rem] tracking-widest uppercase text-[var(--fg-dim)]">
					{target.role} · {TERRITORIES[target.territory].real}
				</span>
				<dl class="grid grid-cols-2 gap-x-2 gap-y-0.5 m-0">
					{#each targetStats.slice(0, 4) as st (st.label)}
						<div class="flex justify-between gap-1.5 border-b border-[var(--border)] pb-0.5">
							<dt class="font-mono text-[0.44rem] tracking-wide uppercase text-[var(--fg-dim)]">
								{st.label}
							</dt>
							<dd class="m-0 font-mono text-[0.54rem] font-semibold tabular-nums truncate">
								{st.value}
							</dd>
						</div>
					{/each}
				</dl>
				<p class="m-0 font-mono text-[0.48rem] leading-snug text-[var(--fg-dim)]">{target.note}</p>
			</div>
		{/if}

		<!-- ── The contextual strip ──────────────────────────────────────────────-
		     The board mode has exactly one place prose is allowed, and it is empty
		     until a player asks it something. Two questions, one slot, never both:

		       a card is armed at a building → what will happen, and how likely
		       a card is merely picked up    → what the card says

		     The old board answered both permanently, in two stacked bars, plus an
		     instruction line telling a player to do the thing they were already
		     doing. Nothing armed and nothing held now means nothing on screen. -->
		{#if armed && target}
			{@const kfx = fxFor(armed.key, seat.faction)}
			<div
				class="{PANEL} absolute left-1/2 -translate-x-1/2 z-[6]
				       flex items-center gap-2.5 px-3 py-1.5 w-[min(94vw,40rem)]"
				style:bottom="{FELT_H + 12}px"
				style:border-color="color-mix(in srgb, {kfx.hue} 45%, var(--border))"
			>
				<span style:color={kfx.hue}><Icon name={kfx.icon as IconName} size={13} /></span>
				<span class="font-mono text-[0.62rem] font-bold" style:color={kfx.hue}>{armed.name}</span>
				<span class="font-mono text-[0.6rem] text-[var(--fg-dim)]">→</span>
				<span class="font-mono text-[0.66rem] font-semibold truncate">{target.name}</span>
				{#if blockReason}
					<!-- Say WHY. "Illegal target" tells a player they were wrong; "take
					     The Archive first — the chain runs in order" tells them the game. -->
					<span
						class="font-mono text-[0.58rem]"
						style:color={blockReason.kind === 'sealed' ? '#A78BFA' : '#FB7185'}
						>{blockReason.text}</span
					>
				{:else if odds}
					<span class="flex-1"></span>
					<!-- The roll, itemised. "+7" tells a player nothing about which of
					     their choices earned it; skill + card + trust does. -->
					<span class="font-mono text-[0.55rem] text-[var(--fg-dim)] tabular-nums">
						2d6
						<b style:color={seat.color} title={SKILL_LABEL[armed.skill]}
							>{odds.skill >= 0 ? '+' : ''}{odds.skill}</b
						>
						{#if odds.abilityMod}<b class="text-[var(--fg)]">+{odds.abilityMod}</b>{/if}
						{#if odds.resourceMod}<b class="text-[var(--fg)]">+{odds.resourceMod}</b>{/if}
						{#if odds.holdMod}<b style:color="#F472B6">+{odds.holdMod}</b>{/if}
						vs <b class="text-[var(--fg)]">{odds.target}</b>
					</span>
					<!-- Two numbers, because there are two questions: does it work at
					     all, and does it work properly. The first is also printed on the
					     commit button — this is where the second one lives. -->
					<span class="flex items-center gap-1">
						<b class="font-mono text-[0.66rem] font-bold tabular-nums" style:color={OUTCOME_COLOR.clean}
							>{pct(odds.chanceClean)}</b
						>
						<span class="font-mono text-[0.44rem] uppercase text-[var(--fg-dim)]">clean</span>
						{#if odds.chanceBotch > 0.02}
							<b class="ml-1 font-mono text-[0.6rem] font-bold tabular-nums" style:color={OUTCOME_COLOR.botch}
								>{pct(odds.chanceBotch)}</b
							>
							<span class="font-mono text-[0.44rem] uppercase text-[var(--fg-dim)]">botch</span>
						{/if}
					</span>
				{/if}
			</div>
		{:else if inspected}
			{@const ifx = fxFor(inspected.key, seat.faction)}
			<div
				class="{PANEL} absolute left-1/2 -translate-x-1/2 z-[6]
				       flex flex-col gap-1.5 px-3 py-2 w-[min(94vw,40rem)]"
				style:bottom="{FELT_H + 12}px"
				style:border-color="color-mix(in srgb, {ifx.hue} 50%, var(--border))"
			>
				<div class="flex items-center gap-2 flex-wrap">
					<span style:color={ifx.hue}><Icon name={ifx.icon as IconName} size={14} /></span>
					<span class="font-mono text-[0.74rem] font-bold">{inspected.name}</span>
					<span
						class="font-mono text-[0.48rem] font-bold tracking-[0.14em] uppercase px-1 py-px rounded"
						style:color={ifx.hue}
						style:background="color-mix(in srgb, {ifx.hue} 16%, transparent)">{inspected.kind}</span
					>
					<span class="flex-1"></span>
					<span class="font-mono text-[0.54rem] tracking-wide uppercase text-[var(--fg-dim)]">
						cost <b class="ml-1 text-[0.66rem] text-[var(--fg)] tabular-nums">{inspected.ap} AP</b>
					</span>
					{#if inspected.mod}
						<span class="font-mono text-[0.54rem] tracking-wide uppercase text-[var(--fg-dim)]">
							roll <b class="ml-1 text-[0.66rem] tabular-nums" style:color={ifx.hue}
								>+{inspected.mod}</b
							>
						</span>
					{/if}
					<span class="font-mono text-[0.54rem] tracking-wide uppercase text-[var(--fg-dim)]">
						noise
						<b class="ml-1 text-[0.66rem] tabular-nums" style:color={inspected.noise ? '#FBBF24' : '#34D399'}
							>{inspected.noise || 'none'}</b
						>
					</span>
					<button
						type="button"
						onclick={() => (inspectKey = null)}
						class="font-mono text-[0.7rem] text-[var(--fg-dim)] hover:text-[var(--fg)]"
						aria-label="Close card">✕</button
					>
				</div>
				<p class="m-0 font-mono text-[0.58rem] leading-snug text-[var(--fg-dim)]">{inspected.text}</p>
				<div class="flex items-center gap-2 flex-wrap">
					<!-- Not a list of building names. The board is already showing you
					     exactly where this can go — this only says how many, so you know
					     whether to go looking round the back of the globe. -->
					<span
						class="font-mono text-[0.5rem] tracking-wide uppercase"
						style:color={inspectedSites ? ifx.hue : '#FB7185'}
					>
						{inspectedSites
							? `${inspectedSites} site${inspectedSites === 1 ? '' : 's'} lit on the board`
							: 'nowhere to play this yet'}
					</span>
					<span class="flex-1"></span>
					<span class="font-mono text-[0.5rem] tracking-wide uppercase" style:color={ifx.hue}
						>drag onto the world to play →</span
					>
				</div>
			</div>
		{/if}

		<!-- ── The felt — your character, and the hand at their feet ─────────────-
		     The whole re-layout in one strip. You are a portrait on the bottom edge
		     of the world rather than a stat block in a corner, and the hand fans
		     out to either side of you with the portrait as the keystone of the arc.

		     Everything the old RESOURCES panel counted is set into the frame here,
		     because it is all a fact about YOU and it belongs on the picture of
		     you: the ring is the turn clock, the pips under the chin are action
		     points, the badge on the shoulder is the class resource, and the sigil
		     is the passive. None of it is a labelled row in a list any more.

		     Cards are dealt into their slots from the dispenser at the right edge;
		     until one arrives it is parked off-screen with the same transform the
		     transition animates, so the deal costs one CSS property and no
		     keyframes. Click a card to read it. Drag it onto the world to play it —
		     the drop target is a building, which is the whole reason the map is
		     there. -->
		<div class="absolute inset-x-0 bottom-0 z-[5] pointer-events-none" style:height="{FELT_H}px">
			<!-- A wash under the felt so a card never has to be read against whatever
			     part of the globe happens to be behind it. -->
			<div
				class="absolute inset-x-0 bottom-0 h-full"
				style:background="linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 45%, transparent 100%)"
			></div>

			{#each seat.abilities as a, i (a.key)}
				{@const n = seat.abilities.length}
				{@const raw = i - (n - 1) / 2}
				<!-- The split fan. `raw` is the ordinary symmetric offset; the extra
				     push opens a gap in the middle of the arc exactly wide enough for
				     the character to stand in it. -->
				{@const off = raw + (raw < 0 ? -0.72 : 0.72)}
				{@const affordable = (ap[seat.key] ?? 0) >= a.ap}
				{@const playable = affordable && !busy && !winner && isMyTurn}
				{@const lifted = hoverKey === a.key || armedKey === a.key || inspectKey === a.key}
				{@const dealt = i < dealtCount}
				{@const flying = drag?.key === a.key}
				<div
					class="absolute left-1/2 bottom-0 pointer-events-auto select-none touch-none"
					style:transform={dealt
						? `translate(calc(-50% + ${off * 132}px), ${flying ? 40 : lifted ? -64 : -18}px)
						   rotate(${flying ? 0 : off * 5}deg) scale(${flying ? 1 : lifted ? 1.22 : 1})`
						: 'translate(calc(-50% + 62vw), -18px) rotate(220deg)'}
					style:opacity={dealt ? (flying ? 0.25 : 1) : 0}
					style:transition="transform 520ms cubic-bezier(0.16, 0.9, 0.3, 1), opacity 300ms ease-out"
					style:z-index={lifted ? 40 : 10 + i}
					style:cursor={playable ? 'grab' : 'default'}
					onpointerenter={() => (hoverKey = a.key)}
					onpointerleave={() => (hoverKey = null)}
					onpointerdown={(e) => {
						armedKey = a.key;
						inspectKey = a.key;
						startDrag(e, a.key);
					}}
					role="button"
					tabindex="0"
					aria-label={a.name}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') inspectKey = a.key;
					}}
				>
					<Card
						ability={a}
						fx={fxFor(a.key, seat.faction)}
						seatColor={seat.color}
						{affordable}
						disabled={!playable}
						armed={armedKey === a.key}
						raised={lifted}
						icon={fxFor(a.key, seat.faction).icon as IconName}
				skillMod={seat.skills[a.skill]}
					/>
				</div>
			{/each}

			<!-- ── You ───────────────────────────────────────────────────────────-
			     Dead centre of the fan, half-sunk into the bottom edge so the globe
			     runs behind your shoulders. Click for the sheet the rail tiles open;
			     everything else about you is read off the frame without a word. -->
			<div
				class="absolute left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-1.5"
				style:bottom="10px"
			>
				<button
					type="button"
					onclick={() => (sheetKey = sheetKey === seat.key ? null : seat.key)}
					title="{seat.name} — {seat.tagline}"
					class="relative grid place-items-center rounded-full"
					style:width="104px"
					style:height="104px"
				>
					<!-- The turn clock IS the portrait ring. The old board put a 64px bar
					     in a ticker at the top of the screen, as far from where a player
					     is looking as it is possible to get; the clock belongs on the
					     person it is running out for. -->
					<svg class="absolute inset-0 -rotate-90" viewBox="0 0 104 104" aria-hidden="true">
						<circle
							cx="52"
							cy="52"
							r="49"
							fill="none"
							stroke="color-mix(in srgb, var(--fg) 12%, transparent)"
							stroke-width="3"
						/>
						{#if clockLive}
							<circle
								cx="52"
								cy="52"
								r="49"
								fill="none"
								stroke={clockTone}
								stroke-width="3"
								stroke-linecap="round"
								stroke-dasharray={2 * Math.PI * 49}
								stroke-dashoffset={2 * Math.PI * 49 * (1 - clockFrac)}
								style:transition="stroke-dashoffset {TURN_TICK}ms linear"
								style:opacity={busy ? 0.4 : 1}
							/>
						{/if}
					</svg>

					<!-- The portrait plate. It lights when it is your turn and goes quiet
					     when it is not, which is the only "waiting…" this layout needs. -->
					<span
						class="grid place-items-center rounded-full border-2 transition-all"
						style:width="86px"
						style:height="86px"
						style:color={seat.color}
						style:border-color="color-mix(in srgb, {seat.color} {clockLive ? 70 : 30}%, transparent)"
						style:background="radial-gradient(circle at 50% 34%, color-mix(in srgb, {seat.color} {clockLive
							? 32
							: 14}%, var(--bg-elev, #0b0f16)), var(--bg-elev, #0b0f16) 78%)"
						style:box-shadow={clockLive
							? `0 0 26px color-mix(in srgb, ${seat.color} 32%, transparent)`
							: 'none'}
					>
						<Icon name={seat.icon as IconName} size={34} />
					</span>

					<!-- The passive, as a sigil on the shoulder. It was six lines of prose
					     nailed to the left rail for the whole match; it is a glyph you
					     hover once, learn, and stop needing. -->
					<span
						class="absolute grid place-items-center rounded-full border"
						style:left="-2px"
						style:top="16px"
						style:width="22px"
						style:height="22px"
						style:color={seat.color}
						style:border-color="color-mix(in srgb, {seat.color} 50%, transparent)"
						style:background="var(--bg-elev, #0b0f16)"
						title="passive · {seat.passive.name} — {seat.passive.text}"
					>
						<Icon name="zap" size={11} />
					</span>

					<!-- The class resource, as a badge on the other shoulder. One numeral,
					     three letters. -->
					<span
						class="absolute flex flex-col items-center leading-none px-1.5 py-1 rounded-md border"
						style:right="-4px"
						style:top="14px"
						style:border-color="color-mix(in srgb, {seat.color} 45%, transparent)"
						style:background="var(--bg-elev, #0b0f16)"
						title="{res[seat.key] ?? 0} {seat.resource}"
					>
						<b class="font-mono text-[0.72rem] font-bold tabular-nums" style:color={seat.color}
							>{res[seat.key] ?? 0}</b
						>
						<span class="font-mono tracking-[0.1em] text-[var(--fg-dim)]" style:font-size="0.36rem"
							>{seat.resource}</span
						>
					</span>
				</button>

				<!-- Action points, under the chin — the mana crystals of this game. Big
				     enough to count without counting. -->
				<span class="flex items-center gap-1.5" title="{ap[seat.key] ?? 0} of 3 action points">
					{#each [0, 1, 2] as i (i)}
						{@const spent = i >= (ap[seat.key] ?? 0)}
						<span
							class="rotate-45 rounded-[2px] border transition-all"
							style:width="10px"
							style:height="10px"
							style:border-color={spent
								? 'color-mix(in srgb, var(--fg) 20%, transparent)'
								: seat.color}
							style:background={spent ? 'transparent' : seat.color}
							style:box-shadow={spent
								? 'none'
								: `0 0 8px color-mix(in srgb, ${seat.color} 55%, transparent)`}
						></span>
					{/each}
				</span>
			</div>
		</div>
	</div>
</div>

<!-- ── Character select ────────────────────────────────────────────────────────
     Before anything else you choose who you are. Two chairs a side, and the two
     you do not take are played by the demonstrator — so the choice is which half
     of the game you want to be looking at from the inside, which is the only
     choice a fog-of-war game can offer. -->
<!-- ── Rules ───────────────────────────────────────────────────────────────────
     Four stats, one formula, two ways to win. A player who cannot answer "what
     is that number and what beats it" is not playing the game, they are pressing
     the lit button — and every number below is already on their screen somewhere,
     so this panel is naming what they can see rather than teaching new material. -->
{#if rulesOpen}
	<div
		class="fixed inset-0 z-[75] grid place-items-center px-6
		       bg-[color-mix(in_srgb,var(--bg,#05080d)_82%,transparent)] backdrop-blur-sm"
		role="presentation"
		onclick={() => (rulesOpen = false)}
	>
		<div class="{PANEL} flex flex-col gap-3 p-5 w-[min(92vw,50rem)]">
			<div class="flex items-center gap-2">
				<span class="font-mono text-[0.9rem] font-bold tracking-[0.16em]">HOW BREACH WORKS</span>
				<span class="flex-1"></span>
				<span class="font-mono text-[0.56rem] text-[var(--fg-dim)]">click anywhere to close</span>
			</div>

			<div class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
				<div class="flex flex-col gap-1">
					<span class={EYEBROW}>/ the four numbers</span>
					<dl class="flex flex-col gap-1 m-0">
						{#each [['AP', 'Action points. Three a round, each card costs one to three. Spending them all is what ends your turn.'], ['HARDENING', "The number on every building. An attack has to BEAT it — ties go to the defender. Blue raises it, red talks it down."], ['HEAT / DETECTION', 'One meter per region, 0–100. Red actions raise it; it cools 4 a round. At 80 the region gives up whatever is hiding in it. Red calls it heat, blue calls it detection — it is the same number.'], ['REP / BANK / BUDGET / SIGNAL', 'Your class resource. For a red seat it is added to the attack roll, up to 3.']] as [k, v] (k)}
							<div class="flex flex-col border-b border-[var(--border)] pb-1">
								<dt class="font-mono text-[0.56rem] font-bold tracking-wide" style:color="var(--accent)">
									{k}
								</dt>
								<dd class="m-0 font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">{v}</dd>
							</div>
						{/each}
					</dl>
				</div>

				<div class="flex flex-col gap-2">
						<span class={EYEBROW}>/ whose ground</span>
					<div class="flex flex-col gap-1">
						<div class="font-mono text-[0.55rem] leading-snug">
							<b style:color="#F472B6">STAGING GROUNDS</b>
							<span class="text-[var(--fg-dim)]"
								>— red's own: the relay implants call home to, the workshop the zero-day lives in, the
								farm the persona was grown on. Blue can reach it.</span
							>
						</div>
						<div class="font-mono text-[0.55rem] leading-snug">
							<b style:color="#38BDF8">COMMONS · FOUNDRY · MARCHES</b>
							<span class="text-[var(--fg-dim)]">— blue's estate. What red is trying to get into.</span>
						</div>
						<div class="font-mono text-[0.55rem] leading-snug">
							<b style:color="#FB923C">THE OUTLANDS</b>
							<span class="text-[var(--fg-dim)]"
								>— the supply chain. Neither side owns it, both sides live off it, and the payload
								path starts there.</span
							>
						</div>
						<div class="font-mono text-[0.52rem] leading-snug text-[var(--fg-dim)]">
							You cannot play a card on your own ground. Everything else is fair.
						</div>
					</div>

					<span class={EYEBROW}>/ an attack</span>
					<div
						class="rounded border border-[var(--border)] px-3 py-2 bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]"
					>
						<div class="font-mono text-[0.72rem] font-bold">
							2d6 + <span style:color={seat.color}>skill</span> +
							<span style:color="#F472B6">card</span> +
							<span style:color="#F472B6">resource</span>
							vs <span style:color="#38BDF8">hardening</span> or the card's DC
						</div>
						<div class="mt-1 font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
							<b class="text-[var(--fg)]">Every card rolls.</b> An attack is measured against the
							building; a control against its own difficulty. The number printed on the card is what
							a CLEAN roll gets you — everything else is measured against that, so one table covers
							the whole game.
						</div>
						<dl class="mt-2 flex flex-col gap-0.5 m-0">
							{#each [['critical', '+8 or better', 'the card, and then some'], ['clean', '+4 to +7', 'exactly what the card says'], ['partial', '+1 to +3', 'half the printed effect, rounded up'], ['fail', '0 or under', 'nothing — a tie goes to the defender'], ['botch', '−5 or worse', 'it goes wrong and costs you something']] as [k, band, what] (k)}
								<div class="flex items-baseline gap-2">
									<dt
										class="w-[52px] shrink-0 font-mono text-[0.5rem] font-bold tracking-[0.1em] uppercase"
										style:color={OUTCOME_COLOR[k as Outcome]}
									>
										{k}
									</dt>
									<dd class="m-0 font-mono text-[0.5rem] tabular-nums text-[var(--fg)] w-[68px]">
										{band}
									</dd>
									<dd class="m-0 font-mono text-[0.5rem] text-[var(--fg-dim)]">{what}</dd>
								</div>
							{/each}
						</dl>
					</div>

					<span class={EYEBROW}>/ skills</span>
					<div class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
						Every card rolls on one of <b class="text-[var(--fg)]">SOCIAL</b>,
						<b class="text-[var(--fg)]">TECH</b>, <b class="text-[var(--fg)]">OPSEC</b> or
						<b class="text-[var(--fg)]">ANALYSIS</b>, and your seat's rating in it is added. The
						Maintainer talks (+3 social) and cannot hide; the Handler hides (+3 opsec) and cannot
						talk. The same card is a different card in the other chair.
					</div>

						<span class={EYEBROW}>/ the chain, and cleaning it out</span>
					<div class="flex flex-col gap-1">
						<div class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
							<b class="text-[var(--fg)]">Red must go in order.</b> A step on the payload path can only
							be attacked once the step before it is held — you attack the registry because you already
							hold the runner that feeds it, not because you fancy it.
						</div>
						<div class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
							<b style:color="#A78BFA">Quarantine cuts the line.</b> A sealed building cannot be attacked
							at all, and the legs of the path either side of it are drawn CUT — nothing advances through
							it while the seal holds.
						</div>
						<div class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
							<b style:color="#F472B6">A foothold pays on the next step.</b> Holding the previous building
							is +1 on the attack, each implant you left there is another +1 (to 2), and playing a card
							on ground you ALREADY hold digs in instead of taking it twice — persistent, staged, and
							worth +2 more. Push on now at the odds you have, or work this one and push on at better
							ones.
						</div>
						<div class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
							<b style:color="#FB7185">An implant you ignore is not neutral.</b> Every round it stands, it
							burrows: −1 hardening off the building it is in, and heat as it works. Leave two in the same
							place and the wall comes down on its own. Cleanup is a move you have to spend.
						</div>
						<div class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
							Blue clears them by reading the code — <b class="text-[var(--fg)]">Diff the Tarball</b>
							and <b class="text-[var(--fg)]">Provenance Attestation</b> pull everything at a site on a
							clean roll, <b class="text-[var(--fg)]">Sweep</b> pulls one on a pass.
						</div>
					</div>

					<span class={EYEBROW}>/ the cards</span>
					<div class="font-mono text-[0.55rem] leading-snug text-[var(--fg-dim)]">
						Cost sits top-left, power bottom-left, noise bottom-right. Click a card to read what it
						does. <b class="text-[var(--fg)]">Drag it onto a building</b> to play it there — the
						legal sites light up while the card is in the air.
					</div>

					<span class={EYEBROW}>/ winning</span>
					<div class="flex flex-col gap-1">
						<div class="font-mono text-[0.55rem] leading-snug">
							<b style:color="#FB7185">RED</b>
							<span class="text-[var(--fg-dim)]"
								>holds all five steps of the payload path — Maintainer Circle, Archive, Forge, Silos,
								Checkpoint — in order, before round 12.</span
							>
						</div>
						<div class="font-mono text-[0.55rem] leading-snug">
							<b style:color="#38BDF8">BLUE</b>
							<span class="text-[var(--fg-dim)]"
								>is still standing at round 12, or reveals a foothold and plays Attribution. Blue
								cannot see red's work — only the detection it leaves behind.</span
							>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if stage === 'select'}
	<div
		class="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 px-6
		       bg-[color-mix(in_srgb,var(--bg,#05080d)_88%,transparent)] backdrop-blur-md"
	>
		<div class="flex flex-col items-center gap-1.5 text-center">
			<span class="font-mono text-[1.6rem] font-bold tracking-[0.3em]">BREACH</span>
			<span class="font-mono text-[0.72rem] tracking-[0.2em] uppercase text-[var(--fg-dim)]"
				>a supply chain, and the people trying to get through it</span
			>
			<span class="mt-2 font-mono text-[0.66rem] text-[var(--fg-dim)] max-w-[46rem]">
				Two seats attack, two defend, twelve rounds. Red wins by holding all five steps of the
				payload path into the core. Blue wins by still standing when the horizon arrives. Take a
				chair — the other three play themselves.
			</span>
		</div>

		<div class="flex flex-wrap items-stretch justify-center gap-3">
			{#each ROSTER as k (k.key)}
				<button
					type="button"
					onclick={() => takeSeat(k.key)}
					class="group flex flex-col gap-2 w-[248px] p-4 text-left rounded-xl border transition-all
					       hover:-translate-y-1"
					style:border-color="color-mix(in srgb, {k.color} 35%, var(--border))"
					style:background="linear-gradient(180deg, color-mix(in srgb, {k.color} 12%, var(--bg-elev, #0b0f16)) 0%, var(--bg-elev, #0b0f16) 60%)"
				>
					<div class="flex items-center gap-2">
						<span
							class="grid place-items-center w-9 h-9 rounded-full border shrink-0"
							style:color={k.color}
							style:border-color="color-mix(in srgb, {k.color} 45%, transparent)"
							style:background="color-mix(in srgb, {k.color} 14%, transparent)"
						>
							<Icon name={k.icon as IconName} size={17} />
						</span>
						<div class="flex flex-col min-w-0">
							<span class="font-mono text-[0.8rem] font-bold" style:color={k.color}>{k.name}</span>
							<span class="font-mono text-[0.5rem] tracking-[0.16em] uppercase text-[var(--fg-dim)]">
								{k.seat} · {k.faction === 'red' ? 'intrusion' : 'defence'} · {k.resource}
							</span>
						</div>
					</div>

					<span class="font-mono text-[0.56rem] leading-snug text-[var(--fg-dim)]">{k.tagline}</span>

					<!-- Skills, on the chair you are choosing. This is the choice: the
					     hand is four cards, but the ratings are who you are. -->
					<div class="grid grid-cols-4 gap-1">
						{#each Object.keys(k.skills) as sk (sk)}
							{@const v = k.skills[sk as Skill]}
							<div
								class="flex flex-col items-center gap-0.5 py-1 rounded border border-[var(--border)]"
								title={SKILL_BLURB[sk as Skill]}
							>
								<span
									class="font-mono text-[0.78rem] font-bold leading-none tabular-nums"
									style:color={v > 0 ? k.color : v < 0 ? '#FB7185' : 'var(--fg-dim)'}
									>{v >= 0 ? '+' : ''}{v}</span
								>
								<span class="font-mono text-[0.42rem] tracking-[0.1em] text-[var(--fg-dim)]"
									>{SKILL_LABEL[sk as Skill].slice(0, 3)}</span
								>
							</div>
						{/each}
					</div>

					<div
						class="flex flex-col gap-0.5 rounded border border-[var(--border)] px-2 py-1.5
						       bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]"
					>
						<span
							class="font-mono text-[0.48rem] tracking-[0.16em] uppercase"
							style:color={k.color}>passive · {k.passive.name}</span
						>
						<span class="font-mono text-[0.52rem] leading-snug text-[var(--fg-dim)]"
							>{k.passive.text}</span
						>
					</div>

					<div class="flex flex-col gap-0.5">
						<span class="font-mono text-[0.46rem] tracking-[0.16em] uppercase text-[var(--fg-dim)]"
							>opening hand</span
						>
						{#each k.abilities as a (a.key)}
							{@const afx = fxFor(a.key, k.faction)}
							<div class="flex items-center gap-1.5">
								<span style:color={afx.hue}><Icon name={afx.icon as IconName} size={10} /></span>
								<span class="flex-1 min-w-0 font-mono text-[0.52rem] truncate">{a.name}</span>
								<span class="flex items-center gap-0.5">
									{#each Array(a.ap) as _, i (i)}
										<span class="w-[5px] h-[5px] rounded-full" style:background={k.color}></span>
									{/each}
								</span>
							</div>
						{/each}
					</div>

					<span
						class="mt-auto pt-1 font-mono text-[0.56rem] font-bold tracking-[0.16em] uppercase group-hover:underline"
						style:color={k.color}>take this chair →</span
					>
				</button>
			{/each}
		</div>

		<div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
			<span class="font-mono text-[0.5rem] tracking-[0.16em] uppercase text-[var(--fg-dim)]"
				>not in this match</span
			>
			{#each BENCH as b (b.name)}
				<span
					class="font-mono text-[0.52rem]"
					title={b.note}
					style:color={b.faction === 'red' ? '#FB7185' : '#38BDF8'}>{b.name}</span
				>
			{/each}
		</div>
	</div>
{/if}

<!-- The card in flight. Rendered at the document root and out of every clipping
     context, so it can be carried anywhere over the board — and carried ABOVE
     the cursor rather than under it, because a card centred on the pointer
     covers the building you are aiming at, which is the one thing the drag
     exists to let you see. -->
{#if drag}
	{@const a = seat.abilities.find((x) => x.key === drag!.key)}
	{#if a}
		<div
			id="breach-drag-ghost"
			class="fixed z-[80] pointer-events-none"
			style:left="{drag.x}px"
			style:top="{drag.y}px"
			style:transform="translate(-50%, -112%) rotate(-4deg) scale(0.88)"
		>
			<Card
				ability={a}
				fx={fxFor(a.key, seat.faction)}
				seatColor={seat.color}
				affordable
				disabled={false}
				armed
				raised
				ghost
				icon={fxFor(a.key, seat.faction).icon as IconName}
				skillMod={seat.skills[a.skill]}
			/>
		</div>
	{/if}
{/if}
