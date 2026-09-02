// ── BREACH ───────────────────────────────────────────────────────────────────
// The example's public surface. A host that just wants the game mounts
// `Breach`; a host that wants to drive it reaches for `BreachMatch` and brings
// its own chrome. Everything else in here is an implementation detail of this
// example and is deliberately not re-exported.

export { default as Breach } from './Breach.svelte';
// The rules. A separate mount from the game because it is a document, not a
// HUD — a host can publish it anywhere, and it reads the same `internal/`
// modules the engine does rather than a transcription of them.
export { default as Rulebook } from './Rulebook.svelte';
// The god-admin gallery. Exported so a host — app-ui's god-admin page, say —
// can mount it without the example having to know that host exists.
export { default as BreachSpectate } from './spectate/Spectate.svelte';
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
// An offline table hosted by the Go rules, compiled to WebAssembly, instead of
// by this directory's copy of them. A host sets the returned port on a match and
// the game plays with no server and no second ruleset.
export { openLocalTable } from './internal/local-table.js';
export type { LocalTableOptions } from './internal/local-table.js';
export { RulesEngine } from './internal/rules-engine.js';
export type { EngineState } from './internal/rules-engine.js';
export type { Foothold, Stage, Block, Roll, Drag, MatchOptions } from './internal/match.svelte.js';
// The cutaways, previewable on their own — a rig that stands up the real globe
// and plays any POV card with any character in it. The showcase's character
// studio mounts this; the game itself never does.
export { default as PovPreview } from './PovPreview.svelte';
export { NO_CINEMA } from './internal/cinema.js';
export type { CinemaPort, Scene, PovBeat, ShotKind, Cut } from './internal/cinema.js';
export type { Audience, LogEntry, LogTone } from './internal/log.js';
// A host that drives the match itself still has to say who is in the chairs.
export type { Seated } from './internal/presence.js';

export type { Ability, Klass, Structure, Faction, Outcome, Skill } from './internal/rules.js';
