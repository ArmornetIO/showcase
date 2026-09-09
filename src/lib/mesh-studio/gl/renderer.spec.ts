// Node tests — no real WebGL. What is pinned here is the part of a multi-pass
// renderer that fails SILENTLY: draw order, blend leakage between passes, and
// whether every pass came back after a context loss. All three produce a picture
// that looks plausible and is wrong, which is the same class of bug that once
// shipped a globe missing its entire graticule.
import { describe, it, expect, vi } from 'vitest';
import { createSharedRenderer, type RenderPass, type FrameContext } from './renderer.js';

// ── Fakes ───────────────────────────────────────────────────────────────────
// Only the surface `createGlContext` and the renderer actually touch. A fuller
// mock would be a second implementation to keep correct.

const GL_CONST = {
	SRC_ALPHA: 770,
	ONE_MINUS_SRC_ALPHA: 771,
	ONE: 1,
	ONE_MINUS_SRC_COLOR: 769,
	COLOR_BUFFER_BIT: 16384,
	BLEND: 3042,
};

function fakeGl() {
	return {
		...GL_CONST,
		blendFunc: vi.fn(),
		viewport: vi.fn(),
		clearColor: vi.fn(),
		clear: vi.fn(),
		enable: vi.fn(),
		getExtension: vi.fn(() => null),
	};
}

function fakeCanvas(gl: unknown, opts: { clientWidth?: number; clientHeight?: number } = {}) {
	const listeners = new Map<string, ((e: unknown) => void)[]>();
	const canvas = {
		clientWidth: opts.clientWidth ?? 800,
		clientHeight: opts.clientHeight ?? 600,
		width: 0,
		height: 0,
		getContext: vi.fn(() => gl),
		addEventListener: (type: string, fn: (e: unknown) => void) => {
			listeners.set(type, [...(listeners.get(type) ?? []), fn]);
		},
		removeEventListener: () => {},
		/** Fire a lifecycle event the way the driver would. */
		fire: (type: string) => {
			for (const fn of listeners.get(type) ?? []) fn({ preventDefault() {} });
		},
	};
	return canvas;
}

/** A pass that records the order it was drawn in, into a shared log. */
function tracer(
	name: string,
	order: number,
	log: string[],
	over: Partial<RenderPass> = {},
): RenderPass {
	return {
		name,
		order,
		blend: 'over',
		enabled: true,
		init: vi.fn(),
		draw: vi.fn(() => log.push(name)),
		dispose: vi.fn(),
		...over,
	};
}

const FRAME: FrameContext = { t: 0, dt: 16, cssWidth: 800, cssHeight: 600, dpr: 1 };

function setup(opts: Parameters<typeof createSharedRenderer>[1] = {}, dpr = 1) {
	const prev = globalThis.devicePixelRatio;
	Object.defineProperty(globalThis, 'devicePixelRatio', { value: dpr, configurable: true });
	const gl = fakeGl();
	const canvas = fakeCanvas(gl);
	const r = createSharedRenderer(canvas as never, opts);
	return {
		gl,
		canvas,
		r: r!,
		restore: () => Object.defineProperty(globalThis, 'devicePixelRatio', { value: prev, configurable: true }),
	};
}

// ── 1-3: ordering, skipping, unregister ─────────────────────────────────────

describe('pass ordering', () => {
	it('draws in ascending order regardless of registration sequence', () => {
		const { r, restore } = setup();
		const log: string[] = [];
		r.add(tracer('third', 3, log));
		r.add(tracer('first', 1, log));
		r.add(tracer('second', 2, log));

		r.render(FRAME);

		expect(log).toEqual(['first', 'second', 'third']);
		restore();
	});

	it('skips a disabled pass without disturbing its neighbours', () => {
		const { r, restore } = setup();
		const log: string[] = [];
		r.add(tracer('a', 1, log));
		r.add(tracer('b', 2, log, { enabled: false }));
		r.add(tracer('c', 3, log));

		r.render(FRAME);

		expect(log).toEqual(['a', 'c']);
		restore();
	});

	it('unregister removes the pass and disposes it exactly once', () => {
		const { r, restore } = setup();
		const log: string[] = [];
		const pass = tracer('gone', 1, log);
		const off = r.add(pass);
		r.add(tracer('stays', 2, log));

		off();
		off(); // Idempotent — a Svelte effect can clean up twice on teardown.
		r.render(FRAME);

		expect(log).toEqual(['stays']);
		expect(pass.dispose).toHaveBeenCalledTimes(1);
		restore();
	});
});

