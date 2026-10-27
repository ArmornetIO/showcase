<script lang="ts">
	// ── The office, toured ──────────────────────────────────────────────────────
	// Insider Threat's start-screen scene: the real office map, drawn by the
	// game's own first-person renderer, in five short shots, one per step of the
	// worm. Each shot drifts toward the station the step is done at and fires
	// the reactions office.yaml gives that milestone (the lobby lights flicker,
	// the bay screens glitch, the server room dims and its racks go amber, every
	// screen goes green), which is what a player in the room would see. Breach's
	// screen does the same with three real attacks on its globe.
	//
	// Shots rather than one walk: nothing here collides, the server room is
	// walled in opaque glass, and a camera routed through its doors spent most
	// of the loop with its nose against a wall.
	//
	// The camera is a followed seat: `InsiderThreat` rides a pose this file
	// moves, exactly as god mode rides a player's relayed pose.
	import InsiderThreat from '../InsiderThreat.svelte';
	import { HALLOWEEN } from './halloween.js';
	import { OFFICE_DATA } from '../internal/office.gen.js';
	import { newReactionFrame } from '../wire.gen.js';
	import type { Perceived } from '../net.svelte.js';
	import { prefersReducedMotion } from 'showcase';

	interface Props {
		/** How many of the worm's steps are done: 0 at the start of a loop. */
		onstep?: (done: number) => void;
		/** The office after hours on the 31st (insider/halloween.ts): the same
		 *  floor and stations, dressed for a party, with its own lighting cues
		 *  firing as the camera walks into the server room and the comms closet. */
		halloween?: boolean;
	}
	let { onstep, halloween = false }: Props = $props();

	interface Pt {
		x: number;
		z: number;
	}

	/** A shot: the milestone, its station and the reactions office.yaml fires
	 *  for it; where the camera drifts from and to (metres, `lift` above a
	 *  standing eye) while it keeps `look` in frame. `afterHours` reframes it
	 *  for the Halloween office, where the overheads are dead. */
	interface Framing {
		from: Pt;
		to: Pt;
		look: Pt;
	}
	interface Shot extends Framing {
		milestone: string;
		station: string;
		reacts: string[];
		lift: number;
		pitch: number;
		afterHours?: Framing;
	}
	const SHOTS: Shot[] = [
		// The delivery shelf, from the lobby, under its lamps.
		{
			milestone: 'drop',
			station: 'shelf',
			reacts: ['lobby_flicker'],
			from: { x: 2.6, z: 15.6 },
			to: { x: 3.9, z: 17.1 },
			look: { x: 6, z: 20.6 },
			lift: 0.1,
			pitch: -0.06,
			// After hours the lobby is dark but for the pumpkins either side of
			// the front door, so the shot takes them in with the shelf.
			afterHours: { from: { x: -1.6, z: 13.4 }, to: { x: -0.6, z: 15 }, look: { x: 3.4, z: 21 } }
		},
		// The bay desk, from the open side of its row, so the screens face the
		// camera.
		{
			milestone: 'commit',
			station: 'desk_c5',
			reacts: ['bay_screens'],
			from: { x: 10.6, z: 10.4 },
			to: { x: 11.8, z: 9.2 },
			look: { x: 15.6, z: 5 },
			lift: 0.45,
			pitch: -0.3
		},
		// Down the server room's cold aisle, the racks facing in either side.
		{
			milestone: 'build',
			station: 'rack_build',
			reacts: ['server_flicker', 'rack_amber'],
			from: { x: 6.3, z: 0.2 },
			to: { x: 4.9, z: 0.05 },
			look: { x: -2.5, z: 0 },
			lift: 0,
			pitch: -0.06
		},
		// Signed at the registry rack, seen in the bays: every screen in the
		// building goes green, and there are none in the server room. From the
		// north side of the floor, where the back rows open toward the camera.
		{
			milestone: 'sign',
			station: 'rack_registry',
			reacts: ['all_green'],
			from: { x: -8.4, z: -8.2 },
			to: { x: -9.4, z: -7.4 },
			look: { x: -21, z: -2 },
			lift: 0.45,
			pitch: -0.22
		},
		// Inside the comms closet, where the worm calls home. office.yaml gives
		// the last step no reaction: the game simply ends.
		{
			milestone: 'call',
			station: 'comms',
			reacts: [],
			from: { x: -21.9, z: -13.5 },
			to: { x: -23.4, z: -15 },
			look: { x: -28, z: -20.4 },
			lift: 0.1,
			pitch: -0.1,
			// After hours the closet is unlit, and walking in blacks it out
			// (HALLOWEEN_CUES), so the camera goes close enough for the cabinets'
			// own lights to carry the shot.
			afterHours: { from: { x: -23.2, z: -14.8 }, to: { x: -24.8, z: -16.6 }, look: { x: -28, z: -20.4 } }
		}
	];
	const SHOT_MS = 5200;
	/** How far into a shot its step happens: long enough to read the room first. */
	const STEP_AT = 1500;
	const FADE_MS = 350;
	/** Dark between shots, while the followed camera eases to the next spot. */
	const GAP_MS = 450;
	const END_MS = 2200;

	const SEAT = 'tour';
	const first = SHOTS[0];
	const cam = { seat: SEAT, at: 0, x: first.from.x, y: first.lift, z: first.from.z, yaw: 0, pitch: first.pitch };
	const others = [cam];

	let reactions = $state<Perceived[]>([]);
	let shown = $state(false);
	const still = prefersReducedMotion();

	const heading = (from: Pt, to: Pt) => Math.atan2(to.x - from.x, -(to.z - from.z));
	const smooth = (u: number) => u * u * (3 - 2 * u);

	/** Put the camera `u` of the way through a shot. */
	function place(s: Shot, u: number) {
		const f = (halloween && s.afterHours) || s;
		const e = smooth(u);
		cam.x = f.from.x + (f.to.x - f.from.x) * e;
		cam.z = f.from.z + (f.to.z - f.from.z) * e;
		cam.y = s.lift;
		cam.pitch = s.pitch;
		cam.yaw = heading(cam, f.look);
	}

	const zoneOf = (p: Pt) =>
		OFFICE_DATA.zones.find((r) => p.x >= r.rect.x0 && p.x <= r.rect.x1 && p.z >= r.rect.z0 && p.z <= r.rect.z1)?.key ?? '';

	/** What a player in range would perceive for this shot's milestone. */
	function react(s: Shot, now: number): Perceived[] {
		const st = OFFICE_DATA.stations.find((x) => x.id === s.station);
		const zone = st ? zoneOf(st) : '';
		return s.reacts.map((key) => {
			const r = OFFICE_DATA.reactions.find((x) => x.key === key);
			return { ...newReactionFrame({ key, kind: r?.kind ?? '', zone, station: s.station, cue: r?.cue ?? '' }), seen: now };
		});
	}

	$effect(() => {
		// A reader who asked for stillness gets the lobby, held.
		if (still) {
			place(first, 1);
			shown = true;
			return;
		}
		let live = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let raf = 0;
		const sleep = (ms: number) =>
			new Promise<void>((r) => {
				timer = setTimeout(r, ms);
			});
		/** One shot on the frame clock, its step fired partway through. */
		const film = (s: Shot, i: number) =>
			new Promise<void>((done) => {
				const t0 = performance.now();
				let stepped = false;
				const frame = (now: number) => {
					if (!live) return done();
					const t = now - t0;
					place(s, Math.min(1, t / SHOT_MS));
					if (!stepped && t >= STEP_AT) {
						stepped = true;
						reactions = [...reactions, ...react(s, now)];
						onstep?.(i + 1);
					}
					if (t < SHOT_MS) raf = requestAnimationFrame(frame);
					else done();
				};
				raf = requestAnimationFrame(frame);
			});

		(async () => {
			while (live) {
				reactions = [];
				onstep?.(0);
				for (const [i, s] of SHOTS.entries()) {
					place(s, 0);
					await sleep(GAP_MS);
					if (!live) return;
					shown = true;
					await film(s, i);
					if (!live) return;
					if (i === SHOTS.length - 1) await sleep(END_MS);
					shown = false;
					await sleep(FADE_MS);
				}
			}
		})();
		return () => {
			live = false;
			clearTimeout(timer);
			cancelAnimationFrame(raf);
		};
	});
</script>

<div class="tour" class:shown>
	<InsiderThreat tour tourMap={halloween ? HALLOWEEN : undefined} {others} follow={SEAT} {reactions} />
</div>

<style>
	.tour {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 0.35s ease;
	}
	.tour.shown {
		opacity: 1;
	}
</style>
