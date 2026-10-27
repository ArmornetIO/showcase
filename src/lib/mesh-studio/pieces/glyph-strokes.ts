// ── mesh-studio/pieces/glyph-strokes — an icon's markup, as the lines it draws ─
// The one step between a mode's glyph and `plate`: read the inner SVG the icon
// set stores and hand back its strokes as polylines, in the glyph's own 24×24
// units. Everything after that — scale, depth, suspension — is the glyph
// quarter's grammar and lives there.
//
// PURE, and that is why this exists rather than `glyph-sample.ts`, which already
// reads the same markup: it measures by building a live `<path>` and calling
// `getPointAtLength`, which needs a document. Pieces are built at module load and
// checked in the Node test project, where there is no document to ask.
//
// It reads the vocabulary `mode-tool-icons.ts` actually uses — `path`, `circle`,
// `ellipse`, `rect`; path commands M L H V C S Q A Z, absolute and relative —
// and nothing wider. A general SVG parser is a much bigger thing, and a glyph
// that reaches outside this set is one the icon file has changed under it: the
// piece should visibly lose that element, not guess at it.

export type Pt = [number, number];

export interface GlyphStrokes {
	/** Open or closed runs of straight segments. Curves arrive pre-sampled. */
	lines: Pt[][];
	/** Elements drawn FILLED (`fill="currentColor"`) — the glyph's dots. */
	dots: { x: number; y: number; r: number }[];
}

/** Longest straight run a curve is cut into, in icon units.
 *
 *  By LENGTH, not by angle, and the first version got that wrong: sampling every
 *  30° gave a rounded corner of radius 1 as many segments as a circle of radius
 *  8, and every segment is a solid of six faces the globe culls, shades and sorts
 *  on the CPU each frame. The icon pieces came out at 100–270 faces where a
 *  building is ~40. A glyph is about 40px across on the globe, so an icon unit is
 *  under 2px, and a 2.5-unit facet disappears under the hologram glow. */
const SEG_LEN = 2.5;
/** A closed ring never drops below this, or a small circle reads as a square. */
const MIN_RING = 6;
const segs = (len: number, min = 1) => Math.max(min, Math.ceil(len / SEG_LEN));

/** A Bézier's length, near enough to count segments by: the mean of its chord
 *  (a lower bound) and its control polygon (an upper bound). */
function curveLen(...pts: Pt[]): number {
	let poly = 0;
	for (let i = 1; i < pts.length; i++)
		poly += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
	const a = pts[0];
	const b = pts[pts.length - 1];
	return (poly + Math.hypot(b[0] - a[0], b[1] - a[1])) / 2;
}

const ELEMENT = /<(path|circle|ellipse|rect)\b([^>]*)>/g;
const ATTR = /([\w-]+)="([^"]*)"/g;
// A number, including the icon set's habit of running them together: `1.5.5`
// is 1.5 then .5, and `-1-1` is two negatives.
const TOKEN = /[MmLlHhVvCcSsQqAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;

function attrs(src: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const m of src.matchAll(ATTR)) out[m[1]] = m[2];
	return out;
}

const num = (s: string | undefined, fallback = 0) => (s === undefined ? fallback : Number(s));

function ellipseRing(cx: number, cy: number, rx: number, ry: number): Pt[] {
	const n = segs(2 * Math.PI * Math.max(rx, ry), MIN_RING);
	return Array.from({ length: n + 1 }, (_, i): Pt => {
		const a = (2 * Math.PI * i) / n;
		return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
	});
}

/** A rect, rounded if the markup rounds it — each corner cut by its own length,
 *  so a tight radius is one bevel and a generous one is a curve. */
function rectRing(x: number, y: number, w: number, h: number, rx: number, ry: number): Pt[] {
	const r = Math.min(rx, w / 2);
	const q = Math.min(ry, h / 2);
	const k = segs((Math.PI / 2) * Math.max(r, q));
	if (r <= 0 || q <= 0)
		return [
			[x, y],
			[x + w, y],
			[x + w, y + h],
			[x, y + h],
			[x, y],
		];
	const corner = (cx: number, cy: number, a0: number): Pt[] =>
		Array.from({ length: k + 1 }, (_, i): Pt => {
			const a = a0 + (Math.PI / 2) * (i / k);
			return [cx + r * Math.cos(a), cy + q * Math.sin(a)];
		});
	const ring = [
		...corner(x + w - r, y + q, -Math.PI / 2),
		...corner(x + w - r, y + h - q, 0),
		...corner(x + r, y + h - q, Math.PI / 2),
		...corner(x + r, y + q, Math.PI),
	];
	return [...ring, ring[0]];
}

/** SVG's endpoint arc, converted to centre form and sampled — the spec's own
 *  algorithm (SVG 1.1 F.6.5), because the icon set leans on `a` for every rounded
 *  corner and a hand-rolled approximation gets the sweep wrong on exactly those. */
