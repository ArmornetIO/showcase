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

import type { CharacterSkin } from 'showcase';

/**
 * An operator as a shot needs to show one. A roster `Klass` satisfies this
 * as-is, which is the point: the figure that resolves out of a sift is the same
 * record the select screen drew, down to the plate colour.
 */
export type Operator = CharacterSkin & { seat: string };

/** A shortlist, and the one it comes down to. `answer` indexes `suspects`. */
export interface Lineup {
	suspects: Operator[];
	answer: number;
}

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
	/** The card's headline number and its three-or-four character name, straight
	 *  off `CardFx`. A shot that states a consequence has to state the BOARD's
	 *  one — "sealed · 2 RNDS" invented in the overlay is a lie the player finds
	 *  out about two turns later. */
	power: number;
	powerLabel: string;
	/**
	 * WHO is standing there, as the roster knows them.
	 *
	 * The class, not the card's squad. A card's `squad.shape` says what the
	 * little figures CROSSING the board look like — three runners, four drones —
	 * and it is the wrong question for a shot of one named operator: Zero-Day
	 * Reserve deploys a `brute`, and the Handler the player picked off the select
	 * screen is a hooded `ghost` in orange. Handing the scene the Klass means the
	 * person in the cutaway is the person on the roster tile, geometry and plate
	 * colour and all, because both ends now render the same `CharacterSkin`.
	 */
	skin: CharacterSkin;
	/**
	 * The people this shot might NAME, and which of them it lands on.
	 *
	 * Only the `unmask` staging reads it, and it is the one thing a shot has ever
	 * needed that is not about the actor or the target: Attribution's whole act
	 * is putting a name on somebody who is not in the frame. Optional because a
	 * host that cannot answer — a fogged beat, a preview with no board state —
	 * must still be able to stage something rather than throw.
	 */
	lineup?: Lineup;
	/** Override the shared suit grey. Unset in the game — every operator wears
	 *  the one suit, which is what makes four plate colours read as a roster
	 *  rather than as four unrelated toys. It exists for the character studio,
	 *  where the whole point is to turn the knob and look. */
	suit?: string;
	/** How to stage it. See `ShotKind`. */
	shot: ShotKind;
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
 * HOW the shot is staged — what the body does, as opposed to where in the
 * resolution it sits.
 *
 * Separate from `PovBeat` because they answer different questions and a card
 * picks both. And separate from the card's `hue` and `word` in `fx.ts` for the
 * same reason `POV_CARDS` is: a shot is a piece of direction, not a property of
 * the card, and the moment a `shot` field sits next to `icon` somebody will give
 * one to all seventeen.
 *
 *   insert    Fly to the operator, dive into them, turn onto the target. The
 *             military cutaway: streaks, a lock-on, shoulders in the frame.
 *   blackout  Nobody flies anywhere. You are already low, and you close the
 *             distance on foot — a crouched gait, a look along the wall, two
 *             hands into frame, and the building's power goes out. No weapon
 *             and no reticle: a reticle is a promise of violence, and this card
 *             does not commit one. What it takes is the LINK.
 *   unmask    Nobody moves AT ALL, and the camera never reaches the surface.
 *             You were already watching, from a remove, through a long lens.
 *             What changes is not where you are — it is that a shortlist
 *             collapses onto one person and the name goes public. The right
 *             sentence for the one signature that resolves into KNOWING rather
 *             than into doing: an approach would be a lie about what the card
 *             does, because the approach already happened.
 *   implant   An unhurried walk in, a block of source becoming bytes in the air
 *             in front of you, and it seeps into the tree and STAYS. The only
 *             staging that ends by showing a consequence being ACCEPTED rather
 *             than inflicted — the last frame is a review passing a diff nobody
 *             read. `STROLL`, not `CREEP`: nobody audits a friend.
 */
export type ShotKind = 'insert' | 'blackout' | 'unmask' | 'implant';

/** A card's cutaway: where it sits, what it looks like, and whether that look
 *  was chosen for it or merely borrowed. */
export interface Cut {
	at: PovBeat;
	shot: ShotKind;
	/**
	 * The staging has not been written for this card yet — it is wearing another
	 * card's shot so that the entry exists and can be looked at.
	 *
	 * A flag rather than an absence because the alternative is worse both ways:
	 * leaving the card out of the table means the preview cannot list it and
	 * nobody sees what is missing, and leaving it in unmarked means a borrowed
	 * shot quietly becomes the intended one the first time somebody reads the
	 * table and assumes it was designed.
	 */
	draft?: boolean;
}

/**
 * Which cards get a cutaway: THE SIGNATURE POWERS, all four of them, and
 * nothing else.
 *
 * The old table was two hand-picked keys and a paragraph asking the next person
 * to be sparing. That is not a rule, it is a hope — and a table whose only
 * defence is a comment gets a third entry, then a fifth, and by then the most
 * expensive punctuation the board has is a loading screen between turns.
 *
 * A signature is the right unit because the rules already enforce the rarity.
 * Every one is `uses: 1`: one class has it, they burn it once, and it is gone
 * for the rest of the game. So the ceiling is four cutaways per match no matter
 * how anybody plays, and it does not depend on anybody's restraint. It is also
 * the fair unit — pinning the cutaway to red's loudest card and nothing else
 * made the cinematography a reward for aggression, which is an opinion about
 * the game that nobody wrote down and nobody agreed to.
 *
 * The cost is that a card can no longer earn one on merit. Quarantine had the
 * blackout shot and lost it here; the shot moved to Segment, which is the same
 * act — severing a building's connectivity — done by a class whose signature it
 * actually is. `word: 'cuts'` was already on that card.
 *
 * `povTableProblems` below is what keeps this honest; `cinema.spec.ts` fails if
 * it ever returns anything.
 */
export const POV_CARDS: Partial<Record<string, Cut>> = {
	// The Maintainer plants corrupt test data and walks away. The shot about
	// leaving something behind — and about it being waved through.
	fixture: { at: 'full', shot: 'implant' },
	// Burned. Once, loudly, and gone. The dive, the streaks, the lock-on.
	zeroday: { at: 'full', shot: 'insert' },
	// The Architect cuts the building off the network and it stays cut. No
	// weapon, no reticle: a crouched approach, two hands, and the lights go out.
	segment: { at: 'full', shot: 'blackout' },
	// The Threat Hunter names who did it. Watched from a remove, a shortlist
	// collapsing, and then the name goes everywhere.
	attribute: { at: 'full', shot: 'unmask' }
};

/**
 * Everything wrong with the table above, in plain sentences.
 *
 * Returned rather than thrown. A mismatch here is a content bug — somebody
 * renamed a power, or added a cutaway to a card that has no business having
 * one — and the cost of getting it wrong is a shot that does not play. Throwing
 * at module load would turn that into a blank game for every player, which is a
 * far worse failure than the one being guarded against. The test is where this
 * should stop a change, and the test is where it does.
 *
 * `signatures` is passed in rather than imported so this file keeps knowing
 * nothing about the ruleset — `cinema.ts` is the port every host installs, and
 * a port that drags the rules in has stopped being one.
 */
export function povTableProblems(signatures: string[]): string[] {
	const out: string[] = [];
	for (const key of Object.keys(POV_CARDS)) {
		if (!signatures.includes(key)) {
			out.push(`${key} has a cutaway but is not a signature power`);
		}
	}
	for (const key of signatures) {
		if (!POV_CARDS[key]) out.push(`${key} is a signature power with no cutaway`);
	}
	return out;
}
