// showcase/devcog — the portable DevCog: floating dev toolbar plus the
// framework-agnostic engine behind it. Host apps supply their own config;
// nothing here is armornet-specific. A freshly bootstrapped app can wire the
// whole thing from this single entry point.
//
// Layout:
//   DevCog.svelte      the shell — panel state, the Escape ladder, nothing else
//   DevCogCluster      the floating buttons
//   flags/             "what is this build serving?" — engine + panel + rows
//   qa/                "what is wrong with this page?" — nits engine, reactive
//                      controller, drawer, and the on-page overlay layer
//
// Sub-components are deliberately not exported: they are the cog's internals,
// and a host extends the cog through the `qaContent` snippet instead.

export { default as DevCog } from './DevCog.svelte';

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
