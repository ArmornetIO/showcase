// ── What a bot is called ─────────────────────────────────────────────────────
// The chairs nobody turned up for used to read "R1 · demonstrator", which names
// the SEAT and then says what is in it — so four filled chairs were four labels
// differing by one character, in a screen whose whole job is telling the people
// at the table apart.
//
// A bot gets ONE word where a person gets two ("Quiet Kestrel", from the same
// list — see internal/breach/names.go). That is the tell: the shape of the name
// says which chairs are people, before anybody reads a word of it.
//
// `BOT_WORDS` is generated from the Go engine's own list, so a bot named here
// and a bot named by a hosted table are drawn from one vocabulary.
import { BOT_WORDS } from './rules.gen.js';

/**
 * A bot's name, from `n`.
 *
 * The caller owns the index for the same reason the Go side's does: a lobby
 * filling four chairs at once is the only thing that can see the other three,
 * and two bots sharing a name read as one player to everybody at the table.
 */
export function botName(n: number): string {
	return `bot ${BOT_WORDS[((n % BOT_WORDS.length) + BOT_WORDS.length) % BOT_WORDS.length]}`;
}

/** A name for a chair that is filled on its own, with no siblings to avoid. */
export function randomBotName(): string {
	return botName(Math.floor(Math.random() * BOT_WORDS.length));
}
