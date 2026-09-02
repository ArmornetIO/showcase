// ── The breach capability ────────────────────────────────────────────────────
// The transport left this file. The module loader and the per-capability
// registry now live in showcase/src/lib/agent, because a live-assessment client
// in app-ui needs both and cannot reach into examples/ — and a second registry
// would reintroduce the interleaving this one was written to end.
//
// What stayed is the one thing that was never shared: the name of the protocol
// this game speaks. A capability constant belongs with its client, so the
// registry takes a plain string and knows none of its consumers.
//
// The file keeps its name only because renaming it touches net.svelte.ts, and
// that file is somebody else's extraction.

import { declareCapability } from 'showcase';

/** Mirrors `breachproto.Capability` in Go. */
export const CAP_BREACH = 'io.armornet.breach';

// At module scope, and net.svelte.ts imports this file, so breach is declared
// before any TableSocket exists to subscribe — which is what lets the one
// connection be dialled already knowing about it.
declareCapability(CAP_BREACH);
