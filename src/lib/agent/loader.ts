// ── Loading the agent module ─────────────────────────────────────────────────
// Get the WebAssembly Agent Line client running, once per page, and hand back the
// namespace it publishes. Nothing here knows what will be spoken over it — the
// capabilities and the subscriptions are next door in registry.ts.

import type { ArmornetAgent } from './types.js';

// Both are served from the ROOT of whichever app is hosting this: a standalone
// Vite app serves its own public/ there, and in the binary they come out of
// app-ui's static/ — which is why the wasm build target writes them to both
// places. Root-relative rather than base-relative on purpose: the showcase is
// mounted at /showcase, but these files are not part of that bundle.
const WASM_URL = '/armornet.wasm';
const EXEC_URL = '/wasm_exec.js';

/** Named neither for a build target nor for a consumer. This loader is shared,
 *  and the target that produces the module has already been renamed once —
 *  pointing a live-assessment developer at the game's Makefile rule, or at a
 *  rule that no longer exists, is worse than pointing them at nothing. */
const FIX = 'the browser agent module is not in this build';

/** A missing module does not 404. The SPA fallback answers any unknown path
 *  with index.html and a 200, so an absent build arrives as HTML — which a
 *  <script> tag loads "successfully" and which defines nothing, surfacing later
 *  as `Go is not a constructor`. Ask what actually came back, and name it. */
async function mustBeBuilt(url: string, expect: RegExp): Promise<void> {
	const r = await fetch(url);
	if (!r.ok) throw new Error(`${url} — HTTP ${r.status}, ${FIX}`);
	const type = (r.headers.get('content-type') ?? '').split(';')[0].trim();
	if (!expect.test(type)) throw new Error(`${url} — served ${type || 'nothing'}, ${FIX}`);
}

/** The `Go` constructor a given wasm_exec.js defined, remembered per URL.
 *
 *  There is more than one of these now, and they are NOT interchangeable: a
 *  module built by TinyGo needs TinyGo's shim and a module built by stock Go
 *  needs Go's, and both scripts define the same global name. So each one's
 *  constructor is captured the moment its script runs and the global is put
 *  back, rather than letting whichever loaded last win — which would hand one
 *  module the other's runtime and fail deep inside `instantiate` with nothing
 *  saying why. */
const execs = new Map<string, GoConstructor>();

/** Spelled out rather than reusing the ambient `Go`, which is declared as a
 *  value and so cannot be used as a type. */
interface GoRuntime {
	importObject: WebAssembly.Imports;
	run(i: WebAssembly.Instance): void;
}
type GoConstructor = new () => GoRuntime;

/** wasm_exec.js is a classic script defining a global `Go`, not a module, so it
 *  cannot simply be imported. */
async function loadExec(execUrl: string): Promise<GoConstructor> {
	const already = execs.get(execUrl);
	if (already) return already;

	await mustBeBuilt(execUrl, /javascript|ecmascript/i);

	const globals = globalThis as unknown as Record<string, unknown>;
	const before = globals.Go;

	await new Promise<void>((resolve, reject) => {
		const s = document.createElement('script');
		s.src = execUrl;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error(`${execUrl} did not load`));
		document.head.appendChild(s);
	});

	const defined = globals.Go as GoConstructor | undefined;
	if (!defined) throw new Error(`${execUrl} ran but defined no global Go`);

	// Put back whatever was there. Restoring `undefined` by deleting rather than
	// assigning: a page that never loaded a shim should end up with no `Go` at
	// all, not with one that exists and is undefined.
	if (before === undefined) delete globals.Go;
	else globals.Go = before;

	execs.set(execUrl, defined);
	return defined;
}

/** Memoised per URL rather than per module: there is more than one Go module in
 *  this tree now — the transport and, on the game route, the rules engine — and
 *  a single flag would have let the second load clobber the first's namespace. */
const loading = new Map<string, Promise<unknown>>();

/**
 * Loads a Go WebAssembly module, once per URL, and hands back the global it
 * published.
 *
 * Idempotent by memoised promise rather than a boolean: two components mounting
 * in the same tick would both see "not loaded yet" and instantiate the module
 * twice, and the second `go.run` would publish over the first's namespace while
 * the first kept a handle to a runtime nobody was driving.
 */
export function loadWasmModule<T>(
	wasmUrl: string,
	globalName: string,
	execUrl: string = EXEC_URL
): Promise<T> {
	const cached = loading.get(wasmUrl);
	if (cached) return cached as Promise<T>;

	const started = (async () => {
		// Always loaded here, never taken from the page. A standalone app has a
		// script tag for one of these in its index.html, and trusting that global
		// was safe only while there was a single shim — now it would silently
		// pair a module with the wrong runtime.
		const GoCtor = await loadExec(execUrl);

		const go = new GoCtor();
		await mustBeBuilt(wasmUrl, /^application\/wasm$/i);
		const res = await WebAssembly.instantiateStreaming(fetch(wasmUrl), go.importObject);

		// Deliberately NOT awaited. The module's main parks forever on purpose:
		// returning from it would tear down the Go runtime under the callbacks
		// this page is about to hold. `run` resolves only at exit, which is a
		// thing that must not happen.
		void go.run(res.instance);

		const published = (window as unknown as Record<string, unknown>)[globalName];
		if (!published) {
			throw new Error(`${wasmUrl} ran but published no ${globalName} namespace`);
		}
		return published as T;
	})();

	loading.set(wasmUrl, started);

	// A failed load must not be cached as a permanent failure — a page that lost
	// the network on first paint should be able to try again.
	started.catch(() => {
		loading.delete(wasmUrl);
	});

	return started;
}

/** The transport. Named rather than inlined at every call site because the URL
 *  and the global are a matched pair, and a caller that gets one right and the
 *  other wrong fails at runtime with a message about the wrong thing. */
export function loadAgent(): Promise<ArmornetAgent> {
	return loadWasmModule<ArmornetAgent>(WASM_URL, 'armornet');
}
