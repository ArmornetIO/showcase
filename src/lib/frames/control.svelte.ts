// Global frame control — the "dev goodies" switch.
//
// Flipping `forceFrames` snaps every <Frame> on the page into its pre-load
// state at once, so designers can see and tune all the scaffolds live without
// throttling a network. The Dev cog binds a toggle to this; components read it
// through <Frame>, which OR's it with each region's own framed prop.
//
// Deliberately a bare `$state` object rather than a class, unlike the rest of
// the library's stores: two booleans, no invariants, nothing to persist and
// nothing to derive. `frameControl.forceFrames = true` is the whole API, and a
// class here would be ceremony around nothing.

export const frameControl = $state({
	/** When true, every Frame renders its pre-load scaffold regardless of data. */
	forceFrames: false,
	/**
	 * Dev-only artificial latency (ms) added to every GET by the API client, so
	 * the real pre-load frames are held on screen long enough to see and tune.
	 * 0 = off (the production default; only the Dev cog ever sets it non-zero).
	 */
	devLatencyMs: 0
});

/**
 * frameLatency — await this at the top of the API client's GET path. Resolves
 * immediately in production (devLatencyMs is 0) and only delays when the Dev
 * cog's "simulate slow loading" is engaged. Keeps the app-side call a one-liner.
 *
 * Lives in the library rather than in the app's client because the toggle that
 * drives it is here. `app-ui/src/lib/api/client.ts` is the consumer — nothing in
 * showcase calls it, so a grep scoped to this package makes it look dead. It is
 * not.
 */
export function frameLatency(): Promise<void> {
	const ms = frameControl.devLatencyMs;
	if (!ms || ms <= 0) return Promise.resolve();
	return new Promise((r) => setTimeout(r, ms));
}