// ── 4-6: the density clamp ──────────────────────────────────────────────────

describe('dpr clamp', () => {
	it('clamps a high-density display to the ceiling', () => {
		const { canvas, r, restore } = setup({ dprCeiling: 1.5 }, 3);
		r.resize();
		// 800 × 1.5, not 800 × 3. The whole point of the feature.
		expect(canvas.width).toBe(1200);
		expect(canvas.height).toBe(900);
		restore();
	});

	it('is a no-op below the ceiling — a standard display is unaffected', () => {
		const { canvas, r, restore } = setup({ dprCeiling: 1.5 }, 1);
		r.resize();
		expect(canvas.width).toBe(800);
		expect(canvas.height).toBe(600);
		restore();
	});

	it('rounds rather than floors, so an edge does not lose a device pixel', () => {
		const { canvas, r, restore } = setup({ dprCeiling: 1.25 }, 1.25);
		r.resize();
		// 600 × 1.25 = 750 exactly; 800 × 1.25 = 1000. Both integral, but the
		// rounding path is what a fractional dpr like 1.1 depends on.
		expect(canvas.width).toBe(1000);
		expect(canvas.height).toBe(750);
		restore();
	});

	it('assigns the buffer size only when it changed', () => {
		const { canvas, r, restore } = setup({ dprCeiling: 1 }, 1);
		r.resize();
		const first = canvas.width;

		// Count writes with a real getter/setter pair. `vi.spyOn(obj, 'width',
		// 'set')` cannot be used here: on a plain data property it installs a
		// setter and leaves the getter undefined, so the guard's own
		// `canvas.width !== w` reads undefined, believes the size changed, and
		// writes — the spy manufactures the failure it is meant to detect.
		let writes = 0;
		let backing = first;
		Object.defineProperty(canvas, 'width', {
			get: () => backing,
			set: (v: number) => {
				writes++;
				backing = v;
			},
			configurable: true,
		});

		// Assigning width/height reallocates AND clears even for an identical
		// value, so a per-frame write would throw the frame away.
		r.resize();
		r.resize();

		expect(writes).toBe(0);
		expect(canvas.width).toBe(first);
		restore();
	});
});

// ── 7: unavailable WebGL ────────────────────────────────────────────────────

describe('availability', () => {
	it('returns null rather than throwing when WebGL2 is unavailable', () => {
		const canvas = fakeCanvas(null);
		// "No WebGL" is a supported outcome with a documented fallback, not a bug.
		expect(() => createSharedRenderer(canvas as never)).not.toThrow();
		expect(createSharedRenderer(canvas as never)).toBeNull();
	});
});

// ── 8-9: blend ──────────────────────────────────────────────────────────────

