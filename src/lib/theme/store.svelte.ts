import { readStored, writeStored } from '../storage.js';
import {
	DEFAULT_DARK,
	getTheme,
	resolveChoice,
	THEMES,
	type Theme,
	type ThemeChoice,
	type ThemeKey
} from './themes.js';

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
		case 'paper':
		case 'daylight':
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
	#allowLight = $state(true);
	#started = false;

	/** What the user picked. Write it through `set` — that is what persists. */
	get choice(): ThemeChoice {
		return this.#choice;
	}

	/**
	 * Whether the light-mode themes are on offer at all.
	 *
	 * A host that has not finished designing against a pale ground turns this off
	 * and gets a dark-only app; the showcase gallery, whose whole job is showing
	 * every palette, leaves it on. It is a CAPABILITY the host declares, not a
	 * preference — which is why it is not persisted and not part of `choice`.
	 */
	get allowLight(): boolean {
		return this.#allowLight;
	}

	/**
	 * Suppression, not erasure: a stored `light` is left in storage and simply
	 * resolves dark while this is off, so turning it back on restores what the
	 * user picked instead of having quietly overwritten it.
	 */
	allowLightThemes(on: boolean): void {
		this.#allowLight = on;
	}

	/** The themes a picker may offer — everything, or the dark ones. */
	readonly available: readonly Theme[] = $derived(
		this.#allowLight ? THEMES : THEMES.filter((t) => t.mode === 'dark')
	);

	/** What that resolves to right now. Never stored, never synced by hand. */
	readonly resolved: ThemeKey = $derived.by(() => {
		const key = resolveChoice(this.#choice, this.#prefersLight);
		if (this.#allowLight) return key;
		return getTheme(key).mode === 'light' ? DEFAULT_DARK : key;
	});

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
