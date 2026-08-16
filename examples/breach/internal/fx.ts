// ── /examples/breach · combat feel ────────────────────────────────────────
// Seventeen cards × four outcomes is an animation matrix nobody finishes. So
// nothing here is per-card CODE — there are five primitives, and a card is a row
// in a table that says which ones it uses and in what colour. Distinct feel,
// one renderer.
//
// The primitives, and what each one is FOR:
//
//   vector   Something travels from where the actor stands to what they touched.
//            This is the only beat that says WHO did it and FROM WHERE, which is
//            the fact a map-based game exists to show.
//   impact   The moment of contact. Says the action ARRIVED, before saying
//            whether it worked — those are two different beats and collapsing
//            them is why turn-based games feel dead.
//   verdict  ward (it held) or breach (it did not). The loudest thing on screen.
//   word     One word in the card's own voice, at the point of contact. Cheaper
//            than any animation and carries more of the card's identity.
//   tick     The meter counts up instead of jumping. A number that snaps was
//            never watched.
//
// Everything is CSS/SVG on a requestAnimationFrame position read. No library.

/** How a card's squad gets to the building — the shape of its approach. */
export type VectorKind =
	/** Runs. Fast, straight, in the open: a strike, aimed and arriving. */
	| 'trace'
	/** Creeps. Slow, low, half-transparent — the quiet half of an intrusion. */
	| 'seep'
	/** Does not travel at all: it was already inside, or it is being bought on the
	 *  spot. The squad fades in ON the building. */
	| 'none'
	/** Fans into a ring around the building rather than closing on it — recon
	 *  circles a place, it does not charge it. */
	| 'sweep';

/** What the little guys look like. Four silhouettes, drawn as raw SVG points —
 *  enough that a player can tell a swarm of contributors from one operator with
 *  a zero-day at a glance, which is the entire job. */
export type UnitShape = 'runner' | 'brute' | 'drone' | 'ghost';

export interface Squad {
	count: number;
	shape: UnitShape;
}

/** The silhouettes themselves, in local space pointing +x. Raw SVG points, no
 *  assets — four polygons is the whole unit art budget.
 *
 *  Here rather than in the renderer because there is now more than one renderer:
 *  the board draws them as figures crossing to a building, and the first-person
 *  scene draws the SAME four as the body you are standing in. Two copies of a
 *  point list is two units that drift apart. */
export const UNIT_POINTS: Record<UnitShape, string> = {
	runner: '9,0 -3,-5 -1,0 -3,5',
	brute: '8,0 2,-7 -6,-5 -6,5 2,7',
	drone: '7,0 0,-5 -5,0 0,5',
	ghost: '6,0 -2,-4 -4,0 -2,4'
};

/** How wide a body of each kind reads from INSIDE it — the shoulder half-span and
 *  forearm thickness of the thing whose eyes you are looking through, in fractions
 *  of the frame's width. The silhouettes above are a plan view and say nothing
 *  about that, and a ghost with a brute's shoulders is not the class the player
 *  picked.
 *
 *  Kept well under a third of the frame each side. Past that a pair of shoulders
 *  stops reading as a person in the shot and starts reading as a wall the shot is
 *  being taken over — which is a different, much less interesting picture. */
export const UNIT_BUILD: Record<UnitShape, { shoulder: number; arm: number }> = {
	runner: { shoulder: 0.21, arm: 0.055 },
	brute: { shoulder: 0.29, arm: 0.085 },
	drone: { shoulder: 0.15, arm: 0.035 },
	ghost: { shoulder: 0.18, arm: 0.045 }
};

/**
 * What a card LEAVES BEHIND — the line between a combat card and an action card,
 * and the most important editorial call in the deck.
 *
 *   implant   Red plants a thing and the thing stays. Obfuscated Test Fixture is
 *             corrupt test data sitting in the tree: it does not leave when the
 *             turn ends, it sits in the background indefinitely, and the counter
 *             is somebody reading the code. Hidden until the foothold is turned
 *             over.
 *   garrison  Blue posts people and they stand there. The Architect's "+3 WALL"
 *             IS three figures on the wall — visible to both sides, worth a point
 *             of hardening each, and removable.
 *   nothing   An action. The squad crosses, does the thing, and withdraws: a
 *             sweep looks and moves on, a zero-day is burned, a contributor
 *             merges a patch and goes home. What persists is a NUMBER, or a
 *             foothold the board already marks — not a body.
 *
 * The test for which one a card gets is not "is it an attack" — it is "would
 * something still be there tomorrow".
 */
