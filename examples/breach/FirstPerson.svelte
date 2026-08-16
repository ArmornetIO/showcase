<script lang="ts">
	// ── FirstPerson — the camera goes and stands in somebody ──────────────────────
	// The board is a globe seen from three radii out. This is the same globe seen
	// from one, and the whole trick is that there is no second camera: the globe's
	// pose is (yaw, pitch, viewDistance) in globe radii, so walking `viewDistance`
	// down to the surface IS first person. The perspective divide that reads as
	// roundness from orbit reads as standing on the ground from 1.2, because it is
	// the same divide with the near terrain filling the frame.
	//
	// What this component adds is the FUSION. A scene is two cameras moving as one:
	//
	//   the globe pose      which way the world is turned, and how near the eye is
	//   the canvas camera   what part of the drawn result the viewport holds
	//
	// Both are driven from ONE requestAnimationFrame against ONE eased t. That is
	// not tidiness — two easings on two clocks read as two events no matter how
	// carefully the durations are matched, because the eye reads acceleration, not
	// position. `MeshCanvas.seizeCamera()` exists for exactly this: while a scene is
	// running, the globe stops correcting itself and does as it is told.
	//
	// ── The four beats ───────────────────────────────────────────────────────────
	//
	//   establish  Fly to the operator and hold on them. Someone is standing on the
	//              board, named, with a ring round them. This beat is the whole
	//              reason the next one means anything: diving into a building is a
	//              zoom, and diving into a PERSON you have just been shown is being
	//              handed the controls.
	//   dive       Speed into that body. Streaks, and the silhouette scaling past
	//              the lens as you pass through it.
	//   turn       You are them. The eye comes up off your own ground and swings
	//              onto the target — the only beat that says whose problem this now
	//              is. Deliberately a separate move from the dive: arriving and
	//              taking aim are two different thoughts, and running them together
	//              makes the dive look like it merely missed.
	//   hold       Stand there and breathe, for as long as the caller needs. The
	//              board keeps playing underneath — the squad crossing, the dice,
	//              the verdict — so a caller can put this window anywhere in a
	//              resolution and watch that part of it from inside the body.
	//
	// The public surface: `enter` / `hold` / `leave` are the beats, `play` is all of
	// them, `cut` bails. Everything else here is drawing.

	import {
		SURFACE_DISTANCE,
		cameraApproach,
		cameraLerp,
		diveFraming,
		divePose,
		studioFrame,
		type CameraPose,
		type TangentFrame
	} from 'showcase';
	import { UNIT_BUILD, type UnitShape } from './internal/fx.js';
	import { CHARACTERS, characterFacets, faceViewer } from './character.js';

	/** The slice of MeshCanvas a scene needs. Structural rather than imported so
	 *  this file does not drag the whole canvas in — and so a test can hand it six
	 *  functions instead of a globe. */
	export interface MeshHandle {
		cameraPose(): CameraPose;
		poseFacing(
			id: string,
			opts?: { tilt?: number; distance?: number }
		): CameraPose | null;
		nodeScreen(id: string): { x: number; y: number; r: number } | null;
		nodeFrame(id: string): TangentFrame | undefined;
		globeSize(): number;
		seizeCamera(): () => void;
		setCameraPose(p: CameraPose): void;
	}

	/** Whose eyes, standing where, looking at what, holding which card. Everything
	 *  the overlay says out loud is here — the component knows nothing about the
	 *  rules. */
	export interface Scene {
		/** Where the operator STANDS, and therefore the body the camera flies into.
		 *  Null — or the same as the target — collapses the scene to a plain dive
		 *  onto the building, which is the right fallback rather than an error: a
		 *  squad with nowhere to have come from is still a squad. */
		fromId?: string | null;
		/** What they are about to act on. The eye turns onto this after landing. */
		structureId: string;
		/** The seat. Named, because a POV with nobody in it is just a zoom. */
		actor: string;
		seat: string;
		/** The target building's name, for the reticle. */
		subject: string;
		/** Where they are standing, for the marker. */
		origin?: string;
		/** The card being played, and its one-word voice. */
		card: string;
		word: string;
		hue: string;
		/** Which silhouette you are inside. */
		shape: UnitShape;
	}

	interface Props {
		/** `bind:this` from the MeshCanvas whose globe this stands on. */
		mesh?: MeshHandle | null;
		/** `bind:camera` from the same one. */
		camera?: {
			fitRect(
				rect: { minX: number; minY: number; maxX: number; maxY: number },
				opts?: {
					padding?: number;
					duration?: number;
					insets?: { top?: number; right?: number; bottom?: number; left?: number };
				}
			): void;
			readonly transform: { tx: number; ty: number; scale: number };
		} | null;
		/** The HUD's clearances, so the subject does not land under a panel. */
		insets?: { top?: number; right?: number; bottom?: number; left?: number };
		/** Flying to the operator and holding on them. */
		establishMs?: number;
		/** The dive in. Long enough to read as travel, short enough that a player
		 *  who has seen it four times is not waiting it out. */
		diveMs?: number;
		/** Coming up off your own ground and onto the target. */
		turnMs?: number;
		/** The default stand-there window, when the caller does not name one. */
		holdMs?: number;
		riseMs?: number;
		/** How near the establishing shot gets, in globe radii. Not the surface —
		 *  you have to be able to see the operator standing ON something. */
		meetDistance?: number;
		/**
		 * Radians the establishing shot lifts the operator above the middle of the
		 * disc, and the most important number in this component.
		 *
		 * Dead centre on a globe is the sub-viewer point, where a body's local
		 * up-axis projects to nothing: you are looking straight DOWN at it, and a
		 * character seen from directly overhead is a hat. Lifting the pose pushes it
		 * up the disc, its up-axis projects upward on screen, and the figure reads
		 * as standing on a horizon — which is the entire difference between showing
		 * somebody and showing the top of them.
		 */
		meetTilt?: number;
		/** Radians the eye lifts above dead-on. From the surface, a pose that
		 *  CENTRES a building puts it under your boots — this is what makes it stand
		 *  in front of you instead. */
		eyeTilt?: number;
		/** How much room around the subject the frame holds, in its own radii. */
		context?: number;
	}

	let {
		mesh = null,
		camera = null,
		insets,
		establishMs = 1100,
		diveMs = 1050,
		turnMs = 700,
		holdMs = 1400,
		riseMs = 700,
		meetDistance = 1.6,
		meetTilt = 0.66,
		eyeTilt = 0.28,
		context = 1.7
	}: Props = $props();

	type Phase = 'idle' | 'establish' | 'dive' | 'turn' | 'hold' | 'rise';

	let phase = $state<Phase>('idle');
	let scene = $state<Scene | null>(null);
	/** Progress through the CURRENT phase, 0–1. Every visual below is a function of
	 *  this and the phase, which is what keeps the drawing free of timers. */
	let p = $state(0);
	let elapsed = $state(0);

	/** Where things are on screen, in this overlay's own pixels.
	 *
	 *  Note there are two coordinate systems in play and they are not
	 *  interchangeable. `mesh.nodeScreen()` answers in CANVAS units, which is what
	 *  `fitRect` wants and what the zoom must be computed in. The marker, the
	 *  streaks and the reticle are drawn in this overlay's pixels, after the canvas
	 *  transform has scaled everything — so they read the drawn node's box out of
	 *  the DOM, the same way BoardFx does, and cannot disagree with what the player
	 *  can see. */
	let host = $state<HTMLDivElement | null>(null);
	/** The target. */
	let mark = $state<{ x: number; y: number; r: number } | null>(null);
	/** The operator's ground. */
	let opMark = $state<{ x: number; y: number; r: number } | null>(null);
	let box = $state({ w: 0, h: 0 });

	function anchorOf(id: string | null | undefined): { x: number; y: number; r: number } | null {
		if (!host || !id) return null;
		const el = host.parentElement?.querySelector(`[data-node="${CSS.escape(id)}"]`);
		if (!el) return null;
		const r = (el as SVGGraphicsElement).getBoundingClientRect();
		const h = host.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) return null;
		return {
			x: r.left + r.width / 2 - h.left,
			y: r.top + r.height / 2 - h.top,
			r: Math.max(10, Math.max(r.width, r.height) / 2)
		};
	}

	/** Which way is up where the operator stands. Read every frame from the canvas,
	 *  because the globe is still turning underneath — a figure drawn in last
	 *  second's frame leans the wrong way off its own ground. */
	let opFrame = $state<TangentFrame | null>(null);

	function readMarks(s: Scene) {
		mark = anchorOf(s.structureId);
		opMark = anchorOf(standId(s));
		opFrame = mesh?.nodeFrame(standId(s)) ?? null;
	}

	/**
	 * The same frame at a size of our choosing.
	 *
	 * `nodeFrame` measures in CANVAS units at the node's own radius; this overlay
	 * draws in screen pixels and wants a figure sized to its marker. The axes are
	 * unit world directions, so rebuilding the screen displacements from them at a
	 * chosen step is a change of scale that keeps the orientation exactly — which
	 * is the whole point of borrowing the frame rather than inventing one.
	 */
	function atStep(f: TangentFrame, step: number): TangentFrame {
		return {
			e: { x: f.axis.e.x * step, y: f.axis.e.y * step },
			n: { x: f.axis.n.x * step, y: f.axis.n.y * step },
			u: { x: f.axis.u.x * step, y: f.axis.u.y * step },
			axis: f.axis,
			grow: f.grow
		};
	}

	/** The ground the operator is on. Falls back to the target, which collapses the
	 *  scene to a dive onto the building. */
	const standId = (s: Scene) => s.fromId ?? s.structureId;

	// ── The driver ───────────────────────────────────────────────────────────────
	// One loop shape for every timed beat: each supplies what to do with t, and the
	// loop owns the clock, the cancel and the promise — so a beat is a formula and
	// never a piece of scheduling. `sustain` is the untimed twin, for the stretch
	// where the camera has to stay alive while somebody else's animation plays.

	let cancel: (() => void) | null = null;
	let sustainRaf = 0;
	let release: (() => void) | null = null;
	/** The pose the scene was entered from, returned to on the way out. */
	let entryPose: CameraPose | null = null;
	/** The pose stood at once the eye is on the target. Held so the breath and the
	 *  exit both start from the shot rather than from a pose that stopped being
	 *  true a second and a half ago. */
	let aimPose: CameraPose | null = null;
	/** The framing the camera held before the scene, in world px. */
	let wide = 0;

	function drive(ms: number, onFrame: (t: number) => void): Promise<void> {
		return new Promise<void>((resolve) => {
			let raf = 0;
			let t0 = 0;
			const step = (now: number) => {
				if (!t0) t0 = now;
				elapsed = now - t0;
				const t = Math.min(1, elapsed / Math.max(1, ms));
				onFrame(t);
				if (t < 1) {
					raf = requestAnimationFrame(step);
				} else {
					cancel = null;
					resolve();
				}
			};
			raf = requestAnimationFrame(step);
			cancel = () => {
				cancelAnimationFrame(raf);
				cancel = null;
				resolve();
			};
		});
	}

	/**
	 * Keep the shot alive with no end in sight.
	 *
	 * The reason this exists rather than a long `drive`: the caller's whole point
	 * may be to run the board's own choreography underneath — squad, dice, verdict —
	 * and that takes as long as it takes. A seized camera with nothing writing to it
	 * is a freeze frame: the breath stops, and the reticle detaches from a building
	 * that is still drifting under it because the globe is still being drawn.
	 */
	function sustain() {
		stopSustain();
		const t0 = performance.now();
		const step = (now: number) => {
			const s = scene;
			if (!s || !mesh || !aimPose) return;
			elapsed = now - t0;
			mesh.setCameraPose(breathe(aimPose, elapsed));
			readMarks(s);
			frameOn(s.structureId, tightFor(s.structureId));
			sustainRaf = requestAnimationFrame(step);
		};
		sustainRaf = requestAnimationFrame(step);
	}

	function stopSustain() {
		if (sustainRaf) cancelAnimationFrame(sustainRaf);
		sustainRaf = 0;
	}

	/**
	 * The framing radius the camera is holding RIGHT NOW, in world px.
	 *
	 * The scene has to start from wherever the viewport actually is, and by the time
	 * a card resolves that is rarely the whole globe — selecting the target has
	 * usually already flown the camera down onto it. Starting at the sphere's radius
	 * would pop the frame all the way out on the first frame, which reads as a
	 * stutter before the shot.
	 *
	 * The camera cannot be asked, so this inverts what `fitRect` did to produce the
	 * scale it is holding: a square rect of radius R fitted into the clear rectangle
	 * gives `scale = min(availW, availH) / 2R`. Solving back for R is exact as long
	 * as the insets and padding match the ones `frameOn` passes — which is the only
	 * reason both are written out here rather than defaulted.
	 */
	function framingNow(): number {
		const whole = Math.max(1, (mesh?.globeSize() ?? 1) * 1.15);
		const k = camera?.transform.scale ?? 0;
		if (!k || !box.w || !box.h) return whole;
		const availW = Math.max(1, box.w - (insets?.left ?? 0) - (insets?.right ?? 0) - 16);
		const availH = Math.max(1, box.h - (insets?.top ?? 0) - (insets?.bottom ?? 0) - 16);
		return Math.min(availW, availH) / (2 * k);
	}

	/** Point the viewport at a canvas position at framing radius `R`.
	 *
	 *  `duration: 0` on purpose — this runs every frame, and a camera easing on its
	 *  own clock underneath a caller easing on theirs is the exact failure the
	 *  handover exists to avoid. */
	function frameOnPoint(x: number, y: number, R: number) {
		camera?.fitRect(
			{ minX: x - R, minY: y - R, maxX: x + R, maxY: y + R },
			{ padding: 8, insets, duration: 0 }
		);
	}

	function frameOn(id: string, R: number) {
		const at = mesh?.nodeScreen(id);
		if (at) frameOnPoint(at.x, at.y, R);
	}

	/** The resting frame for a body, recomputed per frame rather than fixed at the
	 *  start — the subject GROWS as the eye descends, by about six times between
	 *  rest and the surface. A tight radius chosen before the dive is a tight radius
	 *  around a building six times smaller than the one that ends up in the frame,
	 *  and the shot closes on its own left nostril. */
	function tightFor(id: string): number {
		const at = mesh?.nodeScreen(id);
		return Math.max(40, Math.min(wide, (at?.r ?? 40) * context));
	}

	/**
	 * Breath.
	 *
	 * A held first-person shot with a perfectly still camera is a photograph, and
	 * the eye works that out in about half a second. Two out-of-phase sines at a few
	 * thousandths of a radian are below the threshold of anything you could point at
	 * and above the threshold of dead — and putting them in the POSE rather than in
	 * a CSS transform on the overlay is what makes the world sway instead of the
	 * picture of it.
	 */
	function breathe(base: CameraPose, ms: number): CameraPose {
		return {
			yaw: base.yaw + Math.sin(ms / 1400) * 0.006,
			pitch: base.pitch + Math.sin(ms / 900 + 1.1) * 0.005,
			viewDistance: base.viewDistance
		};
	}

	const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

	// ── The scene ────────────────────────────────────────────────────────────────

	/** Establish, dive, turn. Resolves with the eye on the target and the shot held
	 *  open — the caller is then free to run whatever it likes underneath and call
	 *  `hold` or `leave` when it is done. */
	export async function enter(s: Scene): Promise<void> {
		if (!mesh || !camera) return;
		const on = standId(s);
		const meet = mesh.poseFacing(on, { tilt: meetTilt, distance: meetDistance });
		const stand = mesh.poseFacing(on, { tilt: eyeTilt, distance: SURFACE_DISTANCE });
		const aim = mesh.poseFacing(s.structureId, { tilt: eyeTilt, distance: SURFACE_DISTANCE });
		// No direction for one of those ids — off the globe, or it is the crest,
		// which is the centre of the sphere and faces every way at once. Nothing to
		// stand on and nowhere to look.
		if (!meet || !stand || !aim) return;

		cut();
		scene = s;
		release = mesh.seizeCamera();
		entryPose = mesh.cameraPose();
		aimPose = aim;
		wide = framingNow();
		readMarks(s);

		// ── Establish ────────────────────────────────────────────────────────────
		// `cameraApproach` rather than the dive's curve: this beat is an ARRIVAL and
		// wants to read as one — turn to them, then settle onto them. Framed wide of
		// the operator on purpose, because the fact being shown is that they are
		// standing somewhere on a board, not what their hat looks like.
		const from0 = entryPose;
		// Close enough that the operator is a figure rather than a dot, wide enough
		// that you can still see which building they are standing on — the shot has
		// to carry both facts or it is not establishing anything.
		const meetR = () => Math.min(wide, tightFor(on) * 1.7);
		phase = 'establish';
		await drive(establishMs, (t) => {
			p = t;
			mesh!.setCameraPose(cameraApproach(from0, meet, t));
			readMarks(s);
			frameOn(on, wide + (meetR() - wide) * ease(t));
		});
		if (phase !== 'establish') return;

		// ── Dive ─────────────────────────────────────────────────────────────────
		const midR = meetR();
		phase = 'dive';
		await drive(diveMs, (t) => {
			p = t;
			mesh!.setCameraPose(divePose(meet, stand, t));
			readMarks(s);
			frameOn(on, diveFraming(midR, tightFor(on), t));
		});
		if (phase !== 'dive') return;

		// ── Turn ─────────────────────────────────────────────────────────────────
		// Both poses are on the surface, so this is purely the eye coming round.
		// The framing centre is walked between the two bodies rather than cut to the
		// target: aimed at the target from the first frame it would be somewhere
		// off the edge of the world, and the viewport would lurch to find it.
		phase = 'turn';
		await drive(turnMs, (t) => {
			p = t;
			mesh!.setCameraPose(cameraLerp(stand, aim, t));
			readMarks(s);
			const a = mesh!.nodeScreen(on);
			const b = mesh!.nodeScreen(s.structureId);
			const k = ease(t);
			if (a && b) {
				frameOnPoint(
					a.x + (b.x - a.x) * k,
					a.y + (b.y - a.y) * k,
					tightFor(on) + (tightFor(s.structureId) - tightFor(on)) * k
				);
			}
		});
		if (phase !== 'turn') return;

		phase = 'hold';
		p = 0;
		sustain();
	}

	/** Stand there for `ms`. The shot is already alive — this is only a wait, which
	 *  is why a caller can equally ignore it and run its own timeline instead. */
	export async function hold(ms = holdMs): Promise<void> {
		if (phase !== 'hold') return;
		await new Promise<void>((r) => setTimeout(r, ms));
	}

	/** Pull back out to where the camera came from, and hand the globe back. */
	export async function leave(): Promise<void> {
		const s = scene;
		if (phase === 'idle' || !s || !mesh || !entryPose) return;
		stopSustain();
		const from = mesh.cameraPose();
		const back = entryPose;
		const tight = tightFor(s.structureId);
		phase = 'rise';
		await drive(riseMs, (t) => {
			p = t;
			mesh!.setCameraPose(cameraLerp(from, back, t));
			readMarks(s);
			// The framing runs the dive backwards: `diveFraming` is pinned at both
			// ends, so 1−t walks it out along the same curve it came in on. Reusing it
			// means the exit cannot develop a character the entrance does not have.
			frameOn(s.structureId, diveFraming(wide, tight, 1 - t));
		});
		finish();
	}

	/** The whole beat, for a caller with nothing to play underneath. */
	export async function play(s: Scene, ms = holdMs): Promise<void> {
		await enter(s);
		await hold(ms);
		await leave();
	}

	/** Bail out. Leaves the camera where it stands and gives the globe back — a
	 *  scene interrupted by a new match must not hold the camera hostage. */
	export function cut(): void {
		stopSustain();
		cancel?.();
		finish();
	}

	function finish(): void {
		stopSustain();
		release?.();
		release = null;
		entryPose = null;
		aimPose = null;
		phase = 'idle';
		scene = null;
		mark = null;
		opMark = null;
		p = 0;
	}

	$effect(() => () => cut());

	// ── Drawing ──────────────────────────────────────────────────────────────────

	const live = $derived(phase !== 'idle' && !!scene);

	/** How far into the WHOLE gesture we are, for the things that ramp across every
	 *  beat (the visor, the tunnel) rather than within one. The establishing shot is
	 *  deliberately only half-lit: it is still a shot of the board, and dressing it
	 *  as a helmet before anybody is inside the helmet is a lie about where you are. */
	const depth = $derived(
		phase === 'establish' ? p * 0.5 : phase === 'rise' ? 1 - p : phase === 'idle' ? 0 : 1
	);

	/** Whatever the shot is ABOUT right now — the operator while we are going to
	 *  them, the target once we are behind their eyes. */
	const focus = $derived(
		phase === 'establish' || phase === 'dive' ? (opMark ?? mark) : mark
	);

	/** Speed, not distance — the streaks are the DERIVATIVE of the dive, so they are
	 *  nothing while it hangs and everything while it rushes. Drawing them off
	 *  progress instead makes the fastest part of the move the calmest thing on
	 *  screen. */
	const rush = $derived(
		phase === 'dive' ? Math.max(0, Math.min(1, Math.pow(p, 2) * 3.4 * (1 - p * 0.55))) : 0
	);

	/** The body you are flying into: enormous, and gone by the time you are in it. */
	const bodyIn = $derived(phase === 'dive' && p > 0.3 ? Math.min(1, (p - 0.3) / 0.52) : 0);

	/** The operator standing on the board, before you are them. Full through the
	 *  establishing shot, then out over the first third of the dive — by the time
	 *  the pass-through silhouette takes over, the marker has gone. */
	const opIn = $derived(
		phase === 'establish' ? Math.min(1, p / 0.35) : phase === 'dive' ? Math.max(0, 1 - p / 0.34) : 0
	);

	/** The reticle acquires during the turn rather than being there when you land —
	 *  a lock that is already on before the eye has come round has not locked onto
	 *  anything. */
	const aimIn = $derived(
		phase === 'turn' ? Math.max(0, (p - 0.35) / 0.65) : phase === 'hold' ? 1 : phase === 'rise' ? 1 - p : 0
	);

	/** The body you are in. Arrives on the turn — you cannot see your own shoulders
	 *  while you are still travelling. */
	const selfIn = $derived(
		phase === 'turn' ? Math.min(1, p / 0.5) : phase === 'hold' ? 1 : phase === 'rise' ? 1 - p : 0
	);

	/** Reticle size, clamped at both ends. At the surface the perspective divide
	 *  makes a building's drawn box enormous, and brackets sized off it would be
	 *  four lines somewhere past the corners of the screen. Derived rather than
	 *  inlined because the label above the reticle sits on the same circle. */
	const reticleR = $derived(
		Math.max(34, Math.min(Math.min(box.w, box.h) * 0.42, (mark?.r ?? 0) * 1.35))
	);

	const build = $derived(UNIT_BUILD[scene?.shape ?? 'runner']);
	const model = $derived(CHARACTERS[scene?.shape ?? 'runner']);

	/** The body you pass THROUGH, seen head-on and drawn flat.
	 *
	 *  Head-on and unshaded on purpose: at the moment you enter somebody you are
	 *  close enough that no face of them is legible as a face, and a shaded model
	 *  scaled to twice the viewport reads as a wall with panels on it. A
	 *  silhouette reads as a person. Slight yaw so the head still overlaps the
	 *  shoulders rather than sitting on a symmetrical T. */
	const passFrame = $derived(studioFrame(0.22, 0.1, 1));

	/** Twenty-eight streaks on a fixed ring of angles, jittered per index. Fixed so
	 *  they do not shimmer between frames — random per frame is static, not speed. */
	const STREAKS = Array.from({ length: 28 }, (_, i) => ({
		a: (i / 28) * Math.PI * 2 + (i % 3) * 0.11,
		k: 0.55 + ((i * 7) % 10) / 14
	}));
