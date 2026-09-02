<script lang="ts">
	// ── CURRENT FIELD ────────────────────────────────────────────────────────
	//
	// Something is flowing across the dark — ink in water, or traffic seen from
	// very far above — and it never quite repeats.
	//
	// THE IDEA: trails, not particles. The entire difference between this and
	// every `particles.js` starfield is the sub-alpha `fillRect` decay: the
	// image is the HISTORY of the motion rather than the motion itself, so at
	// any instant it looks like a drawing someone made. Second decision — the
	// noise takes time as a third axis, so the current itself changes direction
	// over minutes and the composition never becomes familiar.
	//
	// CHAOS AND SMOOTHNESS ARE SEPARATE KNOBS, which is the thing worth knowing
	// before touching this. Smoothness is the noise: value noise through a
	// quintic smoothstep has a continuous second derivative, so no setting of
	// anything below can put a corner in a trail. Chaos is `turn` — how much
	// angular range that smooth field is stretched across. Crank `turn` and the
	// same gentle noise folds through itself until neighbouring particles run
	// opposite ways; the flow becomes turbulent while every individual path
	// stays a curve. Reach for `turn` first, and leave `speed` alone: speed
	// makes it hectic, which is a different thing and always looks worse.
	//
	// This is the only backdrop in the family that spends CPU every frame, and
	// the scope that proposed it made these mitigations conditions of building
	// it at all. They are implemented here, not deferred:
	//
	//   · DPR capped — soft ink, nobody can tell, and it quarters the fill cost.
	//   · 30fps by skipping alternate ticks. Flow is slow; 30 is invisible.
	//   · IntersectionObserver + visibilitychange stop the loop entirely when
	//     off-screen or backgrounded. A hidden tab burning a rAF loop is how a
	//     laptop fan spins.
	//   · prefers-reduced-motion runs the sim headless then freezes — a still
	//     ink drawing at zero ongoing cost.

	import { fbm } from './noise.js';

	interface Props {
		/** Particle count. 220 is the tuned default; past ~400 it muddies. */
		density?: number;
		/** Pixels a particle walks per step. */
		speed?: number;
		/**
		 * How much old ink is erased each step. 0.035 is the tuned value: lower
		 * and trails smear forever, higher and they read as dashes.
		 */
		decay?: number;
		/**
		 * Spatial frequency of the field. LOWER IS BIGGER: the swirls grow and a
		 * particle stays inside one for longer, which is what reads as a current
		 * rather than as jitter. Past ~0.003 the cells are smaller than a trail is
		 * long and the ink turns to fuzz.
		 */
		swirl?: number;
		/** How fast the field itself rewrites. The current changes direction over
		 *  minutes at this rate; it is what stops the image settling. */
		churn?: number;
		/**
		 * Angular range, in multiples of π. This is the chaos knob. At 2 the field
		 * is one broad drift with everything travelling roughly together; raising
		 * it makes the same smooth noise fold back through itself, so neighbouring
		 * particles diverge and the flow builds eddies — turbulent without ever
		 * being jagged, because the underlying noise is unchanged.
		 */
		turn?: number;
		/** Device pixel ratio ceiling. */
		maxDpr?: number;
	}
	let {
		density = 220,
		speed = 0.9,
		decay = 0.035,
		swirl = 0.0011,
		churn = 0.00012,
		turn = 6,
		maxDpr = 1.5
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let host = $state<HTMLDivElement | null>(null);

	/**
	 * The tunable values, mirrored into a PLAIN object the simulation reads.
	 *
	 * Deliberately not reactive. If the loop read the props directly, every
	 * knob would be a dependency of the `$effect` that owns the canvas, and
	 * dragging a slider would tear down and re-seed the field on each frame —
	 * clearing the trails, which are the entire image. Mirroring lets a knob
	 * take effect on the very next step without disturbing what is on screen.
	 */
	// Capturing the initial values is the POINT — the effect below keeps them
	// current, and reading the props reactively is the thing being avoided.
	// svelte-ignore state_referenced_locally
	const live = { density, speed, decay, swirl, churn, turn };
	$effect(() => {
		live.density = density;
		live.speed = speed;
		live.decay = decay;
		live.swirl = swirl;
		live.churn = churn;
		live.turn = turn;
	});

	interface P {
		x: number;
		y: number;
		px: number;
		py: number;
		life: number;
		accent: boolean;
	}

	$effect(() => {
		const el = canvas;
		const box = host;
		if (!el || !box) return;

		// TRANSPARENT, deliberately. This used to be `{ alpha: false }` with the
		// decay pass painting the ground colour over the whole canvas — cheaper,
		// and fine while a backdrop was the only thing on screen. It cannot be
		// stacked: an opaque canvas hides every layer beneath it, and forcing
		// `--backdrop-ground: transparent` (how the other four families stack)
		// would leave this one with nothing to fade its trails WITH, so the ink
		// would never decay at all. The ground is painted by `.field`'s CSS
		// background either way, so nothing is lost visually.
		const ctx = el.getContext('2d', { alpha: true });
		if (!ctx) return;

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		// Re-read periodically rather than once at mount. These are CSS custom
		// properties, so nothing notifies us when a theme swaps or a studio knob
		// moves; reading them every step would force a style recalculation on
		// every frame. Every 15 steps is half a second at the 30fps this runs at
		// — live enough to drag a colour slider against, and 1/15th the cost.
		const style = getComputedStyle(box);
		let ink = 'rgba(126,150,142,0.5)';
		let accent = 'rgba(94,234,212,0.55)';
		function readColors() {
			// The literals stay: these are read through the CANVAS API, not CSS, so
			// there is no cascade to fall back through and an unresolved token would
			// mean strokes with no colour at all rather than an inherited one.
			ink = style.getPropertyValue('--field-ink').trim() || 'rgba(126,150,142,0.5)';
			accent = style.getPropertyValue('--field-accent').trim() || 'rgba(94,234,212,0.55)';
		}
		readColors();

		let w = 0;
		let h = 0;
		const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

		function resize() {
			const r = box!.getBoundingClientRect();
			w = Math.max(1, Math.round(r.width));
			h = Math.max(1, Math.round(r.height));
			el!.width = Math.round(w * dpr);
			el!.height = Math.round(h * dpr);
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			// A hard clear on resize, or the old trails stretch across the new box.
			ctx!.clearRect(0, 0, w, h);
		}
		resize();

		const spawn = (): P => {
			const x = Math.random() * w;
			const y = Math.random() * h;
			return { x, y, px: x, py: y, life: 60 + Math.random() * 240, accent: Math.random() < 0.12 };
		};
		const cap = (n: number) => Math.max(1, Math.min(400, Math.round(n)));
		const parts: P[] = Array.from({ length: cap(live.density) }, spawn);

		let t = 0;
		function step() {
			if (t % 15 === 0) readColors();

			// The population is matched to the knob here rather than by re-seeding
			// the whole field: adding particles keeps the trails already drawn,
			// re-seeding would wipe them.
			const want = cap(live.density);
			while (parts.length < want) parts.push(spawn());
			if (parts.length > want) parts.length = want;

			// The decay pass. Never a hard clear — old ink fades, which IS the
			// image. `destination-out` erases a fraction of what is already there
			// instead of painting the ground over it, which is the same fade on a
			// transparent canvas and what lets this backdrop sit in a stack.
			ctx!.globalCompositeOperation = 'destination-out';
			ctx!.fillStyle = '#000';
			ctx!.globalAlpha = live.decay;
			ctx!.fillRect(0, 0, w, h);
			ctx!.globalAlpha = 1;
			ctx!.globalCompositeOperation = 'source-over';

			ctx!.lineWidth = 1;
			for (const p of parts) {
				// Three octaves, not two. Two is one smooth cell size, and a field with
				// a single scale in it drifts — everything nearby goes the same way.
				// The third octave is the whole "chaotic but not rough" trick: it adds
				// structure BELOW the swirl without adding a hard edge anywhere, since
				// every octave is the same smoothstep noise an octave down.
				const a =
					fbm(p.x * live.swirl, p.y * live.swirl, t * live.churn, 3, 3) * Math.PI * live.turn;
				p.px = p.x;
				p.py = p.y;
				p.x += Math.cos(a) * live.speed;
				p.y += Math.sin(a) * live.speed;
				p.life -= 1;

				// A segment, not a dot. This is what reads as current.
				ctx!.strokeStyle = p.accent ? accent : ink;
				ctx!.beginPath();
				ctx!.moveTo(p.px, p.py);
				ctx!.lineTo(p.x, p.y);
				ctx!.stroke();

				if (p.life <= 0 || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
					Object.assign(p, spawn());
				}
			}
			t += 1;
		}

		if (reduced) {
			// Headless: build a still, then stop. No loop is ever started.
			for (let i = 0; i < 400; i++) step();
			return;
		}

		let raf = 0;
		let odd = false;
		let running = false;

		function loop() {
			raf = requestAnimationFrame(loop);
			// Half rate. Skipping alternate ticks rather than using a timer keeps
			// the work aligned to the compositor's frame.
			odd = !odd;
			if (odd) step();
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

		const ro = new ResizeObserver(resize);
		ro.observe(box);

		return () => {
			stop();
			io.disconnect();
			ro.disconnect();
			document.removeEventListener('visibilitychange', onVis);
		};
	});
</script>

<div class="field" bind:this={host} aria-hidden="true">
	<canvas bind:this={canvas}></canvas>
	<div class="vignette"></div>
</div>

<style>
	.field {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		opacity: var(--backdrop-strength);
		background: var(--backdrop-ground);
	}

	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* Keeps the ink off the sidenav and drawer edges without the sim having
		   to know where the chrome is. */
		mask-image: radial-gradient(ellipse 72% 62% at 50% 45%, black 0%, transparent 100%);
		-webkit-mask-image: radial-gradient(ellipse 72% 62% at 50% 45%, black 0%, transparent 100%);
	}

	.vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 80% 70% at 50% 45%,
			transparent 0%,
			var(--backdrop-ground) 100%
		);
	}
</style>
