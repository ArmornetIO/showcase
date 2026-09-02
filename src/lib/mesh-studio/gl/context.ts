// ── mesh-studio/gl/context — WebGL2 plumbing ─────────────────────────────────
// Context, programs, buffers, VAOs. Nothing above that: this file has never
// heard of a globe, a node or a shader that draws one. That is deliberate — the
// geometry and the shaders are being written alongside it, and anything here
// that knew about them would have to change every time they did.
//
// The one thing it DOES take a position on is failure. A GPU context is lost
// whenever the driver feels like it (tab backgrounded, another app takes the
// GPU, a laptop switching graphics), and every WebGL call after that silently
// becomes a no-op returning `null`. Code that assumes otherwise doesn't crash —
// it dereferences a null program, throws inside a rAF callback, and takes the
// page down. So loss is a first-class state here, not an edge case: `lost` is
// the flag a render loop checks before it does anything at all.
//
// No module-level state. Several globes on one page each get their own context,
// and nothing here is shared between them.

export interface GlContext {
	gl: WebGL2RenderingContext;
	canvas: HTMLCanvasElement;
	/** Resize the drawing buffer to the element's CSS size × dpr, and set the
	 *  viewport. Returns true if the size actually changed. Cheap to call every
	 *  frame. */
	resize(dpr?: number): boolean;
	/** CSS pixel size — what a caller converts world coords against. */
	readonly cssWidth: number;
	readonly cssHeight: number;
	/** True once the context is lost; every draw becomes a no-op. */
	readonly lost: boolean;
	dispose(): void;
}

export interface GlContextOpts {
	alpha?: boolean;
	antialias?: boolean;
	/** Whether the shader writes RGB already multiplied by its own alpha.
	 *
	 *  Defaults false, which is what the additive and `screen` passes are written
	 *  against — see the attribute below. A layer that ACCUMULATES ordered
	 *  translucent geometry into a transparent framebuffer wants the opposite:
	 *  with straight alpha the compositor multiplies a second time, so a pass at
	 *  alpha `a` lands at roughly `a²` and anything faint disappears entirely.
	 *  Per-context rather than global because each layer owns its own canvas and
	 *  they genuinely disagree. */
	premultipliedAlpha?: boolean;
	/** Called after the driver hands the context back. EVERY GL object made
	 *  before the loss is dead by then — programs, buffers, VAOs, textures — so
	 *  this is a rebuild-from-scratch signal, not a resume. */
	onRestore?: () => void;
}

/** Create a WebGL2 context on `canvas`, or null when WebGL2 is unavailable —
 *  old hardware, a blocklisted driver, or too many live contexts on the page.
 *  Null rather than a throw because the caller has an SVG path to fall back to,
 *  and "no WebGL" is a supported outcome rather than a bug. */
