// ── perf/probe — the measurement core, injected rather than compiled in ──────
//
// This file is `page.addInitScript`-ed into a page from ANY build. That is its
// whole reason to exist.
//
// The project's headline metric used to be read out of `globalThis.__hitch`,
// which exists only because `src/lib/perf/hitch-watch.ts` was compiled into the
// bundle. That file is not on `main`, so it is not in the stage image, so the
// one number every performance decision was justified by could not be taken
// against the build users were actually looking at. An instrument you have to
// ship in advance can only ever measure builds you already thought to measure.
//
// Everything here is therefore self-contained: no imports, no app knowledge, no
// assumption that the page has heard of it. It runs against a container pulled
// from a registry, a static bundle in a temp directory, or a dev server.
//
// It does NOT replace `hitch-watch`. That file's `beat()` tags are a loop naming
// itself, which is cooperation no injected script can fake, and it is what told
// us `globe-draw` and `spin` were the loops running. When the page has its own
// watch, both run — and a disagreement between them is information, not a bug.
//
// Serialised as a string and eval'd by the runner, so it must stay a single
// function expression with no module syntax.

/**
 * Returns the source of the page-side agent. `install(opts)` is called inside
 * the page before any app code runs.
 *
 * @returns {string} an IIFE, ready for `addInitScript`
 */
