<script lang="ts">
	// ── Blackout — the furniture for a shot with no weapon in it ──────────────────
	// `FirstPerson` owns the camera. This owns everything the BLACKOUT shot draws
	// that the insert shot does not: the conduit, the hands, the cut, and the dead
	// link afterwards. Split out because the two shots share a camera and share
	// almost nothing else, and a component that draws both behind `{#if}` is two
	// components with one name.
	//
	// Pure drawing. No timers, no camera, no rules — every value below is a
	// function of the phase and its progress, handed down. That is the same
	// property `FirstPerson` keeps for the same reason: a thing that animates off
	// its own clock cannot be paused, cut, or made to agree with the board.
	//
	// ── The design brief ─────────────────────────────────────────────────────────
	// Segment cuts a building off the network for two rounds. Read off the card
	// that is a rules sentence; the shot has to make it a THING THAT HAPPENED. So:
	// it is not an attack, nobody is shot, and there is deliberately no reticle —
	// a reticle is a promise of violence and this card does not commit one. What
	// it takes is the building's link, and the whole vocabulary follows from that.
	//
	// Nothing in here names the card, and that is deliberate rather than
	// incidental: this shot was written for Quarantine and moved to Segment when
	// the cutaway table was pinned to signature powers. It survived the move
	// because every word it says out loud comes off the `Scene` — the verb, the
	// number, the unit, the colour. A shot that hard-codes what its first owner
	// meant is a shot that can only ever have one owner.
	//
	//   the conduit   The one object in the frame. It runs off the left edge,
	//                 sags through where your hands can reach, and climbs to the
	//                 building — so before anything is cut you can already see
	//                 what feeds what.
	//   the hands     No gun, no shoulders. Two hands, blocky in the same
	//                 language as the character models, coming up into frame.
	//                 Hands are what say "this is being done by a person at arm's
	//                 length" rather than at distance.
	//   the snap      One white frame and the line parts. Short — the cheapest way
	//                 to make something feel sudden is to make it shorter than the
	//                 eye's ability to track it.
	//   the dark      The consequence, and the beat that is allowed to be long.
	//                 The building goes out, the uplink bars drain, and the read is
	//                 NO ROUTE.

	interface Props {
		/** The overlay's own pixel box. */
		box: { w: number; h: number };
		/** The target building's drawn box, live off the DOM — so the conduit stays
		 *  attached to it while the globe keeps turning underneath. */
		mark: { x: number; y: number; r: number } | null;
		/** The card's hue. Spent on the live line and the readout; never on the
		 *  cut ends, which are dead and have no colour by definition. */
		hue: string;
		phase: 'spot' | 'creep' | 'flank' | 'reach' | 'snap' | 'dark' | 'rise';
		/** Progress through the current phase, 0–1. */
		p: number;
		/** Ms in the current phase, for anything that has to keep moving after its
		 *  phase has run out of progress to be a function of. */
		elapsed: number;
		/** What the readout is naming. */
		subject: string;
		/** How long the effect holds and what that is counted in, straight off the
		 *  card's `power` / `powerLabel`. A shot that invents its own number is a
		 *  shot that will disagree with the board two turns later. */
		rounds: number;
		unit: string;
		/**
		 * What the card DOES, in its own voice — `CardFx.word`.
		 *
		 * This line used to read `SEALED`, hard-coded, because the shot was built
		 * for Quarantine. Then the shot moved to Segment and the overlay was
		 * telling the player a building had been sealed by a card that segments
		 * it. Reading the verb off the card is not tidiness: a hard-coded verb is
		 * a fact about the shot's first owner, and shots move.
		 */
		verb: string;
	}

	let { box, mark, hue, phase, p, elapsed, subject, rounds, unit, verb }: Props = $props();

	/** Phases in order, so "have we passed X" is a comparison rather than a list
	 *  of equality tests that somebody will forget to extend. */
	const ORDER = ['spot', 'creep', 'flank', 'reach', 'snap', 'dark', 'rise'] as const;
	const at = $derived(ORDER.indexOf(phase));
	const past = (name: (typeof ORDER)[number]) => at > ORDER.indexOf(name);

	/**
	 * Where the line is cut, and why it is fixed in the FRAME rather than on the
	 * building.
	 *
	 * Your hands are at the end of your arms. Wherever the building has drifted
	 * to, the place you can reach is the same place — a little below centre, where
	 * a crouched person's hands are. Anchoring the cut to the building instead
	 * would have the hands lunging across the frame to chase a node that is still
	 * moving with the globe, which reads as grabbing rather than as working.
	 */
	const cut = $derived({ x: box.w * 0.5, y: box.h * 0.63 });

	/** How dead the line is. Ramps across the snap and stays. */
	const dead = $derived(phase === 'snap' ? p : past('snap') ? 1 : 0);
	/** The white frame. Front-loaded and gone — see the brief. */
	const flash = $derived(phase === 'snap' ? Math.pow(1 - p, 3.2) : 0);

	/**
	 * How far the hands are into frame.
	 *
	 * Nothing during the approach: a crouched person moving quietly has their
	 * hands down, and hands held up through a creep read as a hold-up. They arrive
	 * on `reach`, stay through the snap, and go back down once the line is dead —
	 * you do not stand in the dark admiring your own gloves.
	 */
	const handIn = $derived(
		phase === 'reach'
			? Math.min(1, p / 0.8)
			: phase === 'snap'
				? 1
				: phase === 'dark'
					? Math.max(0, 1 - elapsed / 900)
					: 0
	);

	/** The hands part as the line goes. Same curve as `dead`, one step behind, so
	 *  the eye reads the cut as causing the recoil rather than accompanying it.
	 *
	 *  The travel below is small, and it took a screenshot to learn how small: a
	 *  hand that crosses an eighth of the frame is not recoiling, it is being
	 *  thrown, and the shot briefly looked like somebody had been electrocuted by
	 *  the thing they were deliberately cutting. */
	const apart = $derived(phase === 'snap' ? Math.pow(p, 0.6) : past('snap') ? 1 : 0);

	/** The crouch, as an aperture.
	 *
	 *  There is no room in the pose for it — `SURFACE_DISTANCE` is a hard floor,
	 *  so the camera cannot get any lower than standing. Squeezing the frame from
	 *  top and bottom buys the same read for nothing: a letterboxed, low, hunched
	 *  window that opens up the moment the body stops moving and goes to work. */
	const crouch = $derived(
		phase === 'spot' ? p * 0.5 : phase === 'creep' || phase === 'flank' ? 1 : Math.max(0, 1 - p * 2)
	);

	/**
	 * Where the conduit meets the building — and clamped, which is not tidying.
	 *
	 * By the time the hands come up the target fills the frame: `mark.r` is most
	 * of the viewport, and the honest answer (somewhere on the building's near
	 * face) lands within a few dozen pixels of where you are standing. The riser
	 * collapses to a stub, and a cable with no run in it does not read as feeding
	 * anything — it reads as a scratch.
	 *
	 * So the feed is pushed to at least a quarter of the frame above the hands and
	 * kept inside the edges. It is a lie about exactly which brick the line enters,
	 * and it buys the only thing the shot needs the line to say: this goes up
	 * THERE, and up there is the building.
	 */
	const feed = $derived({
		x: Math.max(box.w * 0.14, Math.min(box.w * 0.86, mark?.x ?? box.w * 0.5)),
		y: Math.max(box.h * 0.08, Math.min(mark?.y ?? 0, cut.y - box.h * 0.26))
	});

	/**
	 * The conduit, in two runs with a sag in each.
	 *
	 * Quadratic rather than straight, and the control point sits BELOW the chord:
	 * a cable under its own weight is the one shape everybody can read without
	 * being told what they are looking at, and a taut straight line between two
	 * points is a wire in a diagram.
	 */
	function sag(
		a: { x: number; y: number },
		b: { x: number; y: number },
		droop: number,
		drop = 0
	): string {
		// Perpendicular to the chord, not straight down. A vertical offset on a
		// near-vertical run moves the control point ALONG the line and bows
		// nothing, which is how the riser ended up a drawn-with-a-ruler stroke
		// next to a run-in that sagged properly. Flipped so the bow is always the
		// downhill side, because that is the only direction gravity offers.
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		const px = dy / len;
		const py = -dx / len;
		const sign = py < 0 ? -1 : 1;
		const mx = (a.x + b.x) / 2 + px * droop * sign;
		const my = (a.y + b.y) / 2 + py * droop * sign;
		return `M ${a.x} ${a.y + drop} Q ${mx} ${my + drop} ${b.x} ${b.y}`;
	}

	/** How far the severed ends fall. They do not fall far — a cable dropping to
	 *  the floor is a cable nobody will reconnect, and this seal lifts. */
	const slack = $derived(dead * box.h * 0.055);

	/** Sparks. A fixed ring of angles biased downward, because an arc at a cut
	 *  throws where the metal parted and then everything falls. Fixed rather than
	 *  random per frame for the same reason the dive's streaks are: random per
	 *  frame is static, not energy. */
	const SPARKS = Array.from({ length: 9 }, (_, i) => ({
		a: Math.PI * (0.08 + (i / 8) * 0.84) + (i % 3) * 0.07,
		k: 0.5 + ((i * 5) % 9) / 9
	}));

	/** Six bars, drained right to left over the cut. Six because it is enough to
	 *  read as a meter and few enough that losing one is visible. */
	const BARS = 6;
	const live = $derived(Math.round(BARS * (1 - dead)));

	/** The readout sits under the building rather than over it — over it is where
	 *  the insert shot puts a lock-on, and this is the shot that does not have
	 *  one. */
	const panel = $derived({
		x: Math.max(12, Math.min(box.w - 168, (mark?.x ?? box.w * 0.5) - 78)),
		// Above the building when there is room above the building, and pinned near
		// the top of the frame when there is not — which by the end of this shot is
		// most of the time, because the target has grown to fill it.
		y: Math.max(14, Math.min(box.h - 100, (mark?.y ?? 0) - (mark?.r ?? 40) * 0.9 - 74))
	});

	const readoutIn = $derived(
		phase === 'snap' ? Math.max(0, (p - 0.4) / 0.6) : past('snap') ? (phase === 'rise' ? 1 - p : 1) : 0
	);
