// ── HUD TEXT SCALE ───────────────────────────────────────────────────────────
// A game HUD is read at a distance nobody controls: a laptop on a desk, a 27"
// two metres away, a stream at half size. Every argument about whether a label
// is "too small" is really an argument about one of those, and the only honest
// answer is to let the player settle it.
//
// It scales the HUD and NOTHING else — not the showcase chrome around it, not
// the board. The rails, the top row and the seat card are the surfaces made of
// type; the globe is made of geometry and has its own camera.
//
// Why `zoom` and not a font-size: every size on this HUD is in `rem`, which is
// resolved against the ROOT and ignores any font-size we set on a subtree. The
// alternatives were converting several hundred `rem` values to `em` (a sweep
// that would silently miss whatever it missed) or scaling the boxes. `zoom`
// scales type, padding, borders and icon strokes together, which is what
// "bigger HUD" actually means — and `cssZoom` already exists in this library
// because the board's anchor sampling has to account for it.

/** Not `$app/environment`: this app is plain Vite + Svelte with no SvelteKit
 *  (see `vite.config.ts`), so `$app/*` does not resolve in a standalone build —
 *  it only works when the file happens to be pulled into the showcase route. */
const browser = typeof localStorage !== 'undefined';

const KEY = 'breach:hud-scale';
const MIN = 0.85;
const MAX = 1.4;
const STEP = 0.05;

/** Rounded to the step so the readout never shows `104.99999%`. */
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n / STEP) * STEP));

class HudScale {
	#value = $state(1);

	constructor() {
		if (!browser) return;
		const saved = Number(localStorage.getItem(KEY));
		if (saved) this.#value = clamp(saved);
	}

	get value() {
		return this.#value;
	}

	/** Percent, for the readout — the one place a player reads this back. */
	get percent() {
		return Math.round(this.#value * 100);
	}

	get atMin() {
		return this.#value <= MIN + 0.001;
	}

	get atMax() {
		return this.#value >= MAX - 0.001;
	}

	nudge(by: number) {
		this.#set(this.#value + by * STEP);
	}

	reset() {
		this.#set(1);
	}

	#set(next: number) {
		this.#value = clamp(next);
		if (browser) localStorage.setItem(KEY, String(this.#value));
	}
}

export const hudScale = new HudScale();
