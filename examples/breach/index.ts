// ── BREACH ───────────────────────────────────────────────────────────────────
// The example's public surface. A host that just wants the game mounts
// `Breach`; a host that wants to drive it reaches for `BreachMatch` and brings
// its own chrome. Everything else in here is an implementation detail of this
// example and is deliberately not re-exported.

export { default as Breach } from './Breach.svelte';
export { default as BoardStage } from './BoardStage.svelte';
export { default as CardFan } from './CardFan.svelte';
export { default as Lobby } from './Lobby.svelte';
export { default as HeroDais } from './HeroDais.svelte';
export { default as TacticalToolbar } from './TacticalToolbar.svelte';

export { BreachLobby, ASSIGNMENT_MODES, rosterFor } from './internal/lobby.svelte.js';
export type {
	AssignmentMode,
	LobbyPhase,
	LobbySeat,
	Occupant
} from './internal/lobby.svelte.js';
export { BreachMatch } from './internal/match.svelte.js';
export type { Foothold, Stage, Block, Roll, Drag, MatchOptions } from './internal/match.svelte.js';
export { NO_CINEMA } from './internal/cinema.js';
export type { CinemaPort, Scene, PovBeat } from './internal/cinema.js';
export type { Audience, LogEntry, LogTone } from './internal/log.js';
export type { Ability, Klass, Structure, Faction, Outcome, Skill } from './internal/rules.js';
