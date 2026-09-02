// ── PlayerPresence — the public surface ──────────────────────────────────────
// The module a host mounts, the catalogue it drives it with, and the geometry
// helpers a custom mode would need. The individual mode components are not
// exported: they are implementation, and a host that wants one asks for it by
// id rather than by importing it.

export { default as PlayerPresence } from './PlayerPresence.svelte';
export {
	PRESENCE_MODES,
	DEFAULT_MODES,
	modeById,
	type PresenceModeDef,
	type PresenceRenderMode,
	type PresenceLayer
} from './modes.js';
export { HOME_OF, homeOf, limbAngle, onCircle } from './seating.js';
export {
	sampleStage,
	sampleTerritories,
	type StageBox,
	type TerritoryAnchor
} from './anchors.js';