export function probeSource(opts = {}) {
	const cfg = {
		// The frame budget a frame is "late" against. 8.3 is a 120Hz display;
		// pass 16.7 for 60Hz. Stated rather than inferred: a display that changes
		// its own refresh rate mid-capture would otherwise silently move the bar.
		budgetMs: opts.budgetMs ?? 8.3,
		// GL counting costs a function call per GL call. Off unless asked.
		gl: opts.gl ?? false,
		// Attribute-write counting costs a MutationObserver over the document.
		dom: opts.dom ?? false,
		// Forced-layout counting wraps `getBoundingClientRect` on every Element.
		//
		// This was on by default and it LIED. A one-shot task doing a batch of
		// layout reads measured 213ms with the wrapper and 60ms without it — the
		// instrument reported 3.5x the cost of the thing it was measuring, and
		// `frame max` in the comparison table inherited the error. A per-call
		// wrapper is affordable spread across a frame and is not affordable
		// inside a burst, which is exactly where it gets read.
		//
		// Diagnostic only. Never leave it on for a run whose frame numbers matter.
		rect: opts.rect ?? false
	};

	return `(() => {
	const CFG = ${JSON.stringify(cfg)};

	// ── frames ───────────────────────────────────────────────────────────────
	// A histogram, not a mean. The mean of a stutter is a shrug: a scene at a
	// steady 58fps and a scene alternating 120/30 have the same average and only
	// one of them is broken.
	let frames = 0, late = 0, last = 0, started = 0;
	let worstDt = 0, worstAt = 0;
	const dts = [];

	const onFrame = (t) => {
		if (last) {
			const dt = t - last;
			dts.push(dt);
			frames++;
			if (dt > CFG.budgetMs * 1.5) late++;
			// Kept so the worst frame can be placed on the same timeline as the
			// longtasks. "There was a 600ms frame" is a complaint; "there was a
			// 600ms frame at t+12.4s and no longtask near it" is a diagnosis.
			if (dt > worstDt) { worstDt = dt; worstAt = t; }
		} else {
			started = t;
		}
		last = t;
		requestAnimationFrame(onFrame);
	};
	requestAnimationFrame(onFrame);

	// ── GL calls ─────────────────────────────────────────────────────────────
	// Patched on the PROTOTYPE before any context exists. A context created
	// before the patch lands is a context this never sees, which is why the
	// runner injects rather than evaluates.
	const glCounts = Object.create(null);
	if (CFG.gl && typeof WebGL2RenderingContext !== 'undefined') {
		const proto = WebGL2RenderingContext.prototype;
		for (const name of Object.getOwnPropertyNames(proto)) {
			const desc = Object.getOwnPropertyDescriptor(proto, name);
			if (!desc || typeof desc.value !== 'function') continue;
			const fn = desc.value;
			Object.defineProperty(proto, name, {
				...desc,
				value: function (...args) {
					glCounts[name] = (glCounts[name] ?? 0) + 1;
					return fn.apply(this, args);
				}
			});
		}
	}

	// ── DOM writes ───────────────────────────────────────────────────────────
	const domCounts = Object.create(null);
	let domObserver = null;
	const startDom = () => {
		if (!CFG.dom || domObserver) return;
		domObserver = new MutationObserver((records) => {
			for (const r of records) {
				if (r.type !== 'attributes') continue;
				const el = r.target;
				const tag = (el.tagName || '?').toLowerCase();
				const cls = (el.classList && el.classList[0]) ? '.' + el.classList[0] : '';
				const key = tag + cls + '[' + r.attributeName + ']';
				domCounts[key] = (domCounts[key] ?? 0) + 1;
			}
		});
		domObserver.observe(document.documentElement, {
			subtree: true, attributes: true, childList: true
		});
	};

	// ── long tasks ───────────────────────────────────────────────────────────
	// The frame histogram says a frame took 600ms. It cannot say whether the main
	// thread was BUSY for 600ms or merely never asked to draw — a stall and a
	// pause look identical from inside rAF, and they have opposite fixes. A
	// longtask overlapping the worst frame means our JS; none means the collector,
	// the compositor or the driver.
	const longtasks = [];
	try {
		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) {
				longtasks.push({ at: +e.startTime.toFixed(0), ms: +e.duration.toFixed(1) });
			}
		}).observe({ entryTypes: ['longtask'] });
	} catch { /* not every engine ships it; absence is not an error */ }

	// ── forced layout ────────────────────────────────────────────────────────
	// Counted because it is the cheapest signal for a class of bug the frame
	// histogram only shows the shadow of. It is a COUNT and not a cost: the
	// first read after a DOM mutation pays the whole layout and the rest are
	// nearly free, so halving this number does not halve anything. It is here to
	// point at a caller, not to be optimised against.
	let rectCalls = 0;
	if (CFG.rect) {
		const orig = Element.prototype.getBoundingClientRect;
		Element.prototype.getBoundingClientRect = function () {
			rectCalls++;
			return orig.call(this);
		};
	}

	const pct = (sorted, p) => sorted.length
		? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
		: 0;

	globalThis.__perfProbe = {
		startDom,
		reset() {
			frames = 0; late = 0; dts.length = 0; rectCalls = 0; started = last;
			worstDt = 0; worstAt = 0; longtasks.length = 0;
			for (const k of Object.keys(glCounts)) delete glCounts[k];
			for (const k of Object.keys(domCounts)) delete domCounts[k];
		},
		read() {
			const sorted = [...dts].sort((a, b) => a - b);
			const secs = Math.max((last - started) / 1000, 1e-6);
			const glTotal = Object.values(glCounts).reduce((a, b) => a + b, 0);
			const domTotal = Object.values(domCounts).reduce((a, b) => a + b, 0);
			return {
				seconds: +secs.toFixed(2),
				frames,
				fps: +(frames / secs).toFixed(1),
				budgetMs: CFG.budgetMs,
				lateFrames: late,
				latePerSec: +(late / secs).toFixed(2),
				frameMs: {
					p50: +pct(sorted, 0.5).toFixed(2),
					p95: +pct(sorted, 0.95).toFixed(2),
					p99: +pct(sorted, 0.99).toFixed(2),
					max: +(sorted[sorted.length - 1] ?? 0).toFixed(2)
				},
				rectCallsPerFrame: CFG.rect ? +(rectCalls / Math.max(frames, 1)).toFixed(1) : null,
				worstFrame: {
					ms: +worstDt.toFixed(1),
					// Relative for reading; the correlation below stays ABSOLUTE.
					// rAF timestamps, performance.now() and a longtask's startTime are
					// all the same clock, and mixing a relative frame time with an
					// absolute task time silently never matches — it reported "no
					// longtask" over a 260ms task sitting directly under the frame.
					atSec: +((worstAt - started) / 1000).toFixed(1),
					// A longtask overlapping the worst frame's own window
					// [worstAt - worstDt, worstAt]. Null means the main thread was idle
					// through it and the cost was the collector, compositor or driver.
					longtask: longtasks.find(
						(l) => l.at <= worstAt + 50 && l.at + l.ms >= worstAt - worstDt - 50
					) ?? null
				},
				longtasks: {
					count: longtasks.length,
					totalMs: +longtasks.reduce((a, l) => a + l.ms, 0).toFixed(1),
					top: [...longtasks].sort((a, b) => b.ms - a.ms).slice(0, 3)
				},
				glCallsPerFrame: CFG.gl ? +(glTotal / Math.max(frames, 1)).toFixed(1) : null,
				glTop: CFG.gl ? topN(glCounts, frames, 8) : null,
				domWritesPerSec: CFG.dom ? +(domTotal / secs).toFixed(1) : null,
				domTop: CFG.dom ? topN(domCounts, secs, 8) : null,
				// Reported, never required. Its presence tells you the build was
				// instrumented; its absence is the normal case for an old image.
				hasAppWatch: typeof globalThis.__hitch !== 'undefined'
			};
		},
		// A build-independent census. Ratio ≈ the density ceiling means a GL
		// surface; ratio 1 means a 2D one. Do NOT probe with getContext('2d') to
		// tell them apart — it permanently types a canvas that had not chosen.
		canvases() {
			return [...document.querySelectorAll('canvas')].map((c) => ({
				cls: c.className || '(none)',
				css: [c.clientWidth, c.clientHeight],
				buffer: [c.width, c.height],
				ratio: c.clientWidth ? +(c.width / c.clientWidth).toFixed(2) : null
			}));
		}
	};

	function topN(counts, divisor, n) {
		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, n)
			.map(([k, v]) => [k, +(v / Math.max(divisor, 1)).toFixed(1)]);
	}
})();`;
}
