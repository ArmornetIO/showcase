// ── character · what a figure needs to be drawn ──────────────────────────────
// The smallest thing `Figure` can render: a name to label it, a colour to plate
// it, and a build to shape it. Deliberately NOT the breach `Klass` — a class in
// that game also carries a seat, a resource, four skills and a passive, none of
// which the renderer has any use for. A studio that wanted to show a figure
// would otherwise have to invent a fake seat to do it.

export type Shape = 'runner' | 'brute' | 'drone' | 'ghost';

export interface CharacterSkin {
	/** Stable id — the render cache is keyed on it. */
	key: string;
	name: string;
	/** Hex, `#rrggbb`. Spent on plate and the visor, never on the suit. */
	color: string;
	shape: Shape;
}

/** The four that exist. Anything richer (breach's roster) supplies these fields
 *  and is accepted anywhere a skin is. */
export const CHARACTERS: CharacterSkin[] = [
	{ key: 'maintainer', name: 'The Maintainer', color: '#F472B6', shape: 'runner' },
	{ key: 'state', name: 'The Handler', color: '#FB923C', shape: 'ghost' },
	{ key: 'architect', name: 'The Architect', color: '#38BDF8', shape: 'brute' },
	{ key: 'hunter', name: 'The Threat Hunter', color: '#34D399', shape: 'drone' }
];

/** What each build is FOR, in one line — the studio's only editorial content. */
export const SHAPE_NOTE: Record<Shape, string> = {
	runner: 'The baseline. Everything else is this with something pushed.',
	brute: 'Widened and squashed onto short legs, so the weight sits low.',
	drone: 'No legs. It ends in a bell and hovers — not a person.',
	ghost: 'Narrow and hooded: no gap of light through the silhouette.'
};
