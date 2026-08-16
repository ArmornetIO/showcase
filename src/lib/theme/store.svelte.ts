import { readStored, writeStored } from '../storage.js';
import { resolveChoice, type ThemeChoice, type ThemeKey } from './themes.js';

const STORAGE_KEY = 'armornet-theme';

/** Showcase is a dark-first surface — the canvases, mesh nodes and HUD chrome are
 *  all designed against the dark palette, so an unconfigured visitor gets dark
 *  rather than whatever their OS happens to prefer. Picking a theme still sticks. */
const DEFAULT_CHOICE: ThemeChoice = 'dark';

function reviveChoice(raw: string): ThemeChoice | null {
	switch (raw) {
		case 'system':
		case 'dark':
		case 'light':
		case 'oled':
		case 'high-contrast':
			return raw;
		default:
			return null;
	}
}

/**
 * Which theme the app is wearing.
 *
 * `choice` is what the user picked and `resolved` is what that means right now —
 * they differ only for `'system'`, which depends on the OS preference. `resolved`
 * is derived rather than stored, so the two cannot drift.
 *
 * The store owns the preference and nothing else. Applying it to the DOM is the
 * app's job: `+layout.svelte` runs an `$effect` that writes `data-theme`. That
 * split is what lets a host embed the library and paint the theme its own way.
 */
class ThemeStore {
	#choice = $state<ThemeChoice>(DEFAULT_CHOICE);
	#prefersLight = $state(false);
	#started = false;

	/** What the user picked. Write it through `set` — that is what persists. */
	get choice(): ThemeChoice {
		return this.#choice;
	}

	/** What that resolves to right now. Never stored, never synced by hand. */
	readonly resolved: ThemeKey = $derived(resolveChoice(this.#choice, this.#prefersLight));

	set(next: ThemeChoice): void {
		this.#choice = next;
		// 'system' is persisted rather than cleared: an absent key means "never
		// chose" → dark, so removing it would silently undo the choice.
		writeStored(STORAGE_KEY, next);
	}

	/**
	 * Hydrate from storage and start tracking the OS preference. Call once from
	 * the app shell; returns its own teardown. Safe to call twice — the second
	 * call is a no-op that hands back a teardown for nothing.
	 */
	start(): () => void {
		if (this.#started) return () => {};
		this.#started = true;

		this.#choice = readStored(STORAGE_KEY, DEFAULT_CHOICE, reviveChoice);

		if (typeof window === 'undefined' || !window.matchMedia) return () => {};

		const mql = window.matchMedia('(prefers-color-scheme: light)');
		this.#prefersLight = mql.matches;
		const onChange = (e: MediaQueryListEvent) => {
			this.#prefersLight = e.matches;
		};
		mql.addEventListener('change', onChange);

		return () => {
			mql.removeEventListener('change', onChange);
			this.#started = false;
		};
	}
}

export const theme = new ThemeStore();
