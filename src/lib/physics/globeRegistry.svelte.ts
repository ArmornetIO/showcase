// Global registry of live globe cameras — the "what's present" signal the DevCog
// reads. A globe registers a handle on mount and drops it on unmount; the QA cog
// watches the list and only shows its globe controls when at least one is here.
//
// Shaped exactly like frames/control.svelte.ts: the EXPORTED value is the reactive
// $state proxy, and consumers read `globeRegistry.globes` directly — a property
// read on a state proxy is what makes cross-component reactivity fire.
import { untrack } from 'svelte';
import type { CameraPose, OrbitIntroConfig } from './orbit.js';

/** A registered globe the DevCog can drive. */
export interface GlobeHandle {
	/** Stable id, unique per mounted globe. */
	id: string;
	/** Human label shown in the cog (e.g. the route or component name). */
	label: string;
	/** The globe's resting pose, for building an intro against it. */
	rest: CameraPose;
	/** Play an intro on this globe now. */
	play(config: OrbitIntroConfig): void;
	/** Cancel any running intro and hand control back. */
	cancel(): void;
	/** The globe's territory-wall height when it registered, in globe radii — a
	 *  value for a control to START at, not a live reading. */
	wallHeight?: number;
	/** Set the territory-wall height live. Optional: a globe with no territories
	 *  has no walls to raise, and the cog hides the control when it is absent. */
	setWallHeight?(height: number): void;
	/** How far 3D node pieces lean back toward the viewer when it registered,
	 *  radians. A starting value for a control, not a live reading. */
	pieceLean?: number;
	/** Set the piece lean live. */
	setPieceLean?(lean: number): void;
	/** Half-range of the globe's terrain when it registered, in globe radii.
	 *  Absent on a globe with no ground, and the cog hides the control. */
	relief?: number;
	/** Set the terrain relief live. */
	setRelief?(relief: number): void;
	/** Which globe is being drawn: 'relief' (ground, solids, raised walls) or
	 *  'flat' (smooth sphere, disc nodes, walls on the surface). */
	surface?: GlobeSurface;
	/** Switch between the two. */
	setSurface?(surface: GlobeSurface): void;
}

/** The two coherent globes. See MeshCanvas's `globeSurface` for why it is one
 *  switch and not three. */
export type GlobeSurface = 'relief' | 'flat';

/** Reactive registry. Read `globeRegistry.globes` in a component to react to
 *  globes coming and going. */
export const globeRegistry = $state<{ globes: GlobeHandle[] }>({ globes: [] });

/** Register a globe; returns an unregister fn to call on unmount.
 *
 *  Registration is idempotent per id: an $effect that re-runs (label change,
 *  layout toggle) re-registers the same globe, and the cog keys its {#each} by
 *  id — so a second entry for one id would be a duplicate-key crash. */
export function registerGlobe(handle: GlobeHandle): () => void {
	// untrack the read: registerGlobe is called FROM an $effect, and a tracked
	// read of the list it then reassigns would make that effect its own trigger.
	globeRegistry.globes = [...current().filter((g) => g?.id !== handle.id), handle];
	// The returned teardown can be invoked more than once (effect re-run racing
	// component destroy); the second call must be a no-op, not a second removal.
	let released = false;
	return () => {
		if (released) return;
		released = true;
		unregisterGlobe(handle.id);
	};
}

export function unregisterGlobe(id: string): void {
	// Reassign rather than push/splice the $state array in place: mutating it
	// from inside an effect teardown can leave the proxy's length ahead of its
	// contents, and the next scan then reads an undefined element.
	globeRegistry.globes = current().filter((g) => g?.id !== id);
}

/** The registered handles, read WITHOUT subscribing — for the mutators only.
 *  Consumers still read `globeRegistry.globes` directly, which is what makes
 *  cross-component reactivity fire. */
function current(): GlobeHandle[] {
	return untrack(() => globeRegistry.globes);
}
