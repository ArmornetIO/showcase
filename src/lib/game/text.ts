// ── game/text — words as solids ──────────────────────────────────────────────
// The map renderer draws convex solids and nothing else: no textures, so no
// font atlas. A 5×7 pixel font fits that exactly — each row's run of lit
// pixels is one box, so a ten-letter sign is ~100 boxes, lit and outlined like
// every other prop, and readable in the dark when its material glows.
//
// In the map's frame (`cuboid`): reads along +x, up +y, faces +z.
import type { Piece } from '../mesh-studio/pieces/pieces.js';
import { cuboid } from './map.js';

/** Seven rows of five, top first; `#` is lit. Lower case is drawn upper. */
const FONT: Record<string, string> = {
	A: '.###. #...# #...# ##### #...# #...# #...#',
	B: '####. #...# #...# ####. #...# #...# ####.',
	C: '.###. #...# #.... #.... #.... #...# .###.',
	D: '####. #...# #...# #...# #...# #...# ####.',
	E: '##### #.... #.... ####. #.... #.... #####',
	F: '##### #.... #.... ####. #.... #.... #....',
	G: '.###. #...# #.... #..## #...# #...# .####',
	H: '#...# #...# #...# ##### #...# #...# #...#',
	I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
	J: '..### ...#. ...#. ...#. ...#. #..#. .##..',
	K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
	L: '#.... #.... #.... #.... #.... #.... #####',
	M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
	N: '#...# #...# ##..# #.#.# #..## #...# #...#',
	O: '.###. #...# #...# #...# #...# #...# .###.',
	P: '####. #...# #...# ####. #.... #.... #....',
	Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
	R: '####. #...# #...# ####. #.#.. #..#. #...#',
	S: '.#### #.... #.... .###. ....# ....# ####.',
	T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
	U: '#...# #...# #...# #...# #...# #...# .###.',
	V: '#...# #...# #...# #...# #...# .#.#. ..#..',
	W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.',
	X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
	Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
	Z: '##### ....# ...#. ..#.. .#... #.... #####',
	'0': '.###. #...# #..## #.#.# ##..# #...# .###.',
	'1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
	'2': '.###. #...# ....# ...#. ..#.. .#... #####',
	'3': '##### ...#. ..#.. ...#. ....# #...# .###.',
	'4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
	'5': '##### #.... ####. ....# ....# #...# .###.',
	'6': '..##. .#... #.... ####. #...# #...# .###.',
	'7': '##### ....# ...#. ..#.. .#... .#... .#...',
	'8': '.###. #...# #...# .###. #...# #...# .###.',
	'9': '.###. #...# #...# .#### ....# ...#. .##..',
	' ': '..... ..... ..... ..... ..... ..... .....',
	'-': '..... ..... ..... .###. ..... ..... .....',
	'.': '..... ..... ..... ..... ..... .##.. .##..',
	'/': '..... ....# ...#. ..#.. .#... #.... .....',
	'&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#'
};
const ROWS = 7;
/** Five pixels and a gap. */
const ADVANCE = 6;

export interface Text3dOptions {
	/** Cap height, metres. Default 0.2. */
	size?: number;
	/** How far the letters stand off their face, toward +z. Default 0.015. */
	depth?: number;
	/** Where x = 0 falls on the line. Default 'center'. */
	align?: 'left' | 'center' | 'right';
	/** The baseline's left-or-centre point and the face the letters stand on. */
	x?: number;
	y?: number;
	z?: number;
}

/** How wide `s` sets at cap height `size`, without the trailing gap. */
export function textWidth(s: string, size = 0.2): number {
	return s.length ? ((s.length * ADVANCE - 1) * size) / ROWS : 0;
}

/** `s` as solids. A character the font lacks throws: a sign that silently
 *  drops a letter reads as a typo nobody made. */
export function text3d(s: string, opts: Text3dOptions = {}): Piece {
	const { size = 0.2, depth = 0.015, align = 'center', x = 0, y = 0, z = 0 } = opts;
	const px = size / ROWS;
	const w = textWidth(s, size);
	const left = x - (align === 'center' ? w / 2 : align === 'right' ? w : 0);
	const out: Piece = [];
	[...s.toUpperCase()].forEach((ch, i) => {
		const glyph = FONT[ch];
		if (!glyph) throw new Error(`text3d: no glyph for ${JSON.stringify(ch)}`);
		const x0 = left + i * ADVANCE * px;
		glyph.split(' ').forEach((row, r) => {
			const y0 = y + (ROWS - 1 - r) * px;
			for (let c = 0; c < row.length; c++) {
				if (row[c] !== '#') continue;
				let e = c;
				while (row[e + 1] === '#') e++;
				out.push(cuboid(x0 + c * px, x0 + (e + 1) * px, y0, y0 + px, z, z + depth));
				c = e;
			}
		});
	});
	return out;
}
