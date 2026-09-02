// ── Sessions on one connection ───────────────────────────────────────────────
// One connection per page, several capabilities on it, one subscriber each.
//
// This replaces a lease that evicted. The module used to publish a single set
// of callbacks, so a second session could only be served by taking the
// connection off the first — a game and a live assessment could not be open at
// once, and the loser was told so on screen because there was nothing better to
// do about it. There is now nothing to evict: they hold different capabilities
// and neither can be handed the other's frames.
//
// What remains genuinely exclusive is one capability twice — two of the same
// surface in one page — and that IS a conflict rather than an accident, so it
// is reported as one.
//
// Nothing in this file names a capability. It used to enumerate them at dial,
// which meant a shared module listing its own consumers, and meant a page that
// only played the game announced a capability it never used. Consumers declare
// instead; see declareCapability.

import { loadAgent } from './loader.js';
import type { ArmornetAgent } from './types.js';

/**
 * Why a subscriber stopped receiving. Two situations, opposite answers, and
 * they arrive through one callback — so the callback has to say which.
 *
 * `displaced` is terminal: somebody else on this page now holds the capability,
 * and reconnecting would take it straight back off them. `closed` is not
 * terminal at all — the socket went away and coming back is the whole point.
 * Collapsing them is how a subscriber ends up either trading the capability
 * with a rival forever, or sitting there disconnected on purpose.
 */
export type LostCause = 'displaced' | 'closed';

interface Subscriber {
	owner: string;
	frame: (type: string, payload: Uint8Array) => void;
	lost: (reason: string, cause: LostCause) => void;
}

/** capability → who is listening. */
const subscribers = new Map<string, Subscriber>();

/** Every capability some module on this page has said it speaks. */
const declared = new Set<string>();

/** What the OPEN connection actually announced, or null while there is none.
 *
 *  Deliberately not the same thing as `declared`: the Line fixes the capability
 *  list at dial, so a declaration that arrives afterwards is real intent that
 *  the server has never been told about. Keeping the two apart is what lets a
 *  subscribe tell "declared too late" from "declared and quiet". */
let dialled: string[] | null = null;
let connecting: Promise<ArmornetAgent> | null = null;

/**
 * Says this page speaks a capability, before anything subscribes to it.
 *
 * Call it at MODULE SCOPE from the client that owns the capability — beside its
 * capability constant, not inside a component. Module bodies of static imports
 * run to completion before the importing module's own body does, so every
 * client a page imports has declared before that page can reach a subscribe,
 * and the connection is dialled knowing all of them.
 *
 * The case that ordering does not cover is a client reached by dynamic import
 * after the socket is already open. That cannot be repaired here: adding a
 * capability to a live Agent Line means dialling again, and a second dial
 * drops every session the first one is carrying. Such a subscribe is refused
 * with an error that says so — a host that code-splits its clients should
 * declare from a module it loads eagerly.
 */
export function declareCapability(capability: string): void {
	declared.add(capability);
}

/** Where the agent dials. Same origin, always.
 *
 *  Not preferred — required: the Line server upgrades with gorilla's default
 *  origin check, which compares Origin to Host INCLUDING the port. A page dialling
 *  a different port directly is refused 403 before any armornet auth runs. */
function agentLineURL(): string {
	const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${proto}//${location.host}/v1/opamp`;
}

/**
 * Opens the page's one connection, once, announcing everything declared so far.
 *
 * All of them at dial rather than on demand, because the Line requires an agent to
 * announce what it intends to speak BEFORE it speaks, and a second dial would
 * mean a second connection. Declaring one the server has not granted costs
 * nothing — the refusal is per message, server-side, where the answer belongs.
 *
 * The list is snapshotted synchronously, before the first await: a declaration
 * that lands mid-dial is not in what the server was told, and recording it as
 * though it were would turn a loud failure into a silent one.
 */
