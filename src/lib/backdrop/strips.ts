// ── strips — the backdrop's strips, named and addressable ───────────────────
//
// The backdrop used to generate its strips from a seeded RNG, which is fine for
// shipping (same arrangement every load, no data to carry) and useless for
// TUNING: "make the second one bigger" has no referent when the second one is
// whatever `r()` returned that pass, and changing the count reshuffles all of
// them.
//
// So a strip is now a record with an id. The RNG survives as the way to SEED a
// starting set — `seedStrips` — but once seeded the list is data, and every
// strip can be addressed, moved and sized on its own.

import type { SvgFxType } from '../primitives/svg-fx/svg-fx.js';
import type { EdgeStyle } from '../primitives/canvas/canvas.types.js';

export interface StripSpec {
	/** Stable across edits and reorders. What "strip 2" actually means. */
	id: string;
	/** Placement in percentages of the frame, so it scales with the viewport. */
	left: number;
	top: number;
	/** Width in vw. Below ~30 the two laps overlap into an unreadable knot. */
	size: number;
	/** Fixed bearing. Not an animation — the belt moves, the object does not. */
	spin: number;
	/** Half-width of the band. Larger twists more visibly. */
	band: number;
	/** Rotation about the vertical axis, degrees. */
	yaw: number;
	/** Tilt toward the viewer. Near 0 the strip is edge-on and unreadable. */
	pitch: number;
	/** Cross-sections. What makes the twist legible and what the belt runs along. */
	rungs: number;
	/** Seconds per dash cycle of the belt. LOWER IS FASTER. */
	belt: number;
	/** Seconds for a traveller's full two-lap traversal. */
	period: number;
	/** Travellers riding this strip's edge. */
	traffic: number;
	/** Per-strip opacity, on top of `--backdrop-strength`. */
	opacity: number;
	/** Negative starts the belt mid-cycle, so strips are not in lockstep. */
	delay: number;
	/**
	 * How much of each end dissolves, 0…0.5. This is what lets several strips
	 * read as ONE ribbon passing through the frame: a strip with hard ends is
	 * obviously a separate object, whereas one that fades out where the next
	 * fades in leaves the eye to join them up. 0 keeps the strip whole.
	 */
	fade: number;
	/**
	 * The axis the fade runs along, in CSS gradient degrees (0 = up). Should
	 * point along the chain, so ends dissolve toward their neighbours rather
	 * than across the band.
	 */
	fadeAngle: number;
	/**
	 * Screen-pixel defocus for the WHOLE strip, 0 = sharp.
	 *
	 * The per-chunk depth blur inside a strip says "this edge is further than
	 * that edge". This says "this strip is further than that strip", which is a
	 * different claim and the one a spiral needs: without it a small dim strip
	 * reads as a small NEAR object rather than a large distant one, because
	 * scale and brightness alone are ambiguous and focus is not.
	 */
	blur: number;
	/**
	 * An `SvgFx` treatment over the whole strip, or `none`.
	 *
	 * SvgFx exists for exactly this: every one of its chains reads only the
	 * SOURCE ALPHA, so it works on art that was never authored for it — which a
	 * generated Möbius projection certainly was not. Reusing it beats painting
	 * gradient stops onto the band, which is the approach its own header calls
	 * "the right way to build ONE mark and the wrong way to treat fifty".
	 *
	 * Caveat worth knowing before reaching for `chrome` or `emboss`: lit effects
	 * need a shoulder to catch the light, and these strokes are hairlines. Raise
	 * `fxSize`/`softness` or expect them to read weakly.
	 */
	fx: SvgFxType | 'none';
	/** Effect magnitude, in the strip's user units. */
	fxSize: number;
	/** 0–2. Opacity for paint effects, light intensity for lit ones. */
	fxStrength: number;
	/** Paint colour for glow/outline; ignored by the lit effects. */
	fxColor: string;
	/** Metal body colour for `chrome`. */
	fxBase: string;
	/**
	 * Which LINE STYLE runs over the strip's rim, or `none`.
	 *
	 * These are the mesh's own edge styles — the same vocabulary used for a line
	 * between two agents, from `EDGE_STYLE_DASH`. Reusing them rather than
	 * inventing a dash pattern means the rhythm carries the same meaning here as
	 * it does on the canvas: a long mark with a short gap reads as moving
	 * (`energy`, `degraded`), a short mark with a long gap as intermittent or
	 * severed (`blocked`, `latent`). `encrypted` is deliberately solid.
	 */
	energy: EdgeStyle | 'none';
	/** Seconds for one dash cycle of the energy run. Lower is faster. */
	energySpeed: number;
	/** Overrides the traveller colour for the energy pass when set. */
	energyColor: string;
	/**
	 * A second, offset, hue-shifted copy of this strip — CMYK misregistration.
	 *
	 * Printing plates that do not line up leave coloured fringes on every edge,
	 * and that misalignment is the whole visual signature of the Spider-Verse
	 * look. Faking it needs the art drawn TWICE at a small offset with the
	 * copies in different hues; one pass, however colourful, only ever reads as
	 * "colourful". Costs a second render of the strip, so it is opt-in.
	 */
	ghost?: { dx: number; dy: number; hue: number; opacity: number };
}

