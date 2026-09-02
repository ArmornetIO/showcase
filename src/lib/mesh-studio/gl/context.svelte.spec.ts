// Browser tests — a real Chromium, so a real WebGL2 context. The `.svelte.`
// suffix is what routes a file to the browser project (see vite.config.ts); it
// has nothing to do with Svelte, and nothing here imports it.
import { describe, it, expect, afterEach } from 'vitest';
import {
	createGlContext,
	createProgram,
	createBuffer,
	updateBuffer,
	createVao,
	type GlContext,
} from './context.js';

const VERT = `#version 300 es
in vec2 aPos;
in vec2 aCenter;
in float aScale;
void main() { gl_Position = vec4(aPos * aScale + aCenter, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(1.0); }`;

const live: { dispose(): void }[] = [];
const canvases: HTMLCanvasElement[] = [];

/** A canvas with a real CSS size, in the document — `resize` measures
 *  clientWidth, which is 0 for anything detached. */
function mount(w = 200, h = 120): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.style.width = `${w}px`;
	canvas.style.height = `${h}px`;
	canvas.style.display = 'block';
	document.body.appendChild(canvas);
	canvases.push(canvas);
	return canvas;
}

function ctx(canvas: HTMLCanvasElement, opts?: Parameters<typeof createGlContext>[1]) {
	const c = createGlContext(canvas, opts);
	// Chromium in the test runner always has WebGL2; a null here is a real
	// failure, not a fallback path to skip over.
	expect(c).not.toBeNull();
	live.push(c as GlContext);
	return c as GlContext;
}

afterEach(() => {
	// Browsers cap live contexts per page, so leaking one leaks the whole suite.
	live.splice(0).forEach((c) => c.dispose());
	canvases.splice(0).forEach((el) => el.remove());
});

describe('createGlContext', () => {
	it('creates a WebGL2 context on the given canvas', () => {
		const canvas = mount();
		const c = ctx(canvas);
		expect(c.gl).toBeInstanceOf(WebGL2RenderingContext);
		expect(c.canvas).toBe(canvas);
		expect(c.lost).toBe(false);
	});

	it('asks for the attributes the scene depends on', () => {
		const c = ctx(mount());
		const attrs = c.gl.getContextAttributes();
		expect(attrs?.alpha).toBe(true);
		expect(attrs?.premultipliedAlpha).toBe(false);
		// The load-bearing one: a depth buffer would hide the far side of the globe.
		expect(attrs?.depth).toBe(false);
	});

	it('keeps several contexts independent on one page', () => {
		const a = ctx(mount(100, 100));
		const b = ctx(mount(300, 200));
		a.resize(1);
		b.resize(1);
		expect(a.canvas.width).toBe(100);
		expect(b.canvas.width).toBe(300);
		expect(a.gl).not.toBe(b.gl);
	});
});

describe('resize', () => {
	it('reports a change only when the size actually moved', () => {
		const canvas = mount(200, 120);
		const c = ctx(canvas);
		expect(c.resize(1)).toBe(true);
		expect(canvas.width).toBe(200);
		expect(canvas.height).toBe(120);
		// Same size again: no reallocation, so no report.
		expect(c.resize(1)).toBe(false);
		expect(c.resize(1)).toBe(false);

		canvas.style.width = '260px';
		expect(c.resize(1)).toBe(true);
		expect(canvas.width).toBe(260);
		expect(c.resize(1)).toBe(false);
	});

	it('scales the drawing buffer by dpr while CSS size stays put', () => {
		const canvas = mount(200, 120);
		const c = ctx(canvas);
		c.resize(2);
		expect(canvas.width).toBe(400);
		expect(canvas.height).toBe(240);
		expect(c.cssWidth).toBe(200);
		expect(c.cssHeight).toBe(120);
		// A dpr change is a size change.
		expect(c.resize(1)).toBe(true);
		expect(canvas.width).toBe(200);
	});

	it('rounds fractional dpr rather than losing a pixel to a floor', () => {
		const c = ctx(mount(100, 100));
		c.resize(1.5);
		expect(c.canvas.width).toBe(150);
		c.resize(1.25);
		expect(c.canvas.width).toBe(125);
	});

	it('sets the viewport to the drawing buffer', () => {
		const c = ctx(mount(200, 120));
		c.resize(2);
		expect(Array.from(c.gl.getParameter(c.gl.VIEWPORT) as Int32Array)).toEqual([
			0, 0, 400, 240,
		]);
	});

	it('never sizes to zero', () => {
		const canvas = mount(0, 0);
		const c = ctx(canvas);
		c.resize(1);
		expect(c.canvas.width).toBeGreaterThan(0);
		expect(c.canvas.height).toBeGreaterThan(0);
	});
});

