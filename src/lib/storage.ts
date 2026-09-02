/**
 * The one place the library touches Web Storage.
 *
 * Before this existed, five stores hand-rolled the same read/write with four
 * different guards — `typeof localStorage`, `typeof window`, a
 * `storageAvailable()` helper, and `browser` from `$app/environment`. The last
 * one is the reason this module takes no framework import: a store that pulls
 * in `$app/environment` cannot be lifted out of SvelteKit, which is a real cost
 * for a library meant to be used elsewhere.
 *
 * The `typeof` check is NOT SSR insurance — showcase ships as a static SPA and
 * renders nothing on a server. It is here because library modules still get
 * *evaluated* outside a browser: `vite dev` evaluates the root layout through
 * its SSR module runner, the build renders the fallback shell, and the `node`
 * vitest project imports library code with `environment: 'node'`. None of those
 * render a page, but all of them run this file.
 *
 * The stronger rule lives in the stores themselves: touch storage from
 * `hydrate()`/`start()`, never at module scope. A store that obeys that is only
 * ever called from a mounted component, where storage exists by definition.
 */

/** True when a real Web Storage implementation is reachable. */
function available(): boolean {
	return typeof localStorage !== 'undefined';
}

/**
 * Read a stored string and revive it into `T`.
 *
 * `revive` returns `null` for anything it does not recognise, which is how a
 * stale or hand-edited value falls back instead of poisoning the store. Never
 * throws: storage can be blocked outright (private mode, embedded webviews) and
 * a preference is never worth failing a page load over.
 */
export function readStored<T>(
	key: string,
	fallback: T,
	revive: (raw: string) => T | null
): T {
	if (!available()) return fallback;
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return fallback;
		return revive(raw) ?? fallback;
	} catch {
		return fallback;
	}
}

/** Write a string. Silently does nothing when storage is unavailable. */
export function writeStored(key: string, value: string): void {
	if (!available()) return;
	try {
		localStorage.setItem(key, value);
	} catch {
		// Quota or blocked storage — the in-memory value still applies for this
		// session, it just will not survive a reload.
	}
}

/** Remove a key. */
export function clearStored(key: string): void {
	if (!available()) return;
	try {
		localStorage.removeItem(key);
	} catch {
		// nothing to do — the key is already unreachable
	}
}

/**
 * Read a JSON-shaped value.
 *
 * `revive` takes the parsed value as `unknown` because what comes back is
 * whatever was written by a previous version of the app — normalise it there
 * rather than trusting the type parameter.
 */
export function readJson<T>(
	key: string,
	fallback: T,
	revive: (parsed: unknown) => T | null
): T {
	return readStored(key, fallback, (raw) => {
		try {
			return revive(JSON.parse(raw));
		} catch {
			return null;
		}
	});
}

/** Write a value as JSON. */
export function writeJson(key: string, value: unknown): void {
	try {
		writeStored(key, JSON.stringify(value));
	} catch {
		// Unserialisable value (a cycle, a BigInt) — dropping the write is better
		// than throwing out of a setter.
	}
}
