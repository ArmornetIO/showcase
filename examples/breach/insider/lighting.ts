// ── Lighting cues — what this player's lights do ─────────────────────────────
// The map sets the lighting everybody starts from: its ambient and the lights
// its props give off. A CUE changes it for a while, and comes from one of two
// places, both naming a key from office.yaml's `cues`:
//
//  · the SERVER, on a reaction (`ReactionFrame.cue`), to the seats it decided
//    perceived the act — another player's milestone darkens the room you are
//    in, and only yours. A browser never addresses another browser's lights.
//  · THIS CLIENT, on something its own player did — walked into a zone, stepped
//    up to a station (`LocalCue`). Seen by nobody else.
//
// Pure: the scene calls `lightingFor` once a frame.
import type { Tone } from 'showcase';
import { OFFICE_DATA, type OfficeCue, type OfficeCueKey } from '../internal/office.gen.js';

export type Pattern = NonNullable<OfficeCue['pattern']>;

/** How bright a pattern is `t` seconds into `s`. */
export function lit(p: Pattern, t: number, s: number): number {
	switch (p) {
		case 'steady':
			return 1;
		case 'pulse':
			return Math.sin((Math.PI * t) / s);
		case 'strobe':
			return Math.floor(t * 10) % 2 ? 0 : 1;
		case 'flicker':
			// Off, on, off-off, on: a lamp losing power, not a metronome.
			return [0, 1, 0, 0, 1, 0, 1, 1][Math.floor((t / s) * 8)] ?? 1;
		case 'glitch':
			return Math.floor(t * 23) % 3 ? 0.2 : 1;
	}
}

/** A cue in play: what the key says, from performance.now() ms `at`. */
export type LightCue = OfficeCue & { at: number };

/** A cue by key, starting at `at`; null for a key this build does not know. */
export function cue(key: string, at: number): LightCue | null {
	const c = OFFICE_DATA.cues[key as OfficeCueKey];
	return c ? { ...c, at } : null;
}

/** A cue this client fires for its own player: on walking into `zone`, or up
 *  to `station`. */
export interface LocalCue {
	zone?: string;
	station?: string;
	cue: OfficeCueKey;
}

export interface Lighting {
	ambient: number;
	tint: Tone | null;
	/** A prop light's multiplier, by its group. */
	light: (group: string) => number;
}

/** The lighting at `now`. A cue at strength 0 changes nothing; at 1 it applies
 *  in full, so a strobe pattern swings between the two. */
export function lightingFor(cues: readonly LightCue[], base: number, now: number): Lighting {
	let ambient = base;
	let tint: Tone | null = null;
	const groups: { group?: string; k: number }[] = [];
	for (const c of cues) {
		const age = (now - c.at) / 1000;
		if (age < 0 || age > c.s) continue;
		const w = lit(c.pattern ?? 'steady', age, c.s);
		if (c.ambient !== undefined) ambient *= 1 + (c.ambient - 1) * w;
		if (c.lights !== undefined) groups.push({ group: c.group, k: 1 + (c.lights - 1) * w });
		if (c.tint && w > 0.5) tint = c.tint;
	}
	return {
		ambient,
		tint,
		light: (g) => groups.reduce((k, c) => (c.group === undefined || c.group === g ? k * c.k : k), 1)
	};
}