</script>

<!-- ── The building's own light, going out ──────────────────────────────────
     A black radial centred on the NODE, so what darkens is that building and
     its ground rather than the picture as a whole. Dimming the whole frame
     would say "the shot got darker"; dimming one place on a board that is
     still lit everywhere else says the power went off there. -->
{#if dead > 0 && mark}
	<div
		class="absolute inset-0"
		style:background="radial-gradient(circle at {mark.x}px {mark.y}px,
			rgba(2,3,7,{0.9 * dead}) 0%,
			rgba(2,3,7,{0.78 * dead}) {Math.max(8, mark.r * 1.2)}px,
			transparent {Math.max(30, mark.r * 3.4)}px)"
	></div>
{/if}

<!-- The crouch aperture. Two bars rather than a scaled frame: a letterbox that
     grows from the edges costs nothing to composite and does not touch the
     layout of anything drawn inside it. -->
{#if crouch > 0.01}
	<!-- Uneven on purpose, and it has to be. A symmetric letterbox is the grammar
	     of widescreen: the eye has been trained by every film it has ever seen to
	     read equal bars as an aspect ratio and then stop noticing them. Twice as
	     much off the TOP is a brow coming down over the frame, and that asymmetry
	     is the whole difference between ducking and formatting.

	     Hard for most of their depth, then faded. The tunnel vignette is already
	     darkening these same edges, and a soft gradient under a soft gradient is
	     nothing at all — the first pass of this did not survive the capture. -->
	{#each [
		{ edge: 0, k: 0.15 },
		{ edge: 1, k: 0.07 }
	] as bar (bar.edge)}
		<div
			class="absolute inset-x-0"
			style:height="{box.h * bar.k * crouch}px"
			style:top={bar.edge ? 'auto' : '0'}
			style:bottom={bar.edge ? '0' : 'auto'}
			style:background="linear-gradient(to {bar.edge ? 'top' : 'bottom'},
				rgba(2,4,9,0.97) 58%, transparent)"
		></div>
	{/each}
{/if}

