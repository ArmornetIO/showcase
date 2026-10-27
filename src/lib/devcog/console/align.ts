// What the console carries from one app to the next: whether it is open, and
// which group it shows.
//
// A cookie and not localStorage, because the apps it has to agree across do not
// share an origin in development — each has its own dev server port, and
// storage is keyed by port while cookies are keyed by host. Browse from one app
// to another and the console arrives the way you left it.

export interface Alignment {
	group: string;
	open: boolean;
}

/** A year: a dev preference, not a session. */
const MAX_AGE = 60 * 60 * 24 * 365;

/** Reads the alignment from a `document.cookie` string; null when absent or unreadable. */
export function readAlignment(cookies: string, name: string): Alignment | null {
	for (const part of cookies.split(';')) {
		const eq = part.indexOf('=');
		if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
		const value = part.slice(eq + 1).trim();
		const dot = value.indexOf('.');
		if (dot < 0) return null;
		const flag = value.slice(0, dot);
		if (flag !== '0' && flag !== '1') return null;
		try {
			return { open: flag === '1', group: decodeURIComponent(value.slice(dot + 1)) };
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * The `document.cookie` assignment that stores an alignment. Path=/ so every
 * app on the host reads the same one — that sharing is the feature.
 */
export function alignmentCookie(name: string, a: Alignment): string {
	const value = `${a.open ? '1' : '0'}.${encodeURIComponent(a.group)}`;
	return `${name}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}
