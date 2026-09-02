<script lang="ts">
	// ── Unmask — the shot that never goes anywhere ────────────────────────────────
	// Third of the shot-furniture components, after `Blackout`. Same contract:
	// `FirstPerson` owns the camera, this owns everything drawn over it, and every
	// value below is a function of a phase and its progress handed down — no
	// timers, no camera, no rules.
	//
	// ── The design brief ─────────────────────────────────────────────────────────
	// Attribution names the actor while a revealed foothold stands, and at the
	// Persona Farm it burns the identity outright: REP to zero, and the persona
	// cannot be worn twice.
	//
	// Three facts off the card decide the whole shot, and none of them is "attack":
	//
	//   it needs a REVEALED foothold   You are not finding them. You can already
	//                                  see them. So there is no search, no
	//                                  approach, and nothing to sneak up on — the
	//                                  hard part already happened off screen.
	//   skill: 'social', dc 11         And the Hunter has social 0. This is their
	//                                  WORST stat. Naming somebody publicly is
	//                                  difficult for the person who found them,
	//                                  which is a fact about courage rather than
	//                                  about tradecraft.
	//   it leaves NOTHING behind       No implant, no garrison. What persists is
	//                                  that everyone now knows.
	//
	// So: a long lens, a shortlist collapsing, one name, and then the name goes
	// everywhere. The rings travel OUTWARD, which is the deliberate inverse of the
	// blackout's darkness closing in — one card takes something away from a place,
	// the other tells every other place about it.
	//
	// And no reticle. Same rule as the blackout and a different reason: there a
	// reticle would have promised violence the card never commits, here it would
	// claim the operator is aiming at a building when what they are actually doing
	// is looking at a person.

	import { figureFacets, studioFrame, type CharacterSkin } from 'showcase';
	import { lockSettle, ripple, sifting } from './internal/optics.js';
	import type { Lineup } from './internal/cinema.js';

	interface Props {
		box: { w: number; h: number };
		/** The target building's drawn box, live off the DOM. */
		mark: { x: number; y: number; r: number } | null;
		/** The card's hue — the Hunter's green. */
		hue: string;
		phase: 'watch' | 'sift' | 'name' | 'public' | 'rise';
		p: number;
		elapsed: number;
		subject: string;
		/** The shortlist and its answer. Absent when the board could not say who
		 *  is standing there — the shot then reaches a verdict of UNATTRIBUTED,
		 *  which is a real outcome and not an error state. */
		lineup?: Lineup;
		/** The suit grey, so a figure resolved here matches the one on the roster
		 *  tile and the one in the other two shots. */
		suit?: string;
		/** What the card is worth, and in what — `power` / `powerLabel`. */
		score: number;
		unit: string;
	}

	let { box, mark, hue, phase, p, elapsed, subject, lineup, suit, score, unit }: Props = $props();

	const ORDER = ['watch', 'sift', 'name', 'public', 'rise'] as const;
	const at = $derived(ORDER.indexOf(phase));
	const past = (n: (typeof ORDER)[number]) => at > ORDER.indexOf(n);

	const suspects = $derived(lineup?.suspects ?? []);
	/** Whether the board could actually answer. A shortlist with no answer is not
	 *  a bug — it is a foothold nobody could pin to a seat, and the shot has to be
	 *  able to say that out loud rather than pick somebody. */
	const solved = $derived(!!lineup && lineup.answer >= 0 && lineup.answer < suspects.length);

	/** Which suspect is showing. During the sift this cycles and lands; after it,
	 *  it is simply the answer. */
	const showing = $derived.by(() => {
		if (!suspects.length) return null;
		if (phase === 'sift') return suspects[sifting(p, suspects.length, Math.max(0, lineup!.answer))];
		if (past('sift') && solved) return suspects[lineup!.answer];
		return null;
	});

	/** How locked the name is. Overshoots slightly — see `lockSettle`. */
	const lock = $derived(
		phase === 'name' ? lockSettle(p) : past('name') ? (phase === 'rise' ? 1 - p : 1) : 0
	);

	/** The lens. Present from the first frame, because this shot opens with you
	 *  ALREADY looking — there is no beat where you are not. */
	const glass = $derived(phase === 'watch' ? Math.min(1, p / 0.4) : phase === 'rise' ? 1 - p : 1);

	/**
	 * Where the identity plate sits: under the target, never over it.
	 *
	 * Over the target is where the insert shot puts a lock-on, and this is not
	 * that. Clamped into frame because by the hold the building's drawn box is
	 * most of the viewport.
	 */
	const plate = $derived({
		x: Math.max(90, Math.min(box.w - 90, mark?.x ?? box.w / 2)),
		y: Math.max(box.h * 0.3, Math.min(box.h - 96, (mark?.y ?? box.h / 2) + (mark?.r ?? 40) * 0.7))
	});

	/** The figure is drawn head-on: this is a photograph of somebody, not somebody
	 *  standing on the board. Sized off the frame rather than fixed, and sized
	 *  GENEROUSLY — the first pass put it at about 24px, where four blocky
	 *  silhouettes are four smudges and the beat has nothing to read. Fixed frame so the sift's candidates
	 *  are comparable — a lineup where each face is at a different angle is not a
	 *  lineup. */
	const portraitFrame = $derived(studioFrame(0.5, 0.14, Math.max(26, box.h * 0.075)));

	/** Rings going out. Only once the name is public — there is nothing to
	 *  propagate before there is a name. */
	const RINGS = 4;
	const going = $derived(phase === 'public' ? 1 : phase === 'rise' ? 1 - p : 0);

	/** The four corner ticks of a tracking box, sized off the live node box and
	 *  clamped: at this distance the target is small, which is the point, but a
	 *  box that collapses to nothing tracks nothing. */
	const trackR = $derived(Math.max(30, Math.min(box.h * 0.3, (mark?.r ?? 40) * 1.5)));

	/** The barrel vignette, as a constant rather than inline: a multi-line
	 *  `style:` value with no interpolation in it is parsed as an EXPRESSION, and
	 *  `rgba(2,5,8,0.92)` is then a four-argument call to a function that takes
	 *  three. Hoisting it is the fix and it reads better besides. */
	const BARREL =
		'radial-gradient(circle at 50% 50%, transparent 42%, rgba(3,7,10,0.55) 78%, rgba(2,5,8,0.92) 100%)';

	/** Fragments the sift throws off — the trace being read. Fixed strings rather
	 *  than random ones: this is the same evidence every time the card is played,
	 *  because it IS the same evidence, and text that rerolls per frame reads as
	 *  decoration rather than as a record. */
	const TRACE = [
		'commit 4f2a9c1',
		'push 03:14 UTC',
		'signing key ····8837',
		'reused handle',
		'same build host',
		'timing matches'
	];
