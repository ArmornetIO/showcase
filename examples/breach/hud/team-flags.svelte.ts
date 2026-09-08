// ── TEAM FLAGS ───────────────────────────────────────────────────────────────
// `RED SIDE` is not a team, it is a variable name that escaped into the UI. Two
// sides of a match are the one thing in a competitive game players reliably want
// to OWN — the banner is how every table game, every shooter and every league
// has ever let them — and "red" is the engine's word for a hue, not something
// anybody would put on a shirt.
//
// So a side has a flag: a name, an emblem and a colour. It is drawn beside the
// seat you are playing and beside every player in the stack, so "who is with me"
// is answered by a MARK rather than by remembering which hue means what.
//
// Customisable on purpose, and settable from anywhere: the lobby picks it before
// a match, the HUD only reads it. The defaults are what an unnamed side is
// called, not what it must be called.
import type { Faction } from '../internal/rules.js';

/** The emblem set. Deliberately small and geometric — a flag has to survive
 *  being 14px wide in a hero row, which rules out anything with detail in it. */
export type EmblemKey = 'chevron' | 'bars' | 'star' | 'ring' | 'cross' | 'wedge';

/** Stroke paths in a 24×24 box. `fill` marks the two that are solid — a star
 *  drawn as an outline at this size is a smudge. */
export const EMBLEMS: Record<EmblemKey, { d: string; fill?: boolean }> = {
	chevron: { d: 'M5 16 L12 8 L19 16' },
	bars: { d: 'M5 8 H19 M5 12 H19 M5 16 H15' },
	star: { d: 'M12 4 L14.5 9.6 L20.5 10.3 L16 14.4 L17.3 20.3 L12 17.2 L6.7 20.3 L8 14.4 L3.5 10.3 L9.5 9.6 Z', fill: true },
	ring: { d: 'M12 5 A7 7 0 1 1 11.99 5' },
	cross: { d: 'M6 6 L18 18 M18 6 L6 18' },
	wedge: { d: 'M12 5 L19 18 H5 Z', fill: true }
};

export interface TeamFlag {
	name: string;
	emblem: EmblemKey;
	color: string;
}

/** What an unnamed side is called. Neither is a colour word: the hue is already
 *  carried by every card, spine and pip on that side's half of the screen, and
 *  saying it again in words is the tell that nobody named the team. */
const DEFAULTS: Record<Faction, TeamFlag> = {
	red: { name: 'The Trespass', emblem: 'wedge', color: '#FB7185' },
	blue: { name: 'The Watch', emblem: 'chevron', color: '#38BDF8' }
};

class TeamFlagBook {
	#flags = $state<Record<Faction, TeamFlag>>({ ...DEFAULTS });

	get(faction: Faction): TeamFlag {
		return this.#flags[faction];
	}

	/** Partial on purpose — renaming a side must not silently reset its emblem,
	 *  which is what a whole-object setter invites at every call site. */
	set(faction: Faction, patch: Partial<TeamFlag>) {
		this.#flags = { ...this.#flags, [faction]: { ...this.#flags[faction], ...patch } };
	}

	reset() {
		this.#flags = { ...DEFAULTS };
	}
}

export const teamFlags = new TeamFlagBook();
