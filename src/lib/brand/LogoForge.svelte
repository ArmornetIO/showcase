<script lang="ts">
	// ── LogoForge — the mark forging itself ──────────────────────────────────────
	// One object, two shipped renderings of it, and the ninety seconds of physics
	// between them. `ArmornetLogo` is the inert line crest; `ArmornetCrestChrome`
	// is the forged cut. Both already exist and neither is re-drawn here — the
	// only thing this scene adds is the TRANSITION, and it is built out of the
	// same contours both components are cut from (see `nanite.ts`).
	//
	// Five beats, one clock, one eased `t`:
	//
	//   matte      The mark as it ships flat. Graphite, no glow, breathing.
	//   spin       The figure is a tripod (see `tripod.ts`) and turns on the axis
	//              through its top node, then stops dead on the rest pose.
	//   ignition   The hub takes, colour runs out along the spokes — and then the
	//              star dies: the mark collapses to a bright point, rebounds to
	//              exactly the size it started at, and goes white-hot. It does
	//              NOT go away. The matte mark is the body the suit is about to
	//              close over, and it stands there for the whole next beat.
	//   assembly   Sparks converge and detonate on seats taken from the mark's
	//              own contours, core first and wall last, so the silhouette is
	//              drawn rather than filled. Behind the arrival front a circle
	//              opens on the forged mark, over the matte one — the sparks are
	//              not covering the chrome, they ARE it, arriving.
	//   chrome     Held. One lamp travels and every contour edge answers to it,
	//              and the whole thing turns a few degrees so you can see it is a
	//              solid.
	//
	// ── what this file is, and is not ──
	// It is the CLOCK and the composition, and nothing else. Every layer it
	// mounts stands on its own and is demoed on its own: `ForgeFloor` is the
	// room, `ForgeMark` is the crest with its figure taken off, `SparkField` is
	// the arrival, `ShockRings` is every ring in the scene, `RimLight` is the one
	// lamp and everything that answers to it. What is left here is the easing
	// that says WHEN — which is the part that cannot be decomposed, because a
	// beat is a relationship between layers rather than a property of one.
	//
	// One clock, one eased `t`, and the same discipline as the breach scenes: two
	// easings on two clocks read as two events no matter how carefully the
	// durations line up, because the eye reads acceleration and not position.
	//
	// The clock is a BINDABLE prop rather than private state, which is what lets
	// `LogoForgeStudio` put a scrubber on it. Every visual below is a pure
	// function of `t`, so a scene scrubbed backwards is identical to one that has
	// not got there yet.
	import ArmornetCrestChrome from '../icons/ArmornetCrestChrome.svelte';
	import { LOGO_SHAPE } from '../icons/ArmornetLogo.svelte';
	import { implodeCss, IMPLODE_DEFAULTS } from '../motion/implode.js';
	import type { Lamp } from './rimlight.js';
	import { clamp01, smooth } from './nanite.js';
	import ForgeFloor from './ForgeFloor.svelte';
	import ForgeMark from './ForgeMark.svelte';
	import RimLight from './RimLight.svelte';
	import ShockRings from './ShockRings.svelte';
	import SparkField from './SparkField.svelte';
	import { FORGE, FORGE_SETTLED, markGeometry, seatPlan } from './forge.js';

	interface Props {
		/** The forged mark's rendered width, px. Everything in the scene is
		 *  resolved against it. */
		size?: number;
		/** The room the mark stands in. Off leaves it on the background ramp
		 *  alone, which is what a host with its own backdrop wants. */
		floor?: boolean;
		/** The clock, ms. Bindable so a scrubber can drive it; left alone the
		 *  component runs it. */
		t?: number;
		playing?: boolean;
		speed?: number;
		/** Fired once, when the mark has finished arriving AND the lamp has had
		 *  long enough to say so. A host that swaps this out for its own screen
		 *  waits on this rather than on a duration it has copied. */
		oncomplete?: () => void;
	}

	let {
		size = 470,
		floor = true,
		t = $bindable(0),
		playing = $bindable(true),
		speed = 1,
		oncomplete
	}: Props = $props();

	const { A, EDGES } = markGeometry();
	const { targets: sparkTargets, radii } = seatPlan();

	const {
		T_SPIN,
		T_IGNITE,
		T_IMPLODE,
		WIND_MS,
		COLLAPSE_MS,
		CORE_MS,
		BLAST_MS,
		SETTLE_MS,
		T_CORE,
		T_BLAST,
		T_ASSEMBLE,
		T_LANDED,
		T_HELD,
		SPARK_RAMP,
		TURNS,
		ACCRETE_TURNS
	} = FORGE;

	/** The shield's centre is not the artboard's. Every layer is lifted by the
	 *  same amount or they drift apart as the mark forges. */
	const DY = $derived(0.005784 * size);

	$effect(() => {
		let raf = 0;
		let last = performance.now();
		const step = (now: number) => {
			const dt = Math.min(64, now - last);
			last = now;
			if (playing) t += dt * speed;
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	});

	// Once, and latched — a scrubber run back and forth across the boundary
	// would otherwise fire it on every pass, and the one thing a host does with
	// this is leave.
	let announced = false;
	$effect(() => {
		if (t < FORGE_SETTLED || announced) return;
		announced = true;
		oncomplete?.();
	});

	const tA = $derived(t - T_ASSEMBLE);

	// ── the dreidel ──────────────────────────────────────────────────────────
	// Flicked, not driven: full speed on the first frame and decaying from there,
	// which is what a thing spun by hand does. An ease-IN here would look like a
	// motor starting.
	//
	// It lands on `TURNS · 2π` exactly, and `tripod.ts` explains why that matters:
	// the figure is a true 120° tripod, so a whole number of turns puts every
	// satellite back on the pixel the flat logo draws it at. The stop is not a
	// settle onto something close — the last frame of the spin IS the logo.
	const spinU = $derived(clamp01((t - T_SPIN) / (T_IGNITE - T_SPIN)));
	/**
	 * `u^0.7`, and the exponent being BELOW one is the whole point.
	 *
	 * Any ease-out of the usual shape — `1-(1-u)^n` — arrives with zero velocity,
	 * which is a glide to a halt: the last third of the turn creeps, and the eye
	 * reads it as the figure settling into place rather than stopping. Below one
	 * the curve is still moving at the moment it runs out, so the spin ends on the
	 * frame it ends on. It stops on a dime because it never slowed down to stop.
	 *
	 * No wobble. A top losing its axis is a nice touch on a top and a wiggle on a
	 * logo — the mark has to arrive DECIDED.
	 */
	const spinPhase = $derived(TURNS * Math.PI * 2 * Math.pow(spinU, 0.7));
	/** Once the figure is turning it is drawn separately from its wall — half the
	 *  mark has to move and the other half must not. See `ForgeMark`. */
	const loose = $derived(t >= T_SPIN);

	const ignite = $derived(smooth(T_IGNITE, T_IGNITE + 620, t));
	const breathe = $derived(1 + 0.012 * Math.sin(t / 620));
	/** The hot core's flicker. Fast, and out of phase with nothing — a steady
	 *  bloom reads as a gradient rather than as something burning. */
	const corePulse = $derived(0.72 + 0.28 * Math.sin(t / 260));

	// ── the implode ──────────────────────────────────────────────────────────
	// Driven off the scene clock rather than mounted as `out:implode`. A Svelte
	// transition owns its own timer, so it would run at wall-clock speed while the
	// rest of the scene ran at `speed`, and scrubbing backwards past it would
	// leave the mark gone. `implodeCss` is pure and takes the progress directly,
	// which is exactly what a scrubbable timeline needs.
	//
	// It goes AFTER the ignition on purpose. The mark lights, and only then folds:
	// something that catches and then collapses has had something happen to it,
	// where something that dims out has merely stopped.
	/**
	 * The marketing mesh's own tuning, not the primitive's defaults.
	 *
	 * Left alone `implode` is the CRT power-off it was written to be — fold to a
	 * lit bar, then pinch — and on a whole crest that reads as the shield being
	 * folded up and posted somewhere, which is not a collapse. `bulge` is the
	 * knob: it is documented as how far the panel WIDENS as it folds, so a
	 * negative value narrows it instead and phase A becomes a uniform shrink
	 * toward the middle. `RelayMesh` reached the same numbers for the same reason
	 * on its nodes; they are copied rather than re-derived.
	 */
	const IMPLODE = { ...IMPLODE_DEFAULTS, split: 0.72, bar: 0.1, bulge: -0.9, flash: 1.1 };
	/**
	 * The floor the collapse falls to, and it is not zero.
	 *
	 * `1 - split` is the exact end of `implodeCss`'s phase A: the mark at a tenth
	 * of its size, uniformly, at peak brightness — a point of light. Phase B is
	 * the pinch that blinks it out, and going one frame into it is what turns a
	 * collapse into a disappearance. So the collapse stops on the boundary and
	 * the rebound climbs back out of it.
	 */
	const CORE_T = 1 - IMPLODE.split;
	/** How far the blast throws the mark past its own size before it rings back.
	 *  Small enough that the overshoot is felt rather than read as a zoom. */
	const OVERSHOOT = 0.22;
	/** The wind-up swell. `implodeCss` at t>1 runs phase A backwards, so this
	 *  swells AND dims on one number — which is the anticipation, exactly. */
	const WIND_T = 1.06;
	/** Violent out. `outCubic` is a shove; this is a hit. */
	const outQuint = (x: number) => 1 - Math.pow(1 - x, 5);

	/**
	 * Scale, as a transition `t`: 1 is at rest, 0 is gone, and above 1 is bigger
	 * than life. `implodeCss` is only asked about the range it was written for.
	 */
	const implodeT = $derived.by(() => {
		const e = t - T_IMPLODE;
		if (e <= 0) return 1;
		if (e < WIND_MS) return 1 + (WIND_T - 1) * smooth(0, WIND_MS, e);
		const c = e - WIND_MS;
		// Cubed, not eased: a core collapse RUNS AWAY. Anything that starts fast
		// and settles is the one motion that reads as a UI panel closing.
		if (c < COLLAPSE_MS) return WIND_T - (WIND_T - CORE_T) * Math.pow(c / COLLAPSE_MS, 3);
		const b = c - COLLAPSE_MS;
		if (b < CORE_MS) return CORE_T;
		const s = b - CORE_MS;
		if (s < BLAST_MS) return CORE_T + (1 + OVERSHOOT - CORE_T) * outQuint(s / BLAST_MS);
		// Damped ring-down. A spring and not an ease, because the mark has just
		// been hit — a curve that glides home says it was placed.
		const u = clamp01((s - BLAST_MS) / SETTLE_MS);
		return 1 + OVERSHOOT * Math.exp(-5.4 * u) * Math.cos(u * Math.PI * 3.1) * (1 - u);
	});

	/** White-hot, and it belongs to the BLAST rather than to the scale: the mark
	 *  is at its brightest as it is thrown, not as it is biggest. */
	const blastHeat = $derived(
		t < T_BLAST ? 0 : 1 - smooth(T_BLAST, T_BLAST + BLAST_MS + SETTLE_MS * 0.55, t)
	);

	const matteStyle = $derived.by(() => {
		// Untouched until the wind-up. `implodeCss(1)` is a no-op transform, but a
		// no-op transform is still a stacking context on every earlier beat.
		if (t <= T_IMPLODE) return '';
		// Below rest, this is the collapse and `implodeCss`'s emboss and flash are
		// exactly right for it.
		if (implodeT < 1) return implodeCss(implodeT, IMPLODE);
		// Above rest it is not: phase A run backwards DIMS as it grows, which is
		// what the wind-up wants and the opposite of what a detonation wants. So
		// the swell borrows it and the blast composes its own.
		if (t < T_CORE) return implodeCss(implodeT, IMPLODE);
		return (
			`transform-origin: center;` +
			`transform: scale(${implodeT.toFixed(4)});` +
			`filter: brightness(${(1 + 4.2 * blastHeat).toFixed(3)});`
		);
	});

	// ── what the room does about it ──────────────────────────────────────────
	// All of the following exist because a collapse the scene ignores is a scale
	// curve. The mark cannot sell this on its own — it is one object in the
	// middle of a lit room, and if the room is unchanged the eye correctly
	// concludes that nothing happened.

	/**
	 * The dark the collapse drags in with it. Full black by the singularity, and
	 * it is painted UNDER the mark, so the floor, the haze and the background
	 * ramp all go and the point of light is the only thing left on screen.
	 *
	 * The hold through `CORE` is dead air, and it is doing the most work of
	 * anything here: a beat of empty frame is what makes the next one an event
	 * rather than the next step of an animation.
	 */
	const voidK = $derived(
		t < T_CORE ? smooth(T_IMPLODE + WIND_MS, T_CORE, t) : 1 - smooth(T_BLAST, T_BLAST + 260, t)
	);

	/** The frame going white. Short and hard — long enough to be seen, not long
	 *  enough to be looked at. */
	const blastFlash = $derived(t < T_BLAST ? 0 : Math.pow(1 - clamp01((t - T_BLAST) / 150), 2.4));

	/**
	 * The camera. Pulled in a hair as the mark falls, then punched by the blast
	 * and shaken off it.
	 *
	 * The shake is a decaying sine and not noise: random jitter at 60fps reads as
	 * a dropped frame, where a ring-down reads as something heavy having landed.
	 */
	const kickU = $derived(clamp01((t - T_BLAST) / 520));
	const kick = $derived(t < T_BLAST ? 0 : Math.exp(-6 * kickU) * (1 - kickU));
	const camScale = $derived(1 - 0.03 * voidK * (t < T_BLAST ? 1 : 0) + 0.045 * kick);
	const camShake = $derived(kick * 7 * Math.sin(kickU * Math.PI * 9));

	/** The figure spins up as it falls in. Accretion, and the single clearest
	 *  signal in the frame that this is a collapse and not a shrink. Whole turns,
	 *  so the mark that comes back out is the one that went in. */
	const accrete = $derived(
		Math.pow(clamp01((t - T_IMPLODE - WIND_MS) / COLLAPSE_MS), 2.2) * ACCRETE_TURNS * Math.PI * 2
	);

	/** The forged mark is REVEALED, not faded: a circle opens from the hub just
	 *  BEHIND the leading edge of the cascade, so the chrome is always emerging
	 *  where plates have already landed and never ahead of them. A cross-fade here
	 *  reads as two pictures dissolving, which is exactly what this is not. */
	const REVEAL_IN = 300;
	const REVEAL_OUT = SPARK_RAMP + 420;
	const revealDone = $derived(tA >= REVEAL_OUT);
	/**
	 * The reveal front is the ARRIVAL front, read off the same ranked seats
	 * rather than guessed at with a matching easing.
	 *
	 * Centred on the hub and not on the artboard, because that is what the seats
	 * are ranked from. Off by that much, the opening circle cuts the figure in
	 * half on its way past — a straight edge through the hub, which is the one
	 * thing in the frame with no straight edges anywhere near it.
	 */
	const HUB_PCT = { x: ((10 + A.ox) / 220) * 100, y: (A.oy / 220) * 100 };
	const revealR = $derived.by(() => {
		const f = clamp01((tA - REVEAL_IN) / (REVEAL_OUT - REVEAL_IN));
		const r = radii[Math.min(radii.length - 1, Math.floor(f * radii.length))];
		return (r * size) / 220;
	});
	/** Feathered, not clipped. A hard `circle()` was invisible while flat plates
	 *  covered the boundary; with sparks over it the cut edge is a dark disc
	 *  sitting on the mark, and a disc is the one shape the scene must not draw. */
	const chromeMask = $derived(
		revealDone
			? 'none'
			: `radial-gradient(circle at ${HUB_PCT.x.toFixed(2)}% ${HUB_PCT.y.toFixed(2)}%, #000 ${(revealR * 0.82).toFixed(1)}px, transparent ${(revealR * 1.18).toFixed(1)}px)`
	);
	/**
	 * The matte mark is NEVER taken away — the suit assembles onto a body that is
	 * standing there, not into the space where one used to be. It stops being
	 * rendered only once the forged cut has closed over the last of it, which is
	 * what `revealDone` means, and by then it has been covered for several frames.
	 */
	const matteGone = $derived(revealDone);
	const bloom = $derived(
		t < T_ASSEMBLE ? 0 : 0.35 + 0.45 * smooth(T_ASSEMBLE, T_HELD, t) + 0.22 * Math.sin(t / 780)
	);
	// `tethers` stays OFF. The struts run from each satellite out past the figure
	// to the shield wall, and arriving as a late beat they read as four lines
	// thrown onto a mark that had just finished resolving — the eye has nowhere to
	// go with them. The forged cut is stronger closed.

	/** A few degrees, late. Enough to say "solid", not enough to become a spin. */
	const settled = $derived(smooth(T_LANDED, T_HELD + 900, t));
	const rotY = $derived(settled * 7.5 * Math.sin((t - T_LANDED) / 3400));
	const rotX = $derived(settled * -4 * Math.sin((t - T_LANDED) / 2600 + 1));

	/** ONE light, at a real place in the mark's own box. `RimLight` reads it and
	 *  nothing else does — take the lamp away and every highlight in the scene
	 *  goes dark together, which is the property that makes it read as
	 *  illumination rather than as a filter. */
	const lamp = $derived<Lamp>({
		x: -40 + ((t / 2400) % 1) * 290,
		y: 108 + 26 * Math.sin(t / 1700),
		z: 150
	});
</script>

<div class="scene">
	{#if floor}
		<ForgeFloor />
	{/if}

	<!-- The dark the collapse drags in. UNDER the stage on purpose: it takes the
	     room away and leaves the mark, which is the only way a singularity can be
	     drawn without drawing a hole. -->
	{#if voidK > 0.001}
		<div class="void" style:opacity={voidK}></div>
	{/if}

	<div
		class="stage"
		style:transform="perspective(1500px) rotateX({rotX}deg) rotateY({rotY}deg) translateX({camShake}px) scale({camScale})"
	>
		<!-- Cast down onto the floor. Mirrored, blurred, and cut off before it can
		     be read as a second mark. -->
		{#if t > T_ASSEMBLE}
			<div
				class="mark mirror"
				style:--dy="{DY}px"
				style:opacity={settled * 0.3}
				style:width="{size}px"
			>
				<ArmornetCrestChrome {size} shape={LOGO_SHAPE} glow={false} traces={false} title="" />
			</div>
		{/if}

		<!-- 1/2/3 · the mark as it ships, the mesh coming loose to spin, and the
		     collapse it comes back whole from. It stays UNDER the assembly: the
		     forged cut below is drawn over this, so the sparks are closing a suit
		     onto something that is standing there. -->
		{#if !matteGone}
			<div class="imploder" style={matteStyle}>
				<ForgeMark {size} {loose} spin={spinPhase + accrete} {ignite} pulse={corePulse} {breathe} />
			</div>
		{/if}

		<!-- 4 · the forged cut, opened from the core outward -->
		{#if tA > 0}
			<div
				class="mark"
				style:--dy="{DY}px"
				style:mask-image={chromeMask}
				style:-webkit-mask-image={chromeMask}
				style:filter="saturate({0.55 + 0.45 * settled}) brightness({1 + 0.5 * (1 - settled)})"
			>
				<ArmornetCrestChrome
					{size}
					shape={LOGO_SHAPE}
					{bloom}
					tethers={false}
					glow
					traces
					rim
					emboss
					title="Armornet"
				/>
			</div>
		{/if}

		<!-- 4 · what rebuilds it.
		     Sparks, not plating. The shard tiling that used to fly in here is still
		     computed — it is what supplies the seats — but nothing draws it: a
		     field of hard-edged polygons converging reads as glass reassembling,
		     and the mark is not made of glass. Comet trails arriving and bursting
		     on contact is the same choreography with the right material. -->
		{#if tA > -200 && t < T_LANDED + 400}
			<!-- One spark per seat, and a short run-up. The seats already number
			     close to a thousand and they are the drawing; multiplying them buries
			     the outline under its own approach. `decay` is up from the default to
			     match: the trail has to be SHORTER than the run up, or the arriving
			     front smears past the silhouette it is tracing and the lower flanks
			     read as grass. -->
			<SparkField
				{size}
				offsetY={DY}
				t={tA}
				targets={sparkTargets}
				repeat={1}
				reach={50}
				decay={0.4}
			/>
		{/if}

		<!-- Every ring in the scene, in the order it happens: the shock off the hub
		     as it takes; the one ring that falls INWARD with the collapse, which
		     reads precisely because everything else expands; and the detonation. -->
		<ShockRings
			{size}
			cx={A.ox}
			cy={A.oy}
			offsetY={DY}
			t={t - T_IGNITE}
			duration={900}
			from={4}
			reach={210}
			stagger={190}
			peak={0.5}
			width={[1, 3]}
		/>
		<ShockRings
			{size}
			cx={A.ox}
			cy={A.oy}
			offsetY={DY}
			t={t - T_IMPLODE}
			direction="in"
			count={1}
			duration={WIND_MS + COLLAPSE_MS}
			from={0}
			reach={300}
			peak={0.55}
			width={[0.6, 3.4]}
		/>
		<ShockRings
			{size}
			cx={A.ox}
			cy={A.oy}
			offsetY={DY}
			t={t - T_BLAST}
			stagger={[0, 70, 150]}
			duration={620}
			from={10}
			reach={460}
			ease="quint"
			peak={0.85}
			tail={1.7}
			width={[0.8, 9]}
			leadColor="#ffffff"
			blend
		/>

		<RimLight
			{size}
			offsetY={DY}
			edges={EDGES}
			{lamp}
			figure={A.fig}
			shield={A.outer}
			intensity={settled}
		/>
	</div>

	<!-- The detonation, OVER everything including the mark. A flash the subject
	     is exempt from is a glow behind it. -->
	{#if blastFlash > 0.002}
		<div class="blast" style:opacity={blastFlash}></div>
	{/if}
</div>

<style>
	/* `absolute`, not `fixed`: a host decides how big the scene is. The studio is
	   what wraps it in a full-viewport box. */
	.scene {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background:
			radial-gradient(120% 90% at 50% 34%, #10202a 0%, #070a10 46%, #03050a 100%),
			var(--bg);
		display: grid;
		place-items: center;
	}
	/* The vignette is a layer and not a box-shadow so it survives the floor and
	   the bloom both being drawn under it. */
	.scene::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(75% 62% at 50% 44%, transparent 40%, rgba(2, 4, 8, 0.85) 100%);
	}

	.stage {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		will-change: transform;
	}

	/* Opaque, not a dim: the singularity beat has to be able to leave literally
	   nothing on screen but the point, and a 90%-black wash still shows a room. */
	.void {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: #000;
	}

	/* Tight, because a wide one is fog. The first cut spread to 78% of the frame
	   and the whole picture went milky grey-green for two hundred ms; a hit is
	   small, bright and over. */
	.blast {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(34% 30% at 50% 44%, #ffffff 0%, #d8fdf5 38%, transparent 72%);
		mix-blend-mode: screen;
	}

	/* The wall and the loose figure fold as ONE object. `ForgeMark` nudges both
	   halves onto the shield's centre already, so a wrapper that fills the stage
	   folds about the shield rather than about either artboard. */
	.imploder {
		position: absolute;
		inset: 0;
	}

	.mark {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%) translateY(calc(-1 * var(--dy)));
		line-height: 0;
	}
	.mirror {
		/* Below the mark, upside down, and cut off before it can be read as a
		   second crest — a reflection you can identify stops being a floor. */
		top: calc(50% + 46%);
		transform: translate(-50%, -50%) scaleY(-1);
		filter: blur(3px);
		mask-image: linear-gradient(to top, transparent 8%, rgba(0, 0, 0, 0.7) 78%);
	}
</style>