</script>

<!-- ── The glass ────────────────────────────────────────────────────────────
     A lens, not a visor. Barrel vignette plus a faint bloom, and nothing with
     a corner bracket in it: the insert shot's chrome says helmet, and a helmet
     is somebody who came here. This is somebody who stayed where they were. -->
{#if glass > 0.01}
	<div class="absolute inset-0" style:opacity={glass} style:background={BARREL}></div>
{/if}

<svg class="absolute inset-0 h-full w-full" viewBox="0 0 {box.w} {box.h}" preserveAspectRatio="none">
	<!-- ── The tracking box ─────────────────────────────────────────────────
	     Four corner ticks and a soft leash line, no crosshair. The distinction
	     is the whole reason this shot has no reticle: a crosshair is a claim
	     about where a shot would land, and a tracking box is a claim that
	     something is being WATCHED. Only one of those is what the card does. -->
	{#if glass > 0.05 && mark}
		{@const R = trackR}
		<g opacity={0.8 * glass}>
			{#each [
				[-1, -1],
				[1, -1],
				[-1, 1],
				[1, 1]
			] as [sx, sy] (`${sx}${sy}`)}
				<path
					d="M {mark.x + sx * R} {mark.y + sy * R * 0.55}
					   L {mark.x + sx * R} {mark.y + sy * R}
					   L {mark.x + sx * R * 0.55} {mark.y + sy * R}"
					fill="none"
					stroke={hue}
					stroke-width="1.4"
					stroke-opacity="0.85"
				/>
			{/each}
			<text
				x={mark.x - R}
				y={mark.y - R - 8}
				fill={hue}
				font-size="8.5"
				font-family="ui-monospace, monospace"
				font-weight="700"
				letter-spacing="1.6">{subject.toUpperCase()}</text
			>
		</g>
	{/if}

	<!-- ── The name going wide ──────────────────────────────────────────────
	     Rings leaving the building and running off the frame. Spaced in TIME
	     rather than in space (see `ripple`), so they read as an announcement
	     propagating rather than as a target painted on the floor. Drawn under
	     the plate: the thing travelling is the name, and the name is legible
	     in the plate — the rings are its wake, not its subject. -->
	{#if going > 0.01 && mark}
		{#each Array(RINGS) as _, i (i)}
			{@const k = ripple(elapsed, i, 1500, RINGS)}
			{#if k > 0}
				<circle
					cx={mark.x}
					cy={mark.y}
					r={trackR * 0.7 + k * Math.max(box.w, box.h) * 0.85}
					fill="none"
					stroke={hue}
					stroke-width={2.2 * (1 - k)}
					opacity={0.42 * (1 - k) * going}
				/>
			{/if}
		{/each}
	{/if}

	<!-- ── The lineup ───────────────────────────────────────────────────────
	     One portrait at a time, cycling and then settling. A row of all four
	     with a marker moving along it was the other option and it is worse: a
	     row shows you the answer set before the answer, so the collapse has
	     nothing left to reveal. One slot means the beat can only be read by
	     watching it happen. -->
	{#if showing}
		{@const settled = past('sift')}
		{@const pop = settled ? lock : 1}
		<g transform="translate({plate.x} {plate.y})" opacity={settled ? Math.min(1, lock * 1.4) : 0.9}>
			<g transform="scale({0.86 + pop * 0.14})">
				{#each figureFacets(showing, portraitFrame, suit ? { suit } : {}) as f, i (i)}
					<path d={f.d} fill={f.fill} stroke={f.edge} stroke-width="0.6" stroke-linejoin="round" />
				{/each}
			</g>
		</g>
	{/if}

	<!-- ── The plate ────────────────────────────────────────────────────────
	     Seat and name, under the portrait. During the sift it flickers with the
	     candidate; once locked it is struck through, because the point of
	     Attribution is not that you know who it is — it is that the identity is
	     now spent. `the persona cannot be worn twice` is the card's own text. -->
	{#if showing || past('sift')}
		{@const label = showing ? `${showing.seat} · ${showing.name.replace(/^The /, '')}` : 'UNATTRIBUTED'}
		{@const w = Math.max(120, label.length * 7.4 + 26)}
		{@const y = plate.y + Math.max(26, box.h * 0.05)}
		<g opacity={past('sift') ? Math.min(1, lock * 1.2) : 0.85}>
			<rect
				x={plate.x - w / 2}
				y={y}
				width={w}
				height="26"
				rx="3"
				fill="rgba(3,8,10,0.86)"
				stroke={hue}
				stroke-opacity={past('sift') ? 0.9 : 0.3}
				stroke-width={past('sift') ? 1.4 : 1}
			/>
			<text
				x={plate.x}
				y={y + 17}
				fill={hue}
				text-anchor="middle"
				font-size="11"
				font-family="ui-monospace, monospace"
				font-weight="700"
				letter-spacing="1.4">{label.toUpperCase()}</text
			>
			<!-- The strike. Drawn on the lock so it lands with the name rather than
			     after it — naming them and spending them is one act. -->
			{#if past('name') && solved}
				<line
					x1={plate.x - w / 2 + 6}
					y1={y + 13}
					x2={plate.x - w / 2 + 6 + (w - 12) * Math.min(1, lock)}
					y2={y + 13}
					stroke={hue}
					stroke-width="2"
					opacity="0.95"
				/>
			{/if}
		</g>
	{/if}

	<!-- ── The trace ────────────────────────────────────────────────────────
	     What the sift is reading, stacked down the left. Lines arrive one at a
	     time as the shortlist narrows — the evidence accumulating IS the
	     narrowing, and showing all six at once would make the collapse look
	     like it happened for no reason. -->
	{#if at >= ORDER.indexOf('sift') && phase !== 'rise'}
		{@const shown = phase === 'sift' ? Math.floor(p * TRACE.length) + 1 : TRACE.length}
		{#each TRACE.slice(0, shown) as line, i (line)}
			<text
				x="18"
				y={box.h * 0.42 + i * 15}
				fill={hue}
				opacity={0.45 + (i === shown - 1 ? 0.45 : 0.12)}
				font-size="9"
				font-family="ui-monospace, monospace"
				letter-spacing="0.8">{line}</text
			>
		{/each}
	{/if}

	<!-- ── The verdict ──────────────────────────────────────────────────────
	     The board's consequence, stated once and in the board's own numbers.
	     Held clear of the bottom strip: `FirstPerson` puts the card's word and
	     name down there for every shot, and this landed straight on top of it. -->
	{#if past('name')}
		<g opacity={phase === 'rise' ? 1 - p : Math.min(1, lock)}>
			<text
				x={box.w / 2}
				y={box.h - 106}
				fill={hue}
				text-anchor="middle"
				font-size="9"
				font-family="ui-monospace, monospace"
				font-weight="700"
				letter-spacing="2.4">{solved ? 'ATTRIBUTED' : 'NO ATTRIBUTION'}</text
			>
			{#if solved}
				<text
					x={box.w / 2}
					y={box.h - 92}
					fill={hue}
					opacity="0.6"
					text-anchor="middle"
					font-size="8"
					font-family="ui-monospace, monospace"
					letter-spacing="1.4">+{score} {unit} · THE PERSONA CANNOT BE WORN TWICE</text
				>
			{/if}
		</g>
	{/if}
</svg>
