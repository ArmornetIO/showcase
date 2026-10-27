// ── Scene catalogue — the scenes a document is allowed to name ─────────────
// A scene is a TypeScript module; a document can only carry a string. This is
// the resolver between the two, and it is deliberately a compiled-in list
// rather than a loader: a ```component fence naming `ScenePlayer` picks a
// scene id, so the worst a document can do is name a scene that already
// shipped, reviewed, in this bundle. Nothing structural crosses from the
// markdown — which is the escaping guarantee the embed mechanism exists for.

import type { Scene } from './types.js';
import { SAMPLE_SCENE } from './sample-scene.js';
import { BRIDGE_SCENE } from './bridge-scene.js';
import { TUI_SCENE } from './tui-scene.js';
import { LIBRARY_TOUR_SCENE } from './library-tour-scene.js';

export const SCENES: readonly Scene[] = [SAMPLE_SCENE, BRIDGE_SCENE, TUI_SCENE, LIBRARY_TOUR_SCENE];

/** The registry's `scene` enum options — derived, so a new scene added above
 *  offers itself to documents without a second edit. */
export const SCENE_IDS: readonly string[] = SCENES.map((s) => s.id);

const BY_ID = new Map(SCENES.map((s) => [s.id, s]));

/** Undefined for an unknown id: the caller draws the fallback, never an error. */
export function sceneById(id: string): Scene | undefined {
	return BY_ID.get(id);
}
