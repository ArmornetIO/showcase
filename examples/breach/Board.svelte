<script lang="ts">
	// ── BoardFx — combat feedback drawn OVER the board ───────────────────────────
	// The board is an SVG projected off a spinning sphere: a building's screen
	// position changes every frame, and nothing inside the renderer is addressable
	// from here. So this layer does the cheapest thing that survives that — it
	// reads the live bounding box of `[data-node="<id>"]` on a rAF loop and draws
	// in screen space on top.
	//
	// That costs two getBoundingClientRect() calls a frame while an effect is
	// running and zero when nothing is. It needs no renderer change beyond the id
	// on the node group, and it cannot desync from the globe, because it is
	// reading the globe rather than predicting it.
	import {
		BAR_TONE,
		BEATS,
		DICE_CONTACTS,
		DICE_LOCK,
		DICE_ROLL_OUT,
		SEAL_AT,
		PIPS,
		bounceHeight,
		STRIKE_WINDOW,
		SWINGS,
		PING_MS,
		PING_STYLE,
		UNIT_POINTS,
		type ActiveFx,
		type BoardPing,
		type GarrisonUnit,
		type StatusBar
	} from './internal/fx.js';
	import { cssZoom } from 'showcase';

	interface Props {
		active: ActiveFx | null;
		/** Anchor used for a fogged ripple — some building in the right region,
		 *  never the one actually touched. */
		foggedAnchorId?: string | null;
		/** While a card is being dragged: every building it may legally be played
		 *  on. Drag-and-drop is only learnable if the board says where the card can
		 *  land BEFORE it is dropped — otherwise the player is guessing at 17
		 *  targets and finding out by being told no. */
		aimIds?: string[];
		/** The one currently under the card. */
		aimHoverId?: string | null;
		aimHue?: string;
		/** Condition bars, one per building worth watching. */
		bars?: StatusBar[];
		/** Everyone standing on the board, already fog-filtered by the caller. */
		garrison?: GarrisonUnit[];
		/** One-shot markers — found, cleared, burrowing, sealed. */
		pings?: BoardPing[];
		/** Chain links that are cut, as ordered id pairs. Drawn with the break
		 *  ON the line, because "the route home is severed" is a fact about the
		 *  LINE and putting it on the building leaves the player to infer it. */
		severed?: Array<{ from: string; to: string }>;
	}
	let {
		active,
		foggedAnchorId = null,
		aimIds = [],
		aimHoverId = null,
		aimHue = '#38BDF8',
		bars = [],
		garrison = [],
		pings = [],
		severed = []
	}: Props = $props();

	interface Anchor {
		x: number;
		y: number;
		/** Half the node's drawn box. Every radius below is a multiple of this
		 *  rather than a pixel count — the camera zooms when a node is selected, and
		 *  a fixed 40px ring is a shout at one zoom and invisible at the next. */
		r: number;
	}

	let host = $state<HTMLDivElement | null>(null);
	let from = $state<Anchor | null>(null);
	let to = $state<Anchor | null>(null);
	let elapsed = $state(0);

	/** Centre and size of a node's drawn box, in this overlay's own coordinates.
	 *
	 *  Returns null for anything on the FAR SIDE of the globe. The renderer fades
	 *  back-face nodes rather than removing them, so their boxes still exist and a
	 *  bar drawn from one would float in the middle of the sphere over a building
	 *  you cannot see. Reading the opacity the renderer already set is the cheapest
	 *  honest answer to "is this facing me". */
	function anchorOf(id: string): Anchor | null {
		if (!host) return null;
		const el = host.parentElement?.querySelector(`[data-node="${CSS.escape(id)}"]`);
		if (!el) return null;
		const o = Number((el as HTMLElement).style.opacity || '1');
		if (o < 0.4) return null;
		const r = (el as SVGGraphicsElement).getBoundingClientRect();
		const h = host.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) return null;
		// Rects are VISUAL px and this overlay draws in its host's LAYOUT px. The
		// two agree in the game, where nothing zooms, and not on the front page,
		// where the whole HUD is shrunk with `zoom` — which pulled every bar and
		// ring toward the top-left by the zoom factor and shrank its radius to
		// match. Divide once, here, rather than in each of the six draw sites.
		const z = cssZoom(host);
		return {
			x: (r.left + r.width / 2 - h.left) / z,
			y: (r.top + r.height / 2 - h.top) / z,
			// Clamped: a building the camera has flown into must not throw a ring the
			// size of the window, and one at the limb must still be visible.
			r: Math.max(14, Math.min(90, Math.max(r.width, r.height) / 2 / z))
		};
	}

	// One loop, alive only while an effect is. Positions are re-read every frame
	// because the globe is still turning underneath — an effect pinned to where
	// the building WAS is worse than no effect.
	$effect(() => {
		const a = active;
		if (!a) {
			from = to = null;
			elapsed = 0;
			return;
		}
		let raf = 0;
		const tick = () => {
			elapsed = performance.now() - a.startedAt;
			to = anchorOf(a.fogged ? (foggedAnchorId ?? a.toId) : a.toId);
			from = a.fogged || !a.fromId ? null : anchorOf(a.fromId);
			raf = requestAnimationFrame(tick);
		};
		tick();
		return () => cancelAnimationFrame(raf);
	});

	// Condition bars track the globe continuously — they are not an effect, they
	// are furniture, and furniture that lags the thing it is bolted to is worse
	// than none. One loop for the whole set.
	let barAnchors = $state<Array<StatusBar & Anchor>>([]);
	$effect(() => {
		if (!bars.length) {
			barAnchors = [];
			return;
		}
		const set = bars.map((b) => ({ ...b }));
		let raf = 0;
		const tick = () => {
			barAnchors = set
				.map((b) => {
					const a = anchorOf(b.id);
					return a ? { ...b, ...a } : null;
				})
				.filter((b): b is StatusBar & Anchor => !!b);
			raf = requestAnimationFrame(tick);
		};
		tick();
		return () => cancelAnimationFrame(raf);
	});

	// ── Standing forces ──────────────────────────────────────────────────────────
	// Everyone who is already on the board, posted around the building they hold.
	// Red takes the near side, blue the far side, so a contested building reads as
	// two groups facing each other across it rather than as one crowd.
	interface Posted extends GarrisonUnit {
		x: number;
		y: number;
		a: number;
		k: number;
	}
	let posted = $state<Posted[]>([]);
	$effect(() => {
		if (!garrison.length) {
			posted = [];
			return;
		}
		const list = garrison.map((g) => ({ ...g }));
		let raf = 0;
		const tick = () => {
			const now = performance.now();
			// Group by building so each garrison can be laid out as one arc.
			const byStructure = new Map<string, GarrisonUnit[]>();
			for (const g of list) {
				const arr = byStructure.get(g.structureId) ?? [];
				arr.push(g);
				byStructure.set(g.structureId, arr);
			}
			const out: Posted[] = [];
			for (const [sid, all] of byStructure) {
				const anc = anchorOf(sid);
				if (!anc) continue;
				const k = Math.max(0.8, Math.min(2.2, anc.r / 28));
				for (const faction of ['red', 'blue'] as const) {
					const side = all.filter((g) => g.faction === faction);
					// Red posts below the building, blue above it. Fixed sides, so you
					// learn where to look rather than reading colours every time.
					const base = faction === 'red' ? Math.PI * 0.62 : -Math.PI * 0.38;
					side.forEach((g, i) => {
						const spread = i - (side.length - 1) / 2;
						const ang = base + spread * 0.34;
						const rad = anc.r * 1.28;
						// A slow bob, out of step per unit, so a garrison looks manned
						// rather than printed.
						const bob = Math.sin(now / 700 + g.phase) * 1.6;
						out.push({
							...g,
							x: anc.x + Math.cos(ang) * rad,
							y: anc.y + Math.sin(ang) * rad + bob,
							// Facing the building they are standing at.
							a: ang + Math.PI,
							k
						});
					});
				}
			}
			posted = out;
			raf = requestAnimationFrame(tick);
		};
		tick();
		return () => cancelAnimationFrame(raf);
	});

	// Aim anchors run on their own loop, because aiming happens while nothing is
	// resolving — and it has to track the same spinning globe.
	let aims = $state<Array<Anchor & { id: string }>>([]);
	let pulse = $state(0);
	$effect(() => {
		if (!aimIds.length) {
			aims = [];
			return;
		}
		const ids = [...aimIds];
		let raf = 0;
		const tick = () => {
			pulse = (performance.now() % 1400) / 1400;
			aims = ids
				.map((id) => {
					const a = anchorOf(id);
					return a ? { ...a, id } : null;
				})
				.filter((a): a is Anchor & { id: string } => !!a);
			raf = requestAnimationFrame(tick);
		};
		tick();
		return () => cancelAnimationFrame(raf);
	});

	// ── Phase readouts ───────────────────────────────────────────────────────────
	// Each primitive owns a window of the timeline and draws its own progress
	// inside it. Nothing consults a clock but this block.
	const p = (start: number, len: number) =>
		Math.max(0, Math.min(1, (elapsed - start) / Math.max(1, len)));

	const travel = $derived(p(BEATS.cast, active?.beats.arrive ?? BEATS.arrive));
	const impact = $derived(p(active?.beats.arrive ?? BEATS.arrive, 420));
	const verdict = $derived(p(active?.beats.verdict ?? BEATS.verdict, 520));
	const showWord = $derived(!!active && !active.fogged && impact > 0 && impact < 1);

	// ── The squad ────────────────────────────────────────────────────────────────
	// Every card puts BODIES on the board. They cross from the ground the actor
	// already holds, they arrive, and they hit the building while the dice are
	// being read — so the roll is something you watch happen to a place rather
	// than a number that changed after a line was drawn.
	//
	// How they cross is the card's `vector`, reused rather than replaced:
	//   trace  run, fast and straight, in the open
	//   seep   creep, slow and half-transparent
	//   none   no crossing at all — they fade in ON the building, already inside
	//   sweep  fan into a ring around it; recon circles a place, it does not charge

	interface UnitPose {
		i: number;
		x: number;
		y: number;
		/** Radians, the direction it is facing. */
		a: number;
		alpha: number;
		/** 0–1 through the current swing, or 0 when not swinging. */
		swing: number;
	}

	/** Every squad member's pose this frame. */
	const units = $derived.by((): UnitPose[] => {
		const act = active;
		if (!act || !to) return [];
		const sq = act.fx.squad;
		const n = Math.max(1, sq.count);
		const kind = act.fx.vector;
		const arrive = act.beats.arrive;
		const strike = act.beats.strike;
		// Unit size sets everything else — a squad standing off a building the
		// camera has flown into has to stand off it by more pixels.
		const u = to.r;
		const out: UnitPose[] = [];

		for (let i = 0; i < n; i++) {
			const spread = i - (n - 1) / 2;
			const delay = i * 70;
			// Where each one ends up: fanned around the face of the building, or
			// ringed right round it for a sweep.
			const ring = kind === 'sweep';
			const ang = ring
				? (i / n) * Math.PI * 2 + elapsed / 900
				: Math.atan2((to.y ?? 0) - (from?.y ?? to.y - 1), (to.x ?? 0) - (from?.x ?? to.x));
			const standoff = u * (ring ? 1.5 : 1.15);
			const tx = ring
				? to.x + Math.cos(ang) * standoff
				: to.x - Math.cos(ang) * standoff + Math.sin(ang) * spread * u * 0.42;
			const ty = ring
				? to.y + Math.sin(ang) * standoff
				: to.y - Math.sin(ang) * standoff - Math.cos(ang) * spread * u * 0.42;

			// Approach.
			let x: number, y: number, alpha: number;
			const march = Math.max(0, Math.min(1, (elapsed - delay) / Math.max(1, arrive - delay)));
			if (kind === 'none' || !from) {
				// Already inside: no crossing, they resolve out of the building itself.
				x = tx;
				y = ty;
				alpha = Math.min(1, elapsed / 260);
			} else {
				// Ease out so they leave fast and settle onto the mark, and bow the
				// path sideways so a squad reads as a group moving rather than as
				// beads on a wire.
				const e = 1 - Math.pow(1 - march, kind === 'seep' ? 1.4 : 2.6);
				const bx = from.x + (tx - from.x) * e;
				const by = from.y + (ty - from.y) * e;
				const dx = tx - from.x;
				const dy = ty - from.y;
				const len = Math.hypot(dx, dy) || 1;
				const bow = Math.sin(e * Math.PI) * (spread * 10 + 14);
				x = bx + (-dy / len) * bow;
				y = by + (dx / len) * bow;
				alpha = (kind === 'seep' ? 0.55 : 1) * Math.min(1, march * 6);
			}

			// Facing: where it is going while crossing, then the building once there.
			const facing =
				march >= 1 || kind === 'none' || !from
					? Math.atan2(to.y - y, to.x - x)
					: Math.atan2(ty - (from?.y ?? ty), tx - (from?.x ?? tx));

			// Swinging. Three hits inside the strike window; each one lunges the
			// unit a little way into the building and snaps back.
			let swing = 0;
			if (elapsed >= strike) {
				const t = (elapsed - strike) / (STRIKE_WINDOW / SWINGS);
				const nth = Math.floor(t);
				if (nth < SWINGS) swing = t - nth;
			}
			const lunge = swing > 0 ? Math.sin(swing * Math.PI) * u * 0.34 : 0;
			x += Math.cos(facing) * lunge;
			y += Math.sin(facing) * lunge;

			out.push({ i, x, y, a: facing, alpha, swing });
		}
		return out;
	});

	/** Hit sparks — one burst per swing, at the point of contact. */
	const swinging = $derived(
		!!active && elapsed >= active.beats.strike && elapsed < active.beats.strike + STRIKE_WINDOW
	);

	// ── The throw ────────────────────────────────────────────────────────────────
	// Two dice, thrown at the building and left lying on it. Each one gets its own
	// landing spot, its own spin and its own bounce phase, because two dice that
	// move identically read as one object with a seam down the middle.
	interface DiePose {
		i: number;
		x: number;
		y: number;
		/** Ground point — where the shadow goes and where it ends up. */
		gx: number;
		gy: number;
		h: number;
		spin: number;
		face: number;
		size: number;
		settled: boolean;
	}

	/** The middle of the region the target stands in. Averaging the buildings'
	 *  positions lands you between them by construction — which is the open ground
	 *  the dice want, rather than the roof of the house being attacked. */
	const arena = $derived.by(() => {
		const ids = active?.arenaIds ?? [];
		const pts = ids.map((id) => anchorOf(id)).filter((a): a is Anchor => !!a);
		if (!pts.length) return to;
		const x = pts.reduce((s, a) => s + a.x, 0) / pts.length;
		const y = pts.reduce((s, a) => s + a.y, 0) / pts.length;
		const r = pts.reduce((s, a) => s + a.r, 0) / pts.length;
		return { x, y, r };
	});

	/** Progress through the roll, 0–1. */
	const diceP = $derived.by(() => {
		const b = active?.beats;
		if (!active?.roll || !b) return -1;
		const span = Math.max(1, b.diceSettle - b.diceStart);
		return Math.max(0, Math.min(1, (elapsed - b.diceStart) / span));
	});

	const dicePose = $derived.by((): DiePose[] => {
		const act = active;
		const pad = arena;
		if (!act?.roll || !pad || elapsed < act.beats.diceStart) return [];
		const p = diceP;

		const size = Math.max(12, Math.min(30, pad.r * 0.5));
		const out: DiePose[] = [];
		for (let i = 0; i < 2; i++) {
			// Thrown in from off the region's edge, on the side the actor is on.
			const inAng = from ? Math.atan2(from.y - pad.y, from.x - pad.x) : -2.2;
			const sx = pad.x + Math.cos(inAng) * pad.r * 3.4 + i * size * 0.7;
			const sy = pad.y + Math.sin(inAng) * pad.r * 3.4 + i * size * 0.5;
			// Where they come to rest: apart, off-centre, on open ground.
			const ang = inAng + Math.PI + (i === 0 ? -0.42 : 0.46);
			const gx = pad.x + Math.cos(ang) * pad.r * 0.42;
			const gy = pad.y + Math.sin(ang) * pad.r * 0.34;

			// They keep travelling across the ground through the first few hops and
			// only stop near the end — dice that arrive at their resting place on the
			// first contact and then bounce in place read as dropped, not rolled.
			const q = Math.min(1, p / DICE_ROLL_OUT);
			const e = 1 - Math.pow(1 - q, 2.4);
			const cx = sx + (gx - sx) * e;
			const cy = sy + (gy - sy) * e;

			let h = bounceHeight(p) * size * (i === 0 ? 1 : 0.86);
			// Spins hard, then stops: the rotation eases to a fixed resting angle so
			// the settled die is square-ish and readable rather than mid-tumble.
			const rest = i === 0 ? -8 : 11;
			let spin = rest + (1 - Math.pow(p, 0.55)) * (i === 0 ? 1080 : -880);
			let face = p >= DICE_LOCK ? act.roll.dice[i] : 1 + ((Math.floor(elapsed / 70) + i * 3) % 6);
			let x = cx;
			let y = cy - h;

			if (act.sealed && p > SEAL_AT) {
				// Knocked away. They reverse off the barrier, keep spinning, and are
				// gone — no landing, no faces, no number. The roll did not happen.
				const q = (p - SEAL_AT) / (1 - SEAL_AT);
				const back = 1 - Math.pow(1 - Math.min(1, p / SEAL_AT), 2);
				const bx = sx + (gx - sx) * back;
				const by = sy + (gy - sy) * back;
				const away = q * pad.r * 2.6;
				const dir = Math.atan2(by - gy, bx - gx) + (i === 0 ? -0.35 : 0.4);
				x = bx + Math.cos(dir) * away;
				y = by + Math.sin(dir) * away - Math.sin(q * Math.PI) * size * 2.6;
				h = size * 2 * (1 - q);
				spin += q * (i === 0 ? 1400 : -1500);
				face = 1 + ((Math.floor(elapsed / 55) + i) % 6);
			}

			out.push({ i, x, y, gx: cx, gy: cy, h, spin, face, size, settled: p >= 1 });
		}
		return out;
	});

	// Pings and severed links track the globe on the same loop as everything else.
	let pingAnchors = $state<Array<BoardPing & Anchor & { q: number }>>([]);
	let cutLinks = $state<Array<{ k: string; x: number; y: number; a: number; r: number }>>([]);
	$effect(() => {
		if (!pings.length && !severed.length) {
			pingAnchors = [];
			cutLinks = [];
			return;
		}
		const ps = pings.map((p) => ({ ...p }));
		const sv = severed.map((s) => ({ ...s }));
		let raf = 0;
		const tick = () => {
			const now = performance.now();
			pingAnchors = ps
				.map((p) => {
					const a = anchorOf(p.structureId);
					const q = Math.min(1, (now - p.at) / PING_MS);
					return a ? { ...p, ...a, q } : null;
				})
				.filter((p): p is BoardPing & Anchor & { q: number } => !!p && p.q < 1);
			cutLinks = sv
				.map((s) => {
					const a = anchorOf(s.from);
					const b = anchorOf(s.to);
					if (!a || !b) return null;
					return {
						k: `${s.from}>${s.to}`,
						x: (a.x + b.x) / 2,
						y: (a.y + b.y) / 2,
						a: Math.atan2(b.y - a.y, b.x - a.x),
						r: Math.max(10, Math.min(26, (a.r + b.r) / 4))
					};
				})
				.filter((c): c is { k: string; x: number; y: number; a: number; r: number } => !!c);
			raf = requestAnimationFrame(tick);
		};
		tick();
		return () => cancelAnimationFrame(raf);
	});

	/** Contacts that have happened recently enough to still be kicking up dust. */
	const dust = $derived.by(() => {
		const act = active;
		const pose = dicePose;
		if (!act?.roll || !pose.length) return [] as Array<{ k: number; x: number; y: number; q: number; size: number }>;
		const span = Math.max(1, act.beats.diceSettle - act.beats.diceStart);
		const out: Array<{ k: number; x: number; y: number; q: number; size: number }> = [];
		DICE_CONTACTS.forEach((c, k) => {
			const q = (diceP - c) / (260 / span);
			if (q < 0 || q > 1) return;
			for (const d of pose) out.push({ k: k * 2 + d.i, x: d.gx, y: d.gy, q, size: d.size });
		});
		return out;
	});

	/** How lit the settled dice are — the payoff glow, once they stop. Never lit
	 *  on a sealed throw: there is nothing to celebrate and nothing landed. */
	const settleGlow = $derived(
		active?.sealed || diceP < DICE_LOCK ? 0 : Math.min(1, (diceP - DICE_LOCK) / (1 - DICE_LOCK))
	);

	/** The barrier coming up, 0–1. */
	const sealRise = $derived(
		!active?.sealed || diceP < SEAL_AT ? 0 : Math.min(1, (diceP - SEAL_AT) / 0.3)
	);

	/** Silhouettes, in local space pointing +x. Raw points, no assets — shared with
	 *  the first-person scene, which draws the same four as the body you are in. */
	const SHAPES: Record<string, string> = UNIT_POINTS;

	/** Where the travelling head is right now. */
	const head = $derived.by(() => {
		if (!from || !to) return null;
		// Eased so it leaves fast and lands soft — a linear tracer reads as a
		// progress bar rather than as something thrown.
		const e = 1 - Math.pow(1 - travel, 3);
		return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
	});
