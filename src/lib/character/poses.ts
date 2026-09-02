// ── character · clips ────────────────────────────────────────────────────────
// What a figure is DOING, as four angles and an offset. Nothing here knows how
// a character is built — it hands back a pose, `render.ts` applies it to
// whichever parts carry a limb tag, and a build with no legs simply has two of
// the numbers ignored.
//
// FRAMES, not time. Every drawn frame is a full cull-shade-sort pass over ~200
// facets, and `art()` memoises on its whole signature — so a clip evaluated at
// a continuous `t` would miss the cache on every tick and re-cull the model 60
// times a second for pictures it had already drawn. Quantising to a fixed
// number of steps per cycle turns the animation into a loop of N cached frames
// that costs nothing after its first pass round.

export type ClipId = 'still' | 'walk' | 'idle';

export interface Clip {
	id: ClipId;
	label: string;
	hint: string;
}

export const CLIPS: Clip[] = [
	{ id: 'still', label: 'Still', hint: 'The pose everything else is measured against.' },
	{
		id: 'walk',
		label: 'Walk',
		hint: 'Legs opposed, arms counter-swung, and the body dropping twice per cycle — once on each foot.'
	},
	{
		id: 'idle',
		label: 'Idle',
		hint: 'Breathing. A standing character that is perfectly still reads as a prop.'
	}
];

/** Steps per cycle. 24 is enough that the eye reads it as motion and small
 *  enough that the whole loop is cached after one pass. */
export const FRAMES = 24;

export interface Pose {
	/** Radians, swinging forward. Positive is toward the viewer. */
	legL: number;
	legR: number;
	armL: number;
	armR: number;
	/** Vertical offset on the whole figure, in build units. */
	bob: number;
}

export const REST: Pose = { legL: 0, legR: 0, armL: 0, armR: 0, bob: 0 };

export interface ClipOpts {
	/** Peak leg swing, radians. */
	stride: number;
	/** Peak arm swing, radians. Under the stride, always — arms that match the
	 *  legs read as a march rather than a walk. */
	swing: number;
	/** Peak vertical travel, build units. */
	bob: number;
}

export const CLIP_DEFAULTS: ClipOpts = { stride: 0.42, swing: 0.26, bob: 0.035 };

/**
 * The pose at a point in the cycle. `t` is 0..1 and expected to be quantised —
 * see the note at the top.
 *
 * The walk's body drop is at DOUBLE the limb frequency and phase-shifted a
 * quarter cycle, because a body falls once per FOOTFALL and there are two of
 * those per stride. Bobbing at the limb rate is the single most common way a
 * walk cycle ends up looking like a skate.
 */
export function poseAt(clip: ClipId, t: number, o: ClipOpts = CLIP_DEFAULTS): Pose {
	if (clip === 'still') return REST;
	const τ = Math.PI * 2 * t;

	if (clip === 'idle') {
		// No stride at all: the limbs settle and only the breath moves. An idle
		// built out of a small walk still swings its legs, which reads as a
		// character shuffling on the spot.
		const breath = Math.sin(τ);
		return {
			legL: 0,
			legR: 0,
			armL: breath * o.swing * 0.12,
			armR: breath * o.swing * 0.12,
			bob: breath * o.bob * 0.5
		};
	}

	const s = Math.sin(τ);
	return {
		legL: s * o.stride,
		legR: -s * o.stride,
		// Opposite the leg on the same side — that diagonal is what makes a walk
		// look like a walk rather than a hop.
		armL: -s * o.swing,
		armR: s * o.swing,
		bob: -Math.abs(Math.cos(τ)) * o.bob
	};
}

/** A pose's identity, for the render cache. Rounded hard: two poses that differ
 *  in the fourth decimal are the same picture. */
export function poseKey(p: Pose): string {
	const r = (n: number) => n.toFixed(3);
	return `${r(p.legL)},${r(p.legR)},${r(p.armL)},${r(p.armR)},${r(p.bob)}`;
}
