<script lang="ts">
	// ── Insider Threat — BREACH, on foot ─────────────────────────────────────────
	// The variant a host picks in the lobby (`TableVariant`), behind the server's
	// `breach_insider_threat` feature. The map is picked in the lobby (`insider/
	// maps.ts`; the office by default, dev maps in a dev session). Other players' positions are relayed
	// by the server and simulated by nobody. No objective yet.
	//
	// A map is data (`game/map`): props with kinds and slots, composed with a seed
	// into triangles batched by material and the hulls the walker collides with.
	// This file is only the camera and the draw — it knows no map by name.
	//
	// World frame is y-up metres. Baked vertices are in the pieces' layout with an
	// identity model, (x, −z, y), which is a proper rotation, so the
	// counter-clockwise-from-outside winding survives and the default
	// `frontFace(CCW)` culls correctly.
	//
	// Movement is `physics/walker`, stepped at a fixed 120Hz so it plays the same
	// at any frame rate. The debug views and live tunables are the DevCog's GAME
	// group.
	//
	// Click to capture the mouse (Esc releases it; the game plays on, so a free
	// cursor can work the dev panels while the scene stays in view; the gear is
	// the menu): mouse looks, WASD
	// walks, Shift runs, Space jumps. Arrow keys still turn and look, for
	// keyboard-only play.
	import type { Perceived, Pose } from './net.svelte.js';
	import type { OfficeView } from './wire.gen.js';
	import { MAPS, OFFERED_MAPS, LOCAL_CUES, DRONE_MAPS, MAP_DOORS, DEV_SESSION as devTools, mapFor } from './insider/maps.js';
	import { DOCKED, DARK, stepDrone, beam, droneGoal, lightLevel, type Drone } from './insider/drone.js';
	import { doorStates, stepDoors, doorAt, toggle, leafModel, leafMesh, withDoors, type DoorState } from './insider/doors.js';
	import type { SwingDoor } from './insider/office.js';
	import OfficeHud, { type OfficeActions, type Refusal } from './insider/OfficeHud.svelte';
	import GameMenu from './hud/GameMenu.svelte';
	import { armColors, meshFigure, STILL, STRIDE_M, type FigureLook } from './insider/figures.js';
	import { armBoxes, armModel } from './insider/arms.js';
	import { hazardMarks, shiftMarks } from './insider/shift-list.js';
	import { navGrid, route, type NavGrid, type Point2 } from './insider/nav.js';
	import Minimap from './hud/Minimap.svelte';
	import Radar from './hud/Radar.svelte';
	import { lit, lightingFor, cue, type LightCue, type Pattern } from './insider/lighting.js';
	import { OFFICE_DATA, type OfficeCueKey, type OfficeStation } from './internal/office.gen.js';
	import {
		Button,
		Icon,
		GameDevTools,
		trace,
		createGlContext,
		createProgram,
		createSky,
		createBuffer,
		updateBuffer,
		createVao,
		FRAMES,
		composeMap,
		spawnWalker,
		stepWalker,
		walkerEye,
		WALKER_DEFAULTS,
		gameDev,
		registerGameScene,
		hitchWatch,
		MAP_VERT,
		MAP_FRAG,
		MAP_ATTRIBS,
		MAX_LIGHTS,
		IDENTITY,
		tokenRGB,
		toneRGB,
		mix3,
		tonesOf,
		perspective,
		view,
		mul,
		boxLines,
		type RGB,
		type ComposedMap,
		type MapDef,
		type Tone,
		type World,
		type WalkerState
	} from 'showcase';

	/** Another player in the street. `at` is when their pose arrived. No side:
	 *  in the office that is the secret, so everybody is drawn alike. */
	interface Other extends Pose {
		seat: string;
		/** Absent for a bot: the office relays its walk only while it walks, so
		 *  one standing still is not gone. */
		at?: number;
		/** Where a followed camera looks up or down. Only the start screen's tour
		 *  sets it: a relayed pose carries no pitch. */
		pitch?: number;
	}

	interface Props {
		others?: Other[];
		/** Called at 10Hz with where this player stands. */
		onpose?: (p: Pose) => void;
		/** Ends the match for the table. Absent for a player who may not. */
		onleave?: () => void;
		/** The office match, when the server is running one. Without it the
		 *  street is a walk with nothing to do — an offline table has no engine,
		 *  because the rules are never shipped to the browser. */
		office?: OfficeView;
		reactions?: Perceived[];
		act?: OfficeActions;
		/** Watch through this seat instead of walking: the camera rides their
		 *  relayed pose, and their own figure is not drawn. God mode. */
		follow?: string;
		/** Each seat's lobby character. A seat without one is drawn as a box. */
		figures?: Record<string, FigureLook>;
		/** The last move the office said no to, and when. */
		refusal?: Refusal | null;
		/** Drawn as a backdrop: the start screen's office (insider/OfficeTour).
		 *  The default map at its default seed, filling its parent rather than
		 *  the window, with no HUD, no dev tools and no keys or mouse taken. */
		tour?: boolean;
		/** The map a tour shows, when not the default office. */
		tourMap?: MapDef;
		/** A simulation's autopilot (internal/sim.svelte.ts): walk this job's
		 *  stations in turn and work each one, in place of the keys. */
		pilot?: boolean;
	}
	let {
		others = [],
		onpose,
		onleave,
		office,
		reactions = [],
		act,
		follow,
		figures = {},
		refusal = null,
		tour = false,
		tourMap,
		pilot = false
	}: Props = $props();

	// ── Lighting cues (insider/lighting.ts) ───────────────────────────────────
	/** What the server sent this seat: a cue key on a reaction it perceived. */
	const sent = $derived(reactions.flatMap((r) => (r.cue ? (cue(r.cue, r.seen) ?? []) : [])));
	/** What this client fired for its own player, and the dev panel's. */
	let local = $state<LightCue[]>([]);
	function fireLocal(key: OfficeCueKey) {
		const now = performance.now();
		const c = cue(key, now);
		local = [...local.filter((l) => now - l.at < l.s * 1000), ...(c ? [c] : [])];
	}
	const cues = $derived([...sent, ...local]);

	/** A player not heard from in this long has dropped, not stopped. */
	const STALE_MS = 3000;

	// ── The map ───────────────────────────────────────────────────────────────
	const mapDef = $derived(tour ? (tourMap ?? MAPS[0]) : mapFor(gameDev.map));
	const composed = $derived(composeMap(mapDef, devTools && !tour ? gameDev.seed : 1));
	/** What the frame loop reads: a plain variable, swapped when `composed` is. */
	let map: ComposedMap = composeMap(MAPS[0], 1);

	// ── Geometry the scene draws itself ───────────────────────────────────────
	function hullBoxes(world: World): Float32Array {
		const out = new Float32Array(world.hulls.length * 24 * 7);
		world.hulls.reduce((o, h) => boxLines(out, o, h.min.x, h.min.y, h.min.z, h.max.x, h.max.y, h.max.z), 0);
		return out;
	}
	/** A box e,n ∈ [−1, 1], h ∈ [0, 2] as lit triangles: the stand-in figure for
	 *  another player, scaled to the walker's hull. Each face is wound CCW from
	 *  outside by taking its tangents in cyclic order (u × v = the normal). */
	function cube(): Float32Array {
		const out: number[] = [];
		for (let a = 0; a < 3; a++)
			for (const s of [-1, 1]) {
				const [u, v] = s > 0 ? [(a + 1) % 3, (a + 2) % 3] : [(a + 2) % 3, (a + 1) % 3];
				for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) {
					const p = [0, 0, 0], n = [0, 0, 0];
					p[a] = s;
					p[u] = du;
					p[v] = dv;
					n[a] = s;
					out.push(p[0], p[1], p[2] + 1, ...n, (p[2] + 1) / 2);
				}
			}
		return new Float32Array(out);
	}

	// ── Station pads ──────────────────────────────────────────────────────────
	// A station's reach is drawn on the floor where it is checked: a dashed ring
	// at `radius` round a grid, so a player walks into range rather than hunting
	// for it. Hidden while you work there: the fixture itself shows the work.
	const PAD_Y = 0.02;
	/** One LINES vertex at world (x, y, z), in the layout the shader expects. */
	const put = (out: number[], x: number, y: number, z: number) => out.push(x, -z, y, 0, 0, 1, 0);
	/** A dashed circle of the station's radius: every other 0.3m segment. */
	function padRing(st: OfficeStation): Float32Array {
		const out: number[] = [];
		const r = st.radius, n = 2 * Math.round((Math.PI * r) / 0.3);
		for (let i = 0; i < n; i += 2) {
			const s = (2 * Math.PI * i) / n, e = (2 * Math.PI * (i + 1)) / n;
			put(out, st.x + r * Math.cos(s), PAD_Y, st.z + r * Math.sin(s));
			put(out, st.x + r * Math.cos(e), PAD_Y, st.z + r * Math.sin(e));
		}
		return new Float32Array(out);
	}
	/** Half-metre grid lines clipped to the disc, inset off the ring. */
	function padGrid(st: OfficeStation): Float32Array {
		const out: number[] = [];
		const r = st.radius - 0.15;
		for (let d = -r + 0.5; d < r; d += 0.5) {
			const h = Math.sqrt(r * r - d * d);
			put(out, st.x + d, PAD_Y, st.z - h);
			put(out, st.x + d, PAD_Y, st.z + h);
			put(out, st.x - h, PAD_Y, st.z + d);
			put(out, st.x + h, PAD_Y, st.z + d);
		}
		return new Float32Array(out);
	}
	// ── The office reacting ───────────────────────────────────────────────────
	// Nothing is added to the map for these: the lamps, screens and LEDs it
	// already has are split by where they stand (`splitMap`) and repainted.

	/** What a station's own fixture does while you work it, by station kind and
	 *  material. A milestone at a station looks exactly like its tasks — that is
	 *  the insider's cover. */
	type WorkFx = 'shuffle' | 'code' | 'blink';
	const WORK_FX: Record<string, Record<string, WorkFx>> = {
		delivery_shelf: { folder: 'shuffle' },
		desk: { screen: 'code' },
		dev_desk: { screen: 'code' },
		build_rack: { led: 'blink', port: 'blink' },
		registry_rack: { led: 'blink', port: 'blink' },
		comms_closet: { led: 'blink', port: 'blink' },
		kitchen: { led: 'blink', ceramic: 'shuffle' }
	};
	/** How far past its reach a station's fixture extends: a rack station stands
	 *  in the aisle, its racks a metre and more either side. */
	const FIXTURE_REACH = 1;
	/** Lamps over a station: a 4m lamp grid always has one within this. */
	const LAMP_REACH = 2.5;

	/** What a perceived reaction repaints, where, for how long. `station` scope
	 *  falls back to the zone when the reaction names no station. Logs have no
	 *  picture; they stay in the feed. */
	const REACT: Record<string, { mat: string; scope: 'zone' | 'station' | 'all'; s: number; tone: string; pattern: Pattern }> = {
		lobby_flicker: { mat: 'lamp', scope: 'zone', s: 1.2, tone: '--fg', pattern: 'flicker' },
		server_flicker: { mat: 'lamp', scope: 'zone', s: 1.2, tone: '--fg', pattern: 'flicker' },
		bay_screens: { mat: 'screen', scope: 'zone', s: 1.2, tone: '--palette-sky', pattern: 'flicker' },
		all_green: { mat: 'screen', scope: 'all', s: 2.5, tone: '--palette-emerald', pattern: 'steady' },
		rack_amber: { mat: 'led', scope: 'zone', s: 4, tone: '--palette-amber', pattern: 'steady' },
		strobe: { mat: 'lamp', scope: 'zone', s: 1.5, tone: '--palette-red', pattern: 'strobe' },
		task_done: { mat: 'lamp', scope: 'station', s: 0.8, tone: '--palette-emerald', pattern: 'pulse' },
		worm_hint: { mat: 'screen', scope: 'zone', s: 0.8, tone: '--palette-red', pattern: 'glitch' },
		noise: { mat: 'lamp', scope: 'station', s: 0.5, tone: '--palette-amber', pattern: 'pulse' },
		canary: { mat: 'lamp', scope: 'station', s: 2, tone: '--palette-yellow', pattern: 'strobe' }
	};
	const REACT_MATS = ['lamp', 'screen', 'led'];

	const zoneAt = (x: number, z: number) =>
		OFFICE_DATA.zones.find((r) => x >= r.rect.x0 && x <= r.rect.x1 && z >= r.rect.z0 && z <= r.rect.z1)?.key ?? '';

	/** The map's triangles sorted into what the office can do with them:
	 *  `fx` — a station's fixture, taken OUT of the static batches so it can
	 *  move; `regions` — copies of every lamp, screen and LED by zone, by
	 *  station and all together, painted over the originals when they react. */
	function splitMap(m: ComposedMap) {
		const TRI = 21;
		const fx = new Map<string, number[]>(); // station|material
		const regions = new Map<string, number[]>(); // zone:k|mat, station:id|mat, all|mat
		const add = (into: Map<string, number[]>, key: string, t: Float32Array) => {
			const a = into.get(key) ?? [];
			for (const v of t) a.push(v);
			into.set(key, a);
		};
		const batches = m.batches.map((b) => {
			const kept: number[] = [];
			for (let i = 0; i < b.tris.length; i += TRI) {
				const t = b.tris.subarray(i, i + TRI);
				const x = (t[0] + t[7] + t[14]) / 3, z = -(t[1] + t[8] + t[15]) / 3;
				const d = (s: OfficeStation) => Math.hypot(s.x - x, s.z - z);
				if (REACT_MATS.includes(b.material)) {
					add(regions, `zone:${zoneAt(x, z)}|${b.material}`, t);
					add(regions, `all|${b.material}`, t);
					for (const s of OFFICE_DATA.stations) if (d(s) <= s.radius + LAMP_REACH) add(regions, `station:${s.id}|${b.material}`, t);
				}
				let owner: OfficeStation | null = null;
				for (const s of OFFICE_DATA.stations)
					if (WORK_FX[s.kind]?.[b.material] && d(s) <= s.radius + FIXTURE_REACH && (!owner || d(s) < d(owner))) owner = s;
				if (owner) add(fx, `${owner.id}|${b.material}`, t);
				else for (const v of t) kept.push(v);
			}
			return { ...b, tris: new Float32Array(kept) };
		});
		return { batches, fx, regions };
	}

	// ── The walker ────────────────────────────────────────────────────────────
	/** Fixed physics step. The walker is a pure function of dt, so a constant dt
	 *  is what makes 30fps and 144fps walk the same street the same way. */
	const DT = 1 / 120;
	/** Sub-steps one frame may run; anything more (a stalled tab) is dropped
	 *  rather than replayed as a burst. */
	const MAX_STEPS = 8;
	const TURN = 2.2, LOOK = 1.4;
	const look = { yaw: 0, pitch: 0 };
	let walker: WalkerState = spawnWalker(map.world, map.def.spawn);
	let acc = 0;
	const held = new Set<string>();
	let drone: Drone = DOCKED;
	/** The drone for the HUD, copied at its 10Hz. */
	let droneHud = $state<Drone>(DOCKED);
	const hasDrone = $derived(DRONE_MAPS.has(mapDef.id) && !follow);
	/** Sent out by the dark rather than by F, so the light calls it back. */
	let droneAuto = false;
	let wasDark = false;

	let doors: DoorState[] = doorStates(MAP_DOORS[map.def.id] ?? []);
	const doorHulls = new Map<SwingDoor, World['hulls']>();
	/** What you collide with and see past: the map, and every door you shut. */
	let world: World = map.world;
	/** The door you stand at, for the prompt. */
	let doorHint = $state<string | null>(null);
	/** The office station within reach, and the zone underfoot. The server
	 *  checks the same radius against the same coordinates (office.gen.ts). */
	let station = $state<OfficeStation | null>(null);
	let zone = $state('');

	// ── Who you could act on ──────────────────────────────────────────────────
	/** Short of the server's lift reach: a drawn figure is eased toward poses
	 *  that land at 10Hz, so one the client calls in reach may not quite be. */
	const LIFT_REACH = OFFICE_DATA.badges.liftReach - 0.2;
	/** How far, and how wide either side of the crosshair, a figure counts as
	 *  aimed at — roughly a body's width. */
	const AIM_M = 12, AIM_HALF = 0.6;
	/** The figure a lift would take — the one in reach nearest the crosshair —
	 *  and the one the crosshair is on with nothing in the way. Drawn only on
	 *  this screen; written only when they change. */
	let liftable = $state<string | null>(null);
	let aimed = $state<string | null>(null);
	const SIGHT = { x: 0.05, y: 0.05, z: 0.05 };

	// ── Waypoints ─────────────────────────────────────────────────────────────
	/** Where your work is: every open task on your shift list, and the worm's
	 *  next stations for the insider. Only your own, so they leak nothing. Plus
	 *  any hazard close enough to notice, which is the only time it shows. */
	const targets = $derived.by(() => {
		const me = office?.me;
		if (!me?.seatId || me.escorted || office?.phase !== 'playing' || follow) return [];
		return [...shiftMarks(me, OFFICE_DATA, station?.id), ...hazardMarks(me, OFFICE_DATA, station?.id)];
	});
	/** With nothing marked next, the nearest marker is lit instead. */
	const anyNext = $derived(targets.some((t) => t.next));
	let marks: HTMLElement[] = $state([]);
	/** Head height, where a marker over a desk or a rack reads. */
	const MARK_Y = 1.4;
	/** Pushes each marker through the camera, every frame and straight onto its
	 *  element: sixty $state writes a second would be the HUD measuring itself.
	 *  Off screen or behind you, it rides the edge on the side you would turn. */
	function placeMarks(vp: Float32Array, w: number, h: number) {
		const p = walker.pos;
		let best = Infinity, lit: HTMLElement | null = null;
		for (const [i, s] of targets.entries()) {
			const el = marks[i];
			if (!el) continue;
			const m = vp, y = MARK_Y;
			const cx = m[0] * s.x + m[4] * y + m[8] * s.z + m[12];
			const cy = m[1] * s.x + m[5] * y + m[9] * s.z + m[13];
			const cw = m[3] * s.x + m[7] * y + m[11] * s.z + m[15];
			let sx = ((cx / cw + 1) / 2) * w, sy = ((1 - cy / cw) / 2) * h;
			const pad = 48;
			const on = cw > 0.1 && sx > pad && sx < w - pad && sy > pad && sy < h - pad;
			if (!on) {
				const right = (s.x - p.x) * Math.cos(look.yaw) + (s.z - p.z) * Math.sin(look.yaw) > 0;
				sx = right ? w - 16 : 16;
				sy = cw > 0.1 ? Math.min(h - pad, Math.max(pad, sy)) : h / 2;
				el.dataset.edge = right ? 'r' : 'l';
			} else delete el.dataset.edge;
			el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
			const d = Math.hypot(s.x - p.x, s.z - p.z);
			el.querySelector('.wp-m')!.textContent = `${Math.round(d)}m`;
			el.removeAttribute('data-lit');
			if (d < best) [best, lit] = [d, el];
		}
		if (!anyNext) lit?.setAttribute('data-lit', '');
	}

	// The server places players — the shift start, a meeting — and says so with
	// a new snap number. Applied once per number, then the walk carries on
	// from there.
	let snapSeen = 0;
	$effect(() => {
		const me = office?.me;
		if (!me?.snap || me.snapSeq === snapSeen) return;
		snapSeen = me.snapSeq;
		walker = spawnWalker(map.world, { x: me.snap.x, y: 0, z: me.snap.z });
		pilotPath = [];
	});

	// ── The autopilot (pilot) ─────────────────────────────────────────────────
	/** The floor a bot can walk, from the map's own collision hulls. */
	let nav: NavGrid | undefined;
	let pilotNext = 0, pilotBusy = false, pilotAsked = 0, pilotAsks = 0;
	let pilotPath: Point2[] = [];
	/** A station the office keeps refusing (a cooldown that never comes back,
	 *  a sealed zone) is given up after this many asks, a few seconds apart. */
	const PILOT_ASKS = 8;

	/** Walks to this job's next station at walking speed — the pose the server
	 *  clamps is the one a person would send — and works it. */
	function steerPilot(dt: number) {
		const me = office?.me;
		const job = OFFICE_DATA.archetypes.find((a) => a.key === me?.archetype);
		const st = job && OFFICE_DATA.stations.find((s) => s.id === job.stations[pilotNext % job.stations.length]);
		if (!me || !st || !nav) return;
		if (me.channel) {
			pilotBusy = true;
			return;
		}
		const p = walker.pos;
		const done = pilotBusy || pilotAsks >= PILOT_ASKS;
		if (done || Math.hypot(st.x - p.x, st.z - p.z) <= st.radius * 0.6) {
			if (done) {
				pilotBusy = false;
				pilotAsks = 0;
				pilotNext++;
				pilotPath = [];
			} else if (performance.now() - pilotAsked > 3000) {
				pilotAsked = performance.now();
				pilotAsks++;
				act?.channel(st.id, st.tasks[0]);
			}
			return;
		}
		if (!pilotPath.length) pilotPath = route(nav, p, st) ?? [{ x: st.x, z: st.z }];
		const to = pilotPath[0], dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
		const step = gameDev.tuning.walkSpeed * dt;
		if (d <= step) pilotPath.shift();
		const k = d > 1e-3 ? Math.min(1, step / d) : 1;
		if (d > 1e-3) look.yaw = Math.atan2(dx, -dz);
		walker = { ...walker, mode: 'ground', vel: { x: 0, y: 0, z: 0 }, pos: { x: p.x + dx * k, y: p.y, z: p.z + dz * k } };
	}

	function respawn() {
		walker = spawnWalker(map.world, map.def.spawn);
		look.yaw = map.def.spawn.yaw ?? 0;
		look.pitch = 0;
	}

	// A new map puts you at its spawn; a reroll of the same one leaves you where
	// you stand.
	$effect(() => {
		const next = composed;
		const moved = next.def !== map.def;
		map = next;
		if (moved) {
			doors = doorStates(MAP_DOORS[next.def.id] ?? []);
			doorHulls.clear();
		}
		world = withDoors(map.world, doors, map.def, doorHulls);
		if (moved) respawn();
	});

	$effect(() =>
		tour
			? undefined
			: registerGameScene({
					id: 'insider-threat',
					label: mapDef.label,
					respawn,
					maps: OFFERED_MAPS.map((m) => ({ id: m.id, label: m.dev ? `${m.label} · dev` : m.label }))
				})
	);

	function tick(frameDt: number) {
		const k = (c: string) => (held.has(c) ? 1 : 0);
		look.yaw += (k('ArrowRight') - k('ArrowLeft')) * TURN * frameDt;
		look.pitch = Math.max(-1.3, Math.min(1.3, look.pitch + (k('ArrowUp') - k('ArrowDown')) * LOOK * frameDt));
		const forward = k('KeyW') - k('KeyS') - stick.y;
		const strafe = k('KeyD') - k('KeyA') + stick.x;
		const run = held.has('ShiftLeft') || held.has('ShiftRight') || stickRun;
		const tuning = gameDev.tuning;
		const dt = frameDt * gameDev.timeScale;
		drone = stepDrone(hasDrone ? drone : { ...drone, out: false }, dt);
		stepDoors(doors, dt);

		if (follow) {
			const o = others.find((p) => p.seat === follow);
			if (!o) return;
			// A tour's pose moves every frame and cuts between shots, so it is
			// taken as it is; a relayed one lands at 10Hz and is eased toward.
			const ease = tour ? 1 : Math.min(1, frameDt * 12), p = walker.pos;
			walker = { ...walker, mode: 'ground', pos: { x: p.x + (o.x - p.x) * ease, y: p.y + (o.y - p.y) * ease, z: p.z + (o.z - p.z) * ease } };
			look.yaw = o.yaw;
			if (o.pitch !== undefined) look.pitch = o.pitch;
			acc = 0;
		} else if (pilot) {
			steerPilot(dt);
			acc = 0;
		} else if (gameDev.noclip) {
			// Flying is not physics: move the feet along the view and let the walker
			// pick up from wherever it is left when noclip goes off.
			const cp = Math.cos(look.pitch), sy = Math.sin(look.yaw), cy = Math.cos(look.yaw);
			const v = tuning.runSpeed * dt;
			const p = walker.pos;
			walker = {
				...walker,
				mode: 'air',
				vel: { x: 0, y: 0, z: 0 },
				pos: {
					x: p.x + (forward * sy * cp + strafe * cy) * v,
					y: Math.max(0, p.y + forward * Math.sin(look.pitch) * v + (k('Space') - (run ? 1 : 0)) * v),
					z: p.z + (-forward * cy * cp + strafe * sy) * v
				}
			};
			acc = 0;
		} else {
			const input = { forward, strafe, yaw: look.yaw, run, jump: held.has('Space') };
			acc += dt;
			let n = 0;
			for (; acc >= DT && n < MAX_STEPS; n++, acc -= DT) walker = stepWalker(world, walker, input, DT, tuning);
			if (n === MAX_STEPS) acc = 0;
		}
	}

	/** HUD readouts are $state, so they are written at 10Hz, not per frame — a
	 *  display that re-renders sixty times a second is measuring itself. */
	let hudAt = 0;
	function hud(now: number) {
		if (now - hudAt < 100) return;
		hudAt = now;
		// Worked out offline too: the map's own cues fire on them.
		const p = walker.pos;
		const st = OFFICE_DATA.stations.find((s) => Math.hypot(s.x - p.x, s.z - p.z) <= s.radius) ?? null;
		const zk = zoneAt(p.x, p.z);
		for (const c of LOCAL_CUES[map.def.id] ?? [])
			if ((c.zone && c.zone === zk && zk !== zone) || (c.station && c.station === st?.id && st.id !== station?.id)) fireLocal(c.cue);
		station = st;
		zone = zk;
		// Into the dark, out it comes; back into light, it goes home, unless
		// F sent it.
		const dark = lightLevel(map.lights, lightingFor(cues, map.def.ambient ?? 1, now), walkerEye(walker)) < DARK;
		if (hasDrone && dark !== wasDark) {
			if (dark && !drone.out) [drone, droneAuto] = [{ ...drone, out: true }, true];
			else if (!dark && droneAuto) [drone, droneAuto] = [{ ...drone, out: false }, false];
		}
		wasDark = dark;
		droneHud = drone;
		const d = follow ? null : doorAt(doors, p);
		doorHint = d ? `E · ${d.shut ? 'open' : 'shut'} door` : null;
	}

	const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);
	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
		if (e.type === 'keydown' && !e.repeat) {
			if (e.code === 'KeyF' && hasDrone) {
				drone = { ...drone, out: !drone.out };
				droneAuto = false;
			}
			const d = e.code === 'KeyE' && !follow ? doorAt(doors, walker.pos) : null;
			if (d && toggle(d, walker.pos)) world = withDoors(map.world, doors, map.def, doorHulls);
		}
		if (!KEYS.has(e.code)) return;
		e.preventDefault();
		if (e.type === 'keydown') held.add(e.code);
		else held.delete(e.code);
	}

	const MOUSE = 0.0025; // radians per pixel
	let locked = $state(false);
	let mapOpen = $state(false);
	function capture() {
		if (tour) return;
		if (touchUi) return; // iOS has no pointer lock, and a drag-to-look ends in a click
		canvas?.requestPointerLock()?.catch(() => {});
	}
	function onMouse(e: MouseEvent) {
		if (!locked) return;
		look.yaw += e.movementX * MOUSE;
		look.pitch = Math.max(-1.3, Math.min(1.3, look.pitch - e.movementY * MOUSE));
	}

	// ── Touch ─────────────────────────────────────────────────────────────────
	// A phone has no pointer lock and no keys: the left thumb walks a stick, the
	// right drags the view. The walker only takes a direction and walk-or-run,
	// so the stick is a direction until it is pushed to the rim, which runs.
	let touchUi = $state(typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
	const STICK_R = 48; // px, the knob's travel
	const DEAD = 0.2;
	const RUN_AT = 0.85;
	const TOUCH_LOOK = 0.005; // radians per pixel
	let stick = $state({ x: 0, y: 0 });
	const stickRun = $derived(Math.hypot(stick.x, stick.y) >= RUN_AT);
	let stickAt: { id: number; x: number; y: number } | null = null;
	function stickDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		stickAt = { id: e.pointerId, x: r.left + r.width / 2, y: r.top + r.height / 2 };
		stickMove(e);
	}
	function stickMove(e: PointerEvent) {
		if (e.pointerId !== stickAt?.id) return;
		let x = (e.clientX - stickAt.x) / STICK_R, y = (e.clientY - stickAt.y) / STICK_R;
		const m = Math.hypot(x, y);
		if (m > 1) [x, y] = [x / m, y / m];
		stick = m < DEAD ? { x: 0, y: 0 } : { x, y };
	}
	function stickUp(e: PointerEvent) {
		if (e.pointerId !== stickAt?.id) return;
		stickAt = null;
		stick = { x: 0, y: 0 };
	}

	let lookAt: { id: number; x: number; y: number } | null = null;
	function lookDown(e: PointerEvent) {
		if (e.pointerType === 'mouse') return;
		touchUi = true;
		canvas?.setPointerCapture(e.pointerId);
		lookAt = { id: e.pointerId, x: e.clientX, y: e.clientY };
	}
	function lookMove(e: PointerEvent) {
		if (e.pointerId !== lookAt?.id) return;
		look.yaw += (e.clientX - lookAt.x) * TOUCH_LOOK;
		look.pitch = Math.max(-1.3, Math.min(1.3, look.pitch - (e.clientY - lookAt.y) * TOUCH_LOOK));
		lookAt = { ...lookAt, x: e.clientX, y: e.clientY };
	}
	function lookUp(e: PointerEvent) {
		if (e.pointerId === lookAt?.id) lookAt = null;
	}

	// ── Render ────────────────────────────────────────────────────────────────
	let host = $state<HTMLDivElement | null>(null);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let noGl = $state(false);

	type Drawable = { vao: WebGLVertexArrayObject; count: number };

	$effect(() => {
		const el = canvas;
		const root = host;
		if (!el || !root) return;
		const glc = createGlContext(el, { depth: true, alpha: false });
		if (!glc) {
			noGl = true;
			return;
		}
		const gl = glc.gl;
		// Shaders, matrices and token colours are `game/map-gl`, shared with the
		// Builder's 3D scenes so a map looks the same built as walked.
		const prog = createProgram(gl, MAP_VERT, MAP_FRAG);
		const sky = createSky(gl);
		/** GPU objects a map owns, freed when the next map replaces it. */
		let owned: (WebGLBuffer | WebGLVertexArrayObject)[] = [];
		const vao = (data: Float32Array, own = true, buffer = createBuffer(gl, data)): Drawable => {
			const v = createVao(gl, prog, [{ buffer, attribs: MAP_ATTRIBS }]);
			if (own) owned.push(buffer, v);
			return { vao: v, count: data.length / 7 };
		};

		// The walker's own box: 24 line vertices, rewritten every frame it is shown.
		const boxData = new Float32Array(24 * 7);
		const boxBuf = createBuffer(gl, boxData, gl.DYNAMIC_DRAW);
		const hitbox = vao(boxData, false, boxBuf);
		const figure = vao(cube(), false);
		const H = WALKER_DEFAULTS.half;
		/** Where each other player is DRAWN. Poses land at 10Hz; easing toward
		 *  them is what keeps a figure walking rather than teleporting. `phase`
		 *  is how far through its walk cycle the distance covered has carried it. */
		const shown = new Map<string, { x: number; y: number; z: number; yaw: number; phase: number; moving: boolean }>();
		/** Each seat's character on the GPU, rebuilt when its look changes. By
		 *  content: the lobby hands over new objects on every snapshot, and
		 *  re-meshing a walk cycle per broadcast would be the frame budget. */
		const bodies = new Map<string, { look: FigureLook; key: string; groups: { vao: WebGLVertexArrayObject; buffer: WebGLBuffer; count: number; rgb: RGB; emits: boolean }[] }>();
		function bodyFor(seat: string, look: FigureLook) {
			const had = bodies.get(seat);
			if (had?.look === look) return had;
			const key = JSON.stringify(look);
			if (had?.key === key) {
				had.look = look;
				return had;
			}
			for (const g of had?.groups ?? []) {
				gl.deleteBuffer(g.buffer);
				gl.deleteVertexArray(g.vao);
			}
			const groups = meshFigure(look).map((g) => {
				const buffer = createBuffer(gl, g.verts);
				return { vao: createVao(gl, prog, [{ buffer, attribs: MAP_ATTRIBS }]), buffer, count: g.count, rgb: gpu.tone(g.color), emits: g.emits };
			});
			const body = { look, key, groups };
			bodies.set(seat, body);
			return body;
		}
		let poseAt = 0;
		/** Your arms: their colours by look, and how far through a stride and
		 *  how hard they swing, carried frame to frame. */
		let arms: { look: FigureLook | undefined; sleeve: RGB; hand: RGB } | null = null;
		let armPhase = 0, armAmp = 0;
		const armM = new Float32Array(16);
		function armColorsFor(look: FigureLook | undefined) {
			if (arms && arms.look === look) return arms;
			const c = look ? armColors(look) : null;
			return (arms = { look, sleeve: c ? gpu.tone(c.sleeve) : C.blue, hand: c ? gpu.tone(c.hand) : C.accent });
		}

		const pads = OFFICE_DATA.stations.map((st) => ({ id: st.id, ring: vao(padRing(st), false), grid: vao(padGrid(st), false) }));
		const u = (n: string) => gl.getUniformLocation(prog, n);
		const U = {
			vp: u('uVP'), model: u('uModel'), eye: u('uEye'), color: u('uColor'), fog: u('uFog'), lit: u('uLit'), far: u('uFar'),
			code: u('uCode'), time: u('uTime'), glow: u('uGlow'), amb: u('uAmb'), ln: u('uLN'), l: u('uL'), lc: u('uLC'),
			s: u('uS'), sd: u('uSD'), sc: u('uSC')
		};
		/** Where the drone is drawn, eased toward its goal so it flies out and back. */
		let dp: { x: number; y: number; z: number } | null = null;
		const droneM = new Float32Array(16);
		const leafM = new Float32Array(16);
		const lightPos = new Float32Array(MAX_LIGHTS * 4);
		const lightRGB = new Float32Array(MAX_LIGHTS * 3);

		const FIXED = [
			'--bg', '--fg', '--palette-emerald', '--palette-amber', '--palette-violet', '--palette-sky', '--palette-red', '--palette-blue',
			'--palette-yellow', '--accent', '--border-strong', '--fg-dim'
		];
		const F = tokenRGB(root, FIXED);
		const C = {
			accent: F['--accent'],
			pad: F['--fg-dim'],
			padGrid: F['--border-strong'],
			fog: F['--bg'],
			walkable: F['--palette-emerald'],
			climbable: F['--palette-amber'],
			bounds: F['--palette-violet'],
			ground_box: F['--palette-emerald'],
			air_box: F['--palette-sky'],
			red: F['--palette-red'],
			blue: F['--palette-blue'],
			beam: mix3(F['--fg'], F['--palette-amber'], 0.3),
			drone: mix3(F['--bg'], F['--fg'], 0.35)
		};
		const FAR = 160;

		type GpuBatch = { tris: Drawable; edges: Drawable | null; face: RGB; edge: RGB | null; lit: number; glow: boolean };
		/** One map on the GPU: a drawable and its colours per material. */
		let gpu: {
			floor: { g: Drawable; color: RGB }[];
			grid: { g: Drawable; color: RGB } | null;
			batches: GpuBatch[];
			/** Each door leaf prop, baked from its hinge for `leafModel` to turn. */
			leaves: Map<string, GpuBatch[]>;
			/** The map's prop lights with their colour, nearest picked per frame. */
			lights: (ComposedMap['lights'][number] & { rgb: RGB })[];
			/** Any tone a cue may tint with. */
			tone: (t: Tone) => RGB;
			/** Station fixtures, out of the batches: drawn as they are, or working. */
			fx: { station: string; fx: WorkFx; g: Drawable; face: RGB; lit: number }[];
			/** Lamp, screen and LED copies by `scope|material`, painted when they react. */
			regions: Map<string, Drawable>;
			walkable: Drawable;
			climbable: Drawable;
			bounds: Drawable;
		};
		function upload(m: ComposedMap) {
			for (const o of owned) {
				if (o instanceof WebGLBuffer) gl.deleteBuffer(o);
				else gl.deleteVertexArray(o);
			}
			owned = [];
			const T = tokenRGB(root!, tonesOf(m.def));
			// A tone first named by a cue is read the first time it is drawn.
			const tone = (t: Tone): RGB => toneRGB(root!, T, t);
			const mat = (id: string) => m.def.materials[id];
			const split = splitMap(m);
			const batch = (b: ComposedMap['batches'][number]): GpuBatch => {
				const ma = mat(b.material);
				return {
					tris: vao(b.tris),
					edges: ma.edge ? vao(b.edges) : null,
					face: tone(ma.face),
					edge: ma.edge ? tone(ma.edge) : null,
					lit: ma.lit ?? 1,
					glow: !!ma.glow
				};
			};
			nav = navGrid(m.world, WALKER_DEFAULTS.half, WALKER_DEFAULTS.stepHeight);
			gpu = {
				floor: m.floor.map((l) => ({ g: vao(l.tris), color: tone(mat(l.material).face) })),
				grid: m.grid && m.def.grid ? { g: vao(m.grid), color: tone(mat(m.def.grid.material).face) } : null,
				fx: [...split.fx].map(([key, t]) => {
					const [station, material] = key.split('|');
					const kind = OFFICE_DATA.stations.find((s) => s.id === station)!.kind;
					return { station, fx: WORK_FX[kind][material], g: vao(new Float32Array(t)), face: tone(mat(material).face), lit: mat(material).lit ?? 1 };
				}),
				regions: new Map([...split.regions].map(([key, t]) => [key, vao(new Float32Array(t))])),
				batches: split.batches.map(batch),
				leaves: new Map([...new Set((MAP_DOORS[m.def.id] ?? []).map((d) => d.prop))].map((p) => [p, leafMesh(m.def, p).map(batch)])),
				lights: m.lights.map((l) => ({ ...l, rgb: tone(l.tone) })),
				tone,
				walkable: vao(m.overlay.walkable),
				climbable: vao(m.overlay.climbable),
				bounds: vao(hullBoxes(m.world))
			};
		}
		// Nested, so a map switch or a reroll re-uploads without rebuilding the
		// context, and the teardown below still owns everything.
		$effect(() => upload(composed));

		/** `glow` draws at full colour in any dark: lights, and the overlays a
		 *  player must always be able to read. */
		const draw = (g: Drawable, mode: number, color: number[], lit: number, glow = false) => {
			gl.bindVertexArray(g.vao);
			gl.uniform3fv(U.color, color);
			gl.uniform1f(U.lit, lit);
			gl.uniform1f(U.glow, glow ? 1 : 0);
			gl.drawArrays(mode, 0, g.count);
		};

		/** This viewer's lighting for the frame: ambient and tint, then the
		 *  nearest lights by how far their reach falls short of the eye. */
		const order: number[] = [];
		function light(eye: { x: number; y: number; z: number }, t: number): RGB {
			const L = lightingFor(cues, map.def.ambient ?? 1, t * 1000);
			const tint: RGB = L.tint ? gpu.tone(L.tint) : [1, 1, 1];
			const amb = tint.map((v) => v * L.ambient) as RGB;
			gl.uniform3fv(U.amb, amb);
			const ls = gpu.lights;
			order.length = ls.length;
			for (let i = 0; i < ls.length; i++) order[i] = i;
			const reach = (i: number) => Math.hypot(ls[i].x - eye.x, ls[i].y - eye.y, ls[i].z - eye.z) - ls[i].radius;
			order.sort((a, b) => reach(a) - reach(b));
			const n = Math.min(MAX_LIGHTS, ls.length);
			for (let j = 0; j < n; j++) {
				const l = ls[order[j]];
				const gutter = Math.sin(t * 11 + l.phase) * Math.sin(t * 6.3 + l.phase * 1.7);
				const k = L.light(l.group) * (1 - l.flicker * 0.5 * (1 + gutter));
				lightPos.set([l.x, l.y, l.z, l.radius], j * 4);
				lightRGB.set([l.rgb[0] * tint[0] * k, l.rgb[1] * tint[1] * k, l.rgb[2] * tint[2] * k], j * 3);
			}
			gl.uniform1i(U.ln, n);
			gl.uniform4fv(U.l, lightPos);
			gl.uniform3fv(U.lc, lightRGB);
			return amb;
		}

		let raf = 0;
		let last = performance.now();
		const frame = (now: number) => {
			raf = requestAnimationFrame(frame);
			if (glc.lost) return;
			hitchWatch.beat('first-person');
			const frameDt = Math.min(0.1, (now - last) / 1000);
			tick(frameDt);
			last = now;
			hud(now);
			if (onpose && now - poseAt >= 100) {
				poseAt = now;
				onpose({ ...walker.pos, yaw: look.yaw });
			}

			glc.resize();
			gl.useProgram(prog);
			const eye = walkerEye(walker);
			const goal = droneGoal(drone, eye, look.yaw, now / 1000);
			dp ??= { ...goal };
			const fly = Math.min(1, frameDt * 5);
			dp.x += (goal.x - dp.x) * fly;
			dp.y += (goal.y - dp.y) * fly;
			dp.z += (goal.z - dp.z) * fly;
			if (gameDev.chase) {
				const cp = Math.cos(look.pitch);
				eye.x -= Math.sin(look.yaw) * cp * 4;
				eye.y += 1.5 - Math.sin(look.pitch) * 4;
				eye.z += Math.cos(look.yaw) * cp * 4;
			}
			// The air is lit like the walls, so a far wall fades into dark, not into grey.
			const amb = light(eye, now / 1000);
			// The beam leaves the drone and meets your crosshair 8m out.
			const b = hasDrone ? beam(drone, now / 1000) : 0;
			const cp = Math.cos(look.pitch);
			const ray = [eye.x + Math.sin(look.yaw) * cp * 8 - dp.x, eye.y + Math.sin(look.pitch) * 8 - dp.y, eye.z - Math.cos(look.yaw) * cp * 8 - dp.z];
			const rl = Math.hypot(...ray);
			gl.uniform4f(U.s, dp.x, dp.y, dp.z, 16);
			gl.uniform4f(U.sd, ray[0] / rl, ray[1] / rl, ray[2] / rl, 0.93);
			gl.uniform3fv(U.sc, C.beam.map((v) => v * 1.4 * b));
			const fog = C.fog.map((v, i) => v * Math.min(1, amb[i])) as RGB;
			gl.clearColor(...fog, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			const vp = mul(perspective(1.15, glc.cssWidth / glc.cssHeight, 0.05, FAR), view(eye.x, eye.y, eye.z, look.yaw, look.pitch));
			gl.uniformMatrix4fv(U.vp, false, vp);
			placeMarks(vp, glc.cssWidth, glc.cssHeight);
			gl.uniform3f(U.eye, eye.x, eye.y, eye.z);
			gl.uniform3fv(U.fog, fog);
			gl.uniform1f(U.far, FAR);
			gl.uniformMatrix4fv(U.model, false, IDENTITY);

			// The floor layers lie flat under everything, so painter's order is
			// exact for them and they skip the depth TEST — no z-fight between
			// road, kerb and paint at a hundred metres — but still write depth, so
			// the sky drawn after the map knows the floor is there.
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.ALWAYS);
			gl.disable(gl.CULL_FACE);
			for (const l of gpu.floor) draw(l.g, gl.TRIANGLES, l.color, 0);
			if (gpu.grid) draw(gpu.grid.g, gl.LINES, gpu.grid.color, 0);
			const workingAt = office?.me?.channel?.station;
			if (office)
				for (const p of pads) {
					if (p.id === workingAt) continue;
					const here = p.id === station?.id;
					draw(p.grid, gl.LINES, here ? mix3(C.padGrid, C.accent, 0.5) : C.padGrid, 0, true);
					draw(p.ring, gl.LINES, here ? C.accent : C.pad, 0, true);
				}

			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
			gl.enable(gl.CULL_FACE);
			// Faces pushed back a hair so the wireframe on their edges wins the tie.
			// The face-class overlay is the same triangles at the same offset, so it
			// lands on identical depths and wins LEQUAL against the face under it.
			gl.enable(gl.POLYGON_OFFSET_FILL);
			gl.polygonOffset(1, 1);
			for (const b of gpu.batches) draw(b.tris, gl.TRIANGLES, b.face, b.lit, b.glow);
			/** Every door leaf on its hinge, through `each` for one pass. */
			const leaves = (each: (b: GpuBatch) => void) => {
				for (const d of doors) {
					gl.uniformMatrix4fv(U.model, false, leafModel(d, leafM));
					for (const b of gpu.leaves.get(d.door.prop) ?? []) each(b);
				}
				gl.uniformMatrix4fv(U.model, false, IDENTITY);
			};
			leaves((b) => draw(b.tris, gl.TRIANGLES, b.face, b.lit, b.glow));

			// The fixture you are working: parcels shuffle along the shelf, screens
			// scroll code, LEDs chatter. Everybody else's sits still.
			const t = now / 1000;
			gl.uniform1f(U.time, t);
			for (const f of gpu.fx) {
				const busy = f.station === workingAt;
				if (busy && f.fx === 'shuffle') {
					const dx = 0.1 * Math.sin(t * 7), dy = 0.05 * Math.max(0, Math.sin(t * 14));
					gl.uniformMatrix4fv(U.model, false, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, dx, dy, 0, 1]));
				}
				gl.uniform1f(U.code, busy && f.fx === 'code' ? 1 : 0);
				const green = F['--palette-emerald'], amber = F['--palette-amber'];
				const color = !busy ? f.face : f.fx === 'code' ? green : f.fx === 'blink' ? (Math.floor(t * 8) % 2 ? green : amber) : f.face;
				draw(f.g, gl.TRIANGLES, color, busy && f.fx !== 'shuffle' ? 0 : f.lit, busy && f.fx !== 'shuffle');
				gl.uniformMatrix4fv(U.model, false, IDENTITY);
			}
			gl.uniform1f(U.code, 0);

			// What you perceived, on the thing that did it: the same triangles as
			// the lamp or screen under them, so LEQUAL paints them over it.
			for (const r of reactions) {
				const how = REACT[r.key];
				const age = (now - r.seen) / 1000;
				if (!how || age > how.s) continue;
				const scope = how.scope === 'all' ? 'all' : how.scope === 'station' && r.station ? `station:${r.station}` : `zone:${r.zone}`;
				const g = gpu.regions.get(`${scope}|${how.mat}`);
				if (g) draw(g, gl.TRIANGLES, mix3(C.fog, F[how.tone], lit(how.pattern, age, how.s)), 0, true);
			}
			if (gameDev.faces) {
				draw(gpu.walkable, gl.TRIANGLES, C.walkable, 1, true);
				draw(gpu.climbable, gl.TRIANGLES, C.climbable, 1, true);
			}
			gl.disable(gl.POLYGON_OFFSET_FILL);
			for (const b of gpu.batches) if (b.edges && b.edge) draw(b.edges, gl.LINES, b.edge, 0);
			leaves((b) => b.edges && b.edge && draw(b.edges, gl.LINES, b.edge, 0));
			// What lies past the glass, only where the map left the far plane
			// showing. The match picks which, so every seat sees the same; with
			// no match, a dev reroll cycles them.
			const skies = map.def.sky ?? [];
			if (skies.length) {
				const pick = office?.scenery ?? (devTools && !tour ? gameDev.seed : 0);
				const view = { eye, yaw: look.yaw, pitch: look.pitch, fovy: 1.15, aspect: glc.cssWidth / glc.cssHeight, time: t, room: map.def.bounds };
				sky.draw(skies[Math.abs(pick) % skies.length], gpu.tone, view);
				gl.useProgram(prog);
			}

			const ease = Math.min(1, frameDt * 12);
			// Who is in reach and who is under the crosshair, measured on the
			// floor from where this player stands, along where they face.
			const me = walker.pos, fx = Math.sin(look.yaw), fz = -Math.cos(look.yaw);
			const acting = !follow && office?.phase === 'playing';
			const gone = acting ? office!.players.filter((p) => p.escorted).map((p) => p.seatId) : [];
			let lift: { seat: string; x: number; z: number; off: number } | null = null;
			let aim: { seat: string; x: number; z: number; along: number } | null = null;
			const inReach = new Set<string>();
			for (const o of others) {
				if (o.seat === follow) continue;
				if (o.at !== undefined && now - o.at > STALE_MS) {
					shown.delete(o.seat);
					continue;
				}
				let s = shown.get(o.seat);
				if (!s) shown.set(o.seat, (s = { ...o, phase: 0, moving: false }));
				const px = s.x, pz = s.z;
				// Eased toward the latest pose, a bot's as a person's: the office
				// walks its bots and relays every step.
				s.x += (o.x - s.x) * ease;
				s.y += (o.y - s.y) * ease;
				s.z += (o.z - s.z) * ease;
				s.yaw = o.yaw;
				const moved = Math.hypot(s.x - px, s.z - pz);
				s.phase = (s.phase + moved / STRIDE_M) % 1;
				s.moving = moved > 0.3 * frameDt;
				if (acting && !gone.includes(o.seat)) {
					const dx = s.x - me.x, dz = s.z - me.z, d = Math.hypot(dx, dz);
					const along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx);
					if (d <= LIFT_REACH) {
						inReach.add(o.seat);
						const off = d > 1e-3 ? Math.acos(Math.max(-1, Math.min(1, along / d))) : 0;
						if (!lift || off < lift.off) lift = { seat: o.seat, x: s.x, z: s.z, off };
					}
					if (along > 0 && along <= AIM_M && across <= AIM_HALF && (!aim || along < aim.along)) aim = { seat: o.seat, x: s.x, z: s.z, along };
				}
				// The lift's mark glows, pulsing; anybody else in reach a little.
				const tint = o.seat === liftable ? 0.4 + 0.12 * Math.sin(now / 160) : inReach.has(o.seat) ? 0.18 : 0;
				const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
				const look = figures[o.seat];
				if (!look) {
					gl.uniformMatrix4fv(U.model, false, new Float32Array([c * H.x, 0, -sn * H.x, 0, 0, H.y, 0, 0, sn * H.z, 0, c * H.z, 0, s.x, s.y, s.z, 1]));
					draw(figure, gl.TRIANGLES, mix3(C.blue, C.accent, tint), 1);
					continue;
				}
				// A figure faces its local +z (the visor is at −n); this turns that
				// to the walker's forward for `yaw`, (sin, 0, −cos).
				gl.uniformMatrix4fv(U.model, false, new Float32Array([-c, 0, -sn, 0, 0, 1, 0, 0, sn, 0, -c, 0, s.x, s.y, s.z, 1]));
				const frame = s.moving ? Math.floor(s.phase * FRAMES) % FRAMES : STILL;
				for (const g of bodyFor(o.seat, look).groups) {
					gl.bindVertexArray(g.vao);
					gl.uniform3fv(U.color, tint ? mix3(g.rgb, C.accent, tint) : g.rgb);
					gl.uniform1f(U.lit, 1);
					gl.uniform1f(U.glow, g.emits ? 1 : 0);
					gl.drawArrays(gl.TRIANGLES, frame * g.count, g.count);
				}
			}
			// Nobody is offered through a wall: one trace each, at eye height.
			const from = walkerEye(walker);
			const seen = (t: { x: number; z: number } | null) =>
				!!t && trace(world, from, { x: t.x, y: from.y, z: t.z }, SIGHT).plane === null;
			const nextLift = seen(lift) ? lift!.seat : null;
			const nextAim = seen(aim) ? aim!.seat : null;
			if (nextLift !== liftable) liftable = nextLift;
			if (nextAim !== aimed) aimed = nextAim;

			// The drone: a body, four rotors and a lens that is the bulb. Drawn
			// until it has flown back into you.
			if (hasDrone && (drone.out || Math.hypot(goal.x - dp.x, goal.y - dp.y, goal.z - dp.z) > 0.3)) {
				const c = Math.cos(look.yaw), sn = Math.sin(look.yaw);
				/** A box about (right, up, back) of the drone, half-sizes sx, sy, sz. */
				const part = (ox: number, oy: number, oz: number, sx: number, sy: number, sz: number, color: number[], glow = false) => {
					droneM.set([c * sx, 0, sn * sx, 0, 0, sy, 0, 0, -sn * sz, 0, c * sz, 0, dp!.x + c * ox - sn * oz, dp!.y + oy - sy, dp!.z + sn * ox + c * oz, 1]);
					gl.uniformMatrix4fv(U.model, false, droneM);
					draw(figure, gl.TRIANGLES, color, 1, glow);
				};
				part(0, 0, 0, 0.12, 0.035, 0.09, C.drone);
				for (const [rx, rz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(rx * 0.15, 0.045, rz * 0.12, 0.055, 0.004, 0.055, C.padGrid);
				const lens = drone.tripped ? mix3(C.fog, C.red, 0.5 + 0.5 * Math.sin(t * 6)) : mix3(C.fog, C.beam, Math.max(0.15, b));
				part(0, 0, -0.095, 0.035, 0.02, 0.008, lens, true);
				gl.uniformMatrix4fv(U.model, false, IDENTITY);
			}

			// Your arms, last and over a cleared depth buffer, so a wall you stand
			// against never cuts them off.
			const speed = Math.hypot(walker.vel.x, walker.vel.z);
			const grounded = walker.mode === 'ground';
			armPhase = (armPhase + (speed * frameDt) / STRIDE_M) % 1;
			armAmp += ((grounded ? Math.min(2, speed / gameDev.tuning.walkSpeed) : 0) - armAmp) * Math.min(1, frameDt * 8);
			if (!follow && !gameDev.chase) {
				gl.clear(gl.DEPTH_BUFFER_BIT);
				const c = armColorsFor(office?.me?.seatId ? figures[office.me.seatId] : undefined);
				for (const b of armBoxes(glc.cssWidth / glc.cssHeight, armPhase, armAmp, !grounded)) {
					gl.uniformMatrix4fv(U.model, false, armModel(armM, eye, look.yaw, look.pitch, b));
					draw(figure, gl.TRIANGLES, b.part === 'hand' ? c.hand : c.sleeve, 1);
				}
			}

			// Debug lines draw through walls — an x-ray is the point of them.
			gl.disable(gl.DEPTH_TEST);
			gl.uniformMatrix4fv(U.model, false, IDENTITY);
			if (gameDev.bounds) draw(gpu.bounds, gl.LINES, C.bounds, 0, true);
			if (gameDev.hitbox) {
				const p = walker.pos;
				boxLines(boxData, 0, p.x - H.x, p.y, p.z - H.z, p.x + H.x, p.y + 2 * H.y, p.z + H.z);
				updateBuffer(gl, boxBuf, boxData);
				draw(hitbox, gl.LINES, walker.mode === 'ground' ? C.ground_box : C.air_box, 0, true);
			}
			gl.bindVertexArray(null);
		};
		raf = requestAnimationFrame(frame);

		const clear = () => held.clear();
		const onLock = () => (locked = document.pointerLockElement === el);
		// A backdrop takes no input: the page over it is still a page.
		if (!tour) {
			window.addEventListener('keydown', onKey);
			window.addEventListener('keyup', onKey);
			window.addEventListener('blur', clear);
			document.addEventListener('pointerlockchange', onLock);
			document.addEventListener('mousemove', onMouse);
		}
		return () => {
			document.removeEventListener('pointerlockchange', onLock);
			document.removeEventListener('mousemove', onMouse);
			if (document.pointerLockElement === el) document.exitPointerLock();
			cancelAnimationFrame(raf);
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('keyup', onKey);
			window.removeEventListener('blur', clear);
			glc.dispose();
		};
	});
