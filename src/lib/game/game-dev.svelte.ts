// ── game/game-dev — the game debug switches the DevCog's GAME group drives ───
// What a game's debug menu holds: the frame HUD, collision views, a chase camera
// to see your own hitbox, noclip, slow motion, and the movement tunables live.
// A scene registers while it is mounted so the cog can gate the group on there
// being something to debug, then reads these fields straight off the proxy in
// its frame loop — a plain property read, no subscription, nothing per frame.
//
// Shaped like `physics/globeRegistry`: the exported value IS the $state proxy.
import { untrack } from 'svelte';
import { WALKER_DEFAULTS } from '../physics/walker.js';

/** The movement values worth turning live. Everything else in WalkerTuning is
 *  geometry a fader would only break. */
const TUNING = {
	walkSpeed: WALKER_DEFAULTS.walkSpeed,
	runSpeed: WALKER_DEFAULTS.runSpeed,
	jumpSpeed: WALKER_DEFAULTS.jumpSpeed,
	gravity: WALKER_DEFAULTS.gravity,
	stepHeight: WALKER_DEFAULTS.stepHeight
};
export type GameTuning = typeof TUNING;
export const GAME_TUNING_DEFAULTS: Readonly<GameTuning> = Object.freeze({ ...TUNING });

/** A mounted scene the cog can act on. */
export interface GameScene {
	id: string;
	label: string;
	/** Put the player back where the scene starts them. */
	respawn(): void;
	/** Maps the scene can load, dev-only ones included. The cog is the only
	 *  thing that lists them, so a dev map is unreachable outside a dev session. */
	maps?: { id: string; label: string }[];
}

export const gameDev = $state({
	scenes: [] as GameScene[],
	/** The frame/allocation HUD (`perf/PerfHud`). */
	fps: false,
	/** Every hull's bounding box — the broadphase's view of the world. */
	bounds: false,
	/** Faces painted by what the walker makes of them: floor, climbable, wall. */
	faces: false,
	/** The walker's own box, coloured by mode. Only visible from the chase cam. */
	hitbox: false,
	/** Camera behind and above the walker instead of at its eye. */
	chase: false,
	/** Fly through everything; the walker is skipped entirely. */
	noclip: false,
	/** Multiplies the time fed to the fixed step. 1 is real time. */
	timeScale: 1,
	/** The map the scene should load instead of its own; null is the scene's. */
	map: null as string | null,
	/** What the map's slots are filled from. A reroll is a new seed. */
	seed: 1,
	tuning: { ...TUNING }
});

/** Register a mounted scene; returns the unregister fn for the effect teardown.
 *  Idempotent per id, for the same reason `registerGlobe` is. */
export function registerGameScene(scene: GameScene): () => void {
	gameDev.scenes = [...untrack(() => gameDev.scenes).filter((s) => s.id !== scene.id), scene];
	let released = false;
	return () => {
		if (released) return;
		released = true;
		gameDev.scenes = untrack(() => gameDev.scenes).filter((s) => s.id !== scene.id);
	};
}
