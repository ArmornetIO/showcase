// ── character · status ───────────────────────────────────────────────────────
// What a figure is FEELING, as a colour on the one lit surface it has.
//
// THE RULE, and the reason this is worth having at all: status owns the LAMP,
// never the plate. The plate is identity — it is how you tell the Architect
// from the Handler at a glance across a board — and a state that repainted it
// would mean an alarmed character was no longer recognisably itself. The visor
// is the only feature on the model and the only thing that emits, so it is
// exactly the surface a state belongs on: the character stays who it is and
// its face tells you what is happening to it.
//
// A pulse rather than a second colour for urgency. Two hues would need the eye
// to learn a code; a thing flashing faster is understood by anybody who has
// ever seen a warning light.

export type StatusId = 'nominal' | 'alert' | 'hostile' | 'down';

export interface Status {
	id: StatusId;
	label: string;
	hint: string;
	/** Overrides the visor and any hover pad. `null` keeps the character's own
	 *  plate colour, which is what "nothing is happening" looks like. */
	lamp: string | null;
	/** Peak brightness swing, as a fraction. 0 holds steady. */
	pulse: number;
	/** Pulses per second. Faster reads as more urgent with no legend to learn. */
	rate: number;
	/** Steady-state brightness. Below 1 the lights are going out. */
	level: number;
}

export const STATUSES: Status[] = [
	{
		id: 'nominal',
		label: 'Nominal',
		hint: 'Nothing is happening. The visor sits at the character’s own colour.',
		lamp: null,
		pulse: 0,
		rate: 0,
		level: 1
	},
	{
		id: 'alert',
		label: 'Alert',
		hint: 'Something has been noticed. Amber, breathing slowly — a warning, not an emergency.',
		lamp: '#FBBF24',
		// The trough of a pulse still has to read as LIT. Swinging down to half
		// brightness makes the visor look dirty rather than dim, and a warning
		// light that looks broken half the time is worse than a steady one.
		pulse: 0.26,
		rate: 1,
		level: 1.08
	},
	{
		id: 'hostile',
		label: 'Hostile',
		hint: 'About to act on you. Red and fast: the flash rate is the urgency, so nobody has to learn what the colour means.',
		lamp: '#EF4444',
		pulse: 0.38,
		rate: 2.6,
		level: 1.2
	},
	{
		id: 'down',
		label: 'Down',
		hint: 'Out of the fight. Not a colour so much as an absence — the visor stops being the brightest thing on the model, which is the only cue that reads instantly at board size.',
		lamp: '#64748B',
		pulse: 0,
		rate: 0,
		level: 0.42
	}
];

export const statusById = (id: StatusId): Status =>
	STATUSES.find((s) => s.id === id) ?? STATUSES[0];

/**
 * Lamp brightness at a point in the pulse, quantised the way poses are.
 *
 * `beat` is a whole number of steps; `steps` is how many make one pulse. Both
 * are integers for the same reason `poseAt` takes a frame — see `poses.ts`.
 * A continuous phase here would defeat the render cache exactly as thoroughly
 * as a continuous pose does.
 */
export function lampLevel(s: Status, beat: number, steps: number): number {
	if (!s.pulse) return s.level;
	// Sine rather than a square wave: a hard on/off flash at 2.6Hz is a strobe,
	// and a strobe is a thing you look away from.
	return s.level + s.pulse * Math.sin((Math.PI * 2 * (beat % steps)) / steps);
}
