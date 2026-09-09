// The canvas session port.
//
// The builder owns canvas state and knows nothing about how that state gets to
// anybody else. This interface is the whole of what it knows: join, apply, say
// something, and be told when someone else changed things.
//
// showcase ships the LOCAL implementation, which is what the component library
// is on its own — one person, one browser, storage that survives a reload. The
// host application injects a live implementation backed by its own transport.
// That is why nothing in this file imports a socket, a capability, or a protocol:
// a design system that had to know about WebSockets would not be a design system.

/** Somebody in a session. `kind` distinguishes a person from an agent. */
export interface SessionParticipant {
	id: string;
	name: string;
	kind: 'user' | 'agent';
	present: boolean;
}

/** One message in the session's group chat. */
export interface SessionMessage {
	id: string;
	authorId: string;
	body: string;
	at: number;
	/** A remark the agent made on its own initiative rather than in answer. */
	unprompted?: boolean;
}

/** One change to the canvas. Mirrors the builder's own vocabulary, not a wire
 *  format — translating to a protocol is the host's job. */
export type SessionOp =
	| { kind: 'add'; componentId: string; x: number; y: number; props?: Record<string, unknown> }
	| { kind: 'move'; itemId: string; x: number; y: number }
	| { kind: 'resize'; itemId: string; w: number; h: number }
	| { kind: 'props'; itemId: string; props: Record<string, unknown> }
	| { kind: 'remove'; itemId: string }
	| { kind: 'undo' }
	/** Create a frame (no `frameId`) or adjust one. */
	| {
			kind: 'frame';
			frameId?: string;
			name?: string;
			x?: number;
			y?: number;
			w?: number;
			h?: number;
	  }
	/** Remove a frame. What sat inside it stays where it is. */
	| { kind: 'unframe'; frameId: string }
	/** Bounds one drag. Taking the item first is what stops two people fighting
	 *  over it, and it is also what makes the whole gesture cost one undo rather
	 *  than one per frame. */
	| { kind: 'grab'; itemId: string }
	| { kind: 'release'; itemId: string };

/** One placed component, as the session holds it. */
export interface SessionItem {
	id: string;
	componentId: string;
	x: number;
	y: number;
	w: number;
	h: number;
	props?: Record<string, unknown>;
	z: number;
	groupId?: string;
}

/** A bounded region standing in for a screen. */
export interface SessionFrame {
	id: string;
	name: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A named collection of items. */
export interface SessionGroup {
	id: string;
	name: string;
}

/**
 * The shared canvas.
 *
 * Deliberately narrower than what the builder owns. Connectors, clusters, pages,
 * tours, canvas dimensions, grid and snap settings, item names, style overrides
 * and lock/visibility flags are NOT here: they stay in the browser that made
 * them. A participant changing one of those changes it only for themselves,
 * which is a decision — see `localSurfaces.ts` for how it is communicated.
 */
export interface SessionCanvas {
	items: SessionItem[];
	frames: SessionFrame[];
	groups: SessionGroup[];
	/** Items being dragged right now, and by whom. Absent from the map is free. */
	heldBy: Record<string, string>;
}

/** What a session hands back when anything changes. */
export interface SessionState {
	participants: SessionParticipant[];
	chat: SessionMessage[];
	/** Whether the agent is working, and how many requests are waiting. Rendered
	 *  so a queued request never looks like one that was ignored. */
	agentBusy: boolean;
	queueDepth: number;
	/** Whether unprompted remarks are silenced. Watching continues regardless. */
	agentMuted: boolean;
	/** The current participant's own id, so the UI can tell "mine" from "theirs". */
	youId: string;
	/**
	 * The shared canvas, when this session is the one that holds it.
	 *
	 * ABSENT means the session does not carry a canvas and the local store is
	 * still the record — which is exactly the solo case. That distinction is a
	 * field rather than a convention because the alternative is a session that
	 * publishes an empty canvas and a store that faithfully adopts it, wiping
	 * everything the person had drawn.
	 */
	canvas?: SessionCanvas;
	/**
	 * Why the session is gone for good, when it is.
	 *
	 * Only for a loss that will NOT recover on its own — an ordinary
	 * disconnection is the host's business and is being retried. Somebody whose
	 * session ended has to be told, because a canvas that looks shared and
	 * reaches nobody is the worst state this feature can leave them in.
	 */
	lost?: string;
}

export interface CanvasSessionPort {
	/** Join. Resolves once the session is usable. */
	join(): Promise<void>;
	/** Apply one change. */
	apply(op: SessionOp): void;
	/** Say something. `addressed` makes it a request to the agent; without it the
	 *  agent reads the message and does not act on it. */
	say(body: string, addressed?: boolean): void;
	/** Stop or resume unprompted remarks. */
	setMuted(muted: boolean): void;
	/** Called whenever the session changes underneath us. */
	onChange(fn: (state: SessionState) => void): void;
	/** Give up the seat. */
	leave(): void;
}

/**
 * The solo session: no transport, no collaborators, no agent.
 *
 * This is the honest default rather than a stub. Opening the builder without a
 * host to back it is a real thing somebody does — it is the component library's
 * own demo — and it should work, quietly, with the canvas behaving exactly as it
 * always has.
 */
export class LocalSession implements CanvasSessionPort {
	#listeners: ((state: SessionState) => void)[] = [];
	#chat: SessionMessage[] = [];
	#seq = 0;

	async join(): Promise<void> {
		this.#emit();
	}

	apply(_op: SessionOp): void {
		// Nothing to do: with one participant the canvas store IS the session, and
		// echoing the change back would apply it twice. That includes grab and
		// release — there is nobody to hold an item against.
	}

	say(body: string): void {
		this.#chat = [
			...this.#chat,
			{ id: `local:${this.#seq++}`, authorId: 'you', body, at: Date.now() }
		];
		this.#emit();
	}

	setMuted(): void {
		// There is no agent to silence.
	}

	onChange(fn: (state: SessionState) => void): void {
		this.#listeners.push(fn);
	}

	leave(): void {
		this.#listeners = [];
	}

	#emit(): void {
		// No `canvas`, deliberately. The store keeps its own and must not be told
		// to adopt an empty one.
		const state: SessionState = {
			participants: [{ id: 'you', name: 'You', kind: 'user', present: true }],
			chat: this.#chat,
			agentBusy: false,
			queueDepth: 0,
			agentMuted: false,
			youId: 'you'
		};
		for (const fn of this.#listeners) fn(state);
	}
}