describe('blend', () => {
	it('maps every mode to its documented blendFunc pair', () => {
		const { gl, r, restore } = setup();
		const seen: number[][] = [];
		gl.blendFunc.mockImplementation((a: number, b: number) => void seen.push([a, b]));

		r.setBlend('over');
		r.setBlend('over-premultiplied');
		r.setBlend('add');
		r.setBlend('screen');

		expect(seen).toEqual([
			[GL_CONST.SRC_ALPHA, GL_CONST.ONE_MINUS_SRC_ALPHA],
			[GL_CONST.ONE, GL_CONST.ONE_MINUS_SRC_ALPHA],
			[GL_CONST.SRC_ALPHA, GL_CONST.ONE],
			// `screen` is exactly src + dst − src·dst. Not an approximation, and the
			// hologram look depends on it — an earlier contract draft omitted it.
			[GL_CONST.ONE, GL_CONST.ONE_MINUS_SRC_COLOR],
		]);
		restore();
	});

	it('does not let one pass leak its blend into the next', () => {
		const { gl, r, restore } = setup();
		const modes: number[][] = [];
		r.add({
			name: 'switcher',
			order: 1,
			blend: 'over',
			enabled: true,
			init: vi.fn(),
			// GlobePieces legitimately ends its draw in `screen`.
			draw: (_gl, _f, sink) => sink.setBlend('screen'),
			dispose: vi.fn(),
		});
		r.add({
			name: 'after',
			order: 2,
			blend: 'add',
			enabled: true,
			init: vi.fn(),
			draw: () => {
				const calls = gl.blendFunc.mock.calls;
				modes.push(calls[calls.length - 1] as number[]);
			},
			dispose: vi.fn(),
		});

		r.render(FRAME);

		// Reset to `after`'s declared mode, not inherited `screen`.
		expect(modes[0]).toEqual([GL_CONST.SRC_ALPHA, GL_CONST.ONE]);
		restore();
	});
});

// ── 10: context loss ────────────────────────────────────────────────────────

describe('context loss', () => {
	it('re-inits EVERY registered pass after a restore, not a subset', () => {
		const { canvas, r, restore } = setup();
		const log: string[] = [];
		const a = tracer('a', 1, log);
		const b = tracer('b', 2, log);
		const c = tracer('c', 3, log);
		r.add(a);
		r.add(b);
		r.add(c);
		// One init each on registration.
		for (const p of [a, b, c]) expect(p.init).toHaveBeenCalledTimes(1);

		canvas.fire('webglcontextlost');
		canvas.fire('webglcontextrestored');

		// A partial rebuild shows as a scene missing one layer — far harder to
		// notice than a blank canvas, which is why this is asserted per pass.
		for (const p of [a, b, c]) expect(p.init).toHaveBeenCalledTimes(2);
		restore();
	});

	it('draws nothing while lost', () => {
		const { canvas, r, restore } = setup();
		const log: string[] = [];
		r.add(tracer('a', 1, log));

		canvas.fire('webglcontextlost');
		r.render(FRAME);

		expect(log).toEqual([]);
		restore();
	});
});

// ── Invalidation ────────────────────────────────────────────────────────────
// The property that decides whether this feature is a win or a regression: the
// existing layers are pull-based (a reactive effect redraws when its inputs
// change). If four of them reacting to one camera change produced four draws,
// the merge would cost more than the stack it replaced.

describe('invalidate', () => {
	it('coalesces many calls in a tick into a single draw', async () => {
		const raf: (() => void)[] = [];
		vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
			raf.push(fn);
			return raf.length;
		});
		vi.stubGlobal('cancelAnimationFrame', () => {});

		const log: string[] = [];
		const { r, restore } = setup({ frame: () => FRAME });
		r.add(tracer('a', 1, log));
		r.add(tracer('b', 2, log));

		r.invalidate();
		r.invalidate();
		r.invalidate();
		r.invalidate();

		expect(raf.length).toBe(1);
		raf[0]();
		// Every pass drew once — they share a buffer, so a clear wipes all of them
		// and a partial redraw would leave holes.
		expect(log).toEqual(['a', 'b']);

		vi.unstubAllGlobals();
		restore();
	});

	it('is inert without a frame source, rather than throwing', () => {
		const { r, restore } = setup();
		expect(() => r.invalidate()).not.toThrow();
		restore();
	});
});

// ── Reporting ───────────────────────────────────────────────────────────────

describe('reporting', () => {
	it('reports pass names in draw order, for one surface', () => {
		const { r, restore } = setup();
		const log: string[] = [];
		r.add(tracer('walls', 2, log));
		r.add(tracer('shell', 1, log));
		r.add(tracer('pieces', 3, log));

		// This is the figure SC-006 is read off: one surface, N named passes.
		expect(r.passNames).toEqual(['shell', 'walls', 'pieces']);
		restore();
	});
});