</script>

<div bind:this={host} class="absolute inset-0 z-[2] pointer-events-none overflow-hidden">
	<!-- ── spotlight ────────────────────────────────────────────────────────────
	     The moment a card is picked up, the board answers "where can this go".
	     A scrim goes over everything and holes are punched in it at the legal
	     sites — so the question is answered by what you can SEE rather than by a
	     list of building names somebody has to read and then go find.

	     Drawn first, under the nameplates and the dice, so the readouts stay
	     legible through it. The holes are feathered with a radial gradient in the
	     mask; a hard-edged hole reads as a bug in the rendering. -->
	{#if aims.length}
		<svg class="absolute inset-0 w-full h-full" aria-hidden="true">
			<defs>
				<radialGradient id="breach-spot-fade">
					<stop offset="52%" stop-color="#000" />
					<stop offset="100%" stop-color="#fff" />
				</radialGradient>
				<mask id="breach-aim-mask">
					<rect x="0" y="0" width="100%" height="100%" fill="#fff" />
					{#each aims as a (a.id)}
						<circle cx={a.x} cy={a.y} r={a.r * 2.4} fill="url(#breach-spot-fade)" />
					{/each}
				</mask>
			</defs>
			<rect
				x="0"
				y="0"
				width="100%"
				height="100%"
				fill="rgba(2,6,12,0.66)"
				mask="url(#breach-aim-mask)"
			/>
		</svg>
	{/if}

	<!-- ── standing forces ──────────────────────────────────────────────────────
	     Everyone a card has ever put on the board, still standing where it left
	     them. Drawn first — under the nameplates and under whichever squad is
	     currently fighting — so a resolution reads as movement over a held
	     position rather than as one undifferentiated crowd. -->
	{#if posted.length}
		<svg class="absolute inset-0 w-full h-full" aria-hidden="true">
			{#each posted as u (u.uid)}
				{@const hidden = u.leaves === 'implant'}
				<g
					transform="translate({u.x},{u.y}) rotate({(u.a * 180) / Math.PI}) scale({u.k})"
					opacity={hidden ? 0.72 : 0.95}
				>
					<ellipse cx="0" cy="3.5" rx="6.5" ry="2.2" fill="rgba(0,0,0,0.5)" />
					<!-- An implant is drawn HOLLOW and dashed: it is a thing that is
					     there and is not supposed to be, sitting in the background of a
					     building somebody else still thinks they own. A garrison is
					     solid — it is standing there openly, which is the point of it. -->
					<polygon
						points={SHAPES[u.shape] ?? SHAPES.runner}
						fill={hidden ? 'none' : u.hue}
						stroke={hidden ? u.hue : 'rgba(0,0,0,0.7)'}
						stroke-width={hidden ? 1.4 : 1.1}
						stroke-dasharray={hidden ? '2.5 2' : undefined}
						stroke-linejoin="round"
					/>
				</g>
			{/each}
		</svg>
	{/if}

	<!-- ── severed lines ────────────────────────────────────────────────────────
	     A seal does not just make a building harder — it CUTS THE ROUTE. Drawn as
	     a break sitting on the line itself, with the two cut ends pulled apart,
	     because "the way home is gone" is a fact about the link and putting a chip
	     on the building leaves the player to work it out. -->
	{#if cutLinks.length}
		<svg class="absolute inset-0 w-full h-full" aria-hidden="true">
			{#each cutLinks as c (c.k)}
				<g transform="translate({c.x},{c.y}) rotate({(c.a * 180) / Math.PI})">
					<!-- The gap: a dark bite taken out of the line. -->
					<rect
						x={-c.r * 0.8}
						y={-c.r * 0.55}
						width={c.r * 1.6}
						height={c.r * 1.1}
						fill="rgba(2,6,12,0.92)"
					/>
					<!-- Cut ends, snapped back from each other. -->
					<path
						d="M {-c.r * 0.8} 0 L {-c.r * 0.34} 0 M {-c.r * 0.34} {-c.r * 0.3} L {-c.r * 0.34} {c.r * 0.3}"
						stroke="#A78BFA"
						stroke-width="2"
						fill="none"
						stroke-linecap="round"
					/>
					<path
						d="M {c.r * 0.8} 0 L {c.r * 0.34} 0 M {c.r * 0.34} {-c.r * 0.3} L {c.r * 0.34} {c.r * 0.3}"
						stroke="#A78BFA"
						stroke-width="2"
						fill="none"
						stroke-linecap="round"
					/>
					<text
						y={-c.r * 0.75}
						text-anchor="middle"
						font-size={Math.max(7, c.r * 0.42)}
						letter-spacing="0.14em"
						fill="#A78BFA"
						transform="rotate({(-c.a * 180) / Math.PI})">CUT</text
					>
				</g>
			{/each}
		</svg>
	{/if}

	<!-- ── pings ────────────────────────────────────────────────────────────────
	     The things that happen between cards: something was found, something was
	     pulled out, something burrowed deeper, something got sealed. Each one is a
	     ring leaving the building and a word, for a second and a half. -->
	{#each pingAnchors as p (p.id)}
		{@const st = PING_STYLE[p.kind]}
		<div
			class="absolute pointer-events-none"
			style:left="{p.x}px"
			style:top="{p.y}px"
			style:transform="translate(-50%,-50%)"
		>
			<svg
				class="absolute"
				style:left="{-p.r * 2.4}px"
				style:top="{-p.r * 2.4}px"
				width={p.r * 4.8}
				height={p.r * 4.8}
			>
				{#each [0, 1] as ring (ring)}
					{@const q = Math.max(0, Math.min(1, p.q * 1.5 - ring * 0.25))}
					<circle
						cx={p.r * 2.4}
						cy={p.r * 2.4}
						r={p.r * (0.7 + q * 1.5)}
						fill="none"
						stroke={st.color}
						stroke-width={2.5 * (1 - q)}
						opacity={0.9 * (1 - q)}
					/>
				{/each}
			</svg>
			<span
				class="absolute whitespace-nowrap font-mono text-[0.56rem] font-bold tracking-[0.18em]"
				style:color={st.color}
				style:left="0"
				style:top="0"
				style:transform="translate(-50%, calc(-50% - {p.r * 1.5 + p.q * 18}px))"
				style:opacity={1 - p.q}>{st.label}</span
			>
		</div>
	{/each}

	<!-- ── nameplates ───────────────────────────────────────────────────────────
	     The unit frame every game puts over a thing's head: what it is called, how
	     it is doing, and what is wrong with it. It floats ABOVE the building with
	     a stem down to it, so the building itself is never covered by its own
	     readout, and it is drawn at a fixed pixel size rather than scaled with the
	     globe — a nameplate that shrinks with distance is a nameplate you cannot
	     read exactly when you are looking for it.

	     The bar is hardening against what the building stands at untouched, so
	     condition reads the same whether the wall is a 6 or a 17. Fill past the
	     end means somebody paid to reinforce it. -->
	{#each barAnchors as b (b.id)}
		{@const hue = BAR_TONE[b.tone]}
		{@const ratio = b.value / Math.max(1, b.base)}
		{@const fill = Math.max(0.06, Math.min(1, ratio))}
		<!-- While a card is armed, a plate on a building you cannot play on fades
		     with the building. A bright readout floating over a dimmed site is the
		     one thing that can undo a spotlight. -->
		{@const lit = !aimIds.length || aimIds.includes(b.id)}
		<div
			class="absolute flex flex-col items-center transition-opacity duration-200"
			style:left="{b.x}px"
			style:top="{b.y - b.r * 0.85}px"
			style:transform="translate(-50%, -100%)"
			style:opacity={lit ? 1 : 0.25}
		>
			<div
				class="flex flex-col gap-[3px] px-1.5 py-1 rounded-[5px] border min-w-[92px]"
				style:border-color="color-mix(in srgb, {hue} 45%, var(--border))"
				style:background="color-mix(in srgb, var(--bg-elev, #0b0f16) 88%, transparent)"
				style:box-shadow="0 6px 16px rgba(0,0,0,0.5)"
			>
				<!-- Name row: path step, name, region tick. -->
				<div class="flex items-center gap-1 leading-none whitespace-nowrap">
					{#if b.step}
						<span
							class="grid place-items-center w-[11px] h-[11px] rounded-full font-mono text-[7px] font-bold"
							style:background={b.held ? '#F472B6' : 'var(--border)'}
							style:color={b.held ? '#0b0f16' : 'var(--fg-dim)'}>{b.step}</span
						>
					{/if}
					<span class="font-mono text-[9px] font-bold text-[var(--fg)]">{b.name}</span>
					<span class="w-[5px] h-[5px] rounded-[1px]" style:background={b.regionColor}></span>
				</div>

				<!-- Condition -->
				<div class="flex items-center gap-1">
					<div
						class="relative flex-1 h-[5px] rounded-full overflow-hidden border"
						style:border-color="color-mix(in srgb, {hue} 40%, transparent)"
						style:background="color-mix(in srgb, black 55%, transparent)"
					>
						<div
							class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
							style:width="{fill * 100}%"
							style:background={hue}
							style:opacity={b.held ? 0.6 : 0.95}
						></div>
						{#if ratio > 1}
							<div
								class="absolute inset-y-0 right-0 w-[20%] rounded-full"
								style:background="#7DD3FC"
							></div>
						{/if}
					</div>
					<span class="font-mono text-[8px] font-bold tabular-nums leading-none" style:color={hue}
						>{b.value}<span class="text-[var(--fg-dim)] font-normal">/{b.base}</span></span
					>
				</div>

				<!-- Who is stood on it. Only shown when somebody is. -->
				{#if b.red || b.blue}
					<div class="flex items-center gap-2 leading-none">
						{#if b.blue}
							<span class="flex items-center gap-[3px]" title="defenders">
								<span class="w-[5px] h-[5px] rotate-45" style:background="#38BDF8"></span>
								<span class="font-mono text-[8px] font-bold tabular-nums" style:color="#38BDF8"
									>{b.blue}</span
								>
							</span>
						{/if}
						{#if b.red}
							<span class="flex items-center gap-[3px]" title="attackers on the ground">
								<span class="w-[5px] h-[5px] rotate-45" style:background="#F472B6"></span>
								<span class="font-mono text-[8px] font-bold tabular-nums" style:color="#F472B6"
									>{b.red}</span
								>
							</span>
						{/if}
					</div>
				{/if}

				<!-- Status. Only rendered when there is something to say — an empty
				     row on every plate is sixteen empty rows. -->
				{#if b.held || b.sealed || ratio < 1}
					<div class="flex items-center gap-1 leading-none whitespace-nowrap">
						{#if b.held}
							<span
								class="font-mono text-[7px] font-bold tracking-[0.12em] uppercase px-[3px] rounded"
								style:color="#0b0f16"
								style:background="#F472B6">{b.persistent ? 'dug in' : 'held'}</span
							>
						{/if}
						{#if b.staged}
							<!-- Worked rather than pushed through: the next step of the chain
							     is measurably easier because of this building. -->
							<span
								class="font-mono text-[7px] font-bold tracking-[0.12em] uppercase px-[3px] rounded"
								style:color="#0b0f16"
								style:background="#FB923C">staged</span
							>
						{/if}
						{#if b.sealed}
							<span
								class="font-mono text-[7px] font-bold tracking-[0.12em] uppercase px-[3px] rounded"
								style:color="#0b0f16"
								style:background="#A78BFA">sealed</span
							>
						{/if}
						{#if ratio < 1 && !b.held}
							<span
								class="font-mono text-[7px] tracking-[0.12em] uppercase"
								style:color="#FBBF24">worn −{b.base - b.value}</span
							>
						{/if}
					</div>
				{/if}
			</div>
			<!-- Stem, so the plate is unambiguously THIS building's. -->
			<span
				class="w-px"
				style:height="{Math.max(6, b.r * 0.35)}px"
				style:background="color-mix(in srgb, {hue} 55%, transparent)"
			></span>
		</div>
	{/each}

	<!-- ── aim ──────────────────────────────────────────────────────────────────
	     Rings on top of the spotlight holes: every legal site breathes quietly and
	     the one under the card gets a reticle. This is the whole difference between
	     "put a card somewhere" and "put a card at a place". -->
	{#if aims.length}
		<svg class="absolute inset-0 w-full h-full" aria-hidden="true">
			{#each aims as a (a.id)}
				{@const hot = a.id === aimHoverId}
				{@const breathe = 0.5 + 0.5 * Math.sin(pulse * Math.PI * 2)}
				<circle
					cx={a.x}
					cy={a.y}
					r={a.r * (hot ? 1.25 : 0.95 + breathe * 0.1)}
					fill="none"
					stroke={aimHue}
					stroke-width={hot ? 2 : 1}
					stroke-dasharray={hot ? undefined : '3 6'}
					opacity={hot ? 0.95 : 0.32 + breathe * 0.16}
				/>
				{#if hot}
					<!-- Reticle: four ticks, no full ring, so the building stays readable
					     underneath the thing that is about to happen to it. -->
					{#each [0, 90, 180, 270] as ang (ang)}
						{@const rad = (ang * Math.PI) / 180}
						<line
							x1={a.x + Math.cos(rad) * a.r * 1.35}
							y1={a.y + Math.sin(rad) * a.r * 1.35}
							x2={a.x + Math.cos(rad) * a.r * 1.75}
							y2={a.y + Math.sin(rad) * a.r * 1.75}
							stroke={aimHue}
							stroke-width="2"
							stroke-linecap="round"
						/>
					{/each}
				{/if}
			{/each}
		</svg>
	{/if}

	{#if active && to}
		{@const hue = active.fx.hue}
		{@const U = to.r}
		<svg class="absolute inset-0 w-full h-full" aria-hidden="true">
			<!-- ── vector ─────────────────────────────────────────────────────────
			     trace: a drawn line that arrives. seep: the same path, dimmer, with
			     no head — you are meant to notice it late or not at all. -->
			{#if from && head && (active.fx.vector === 'trace' || active.fx.vector === 'seep')}
				{@const seep = active.fx.vector === 'seep'}
				<!-- The lane the squad is running down, not a tracer in its own right —
				     it fades as they arrive, because once they are there the line is a
				     permanent-looking connection and the board already draws those. -->
				<line
					x1={from.x}
					y1={from.y}
					x2={head.x}
					y2={head.y}
					stroke={hue}
					stroke-width={seep ? 1 : 1.5}
					stroke-linecap="round"
					stroke-dasharray={seep ? '3 7' : '6 6'}
					opacity={(seep ? 0.32 : 0.5) * (1 - impact)}
				/>
			{/if}

			<!-- sweep: fans out from the actor over the whole region. Recon does not
			     aim, so it must not look aimed. -->
			{#if active.fx.vector === 'sweep'}
				<circle
					cx={to.x}
					cy={to.y}
					r={U * (1 + travel * 4)}
					fill="none"
					stroke={hue}
					stroke-width="1"
					stroke-dasharray="2 6"
					opacity={0.5 * (1 - travel)}
				/>
			{/if}

			<!-- ── impact ─────────────────────────────────────────────────────────
			     Fires on ARRIVAL and says nothing about the outcome. Splitting
			     "it landed" from "it worked" is most of what makes a roll feel
			     like a roll. -->
			{#if impact > 0 && impact < 1}
				{#if active.fx.impact === 'burst'}
					<circle
						cx={to.x}
						cy={to.y}
						r={U * (0.5 + impact * 1.3)}
						fill="none"
						stroke={hue}
						stroke-width={2.5 * (1 - impact)}
						opacity={1 - impact}
					/>
					{#each [0, 60, 120, 180, 240, 300] as a (a)}
						{@const rad = (a * Math.PI) / 180}
						{@const r0 = U * (0.6 + impact * 0.6)}
						{@const r1 = U * (0.6 + impact * 1.2)}
						<line
							x1={to.x + Math.cos(rad) * r0}
							y1={to.y + Math.sin(rad) * r0}
							x2={to.x + Math.cos(rad) * r1}
							y2={to.y + Math.sin(rad) * r1}
							stroke={hue}
							stroke-width="1.5"
							opacity={(1 - impact) * 0.8}
						/>
					{/each}
				{:else if active.fx.impact === 'bloom'}
					{@const rr = U * (0.4 + impact * 1.1)}
					<circle cx={to.x} cy={to.y} r={rr} fill={hue} opacity={0.22 * (1 - impact)} />
					<circle
						cx={to.x}
						cy={to.y}
						r={rr}
						fill="none"
						stroke={hue}
						stroke-width="1.5"
						opacity={0.7 * (1 - impact)}
					/>
				{:else if active.fx.impact === 'scan'}
					{#each [0, 1, 2] as i (i)}
						{@const q = Math.max(0, Math.min(1, impact * 1.6 - i * 0.2))}
						<circle
							cx={to.x}
							cy={to.y}
							r={U * (0.7 + q * 1.8)}
							fill="none"
							stroke={hue}
							stroke-width="1"
							opacity={0.65 * (1 - q)}
						/>
					{/each}
				{/if}
			{/if}

			<!-- ── fogged ─────────────────────────────────────────────────────────
			     Not a dimmed version of the above — a different effect entirely. No
			     line to follow back to an actor, no building, no word: one slow
			     ripple the size of a region. Everything the defender is owed and
			     nothing more. -->
			{#if active.fogged}
				{@const q = p(0, 900)}
				<circle
					cx={to.x}
					cy={to.y}
					r={U * (1.4 + q * 4)}
					fill="none"
					stroke="#FBBF24"
					stroke-width="1"
					stroke-dasharray="1 5"
					opacity={0.5 * (1 - q)}
				/>
			{/if}

			<!-- ── the squad ──────────────────────────────────────────────────────
			     Drawn last of the mid-layer so the little guys are never behind the
			     ring they are making. Each one is a silhouette, a shadow under it,
			     and — while it is swinging — a spark where it is connecting. -->
			{#if !active.fogged}
				<!-- Sprites are drawn at a fixed size in local space and SCALED to the
				     building they are attacking, so a squad is always readable against
				     whatever the camera has done to the globe. -->
				{@const k = Math.max(0.85, Math.min(2.4, U / 26))}
				{#each units as un (un.i)}
					<g
						transform="translate({un.x},{un.y}) rotate({(un.a * 180) / Math.PI}) scale({k})"
						opacity={un.alpha}
					>
						<ellipse cx="0" cy="3.5" rx="7" ry="2.4" fill="rgba(0,0,0,0.5)" />
						<polygon
							points={SHAPES[active.fx.squad.shape] ?? SHAPES.runner}
							fill={hue}
							stroke="rgba(0,0,0,0.7)"
							stroke-width="1.1"
							stroke-linejoin="round"
						/>
						{#if un.swing > 0}
							<!-- The connect: a short arc thrown forward off the unit. -->
							<path
								d="M 9 -6 Q 18 0 9 6"
								fill="none"
								stroke="#fff"
								stroke-width="1.6"
								stroke-linecap="round"
								opacity={1 - un.swing}
							/>
						{/if}
					</g>
				{/each}

				<!-- Sparks off the building while it is being hit. -->
				{#if swinging}
					{@const s = ((elapsed - active.beats.strike) % (STRIKE_WINDOW / SWINGS)) / (STRIKE_WINDOW / SWINGS)}
					{#each [0, 1, 2, 3, 4] as k (k)}
						{@const ang = (k / 5) * Math.PI * 2 + elapsed / 260}
						{@const d = U * (0.45 + s * 0.85)}
						<line
							x1={to.x + Math.cos(ang) * U * 0.35}
							y1={to.y + Math.sin(ang) * U * 0.35}
							x2={to.x + Math.cos(ang) * d}
							y2={to.y + Math.sin(ang) * d}
							stroke="#FDE68A"
							stroke-width={1.6 * (1 - s)}
							stroke-linecap="round"
							opacity={0.85 * (1 - s)}
						/>
					{/each}
				{/if}
			{/if}

			<!-- ── verdict ────────────────────────────────────────────────────────
			     ward: it held — arcs close INWARD onto the building.
			     breach: it did not — shards leave it. Direction is the whole read;
			     colour alone would need a legend. -->
			{#if active.outcome === 'ward' && verdict > 0 && verdict < 1}
				{#each [0, 1, 2] as i (i)}
					{@const q = Math.max(0, Math.min(1, verdict * 1.5 - i * 0.18))}
					<circle
						cx={to.x}
						cy={to.y}
						r={U * (2.2 - q * 1.3)}
						fill="none"
						stroke="#34D399"
						stroke-width={2 * q}
						opacity={0.9 * q * (1 - q * 0.6)}
					/>
				{/each}
			{/if}
			{#if active.outcome === 'breach' && verdict > 0 && verdict < 1}
				<circle
					cx={to.x}
					cy={to.y}
					r={U * (0.6 + verdict * 1.9)}
					fill="none"
					stroke="#FB7185"
					stroke-width={3 * (1 - verdict)}
					opacity={1 - verdict}
				/>
				{#each [20, 80, 145, 200, 265, 320] as a (a)}
					{@const rad = (a * Math.PI) / 180}
					{@const d = U * (0.8 + verdict * 2.1)}
					<line
						x1={to.x + Math.cos(rad) * U * 0.7}
						y1={to.y + Math.sin(rad) * U * 0.7}
						x2={to.x + Math.cos(rad) * d}
						y2={to.y + Math.sin(rad) * d}
						stroke="#FB7185"
						stroke-width={2.5 * (1 - verdict)}
						stroke-linecap="round"
						opacity={1 - verdict}
					/>
				{/each}
			{/if}
		</svg>

		<!-- ── the dice ───────────────────────────────────────────────────────────
		     Thrown at the building rather than spun in a status bar. The shadow
		     stays on the ground and tightens as the die comes down, which is the
		     whole reason a 2D bounce reads as a bounce at all. They are drawn over
		     everything and left lying where they stopped, so the number is sitting
		     on the place it just decided. -->
		{#if dicePose.length}
			{@const glow = active.roll?.color ?? '#F8FAFC'}
			<svg class="absolute inset-0 w-full h-full" aria-hidden="true">
				<!-- Dust. One puff per contact per die, thrown outward along the ground
				     and fading as it spreads. Synchronised to the authored contact
				     times, because dust that is not on the landing is just weather. -->
				{#each dust as p (p.k)}
					<ellipse
						cx={p.x}
						cy={p.y + p.size * 0.45}
						rx={p.size * (0.5 + p.q * 1.5)}
						ry={p.size * (0.16 + p.q * 0.45)}
						fill="none"
						stroke="#E2E8F0"
						stroke-width={1.4 * (1 - p.q)}
						opacity={0.5 * (1 - p.q)}
					/>
					{#each [0, 1, 2, 3, 4, 5] as g (g)}
						{@const a = (g / 6) * Math.PI * 2 + p.k}
						{@const d = p.size * (0.35 + p.q * 1.5)}
						<circle
							cx={p.x + Math.cos(a) * d}
							cy={p.y + p.size * 0.45 + Math.sin(a) * d * 0.34}
							r={p.size * 0.09 * (1 - p.q)}
							fill="#F1F5F9"
							opacity={0.75 * (1 - p.q)}
						/>
					{/each}
				{/each}

				<!-- Aura under the pair once they stop: the ground lights in the colour
				     of the band the roll landed in, so the result is readable off the
				     terrain before anybody reads a number. -->
				{#if settleGlow > 0 && arena}
					{@const pulse = 0.5 + 0.5 * Math.sin(elapsed / 420)}
					<!-- Sized to the dice, not to the region: the aura is a pool of light
					     around what landed, and once it is as wide as the territory it
					     stops reading as a light and starts reading as a filter. -->
					{@const aura = arena.r * (0.42 + settleGlow * 0.42)}
					<circle
						cx={arena.x}
						cy={arena.y}
						r={aura}
						fill={glow}
						opacity={(0.09 + pulse * 0.07) * settleGlow}
					/>
					<circle
						cx={arena.x}
						cy={arena.y}
						r={aura}
						fill="none"
						stroke={glow}
						stroke-width={1.5 + pulse}
						opacity={0.6 * settleGlow}
					/>
					<!-- The flash the moment they stop: one hard ring leaving the landing,
					     gone in a fifth of a second. -->
					<circle
						cx={arena.x}
						cy={arena.y}
						r={arena.r * (0.3 + settleGlow * 2.2)}
						fill="none"
						stroke="#FFFFFF"
						stroke-width={3 * (1 - settleGlow)}
						opacity={0.8 * (1 - settleGlow)}
					/>
					<!-- Fireworks: sparks thrown up and out of the landing, arcing over
					     rather than radiating flat, so it reads as celebration and not as
					     another impact ring. Two rings of them, offset and at different
					     speeds, because one even ring reads as a wheel. -->
					{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as s (s)}
						{@const ring = s % 2}
						{@const a = (s / 18) * Math.PI * 2 + (ring ? 0.55 : 0)}
						{@const sp = ring ? 1.05 : 1.7}
						{@const d = arena.r * (0.25 + settleGlow * sp)}
						{@const rise = Math.sin(settleGlow * Math.PI) * arena.r * (0.55 + ring * 0.25)}
						<circle
							cx={arena.x + Math.cos(a) * d}
							cy={arena.y + Math.sin(a) * d * 0.52 - rise}
							r={Math.max(1.1, arena.r * 0.075 * (1 - settleGlow * 0.7))}
							fill={s % 3 === 0 ? '#FFFFFF' : glow}
							opacity={0.95 * (1 - settleGlow * settleGlow)}
						/>
					{/each}
				{/if}

				<!-- ── the seal ────────────────────────────────────────────────────
				     A barrier snaps up over the region and knocks the dice out of the
				     air. Drawn as a hard shell with a lattice across it, arriving in
				     three frames' worth of time — a wall that eases in is a curtain,
				     and this is supposed to feel like a door slamming. -->
				{#if sealRise > 0 && arena}
					{@const R = arena.r * (1.35 + sealRise * 0.12)}
					{@const snap = Math.min(1, sealRise * 4)}
					<circle
						cx={arena.x}
						cy={arena.y}
						r={R}
						fill="#A78BFA"
						opacity={0.1 * snap + 0.06 * Math.sin(elapsed / 120)}
					/>
					<circle
						cx={arena.x}
						cy={arena.y}
						r={R}
						fill="none"
						stroke="#C4B5FD"
						stroke-width={4 * snap}
						opacity={0.95 * snap}
					/>
					<!-- Lattice: chords across the shell, so it reads as a structure that
					     was put there rather than as a glow. -->
					{#each [0, 1, 2, 3, 4, 5] as l (l)}
						{@const off = (l / 6 - 0.42) * R * 1.9}
						{@const half = Math.sqrt(Math.max(0, R * R - off * off))}
						<line
							x1={arena.x + off}
							y1={arena.y - half}
							x2={arena.x + off}
							y2={arena.y + half}
							stroke="#C4B5FD"
							stroke-width="1"
							opacity={0.35 * snap}
						/>
					{/each}
					<!-- The impact flare where the dice hit it. -->
					<circle
						cx={arena.x}
						cy={arena.y}
						r={R * (0.4 + sealRise * 0.9)}
						fill="none"
						stroke="#FFFFFF"
						stroke-width={4 * (1 - sealRise)}
						opacity={0.9 * (1 - sealRise)}
					/>
				{/if}

				{#each dicePose as d (d.i)}
					{@const lift = Math.min(1, d.h / (d.size * 2))}
					<!-- Ground shadow: small and dark underfoot, wide and faint in the
					     air. This is what sells a bounce in two dimensions. Dropped once
					     the dice have been knocked away — nothing is over the ground any
					     more, so a shadow would be a lie. -->
					{#if !sealRise}
						<ellipse
							cx={d.gx}
							cy={d.gy + d.size * 0.5}
							rx={d.size * (0.5 + lift * 0.45)}
							ry={d.size * (0.18 + lift * 0.14)}
							fill="rgba(0,0,0,0.55)"
							opacity={0.75 - lift * 0.45}
						/>
					{/if}
					<!-- Glitter trail while it is still tumbling. -->
					{#if d.h > d.size * 0.2}
						{#each [0, 1, 2] as g (g)}
							{@const t = elapsed / 90 + g * 2.1 + d.i}
							<circle
								cx={d.x + Math.cos(t) * d.size * 0.8}
								cy={d.y + Math.sin(t * 1.3) * d.size * 0.7}
								r={d.size * 0.07}
								fill={glow}
								opacity={0.55 * lift}
							/>
						{/each}
					{/if}
					<g transform="translate({d.x},{d.y}) rotate({d.spin})">
						{#if settleGlow > 0}
							<rect
								x={-d.size / 2 - 2}
								y={-d.size / 2 - 2}
								width={d.size + 4}
								height={d.size + 4}
								rx={d.size * 0.28}
								fill="none"
								stroke={glow}
								stroke-width="2"
								opacity={0.7 * settleGlow}
							/>
						{/if}
						<rect
							x={-d.size / 2}
							y={-d.size / 2}
							width={d.size}
							height={d.size}
							rx={d.size * 0.22}
							fill="#F8FAFC"
							stroke="rgba(15,23,42,0.85)"
							stroke-width={Math.max(1, d.size * 0.06)}
						/>
						{#each PIPS[d.face] ?? PIPS[1] as [px, py] (`${px},${py}`)}
							<circle cx={px * d.size * 0.3} cy={py * d.size * 0.3} r={d.size * 0.1} fill="#0f172a" />
						{/each}
					</g>
				{/each}
			</svg>

			<!-- The word. There is no number to read, which IS the result. -->
			{#if sealRise > 0.25 && arena}
				<span
					class="absolute whitespace-nowrap font-mono text-[0.78rem] font-bold tracking-[0.24em]"
					style:left="{arena.x}px"
					style:top="{arena.y}px"
					style:color="#C4B5FD"
					style:transform="translate(-50%, calc(-50% - {arena.r * 1.9}px))"
					style:text-shadow="0 2px 10px rgba(0,0,0,0.8)"
				>
					BLOCKED
				</span>
				<span
					class="absolute whitespace-nowrap font-mono text-[0.56rem] tracking-[0.16em] uppercase"
					style:left="{arena.x}px"
					style:top="{arena.y}px"
					style:color="#A78BFA"
					style:transform="translate(-50%, calc(-50% - {arena.r * 1.55}px))"
					style:opacity={sealRise}
				>
					no roll · the seal held
				</span>
			{/if}
		{/if}

		<!-- ── word ───────────────────────────────────────────────────────────────
		     The card's own voice, at the point of contact. One word carries more of
		     a card's identity than any amount of motion, and costs a text node. -->
		{#if showWord}
			<span
				class="absolute font-mono text-[0.62rem] font-bold tracking-[0.18em] uppercase whitespace-nowrap"
				style:left="{to.x}px"
				style:top="{to.y}px"
				style:color={hue}
				style:transform="translate(-50%, calc(-50% - {to.r * 0.9 + impact * 22}px))"
				style:opacity={1 - impact}
			>
				{active.fx.word}
			</span>
		{/if}
	{/if}
</div>
