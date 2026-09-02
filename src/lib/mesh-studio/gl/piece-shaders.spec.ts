// GLSL cannot be compiled in Node, so these pin the CONTRACT instead — which is
// where this module actually breaks. A shader that fails to compile fails loudly
// on the first frame; a VAO whose attribute order silently disagrees with the
// `in` declarations draws garbage and nobody can see why.
import { describe, it, expect } from 'vitest';
import {
	PIECE_VERT,
	PIECE_FRAG,
	PIECE_ATTRIBS,
	PIECE_UNIFORMS,
	PIECE_PASSES,
	BAND,
	LIGHT
} from './piece-shaders.js';

/** GLSL declarations only — a name inside a comment must not count as one. */
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const SIZE_OF: Record<string, number> = { float: 1, vec2: 2, vec3: 3, vec4: 4, int: 1 };

type Decl = { type: string; name: string };

function declsOf(src: string, kind: 'in' | 'out' | 'uniform'): Decl[] {
	const re = new RegExp(`(?:^|\\n)\\s*(?:flat\\s+|smooth\\s+)?${kind}\\s+(\\w+)\\s+(\\w+)\\s*;`, 'g');
	return [...strip(src).matchAll(re)].map((m) => ({ type: m[1], name: m[2] }));
}

describe('piece-shaders', () => {
	it('starts both sources with the version directive on line 1', () => {
		// A leading blank line is a hard compile error, and a template literal
		// makes one very easy to introduce.
		for (const src of [PIECE_VERT, PIECE_FRAG]) {
			expect(src.split('\n')[0]).toBe('#version 300 es');
		}
	});

	it('declares a float precision in both sources', () => {
		for (const src of [PIECE_VERT, PIECE_FRAG]) {
			expect(src).toMatch(/precision\s+\w+p\s+float\s*;/);
		}
	});

	describe('attributes', () => {
		const ins = declsOf(PIECE_VERT, 'in');

		it('declares every attribute the host will bind', () => {
			// Vertex-shader `in` IS the attribute set — no varyings live here.
			const declared = ins.map((d) => d.name).sort();
			const listed = PIECE_ATTRIBS.map((a) => a.name).sort();
			expect(declared).toEqual(listed);
		});

		it('agrees on component count between the list and the GLSL type', () => {
			for (const a of PIECE_ATTRIBS) {
				const decl = ins.find((d) => d.name === a.name);
				expect(decl, `${a.name} is not declared in PIECE_VERT`).toBeDefined();
				expect(SIZE_OF[decl!.type], `${a.name} is ${decl!.type}`).toBe(a.size);
			}
		});

		it('packs 7 static floats and 27 per-instance floats', () => {
			const sum = (rows: typeof PIECE_ATTRIBS) => rows.reduce((n, a) => n + a.size, 0);
			expect(sum(PIECE_ATTRIBS.filter((a) => a.divisor === undefined))).toBe(7);
			expect(sum(PIECE_ATTRIBS.filter((a) => a.divisor === 1))).toBe(27);
		});

		it('uses only divisor 0 or 1', () => {
			for (const a of PIECE_ATTRIBS) {
				expect([undefined, 1]).toContain(a.divisor);
			}
		});

		it('keeps the static block first, so the interleaved buffers stay contiguous', () => {
			const firstInstance = PIECE_ATTRIBS.findIndex((a) => a.divisor === 1);
			expect(PIECE_ATTRIBS.slice(firstInstance).every((a) => a.divisor === 1)).toBe(true);
		});
	});

	describe('uniforms', () => {
		it('declares every listed uniform in at least one source', () => {
			const declared = new Set(
				[...declsOf(PIECE_VERT, 'uniform'), ...declsOf(PIECE_FRAG, 'uniform')].map((d) => d.name)
			);
			for (const u of PIECE_UNIFORMS) {
				expect(declared.has(u), `${u} is not declared`).toBe(true);
			}
		});

		it('lists every declared uniform', () => {
			const declared = [...declsOf(PIECE_VERT, 'uniform'), ...declsOf(PIECE_FRAG, 'uniform')];
			for (const d of declared) {
				expect(PIECE_UNIFORMS, `${d.name} is declared but unlisted`).toContain(d.name);
			}
		});
	});

	describe('varyings', () => {
		it('matches every vertex out to a fragment in of the same type', () => {
			const outs = declsOf(PIECE_VERT, 'out');
			const ins = declsOf(PIECE_FRAG, 'in');
			expect(outs.length).toBeGreaterThan(0);
			expect(outs).toEqual(ins);
		});

		it('interpolates state flat, since it is per-instance and must not blend', () => {
			expect(PIECE_VERT).toMatch(/flat\s+out\s+float\s+vState\s*;/);
			expect(PIECE_FRAG).toMatch(/flat\s+in\s+float\s+vState\s*;/);
		});
	});

	describe('passes', () => {
		it('numbers ids uniquely and contiguously from 0', () => {
			const ids = PIECE_PASSES.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
			expect([...ids].sort((a, b) => a - b)).toEqual(ids.map((_, i) => i));
		});

		it('branches on every pass id in the fragment shader', () => {
			const src = strip(PIECE_FRAG);
			for (const p of PIECE_PASSES) {
				const konst = `PASS_${p.name.toUpperCase()}`;
				expect(src, `${konst} constant`).toMatch(
					new RegExp(`const\\s+int\\s+${konst}\\s*=\\s*${p.id}\\s*;`)
				);
				expect(src, `${konst} branch`).toMatch(new RegExp(`uPass\\s*==\\s*${konst}`));
			}
		});

		it('uses only blend modes the host knows how to set', () => {
			for (const p of PIECE_PASSES) {
				expect(['over', 'add', 'screen']).toContain(p.blend);
			}
			// The emissive pass is the whole reason for the screen mode; losing it
			// would quietly turn the hologram back into paint.
			expect(PIECE_PASSES.find((p) => p.blend === 'screen')?.name).toBe('emit');
		});
	});

	describe('shared constants', () => {
		it('interpolates BAND into the fragment source rather than retyping it', () => {
			expect(PIECE_FRAG).toContain(`const float BAND = ${BAND};`);
		});

		it('interpolates LIGHT into the fragment source', () => {
			expect(PIECE_FRAG).toContain(`vec3(${LIGHT[0]}, ${LIGHT[1]}, ${LIGHT[2]})`);
		});

		it('keeps LIGHT unnormalised, as NodePiece had it', () => {
			// The band thresholds were tuned against this exact dot product.
			const len = Math.hypot(...LIGHT);
			expect(len).toBeGreaterThan(1);
			expect(len).toBeLessThan(1.01);
		});

		it('writes every GLSL float literal with a decimal point', () => {
			// `vec3(1, 0, 0)` does not compile in GLSL ES 3.00.
			for (const src of [PIECE_VERT, PIECE_FRAG]) {
				const args = [...strip(src).matchAll(/\bvec[234]\(([^)]*)\)/g)].flatMap((m) =>
					m[1].split(',').map((s) => s.trim())
				);
				for (const arg of args) {
					if (/^-?\d+$/.test(arg)) throw new Error(`bare int literal in a vec: ${arg}`);
				}
			}
		});
	});

	describe('vertex placement', () => {
		it('applies sink, the grow correction, and the y-flip', () => {
			// NodePiece.at() transcribed — the one place a typo produces a picture
			// that is subtly wrong everywhere rather than obviously wrong anywhere.
			const src = strip(PIECE_VERT);
			expect(src).toContain('aLocal.z - iSink');
			expect(src).toContain('1.0 + (iGrow - 1.0) * h');
			expect(src).toContain('iOrigin + (aLocal.x * iE + aLocal.y * iN) * k + h * iU');
			expect(src).toContain('uCam.xy + uCam.z * world');
			expect(src).toContain('1.0 - px.y / uSize.y * 2.0');
		});

		it('ramps land to own colour by 34% of the piece height', () => {
			expect(strip(PIECE_VERT)).toContain('mix(iLand, iColor, smoothstep(0.0, 0.34, aHNorm))');
		});

		it('builds the world normal from the three instance axes', () => {
			expect(strip(PIECE_VERT)).toContain(
				'normalize(aNormal.x * iAxisE + aNormal.y * iAxisN + aNormal.z * iAxisU)'
			);
		});
	});

	describe('shading', () => {
		it('reproduces band() as a step ladder', () => {
			// 0.54 / 0.76 / 1.0 at the same two thresholds NodePiece used.
			const band = (lit: number) =>
				0.54 + 0.22 * (lit >= 0.22 ? 1 : 0) + 0.24 * (lit >= 0.62 ? 1 : 0);
			expect(band(-1)).toBeCloseTo(0.54);
			expect(band(0.4)).toBeCloseTo(0.76);
			expect(band(0.9)).toBeCloseTo(1);
			expect(PIECE_FRAG).toContain('0.54 + 0.22 * step(0.22, lit) + 0.24 * step(0.62, lit)');
		});

		it('culls faces pointing away, at NodePiece’s epsilon', () => {
			expect(strip(PIECE_FRAG)).toContain('if (n.z <= 0.001) discard;');
		});

		it('writes premultiplied colour, which is what makes screen blending work', () => {
			expect(strip(PIECE_FRAG)).toContain('fragColor = vec4(rgb * a, a);');
		});
	});
});
