import { describe, it, expect, beforeEach } from 'vitest';
import { BuilderStore } from './store.svelte.js';
import type { CanvasSessionPort, SessionOp, SessionState } from './session.js';

// What the store does when somebody else is watching, and — just as important —
// what it does not do when nobody is.
//
// The tests assert on the OPS that leave and the CANVAS that results, not on
// private fields: the session boundary is the contract, and the machinery behind
// it should be free to change without any of this needing to.

/** A session that records what it was told, and tells nothing back. */
class RecordingSession implements CanvasSessionPort {
	ops: SessionOp[] = [];
	#listeners: ((s: SessionState) => void)[] = [];

	async join(): Promise<void> {}
	apply(op: SessionOp): void {
		this.ops.push(op);
	}
	say(): void {}
	setMuted(): void {}
	onChange(fn: (s: SessionState) => void): void {
		this.#listeners.push(fn);
	}
	leave(): void {}

	/** Pretend the server sent this. */
	push(state: SessionState): void {
		for (const fn of this.#listeners) fn(state);
	}

	kinds(): string[] {
		return this.ops.map((o) => o.kind);
	}
}

function state(over: Partial<SessionState> = {}): SessionState {
	return {
		participants: [
			{ id: 'p_you', name: 'You', kind: 'user', present: true },
			{ id: 'p_dana', name: 'Dana', kind: 'user', present: true }
		],
		chat: [],
		agentBusy: false,
		queueDepth: 0,
		agentMuted: false,
		youId: 'p_you',
		...over
	};
}

let store: BuilderStore;
let session: RecordingSession;

beforeEach(() => {
	store = new BuilderStore();
	// The app hydrates on mount, and hydration is what seeds the undo floor. A
	// store that skipped it would report `canUndo` false forever and quietly make
	// the solo-undo assertions vacuous.
	store.hydrate();
	session = new RecordingSession();
});

describe('with no session attached', () => {
	it('sends nothing, because there is nobody to send to', () => {
		store.addItem('Button', 40, 40);
		const id = store.items[0].id;
		store.updateProp(id, 'label', 'Agents');
		store.dragItemTo(id, 100, 100, 0, 0);
		store.snapItem(id);
		store.deleteItem(id);

		expect(session.ops).toEqual([]);
	});

	it('is not shared, and says so', () => {
		expect(store.shared).toBe(false);
	});

	it('reports nothing as held, because nobody else exists', () => {
		store.addItem('Button', 0, 0);
		expect(store.holderOf(store.items[0].id)).toBeNull();
	});

	it('says nothing about local-only surfaces', () => {
		// Nothing is unshared when there is nobody to be out of step with. A notice
		// here would be a warning about a problem that cannot occur.
		store.addConnector('a', 'b');
		store.setGridSize(40);
		expect(store.notice).toBeNull();
	});

	it('keeps its own undo history', () => {
		store.addItem('Button', 0, 0);
		expect(store.canUndo).toBe(true);
		store.undo();
		expect(store.items).toHaveLength(0);
	});
});

describe('with a session attached', () => {
	beforeEach(() => {
		store.attachSession(session);
	});

	it('sends what it does', () => {
		store.addItem('Button', 40, 40);
		expect(session.kinds()).toContain('add');

		const id = store.items[0].id;
		session.ops = [];
		store.updateProp(id, 'label', 'Agents');
		expect(session.ops).toEqual([
			{ kind: 'props', itemId: id, props: { label: 'Agents' } }
		]);
	});

	it('bounds a drag with a grab and a release', () => {
		store.addItem('Button', 0, 0);
		const id = store.items[0].id;
		session.ops = [];

		store.dragItemTo(id, 10, 10, 0, 0);
		store.dragItemTo(id, 20, 20, 0, 0);
		store.dragItemTo(id, 30, 30, 0, 0);
		store.snapItem(id);

		const kinds = session.kinds();
		expect(kinds[0]).toBe('grab');
		expect(kinds[kinds.length - 1]).toBe('release');
		// Every pointer move travels. That is the point of the fidelity decision,
		// and a throttle appearing later would show up here first.
		expect(kinds.filter((k) => k === 'move').length).toBeGreaterThanOrEqual(3);
		expect(kinds.filter((k) => k === 'grab')).toHaveLength(1);
	});

	it('takes the hold once, not once per pointer move', () => {
		store.addItem('Button', 0, 0);
		const id = store.items[0].id;
		session.ops = [];

		for (let i = 0; i < 20; i++) store.dragItemTo(id, i, i, 0, 0);
		expect(session.kinds().filter((k) => k === 'grab')).toHaveLength(1);
	});

	it('hands undo to the session rather than walking its own history', () => {
		// Whose edit gets reversed is a rule about a shared document. Local history
		// is single-author and knows none of it.
		store.addItem('Button', 0, 0);
		session.ops = [];
		store.undo();

		expect(session.ops).toEqual([{ kind: 'undo' }]);
		// And it did NOT quietly reverse anything locally.
		expect(store.items).toHaveLength(1);
	});
});

describe('adopting what the session sends', () => {
	beforeEach(() => {
		store.attachSession(session);
	});

	it('takes the session canvas as the truth', () => {
		store.adopt(
			state({
				canvas: {
					items: [
						{ id: 'it_1', componentId: 'Button', x: 10, y: 20, w: 100, h: 50, z: 0 }
					],
					frames: [{ id: 'fr_1', name: 'Overview', x: 0, y: 0, w: 1440, h: 900 }],
					groups: [{ id: 'g_1', name: 'Header' }],
					heldBy: {}
				}
			})
		);

		expect(store.items).toHaveLength(1);
		expect(store.items[0].id).toBe('it_1');
		expect(store.items[0].x).toBe(10);
		expect(store.frames[0].name).toBe('Overview');
		expect(store.groups[0].name).toBe('Header');
	});

	it('emits nothing while adopting', () => {
		// The echo. If adoption emitted, every participant would send back
		// everything they were just told, forever.
		store.adopt(
			state({
				canvas: {
					items: [{ id: 'it_1', componentId: 'Button', x: 0, y: 0, w: 0, h: 0, z: 0 }],
					frames: [],
					groups: [],
					heldBy: {}
				}
			})
		);
		expect(session.ops).toEqual([]);
	});

	it('leaves the canvas alone when the session carries none', () => {
		// The solo session. Adopting an empty canvas from it would wipe the page.
		store.addItem('Button', 40, 40);
		const before = store.items.length;

		store.adopt(state());

		expect(store.items).toHaveLength(before);
	});

	it('does not move the item under your own hand', () => {
		// Your earlier positions come back as newer state. Applying them is what
		// makes a drag stutter and snap backwards under the pointer.
		store.addItem('Button', 0, 0);
		const id = store.items[0].id;
		store.dragItemTo(id, 500, 500, 0, 0);

		store.adopt(
			state({
				canvas: {
					items: [{ id, componentId: 'Button', x: 12, y: 12, w: 0, h: 0, z: 0 }],
					frames: [],
					groups: [],
					heldBy: {}
				}
			})
		);

		expect(store.items[0].x).toBe(500);
		expect(store.items[0].y).toBe(500);
	});

	it('does adopt every other item during your drag', () => {
		store.addItem('Button', 0, 0);
		const mine = store.items[0].id;
		store.dragItemTo(mine, 500, 500, 0, 0);

		store.adopt(
			state({
				canvas: {
					items: [
						{ id: mine, componentId: 'Button', x: 0, y: 0, w: 0, h: 0, z: 0 },
						{ id: 'it_theirs', componentId: 'Button', x: 300, y: 300, w: 0, h: 0, z: 1 }
					],
					frames: [],
					groups: [],
					heldBy: {}
				}
			})
		);

		expect(store.items.find((i) => i.id === mine)?.x).toBe(500);
		expect(store.items.find((i) => i.id === 'it_theirs')?.x).toBe(300);
	});

	it('names who is holding an item, rather than showing an identifier', () => {
		store.adopt(
			state({
				canvas: {
					items: [{ id: 'it_1', componentId: 'Button', x: 0, y: 0, w: 0, h: 0, z: 0 }],
					frames: [],
					groups: [],
					heldBy: { it_1: 'p_dana' }
				}
			})
		);
		expect(store.holderOf('it_1')).toBe('DANA');
	});

	it('does not report your own hold back to you', () => {
		store.adopt(
			state({
				canvas: {
					items: [{ id: 'it_1', componentId: 'Button', x: 0, y: 0, w: 0, h: 0, z: 0 }],
					frames: [],
					groups: [],
					heldBy: { it_1: 'p_you' }
				}
			})
		);
		expect(store.holderOf('it_1')).toBeNull();
	});

	it('refuses to move an item somebody else is dragging', () => {
		store.adopt(
			state({
				canvas: {
					items: [{ id: 'it_1', componentId: 'Button', x: 0, y: 0, w: 0, h: 0, z: 0 }],
					frames: [],
					groups: [],
					heldBy: { it_1: 'p_dana' }
				}
			})
		);
		session.ops = [];

		store.dragItemTo('it_1', 400, 400, 0, 0);

		// Refused locally, so the item never moves and then jumps back — and
		// nothing is sent for the server to refuse a second time.
		expect(store.items[0].x).toBe(0);
		expect(session.ops).toEqual([]);
	});

	it('drops a connector whose endpoint somebody else deleted', () => {
		store.adopt(
			state({
				canvas: {
					items: [
						{ id: 'it_1', componentId: 'Button', x: 0, y: 0, w: 0, h: 0, z: 0 },
						{ id: 'it_2', componentId: 'Button', x: 0, y: 0, w: 0, h: 0, z: 1 }
					],
					frames: [],
					groups: [],
					heldBy: {}
				}
			})
		);
		store.addConnector('it_1', 'it_2');
		expect(store.connectors).toHaveLength(1);

		store.adopt(
			state({
				canvas: {
					items: [{ id: 'it_1', componentId: 'Button', x: 0, y: 0, w: 0, h: 0, z: 0 }],
					frames: [],
					groups: [],
					heldBy: {}
				}
			})
		);

		// Connectors are local, but the items they join are not.
		expect(store.connectors).toHaveLength(0);
	});
});
