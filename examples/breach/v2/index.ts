// ── BREACH v2 ────────────────────────────────────────────────────────────────
// The short match. A host that wants the game mounts `BreachTable`; a host that
// wants to drive it takes `Match` and brings its own chrome. The ruleset is
// exported whole because in v2 it IS the game — there is no server copy of it.

export { default as BreachTable } from './Table.svelte';
export { Match, PACE } from './match.svelte.js';
export type { Entry, Options, Phase, Throw } from './match.svelte.js';
export * from './rules.js';
