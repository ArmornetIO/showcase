import { readStored, writeStored } from '../storage.js';

const STORAGE_KEY = 'armornet-appearance';

/** How surfaces are painted.
 *
 *  - `glass` — frosted, translucent, refracting the ground behind it.
 *  - `flat`  — opaque panels on a plain field. No blur, no ground.
 *
 *  `flat` is not a downgrade path for old browsers — `backdrop-filter` is
 *  universally supported now. It is for people who find the treatment noisy,
 *  and for the situations where it genuinely is: a projector, a screen share,
 *  a long session in a dense table. Those are real, and the answer is a
 *  setting rather than an argument about it. */
export type AppearanceMode = 'glass' | 'flat';

/** Flat is the default. Glass is the more expressive surface, but it is also
 *  the more expensive one to read against — dense tables, long sessions,
 *  projectors and screen shares are the common case, not the exception. So the
 *  unconfigured visitor gets the plain field and glass is something you turn
 *  on, from the dev cog, once you've decided you want it. */
const DEFAULT_MODE: AppearanceMode = 'flat';

function reviveMode(raw: string): AppearanceMode | null {
	return raw === 'glass' || raw === 'flat' ? raw : null;
}

/**
 * Whether surfaces are glass or flat.
 *
 * Deliberately separate from `theme`: the two answer different questions. A
 * theme is which palette you are in; appearance is how much the surface does on
 * top of it. Folding `flat` in as a sixth theme would mean re-authoring every
 * palette twice and would make "flat dark" and "flat light" two unrelated
 * choices instead of one axis crossed with another.
 *
 * Like `theme`, the store owns the preference and nothing else — the app writes
 * `data-appearance` to the DOM in its own `$effect`.
 */
class AppearanceStore {
	#mode = $state<AppearanceMode>(DEFAULT_MODE);
	#started = false;

	/** What the user picked. Write it through `set` — that is what persists. */
	get mode(): AppearanceMode {
		return this.#mode;
	}

	/** Convenience for the common branch, so consumers don't restate the literal. */
	readonly isGlass: boolean = $derived(this.#mode === 'glass');

	set(next: AppearanceMode): void {
		this.#mode = next;
		writeStored(STORAGE_KEY, next);
	}

	toggle(): void {
		this.set(this.#mode === 'glass' ? 'flat' : 'glass');
	}

	/**
	 * Hydrate from storage. Call once from the app shell; returns its own
	 * teardown. Safe to call twice — the second call is a no-op.
	 */
	start(): () => void {
		if (this.#started) return () => {};
		this.#started = true;
		this.#mode = readStored(STORAGE_KEY, DEFAULT_MODE, reviveMode);
		return () => {
			this.#started = false;
		};
	}
}

export const appearance = new AppearanceStore();
