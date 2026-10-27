// ── Where a walker can go ────────────────────────────────────────────────────
// A grid over the floor, blocked wherever a hull the walker collides with
// stands between step height and head height, widened by the walker's own
// half-width — the same hulls and the same body a player bumps into, so a route
// cannot pass where a player could not. scripts/gen-office-nav.mjs bakes the
// grid for the office engine, which walks its bots on it with this search
// ported to Go (internal/breach/office/nav.go).
//
// Pure: no GL, no Svelte.
import type { World } from 'showcase';

/** Metres per cell. Fine enough for a 1.6 m doorway to stay open after the
 *  walker's width is taken off both jambs. */
export const CELL = 0.25;

export interface NavGrid {
	x0: number;
	z0: number;
	cols: number;
	rows: number;
	blocked: Uint8Array;
}

export interface Point2 {
	x: number;
	z: number;
}

/** `half` is the walker's half-extents, `step` the tallest thing it walks up. */
export function navGrid(world: World, half: { x: number; y: number; z: number }, step: number): NavGrid {
	const { min, max } = world.bounds;
	const cols = Math.ceil((max.x - min.x) / CELL);
	const rows = Math.ceil((max.z - min.z) / CELL);
	const blocked = new Uint8Array(cols * rows);
	const block = (x0: number, x1: number, z0: number, z1: number) => {
		const c0 = Math.max(0, Math.floor((x0 - min.x) / CELL));
		const c1 = Math.min(cols - 1, Math.floor((x1 - min.x) / CELL));
		const r0 = Math.max(0, Math.floor((z0 - min.z) / CELL));
		const r1 = Math.min(rows - 1, Math.floor((z1 - min.z) / CELL));
		for (let r = r0; r <= r1; r++) blocked.fill(1, r * cols + c0, r * cols + c1 + 1);
	};
	for (const h of world.hulls) {
		if (h.max.y <= world.groundY + step || h.min.y >= world.groundY + half.y * 2) continue;
		block(h.min.x - half.x, h.max.x + half.x, h.min.z - half.z, h.max.z + half.z);
	}
	// The outer walls, which the walker meets as bounds rather than hulls.
	block(min.x - 1, min.x + half.x, min.z - 1, max.z + 1);
	block(max.x - half.x, max.x + 1, min.z - 1, max.z + 1);
	block(min.x - 1, max.x + 1, min.z - 1, min.z + half.z);
	block(min.x - 1, max.x + 1, max.z - half.z, max.z + 1);
	return { x0: min.x, z0: min.z, cols, rows, blocked };
}

const cellOf = (g: NavGrid, p: Point2) => [
	Math.min(g.cols - 1, Math.max(0, Math.floor((p.x - g.x0) / CELL))),
	Math.min(g.rows - 1, Math.max(0, Math.floor((p.z - g.z0) / CELL)))
];
const centre = (g: NavGrid, i: number): Point2 => ({
	x: g.x0 + ((i % g.cols) + 0.5) * CELL,
	z: g.z0 + (Math.floor(i / g.cols) + 0.5) * CELL
});

/** The nearest open cell to `p`, ring by ring: a station stands at a desk, and
 *  the desk is solid. Of the open cells within two rings of the first, the one
 *  nearest `toward`, so a bot stops on the side of the desk it came from rather
 *  than walking round to the other; two, because a solid's edge rounds to a
 *  cell differently on each side. -1 when nothing is open within reach. */
function nearestOpen(g: NavGrid, p: Point2, toward = p): number {
	const [c, r] = cellOf(g, p);
	let best = -1, bestD = Infinity, last = 24;
	for (let k = 0; k < last; k++) {
		for (let dr = -k; dr <= k; dr++)
			for (let dc = -k; dc <= k; dc++) {
				if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
				const cc = c + dc, rr = r + dr;
				if (cc < 0 || rr < 0 || cc >= g.cols || rr >= g.rows || g.blocked[rr * g.cols + cc]) continue;
				const at = centre(g, rr * g.cols + cc), d = Math.hypot(at.x - toward.x, at.z - toward.z);
				if (d < bestD) [best, bestD] = [rr * g.cols + cc, d];
			}
		if (best >= 0 && last === 24) last = Math.min(24, k + 3);
	}
	return best;
}

