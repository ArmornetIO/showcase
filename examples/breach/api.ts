// ── The table API ────────────────────────────────────────────────────────────
// The two things a browser does over plain HTTP, before there is a socket.
//
// Opening a table has no audience yet, and a pasted link arrives in a browser
// that has not connected to anything — so both are REST. Everything else about
// a game (sitting down, readying up, playing a card) changes what three other
// people are looking at, so it travels over the Agent Line as an intent and
// is pushed to all of them. That client is not written yet; see the note on
// `openTable` for what that means for the link this returns.
//
// This file is deliberately NOT in `internal/`. That directory is the game and
// has no transport in it, which is the property that lets the rules run in Node
// under a test with no server anywhere.

/** Where the Go server mounts the table routes. */
const BASE = '/api/breach';

export interface TableConfig {
	/** `2v2` (default) or `1v1`. */
	size?: '1v1' | '2v2';
	/** How characters get handed out: `lot` (default), `draft` or `pick`. */
	mode?: 'lot' | 'draft' | 'pick';
}

export interface OpenedTable {
	table_id: string;
	/** Path, not a URL — only the browser knows what origin it is served from. */
	invite: string;
	config: { size: string; mode: string };
}

/**
 * Open a table on the server. The caller becomes its host.
 *
 * The table is real, server-side and authoritative, and the link identifies it.
 * What it cannot do yet is admit anybody: joining is an Agent Line intent, and no
 * browser speaks that protocol so far. So this is honest as a link to a table
 * that exists — and not, yet, as an invitation somebody can accept.
 */
export async function openTable(config: TableConfig = {}): Promise<OpenedTable> {
	const res = await fetch(`${BASE}/tables`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		// The session cookie is the identity; the org and the host are read off
		// it server-side and are deliberately not in this body.
		credentials: 'same-origin',
		body: JSON.stringify(config)
	});
	if (!res.ok) throw new Error(await explain(res));
	return (await res.json()) as OpenedTable;
}

/** One live table, as an operator sees it. Mirrors `breach.Summary` in Go. */
export interface LiveTable {
	id: string;
	org_id: string;
	phase: 'setup' | 'select' | 'playing' | 'complete';
	/** The host's generated label, never their identity — the server does not put
	 *  IDP subjects in this listing. */
	host_name: string;
	size: string;
	mode: string;
	seats: number;
	filled: number;
	/** Everyone who has joined, against how many hold a live connection right
	 *  now. The gap between them is a table mid-reconnect. */
	players: number;
	present: number;
	joinable: boolean;
	idle: boolean;
	created_at: string;
	last_activity: string;
	/** Path, not a URL — the same link the host would send. */
	invite: string;
}

/**
 * Every live table on the server. God admin only.
 *
 * A table is process memory: it exists while somebody is at it and is reaped
 * once it has been idle a while. So there is nothing in a database to query and
 * no other way to find a game except by already holding its link — which is
 * exactly why this endpoint is restricted, since a list of table ids is a list
 * of doors.
 */
export async function listLiveTables(signal?: AbortSignal): Promise<LiveTable[]> {
	const res = await fetch('/api/admin/breach/tables', {
		credentials: 'same-origin',
		signal
	});
	if (!res.ok) throw new Error(await explain(res));
	const body = (await res.json()) as { tables?: LiveTable[] };
	return body.tables ?? [];
}

/** What is behind a link, without joining it. */
export async function describeTable(id: string): Promise<unknown> {
	const res = await fetch(`${BASE}/tables/${encodeURIComponent(id)}`, {
		credentials: 'same-origin'
	});
	if (!res.ok) throw new Error(await explain(res));
	return res.json();
}

/** The absolute link to hand somebody. */
export const inviteURL = (path: string) => new URL(path, location.origin).toString();

/**
 * Where the rulebook is, relative to wherever this example is mounted.
 *
 * Derived from the current path rather than plumbed down as a prop, because the
 * example does not know its host's routing and threading a link through three
 * components to reach the setup screen is worse than reading the one fact the
 * browser already has. A host that mounts the game somewhere the rules are not
 * next door gets a dead link, which is why it is a link and not a claim.
 *
 * Empty on the server, where there is no location — the setup screen simply
 * does not draw the link until it hydrates.
 */
