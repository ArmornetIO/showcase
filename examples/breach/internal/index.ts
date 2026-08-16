// ── BREACH · the engine ──────────────────────────────────────────────────────
// Everything a host needs to run a match, and nothing that needs a browser.
// This barrel is the contract between the game and its view: if a component
// reaches past it, the boundary has been broken.

export * from './rules.js';
export * from './fx.js';
export * from './log.js';
export * from './cinema.js';
export * from './match.svelte.js';