</script>

<div
	bind:this={host}
	bind:clientWidth={box.w}
	bind:clientHeight={box.h}
	class="absolute inset-0 z-[40] overflow-hidden"
	style:pointer-events="none"
	style:opacity={live ? 1 : 0}
	aria-hidden="true"
>
	{#if live && scene}
		{@const hue = scene.hue}
		{@const cx = focus?.x ?? box.w / 2}
		{@const cy = focus?.y ?? box.h / 2}

		<!-- ── The tunnel ──────────────────────────────────────────────────────
		     A radial darkening centred on the SUBJECT, not on the viewport. That
		     difference is most of why the dive reads as going somewhere: the black
		     closes in around the thing you are travelling at, so the frame narrows
		     onto it rather than the picture merely getting darker. -->
		<div
			class="absolute inset-0"
			style:background="radial-gradient(circle at {cx}px {cy}px, transparent {8 +
				(1 - depth) * 60}%, rgba(3,6,12,{0.82 * depth}) 128%)"
		></div>

		<svg
			class="absolute inset-0 h-full w-full"
			viewBox="0 0 {box.w} {box.h}"
			preserveAspectRatio="none"
		>
			<!-- ── The operator ────────────────────────────────────────────────
			     Somebody standing on the board, before you are them. A ring on the
			     ground, the silhouette on top of it, and their callsign — the three
			     things that turn a piece into a person you are about to be handed.

			     Drawn ABOVE the anchor rather than on it, because the anchor is the
			     centre of a building's drawn box and a figure centred on a building
			     is inside it. -->
			{#if opIn > 0 && opMark}
				{@const ox = opMark.x}
				{@const oy = opMark.y - opMark.r * 0.35}
				<!-- The node's measured box is its whole drawn footprint — caption,
				     condition plate and all — so it is a poor stand-in for how big the
				     BUILDING is. Half of it, clamped, is a marker that stays a marker
				     from the establishing shot right through to the surface. -->
				{@const ring = Math.max(24, Math.min(120, opMark.r * 0.55))}
				{@const lead = ring * 0.9 + 18}
				<!-- The figure's own frame and where it stands. Hoisted here rather
				     than kept beside the drawing, because `{@const}` may only be the
				     immediate child of a block — and the three of them are the whole
				     placement, so they read as a unit anyway. -->
				{@const gy = opMark.y - opMark.r * 0.35 + ring * 0.5}
				{@const cf = faceViewer(
					atStep(opFrame ?? studioFrame(0, 0.3, 1), Math.max(10, ring * 0.6))
				)}
				{@const stand = {
					x: opMark.x + cf.e.x * 1.5,
					y: gy + cf.e.y * 1.5
				}}
				<g opacity={opIn}>
					<!-- Ground ring, under the OPERATOR rather than under the building.
					     It is their marker, and a marker beside the thing it marks is
					     just another circle on the board. With a second one sweeping in
					     — a static circle reads as decoration, one that closes reads as
					     a selection being made. -->
					<ellipse
						cx={stand.x}
						cy={stand.y}
						rx={ring * 0.62}
						ry={ring * 0.21}
						fill="none"
						stroke={hue}
						stroke-width="1.6"
						opacity="0.55"
					/>
					<ellipse
						cx={stand.x}
						cy={stand.y}
						rx={ring * 0.62 * (2.4 - opIn * 1.4)}
						ry={ring * 0.21 * (2.4 - opIn * 1.4)}
						fill="none"
						stroke={hue}
						stroke-width="2.2"
						opacity={0.7 * (1 - opIn)}
					/>
					<!-- ── The operator, as a solid ────────────────────────────
					     A real piece, in the node's own tangent frame — so this figure
					     is lit by the same key light as the building behind it, leans
					     the same way its ground does, and turns with the globe. Drawn
					     in its own projection it would be a sticker, and the eye reads
					     that before it reads any geometry.

					     Stood BESIDE the building rather than on its roof: the frame's
					     east axis is the direction "to the right along the ground", so
					     one node radius that way is the next plot over. -->
					<!-- Contact shadow first, so the feet land on it rather than in it.
					     The cheapest thing there is for stopping a solid floating. -->
					<ellipse
						cx={stand.x}
						cy={stand.y}
						rx={Math.max(6, ring * 0.28)}
						ry={Math.max(2, ring * 0.1)}
						fill="rgba(0,0,0,0.5)"
					/>
					<!-- One sorted list, two materials. The visor is lit rather than
					     shaded — it is the only feature on the model, so it is the only
					     thing that gets to ignore the key light. -->
					<g transform="translate({stand.x} {stand.y})">
						{#each characterFacets(model, cf) as f, i (i)}
							<path
								d={f.d}
								fill={f.lit ? '#FFFFFF' : hue}
								fill-opacity={f.lit ? 0.55 + f.shade * 0.45 : 0.26 + f.shade * 0.62}
								stroke={f.lit ? 'none' : hue}
								stroke-width="0.7"
								stroke-opacity="0.5"
							/>
						{/each}
					</g>
					<!-- Callsign on a leader line, off to the side of the body. The
					     leader is measured from the RING rather than scaled with it, so
					     a marker on a near building does not fling its own label into
					     the far corner of the screen. -->
					<line
						x1={stand.x + ring * 0.35}
						y1={stand.y - ring * 0.7}
						x2={stand.x + lead}
						y2={stand.y - ring * 1.25}
						stroke={hue}
						stroke-width="1"
						opacity="0.7"
					/>
					<text
						x={stand.x + lead + 6}
						y={stand.y - ring * 1.25}
						fill={hue}
						font-size="11"
						font-family="ui-monospace, monospace"
						font-weight="700"
						letter-spacing="1.6"
						dominant-baseline="middle">{scene.seat} · {scene.actor.toUpperCase()}</text
					>
					<text
						x={stand.x + lead + 6}
						y={stand.y - ring * 1.25 + 14}
						fill={hue}
						opacity="0.6"
						font-size="9"
						font-family="ui-monospace, monospace"
						letter-spacing="1.4"
						dominant-baseline="middle"
						>{scene.origin ? `holding ${scene.origin}` : 'taking control'}</text
					>
				</g>
			{/if}

			<!-- ── Speed ───────────────────────────────────────────────────────
			     Streaks pointing OUT of the body and past the eye. They are drawn
			     from a radius that shrinks as you close, so at the end they are
			     sweeping past your ears rather than converging on a point in the
			     distance — which is the difference between travelling and zooming. -->
			{#if rush > 0.01}
				{@const reach = Math.max(box.w, box.h)}
				{#each STREAKS as s (s.a)}
					{@const near = reach * (0.12 + (1 - rush) * 0.5) * s.k}
					{@const far = near + reach * 0.55 * rush * s.k}
					<line
						x1={cx + Math.cos(s.a) * near}
						y1={cy + Math.sin(s.a) * near}
						x2={cx + Math.cos(s.a) * far}
						y2={cy + Math.sin(s.a) * far}
						stroke={hue}
						stroke-width={1 + rush * 2.4}
						stroke-linecap="round"
						opacity={0.5 * rush}
					/>
				{/each}
			{/if}

			<!-- ── Through them ────────────────────────────────────────────────
			     The silhouette scaling up past the camera and fading as you pass
			     through it. This is the frame that says the dive ended in a person
			     rather than at a place, so it is worth the twelve lines. -->
			{#if bodyIn > 0 && bodyIn < 1}
				{@const k = 20 + Math.pow(bodyIn, 2.2) * 1100}
				<g
					transform="translate({cx} {cy + k * 0.75})"
					opacity={0.6 * (1 - bodyIn)}
				>
					{#each characterFacets(model, atStep(passFrame, k)) as f, i (i)}
						<path d={f.d} fill={f.lit ? '#FFFFFF' : hue} />
					{/each}
				</g>
			{/if}

			<!-- ── Standing in it ──────────────────────────────────────────────
			     Your own shoulders and arms at the bottom of the frame, and the
			     reticle on what you are looking at. Nothing here moves on a timer —
			     the body rides the same breath the camera does, one frame behind it,
			     which is what stops it reading as a sticker on the lens. -->
			{#if selfIn > 0}
				{@const sway = Math.sin(elapsed / 900) * box.w * 0.006}
				{@const bob = Math.sin(elapsed / 1400) * box.h * 0.008}
				{@const sw = box.w * build.shoulder}
				{@const top = box.h * 0.82}

				<!-- Read as a RIM, not as a mass. The fill is nearly black by design —
				     it is a silhouette against a night horizon, and any lighter and it
				     stops being one — which means the whole of the shape has to be
				     carried by the lit edge. That is also what a real backlit shoulder
				     does, so the cheap answer and the honest one are the same answer.

				     Two strokes, not one: a wide dim halo under a thin bright line. A
				     single stroke at any weight reads as an outline drawn around a
				     hole; the pair reads as light landing on something. -->
				<g opacity={selfIn} transform="translate({sway} {bob + (1 - selfIn) * box.h * 0.34})">
					{#each [
						{ w: 7, o: 0.16 },
						{ w: 1.6, o: 0.85 }
					] as edge (edge.w)}
						<path
							d="M {box.w * 0.5 - sw} {box.h * 1.08}
							   C {box.w * 0.5 - sw * 0.94} {top + box.h * 0.05},
							     {box.w * 0.5 - sw * 0.52} {top},
							     {box.w * 0.5} {top}
							   C {box.w * 0.5 + sw * 0.52} {top},
							     {box.w * 0.5 + sw * 0.94} {top + box.h * 0.05},
							     {box.w * 0.5 + sw} {box.h * 1.08} Z"
							fill={edge.w > 5 ? 'rgba(3,5,11,0.97)' : 'none'}
							stroke={hue}
							stroke-width={edge.w}
							stroke-opacity={edge.o}
						/>
					{/each}
					<!-- Forearms, angled in from the lower corners. Two tapered quads,
					     and they do more for "there is a person here" than the shoulders
					     do — a shoulder line on its own is a hill. -->
					{#each [-1, 1] as side (side)}
						{@const arm = box.w * build.arm}
						<path
							d="M {box.w * (0.5 + side * 0.58)} {box.h * 1.1}
							   L {box.w * (0.5 + side * 0.58) - side * arm * 1.5} {box.h * 1.1}
							   L {box.w * (0.5 + side * 0.26) - side * arm} {box.h * 0.79}
							   L {box.w * (0.5 + side * 0.26) + side * arm * 0.4} {box.h * 0.81} Z"
							fill="rgba(3,5,11,0.97)"
							stroke={hue}
							stroke-width="1.4"
							stroke-opacity="0.6"
						/>
					{/each}
				</g>
			{/if}

			<!-- Reticle, locked to the live box of the building. It tracks the breath
			     because it is reading the drawn node, not a remembered position — the
			     same reason BoardFx re-reads every frame. -->
			{#if aimIn > 0 && mark}
				{@const R = reticleR}
				{@const spread = 1 + (1 - aimIn) * 0.5}
				<g opacity={0.9 * aimIn}>
					{#each [
						[-1, -1],
						[1, -1],
						[-1, 1],
						[1, 1]
					] as [sx, sy] (`${sx}${sy}`)}
						<path
							d="M {mark.x + sx * R * spread} {mark.y + sy * R * spread * 0.62}
							   L {mark.x + sx * R * spread} {mark.y + sy * R * spread}
							   L {mark.x + sx * R * spread * 0.62} {mark.y + sy * R * spread}"
							fill="none"
							stroke={hue}
							stroke-width="2"
						/>
					{/each}
					<circle
						cx={mark.x}
						cy={mark.y}
						r={R * 0.16}
						fill="none"
						stroke={hue}
						stroke-width="1"
						opacity="0.7"
					/>
					<line
						x1={mark.x - R * 0.3}
						y1={mark.y}
						x2={mark.x - R * 0.06}
						y2={mark.y}
						stroke={hue}
						stroke-width="1"
					/>
					<line
						x1={mark.x + R * 0.06}
						y1={mark.y}
						x2={mark.x + R * 0.3}
						y2={mark.y}
						stroke={hue}
						stroke-width="1"
					/>
				</g>
			{/if}
		</svg>

		<!-- ── Visor ───────────────────────────────────────────────────────────
		     A frame with corner brackets and a scan wash. Kept in DOM rather than
		     SVG so it costs nothing to animate — four borders and a gradient, all of
		     which the compositor can carry. -->
		<div
			class="absolute inset-2 rounded-lg"
			style:opacity={depth}
			style:box-shadow="inset 0 0 0 1px color-mix(in srgb, {hue} 30%, transparent),
			                  inset 0 0 90px color-mix(in srgb, {hue} 12%, transparent)"
		></div>
		{#each [
			['top-3 left-3', 'border-t-2 border-l-2'],
			['top-3 right-3', 'border-t-2 border-r-2'],
			['bottom-3 left-3', 'border-b-2 border-l-2'],
			['bottom-3 right-3', 'border-b-2 border-r-2']
		] as [pos, edge] (pos)}
			<div
				class="absolute h-5 w-5 {pos} {edge}"
				style:border-color={hue}
				style:opacity={0.75 * depth}
			></div>
		{/each}

		<!-- ── What you are ────────────────────────────────────────────────────
		     The seat top-left, the card bottom-centre. The label says what the shot
		     currently IS, because the same overlay is used for watching somebody and
		     for being them, and those are different claims. -->
		<div class="absolute left-5 top-5 flex flex-col gap-0.5 font-mono" style:opacity={depth * 2}>
			<span class="text-[0.52rem] font-bold uppercase tracking-[0.2em]" style:color={hue}>
				{scene.seat} · {phase === 'establish' ? 'operator' : phase === 'dive' ? 'taking control' : 'pov'}
			</span>
			<span class="text-[0.8rem] font-semibold" style:color="var(--fg)">{scene.actor}</span>
		</div>

		{#if mark && aimIn > 0}
			<div
				class="absolute font-mono text-[0.56rem] font-bold uppercase tracking-[0.16em] whitespace-nowrap"
				style:left="{mark.x}px"
				style:top="{mark.y - reticleR - 16}px"
				style:transform="translateX(-50%)"
				style:color={hue}
				style:opacity={aimIn}
			>
				{scene.subject}
			</div>
		{/if}

		<div
			class="absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 font-mono"
			style:opacity={depth}
		>
			<span class="text-[0.58rem] font-bold uppercase tracking-[0.22em]" style:color={hue}
				>{scene.word}</span
			>
			<span
				class="rounded border px-2 py-0.5 text-[0.62rem] font-semibold tracking-wide"
				style:color={hue}
				style:border-color="color-mix(in srgb, {hue} 45%, transparent)"
				style:background="color-mix(in srgb, {hue} 10%, transparent)">{scene.card}</span
			>
		</div>
	{/if}
</div>