export type Leaves = 'implant' | 'garrison' | 'nothing';

export type ImpactKind =
	/** Hard ring + spokes. Something hit something. */
	| 'burst'
	/** Soft filled bloom. A control was bought, not thrown. */
	| 'bloom'
	/** Concentric arcs, no colour of its own. Looking, not touching. */
	| 'scan'
	| 'none';

export interface CardFx {
	/** Combat card or action card — see `Leaves`. */
	leaves: Leaves;
	vector: VectorKind;
	impact: ImpactKind;
	/** The card's hue. Drives the vector, the impact and the word together, which
	 *  is most of why two cards using the same primitives still read apart. */
	hue: string;
	/** The card's voice at the point of contact. Present tense, one or two words. */
	word: string;
	/** The card's face. One glyph, and the thing a player recognises in a fanned
	 *  hand long before they can read the name. */
	icon: string;
	/** The headline number in the card's bottom-left gem — what this card is WORTH.
	 *  For anything that rolls it is the roll bonus; for a control it is the size
	 *  of the effect. A card face carries numbers, not sentences: the sentence is
	 *  what the detail panel is for, and a hand of paragraphs cannot be read at a
	 *  glance no matter how well it is written. */
	power: number;
	/** Three or four characters naming that number. */
	powerLabel: string;
	/** Who actually goes and does it. Playing a card puts BODIES on the board —
	 *  they cross to the building, they hit it, and the roll happens while they
	 *  are hitting it. A number that changes after a line is drawn is a
	 *  spreadsheet; three little figures running at a building and swinging is a
	 *  fight, and it is the same maths either way. */
	squad: Squad;
}

/** Fallbacks by faction, so a card added later is never invisible. */
export const DEFAULT_FX: Record<'red' | 'blue', CardFx> = {
	red: {
		leaves: 'nothing',
		vector: 'trace',
		impact: 'burst',
		hue: '#FB7185',
		word: 'strike',
		icon: 'zap',
		power: 0,
		powerLabel: 'ROLL',
		squad: { count: 3, shape: 'runner' }
	},
	blue: {
		leaves: 'nothing',
		vector: 'none',
		impact: 'bloom',
		hue: '#38BDF8',
		word: 'control',
		icon: 'shield',
		power: 0,
		powerLabel: 'HOLD',
		squad: { count: 3, shape: 'brute' }
	}
};

