// ── gl/renderer — one context, N ordered passes ─────────────────────────────
// `context.ts` owns *a* context. This owns *the* context plus the ordered list
// of things drawn into it, which is the difference between a scene that costs
// the browser one composited surface and one that costs it five.
//
// Why this exists at all: every layer used to call `createGlContext` for itself.
// Browsers cap live contexts per page (~16) and silently discard the oldest past
// that, which `GlobePieces` already carried a comment anticipating. Five layers
// also means five transparent surfaces the compositor blends every frame, five
// MSAA resolves, and five drawing buffers.
//
// What makes the merge tractable here — and it is not generally tractable — is
// that the scene already has no depth buffer. `context.ts` asks for
// `depth: false` on purpose: the globe is meant to be see-through, so a depth
// test would reject exactly the far fragments the look depends on. Draw ORDER is
// the depth cue, and manual ordering was therefore already the design rather
// than something this file introduces.
//
// The thing that nearly broke it: blend mode was a per-CONTEXT attribute. One
// context cannot be both premultiplied and straight, so blend becomes per-pass
// state set immediately before each draw — and `GlobePieces` varies it *within*
// a frame, so a pass can also change it mid-draw through a deliberately narrow
// capability. See `BlendMode`.
import { createGlContext, type GlContext } from './context.js';

/** Blend state, named by the blend FUNCTION rather than by the context attribute
 *  that used to imply it.
 *
 *  Read `GlobeShell.svelte`'s own note before changing any mapping here: with
 *  straight alpha the compositor multiplies a second time and the graticule, at
 *  0.03 alpha, disappears. That is a real regression this project has already
 *  shipped once and caught by pixel diff (mean 3.95 against 0.48). */
export type BlendMode =
	/** `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` — GlobePieces' default group. */
	| 'over'
	/** `ONE, ONE_MINUS_SRC_ALPHA` — GlobeShell, TerritoryWalls, StripsGl: layers
	 *  whose shaders already output RGB multiplied by their own alpha. */
	| 'over-premultiplied'
	/** `SRC_ALPHA, ONE` — additive particle and spark groups. */
	| 'add'
	/** `ONE, ONE_MINUS_SRC_COLOR`. Exactly `src + dst − src·dst`, which is the
	 *  same arithmetic as the CSS blend mode rather than an approximation of it —
	 *  the hologram look depends on it. */
	| 'screen';

/** The single clock. Every pass is a pure function of this, which is what lets
 *  the scene be seeked to any moment instead of played into position. */
export interface FrameContext {
	readonly t: number;
	readonly dt: number;
	readonly cssWidth: number;
	readonly cssHeight: number;
	/** Effective density AFTER the clamp. Size line widths against this, never
	 *  against `devicePixelRatio`, or the clamp is defeated one line at a time. */
	readonly dpr: number;
}

/** The narrow capability a pass gets during `draw`. Deliberately not the whole
 *  renderer: a pass that can reach `add()` or `resize()` mid-frame is a pass that
 *  can corrupt the frame it is in the middle of drawing. */
export interface BlendSink {
	setBlend(mode: BlendMode): void;
}

export interface RenderPass {
	/** Stable identity, reported to `gl-health` and usable as a hitch tag. */
	readonly name: string;
	/** Position in the draw order. Order IS the depth cue — see the header. */
	readonly order: number;
	/** Set by the renderer before `draw`. A pass needing more than one mode in a
	 *  frame switches through `BlendSink`. */
	readonly blend: BlendMode;
	enabled: boolean;

	/** Build GPU objects. Called on registration AND again after every restore,
	 *  so it must be safe to call repeatedly and must not accumulate. */
	init(gl: WebGL2RenderingContext): void;

	/** Draw one frame. Must not request an animation frame, read a clock, hold
	 *  reactive state, or retain `gl` — everything it needs is in `frame`. */
	draw(gl: WebGL2RenderingContext, frame: FrameContext, r: BlendSink): void;

	dispose(): void;
}

export interface SharedRendererOpts {
	/** Supplies the frame for an `invalidate()`-driven redraw.
	 *
	 *  Required for pull-based scenes, which is what every existing layer is: they
	 *  redraw from a reactive effect when their inputs change, NOT from a loop. A
	 *  merged renderer without this would have to run a permanent rAF to stay
	 *  correct, turning five on-demand layers into one always-drawing one — more
	 *  work than the stack it replaced. */
	frame?: () => FrameContext;
	/** Pixel-density ceiling. The whole point: a full-container GL layer that
	 *  follows `devicePixelRatio` unclamped draws 4× the pixels on a Retina
	 *  display, and fill-rate is invisible to every main-thread profiler. */
	dprCeiling?: number;
	antialias?: boolean;
	onLost?: () => void;
	onRestore?: () => void;
	/** Restoration is requested, never promised. This fires when the caller
	 *  should swap to its non-GL fallback ELEMENT — a canvas that has held a
	 *  `webgl2` context answers null to `2d` for the rest of its life. */
	onFallback?: () => void;
}

export interface SharedRenderer extends BlendSink {
	/** Registration order is irrelevant; `pass.order` decides draw order. Returns
	 *  an unregister function, the shape a Svelte effect cleanup already wants. */
	add(pass: RenderPass): () => void;
	/** Draw every enabled pass in ascending `order`. The HOST owns the animation
	 *  loop — this is called from it, never the other way round, which is what
	 *  keeps one clock for the whole scene. */
	render(frame: FrameContext): void;
	/** Mark the scene dirty. Coalesces any number of calls in one tick into a
	 *  single draw on the next animation frame.
	 *
	 *  ALL passes redraw, not just the one that invalidated: the passes share a
	 *  drawing buffer, and the clear that starts a frame wipes every one of them.
	 *  That is still far cheaper than the surface-per-layer it replaces, but it
	 *  means a pass invalidating per frame costs the whole scene — which is why
	 *  `enabled` exists. */
	invalidate(): void;
	resize(): void;
	readonly cssWidth: number;
	readonly cssHeight: number;
	readonly lost: boolean;
	readonly passNames: readonly string[];
	/** Effective density after the clamp — what a host puts in `FrameContext`. */
	readonly dpr: number;
	dispose(): void;
}