</script>

<div class="fp" class:tour bind:this={host}>
	<canvas
		bind:this={canvas}
		onclick={capture}
		onpointerdown={lookDown}
		onpointermove={lookMove}
		onpointerup={lookUp}
		onpointercancel={lookUp}
		aria-label="First-person scene. Click to look with the mouse; WASD to walk, arrow keys to turn and look, Space to jump."
	></canvas>
	{#if noGl}
		<p class="nogl">WebGL2 unavailable.</p>
	{/if}
	<!-- Your stations, pinned in the world by placeMarks every frame. The two
	     data attributes are written there, not here; declared so Svelte keeps
	     the CSS that keys on them. -->
	{#each targets as s, i (s.id)}
		<div class="wp" class:next={s.next} style:--tone="var({s.tone})" bind:this={marks[i]} data-lit={null} data-edge={null}>
			<span class="wp-in">
				<span class="wp-chev l"><Icon name="chevron-left" size={16} /></span>
				<span class="wp-chev r"><Icon name="chevron-right" size={16} /></span>
				<span class="gem"><Icon name={s.icon} size={s.next ? 14 : 11} /></span>
				{#if s.next}<span class="wp-next">NEXT</span>{/if}
				<span class="wp-label">{s.label}</span>
				<span class="wp-m"></span>
			</span>
		</div>
	{/each}
	{#if !noGl && !follow && !tour}
		<div class="gear">
			<GameMenu
				title="Insider Threat"
				onresume={capture}
				{onleave}
				note={onleave ? undefined : 'Only the host can end the match.'}
			/>
		</div>
	{/if}
	{#if !tour}
		<div class="hud">
			<button type="button" class="radar" aria-label="Open the map" onclick={() => (mapOpen = true)}>
				<Radar
					world={composed.world}
					pose={() => ({ x: walker.pos.x, z: walker.pos.z, yaw: look.yaw })}
					marks={targets.filter((t) => !t.hazard)}
				/>
			</button>
			<Minimap
				world={composed.world}
				labels={mapDef.landmarks}
				pose={() => ({ x: walker.pos.x, z: walker.pos.z, yaw: look.yaw })}
				fullOnly
				bind:full={mapOpen}
			/>
			{#if hasDrone}
				<div class="drone" class:hot={droneHud.heat > 0.7} class:tripped={droneHud.tripped}>
					<span>{droneHud.tripped ? 'drone · overheated' : droneHud.out ? 'drone · on' : 'drone · F'}</span>
					<span class="heat"><span style:width="{droneHud.heat * 100}%"></span></span>
				</div>
			{/if}
		</div>
		<div class="reticle" class:hot={!!station && !!office} aria-hidden="true"></div>
	{/if}
	{#if touchUi && !follow && !noGl && !tour}
		<div
			class="stick"
			class:run={stickRun}
			onpointerdown={stickDown}
			onpointermove={stickMove}
			onpointerup={stickUp}
			onpointercancel={stickUp}
			aria-hidden="true"
		>
			<span class="knob" style:transform="translate({stick.x * STICK_R}px, {stick.y * STICK_R}px)"></span>
		</div>
		<button
			class="jump"
			aria-label="Jump"
			onpointerdown={() => held.add('Space')}
			onpointerup={() => held.delete('Space')}
			onpointercancel={() => held.delete('Space')}
			onpointerleave={() => held.delete('Space')}
		>
			<Icon name="chevron-up" size={28} />
		</button>
	{/if}
	{#if !locked && !follow && !noGl}
		<p class="hint">
			{touchUi
				? 'drag to look · stick walk · push to the rim to run · tap radar for map'
				: `click to look · WASD walk · shift run · space jump · tab map${MAP_DOORS[mapDef.id]?.length ? ' · E door' : ''}${hasDrone ? ' · F drone' : ''}`}
		</p>
	{:else if doorHint}
		<p class="hint door">{doorHint}</p>
	{/if}
	{#if office && act}
		<OfficeHud
			{office}
			{reactions}
			near={station}
			{zone}
			{act}
			{liftable}
			{aimed}
			{refusal}
			{onleave}
			look={office.me?.seatId ? figures[office.me.seatId] : undefined}
		/>
	{/if}
</div>

{#snippet lightingCues()}
	<div class="cues">
		{#each Object.keys(OFFICE_DATA.cues) as OfficeCueKey[] as key (key)}
			<Button size="xs" onclick={() => fireLocal(key)}>{key}</Button>
		{/each}
	</div>
{/snippet}

{#if devTools && !tour}
	<!-- The lighting cues live in the dev cog's GAME group, not on the HUD. -->
	<GameDevTools extra={{ label: 'lighting · fire a cue on me', content: lightingCues }} />
{/if}

<style>
	/* The whole window: this replaces the board rather than sitting in it. */
	.fp {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: var(--bg);
	}
	.fp.tour {
		position: absolute;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}
	.stick,
	.jump {
		position: absolute;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		border: 1.5px solid color-mix(in srgb, var(--fg) 35%, transparent);
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--bg) 35%, transparent);
	}
	.stick {
		left: calc(var(--sp-4) + env(safe-area-inset-left));
		bottom: calc(var(--sp-4) + env(safe-area-inset-bottom));
		width: 128px;
		height: 128px;
		display: grid;
		place-items: center;
	}
	.knob {
		width: 52px;
		height: 52px;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--fg) 45%, transparent);
		pointer-events: none;
	}
	.stick.run {
		border-color: var(--accent);
	}
	.stick.run .knob {
		background: var(--accent);
	}
	/* Above the case file, which holds the bottom-right corner. */
	.jump {
		right: calc(var(--sp-4) + env(safe-area-inset-right));
		bottom: calc(var(--sp-4) + 96px + env(safe-area-inset-bottom));
		width: 72px;
		height: 72px;
		display: grid;
		place-items: center;
		color: var(--fg);
		padding: 0;
	}
	.jump:active {
		border-color: var(--accent);
		color: var(--accent);
	}
	.hud {
		position: absolute;
		top: var(--sp-4);
		left: var(--sp-4);
		width: 180px;
	}
	.radar {
		display: block;
		width: 100%;
		height: 180px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		touch-action: manipulation;
	}
	.gear {
		position: absolute;
		top: var(--sp-4);
		right: var(--sp-4);
	}
	/* Placed by placeMarks; `.wp-in` centres the marker on the point. */
	.wp {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		will-change: transform;
	}
	/* Every marker in its list row's colour; the next one is the loud one. */
	.wp-in {
		display: grid;
		justify-items: center;
		gap: 2px;
		transform: translate(-50%, -50%);
		color: var(--tone, var(--accent));
		opacity: 0.6;
	}
	.wp[data-lit] .wp-in,
	.wp.next .wp-in {
		opacity: 1;
	}
	.wp:global([data-edge='l']) .wp-in {
		justify-items: start;
		transform: translate(0, -50%);
	}
	.wp:global([data-edge='r']) .wp-in {
		justify-items: end;
		transform: translate(-100%, -50%);
	}
	.wp-chev {
		display: none;
	}
	.wp:global([data-edge='l']) .wp-chev.l,
	.wp:global([data-edge='r']) .wp-chev.r {
		display: block;
	}
	.gem {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1.5px solid var(--tone, var(--accent));
		background: color-mix(in srgb, var(--bg) 70%, transparent);
	}
	.wp[data-lit] .gem,
	.wp.next .gem {
		width: 28px;
		height: 28px;
		color: var(--bg);
		background: var(--tone, var(--accent));
		box-shadow: 0 0 14px var(--tone, var(--accent));
	}
	.wp-next {
		font-family: var(--mono);
		font-size: var(--t-micro);
		font-weight: 700;
		letter-spacing: 0.18em;
		text-shadow: 0 1px 4px var(--bg);
	}
	.wp:not(.next) .wp-label {
		font-size: 9px;
	}
	.wp-label,
	.wp-m {
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-shadow: 0 1px 4px var(--bg);
		white-space: nowrap;
	}
	.wp-m {
		color: var(--fg);
	}
	.hint {
		position: absolute;
		top: calc(50% + 20px);
		left: 50%;
		transform: translateX(-50%);
		margin: 0;
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: 0.12em;
		color: var(--fg-dim);
		text-shadow: 0 1px 4px var(--bg);
		white-space: nowrap;
	}
	.hud {
		display: grid;
		gap: var(--sp-2);
	}
	/* Above the reticle: the station prompt has the space under it. */
	.hint.door {
		top: calc(50% - 36px);
		color: var(--fg);
	}
	.drone {
		display: grid;
		gap: 4px;
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
		text-shadow: 0 1px 4px var(--bg);
	}
	.heat {
		height: 3px;
		background: var(--border);
	}
	.heat > span {
		display: block;
		height: 100%;
		background: var(--palette-amber);
		transition: width 0.1s linear;
	}
	.drone.hot .heat > span,
	.drone.tripped .heat > span {
		background: var(--palette-red);
	}
	.drone.tripped {
		color: var(--palette-red);
	}
	.cues {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
	}
	.reticle {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 6px;
		height: 6px;
		margin: -3px 0 0 -3px;
		border-radius: var(--r-pill);
		background: var(--accent);
		opacity: 0.7;
		pointer-events: none;
	}
	/* At a station: a ring, the prompt under it is the work here. */
	.reticle.hot {
		width: 14px;
		height: 14px;
		margin: -7px 0 0 -7px;
		background: transparent;
		border: 2px solid var(--accent);
		opacity: 1;
	}
	.nogl {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--fg-dim);
		font-family: var(--mono);
	}
</style>
