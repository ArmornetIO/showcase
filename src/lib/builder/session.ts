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
	| { kind: 'undo' };

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
		// echoing the change back would apply it twice.
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