function arcPoints(
	x1: number,
	y1: number,
	rxIn: number,
	ryIn: number,
	phiDeg: number,
	large: number,
	sweep: number,
	x2: number,
	y2: number,
): Pt[] {
	if (rxIn === 0 || ryIn === 0) return [[x2, y2]];
	const phi = (phiDeg * Math.PI) / 180;
	const cos = Math.cos(phi);
	const sin = Math.sin(phi);
	const dx = (x1 - x2) / 2;
	const dy = (y1 - y2) / 2;
	const xp = cos * dx + sin * dy;
	const yp = -sin * dx + cos * dy;
	let rx = Math.abs(rxIn);
	let ry = Math.abs(ryIn);
	// Radii too small for the chord are scaled up, per the spec, rather than the
	// arc being dropped.
	const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
	if (lam > 1) {
		rx *= Math.sqrt(lam);
		ry *= Math.sqrt(lam);
	}
	const sign = large === sweep ? -1 : 1;
	const numer = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
	const denom = rx * rx * yp * yp + ry * ry * xp * xp;
	const co = sign * Math.sqrt(Math.max(0, numer / denom));
	const cxp = (co * rx * yp) / ry;
	const cyp = (-co * ry * xp) / rx;
	const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
	const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
	const angle = (ux: number, uy: number, vx: number, vy: number) =>
		Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
	const t0 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
	let dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
	if (!sweep && dt > 0) dt -= 2 * Math.PI;
	if (sweep && dt < 0) dt += 2 * Math.PI;
	const n = segs(Math.abs(dt) * Math.max(rx, ry));
	return Array.from({ length: n }, (_, i): Pt => {
		const t = t0 + (dt * (i + 1)) / n;
		const ex = rx * Math.cos(t);
		const ey = ry * Math.sin(t);
		return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
	});
}

function pathLines(d: string): Pt[][] {
	const tok = d.match(TOKEN) ?? [];
	const lines: Pt[][] = [];
	let run: Pt[] = [];
	let x = 0;
	let y = 0;
	let sx = 0;
	let sy = 0;
	// The last cubic control point, for S's reflection. Null after any other
	// command, which is what makes a bare S use the current point.
	let ctrl: Pt | null = null;
	let cmd = '';
	let i = 0;
	const flush = () => {
		if (run.length > 1) lines.push(run);
		run = [];
	};
	const next = () => Number(tok[i++]);
	while (i < tok.length) {
		if (/[a-z]/i.test(tok[i])) cmd = tok[i++];
		const rel = cmd === cmd.toLowerCase();
		const ox = rel ? x : 0;
		const oy = rel ? y : 0;
		switch (cmd.toUpperCase()) {
			case 'M': {
				flush();
				x = ox + next();
				y = oy + next();
				sx = x;
				sy = y;
				run = [[x, y]];
				// Pairs after the first are an implicit lineto, in the same case.
				cmd = rel ? 'l' : 'L';
				ctrl = null;
				break;
			}
			case 'L':
				x = ox + next();
				y = oy + next();
				run.push([x, y]);
				ctrl = null;
				break;
			case 'H':
				x = ox + next();
				run.push([x, y]);
				ctrl = null;
				break;
			case 'V':
				y = oy + next();
				run.push([x, y]);
				ctrl = null;
				break;
			case 'C':
			case 'S': {
				const [c1x, c1y]: Pt =
					cmd.toUpperCase() === 'S'
						? ctrl
							? [2 * x - ctrl[0], 2 * y - ctrl[1]]
							: [x, y]
						: [ox + next(), oy + next()];
				const c2x = ox + next();
				const c2y = oy + next();
				const ex = ox + next();
				const ey = oy + next();
				const n = segs(
					curveLen([x, y], [c1x, c1y], [c2x, c2y], [ex, ey]),
				);
				for (let k = 1; k <= n; k++) {
					const t = k / n;
					const u = 1 - t;
					run.push([
						u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
						u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey,
					]);
				}
				ctrl = [c2x, c2y];
				x = ex;
				y = ey;
				break;
			}
			case 'Q': {
				const qx = ox + next();
				const qy = oy + next();
				const ex = ox + next();
				const ey = oy + next();
				const n = segs(curveLen([x, y], [qx, qy], [ex, ey]));
				for (let k = 1; k <= n; k++) {
					const t = k / n;
					const u = 1 - t;
					run.push([u * u * x + 2 * u * t * qx + t * t * ex, u * u * y + 2 * u * t * qy + t * t * ey]);
				}
				x = ex;
				y = ey;
				ctrl = null;
				break;
			}
			case 'A': {
				const rx = next();
				const ry = next();
				const rot = next();
				const large = next();
				const sweep = next();
				const ex = ox + next();
				const ey = oy + next();
				run.push(...arcPoints(x, y, rx, ry, rot, large, sweep, ex, ey));
				x = ex;
				y = ey;
				ctrl = null;
				break;
			}
			case 'Z':
				run.push([sx, sy]);
				flush();
				x = sx;
				y = sy;
				// A drawing command straight after Z continues from the start point.
				run = [[x, y]];
				ctrl = null;
				break;
			default:
				// Outside the vocabulary above. Skip the token rather than loop.
				i++;
		}
	}
	flush();
	return lines;
}

/** The strokes and dots an icon's inner markup draws, in its 24×24 units. */
export function glyphStrokes(markup: string): GlyphStrokes {
	const lines: Pt[][] = [];
	const dots: GlyphStrokes['dots'] = [];
	for (const [, tag, src] of markup.matchAll(ELEMENT)) {
		const a = attrs(src);
		const filled = a.fill !== undefined && a.fill !== 'none';
		if (tag === 'path') lines.push(...pathLines(a.d ?? ''));
		else if (tag === 'circle') {
			const cx = num(a.cx);
			const cy = num(a.cy);
			const r = num(a.r);
			if (filled) dots.push({ x: cx, y: cy, r });
			else lines.push(ellipseRing(cx, cy, r, r));
		} else if (tag === 'ellipse') {
			lines.push(ellipseRing(num(a.cx), num(a.cy), num(a.rx), num(a.ry)));
		} else if (tag === 'rect') {
			const rx = num(a.rx, num(a.ry));
			const ry = num(a.ry, rx);
			lines.push(rectRing(num(a.x), num(a.y), num(a.width), num(a.height), rx, ry));
		}
	}
	return { lines, dots };
}
