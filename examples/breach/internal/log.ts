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
}

/** A row before the log has stamped an id on it. */
export type LogDraft = Omit<LogEntry, 'id' | 'see'>;

/** Round one, nothing held, nothing known. */
export const OPENING: LogEntry[] = [
	{
		id: 'l0',
		see: 'all',
		when: 'R1',
		title: 'match opened —',
		subject: 'nothing is held',
		icon: 'clock',
		tone: 'info',
		qualifiers: ['12 rounds', '3 AP each', 'the path starts in the Outlands']
	}
];