export function rulesHref(): string {
	if (typeof location === 'undefined') return '';
	if (isRulesPath()) return location.pathname;
	return `${location.pathname.replace(/\/$/, '')}/rules`;
}

/** The last path segment the rulebook answers to. One constant so the link, the
 *  check and the mount cannot spell it three ways. */
const RULES_SEGMENT = '/rules';

/**
 * Is this page the rulebook rather than the game?
 *
 * Read by main.ts, which mounts one component or the other. It exists because
 * the standalone app has no router and is served by an SPA fallback: every path
 * under the mount arrives at the same index.html, so "which page is this" is a
 * question only the client can answer.
 */
export function isRulesPath(): boolean {
	if (typeof location === 'undefined') return false;
	return location.pathname.replace(/\/$/, '').endsWith(RULES_SEGMENT);
}

/** Back to the game from the rulebook — the inverse of `rulesHref`. */
export function playHref(): string {
	if (typeof location === 'undefined') return '';
	const p = location.pathname.replace(/\/$/, '');
	return p.endsWith(RULES_SEGMENT) ? p.slice(0, -RULES_SEGMENT.length) || '/' : p;
}

/** The server's marker for "you have not accepted the current legal documents".
 *  Matches `rest.ErrCodeLegalRequired`. */
const LEGAL_REQUIRED = 'legal_acceptance_required';

/** Where a player clears the gate. `/breach/start` is app-ui's stepper and owns
 *  the legal step; the onboarding wizard is the wrong destination for somebody
 *  who arrived to play. */
const LEGAL_PATH = '/breach/start';

/** Turn a failed response into something worth showing a person.
 *
 *  Also the one place a legal-gate refusal can be caught: the gate sits on the
 *  whole /api group, so it answers any call here, and a player left staring at
 *  "the server said 403" has no way to learn what to do about it. */
async function explain(res: Response): Promise<string> {
	// The body first, when there is one. Handlers answer with {"error": "..."}
	// saying WHY — "god admin only", "no organisation on this session" — and the
	// status alone cannot tell those apart, since both are 403.
	try {
		const body = (await res.json()) as { error?: string; code?: string };
		if (body.code === LEGAL_REQUIRED) {
			if (typeof location !== 'undefined' && !location.pathname.startsWith(LEGAL_PATH)) {
				location.assign(LEGAL_PATH);
			}
			return 'you have not accepted the terms yet';
		}
		if (body.error) return body.error;
	} catch {
		// A non-JSON body from an error path is not itself interesting.
	}
	if (res.status === 401 || res.status === 403) {
		return 'you are not signed in to an organisation';
	}
	if (res.status === 503) return 'breach is not enabled on this server';
	return `the server said ${res.status}`;
}

/** The query key a table id arrives on. Must match `InviteParam` in
 *  `server/rest/breach.go` — the server builds the link, this reads it. */
export const INVITE_PARAM = 't';

/** The table this page was opened for, if it was opened from a link at all. */
export function arrivedOnLink(): string | null {
	return new URLSearchParams(location.search).get(INVITE_PARAM);
}

/** The query key that opens the gallery instead of the game.
 *
 *  A query parameter and not a route, because the gallery is not a page — it is
 *  a component a host mounts. This is how the EXAMPLE reaches it; app-ui will
 *  mount `BreachSpectate` on its god-admin surface directly. */
export const SPECTATE_PARAM = 'spectate';

/** Whether this page was opened to watch rather than to play.
 *
 *  Not an authorisation check and not pretending to be one: the server refuses a
 *  spectator subscription from anybody who is not a god admin, so the worst this
 *  can do is show an empty gallery to somebody who typed the parameter in. */
export function arrivedToSpectate(): boolean {
	// Guarded because this is read during component INIT, and the showcase app
	// server-renders its routes in dev — where there is no `location` and the
	// bare access throws a 500 for the whole page rather than the example. The
	// answer is always false on the server: nobody is spectating a page that has
	// not been sent yet.
	if (typeof location === 'undefined') return false;
	return new URLSearchParams(location.search).has(SPECTATE_PARAM);
}
