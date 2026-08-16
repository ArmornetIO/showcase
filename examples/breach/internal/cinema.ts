// ── The cinema port ──────────────────────────────────────────────────────────
// A resolution can cut to a first-person shot partway through, and the thing
// that plays that shot is a Svelte component holding a WebGL camera. The match
// must not know that.
//
// So the match calls a port. A host that can play a scene installs one; a host
// that cannot — a headless test, a board with no POV component mounted, the
// storyboard — installs nothing, and every call becomes a no-op that resolves
// immediately. The rules run identically either way, which is the property that
// makes the runtime testable in Node.

import type { UnitShape } from './fx.js';

/** What the shot needs to know to stage itself. Ids, names and a hue — nothing
 *  in here is a DOM node or a camera. */
export interface Scene {
	/** Structure the operator sets off from; null when they are already there. */
	fromId: string | null;
	structureId: string;
	actor: string;
	seat: string;
	subject: string;
	origin?: string;
	card: string;
	word: string;
	hue: string;
	shape: UnitShape;
}

/**
 * WHERE in a resolution the shot sits.
 *
 *   prelude   Before the board moves. A title card for the card being played.
 *   roll      Opens once the squad is standing at the building, so you watch
 *             the dice land from inside the body.
 *   verdict   Opens after the dice settle — the consequence, at eye level.
 *   full      Opens before anything and stays up for the whole resolution.
 *
 * Anything that opens mid-resolution stays open to the end; only `prelude`
 * closes early. That rule is what keeps this from needing a scheduler.
 */
export type PovBeat = 'prelude' | 'roll' | 'verdict' | 'full';

export interface CinemaPort {
	enter(scene: Scene): Promise<void>;
	hold(ms?: number): Promise<void>;
	leave(): Promise<void>;
	cut(): void;
}

/** The port a host installs when it has no way to play a scene. Every method
 *  resolves immediately, so `perform()` runs its beats and nothing is staged. */
export const NO_CINEMA: CinemaPort = {
	async enter() {},
	async hold() {},
	async leave() {},
	cut() {}
};

/**
 * Cards that get a shot, and why this is a table rather than a flag on the card.
 *
 * A first-person cut is the most expensive punctuation the board has, and its
 * value is entirely in how rarely it fires — put one on every attack and the
 * fourth one is a loading screen. So the list is short on purpose and lives
 * here rather than in `fx.ts`: which cards deserve a cutaway, and where in the
 * beat it belongs, is an editorial call about pacing rather than a property of
 * the card, and the moment it sits next to `hue` and `word` somebody will fill
 * it in for all seventeen.
 *
 * Zero-Day Reserve earns the first one. It is a single operator rather than a
 * squad, it is burned in one use, and it costs the Handler their whole turn.
 */
export const POV_CARDS: Partial<Record<string, PovBeat>> = { zeroday: 'full' };