export function createGlContext(
	canvas: HTMLCanvasElement,
	opts: GlContextOpts = {},
): GlContext | null {
	const gl = canvas.getContext('webgl2', {
		// The globe composites over the page behind it, so the canvas must be
		// see-through where nothing was drawn.
		alpha: opts.alpha ?? true,
		// Blending is done by the shaders in straight (un-premultiplied) alpha,
		// which is what the additive passes are written against. Leaving this true
		// would have the compositor multiply a second time and halo every edge.
		// Overridable because the wall layer accumulates ordered translucent quads
		// and needs exactly the opposite — see `GlContextOpts.premultipliedAlpha`.
		premultipliedAlpha: opts.premultipliedAlpha ?? false,
		// Lines and thin geometry are most of this scene; without MSAA the mesh
		// links crawl. Cheap enough at these vertex counts to be worth it.
		antialias: opts.antialias ?? true,
		// DELIBERATE, and the one attribute worth arguing about. The scene is
		// order-independent: additive and alpha passes layered over each other, and
		// you are meant to SEE THROUGH the globe to the far side. A depth buffer
		// would reject those far fragments — the thing it exists to do — turning a
		// translucent sphere into an opaque ball. Draw order is the depth cue here
		// (see physics/sphere's `depth`), so the buffer is pure cost: memory,
		// bandwidth, and a clear every frame.
		depth: false,
		// The globe is decoration, not an input surface — nothing waits on a frame
		// to answer a click. Letting the driver skip the compositor handshake trims
		// latency, and browsers that don't support it ignore the key.
		desynchronized: true,
		// Not set, and worth knowing why: `preserveDrawingBuffer` defaults to false,
		// so the buffer is invalid after a composite. A caller wanting a screenshot
		// must read pixels inside the frame that drew them.
	});
	if (!gl) return null;

	let lost = false;
	let cssWidth = 0;
	let cssHeight = 0;

	const onLost = (e: Event) => {
		// Without preventDefault the browser never attempts restoration and the
		// canvas is dead for the lifetime of the page. This one line is the whole
		// difference between a hiccup and a permanent blank rectangle.
		e.preventDefault();
		lost = true;
	};
	const onRestored = () => {
		lost = false;
		opts.onRestore?.();
	};
	canvas.addEventListener('webglcontextlost', onLost);
	canvas.addEventListener('webglcontextrestored', onRestored);

	const measure = () => {
		// clientWidth is 0 for a detached or `display:none` canvas. Falling back to
		// the attribute size keeps a headless/offscreen caller from resizing the
		// buffer to nothing and then dividing by it.
		cssWidth = canvas.clientWidth || canvas.width || 1;
		cssHeight = canvas.clientHeight || canvas.height || 1;
	};
	measure();

	return {
		gl,
		canvas,
		get cssWidth() {
			return cssWidth;
		},
		get cssHeight() {
			return cssHeight;
		},
		get lost() {
			return lost;
		},
		resize(dpr = globalThis.devicePixelRatio || 1) {
			measure();
			// Round, don't floor: a floor loses a whole device pixel on most
			// fractional dpr values, which shows up as a one-pixel gap along an edge.
			const w = Math.max(1, Math.round(cssWidth * dpr));
			const h = Math.max(1, Math.round(cssHeight * dpr));
			const changed = canvas.width !== w || canvas.height !== h;
			// Assigning width/height REALLOCATES and clears the drawing buffer even
			// when the value is unchanged, so this guard is not a micro-optimisation —
			// writing it every frame would throw away the frame.
			if (changed) {
				canvas.width = w;
				canvas.height = h;
			}
			// Set unconditionally: one cheap call makes `resize` the sole owner of the
			// viewport, rather than something a caller has to re-establish by hand
			// after any other code touched it.
			gl.viewport(0, 0, w, h);
			return changed;
		},
		dispose() {
			canvas.removeEventListener('webglcontextlost', onLost);
			canvas.removeEventListener('webglcontextrestored', onRestored);
			// Programs and buffers belong to whoever created them, but the drawing
			// buffer belongs to us, and browsers cap live contexts per page (~16).
			// Forcing the loss frees that slot now instead of whenever GC runs — which
			// matters because a studio that mounts and unmounts globes would otherwise
			// exhaust the cap and start returning null from `createGlContext`.
			gl.getExtension('WEBGL_lose_context')?.loseContext();
			lost = true;
		},
	};
}

// ── Programs ────────────────────────────────────────────────────────────────

/** Compile + link. Throws with the shader info log on failure, because a silent
 *  black canvas is the worst possible failure mode here — there is no stack, no
 *  console entry and no visual difference between "shader didn't compile" and
 *  "geometry is off screen". */
export function createProgram(
	gl: WebGL2RenderingContext,
	vertSrc: string,
	fragSrc: string,
): WebGLProgram {
	const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
	let frag: WebGLShader;
	try {
		frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
	} catch (e) {
		// The vertex shader compiled; nothing else will ever reference it.
		gl.deleteShader(vert);
		throw e;
	}
	const program = gl.createProgram();
	if (!program) throw new Error('program alloc failed (context lost?)');
	try {
		gl.attachShader(program, vert);
		gl.attachShader(program, frag);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			// A link failure on a lost context reports nothing useful; say so rather
			// than throwing an empty message the reader will chase into the shaders.
			const log = gl.getProgramInfoLog(program) || '(no log)';
			gl.deleteProgram(program);
			throw new Error(
				gl.isContextLost() ? 'link failed: context lost' : `link failed: ${log}`,
			);
		}
		return program;
	} finally {
		// Detached as soon as the link is done — the program keeps its own copy, and
		// leaving them attached pins the source strings in driver memory.
		gl.detachShader(program, vert);
		gl.detachShader(program, frag);
		gl.deleteShader(vert);
		gl.deleteShader(frag);
	}
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('shader alloc failed (context lost?)');
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	// This query stalls until the driver has finished compiling. Fine once at
	// init; it is the reason not to build programs inside a frame.
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) || '(no log)';
		gl.deleteShader(shader);
		const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
		// Numbered source alongside the log, because drivers report "0:14: error"
		// and nothing else — and the source it is counting is the string passed in,
		// not any file the reader has open.
		throw new Error(`${kind} shader failed to compile: ${log}\n${numbered(src)}`);
	}
	return shader;
}

function numbered(src: string): string {
	return src
		.split('\n')
		.map((line, i) => `${String(i + 1).padStart(3)} | ${line}`)
		.join('\n');
}

// ── Buffers and attribute layout ────────────────────────────────────────────

/** One interleaved attribute in a buffer. */
export interface AttribSpec {
	name: string;
	size: 1 | 2 | 3 | 4;
	/** Advance per instance rather than per vertex. */
	divisor?: number;
}