<svg class="absolute inset-0 h-full w-full" viewBox="0 0 {box.w} {box.h}" preserveAspectRatio="none">
	<!-- ── The conduit ──────────────────────────────────────────────────────
	     Drawn from the creep onward, so by the time the hands arrive the player
	     has already been looking at the thing that is about to be cut. An object
	     introduced in the same beat it is used in is a prop; one that has been
	     hanging there for two seconds is a plan. -->
	{#if at >= ORDER.indexOf('creep')}
		{@const glow = 1 - dead}
		<!-- The run in from off-frame, and the riser up to the building. Two
		     paths, not one: only the riser is the building's feed, and after the
		     cut they hang at different angles because they are anchored at
		     different ends. -->
		<path
			d={sag({ x: -30, y: box.h * 0.52 }, cut, box.h * 0.06, slack * 0.35)}
			fill="none"
			stroke={dead > 0.5 ? '#1B2130' : hue}
			stroke-width={3.2}
			stroke-linecap="round"
			opacity={0.35 + glow * 0.35}
		/>
		<path
			d={sag(cut, feed, box.h * 0.05, slack)}
			fill="none"
			stroke={dead > 0.5 ? '#1B2130' : hue}
			stroke-width={3.2}
			stroke-linecap="round"
			opacity={0.35 + glow * 0.35}
		/>
		<!-- What is actually running through it. A bright dash pattern crawling
		     toward the building — the one thing on screen that says the line is
		     LIVE, and therefore the one thing whose absence afterwards is
		     legible. Nothing else in the shot has to explain that it stopped. -->
		{#if glow > 0.02}
			<path
				d={sag(cut, feed, box.h * 0.05, slack)}
				fill="none"
				stroke="#FFFFFF"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-dasharray="3 16"
				stroke-dashoffset={-(elapsed / 22) % 19}
				opacity={0.7 * glow}
			/>
		{/if}
	{/if}

	<!-- ── The hands ────────────────────────────────────────────────────────
	     Forearm and fist, blocky, in the same octagonal-lump language the
	     character models are built in — a rounded organic hand next to those
	     figures is a different character wearing the same suit.

	     Filled near-black with a lit rim, exactly like the insert shot's
	     shoulders, because they are the same claim: this is a silhouette between
	     you and a lit world, not a sprite over it. -->
	{#if handIn > 0.01}
		{@const rise = (1 - handIn) * box.h * 0.42}
		{@const w = box.w * 0.052}
		{#each [-1, 1] as side (side)}
			{@const gap = box.w * (0.045 + apart * 0.028) * side}
			{@const hx = cut.x + gap}
			{@const hy = cut.y + rise + apart * box.h * 0.035}
			<g opacity={Math.min(1, handIn * 1.4)}>
				<!-- Forearm: a taper from the bottom corner up to the fist. Wider at
				     the elbow, and set outboard, so the two arms make a V rather than
				     two parallel posts. -->
				<path
					d="M {cut.x + side * box.w * (0.17 + apart * 0.04)} {box.h * 1.06}
					   L {cut.x + side * box.w * (0.42 + apart * 0.04)} {box.h * 1.06}
					   L {hx + side * w * 1.05} {hy + w * 0.45}
					   L {hx - side * w * 0.55} {hy + w * 0.6} Z"
					fill="rgba(3,5,11,0.97)"
					stroke={hue}
					stroke-width="1.5"
					stroke-opacity="0.55"
				/>
				<!-- The fist. An octagon, because nothing in this world has a corner. -->
				<path
					d={(() => {
						const r = w * 0.72;
						const c = r * 0.36;
						return `M ${hx - r + c} ${hy - r} L ${hx + r - c} ${hy - r}
						        L ${hx + r} ${hy - r + c} L ${hx + r} ${hy + r - c}
						        L ${hx + r - c} ${hy + r} L ${hx - r + c} ${hy + r}
						        L ${hx - r} ${hy + r - c} L ${hx - r} ${hy - r + c} Z`;
					})()}
					fill="rgba(3,5,11,0.98)"
					stroke={hue}
					stroke-width="1.7"
					stroke-opacity="0.8"
				/>
				<!-- One lit knuckle band. The visor's trick applied to a hand: a single
				     bright plane is what stops a black shape reading as a hole. -->
				<line
					x1={hx - w * 0.5}
					y1={hy - w * 0.3}
					x2={hx + w * 0.5}
					y2={hy - w * 0.3}
					stroke={hue}
					stroke-width="2.4"
					stroke-linecap="round"
					opacity="0.75"
				/>
			</g>
		{/each}
	{/if}

	<!-- ── The cut ──────────────────────────────────────────────────────────
	     Sparks, thrown down and out, and gone almost immediately. They exist to
	     put a hard edge on the instant — the darkness that follows is slow, and
	     something has to be fast or the whole beat reads as a dimmer. -->
	{#if phase === 'snap' || (phase === 'dark' && elapsed < 260)}
		{@const life = phase === 'snap' ? p : Math.min(1, 0.6 + elapsed / 650)}
		{@const heat = Math.pow(1 - life, 1.7)}
		{#each SPARKS as s (s.a)}
			{@const near = box.h * 0.012}
			{@const far = near + box.h * (0.03 + life * 0.13) * s.k}
			<line
				x1={cut.x + Math.cos(s.a) * near}
				y1={cut.y + Math.sin(s.a) * near}
				x2={cut.x + Math.cos(s.a) * far}
				y2={cut.y + Math.sin(s.a) * far + life * life * box.h * 0.05}
				stroke={heat > 0.5 ? '#FFFFFF' : hue}
				stroke-width={1 + heat * 1.6}
				stroke-linecap="round"
				opacity={heat}
			/>
		{/each}
	{/if}

	<!-- ── The readout ──────────────────────────────────────────────────────
	     What the shot is FOR, said once. Under the building, in the HUD's own
	     mono, and it names the mechanic — a shot that shows a consequence the
	     board does not actually apply is a lie the player finds out about two
	     turns later. -->
	{#if readoutIn > 0}
		<g opacity={readoutIn}>
			<rect
				x={panel.x}
				y={panel.y}
				width="156"
				height="62"
				rx="3"
				fill="rgba(4,7,14,0.82)"
				stroke={hue}
				stroke-opacity="0.35"
			/>
			<text
				x={panel.x + 10}
				y={panel.y + 17}
				fill={hue}
				font-size="8"
				font-family="ui-monospace, monospace"
				font-weight="700"
				letter-spacing="1.5">UPLINK · {subject.toUpperCase()}</text
			>
			{#each Array(BARS) as _, i (i)}
				<rect
					x={panel.x + 10 + i * 15}
					y={panel.y + 24}
					width="11"
					height="7"
					fill={i < live ? hue : '#232A3A'}
					opacity={i < live ? 0.85 : 1}
				/>
			{/each}
			<text
				x={panel.x + 10}
				y={panel.y + 45}
				fill={live ? hue : '#F87171'}
				font-size="9"
				font-family="ui-monospace, monospace"
				font-weight="700"
				letter-spacing="1.2">{live ? 'DEGRADED' : 'NO ROUTE'}</text
			>
			<text
				x={panel.x + 10}
				y={panel.y + 56}
				fill={hue}
				opacity="0.62"
				font-size="8"
				font-family="ui-monospace, monospace"
				letter-spacing="1.2">{verb.toUpperCase()} · {rounds} {unit}</text
			>
		</g>
	{/if}
</svg>

<!-- The white frame. Last in the stack so it covers everything, including the
     hands that caused it — an arc at contact blows out the whole exposure, and
     a flash you can see the cause through is a lens effect rather than an
     event. -->
{#if flash > 0.005}
	<div
		class="absolute inset-0"
		style:background="radial-gradient(circle at {cut.x}px {cut.y}px,
			rgba(255,255,255,{0.92 * flash}) 0%,
			color-mix(in srgb, {hue} {60 * flash}%, transparent) {box.h * 0.16}px,
			transparent {box.h * 0.5}px)"
	></div>
{/if}
