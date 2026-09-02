<script lang="ts">
	// ── Implant — the one that gets accepted ──────────────────────────────────────
	// Fourth and last of the shot-furniture components. Same contract as `Blackout`
	// and `Unmask`: `FirstPerson` owns the camera, this owns what is drawn over it,
	// and every value is a function of a phase and its progress handed down.
	//
	// ── The design brief ─────────────────────────────────────────────────────────
	// "The payload ships as corrupt binary test data. Review reads diffs, and this
	//  has no diff worth reading."
	//
	// That sentence is the shot. Not the planting — the REVIEW. Everything before
	// the last beat is setup for a panel that says a file changed, shows you the
	// change, and the change is a wall of bytes nobody is going to read. It is
	// approved, and it is still there.
	//
	// ── Why it is not a heist ────────────────────────────────────────────────────
	// The Maintainer's passive is `nobody audits a friend`, and their best stat is
	// social 3. They are not breaking in. They have commit access, they earned it
	// over two years of being helpful, and the implant goes in during an ordinary
	// afternoon. So there is no crouch here and no letterbox: the approach uses
	// `STROLL` rather than `CREEP`, and the difference between those two constants
	// is the difference between this card and the Architect's.
	//
	// ── Why the cascade runs AWAY from you ───────────────────────────────────────
	// The reference is the sequence where glyphs swarm a character as an idea
	// arrives. Inverted here, deliberately: nothing is coming to this operator.
	// They are producing it. So the field originates at the bottom of the frame —
	// where your hands are — converts as it travels, and seeps into the building.
	// Same visual grammar, opposite direction, opposite meaning.

	import { FIXTURE, cipherOf, scramble } from './internal/obfuscate.js';

	interface Props {
		box: { w: number; h: number };
		mark: { x: number; y: number; r: number } | null;
		hue: string;
		phase: 'walk' | 'compose' | 'inject' | 'dormant' | 'rise';
		p: number;
		elapsed: number;
		subject: string;
		/** The card's headline number and label — `power` / `powerLabel`. */
		score: number;
		unit: string;
	}

	let { box, mark, hue, phase, p, elapsed, subject, score, unit }: Props = $props();

	const ORDER = ['walk', 'compose', 'inject', 'dormant', 'rise'] as const;
	const at = $derived(ORDER.indexOf(phase));
	const past = (n: (typeof ORDER)[number]) => at > ORDER.indexOf(n);

	/** One seed for the whole take, so the same source produces the same payload
	 *  every time it is played. See `noise` in `obfuscate.ts`. */
	const SEED = 1301;
	const CIPHERS = FIXTURE.map((l) => cipherOf(l, SEED));

	/** How far the conversion has run. Holds at 1 afterwards — the payload does
	 *  not un-obfuscate itself while it is being carried. */
	const converted = $derived(phase === 'compose' ? p : past('compose') ? 1 : 0);

	/** The block, mid-conversion. Line by line so each keeps its own slot
	 *  schedule and the four do not flip in lockstep. */
	const lines = $derived(
		FIXTURE.map((plain, i) => scramble(plain, CIPHERS[i], converted, SEED + i * 17))
	);

	/** The field arrives with the beat and leaves once it has been injected —
	 *  what persists is the thing in the tree, not the writing of it. */
	const fieldIn = $derived(
		phase === 'compose'
			? Math.min(1, p / 0.25)
			: phase === 'inject'
				? Math.max(0, 1 - p / 0.7)
				: 0
	);

	/**
	 * How far the block has travelled from your hands toward the building.
	 *
	 * Starts low and near — a thing being held — and ends at the target. The
	 * conversion happens ON THE WAY, so by the time it arrives there is nothing
	 * legible left in it, which is the order the card describes.
	 */
	const travel = $derived(phase === 'inject' ? p : past('inject') ? 1 : 0);

	const origin = $derived({ x: box.w * 0.5, y: box.h * 0.6 });
	const dest = $derived({ x: mark?.x ?? box.w / 2, y: mark?.y ?? box.h * 0.4 });
	const block = $derived({
		x: origin.x + (dest.x - origin.x) * travel,
		y: origin.y + (dest.y - origin.y) * travel
	});

	/** Monospace metrics, so the block can be sized and centred without measuring
	 *  the DOM. Held as a ratio of the frame rather than fixed, because this is
	 *  drawn into an SVG that stretches with the stage. */
	const fs = $derived(Math.max(10, Math.min(18, box.h * 0.023)));
	const lh = $derived(fs * 1.5);

	/**
	 * The swarm.
	 *
	 * The reference is glyphs storming around a character while something is
	 * worked out, and without them this beat is a static card of text sitting
	 * over a building — the conversion happens, but nothing about the frame says
	 * a mind is doing it.
	 *
	 * Inverted from the source, though, and the inversion is the point: in the
	 * film the glyphs converge ON the character because an idea is arriving. Here
	 * they are being CONSUMED — the radius closes and the count thins as
	 * `converted` rises, so they read as raw material going into the block rather
	 * than as inspiration coming out of it. Nothing is arriving for this
	 * operator. They are manufacturing it.
	 *
	 * Fixed angles and radii, drifting on the clock. Same rule as the dive's
	 * streaks and the cut's sparks: random per frame is static, not motion.
	 */
	const MOTES = Array.from({ length: 44 }, (_, i) => ({
		a: (i / 44) * Math.PI * 2 + (i % 5) * 0.23,
		r: 0.42 + ((i * 11) % 13) / 18,
		spin: ((i % 7) - 3) * 0.00022,
		seed: i
	}));

	/** What a mote can show: the source's own characters early on, bytes as the
	 *  block settles. The alphabet narrowing IS the obfuscation, visible in the
	 *  air around the block before it lands in it. */
	const POOL = $derived(FIXTURE.join('').replace(/\s/g, ''));
	const BYTES = '0123456789abcdef';

	/**
	 * The seep.
	 *
	 * `CARD_FX.fixture` says `vector: 'seep'`, not `trace` — so it spreads and
	 * finds gaps rather than shooting a line. Drawn as short segments creeping out
	 * of the block toward the target on slightly different paths: one clean stroke
	 * would be a trace, and a trace is a different card.
	 */
	const SEEPS = Array.from({ length: 7 }, (_, i) => ({
		k: 0.35 + ((i * 7) % 10) / 12,
		off: (i - 3) * 0.11
	}));

	/** The review panel, and the beat the whole shot is for. Slides up once the
	 *  payload is in — a diff cannot be reviewed before it exists. */
	const review = $derived(
		phase === 'dormant' ? Math.min(1, elapsed / 520) : phase === 'rise' ? 1 - p : 0
	);

	/** What stays. Dim, small, and it does not pulse — a marker that throbs is a
	 *  marker announcing itself, and the entire value of this implant is that
	 *  nothing announces it. */
	const sits = $derived(past('inject') ? (phase === 'rise' ? 1 - p : 1) : 0);
