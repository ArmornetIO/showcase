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

/** Which game a table plays. Not `mode` — that already means how characters are
 *  dealt. Mirrors `breach.Variant` in Go. */
export type TableVariant = 'ctf' | 'insider_threat';

export interface TableConfig {
	/** The table: `2v2` (default) or `1v1` for the CTF, `4p`–`8p` for Insider
	 *  Threat. A size the game cannot seat opens at the game's own default. */
	size?: import('./internal/rules.js').MatchSize;
	/** How characters get handed out: `lot` (default), `draft` or `pick`. */
	mode?: 'lot' | 'draft' | 'pick';
	/** `ctf` (default). `insider_threat` is refused unless the server has
	 *  the feature on — see `insiderThreatOffered`. */
	variant?: TableVariant;
}

/**
 * Whether this deployment offers Insider Threat.
 *
 * Read from the runtime config the armornet server injects into every app shell
 * (`window.__ARMORNET__.features`, set from the config's `features:` map). This
 * only decides whether the lobby DRAWS the choice: the server refuses the
 * variant on its own when the feature is off, so a page that lies here gets a
 * 403, not a game. Absent from a built page reads as off.
 *
 * Under the Vite dev server (`make dev-hot`, :5173/breach) nothing injects the
 * config: devfront proxies straight to Vite. That session's server runs on
 * configs/server.dev.yaml, which has the feature on, so dev mirrors it — the
 * same fallback app-ui's featureFlags.ts makes.
 */
export function insiderThreatOffered(): boolean {
	const rc = (globalThis as { __ARMORNET__?: { features?: Record<string, boolean> } }).__ARMORNET__;
	if (!rc && import.meta.env.DEV) return true;
	return rc?.features?.breach_insider_threat === true;
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

/** The scripted simulations a god admin may run (internal/breach/scripts).
 *  Empty on any server not built with the `dev` tag. */
export async function listSimulations(signal?: AbortSignal): Promise<string[]> {
	const res = await fetch('/api/admin/breach/sims', { credentials: 'same-origin', signal });
	if (!res.ok) return [];
	return ((await res.json()) as { scripts?: string[] }).scripts ?? [];
}

/** Starts a simulation with every seat a bot, and returns its table id. */
export async function runSimulation(script: string): Promise<string> {
	const res = await fetch('/api/admin/breach/sims', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ script })
	});
	if (!res.ok) throw new Error(await explain(res));
	return ((await res.json()) as { table_id: string }).table_id;
}

// ── Names and the leaderboard ────────────────────────────────────────────────
// Optional host features: a server without them (or the standalone build, with
// no server at all) answers something that is not our JSON, and every function
// here reports that as `null` so the lobby simply draws nothing. No `explain`,
// because a missing feature must never bounce a player to onboarding.

/** One ranked player. The server sends no identity, only the chosen name. */
export interface Leader {
	rank: number;
	/** `name#1234`. */
	handle: string;
	matches: number;
	wins: number;
	rounds: number;
	buildings_held: number;
}

