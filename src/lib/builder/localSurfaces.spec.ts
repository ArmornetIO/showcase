import { describe, it, expect, beforeEach } from 'vitest';
import { LOCAL_SURFACES, isLocalSurface, type LocalSurface } from './localSurfaces.js';
import { BuilderStore } from './store.svelte.js';
import type { CanvasSessionPort, SessionOp } from './session.js';

// The scope boundary, tested as a boundary.
//
// The risk this guards is not that the code breaks — it is that the code stays
// correct while the WORDS go stale: a surface becomes shared, the list still
// says it is private, and the interface confidently tells people something
// untrue. So these assert the list against the store's actual behaviour rather
// than against itself.

class SilentSession implements CanvasSessionPort {
	ops: SessionOp[] = [];
	async join(): Promise<void> {}
	apply(op: SessionOp): void {
		this.ops.push(op);
	}
	say(): void {}
	setMuted(): void {}
	onChange(): void {}
	leave(): void {}
}

let store: BuilderStore;
let session: SilentSession;

beforeEach(() => {
	store = new BuilderStore();
	store.hydrate();
	session = new SilentSession();
});

describe('the list itself', () => {
	it('names every surface the session does not carry', () => {
		// Written out rather than derived, so that adding a surface to the code
		// without deciding what to tell people fails here.
		const expected: LocalSurface[] = [
			'connector',
			'cluster',
			'page',
			'tour',
			'canvasSize',
			'grid',
			'itemName',
			'style',
			'visibility'
		];
		expect(Object.keys(LOCAL_SURFACES).sort()).toEqual([...expected].sort());
	});

	it('says something real about each one', () => {
		for (const [surface, wording] of Object.entries(LOCAL_SURFACES)) {
			expect(wording.length, `${surface} has no wording`).toBeGreaterThan(20);
			// Every notice has to answer "who can see this", or it is not doing the
			// one job it exists for.
			expect(
				/yours alone|only you|not.*shared|nobody else/i.test(wording),
				`${surface} does not say whose it is: ${wording}`
			).toBe(true);
		}
	});

	it('does not claim anything shared is private', () => {
		// Items, frames and groups DO travel. A notice about one of them would be
		// a lie told confidently.
		for (const shared of ['item', 'frame', 'group', 'component']) {
			expect(isLocalSurface(shared)).toBe(false);
		}
	});
});

describe('what a person is told', () => {
	it('says nothing when nobody else is watching', () => {
		store.addConnector('a', 'b');
		store.setGridSize(40);
		store.addPage('Second');
		expect(store.notice).toBeNull();
	});

	it('speaks up the first time a surface is used in a shared session', () => {
		store.attachSession(session);
		store.addConnector('a', 'b');
		expect(store.notice).toBe(LOCAL_SURFACES.connector);
	});

	it('does not say the same thing twice', () => {
		// A notice that always appears is a notice nobody reads.
		store.attachSession(session);
		store.addConnector('a', 'b');
		store.dismissNotice();
		store.addConnector('c', 'd');
		expect(store.notice).toBeNull();
	});

	it('still speaks up about a different surface', () => {
		store.attachSession(session);
		store.addConnector('a', 'b');
		store.dismissNotice();
		store.setGridSize(40);
		expect(store.notice).toBe(LOCAL_SURFACES.grid);
	});

	it('starts over for a new session', () => {
		// What is local is a property of THIS session. Somebody joining a second
		// one is owed the explanation again.
		store.attachSession(session);
		store.addConnector('a', 'b');
		store.dismissNotice();

		store.attachSession(new SilentSession());
		store.addConnector('c', 'd');
		expect(store.notice).not.toBeNull();
	});

	it('sends nothing to the session for a local surface', () => {
		// The other half of the promise: told it is local AND actually kept local.
		store.attachSession(session);
		store.addConnector('a', 'b');
		store.setGridSize(40);
		store.setCanvasSize(2000, 2000);
		store.addPage('Second');
		expect(session.ops).toEqual([]);
	});
});