</script>

<svg class="absolute inset-0 h-full w-full" viewBox="0 0 {box.w} {box.h}" preserveAspectRatio="none">
	<!-- ── The field ────────────────────────────────────────────────────────
	     Source becoming bytes, in place. Nothing reflows — `scramble` preserves
	     length exactly — so the block holds still and changes underneath you,
	     which is the whole trick. A cascade that also drifts is noise. -->
	{#if fieldIn > 0.01}
		{@const w = Math.max(...FIXTURE.map((l) => l.length)) * fs * 0.6}
		<g
			opacity={fieldIn}
			transform="translate({block.x} {block.y}) scale({1 - travel * 0.45})"
		>
			<rect
				x={-w / 2 - 12}
				y={-lh * FIXTURE.length * 0.5 - 10}
				width={w + 24}
				height={lh * FIXTURE.length + 20}
				rx="3"
				fill="rgba(4,6,12,0.72)"
				stroke={hue}
				stroke-opacity="0.28"
			/>
			{#each lines as line, i (i)}
				<text
					x={-w / 2}
					y={-lh * FIXTURE.length * 0.5 + lh * (i + 0.8)}
					fill={hue}
					font-size={fs}
					font-family="ui-monospace, monospace"
					letter-spacing="0.5"
					opacity={0.55 + converted * 0.4}
					xml:space="preserve">{line}</text
				>
			{/each}
		</g>
	{/if}

	<!-- ── The swarm ────────────────────────────────────────────────────────
	     Loose glyphs orbiting the block and closing on it. They thin and pull in
	     as the conversion completes, so the last frame of the beat has none left
	     — everything loose has gone into the payload. -->
	{#if fieldIn > 0.01 && converted < 0.98}
		{@const R = Math.min(box.w, box.h) * 0.46}
		{#each MOTES as m (m.seed)}
			{@const pull = 1 - converted * 0.72}
			{@const ang = m.a + elapsed * m.spin}
			{@const rad = R * m.r * pull}
			{@const src = converted > 0.5 ? BYTES : POOL}
			{@const ch = src[(m.seed * 7 + Math.floor(elapsed / 110)) % src.length] ?? '0'}
			<text
				x={block.x + Math.cos(ang) * rad * 1.25}
				y={block.y + Math.sin(ang) * rad * 0.72}
				fill={hue}
				font-size={fs * (0.62 + m.r * 0.4)}
				font-family="ui-monospace, monospace"
				text-anchor="middle"
				opacity={fieldIn * (1 - converted * 0.55) * (0.4 + m.r * 0.45)}>{ch}</text
			>
		{/each}
	{/if}

	<!-- ── The seep ─────────────────────────────────────────────────────────
	     It finds gaps rather than punching through. Several short paths on
	     slightly different curves — one clean stroke would be a `trace`, and
	     this card's vector is `seep`. -->
	{#if travel > 0.02 && travel < 1 && mark}
		{#each SEEPS as s (s.off)}
			{@const t0 = Math.max(0, travel - 0.25 * s.k)}
			{@const ax = origin.x + (dest.x - origin.x) * t0}
			{@const ay = origin.y + (dest.y - origin.y) * t0}
			{@const bend = box.w * s.off * (1 - travel)}
			<path
				d="M {ax + bend} {ay} Q {(ax + dest.x) / 2 + bend * 1.6} {(ay + dest.y) / 2}
				   {dest.x} {dest.y}"
				fill="none"
				stroke={hue}
				stroke-width="1.3"
				stroke-linecap="round"
				opacity={0.3 * s.k * travel}
			/>
		{/each}
	{/if}

	<!-- ── What stays ───────────────────────────────────────────────────────
	     A package mark on the building. Deliberately dull: no pulse, no ring,
	     nothing that draws an eye. The card's whole proposition is that this
	     sits in the tree indefinitely because nobody has a reason to look at
	     it, and a marker that blinks is a marker asking to be found. -->
	{#if sits > 0 && mark}
		{@const r = Math.max(9, Math.min(20, mark.r * 0.16))}
		<g opacity={0.62 * sits} transform="translate({mark.x} {mark.y + mark.r * 0.42})">
			<rect x={-r} y={-r * 0.72} width={r * 2} height={r * 1.44} rx="2" fill="rgba(4,6,12,0.9)" stroke={hue} stroke-width="1.2" />
			<line x1={-r} y1={-r * 0.22} x2={r} y2={-r * 0.22} stroke={hue} stroke-width="1" opacity="0.7" />
			<line x1={0} y1={-r * 0.72} x2={0} y2={-r * 0.22} stroke={hue} stroke-width="1" opacity="0.7" />
		</g>
	{/if}
</svg>

<!-- ── The review ───────────────────────────────────────────────────────────
     The point of the card, and the last thing you see. A diff that changed one
     file, whose body is a wall of bytes, marked approved — and the payload is
     still sitting there behind it.

     DOM rather than SVG because it is a panel of text, and text in a stretched
     `preserveAspectRatio="none"` viewBox is text that shears with the stage. -->
{#if review > 0.01}
	<div
		class="absolute font-mono"
		style:left="50%"
		style:bottom="{box.h * 0.17}px"
		style:transform="translateX(-50%) translateY({(1 - review) * 14}px)"
		style:opacity={review}
		style:width="{Math.min(430, box.w * 0.62)}px"
	>
		<div
			class="rounded border px-3 py-2"
			style:border-color="color-mix(in srgb, {hue} 34%, transparent)"
			style:background="rgba(4,7,13,0.9)"
		>
			<div class="flex items-baseline justify-between">
				<span class="text-[0.55rem] font-bold tracking-[0.16em]" style:color={hue}>
					REVIEW · {subject.toUpperCase()}
				</span>
				<!-- Green regardless of the card's hue. This is the reviewer's verdict,
				     not the attacker's colour, and the whole horror of the beat is that
				     it comes back in the ordinary colour of everything being fine. -->
				<span class="text-[0.55rem] font-bold tracking-[0.16em]" style:color="#34D399">
					APPROVED
				</span>
			</div>
			<div class="mt-1 text-[0.56rem]" style:color="var(--muted, #8b98ad)">
				1 file changed · testdata/accounts.golden.bin
			</div>
			<!-- The diff. Bytes, truncated with an ellipsis, and unreadable on
			     purpose: `this has no diff worth reading` is the card's own text and
			     this is the frame that has to earn it. -->
			<div
				class="mt-1.5 overflow-hidden rounded px-2 py-1 text-[0.5rem] leading-[1.35] break-all"
				style:background="rgba(0,0,0,0.36)"
				style:color="color-mix(in srgb, {hue} 62%, #8b98ad)"
			>
				{CIPHERS.join('')}{CIPHERS[0]}…
			</div>
			<div class="mt-1.5 text-[0.55rem] font-bold tracking-[0.14em]" style:color={hue}>
				+{score} {unit} · IT STAYS UNTIL SOMEBODY READS THE CODE
			</div>
		</div>
	</div>
{/if}