export const CARD_FX: Record<string, CardFx> = {
	// ── The Maintainer ────────────────────────────────────────────────────────
	// An ACTION: the contributor merges the patch and goes home. What is left
	// behind is a number (REP), not a body.
	// prettier-ignore
	contribution: { leaves: 'nothing', vector: 'none', impact: 'bloom', hue: '#FBBF24', word: 'helps', icon: 'check', power: 3, powerLabel: 'REP', squad: { count: 3, shape: 'runner' } },
	// Also an action — a conversation happened, the maintainer got tired, the
	// hardening moved. Nobody is standing in the repo afterwards.
	// prettier-ignore
	pressure: { leaves: 'nothing', vector: 'seep', impact: 'bloom', hue: '#F472B6', word: 'persuades', icon: 'users', power: -3, powerLabel: 'WALL', squad: { count: 4, shape: 'ghost' } },
	// THE implant. It creeps in and it does not leave — corrupt test data sits in
	// the tree, in the background, indefinitely, and the only thing that gets it
	// out is somebody reading the code. Everything about this card is that fact.
	// prettier-ignore
	fixture: { leaves: 'implant', vector: 'seep', impact: 'burst', hue: '#F472B6', word: 'plants', icon: 'package', power: 3, powerLabel: 'ATK', squad: { count: 2, shape: 'ghost' } },
	// A strike: the divergence happens at build time and is gone. What persists is
	// the foothold it won, which the board already marks.
	// prettier-ignore
	divergence: { leaves: 'nothing', vector: 'trace', impact: 'burst', hue: '#F472B6', word: 'diverges', icon: 'layers', power: 4, powerLabel: 'ATK', squad: { count: 3, shape: 'runner' } },

	// ── The Handler ───────────────────────────────────────────────────────────
	// Living off the land uses nothing foreign — nothing foreign is left either.
	// prettier-ignore
	lotl: { leaves: 'nothing', vector: 'none', impact: 'burst', hue: '#FB923C', word: 'inhabits', icon: 'home', power: 1, powerLabel: 'ATK', squad: { count: 3, shape: 'ghost' } },
	// An implant whose whole point is the waiting. It sits there, inert, and a
	// sweep cannot find it for two rounds.
	// prettier-ignore
	sleeper: { leaves: 'implant', vector: 'seep', impact: 'none', hue: '#FB923C', word: 'sleeps', icon: 'snowflake', power: 1, powerLabel: 'ATK', squad: { count: 2, shape: 'ghost' } },
	// prettier-ignore
	ca: { leaves: 'nothing', vector: 'trace', impact: 'bloom', hue: '#FB923C', word: 'signs', icon: 'key', power: -4, powerLabel: 'WALL', squad: { count: 2, shape: 'drone' } },
	// Burned. Once, loudly, and gone — the card that most deserves to leave
	// nothing on the board is the one that cost the most to play.
	// prettier-ignore
	zeroday: { leaves: 'nothing', vector: 'trace', impact: 'burst', hue: '#EF4444', word: 'burns', icon: 'flame', power: 6, powerLabel: 'ATK', squad: { count: 1, shape: 'brute' } },

	// ── The Architect ─────────────────────────────────────────────────────────
	// A GARRISON: the +3 is three people standing on the wall, visible to both
	// sides, and red gets the number back down by taking them off it.
	// prettier-ignore
	harden: { leaves: 'garrison', vector: 'none', impact: 'bloom', hue: '#38BDF8', word: 'holds', icon: 'shield', power: 3, powerLabel: 'WALL', squad: { count: 3, shape: 'brute' } },
	// prettier-ignore
	segment: { leaves: 'nothing', vector: 'trace', impact: 'bloom', hue: '#38BDF8', word: 'cuts', icon: 'filter', power: 2, powerLabel: 'RNDS', squad: { count: 2, shape: 'drone' } },
	// prettier-ignore
	attest: { leaves: 'nothing', vector: 'sweep', impact: 'scan', hue: '#38BDF8', word: 'attests', icon: 'fingerprint', power: 1, powerLabel: 'SITE', squad: { count: 3, shape: 'drone' } },
	// prettier-ignore
	rebuild: { leaves: 'nothing', vector: 'none', impact: 'bloom', hue: '#38BDF8', word: 'rebuilds', icon: 'code', power: 1, powerLabel: 'EVICT', squad: { count: 4, shape: 'brute' } },

	// ── The Threat Hunter ─────────────────────────────────────────────────────
	// Recon is an action by definition: they look, and then they are somewhere
	// else looking at something else. A hunter who stays is a guard.
	// prettier-ignore
	sweep: { leaves: 'nothing', vector: 'sweep', impact: 'scan', hue: '#34D399', word: 'sweeps', icon: 'radar', power: 1, powerLabel: 'RGN', squad: { count: 4, shape: 'drone' } },
	// The code review. This is the counter to the fixture, and it is an action —
	// reading the tree does not leave anybody in it.
	// prettier-ignore
	diff: { leaves: 'nothing', vector: 'trace', impact: 'scan', hue: '#34D399', word: 'compares', icon: 'search', power: 1, powerLabel: 'SITE', squad: { count: 2, shape: 'drone' } },
	// A seal is a thing that stays until it lapses, and it is staffed.
	// prettier-ignore
	quarantine: { leaves: 'garrison', vector: 'none', impact: 'bloom', hue: '#A78BFA', word: 'seals', icon: 'lock', power: 2, powerLabel: 'RNDS', squad: { count: 2, shape: 'brute' } },
	// prettier-ignore
	attribute: { leaves: 'nothing', vector: 'trace', impact: 'burst', hue: '#34D399', word: 'names', icon: 'flag', power: 1, powerLabel: 'WIN', squad: { count: 2, shape: 'runner' } }
};

export const fxFor = (key: string, faction: 'red' | 'blue'): CardFx =>
	CARD_FX[key] ?? DEFAULT_FX[faction];

// ── Choreography ─────────────────────────────────────────────────────────────
// One resolution, in milliseconds. The budget is 1.5s for a contested action and
// 0.9s for an uncontested one, and it is defended like this: a turn-based game
// can afford a beat the player is READING, and cannot afford a beat they are
// WAITING OUT. Every window below has something new in it.
//
//   0     the squad leaves the actor's ground         — who is doing this
//   880   they reach the building, impact fires       — and to what
//   1000  dice roll into the region                   — the question
//   1900  dice settle                                 — the answer
//   1980  three swings, on the beat                   — the answer carried out
//   2600  ward or breach, on the last swing           — what it meant
//   2880  meters tick, log row slides in              — the consequence
//   3180  input unlocks
//
// Order matters more than duration here. The dice are rolled BEFORE the squad
// swings, not during: a squad that attacks while the dice are still bouncing has
// visibly already decided, which makes the roll decoration. Rolling first turns
// the swing into the outcome being carried out, and that is the difference
// between watching a fight and watching a number change.

