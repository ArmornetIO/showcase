// ── The settlement — every building, and which mode lives in which ───────────
// Three files author the shapes; this one is where they become a single place.
//
// The split is by WHO BUILT THEM, and that is worth keeping rather than tidying
// into one file: each catalogue was designed as an internally consistent set —
// shared plinth, shared roof vocabulary, one break through the top silhouette
// each — and a set is easier to hold coherent when it is written and reviewed
// as a set. `pieces.ts` keeps the primitives every catalogue is built from, so
// the dependency runs one way and there is no cycle to reason about.
//
// The mode→building map lives HERE and not beside the shapes, because it is the
// one fact none of the three files can know on its own: it is a statement about
// the whole settlement — that no two modes stand in the same building, and that
// every mode stands in one.
import { PIECES, type Piece } from './pieces.js';
import { WORKS_PIECES, WORKS_MODE_PIECES } from './pieces-works.js';
import { CIVIC_PIECES, CIVIC_MODE_PIECES } from './pieces-civic.js';

/** Every building in the settlement, by shape name. */
export const ALL_PIECES: Record<string, Piece> = {
	...PIECES,
	...WORKS_PIECES,
	...CIVIC_PIECES
};

/** Which building each agent mode stands as.
 *
 *  This is the channel that lets the globe stop colour-coding modes. A mode's
 *  identity is carried by the SHAPE of the thing standing on its plot, which
 *  survives being drawn in one hue, at any zoom, from any bearing — none of
 *  which a tint does. So the map has to be total: a mode with no building falls
 *  back to a disc, and a disc has no identity at all once the palette collapses.
 *  `piece-catalogue.spec.ts` fails if one is missing. */
export const MODE_PIECES: Record<string, string> = {
	// The two originals, from `pieces.ts`. Where packages come from, and the
	// third-party production the platform is getting assurance over.
	supply_chain_proxy: 'house',
	vendor_management: 'factory',
	...WORKS_MODE_PIECES,
	...CIVIC_MODE_PIECES
};

/** The building a mode stands in, or undefined if it has none yet. */
export function pieceForMode(mode: string): Piece | undefined {
	const id = MODE_PIECES[mode];
	return id ? ALL_PIECES[id] : undefined;
}
