// showcase/devcog — the portable DevCog: floating dev toolbar plus the
// framework-agnostic engine behind it. Host apps supply their own config;
// nothing here is armornet-specific. A freshly bootstrapped app can wire the
// whole thing from this single entry point.
//
// Layout:
//   DevCog.svelte      the shell — console state, the Escape ladder, nothing else
//   DevCogCluster      the floating buttons: arm inspector, open console
//   console/           the panel — rail, group registry, per-group bodies
//   controls/          the control vocabulary hosts build their groups from
//   flags/             engine ONLY. The flags UI moved to the host's admin page;
//                      the store stays here because the host is built on it.
//   qa/                "what is wrong with this page?" — nits engine, reactive
//                      controller, and the on-page overlay layer
//
// A host extends the console by contributing `ToolGroup`s, not by passing one
// flat snippet — that is what lets its tools be grouped, gated, and reached in
// the same two actions as the built-ins.

export { default as DevCog } from './DevCog.svelte';

// ── Console: the group seam and the controls to build a group with ──────────
export {
	DEFAULT_CONSOLE_CONFIG,
	type ToolGroup,
	type ConsoleConfig,
	type AppliesWhen
} from './console/types.js';
export { default as Fader } from './controls/Fader.svelte';
export { default as FaderBank } from './controls/FaderBank.svelte';
export { default as InfoDot } from './controls/InfoDot.svelte';
export { default as Seg } from './controls/Seg.svelte';
export { default as ControlRow } from './controls/ControlRow.svelte';

// The wasm probe is a page tool, so it belongs in a host's PAGE group rather
// than standing as a built-in the console renders whether or not it applies.
export { default as WasmProbe } from './qa/WasmProbe.svelte';

// ── Flags: feature toggles + serve mode ─────────────────────────────────────
export {
	createFlagStore,
	type FlagStore,
	type FlagStoreConfig,
	type FlagSnapshot,
	type FlagSource,
	type DevRuntime
} from './flags/engine.js';

// ── QA: element capture, nit batch, AI hand-off ─────────────────────────────
export {
	loadNits,
	saveNits,
	parseNits,
	getCssPath,
	buildAIPrompt,
	DEFAULT_NIT_CONFIG,
	type Nit,
	type NitConfig
} from './qa/nits.js';

// The reactive half of the nits tool. Exported so a host can drive a batch
// from its own UI (a keyboard shortcut, a menu item) rather than only from the
// drawer, and so `DEVCOG_ATTR` can mark host chrome the inspector must skip.
export { NitsController, DEVCOG_ATTR, type NitCapture } from './qa/nits.svelte.js';

// Perf monitor plugin that DevCog embeds — re-exported for convenience.
export { perfBudget, type PerfTier } from '../perf/budget.svelte.js';
export { default as PerfPanel } from '../perf/PerfPanel.svelte';
