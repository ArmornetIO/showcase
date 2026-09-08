// ── mesh-studio/gl/gl-health — what the GPU layer actually did ───────────────
// A WebGL layer has one failure mode that no amount of correct code defends
// against: everything succeeds — context, programs, uniforms, draws, no error
// from `getError` — and the canvas still shows nothing. It reproduces on
// somebody else's machine, on one OS, sometimes, and the only thing anyone can
// report back is "the globe is missing".
//
// This is the instrument for that. It records what the browser actually GRANTED
// (which is not what was asked for — `desynchronized` in particular is a
// request the implementation may decline, and honouring it puts the canvas on a
// different presentation path per platform), counts frames, and takes a
// transition-triggered console line when the picture starts or stops existing.
//
// Two rules keep it usable in production:
//   • It logs TRANSITIONS, never frames. A per-frame log at 60fps is not
//     telemetry, it is a denial of service on the console.
//   • The full record is left on `globalThis.__glHealth` for a reporter to
//     paste back. That paste is the whole point — it is the difference between
//     "blank on Windows" and a driver string with a granted-attributes list.
//
// No DOM, no Svelte, no WebGL calls: the caller owns the context and hands in
// what it observed.

/** One state change worth a line. */
export interface GlHealthEvent {
	kind: 'init' | 'lost' | 'restored' | 'blank' | 'painted' | 'fallback';
	/** Milliseconds since the context was created. */
	at: number;
	/** Frames drawn when it happened — a blank at frame 1 is a different bug
	 *  from a blank at frame 4,000. */
	frame: number;
	detail?: string;
}

export interface GlHealthRecord {
	layer: string;
	/** What the implementation GRANTED, not what was requested. */
	attrs: Record<string, unknown> | null;
	/** Where the two disagree — the interesting half of `attrs`. */
	declined: string[];
	renderer: string;
	dpr: number;
	/** css `[w, h]` then drawing-buffer `[w, h]`, as of the last frame. */
	css: [number, number];
	buffer: [number, number];
	frames: number;
	/** Frames whose centre pixel read back empty. Zero on a healthy layer. */
	blankFrames: number;
	lostCount: number;
	blank: boolean;
	events: GlHealthEvent[];
}

export interface GlHealth {
	/** Count a drawn frame and keep the size current. Cheap: no allocation. */
	frame(css: [number, number], buffer: [number, number]): void;
	/**
	 * Report a centre-pixel read. `painted` false means the driver composited
	 * nothing where a solid sphere was drawn.
	 *
	 * Only the EDGES are logged — first blank, and the recovery after one — so a
	 * layer that is broken for a thousand frames costs one console line.
	 */
	probe(painted: boolean, detail?: string): void;
	mark(kind: GlHealthEvent['kind'], detail?: string): void;
	snapshot(): GlHealthRecord;
}

/** Kept short: this is a debugging aid a user pastes back, not a log sink. */
const MAX_EVENTS = 24;

/** Attributes worth diffing. `depth`/`stencil` are omitted deliberately — the
 *  mesh layers turn them off and nothing has ever been surprised by it. */
const WATCHED = ['desynchronized', 'antialias', 'premultipliedAlpha', 'alpha'] as const;

export function createGlHealth(
	layer: string,
	requested: Record<string, unknown>,
	granted: Record<string, unknown> | null,
	renderer: string,
	dpr = globalThis.devicePixelRatio || 1,
): GlHealth {
	const t0 = now();
	const declined = WATCHED.filter(
		(k) => k in requested && granted != null && granted[k] !== requested[k],
	).map((k) => `${k}: asked ${String(requested[k])}, got ${String(granted?.[k])}`);

	const rec: GlHealthRecord = {
		layer,
		attrs: granted,
		declined,
		renderer,
		dpr,
		css: [0, 0],
		buffer: [0, 0],
		frames: 0,
		blankFrames: 0,
		lostCount: 0,
		blank: false,
		events: [],
	};

	const health: GlHealth = {
		frame(css, buffer) {
			rec.frames++;
			rec.css = css;
			rec.buffer = buffer;
		},
		probe(painted, detail) {
			if (!painted) rec.blankFrames++;
			// Edge-triggered. The steady state is not news; the moment it flips is.
			if (!painted && !rec.blank) {
				rec.blank = true;
				push('blank', detail);
			} else if (painted && rec.blank) {
				rec.blank = false;
				push('painted', detail);
			}
		},
		mark(kind, detail) {
			if (kind === 'lost') rec.lostCount++;
			push(kind, detail);
		},
		snapshot: () => rec,
	};

	function push(kind: GlHealthEvent['kind'], detail?: string) {
		const at = Math.round(now() - t0);
		rec.events.push({ kind, at, frame: rec.frames, detail });
		if (rec.events.length > MAX_EVENTS) rec.events.shift();
		register(rec);
		report(kind, rec, detail);
	}

	push('init', declined.length ? `declined ${declined.join('; ')}` : undefined);
	return health;
}

function now(): number {
	return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * One line per transition, at the level its severity earns.
 *
 * `init` goes to `debug` — Chrome hides Verbose by default, so a healthy page
 * stays silent while the record is still one filter-click away. Everything else
 * is a `warn`: by definition the picture just changed state, and the person who
 * needs to see it is looking at a console they did not open on purpose.
 */
function report(kind: GlHealthEvent['kind'], rec: GlHealthRecord, detail?: string) {
	const head = `[gl:${rec.layer}] ${kind}`;
	const where = `frame ${rec.frames} · css ${rec.css[0]}×${rec.css[1]} · buffer ${rec.buffer[0]}×${rec.buffer[1]} · dpr ${rec.dpr}`;
	const line = detail ? `${head} — ${detail} · ${where}` : `${head} · ${where}`;
	if (kind === 'init') console.debug(line, rec.renderer, rec.attrs);
	else console.warn(line, rec.renderer, '· paste __glHealth for the full record');
}

/** Every record made this page, by layer, for a reporter to paste back.
 *
 *  Keyed rather than pushed so a studio that mounts and unmounts globes all
 *  afternoon does not grow an unbounded array of dead contexts. */
function register(rec: GlHealthRecord) {
	const g = globalThis as Record<string, unknown>;
	const all = (g.__glHealth as Record<string, GlHealthRecord[]>) ?? {};
	const list = all[rec.layer] ?? [];
	if (!list.includes(rec)) list.push(rec);
	// Only the last few instances of a layer are ever interesting.
	all[rec.layer] = list.slice(-4);
	g.__glHealth = all;
}

/**
 * The driver behind the context, unmasked where the browser still allows it.
 *
 * `RENDERER` alone has been the string "WebKit WebGL" for a decade; the useful
 * one is behind `WEBGL_debug_renderer_info`, which is privacy-gated and simply
 * absent in some builds. Both are tried, neither is required, and a failure
 * here must never be the thing that breaks a render — hence the catch.
 */
export function glRenderer(gl: WebGL2RenderingContext): string {
	try {
		const ext = gl.getExtension('WEBGL_debug_renderer_info');
		const unmasked = ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
		return String(unmasked || gl.getParameter(gl.RENDERER) || 'unknown');
	} catch {
		return 'unknown';
	}
}