describe('createProgram', () => {
	it('links a valid pair', () => {
		const c = ctx(mount());
		const program = createProgram(c.gl, VERT, FRAG);
		expect(program).toBeTruthy();
		expect(c.gl.getProgramParameter(program, c.gl.LINK_STATUS)).toBe(true);
		expect(c.gl.getError()).toBe(0);
	});

	it('throws with the info log and numbered source on a syntax error', () => {
		const c = ctx(mount());
		const broken = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(1.0) }`; // missing semicolon
		let err: unknown;
		try {
			createProgram(c.gl, VERT, broken);
		} catch (e) {
			err = e;
		}
		expect(err).toBeInstanceOf(Error);
		const msg = (err as Error).message;
		expect(msg).toContain('fragment shader failed to compile');
		// The driver's own words, not a generic "compile failed".
		expect(msg.toLowerCase()).toContain('error');
		// And the source it is counting lines against.
		expect(msg).toContain('  4 | void main()');
	});

	it('names the vertex stage when that is the one that failed', () => {
		const c = ctx(mount());
		expect(() => createProgram(c.gl, `#version 300 es\nvoid main() { nope(); }`, FRAG)).toThrow(
			/vertex shader failed to compile/,
		);
	});

	it('leaves no GL error behind after a failure', () => {
		const c = ctx(mount());
		expect(() => createProgram(c.gl, VERT, 'not glsl at all')).toThrow();
		// Compile failures are reported through the info log, not glGetError — a
		// stray error here would surface later and be blamed on the next call.
		expect(c.gl.getError()).toBe(0);
	});
});

describe('buffers and VAOs', () => {
	it('builds an interleaved + instanced VAO without a GL error', () => {
		const c = ctx(mount());
		const { gl } = c;
		const program = createProgram(gl, VERT, FRAG);
		// A triangle: vec2 position per vertex.
		const geometry = createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1]));
		// Two instances: vec2 centre + float scale, interleaved.
		const instances = createBuffer(
			gl,
			new Float32Array([-0.5, -0.5, 0.25, 0.5, 0.5, 0.5]),
			gl.DYNAMIC_DRAW,
		);
		const vao = createVao(gl, program, [
			{ buffer: geometry, attribs: [{ name: 'aPos', size: 2 }] },
			{
				buffer: instances,
				attribs: [
					{ name: 'aCenter', size: 2, divisor: 1 },
					{ name: 'aScale', size: 1, divisor: 1 },
				],
			},
		]);
		expect(vao).toBeTruthy();
		expect(gl.getError()).toBe(0);

		// And it actually draws.
		c.resize(1);
		gl.useProgram(program);
		gl.bindVertexArray(vao);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 2);
		expect(gl.getError()).toBe(0);
	});

	it('records the right stride and divisor per attribute', () => {
		const { gl } = ctx(mount());
		const program = createProgram(gl, VERT, FRAG);
		const instances = createBuffer(gl, new Float32Array(6));
		const vao = createVao(gl, program, [
			{
				buffer: instances,
				attribs: [
					{ name: 'aCenter', size: 2, divisor: 1 },
					{ name: 'aScale', size: 1, divisor: 1 },
				],
			},
		]);
		gl.bindVertexArray(vao);
		const scale = gl.getAttribLocation(program, 'aScale');
		expect(gl.getVertexAttrib(scale, gl.VERTEX_ATTRIB_ARRAY_STRIDE)).toBe(12);
		expect(gl.getVertexAttrib(scale, gl.VERTEX_ATTRIB_ARRAY_DIVISOR)).toBe(1);
		// The third float in the record.
		expect(gl.getVertexAttribOffset(scale, gl.VERTEX_ATTRIB_ARRAY_POINTER)).toBe(8);
		gl.bindVertexArray(null);
		expect(gl.getError()).toBe(0);
	});

	it('skips attributes the linker dropped instead of failing', () => {
		const { gl } = ctx(mount());
		const program = createProgram(gl, VERT, FRAG);
		const buffer = createBuffer(gl, new Float32Array(8));
		expect(() =>
			createVao(gl, program, [
				{
					buffer,
					attribs: [
						{ name: 'aPos', size: 2 },
						{ name: 'aNotInTheShader', size: 2 },
					],
				},
			]),
		).not.toThrow();
		expect(gl.getError()).toBe(0);
	});

	it('leaves nothing bound', () => {
		const { gl } = ctx(mount());
		const program = createProgram(gl, VERT, FRAG);
		createVao(gl, program, [
			{ buffer: createBuffer(gl, new Float32Array(6)), attribs: [{ name: 'aPos', size: 2 }] },
		]);
		expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBeNull();
		expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBeNull();
	});

	it('updateBuffer re-uploads in place, and grows only when it must', () => {
		const { gl } = ctx(mount());
		const buffer = createBuffer(gl, new Float32Array(4), gl.DYNAMIC_DRAW);
		const size = () => {
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			return gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE) as number;
		};
		expect(size()).toBe(16);

		updateBuffer(gl, buffer, new Float32Array([1, 2, 3, 4]));
		expect(size()).toBe(16);
		// Shorter data still fits — no realloc.
		updateBuffer(gl, buffer, new Float32Array([9, 9]));
		expect(size()).toBe(16);
		// Longer data has nowhere to go but a bigger allocation.
		updateBuffer(gl, buffer, new Float32Array(10));
		expect(size()).toBe(40);
		expect(gl.getError()).toBe(0);
	});
});

