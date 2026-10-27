// The default Insider Threat map's walkable floor, as the office engine reads
// it (internal/breach/office/nav.go). The engine walks its bots on this, so a
// bot goes where a player could and is where every client draws it.
import { composeMap } from 'showcase';
import { MAPS } from '../examples/breach/insider/maps.js';
import { navGrid, CELL } from '../examples/breach/insider/nav.js';
import { WALKER_DEFAULTS } from '../src/lib/physics/walker.js';

/** Seed 1: what every non-dev session composes (InsiderThreat.svelte). */
export function bake(): string {
	const g = navGrid(composeMap(MAPS[0], 1).world, WALKER_DEFAULTS.half, WALKER_DEFAULTS.stepHeight);
	const bits = new Uint8Array(Math.ceil(g.blocked.length / 8));
	g.blocked.forEach((b, i) => {
		if (b) bits[i >> 3] |= 1 << (i & 7);
	});
	const nav = {
		map: MAPS[0].id,
		cell: CELL,
		x0: g.x0,
		z0: g.z0,
		cols: g.cols,
		rows: g.rows,
		walk: WALKER_DEFAULTS.walkSpeed,
		blocked: Buffer.from(bits).toString('base64')
	};
	return JSON.stringify(nav);
}
