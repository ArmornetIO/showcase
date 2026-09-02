<script lang="ts">
	// ── SPARK FIELD ──────────────────────────────────────────────────────────
	//
	// The assembly beat as a firework run backwards: sparks come in from off
	// frame, converge on the mark, and detonate on the point they were aimed at.
	//
	// THE IDEA is `CurrentField`'s, lifted wholesale — the canvas is never
	// cleared, only faded by a sub-alpha `destination-out` pass, so what you see
	// is the HISTORY of the motion rather than the motion itself. That is the
	// entire reason these read as comets instead of as dots. What differs is the
	// motion under it: a flow field wanders, this converges.
	//
	// The simulation is in `sparks.ts` and is a pure function of `t`, including
	// both endpoints of every stroke. So the caller may SCRUB `t` backwards and
	// the field is still exact — the only thing that has to be thrown away is
	// the painted trail history, which a hard clear handles.
	//
	// The mitigations `CurrentField` made conditions of spending CPU per frame
	// apply here too and are implemented, not deferred: DPR ceiling,
	// IntersectionObserver + visibilitychange stopping the loop outright,
	// reduced-motion rendering a still and never starting a loop.

	import {
		buildSparks,
		burstSeg,
		flashAt,
		makeSeg,
		mixRGB,
		parseRGB,
		rgba,
		sparkIdle,
		sparkSeg,
		type RGB,
		type SparkTarget
	} from './sparks.js';

	interface Props {
		/** Layer size in px; the layer is square and maps the chrome box the way
		 *  `ArmornetCrestChrome` does, so box coords line up with the scene. */
		size: number;
		/** ms into the assembly beat. Negative renders nothing. */
		t: number;
		/** Seats, in chrome-box coords, and when each should be arrived at. */
		targets: SparkTarget[];
		/** Overrides the `--accent` token. */
		accent?: string;
		/** Sparks per target. Left off, the field fills toward a frame density
		 *  rather than inheriting however finely the caller tiled the mark. */
		repeat?: number;
		/** Run-up length in box units — see `BuildOpts.reach`. */
		reach?: number;
		/**
		 * How much of the old trail is erased each frame. 0.22 is the tuned value:
		 * lower and the comets stretch until they read as static beams, higher and
		 * they shorten into dashes with a visible head.
		 */
		decay?: number;
		maxDpr?: number;
		/** Px to lift the field by, so it is centred on the same point as the mark
		 *  it is building rather than on the artboard. */
		offsetY?: number;
	}
	let {
		size,
		t,
		targets,
		accent = '',
		repeat,
		reach,
		decay = 0.22,
		maxDpr = 1.5,
		offsetY = 0
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let host = $state<HTMLDivElement | null>(null);

	const sparks = $derived(buildSparks(targets, { repeat, reach }));

	/**
	 * Everything the loop reads, mirrored into a PLAIN object.
	 *
	 * Same reason as `CurrentField`: if the draw loop read the props reactively,
	 * every one of them — including `t`, which changes 60 times a second —
	 * would be a dependency of the `$effect` that owns the canvas, and the
	 * canvas would be torn down and re-created on every frame. Tearing it down
	 * clears the trails, and the trails are the entire image.
	 */
	// Capturing the initial values is the POINT; the effect below keeps them
	// current and the reactive read is the thing being avoided.
	// svelte-ignore state_referenced_locally
	const live = { size, t, accent, decay, sparks };
	$effect(() => {
		live.size = size;
		live.t = t;
		live.accent = accent;
		live.decay = decay;
		live.sparks = sparks;
	});

	const WHITE: RGB = [255, 255, 255];
	/** The minority ember tone. Warm and pale against the teal so a few hundred
	 *  identical strokes stop reading as one object. */
	const EMBER: RGB = [255, 206, 152];

	$effect(() => {
		const el = canvas;
		const box = host;
		if (!el || !box) return;

		// Transparent, deliberately: this layer stacks over the plates and the
		// chrome mark. That also means the decay pass has to ERASE rather than
		// paint the ground over the trails — see the `destination-out` below.
		const ctx = el.getContext('2d', { alpha: true });
		if (!ctx) return;

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

		// The tokens are read through the canvas API, where there is no cascade to
		// fall back through — an unresolved custom property would mean strokes
		// with no colour rather than an inherited one, so the literals stay.
		const style = getComputedStyle(box);
		let teal: RGB = [94, 234, 212];
		let hot: RGB = [122, 240, 216];
		function readColors() {
			teal = parseRGB(live.accent || style.getPropertyValue('--accent'), [94, 234, 212]);
			hot = parseRGB(style.getPropertyValue('--accent-bright'), [122, 240, 216]);
		}
		readColors();

		// The chrome box mapping, once. `ArmornetCrestChrome` uses viewBox
		// "0 0 200 220" with xMidYMid meet in a square, so the scale is set by the
		// TALLER axis and the box is centred horizontally; baking it into the
		// canvas transform lets every draw below stay in box coords.
		let scale = 1;
		let offX = 0;
		function resize() {
			const px = Math.max(1, Math.round(live.size));
			scale = px / 220;
			offX = (px * (1 - 200 / 220)) / 2;
			el!.width = Math.round(px * dpr);
			el!.height = Math.round(px * dpr);
			ctx!.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, 0);
			// Butt caps, not round: consecutive frames of a trail meet end to end,
			// and round caps overlap there — which under `lighter` beads the streak
			// at every frame boundary and makes a comet look like a dashed line.
			ctx!.lineCap = 'butt';
		}

		// In box units: the canvas is 220 tall by construction, and 220 wide too,
		// which reaches 10 units past the box on each side.
		const CLEAR = { x: -10, y: 0, w: 220, h: 220 };
		function hardClear() {
			ctx!.save();
			ctx!.setTransform(1, 0, 0, 1, 0, 0);
			ctx!.clearRect(0, 0, el!.width, el!.height);
			ctx!.restore();
		}

		const seg = makeSeg();

		function stroke(base: RGB, gain: number) {
			ctx!.strokeStyle = rgba(mixRGB(base, WHITE, seg.heat), seg.a * gain);
			ctx!.lineWidth = seg.w;
			ctx!.beginPath();
			ctx!.moveTo(seg.x0, seg.y0);
			ctx!.lineTo(seg.x1, seg.y1);
			ctx!.stroke();
		}

		function fade() {
			ctx!.globalCompositeOperation = 'destination-out';
			ctx!.fillStyle = '#000';
			ctx!.globalAlpha = live.decay;
			ctx!.fillRect(CLEAR.x, CLEAR.y, CLEAR.w, CLEAR.h);
			ctx!.globalAlpha = 1;
			ctx!.globalCompositeOperation = 'source-over';
		}

		function render(now: number, dt: number) {
			fade();

			// Additive from here down. Sparks crossing each other should blow out
			// toward white the way real ones do, and it costs nothing.
			ctx!.globalCompositeOperation = 'lighter';

			for (const s of live.sparks) {
				if (sparkIdle(s, now)) continue;
				const base = s.warm ? EMBER : teal;

				if (sparkSeg(s, now, dt, seg)) stroke(base, 1);

				const f = flashAt(s, now);
				if (f > 0) {
					for (let k = 0; k < s.kids; k++) {
						if (burstSeg(s, k, now, dt, seg)) stroke(base, 0.9);
					}
					// Two flat discs under `lighter` instead of a radial gradient —
					// a per-spark gradient object every frame is the one allocation
					// in this loop that would actually show up in a profile.
					//
					// Both radii collapse with the flash. A disc that only dims is a
					// bead fading out; one that shrinks as it dims is a flash, and
					// with several hundred seats that is the difference between a
					// firework and a string of fairy lights.
					ctx!.fillStyle = rgba(mixRGB(base, WHITE, 0.35), 0.1 * f);
					ctx!.beginPath();
					ctx!.arc(s.tx, s.ty, 0.8 + 2.8 * f, 0, Math.PI * 2);
					ctx!.fill();
					ctx!.fillStyle = rgba(mixRGB(hot, WHITE, 0.7 * f), 0.9 * f);
					ctx!.beginPath();
					ctx!.arc(s.tx, s.ty, 0.3 + 0.75 * f, 0, Math.PI * 2);
					ctx!.fill();
				}
			}
			ctx!.globalCompositeOperation = 'source-over';
		}

		resize();
		hardClear();

		let lastT = Number.NaN;
		let lastSize = live.size;
		let frame = 0;

		function step() {
			if (live.size !== lastSize) {
				lastSize = live.size;
				resize();
				hardClear();
				lastT = Number.NaN;
			}
			if (frame++ % 30 === 0) readColors();

			const now = live.t;
			if (now < 0) {
				// Before the beat, and after a rewind past it: nothing to show, and
				// the old trails must not survive into the next run.
				if (!Number.isNaN(lastT)) hardClear();
				lastT = Number.NaN;
				return;
			}
			if (Number.isNaN(lastT) || now < lastT) {
				// A scrub backwards. The sim is exact at any `t`, but the painted
				// history is not — throw it away and start the streaks again.
				hardClear();
				lastT = now - 16;
			}
			const dt = Math.min(32, now - lastT);
			lastT = now;
			if (dt <= 0) {
				// A held frame stays held: fading with no motion would eat the
				// trails and leave a paused scrub looking like a field of dots. The
				// exception is a `t` parked past the last arrival — keeping that
				// frozen would leave the whole flight painted on screen forever.
				if (live.sparks.every((s) => sparkIdle(s, now))) fade();
				return;
			}
			render(now, dt);
		}

		if (reduced) {
			// Headless: lay the streaks down over a slice of the beat ending at the
			// median arrival, then stop. A still firework at zero ongoing cost.
			const arr = live.sparks.map((s) => s.arrive).sort((a, b) => a - b);
			const mid = arr.length ? arr[arr.length >> 1] : 0;
			for (let i = 40; i > 0; i--) render(Math.max(0, mid - i * 16), 16);
			return;
		}

		let raf = 0;
		let running = false;
		function loop() {
			raf = requestAnimationFrame(loop);
			step();
		}
		function start() {
			if (running) return;
			running = true;
			raf = requestAnimationFrame(loop);
		}
		function stop() {
			running = false;
			cancelAnimationFrame(raf);
		}

		// Off-screen or backgrounded means genuinely stopped, not throttled.
		const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), {
			threshold: 0
		});
		io.observe(box);
		const onVis = () => (document.hidden ? stop() : start());
		document.addEventListener('visibilitychange', onVis);

		return () => {
			stop();
			io.disconnect();
			document.removeEventListener('visibilitychange', onVis);
		};
	});
</script>

<div
	class="sparks"
	bind:this={host}
	style:--dy="{offsetY}px"
	style:width="{size}px"
	style:height="{size}px"
	aria-hidden="true"
>
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	/* Centred on its positioned ancestor by transform, NOT by `inset: 0` plus
	   auto margins. Those centre correctly only while the ancestor is at least as
	   big as the field: once the remaining space goes negative the auto margins
	   resolve to zero and the whole field jumps half its width to the right,
	   which is exactly what a demo box smaller than `size` produces. Same
	   convention as every other layer in `brand/` — each one centres itself on
	   the frame it is given, whatever size that frame is. */
	.sparks {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%) translateY(calc(-1 * var(--dy, 0px)));
		pointer-events: none;
	}

	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
</style>
