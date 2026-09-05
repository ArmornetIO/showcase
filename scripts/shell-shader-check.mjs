// Compile GlobeShell's two programs in a real WebGL2 context and draw one frame.
//
// A shader that fails to compile does not throw anywhere a type checker or a
// unit test can see it — it produces a blank canvas at runtime and nothing else,
// which is the single worst failure mode in this layer. So this runs the actual
// GLSL through an actual driver, then reads the pixels back to prove the disc
// covered the ones it should and left the rest alone.
//
//   node scripts/shell-shader-check.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = (rel) =>
	readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

/** Pull an exported template literal out of the TS source. The alternative is a
 *  build step to import TS into node, for four strings. */
function extract(text, name) {
	const start = text.indexOf(`export const ${name} = \``);
	if (start < 0) throw new Error(`no export named ${name}`);
	const from = text.indexOf('`', start) + 1;
	const to = text.indexOf('`;', from);
	return text.slice(from, to).replace(/\\`/g, '`');
}

const shaders = src('../src/lib/mesh-studio/gl/shell-shaders.ts');
const programs = {
	disc: [extract(shaders, 'SHELL_DISC_VERT'), extract(shaders, 'SHELL_DISC_FRAG')],
	web: [extract(shaders, 'SHELL_WEB_VERT'), extract(shaders, 'SHELL_WEB_FRAG')],
};

const browser = await chromium.launch({
	args: [
		'--use-gl=angle',
		'--use-angle=default',
		'--enable-gpu-rasterization',
		'--ignore-gpu-blocklist',
	],
});
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="256" height="256"></canvas>');

const result = await page.evaluate((programs) => {
	const canvas = document.getElementById('c');
	const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true });
	if (!gl) return { error: 'no webgl2' };

	const compile = (type, source) => {
		const s = gl.createShader(type);
		gl.shaderSource(s, source);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
			throw new Error(gl.getShaderInfoLog(s));
		return s;
	};
	const link = (vs, fs) => {
		const p = gl.createProgram();
		gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
		gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
		gl.linkProgram(p);
		if (!gl.getProgramParameter(p, gl.LINK_STATUS))
			throw new Error(gl.getProgramInfoLog(p));
		return p;
	};

	const out = { renderer: 'unknown', programs: {}, pixels: null };
	const dbg = gl.getExtension('WEBGL_debug_renderer_info');
	if (dbg) out.renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);

	const built = {};
	for (const [name, [vs, fs]] of Object.entries(programs)) {
		try {
			built[name] = link(vs, fs);
			out.programs[name] = 'ok';
		} catch (e) {
			out.programs[name] = String(e.message || e);
		}
	}
	if (!built.disc) return out;

	// Draw the disc: a globe of limb 80 centred in a 256px canvas, camera at
	// identity, veil red at 0.5 so a covered pixel is unmistakable.
	const limb = 80;
	const cx = 128;
	const cy = 128;
	const r = limb + 2;
	const quad = new Float32Array([
		cx - r, cy - r, cx + r, cy - r, cx + r, cy + r,
		cx - r, cy - r, cx + r, cy + r, cx - r, cy + r,
	]);
	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
	gl.useProgram(built.disc);
	const loc = gl.getAttribLocation(built.disc, 'aWorld');
	gl.enableVertexAttribArray(loc);
	gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
	const u = (n) => gl.getUniformLocation(built.disc, n);
	gl.uniform3f(u('uCam'), 0, 0, 1);
	gl.uniform2f(u('uSize'), 256, 256);
	gl.uniform2f(u('uCenter'), cx, cy);
	gl.uniform1f(u('uLimb'), limb);
	gl.uniform3f(u('uVeil'), 1, 0, 0);
	gl.uniform1f(u('uVeilA'), 0.5);
	gl.uniform3f(u('uInk'), 0, 1, 0);
	gl.uniform1f(u('uScanA'), 0.025);
	gl.uniform1f(u('uRimMid'), 0.1);
	gl.uniform1f(u('uRimEdge'), 0.42);
	gl.uniform1f(u('uRingW'), 1);
	gl.viewport(0, 0, 256, 256);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

	const read = (x, y) => {
		const px = new Uint8Array(4);
		gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return Array.from(px);
	};

	/** One render at a given limb-stroke opacity.
	 *
	 *  Two of them, because "is the stroke there" cannot be asked of a single
	 *  frame: AT the limb the disc mask has already fallen to ~0.16, so the ring
	 *  lands on almost nothing and is DIMMER in absolute terms than the lit face
	 *  just inside it. The only honest test is the difference the uniform makes. */
	const frame = (ringA) => {
		gl.uniform1f(u('uRingA'), ringA);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		return {
			centre: read(128, 128),
			// Just inside the limb — veil plus rim, far enough in that the stroke
			// cannot reach it.
			nearRim: read(128 + limb - 6, 128),
			onLimb: read(128 + limb, 128),
			// Well outside: must be untouched.
			outside: read(128 + limb + 30, 128),
			corner: read(4, 4),
		};
	};

	out.pixels = frame(0.35);
	out.noRing = frame(0);
	out.glError = gl.getError();
	return out;
}, programs);

console.log(JSON.stringify(result, null, 2));
await browser.close();

const bad = [];
if (result.error) bad.push(result.error);
for (const [name, status] of Object.entries(result.programs ?? {}))
	if (status !== 'ok') bad.push(`${name}: ${status}`);
const p = result.pixels;
const n = result.noRing;
if (p && n) {
	if (p.centre[3] === 0) bad.push('disc centre drew nothing');
	if (p.outside[3] !== 0) bad.push('disc painted outside the limb');
	if (p.corner[3] !== 0) bad.push('disc painted the whole quad, not a circle');
	// The rim glow: ink rises toward the edge and the face stays clear enough to
	// read the mesh through.
	if (p.nearRim[1] <= p.centre[1]) bad.push('rim glow is not brighter than the face');
	// The limb stroke is exactly what the ring uniform adds.
	if (p.onLimb[3] <= n.onLimb[3]) bad.push('limb stroke adds nothing at the limb');
	if (p.centre[3] !== n.centre[3]) bad.push('limb stroke leaked into the middle');
}
if (result.glError) bad.push(`gl error ${result.glError}`);

if (bad.length) {
	console.error('\nFAIL\n - ' + bad.join('\n - '));
	process.exit(1);
}
console.log('\nOK — both programs compiled and the disc rendered as specified.');