/** How long the driver gets to hand a context back before the caller should give
 *  up and show its fallback. Matches `GlobeShell`'s existing grace. */
const LOST_GRACE_MS = 3000;

const DEFAULT_DPR_CEILING = 1.5;

function applyBlend(gl: WebGL2RenderingContext, mode: BlendMode): void {
	switch (mode) {
		case 'add':
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
			break;
		case 'screen':
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
			break;
		case 'over-premultiplied':
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			break;
		default:
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	}
}

/** Null — not a throw — when WebGL2 is unavailable, blocklisted, or the page's
 *  context budget is exhausted. "No WebGL" is a supported outcome with a
 *  documented fallback, and mirrors `createGlContext`. */
export function createSharedRenderer(
	canvas: HTMLCanvasElement,
	opts: SharedRendererOpts = {},
): SharedRenderer | null {
	const ceiling = opts.dprCeiling ?? DEFAULT_DPR_CEILING;
	const passes: RenderPass[] = [];
	let lostTimer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	let pending = 0;
	// Declared before the context so the lifecycle callbacks below can reach it;
	// they only ever fire after construction has returned.
	let renderer: SharedRenderer | null = null;

	/** Handed to each pass during `draw`. A standalone object rather than the
	 *  renderer itself, so a pass mid-draw cannot reach `add`, `resize` or
	 *  `dispose` — the three things that would corrupt the frame it is inside. */
	const sink: BlendSink = {
		setBlend(mode) {
			if (glc && !glc.lost) applyBlend(glc.gl, mode);
		},
	};

	const glc: GlContext | null = createGlContext(canvas, {
		antialias: opts.antialias ?? true,
		// Every pass here composites "over" what is under it, so the shaders output
		// premultiplied RGB and the context must agree. Passes that want straight
		// alpha get it through their `blend` mode, not through a second context.
		premultipliedAlpha: true,
		onResize: () => {
			resize();
			// A resize reallocates and CLEARS the drawing buffer, so a pull-based
			// scene that only redraws on data change would sit blank until something
			// else happened to move.
			renderer?.invalidate();
		},
		onLost: () => {
			opts.onLost?.();
			// Restoration is requested, never promised — start the clock on the
			// caller's fallback rather than leaving a blank rectangle forever.
			clearTimeout(lostTimer);
			lostTimer = setTimeout(() => {
				if (!disposed && glc?.lost) opts.onFallback?.();
			}, LOST_GRACE_MS);
		},
		onRestore: () => {
			clearTimeout(lostTimer);
			if (!glc) return;
			// EVERY pass, not a subset. Before the merge a single layer could be lost
			// alone; now one loss takes all of them, so a partial rebuild shows up as
			// a scene missing a layer rather than as a blank canvas — which is much
			// harder to notice and is exactly the failure Story 4 guards.
			for (const p of passes) p.init(glc.gl);
			opts.onRestore?.();
		},
	});
	if (!glc) return null;

	function effectiveDpr(): number {
		return Math.min(globalThis.devicePixelRatio || 1, ceiling);
	}

	function resize(): void {
		glc?.resize(effectiveDpr());
	}

	resize();

	renderer = {
		add(pass) {
			if (glc && !glc.lost) pass.init(glc.gl);
			passes.push(pass);
			// Sorted on insert, not per frame: the list changes when a scene mounts
			// and is read sixty times a second.
			passes.sort((a, b) => a.order - b.order);
			return () => {
				const i = passes.indexOf(pass);
				if (i < 0) return;
				passes.splice(i, 1);
				pass.dispose();
			};
		},

		setBlend(mode) {
			if (glc && !glc.lost) applyBlend(glc.gl, mode);
		},

		render(frame) {
			if (!glc || glc.lost) return;
			const gl = glc.gl;
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.enable(gl.BLEND);
			for (const pass of passes) {
				if (!pass.enabled) continue;
				// Reset per pass rather than trusting the previous one to leave it
				// tidy: `GlobePieces` legitimately ends its draw in `screen`, and
				// inheriting that would tint whatever draws next.
				applyBlend(gl, pass.blend);
				pass.draw(gl, frame, sink);
			}
		},

		invalidate() {
			// One draw per tick however many passes ask. Without the guard a scene
			// where four layers react to the same camera change draws four times for
			// one visual change — the exact multiplication this feature removes.
			if (pending || disposed || !opts.frame) return;
			pending = requestAnimationFrame(() => {
				pending = 0;
				if (disposed) return;
				renderer?.render(opts.frame!());
			});
		},

		resize,

		get cssWidth() {
			return glc?.cssWidth ?? 0;
		},
		get cssHeight() {
			return glc?.cssHeight ?? 0;
		},
		get lost() {
			return glc?.lost ?? true;
		},
		get passNames() {
			return passes.map((p) => p.name);
		},
		get dpr() {
			return effectiveDpr();
		},

		dispose() {
			disposed = true;
			if (pending) cancelAnimationFrame(pending);
			pending = 0;
			clearTimeout(lostTimer);
			for (const p of passes) p.dispose();
			passes.length = 0;
			glc?.dispose();
		},
	};

	return renderer;
}