function connect(): Promise<ArmornetAgent> {
	if (connecting) return connecting;
	const announcing = [...declared];
	connecting = (async () => {
		const agent = await loadAgent();
		// No token: the session cookie IS the credential. A browser cannot set an
		// Authorization header on a WebSocket, and it does not need to — the
		// cookie that authenticates every other request travels here too.
		await agent.connect(agentLineURL(), '', { capabilities: announcing });
		dialled = announcing;
		// The registry owns this slot, and it is the ONLY owner. A subscriber
		// that reaches for `agent.onClose` itself overwrites this — the agent is
		// one shared object — and then the close never reaches anybody else, the
		// bookkeeping below never runs, and `connect()` hands the next caller a
		// promise holding a dead agent while reporting success.
		agent.onClose = (reason) => {
			connecting = null;
			dialled = null;
			for (const sub of subscribers.values()) sub.lost(reason, 'closed');
			subscribers.clear();
		};
		return agent;
	})();
	connecting.catch(() => {
		connecting = null;
		dialled = null;
	});
	return connecting;
}

/**
 * Subscribes to one capability on the page's connection, dialling it if this is
 * the first subscriber.
 *
 * `owner` names the subscriber, for the notice a displaced one receives.
 * `onFrame` takes the raw payload; `onLost` fires when the connection closes,
 * or when a LATER subscriber on the SAME capability takes it — never for the
 * subscription that displaces somebody else.
 */
export async function subscribeCapability(
	capability: string,
	owner: string,
	onFrame: (type: string, payload: Uint8Array) => void,
	onLost: (reason: string, cause: LostCause) => void
): Promise<ArmornetAgent> {
	// Checked before the map is touched: a client that forgot to declare is a
	// programming error, and it must not cost whoever legitimately holds the
	// capability their subscription on the way to being told.
	if (!declared.has(capability)) {
		throw new Error(
			`${capability} has not been declared — call declareCapability('${capability}') ` +
				`at module scope in the client that speaks it`
		);
	}

	const previous = subscribers.get(capability);
	subscribers.set(capability, { owner, frame: onFrame, lost: onLost });
	// Displaced before the connection is awaited, not after: a slow dial must
	// not leave two subscribers both believing they hold the capability.
	if (previous && previous.owner !== owner) {
		previous.lost(`another session on this page (${owner}) took ${capability}`, 'displaced');
	}

	try {
		const agent = await connect();
		if (!dialled?.includes(capability)) {
			throw new Error(
				`${capability} was declared after the connection opened with ` +
					`[${dialled?.join(', ') ?? ''}] — the Agent Line fixes the capability list at dial, ` +
					`and adding one now would mean a second dial that drops every other ` +
					`session on this page. Declare it from a module the page loads eagerly.`
			);
		}
		// Bound every time rather than once: the module holds one handler per
		// capability, and rebinding is how a remounted component takes over from
		// the one it replaced without the module knowing either existed.
		await agent.on(capability, (type, payload) => {
			subscribers.get(capability)?.frame(type, payload);
		});
		return agent;
	} catch (err) {
		// A failed subscribe leaves nobody holding the capability rather than a
		// holder with no connection — the next one should not displace a ghost.
		if (subscribers.get(capability)?.owner === owner) subscribers.delete(capability);
		throw err;
	}
}

/** Gives a capability back, if this subscriber still holds it. */
export function unsubscribeCapability(capability: string, owner: string): void {
	if (subscribers.get(capability)?.owner !== owner) return;
	subscribers.delete(capability);
	void window.armornet?.off(capability);
}

/** Who holds a capability, for a host that wants to say so. */
export function capabilityHolder(capability: string): string | null {
	return subscribers.get(capability)?.owner ?? null;
}

const decoder = new TextDecoder();

/** Parses a raw payload the agent handed across. */
export function decodeAgentPayload<T>(raw: Uint8Array): T {
	return JSON.parse(decoder.decode(raw)) as T;
}
