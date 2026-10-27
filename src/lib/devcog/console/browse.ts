// The BROWSE group's half that needs no DOM: reading the app index the
// framework serves, and deciding which entry is the page you are on.
//
// The index is compose's (`compose.AppIndexPath`), so this is the one place the
// console knows a URL it did not get from its host. It is the framework's
// contract, not a product's: any app served by a compose engine with dev tools
// on answers it, and anything else answers 404 and the group says so.

export const APP_INDEX_URL = '/_compose/apps.json';

/** One app the caller can reach from this page. */
export interface AppEntry {
	name: string;
	path: string;
	/** The app answering this hostname's unclaimed paths. */
	root?: boolean;
}

/**
 * Tolerant read. A malformed index is "no index", not a crash — the console is
 * a dev tool on someone else's page and must never be the thing that breaks it.
 */
export function parseAppIndex(data: unknown): AppEntry[] | null {
	const apps = (data as { apps?: unknown } | null)?.apps;
	if (!Array.isArray(apps)) return null;
	const out: AppEntry[] = [];
	for (const a of apps) {
		if (typeof a?.name !== 'string' || typeof a?.path !== 'string') continue;
		out.push({ name: a.name, path: a.path, root: a.root === true });
	}
	return out;
}

/**
 * Which app serves a path: the longest prefix claim, segment-aware so
 * `/breach` does not claim `/breach-admin`, else the root. The same order the
 * engine resolves in, so the highlighted entry is the app actually answering.
 */
export function currentApp(apps: AppEntry[], pathname: string): string | undefined {
	let best: AppEntry | undefined;
	for (const a of apps) {
		if (a.path === '/') continue;
		const p = a.path.replace(/\/$/, '');
		const claims = pathname === p || pathname.startsWith(p + '/');
		if (claims && (!best || p.length > best.path.replace(/\/$/, '').length)) best = a;
	}
	return (best ?? apps.find((a) => a.root))?.name;
}

/** Fetches the index; null when this server does not serve one. */
export async function loadAppIndex(fetchFn: typeof fetch = fetch): Promise<AppEntry[] | null> {
	try {
		const res = await fetchFn(APP_INDEX_URL, { credentials: 'same-origin' });
		if (!res.ok) return null;
		return parseAppIndex(await res.json());
	} catch {
		return null;
	}
}