/** Where each attribute sits inside one interleaved record. */
export interface AttribLayout {
	/** Bytes from one record to the next. */
	stride: number;
	/** Byte offset of each attribute, index-aligned with the input specs. */
	offsets: number[];
}

/** Bytes in a `Float32Array` element. Everything here is float-only: the mesh
 *  scene has no integer or normalised-byte attributes, and pretending otherwise
 *  would mean carrying a type per spec that nothing sets. */
const FLOAT_BYTES = 4;

/** Byte stride and per-attribute offsets for one interleaved buffer.
 *
 *  Pure and exported on purpose. This arithmetic is where VAO bugs actually
 *  live — an off-by-four offset doesn't error, it silently reads a neighbouring
 *  attribute's bytes as position and scatters the geometry — and it is the one
 *  part of the file that can be tested without a GPU.
 *
 *  Packed tight, in declaration order, with no padding. Alignment padding is a
 *  UBO/std140 concern; a vertex buffer's floats need none, and inventing some
 *  here would silently disagree with whatever produced the array. */
export function attribLayout(attribs: AttribSpec[]): AttribLayout {
	const offsets: number[] = [];
	let floats = 0;
	for (const a of attribs) {
		offsets.push(floats * FLOAT_BYTES);
		floats += a.size;
	}
	return { stride: floats * FLOAT_BYTES, offsets };
}

export function createBuffer(
	gl: WebGL2RenderingContext,
	data: Float32Array,
	usage: number = gl.STATIC_DRAW,
): WebGLBuffer {
	const buffer = gl.createBuffer();
	if (!buffer) throw new Error('buffer alloc failed (context lost?)');
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, usage);
	// Seeded so the first `updateBuffer` can hit the subData path instead of
	// reallocating a buffer that was already big enough.
	bufferCapacity.set(buffer, data.byteLength);
	return buffer;
}

/** Re-upload an instance buffer each frame without reallocating.
 *
 *  `bufferSubData` while the new data still fits: reallocating every frame is
 *  what turns a per-frame upload into a stall, because the driver must either
 *  find fresh memory or wait for the in-flight frame to finish reading the old.
 *  It grows only when the instance count genuinely outran the allocation. */
export function updateBuffer(
	gl: WebGL2RenderingContext,
	buffer: WebGLBuffer,
	data: Float32Array,
): void {
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	// Capacity is tracked HERE rather than asked of the driver. This used to call
	// `getBufferParameter(BUFFER_SIZE)`, on the reasoning that reading stored
	// object state costs nothing — measured on the marketing globe, that one call
	// was 5.9% of the whole CPU profile. Any `get*` crosses into the driver and
	// can make it flush work it had batched, and this runs once per layer per
	// frame.
	//
	// A WeakMap keyed by the buffer is safe where a plain side table was not: a
	// WebGLBuffer belongs to exactly one context, so two contexts cannot collide
	// on a key, and an entry dies with the buffer it describes.
	const capacity = bufferCapacity.get(buffer) ?? 0;
	if (data.byteLength <= capacity) {
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
		return;
	}
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
	bufferCapacity.set(buffer, data.byteLength);
}

/** Byte capacity of every buffer this module has uploaded to. */
const bufferCapacity = new WeakMap<WebGLBuffer, number>();

// ── VAOs ────────────────────────────────────────────────────────────────────

/** Build a VAO from interleaved buffers — typically one static buffer holding
 *  the shape's vertices and one instance buffer re-uploaded per frame.
 *
 *  Strides and offsets come from the specs, so a caller never hand-computes a
 *  byte offset; getting one wrong is invisible until the geometry explodes.
 *
 *  Attributes the linker dropped are skipped rather than treated as an error: a
 *  shader that stops reading an attribute is a normal edit, and failing the VAO
 *  build over it would mean every shader tweak breaks the geometry that feeds
 *  it. */
export function createVao(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	buffers: { buffer: WebGLBuffer; attribs: AttribSpec[] }[],
): WebGLVertexArrayObject {
	const vao = gl.createVertexArray();
	if (!vao) throw new Error('VAO alloc failed (context lost?)');
	gl.bindVertexArray(vao);
	for (const { buffer, attribs } of buffers) {
		const { stride, offsets } = attribLayout(attribs);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		attribs.forEach((a, i) => {
			const loc = gl.getAttribLocation(program, a.name);
			if (loc < 0) return;
			gl.enableVertexAttribArray(loc);
			// The buffer bound to ARRAY_BUFFER right now is what this records — the
			// binding itself is NOT VAO state, which is exactly why the bind has to
			// sit inside the loop over buffers rather than once outside it.
			gl.vertexAttribPointer(loc, a.size, gl.FLOAT, false, stride, offsets[i]);
			if (a.divisor) gl.vertexAttribDivisor(loc, a.divisor);
		});
	}
	// Leave nothing bound: a VAO left bound is global state the next caller
	// silently edits, and this file promised not to have any.
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	return vao;
}