/** Whether a straight walk from a to b crosses only open cells. */
function clear(g: NavGrid, a: Point2, b: Point2): boolean {
	const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL / 2));
	for (let i = 1; i < n; i++) {
		const [c, r] = cellOf(g, { x: a.x + ((b.x - a.x) * i) / n, z: a.z + ((b.z - a.z) * i) / n });
		if (g.blocked[r * g.cols + c]) return false;
	}
	return true;
}

/** Waypoints from `from` to the open floor nearest `to`, not including `from`.
 *  A* over 8 neighbours, never cutting a blocked corner, then pulled straight
 *  wherever the floor between two waypoints is open. Null when there is no way
 *  through. */
export function route(g: NavGrid, from: Point2, to: Point2): Point2[] | null {
	const start = nearestOpen(g, from), goal = nearestOpen(g, to, from);
	if (start < 0 || goal < 0) return null;
	const n = g.cols * g.rows;
	const cost = new Float32Array(n).fill(Infinity);
	const came = new Int32Array(n).fill(-1);
	const done = new Uint8Array(n);
	const gc = goal % g.cols, gr = Math.floor(goal / g.cols);
	const guess = (i: number) => {
		const dx = Math.abs((i % g.cols) - gc), dz = Math.abs(Math.floor(i / g.cols) - gr);
		return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
	};
	// A binary heap of [priority, cell].
	const heap: [number, number][] = [];
	const push = (f: number, i: number) => {
		heap.push([f, i]);
		for (let k = heap.length - 1; k > 0; ) {
			const p = (k - 1) >> 1;
			if (heap[p][0] <= heap[k][0]) break;
			[heap[p], heap[k]] = [heap[k], heap[p]];
			k = p;
		}
	};
	const pop = () => {
		const top = heap[0], last = heap.pop()!;
		if (heap.length) {
			heap[0] = last;
			for (let k = 0; ; ) {
				const l = 2 * k + 1, r = l + 1;
				let m = k;
				if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
				if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
				if (m === k) break;
				[heap[m], heap[k]] = [heap[k], heap[m]];
				k = m;
			}
		}
		return top[1];
	};
	cost[start] = 0;
	push(guess(start), start);
	while (heap.length) {
		const i = pop();
		if (i === goal) break;
		if (done[i]) continue;
		done[i] = 1;
		const c = i % g.cols, r = Math.floor(i / g.cols);
		for (let dr = -1; dr <= 1; dr++)
			for (let dc = -1; dc <= 1; dc++) {
				if (!dr && !dc) continue;
				const cc = c + dc, rr = r + dr;
				if (cc < 0 || rr < 0 || cc >= g.cols || rr >= g.rows) continue;
				const j = rr * g.cols + cc;
				if (g.blocked[j] || done[j]) continue;
				if (dr && dc && (g.blocked[r * g.cols + cc] || g.blocked[rr * g.cols + c])) continue;
				const next = cost[i] + (dr && dc ? Math.SQRT2 : 1);
				if (next < cost[j]) {
					cost[j] = next;
					came[j] = i;
					push(next + guess(j), j);
				}
			}
	}
	if (start !== goal && came[goal] < 0) return null;
	const cells: Point2[] = [];
	for (let i = goal; i !== start; i = came[i]) cells.push(centre(g, i));
	cells.reverse();
	const out: Point2[] = [];
	let at = from;
	for (let k = 0; k < cells.length; ) {
		let far = k;
		while (far + 1 < cells.length && clear(g, at, cells[far + 1])) far++;
		out.push(cells[far]);
		at = cells[far];
		k = far + 1;
	}
	return out;
}