async function optionalJSON<T>(res: Response): Promise<T | null> {
	if (!res.headers.get('content-type')?.includes('application/json')) return null;
	try {
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

/** Your name, `''` when you have not picked one, `null` when names are unavailable. */
export async function getHandle(): Promise<string | null> {
	const res = await fetch(`${BASE}/handle`, { credentials: 'same-origin' }).catch(() => null);
	if (!res?.ok) return null;
	const body = await optionalJSON<{ handle: string | null }>(res);
	return body ? (body.handle ?? '') : null;
}

/** Pick a name. The server adds the tag. Throws the server's reason on refusal. */
export async function setHandle(name: string): Promise<string> {
	const res = await fetch(`${BASE}/handle`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		credentials: 'same-origin',
		body: JSON.stringify({ name })
	});
	const body = await optionalJSON<{ handle?: string; error?: string }>(res);
	if (!res.ok) throw new Error(body?.error ?? `could not save your name (${res.status})`);
	return body?.handle ?? '';
}

/** The ranked players, or `null` when the server keeps no history. */
export async function getLeaderboard(limit = 20): Promise<Leader[] | null> {
	const res = await fetch(`${BASE}/leaderboard?limit=${limit}`, {
		credentials: 'same-origin'
	}).catch(() => null);
	if (!res?.ok) return null;
	const body = await optionalJSON<{ leaders: Leader[] }>(res);
	return body ? body.leaders : null;
}

/** Name rules, mirrored from breachstore.ValidHandleName so a bad name is caught
 *  before the round trip. The server still decides. */
export const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

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

/** The path segment that opens the game on Insider Threat, for a link that
 *  should land on the office rather than on Breach. */
const INSIDER_SEGMENT = '/insider';

/** The query key and values that carry the picked game through the stepper.
 *  Mirrors `BREACH_GAME_PARAM` in app-ui's `breach/flow.ts`, which sends a
 *  visitor carrying neither a game nor a table back here to pick one. */
const GAME_PARAM = 'game';
const INSIDER_GAME = 'insider';
const CTF_GAME = 'ctf';

/** Was this page opened on Insider Threat's link? Same SPA-fallback reasoning
 *  as `isRulesPath`: only the client can tell the paths apart. */
export function isInsiderPath(): boolean {
	if (typeof location === 'undefined') return false;
	return location.pathname.replace(/\/$/, '').endsWith(INSIDER_SEGMENT);
}

/** The CTF's link, needed because the start screen opens on Insider Threat
 *  wherever it is offered. */
const CTF_SEGMENT = '/ctf';

export function isCtfPath(): boolean {
	if (typeof location === 'undefined') return false;
	return location.pathname.replace(/\/$/, '').endsWith(CTF_SEGMENT);
}

/** The game picked on the start screen, which the stepper carries. Module
 *  state because a refusal anywhere in this file may send the visitor there. */
let insiderPicked = false;

export function pickInsider(on: boolean): void {
	insiderPicked = on;
}

/** `?halloween` on Insider Threat's link: the start screen in its Halloween
 *  look, for a post that wants the office after hours. */
export function arrivedForHalloween(): boolean {
	if (typeof location === 'undefined') return false;
	return new URLSearchParams(location.search).has('halloween');
}

/** The server's marker for "you have not accepted the current legal documents".
 *  Matches `rest.ErrCodeLegalRequired`. */
const LEGAL_REQUIRED = 'legal_acceptance_required';

/** Where a player clears every gate in front of a table — signing in, the legal
 *  documents, a workspace, preferences. app-ui's stepper; the generic onboarding
 *  wizard is the wrong destination for somebody who arrived to play. */
const ONBOARDING_PATH = '/play/start';

/**
 * The stepper, carrying the table this visitor was invited to.
 *
 * ONLY the table id travels, and it is the id this page was opened with — never
 * a URL, never anything read out of a response. A `next=`-style destination
 * minted here would be an open redirect the moment the console honoured it, and
 * `arrivedOnLink` has already checked the id against `TABLE_ID`, so what goes
 * into this string cannot carry a scheme, a host or a slash. The stepper
 * rebuilds `/breach?t=<id>` at the far end from its own constant.
 *
 * Without a table, the game travels instead, as a fixed word rather than a
 * path, so the stepper teaches and opens the game the visitor picked. An
 * invited table already has its game.
 */
function onboardingHref(): string {
	const id = arrivedOnLink();
	if (id) return `${ONBOARDING_PATH}?${INVITE_PARAM}=${id}`;
	return `${ONBOARDING_PATH}?${GAME_PARAM}=${insiderPicked ? INSIDER_GAME : CTF_GAME}`;
}

/** Leave for the stepper, unless we are somehow already on it. Guarded because
 *  every call in this file can trigger it and a bounce loop is worse than the
 *  refusal it was trying to explain.
 *
 *  Exported because the lobby sends a signed-out arrival here BEFORE anything
 *  is refused — see `hasSession`. */
export function toOnboarding(): void {
	if (typeof location === 'undefined') return;
	if (location.pathname.startsWith(ONBOARDING_PATH)) return;
	location.assign(onboardingHref());
}

/** The host's session probe. Public on the armornet side, and answered for an
 *  anonymous caller — 401 with `{"authenticated": false}` rather than a
 *  redirect, which is what makes it safe to ask before there is anybody. */
const SESSION_PATH = '/api/auth/session';

/**
 * Is somebody signed in? `null` when the question cannot be asked here.
 *
 * The three answers are the point. `true` and `false` come from a host that
 * has accounts; `null` is the standalone build of this example, which has no
 * server behind it at all — an SPA fallback answering index.html for
 * `/api/auth/session`, a 404, or no network. A `null` must never be read as
 * "signed out", because sending THAT visitor to `/play/start` bounces them to
 * a route their host does not serve, and the open-source game stops working
 * for everyone who is not armornet.
 *
 * Asked before anything is refused, unlike the 401 handling in `explain`: a
 * lobby only touches the server when somebody asks for an invite, so a
 * first-time visitor could reach the agent-select screen having never been
 * told they need an account.
 */
export async function hasSession(): Promise<boolean | null> {
	if (typeof fetch === 'undefined') return null;
	try {
		const res = await fetch(SESSION_PATH, {
			credentials: 'same-origin',
			headers: { accept: 'application/json' }
		});
		if (res.status === 401) return false;
		if (!res.ok) return null;
		// The body decides, not the status: an SPA fallback answers 200 with
		// index.html, and `authenticated` is the one field only the real endpoint
		// can produce. A parse failure lands in the catch below as `null`.
		const body = (await res.json()) as { authenticated?: boolean };
		return typeof body.authenticated === 'boolean' ? body.authenticated : null;
	} catch {
		return null;
	}
}

/** Turn a failed response into something worth showing a person.
 *
 *  Also the one place a legal-gate refusal can be caught: the gate sits on the
 *  whole /api group, so it answers any call here, and a player left staring at
 *  "the server said 403" has no way to learn what to do about it. */
async function explain(res: Response): Promise<string> {
	// Before the body, because no body could change the answer. A 401 says
	// "missing or invalid token", which is true and useless: the person holding
	// an invitation has no account yet, so the response is to go and make one
	// rather than to name the header they are missing.
	if (res.status === 401) {
		toOnboarding();
		return 'signing you in…';
	}
	// The body next, when there is one. Handlers answer with {"error": "..."}
	// saying WHY — "god admin only", "no organisation on this session" — and the
	// status alone cannot tell those apart, since both are 403.
	try {
		const body = (await res.json()) as { error?: string; code?: string };
		if (body.code === LEGAL_REQUIRED) {
			toOnboarding();
			return 'you have not accepted the terms yet';
		}
		if (body.error) return body.error;
	} catch {
		// A non-JSON body from an error path is not itself interesting.
	}
	// NOT redirected, deliberately, and this is the half that has to stay put: a
	// 403 means the session is real and was refused anyway — no workspace, no
	// entitlement, the wrong org — and sending that back through a sign-in flow
	// it has already completed is an infinite loop wearing a helpful name.
	if (res.status === 403) {
		return 'your account cannot join this table';
	}
	if (res.status === 503) return 'breach is not enabled on this server';
	return `the server said ${res.status}`;
}

/** The query key a table id arrives on. Must match `InviteParam` in
 *  `server/rest/breach.go` — the server builds the link, this reads it. */
export const INVITE_PARAM = 't';

/**
 * A table id, exactly as `newTableID` in `internal/breach/registry.go` mints
 * one: 80 bits of CSPRNG as unpadded uppercase base32, so sixteen characters of
 * `A-Z2-7` and nothing else.
 *
 * Anchored and charset-limited because this value arrives in a query string —
 * anybody can put anything there — and is then written into the sign-in
 * destination and into a WebSocket subscription. The charset admits no scheme,
 * no host, no slash and no `<`, so a value that passes cannot leave the origin
 * or land in the DOM as markup. Rejecting beats escaping here: a string that is
 * not this shape names no table anyway.
 */
const TABLE_ID = /^[A-Z2-7]{16}$/;

/** The table this page was opened for, if it was opened from a link at all —
 *  and null when the parameter is there but is not a table id. */
export function arrivedOnLink(): string | null {
	if (typeof location === 'undefined') return null;
	const id = new URLSearchParams(location.search).get(INVITE_PARAM);
	return id && TABLE_ID.test(id) ? id : null;
}

/** The game picked before the stepper, when the player is back from it. The
 *  stepper's Play now goes to plain `/breach`, and its own address
 *  (`/play/start?game=…`) still names the game, so the start screen is not
 *  shown twice. Null for any other arrival. Needs the `same-origin` referrer
 *  policy compose serves; `no-referrer` would make this always null. */
export function arrivedFromStepper(): typeof INSIDER_GAME | typeof CTF_GAME | null {
	if (typeof document === 'undefined' || !URL.canParse(document.referrer)) return null;
	const from = new URL(document.referrer);
	if (from.origin !== location.origin || from.pathname !== ONBOARDING_PATH) return null;
	const g = from.searchParams.get(GAME_PARAM);
	return g === INSIDER_GAME || g === CTF_GAME ? g : null;
}

/** Put the table in the address bar, so a refresh arrives on the link and
 *  rejoins the seat instead of opening a fresh game. Replace, not push: Back
 *  should leave the game, not step to the same page without its table. */
export function stampTableLink(id: string): void {
	if (typeof location === 'undefined') return;
	const url = new URL(location.href);
	if (url.searchParams.get(INVITE_PARAM) === id) return;
	url.searchParams.set(INVITE_PARAM, id);
	history.replaceState(history.state, '', url);
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

// ── The outfitter's wallet ───────────────────────────────────────────────────
// Money buys marks; marks buy cosmetics. Prices are the server's catalogue
// (rules.gen.ts carries the same numbers), so nothing here names a price.

/** One pack of marks for sale. Mirrors `billing.MarksPack` in Go. */
export interface MarksPack {
	code: string;
	name: string;
	marks: number;
	/** Minor units — cents for USD. */
	price: { amount: number; currency: string };
}

/** A player's wallet. Mirrors `outfitterResponse` in Go. */
export interface Wallet {
	marks: number;
	owned: string[];
	packs: MarksPack[];
	/** Whether marks can be bought here at all. */
	shop: boolean;
}

/** The wallet, or null when there is no server to ask — the standalone example
 *  — which the outfitter reads as "keep the demo account". */
export async function getWallet(): Promise<Wallet | null> {
	try {
		const res = await fetch(`${BASE}/outfitter`, { credentials: 'same-origin' });
		if (!res.ok) return null;
		return (await res.json()) as Wallet;
	} catch {
		return null;
	}
}

export type PurchaseResult =
	| { ok: true; marks: number; owned: string[] }
	| { ok: false; status: number; error: string; marks?: number; owned?: string[] };

/** Spend marks on one cosmetic. The server prices it; a refusal still carries the
 *  wallet, so the caller can show the real balance rather than a guess. */
export async function buyCosmetic(itemKey: string): Promise<PurchaseResult> {
	const res = await fetch(`${BASE}/outfitter/purchase`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		credentials: 'same-origin',
		body: JSON.stringify({ item_key: itemKey })
	});
	const body = (await res.json().catch(() => ({}))) as {
		marks?: number;
		owned?: string[];
		error?: string;
	};
	if (res.ok) return { ok: true, marks: body.marks ?? 0, owned: body.owned ?? [] };
	return { ok: false, status: res.status, error: body.error ?? res.statusText, marks: body.marks, owned: body.owned };
}

/** The query parameter the provider sends a buyer back with. */
export const MARKS_RETURN_PARAM = 'marks';

/** Open the payment page for one pack and leave for it. Marks arrive by the
 *  provider's webhook, not by coming back: the return only starts a re-read. */
export async function checkoutMarks(pack: string): Promise<string> {
	const here = `${location.origin}${location.pathname}`;
	const res = await fetch(`${BASE}/marks/checkout`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		credentials: 'same-origin',
		body: JSON.stringify({
			pack,
			success_url: `${here}?${MARKS_RETURN_PARAM}=success`,
			cancel_url: here
		})
	});
	if (!res.ok) throw new Error(await explain(res));
	return ((await res.json()) as { url: string }).url;
}