export const BEATS = {
	cast: 0,
	/** Squad reaches the building and squares up to it. */
	arrive: 880,
	/** The dice are rolled into the region. */
	diceStart: 1000,
	/** They have stopped rolling — the number is known. */
	diceSettle: 1900,
	/** ONLY NOW do they swing. The roll is the question and the swing is the
	 *  answer being carried out; a squad that attacks while the dice are still
	 *  bouncing has already decided, and the dice are decoration. */
	strike: 1980,
	/** Ward or breach, landing on the last swing. */
	verdict: 2600,
	after: 2880,
	unlock: 3180
} as const;

/** Bought, not thrown: no fight to watch, but the roll still decides first and
 *  the work still happens after it. */
export const QUIET_BEATS = {
	cast: 0,
	arrive: 700,
	diceStart: 760,
	diceSettle: 1660,
	strike: 1720,
	verdict: 1980,
	after: 2180,
	unlock: 2480
} as const;

/** How long the squad keeps hitting before the dice are read. */
export const STRIKE_WINDOW = 600;
/** Swings per attack, evenly spread across that window. */
export const SWINGS = 3;

export type Beats = typeof BEATS | typeof QUIET_BEATS;

/** What the effect layer is being asked to draw right now. `fogged` is not a
 *  dimmer switch — it is a DIFFERENT effect: no vector, no word, no building,
 *  just a wide ripple over the region. See the fog rule in the page. */
export interface ActiveFx {
	id: number;
	fromId: string | null;
	toId: string;
	fx: CardFx;
	fogged: boolean;
	/** Set at the verdict beat. */
	outcome: 'pending' | 'ward' | 'breach' | 'done';
	beats: Beats;
	startedAt: number;
	/** The roll, handed over at the moment the dice leave the hand. The renderer
	 *  tumbles random faces on the way in and lands on THESE — so what the player
	 *  watches settle is the number the game actually used. `color` is the band
	 *  the result falls in, which is what the landing burst is lit with. */
	roll?: { dice: [number, number]; total: number; color: string };
	/** The throw was made into a quarantine. The dice never land: a barrier snaps
	 *  up over the region partway through the roll and knocks them out of the air.
	 *  Drawn instead of the bounce-and-settle, not on top of it. */
	sealed?: boolean;
	/** Every building in the target's region. The dice are rolled into the middle
	 *  of the AREA, not thrown at the house — so the renderer needs to know what
	 *  the area is, and the centroid of its buildings is open ground by
	 *  construction. */
	arenaIds?: string[];
}

// ── Dice ─────────────────────────────────────────────────────────────────────
// Thrown at the building, not spun in a status bar. They arc in, bounce off the
// ground twice with the height damping out, tumble while they do it, and come to
// rest on the terrain you were aiming at — where they stay until the verdict, so
// the number is sitting on the place it decided.

/** Pip positions on a die face, in a [-1,1] square. */
export const PIPS: Record<number, Array<[number, number]>> = {
	1: [[0, 0]],
	2: [
		[-0.5, -0.5],
		[0.5, 0.5]
	],
	3: [
		[-0.5, -0.5],
		[0, 0],
		[0.5, 0.5]
	],
	4: [
		[-0.5, -0.5],
		[0.5, -0.5],
		[-0.5, 0.5],
		[0.5, 0.5]
	],
	5: [
		[-0.5, -0.5],
		[0.5, -0.5],
		[0, 0],
		[-0.5, 0.5],
		[0.5, 0.5]
	],
	6: [
		[-0.5, -0.55],
		[0.5, -0.55],
		[-0.5, 0],
		[0.5, 0],
		[-0.5, 0.55],
		[0.5, 0.55]
	]
};

/**
 * The bounce, as explicit contacts rather than a damped wave.
 *
 * A formula would give the same silhouette, but the game needs to know the exact
 * moment the dice TOUCH — that is when the dust goes up, and dust that is not
 * synchronised to the landing is just weather. So the arcs are authored: four
 * hops, each shorter and quicker than the last, and the contact times fall out
 * of the table instead of having to be solved for.
 */
