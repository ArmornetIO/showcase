// ── The match log ────────────────────────────────────────────────────────────
// Its own module because it is the one game-state shape that a VIEW is going to
// want to render directly, and `internal/` is not allowed to reach into `$lib`
// for `TimelineEvent` to describe it. So the game states its own row shape and
// the view maps it — the mapping is a spread, and the price of that spread is
// that the rules never depend on the component library.
//
// Every row carries WHO may read it. A shared feed that prints "obfuscated
// fixture planted in The Archive" to the defender hands them the game in a
// sidebar, so fog applies to the log exactly as it applies to the board: red's
// quiet work leaves blue nothing but a detection number that went up.

import type { Outcome, TerritoryKey } from './rules.js';

/** Which seats a row is addressed to. */
export type Audience = 'all' | 'red' | 'blue';

/** Severity, as the log means it — not as a design system means it. */
export type LogTone = 'info' | 'ok' | 'warn' | 'bad';

export interface LogEntry {
	id: string;
	see: Audience;
	/** Round stamp, e.g. `R4 · Quarantine`. */
	when: string;
	title: string;
	subject: string;
	/** Icon NAME only. Resolving it to a glyph is the view's job. */
	icon: string;
	tone: LogTone;
	/** Worth interrupting for — the view may draw these louder. */
	major?: boolean;
	qualifiers?: string[];

	// ── Attribution ────────────────────────────────────────────────────────────
	// Who did it, where, and when — as structured values rather than prose in
	// `title`. Player presence is derived from these, and deriving it from the
	// log rather than from a parallel record is the whole safety argument: the
	// log is ALREADY fogged, so a presence read that walks `feed` cannot leak
	// something the seat is not allowed to know. There is one gate, not two.

	/** Which seat's action produced this row. Deliberately ABSENT on rows the
	 *  other side receives as a bare tell — blue learns a region moved, never who
	 *  moved it. An anonymous row still carries `where`, which is exactly the
	 *  "somebody was here" the defender is owed and no more. */
	actor?: string;
	/**
	 * Who may know WHO — a second, tighter audience than the row's own.
	 *
	 * These come apart more often than they look like they should. A repelled
	 * attack is announced to the whole table (`see: 'all'`) while the attacker's
	 * identity is not: the row says "contact", not the card, and naming the seat
	 * would give up more than the prose deliberately withholds. Equally, an ally
	 * must see its partner's every move even on rows the enemy also receives.
	 *
	 * So the row carries both. It defaults to the actor's own faction — the
	 * closed case — and is raised to `'all'` only where the game has decided the
	 * actor is exposed, which in practice means a region gone loud enough to
	 * stop keeping secrets.
	 */
	actorSee?: Audience;
	/** Which territory it happened in. Never a structure: a building is the fact
	 *  being withheld, a region is the fact being told. */
	where?: TerritoryKey;
	/** Round it landed on, so a reader can age it without parsing `when`. */
	round?: number;

	// ── The move ───────────────────────────────────────────────────────────────
	// The same four facts the prose above already states, as VALUES. A feed that
	// wants a card's glyph and a building's crest cannot get them out of
	// `title`/`subject`/`qualifiers` without parsing English back into data, and
	// a parser is a second, undocumented schema nobody maintains.
	//
	// All three are withheld together and by the same rule as `actor`: naming
	// the card is naming the move, and naming the building is the fact `where`
	// exists to keep. A row that withholds them omits them.

	/** The card played, as an ability key. */
	card?: string;
	/** The BUILDING it happened to, as a structure id — the fact behind `where`,
	 *  set only on rows that have already given the house up. */
	structure?: string;
	/** What it did to that building's hardening. Negative is damage. Absent when
	 *  the row moved no wall; travels with `structure`, because a delta hanging
	 *  off a region nobody may name is a number with nothing to attach to. */
	delta?: number;
	/** How the dice went. Absent on rows nobody rolled for — upkeep, victory, a
	 *  seal that was never thrown at. */
	outcome?: Outcome;
}

/**
 * A row before the log has stamped an id on it.
 *
 * `actor` widens to `null` here and only here: rows are attributed AMBIENTLY
 * from whichever seat is mid-resolution, so a row that must stay anonymous
 * needs a way to say so that is louder than omitting the field. `undefined`
 * means "use the ambient actor"; `null` means "nobody — the world said this".
 */
export type LogDraft = Omit<LogEntry, 'id' | 'see' | 'actor'> & { actor?: string | null };

/** Whether `viewer` may read a row addressed to `audience`. The one place the
 *  comparison lives, so the log, the feed and presence cannot drift apart on
 *  what "may see" means. */
export const audienceAllows = (audience: Audience, viewer: string) =>
	audience === 'all' || audience === viewer;

/** Round one, nothing held, nothing known. */
export const OPENING: LogEntry[] = [
	{
		id: 'l0',
		see: 'all',
		round: 1,
		when: 'R1',
		title: 'match opened —',
		subject: 'nothing is held',
		icon: 'clock',
		tone: 'info',
		qualifiers: ['12 rounds', '3 AP each', 'the path starts in the Outlands']
	}
];
