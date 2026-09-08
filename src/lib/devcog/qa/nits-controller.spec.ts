// Node-side coverage for the reactive half of the nits tool. The DOM-bound
// methods (attachInspector, trackPositions, resolvePositions) belong to the
// browser suite; what matters here is the batch bookkeeping and the Escape
// ladder, which is the part three components depend on agreeing about.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NitsController } from './nits.svelte.js';
import type { NitConfig } from './nits.js';

const CONFIG: NitConfig = {
	storageKey: 'test_nits',
	appName: 'test app',
	appStack: 'Svelte 5'
};

/** A capture the way attachInspector would hand one over. */
function capture(selector = 'main > div.card') {
	return {
		selector,
		rect: { top: 10, left: 20, bottom: 40, right: 120, width: 100, height: 30 } as DOMRect,
		outerHTML: '<div class="card">Hello</div>',
		textContent: 'Hello'
	};
}

describe('NitsController', () => {
	beforeEach(() => {
		vi.stubGlobal('window', { location: { pathname: '/vendors' } });
	});

	it('starts empty', () => {
		const c = new NitsController(CONFIG);
		expect(c.count).toBe(0);
		expect(c.inspecting).toBe(false);
		expect(c.capture).toBeNull();
	});

	it('commits a capture plus its note to the batch', () => {
		const c = new NitsController(CONFIG);
		c.capture = capture();
		c.note = '  spacing is off  ';
		c.save();

		expect(c.count).toBe(1);
		expect(c.nits[0].note).toBe('spacing is off');
		expect(c.nits[0].selector).toBe('main > div.card');
		expect(c.nits[0].url).toBe('/vendors');
		// The popup is torn down and the draft cleared, ready for the next pick.
		expect(c.capture).toBeNull();
		expect(c.note).toBe('');
	});

	it('labels an empty note rather than saving a blank one', () => {
		const c = new NitsController(CONFIG);
		c.capture = capture();
		c.save();
		expect(c.nits[0].note).toBe('(no note)');
	});

	it('ignores save with nothing captured', () => {
		const c = new NitsController(CONFIG);
		c.save();
		expect(c.count).toBe(0);
	});

	it('drops the capture on cancel without touching the batch', () => {
		const c = new NitsController(CONFIG);
		c.capture = capture();
		c.note = 'never mind';
		c.cancel();
		expect(c.capture).toBeNull();
		expect(c.note).toBe('');
		expect(c.count).toBe(0);
	});

	it('removes one nit and clears the rest', () => {
		const c = new NitsController(CONFIG);
		c.capture = capture('a');
		c.save();
		c.capture = capture('b');
		c.save();
		expect(c.count).toBe(2);

		c.remove(c.nits[0].id);
		expect(c.count).toBe(1);
		expect(c.nits[0].selector).toBe('b');

		c.clear();
		expect(c.count).toBe(0);
		expect(c.positions).toEqual({});
	});

	it('copies the ticked nits, falling back to the whole batch', () => {
		const c = new NitsController(CONFIG);
		c.capture = capture('a');
		c.save();
		c.capture = capture('b');
		c.save();
		c.capture = capture('c');
		c.save();

		// Nothing ticked — every copy action means the whole batch.
		expect(c.copyTargets.map((n) => n.selector)).toEqual(['a', 'b', 'c']);

		// Ticked out of order, but emitted in batch order.
		c.toggleSelect(c.nits[2].id);
		c.toggleSelect(c.nits[0].id);
		expect(c.selectedCount).toBe(2);
		expect(c.copyTargets.map((n) => n.selector)).toEqual(['a', 'c']);

		c.toggleSelect(c.nits[2].id);
		expect(c.copyTargets.map((n) => n.selector)).toEqual(['a']);

		c.selectAll();
		expect(c.selectedCount).toBe(3);
		c.clearSelection();
		expect(c.copyTargets).toHaveLength(3);
	});

	it('drops a removed nit from the selection', () => {
		const c = new NitsController(CONFIG);
		c.capture = capture('a');
		c.save();
		c.capture = capture('b');
		c.save();

		c.selectAll();
		c.remove(c.nits[0].id);
		expect(c.selectedCount).toBe(1);
		expect(c.copyTargets.map((n) => n.selector)).toEqual(['b']);

		c.clear();
		expect(c.selectedCount).toBe(0);
	});

	it('unwinds Escape innermost-first and reports what it consumed', () => {
		const c = new NitsController(CONFIG);

		// Nothing open — the host gets to handle the key itself.
		expect(c.escape()).toBe(false);

		// A pending note outranks the inspector that produced it.
		c.inspecting = true;
		c.capture = capture();
		expect(c.escape()).toBe(true);
		expect(c.capture).toBeNull();
		expect(c.inspecting).toBe(true);

		// Second press disarms the inspector.
		expect(c.escape()).toBe(true);
		expect(c.inspecting).toBe(false);

		expect(c.escape()).toBe(false);

		// A live selection is the last thing Escape unwinds.
		c.capture = capture();
		c.save();
		c.selectAll();
		expect(c.escape()).toBe(true);
		expect(c.selectedCount).toBe(0);
		expect(c.escape()).toBe(false);
	});

	it('toggling the inspector off discards an in-flight capture', () => {
		const c = new NitsController(CONFIG);
		c.toggleInspect();
		expect(c.inspecting).toBe(true);

		c.capture = capture();
		c.hoverRect = { top: 0 } as DOMRect;
		c.toggleInspect();

		expect(c.inspecting).toBe(false);
		expect(c.capture).toBeNull();
		expect(c.hoverRect).toBeNull();
	});

	// The console close path. DevCog closes its panel when `escape()` declines the
	// key, and it never calls `stopInspect()` on close — the old drawer did, which
	// is what made the element under the panel unclickable the moment you moved
	// the panel out of the way. The component wiring is asserted in
	// `DevCog.svelte.spec.ts`; what belongs here is the contract it relies on.
	it('declines Escape once only the console is open, and stays armed either way', () => {
		const c = new NitsController(CONFIG);
		c.toggleInspect();
		expect(c.inspecting).toBe(true);

		// First press is the inspector's: the host must NOT also close its panel.
		expect(c.escape()).toBe(true);
		expect(c.inspecting).toBe(false);

		// Re-arm, then simulate the other order — a host closing its console has
		// no reason to touch the controller at all, so nothing here changes.
		c.toggleInspect();
		expect(c.inspecting).toBe(true);
		expect(c.capture).toBeNull();
		expect(c.count).toBe(0);
		// Nothing about closing a panel is expressible on this controller, which
		// is the guarantee: there is no path from "console closed" to "disarmed".
		expect(c.inspecting).toBe(true);
	});

	it('a borrowed pick does not survive an explicit arm', () => {
		const c = new NitsController(CONFIG);
		c.pickOnce(() => {});
		expect(c.borrowed).toBe(true);
		expect(c.inspecting).toBe(true);

		// An explicit arm from the cluster always wins back the nit flow, so two
		// tools cannot end up competing for the same click.
		c.toggleInspect(); // disarms
		c.toggleInspect(); // re-arms, as the nit flow
		expect(c.borrowed).toBe(false);
		expect(c.inspecting).toBe(true);
	});
});