export const DICE_CONTACTS = [0.3, 0.58, 0.78, 0.92, 1] as const;
/** Peak height of each hop, in die-widths. */
export const DICE_ARCS = [3.4, 1.5, 0.66, 0.26, 0] as const;
/** Fraction after which the faces stop changing and the real numbers show. */
export const DICE_LOCK = 0.8;
/** How far through the window the dice stop travelling across the ground. */
export const DICE_ROLL_OUT = 0.8;
/** Where in the roll a seal slams up and knocks the dice away. Late enough that
 *  the throw has been committed and read, early enough that they never touch the
 *  ground — the whole point is that the roll does not happen. */
export const SEAL_AT = 0.42;

export function bounceHeight(p: number): number {
	let from = 0;
	for (let i = 0; i < DICE_CONTACTS.length; i++) {
		const to = DICE_CONTACTS[i];
		if (p <= to) {
			const q = (p - from) / Math.max(0.0001, to - from);
			return Math.sin(q * Math.PI) * DICE_ARCS[i];
		}
		from = to;
	}
	return 0;
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Condition ────────────────────────────────────────────────────────────────
// A building's hardening IS its health: it is the number an attack has to beat,
// it goes down when the building is worn or talked down, and it goes up when
// somebody spends a turn on it. Drawing it as a bar rather than as a numeral is
// what makes a board of sixteen buildings readable at a glance — you see which
// ones are in trouble without reading any of them.

export interface StatusBar {
	id: string;
	/** What it is called. A bar with no name is a coloured line — the plate has to
	 *  answer "what am I looking at" before it answers "how is it doing". */
	name: string;
	/** Position on the payload path, drawn as a numbered pip. */
	step: number | null;
	/** Region hue, so the plate is tied to the territory it stands in. */
	regionColor: string;
	region: string;
	/** Hardening right now. */
	value: number;
	/** What it stands at untouched, so the fill reads as CONDITION: a Checkpoint
	 *  at 13 and a Sandbox at 6 are both intact, and both should look it. */
	base: number;
	held: boolean;
	persistent: boolean;
	/** A turn was spent working this foothold — the next step is easier for it. */
	staged: boolean;
	sealed: boolean;
	tone: 'ok' | 'warn' | 'bad';
	/** How many of each side are stood on it, as the viewing seat is allowed to
	 *  know. Two numerals answer "is this contested" faster than counting
	 *  silhouettes on a moving globe. */
	red: number;
	blue: number;
}

export const BAR_TONE: Record<StatusBar['tone'], string> = {
	ok: '#34D399',
	warn: '#FBBF24',
	bad: '#F472B6'
};

// ── Standing forces ──────────────────────────────────────────────────────────
// The squad a card sends does not evaporate when the animation ends — it STAYS,
// stationed at the building it was played on. That is the difference between an
// effect and a board: after four turns you can look at the globe and see where
// each side's people actually are, which building is contested, and which one
// nobody has been near.
//
// They are not decoration. A blue unit standing at a building is worth +1
// hardening while it stands — so the Architect's "+3 WALL" IS the three figures
// on the wall, and taking them off it is how red gets the number back down.

export interface GarrisonUnit {
	uid: string;
	structureId: string;
	faction: 'red' | 'blue';
	/** Which kind of thing is standing here — an implant hiding, or a garrison
	 *  posted. Drawn differently, counted differently, removed differently. */
	leaves: Exclude<Leaves, 'nothing'>;
	shape: UnitShape;
	hue: string;
	/** Fog: a red unit is only drawn to blue once its foothold is revealed. */
	revealed: boolean;
	/** Seeded per unit so a garrison bobs out of step with itself. */
	phase: number;
}

/** No more than this many of one side at one building — past it the ring stops
 *  reading as a garrison and starts reading as a smear. */
export const GARRISON_CAP = 5;

/**
 * A one-shot marker at a building, for the things that happen between cards.
 *
 *   reveal   something hidden was found — the loudest of the three
 *   cleared  something was pulled out and is gone
 *   tick     an implant did its damage this round
 *   sealed   a quarantine went on, or is holding
 */
export interface BoardPing {
	id: string;
	structureId: string;
	kind: 'reveal' | 'cleared' | 'tick' | 'sealed';
	at: number;
}

export const PING_MS = 1500;

export const PING_STYLE: Record<BoardPing['kind'], { color: string; label: string }> = {
	reveal: { color: '#F472B6', label: 'FOUND' },
	cleared: { color: '#34D399', label: 'CLEARED' },
	tick: { color: '#FB7185', label: 'BURROWING' },
	sealed: { color: '#A78BFA', label: 'SEALED' }
};