/**
 * A complete backdrop: the strips AND the palette they were composed against.
 *
 * Presets used to be bare strip arrays, which meant a composition and its
 * colours could drift apart — loading a magenta arrangement onto the previous
 * one's green-grey floor produced something nobody designed. A vibe is both
 * halves, so it carries both.
 */
export interface BackdropPreset {
	label: string;
	strips: StripSpec[];
	/** `:root` custom properties — floor, strip, glass, traveller, cell. */
	tokens: Record<string, string>;
	rainbow: boolean;
	/** Seconds for one full hue sweep along the chain. */
	rainbowSpeed: number;
}

/** Mulberry32 — small, seeded, and good enough to place a few strips. */
function rng(s: number) {
	return () => {
		s |= 0;
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * A starting arrangement. Deterministic for a given seed, and — crucially —
 * STABLE as the count grows: strip 1 is the same strip whether you asked for
 * one or six, because each is drawn from its own RNG pass in order. Reseeding
 * the whole list on every count change is what made the old scatter untunable.
 */
export function seedStrips(count: number, seed = 7): StripSpec[] {
	const r = rng(seed);
	return Array.from({ length: count }, (_, i) => ({
		id: `s${i + 1}`,
		left: 8 + r() * 74,
		top: 10 + r() * 66,
		size: 34 + r() * 26,
		spin: -18 + r() * 36,
		band: 120 + r() * 60,
		yaw: -40 + r() * 80,
		pitch: 46 + r() * 26,
		rungs: 30,
		belt: 3.2 + r() * 2.6,
		period: 26 + r() * 26,
		traffic: 2,
		opacity: 0.5 + r() * 0.5,
		delay: -r() * 40,
		fade: 0.22,
		fadeAngle: 315,
		blur: 0,
		fx: 'glow' as const,
		fxSize: 6,
		fxStrength: 0.8,
		fxColor: 'rgba(94, 234, 212, 0.55)',
		fxBase: '#6f9aa4',
		energy: 'energy' as const,
		energySpeed: 1.6,
		energyColor: 'rgba(94, 234, 212, 0.9)'
	}));
}

/**
 * THE SPIRAL — a ribbon entering large at two opposite corners and winding
 * inward, away from the viewer, to vanish near the middle.
 *
 * ── What actually makes something recede ───────────────────────────────────
 * Four cues, and they have to agree or the eye picks the one it trusts most
 * and calls the rest a mistake:
 *
 *   SIZE      each link is ~0.68× the one before it. A constant ratio is what
 *             makes it read as equal steps into depth rather than as an
 *             arbitrary set of different-sized objects.
 *   BRIGHTNESS falls with distance, because atmosphere.
 *   FOCUS     rises with distance. This is the one that settles it: scale and
 *             brightness alone are ambiguous — a small dim thing could just be
 *             a small dim thing — but a BLURRED small dim thing is far away.
 *   BEARING   each link turns further, so the chain curls instead of pointing
 *             straight at the vanishing point. That turn is the spiral.
 *
 * Two arms rather than one, entering top-left and bottom-right, because a
 * single arm reads as a tail with a beginning; two opposed arms read as a
 * continuous band passing THROUGH the frame, which is the truer figure for
 * something that has no end.
 */
export function spiralStrips(): StripSpec[] {
	const common = {
		rungs: 30,
		traffic: 2,
		band: 150,
		belt: 3.8,
		period: 40,
		yaw: -8,
		fx: 'glow' as const,
		fxSize: 6,
		fxStrength: 0.8,
		fxColor: 'rgba(94, 234, 212, 0.55)',
		fxBase: '#6f9aa4',
		energy: 'energy' as const,
		energySpeed: 1.6,
		energyColor: 'rgba(94, 234, 212, 0.9)'
	};

	/** One arm, walking from a corner toward the centre and away from the eye. */
	const arm = (
		prefix: string,
		from: { left: number; top: number },
		to: { left: number; top: number },
		spin0: number,
		delay0: number
	): StripSpec[] =>
		[0, 1, 2].map((i) => {
			const t = i / 2;
			return {
				...common,
				id: `${prefix}${i + 1}`,
				// Eased toward the centre: the steps bunch up as they recede, which
				// is what perspective does to equal spacing.
				left: from.left + (to.left - from.left) * (t * t * 0.6 + t * 0.4),
				top: from.top + (to.top - from.top) * (t * t * 0.6 + t * 0.4),
				size: 66 * Math.pow(0.68, i),
				// Pitch rises as it goes: a further link is seen closer to edge-on.
				pitch: 56 + i * 5,
				spin: spin0 - i * 26,
				opacity: [0.85, 0.55, 0.32][i],
				blur: [0, 1.3, 2.8][i],
				// Widen the dissolve as it recedes, so the far end of the spiral
				// does not stop — it thins out until there is nothing left.
				fade: [0.24, 0.32, 0.42][i],
				fadeAngle: 315,
				delay: delay0 - i * 13
			};
		});

	return [
		...arm('a', { left: 4, top: 12 }, { left: 44, top: 44 }, 8, 0),
		...arm('b', { left: 96, top: 88 }, { left: 56, top: 56 }, -172, -6)
	];
}

/**
 * TONY'S STRIPS — the hand-tuned composition, and the one to ship.
 *
 * Derived from the spiral and then worked over by eye, so it is written out as
 * data: the values below are a judgement about how this specific arrangement
 * looks, not the output of a rule. Only the differences from `base` are listed,
 * which is what makes the three deliberate outliers legible instead of buried
 * in six near-identical blocks.
 *
 * The outliers, all intentional:
 *
 *   a1  `fxSize: 0` — glow declared but sized to nothing, so a1 alone carries
 *       no bloom while staying the same kind of object as the rest.
 *   a1  `fade: 0.02` — effectively no end dissolve. a1 sits beside a2 rather
 *       than melting into it, so the pair reads as two objects, not one band.
 *   b2  `fadeAngle: 175` — dissolves on its own axis, against the 315° every
 *       other strip shares.
 */
export function tonysStrips(): StripSpec[] {
	const base = {
		rungs: 30,
		traffic: 2,
		band: 150,
		belt: 3.8,
		period: 40,
		yaw: -8,
		fx: 'glow' as const,
		fxSize: 6,
		fxStrength: 0.8,
		fxColor: 'rgba(94, 234, 212, 0.55)',
		fxBase: '#6f9aa4',
		energy: 'energy' as const,
		energySpeed: 1.6,
		energyColor: 'rgba(94, 234, 212, 0.9)',
		fadeAngle: 315
	};

	return [
		// Turned nearly edge-on and spun across the others — the one strip that
		// is not travelling with the chain.
		{
			...base,
			id: 'a1',
			energySpeed: 1.4,
			energyColor: 'rgba(94, 234, 212, 0.9)',
			left: 17.5,
			top: 27,
			size: 20,
			spin: 119,
			yaw: -69,
			pitch: 74,
			rungs: 25,
			period: 53,
			opacity: 0.85,
			blur: 0.2,
			fade: 0.02,
			fxSize: 0,
			delay: 0
		},
		{
			...base,
			id: 'a2',
			energySpeed: 2.2,
			energyColor: 'rgba(94, 234, 212, 0.6)',
			left: 18,
			top: 23.2,
			size: 44.88,
			spin: -18,
			pitch: 61,
			opacity: 0.55,
			blur: 1.3,
			fade: 0.32,
			delay: -13
		},
		{
			...base,
			id: 'a3',
			energySpeed: 3.4,
			energyColor: 'rgba(94, 234, 212, 0.35)',
			left: 44,
			top: 44,
			size: 30.52,
			spin: -44,
			pitch: 66,
			opacity: 0.32,
			blur: 2.8,
			fade: 0.42,
			delay: -26
		},
		// The near end of the second arm: biggest, sharpest, bottom-right.
		{
			...base,
			id: 'b1',
			energySpeed: 1.4,
			energyColor: 'rgba(94, 234, 212, 0.9)',
			left: 96,
			top: 88,
			size: 66,
			spin: -172,
			pitch: 56,
			opacity: 0.85,
			blur: 0,
			fade: 0.24,
			delay: -6
		},
		{
			...base,
			id: 'b2',
			energySpeed: 1.8,
			energyColor: 'rgba(94, 234, 212, 0.8)',
			left: 42,
			top: 56,
			size: 43,
			spin: -148,
			yaw: 43,
			pitch: 46,
			opacity: 0.8,
			blur: 0.3,
			fade: 0.32,
			fadeAngle: 175,
			fxStrength: 0.7,
			delay: -19
		},
		{
			...base,
			id: 'b3',
			energySpeed: 3.4,
			energyColor: 'rgba(94, 234, 212, 0.35)',
			left: 56,
			top: 56,
			size: 30.52,
			spin: -224,
			pitch: 66,
			opacity: 0.32,
			blur: 2.8,
			fade: 0.42,
			delay: -32
		}
	];
}

/**
 * THE RIBBON — three strips reading as one band sweeping across the frame,
 * dissolving and resuming as it goes.
 *
 * ── The rule that makes it read ────────────────────────────────────────────
 * The strips must CHAIN, not INTERTWINE. Two large strips at similar scale
 * sitting on top of each other stop being two objects at different distances
 * and become one tangle — the eye cannot separate them, and the depth cue the
 * whole backdrop is built on is lost. So each is placed roughly its own radius
 * clear of the next, meeting only where their faded ends overlap.
 */
export function ribbonStrips(): StripSpec[] {
	const common = {
		rungs: 30,
		traffic: 2,
		fadeAngle: 315,
		yaw: -8,
		pitch: 58,
		blur: 0,
		fx: 'glow' as const,
		fxSize: 6,
		fxStrength: 0.8,
		fxColor: 'rgba(94, 234, 212, 0.55)',
		fxBase: '#6f9aa4',
		energy: 'energy' as const,
		energySpeed: 1.6,
		energyColor: 'rgba(94, 234, 212, 0.9)'
	};
	return [
		// Top-left: the band already in frame, largest and nearest.
		{
			...common,
			id: 's1',
			left: 6,
			top: 14,
			size: 62,
			spin: 6,
			band: 150,
			belt: 3.8,
			period: 40,
			opacity: 0.8,
			delay: 0,
			fade: 0.26
		},
		// The bridge, carrying the sweep down and across. Set clear of s1 rather
		// than over it — this is the pair that used to tangle.
		{
			...common,
			id: 's3',
			left: 36,
			top: 74,
			size: 56,
			spin: -14,
			band: 150,
			belt: 3.8,
			period: 40,
			opacity: 0.5,
			delay: -13,
			fade: 0.34
		},
		// Entering bottom-right, leaving the centre-right open. The empty middle
		// is doing as much work as the strips are: it is what stops a backdrop
		// becoming a texture that fills every pixel.
		{
			...common,
			id: 's2',
			left: 88,
			top: 82,
			size: 66,
			spin: -22,
			band: 150,
			belt: 3.8,
			period: 40,
			opacity: 0.72,
			delay: -26,
			fade: 0.28
		}
	];
}

/** One strip, centred and upright — the studio's stage. */
export function heroStrip(): StripSpec {
	return {
		id: 'hero',
		left: 50,
		top: 50,
		size: 62,
		spin: 0,
		band: 150,
		yaw: 0,
		pitch: 59,
		rungs: 30,
		belt: 4.4,
		period: 39,
		traffic: 2,
		opacity: 1,
		delay: 0,
		fade: 0,
		fadeAngle: 315,
		blur: 0,
		fx: 'glow' as const,
		fxSize: 6,
		fxStrength: 0.8,
		fxColor: 'rgba(94, 234, 212, 0.55)',
		fxBase: '#6f9aa4',
		energy: 'energy' as const,
		energySpeed: 1.6,
		energyColor: 'rgba(94, 234, 212, 0.9)'
	};
}

/**
 * Grow or shrink a list without disturbing the strips already in it. Adding a
 * strip appends a fresh one; removing takes from the end. This is the fix for
 * "adding a strip does nothing" — the count is now a list operation, not a
 * reseed that happened to be ignored in hero mode.
 */
export function resize(strips: StripSpec[], count: number, seed = 7): StripSpec[] {
	if (count === strips.length) return strips;
	if (count < strips.length) return strips.slice(0, count);
	const grown = seedStrips(count, seed);
	// Keep every existing strip exactly as edited; take only the new tail.
	return [...strips, ...grown.slice(strips.length).map((s, i) => ({ ...s, id: `s${strips.length + i + 1}` }))];
}

// ── The vibes ───────────────────────────────────────────────────────────────
// Three art-directed treatments. Each is a composition AND a palette, because
// half of one with half of another is a look nobody chose.

/** Shared skeleton. Every vibe overrides most of this; it exists so the three
 *  differ by INTENT rather than by which fields somebody remembered to set. */
const VIBE_BASE = {
	rungs: 30,
	traffic: 1,
	band: 150,
	yaw: -8,
	pitch: 58,
	fx: 'glow' as const,
	fxSize: 6,
	fxStrength: 0.8,
	fxColor: 'rgba(94, 234, 212, 0.55)',
	fxBase: '#6f9aa4',
	fadeAngle: 315,
	energySpeed: 3,
	blur: 0
};

/**
 * OFF-KILTER SIGNAL — Mr. Robot.
 *
 * Watched by something patient, and the frame itself uneasy about where you
 * are standing.
 *
 * THE RULE: never centre anything. Mass and void, not balance — the show's
 * headroom framing, where the subject is jammed into a corner and the empty
 * two-thirds does the talking. Symmetry kills it instantly, so the three
 * strips cluster hard into the lower-left and the right of the frame is left
 * deliberately, uncomfortably bare.
 *
 * `latent` (1 8) is the energy style on purpose: a short mark against a long
 * gap reads as intermittent — a signal that is present but not continuous,
 * which is a very different claim from `energy`'s steady flow.
 */
export function mrRobotStrips(): BackdropPreset {
	const base = {
		...VIBE_BASE,
		belt: 18,
		period: 70,
		energy: 'latent' as const,
		energySpeed: 22,
		energyColor: 'rgba(245, 185, 66, 0.85)',
		fxColor: 'rgba(120, 150, 110, 0.4)',
		fxSize: 4,
		fxStrength: 0.5
	};
	return {
		label: 'Off-kilter signal',
		rainbow: false,
		rainbowSpeed: 40,
		tokens: {
			'--backdrop-line': 'rgba(90, 110, 100, 0.05)',
			'--backdrop-strip': 'rgba(120, 150, 110, 0.4)',
			'--backdrop-glass': 'rgba(20, 30, 24, 0.08)',
			'--backdrop-traveller': 'rgba(245, 185, 66, 0.7)',
			'--backdrop-cell': '46px',
			'--backdrop-strength': '0.9'
		},
		strips: [
			// The dominant mass, pushed off the bottom-left corner.
			{ ...base, id: 'r1', left: 14, top: 78, size: 85, spin: -14, pitch: 62,
			  opacity: 0.75, blur: 0, fade: 0.2, delay: 0, traffic: 1 },
			// Two shrinking fast — the falloff is steep, not graded, so the eye
			// reads a cluster rather than a procession.
			{ ...base, id: 'r2', left: 30, top: 54, size: 34, spin: 8, pitch: 55,
			  opacity: 0.45, blur: 1.4, fade: 0.34, delay: -7, traffic: 0 },
			{ ...base, id: 'r3', left: 38, top: 40, size: 15, spin: 26, pitch: 48,
			  opacity: 0.28, blur: 2.6, fade: 0.42, delay: -14, traffic: 0 }
		]
	};
}

/**
 * LAUNCH-DAY OPTIMISM — Silicon Valley.
 *
 * Everything tracking up and to the right, synchronised, still bright-eyed
 * about the numbers.
 *
 * THE RULE: synchrony, not variety. Every strip fires on the SAME beat —
 * identical belt, identical energy speed, and `delay: 0` throughout. That is
 * the one place this treatment deliberately breaks the rest of the system's
 * habit of staggering everything: the optimism reads through unison, and a
 * staggered version of this is just a busy background.
 */
export function siliconValleyStrips(): BackdropPreset {
	const base = {
		...VIBE_BASE,
		belt: 6,
		period: 22,
		traffic: 5,
		energy: 'scanning' as const,
		energySpeed: 4,
		energyColor: 'rgba(251, 146, 60, 0.9)',
		fxColor: 'rgba(125, 211, 252, 0.5)',
		// Phase-locked: no per-strip delay anywhere in this vibe.
		delay: 0,
		fade: 0.26,
		pitch: 58
	};
	// An even grid across the full width, receding gently 60vw → 20vw.
	const cols = [8, 24, 40, 56, 72, 88, 96];
	return {
		label: 'Launch-day optimism',
		rainbow: true,
		rainbowSpeed: 10,
		tokens: {
			'--backdrop-line': 'rgba(126, 150, 142, 0.08)',
			'--backdrop-strip': 'rgba(125, 211, 252, 0.55)',
			'--backdrop-glass': 'rgba(253, 186, 116, 0.06)',
			'--backdrop-traveller': 'rgba(251, 146, 60, 0.9)',
			'--backdrop-rainbow-base': 'hsl(198 92% 74%)',
			'--backdrop-cell': '30px',
			'--backdrop-strength': '0.85'
		},
		strips: cols.map((left, i) => ({
			...base,
			id: `v${i + 1}`,
			left,
			top: 30 + i * 6,
			size: 60 - i * 6.6,
			spin: -10 + i * 3,
			opacity: 0.8 - i * 0.06,
			blur: i * 0.35
		}))
	};
}

/**
 * MISREGISTERED CHORUS — Into the Spider-Verse.
 *
 * The image fighting itself: colour, line and motion each landing a half-beat
 * apart, like a comic panel shot through a prism.
 *
 * THE RULE: every strip is actually TWO — a base pass and a hue-shifted
 * duplicate offset a few pixels. That is printing plates out of register, and
 * it is the entire signature. Without it the treatment is merely colourful,
 * which is not the reference.
 *
 * Size falloff JUMPS rather than grades — 110vw beside 20vw with no middle
 * step — because a smooth recession reads as depth, and this look wants
 * flatness with abrupt scale changes, the way a comic page cuts between a
 * splash panel and an inset.
 */
export function spiderVerseStrips(): BackdropPreset {
	const base = {
		...VIBE_BASE,
		belt: 3,
		period: 16,
		traffic: 6,
		energy: 'degraded' as const,
		energySpeed: 2.5,
		energyColor: 'rgba(253, 224, 71, 0.95)',
		fxColor: 'rgba(255, 47, 176, 0.6)',
		fxSize: 8,
		fxStrength: 1.1,
		fade: 0.2,
		ghost: { dx: 5, dy: -4, hue: 140, opacity: 0.55 }
	};
	return {
		label: 'Misregistered chorus',
		rainbow: true,
		rainbowSpeed: 4,
		tokens: {
			'--backdrop-line': 'rgba(120, 90, 140, 0.07)',
			'--backdrop-strip': 'rgba(255, 47, 176, 0.6)',
			'--backdrop-glass': 'rgba(34, 211, 238, 0.05)',
			'--backdrop-traveller': 'rgba(253, 224, 71, 0.95)',
			'--backdrop-rainbow-base': 'hsl(322 100% 60%)',
			'--backdrop-cell': '26px',
			'--backdrop-strength': '1'
		},
		// Irregular, not gridded. The jumps are the point: 110 → 20 → 74 → 26.
		strips: [
			{ ...base, id: 'p1', left: 22, top: 30, size: 110, spin: -18, pitch: 64, opacity: 0.9, delay: 0 },
			{ ...base, id: 'p2', left: 62, top: 22, size: 20, spin: 42, pitch: 44, opacity: 0.85, delay: -3 },
			{ ...base, id: 'p3', left: 78, top: 72, size: 74, spin: -128, pitch: 60, opacity: 0.8, delay: -6 },
			{ ...base, id: 'p4', left: 40, top: 84, size: 26, spin: 96, pitch: 40, opacity: 0.75, delay: -9 },
			{ ...base, id: 'p5', left: 92, top: 40, size: 58, spin: -64, pitch: 52, opacity: 0.7, delay: -12 }
		]
	};
}