describe('context loss', () => {
	const loseExt = (gl: WebGL2RenderingContext) => {
		const ext = gl.getExtension('WEBGL_lose_context');
		expect(ext).not.toBeNull();
		return ext as WEBGL_lose_context;
	};
	const once = (el: HTMLCanvasElement, type: string) =>
		new Promise<void>((resolve) => el.addEventListener(type, () => resolve(), { once: true }));

	it('flips `lost` and keeps calls from throwing', async () => {
		const canvas = mount();
		const c = ctx(canvas);
		const program = createProgram(c.gl, VERT, FRAG);
		const lost = once(canvas, 'webglcontextlost');
		loseExt(c.gl).loseContext();
		await lost;

		expect(c.lost).toBe(true);
		expect(c.gl.isContextLost()).toBe(true);
		// The whole point: a render loop that hasn't checked `lost` yet must not
		// take the page down on its next call.
		expect(() => {
			c.resize(1);
			c.gl.useProgram(program);
			c.gl.clear(c.gl.COLOR_BUFFER_BIT);
			c.gl.drawArrays(c.gl.TRIANGLES, 0, 3);
		}).not.toThrow();
	});

	it('cancels the lost event, which is what allows restoration at all', async () => {
		const canvas = mount();
		const c = ctx(canvas);
		const lost = once(canvas, 'webglcontextlost');
		loseExt(c.gl).loseContext();
		await lost;
		// A `webglcontextlost` that reaches its default action means the browser
		// will never try to restore, and the canvas is dead for the page's
		// lifetime. Asserted on a synthetic event because `defaultPrevented` is
		// only readable from the dispatcher's side.
		const probe = new Event('webglcontextlost', { cancelable: true });
		canvas.dispatchEvent(probe);
		expect(probe.defaultPrevented).toBe(true);
	});

	it('restores, clears `lost`, and calls onRestore so the caller can rebuild', () => {
		// Driven by a synthetic `webglcontextrestored`: headless Chromium's
		// software GL accepts `restoreContext()` and then never fires the event,
		// so waiting on the real one only ever tests the harness. What this module
		// actually owns is the listener wiring — clear the flag, tell the caller —
		// and dispatching the event exercises exactly that.
		const canvas = mount();
		let restores = 0;
		const c = ctx(canvas, { onRestore: () => restores++ });

		canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
		expect(c.lost).toBe(true);
		expect(restores).toBe(0);

		canvas.dispatchEvent(new Event('webglcontextrestored'));
		expect(c.lost).toBe(false);
		// Every GL object made before the loss is dead by now, so the caller has to
		// be told to rebuild — a silently resumed render loop would draw nothing.
		expect(restores).toBe(1);
	});

	it('survives a loss/restore cycle repeated', () => {
		const canvas = mount();
		let restores = 0;
		const c = ctx(canvas, { onRestore: () => restores++ });
		for (let i = 0; i < 3; i++) {
			canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
			expect(c.lost).toBe(true);
			canvas.dispatchEvent(new Event('webglcontextrestored'));
			expect(c.lost).toBe(false);
		}
		expect(restores).toBe(3);
	});

	it('dispose releases the context and stops listening', () => {
		const canvas = mount();
		let restores = 0;
		const c = createGlContext(canvas, { onRestore: () => restores++ });
		expect(c).not.toBeNull();

		c!.dispose();
		// The drawing buffer is handed back — browsers cap live contexts per page,
		// so a studio that mounts and unmounts globes depends on this.
		expect(c!.lost).toBe(true);
		expect(c!.gl.isContextLost()).toBe(true);

		// Listeners are gone, so nothing re-arms the object behind the caller's
		// back — a disposed context stays disposed.
		canvas.dispatchEvent(new Event('webglcontextrestored'));
		expect(c!.lost).toBe(true);
		expect(restores).toBe(0);
	});

	it('dispose is safe to call twice', () => {
		const c = createGlContext(mount());
		expect(() => {
			c!.dispose();
			c!.dispose();
		}).not.toThrow();
	});
});
