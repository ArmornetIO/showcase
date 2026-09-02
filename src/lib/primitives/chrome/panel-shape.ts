// ── Panel shapes, as data ────────────────────────────────────────────────────
// `shape` is nothing but a class on `.panel` — every shape is CSS keyed off it,
// and none of it reaches the component's state. That is what lets the QA
// inspector re-shape a card that is already on screen without the page knowing:
// swap the class, get the shape.
//
// The tables live here rather than in `Panel.svelte` because two things now
// derive the same class set from a shape — the component at render, the
// inspector at runtime — and a second copy of these lists is a copy that will
// disagree the first time a shape is added.

/**
 * How the header and the card's OUTLINE are related to each other.
 *
 * Not decoration. `default` — a rounded rectangle with a rule near the top — is
 * the right answer for most cards, and it is also the reason a product full of
 * cards reads as one card repeated: the header and the edge are two unrelated
 * facts stacked on each other. These give the header a say in the shape, and
 * each one means something before a word of it is read.
 */
export type PanelShape =
	| 'default'
	| 'tab'
	| 'legend'
	| 'notch'
	| 'chamfer'
	| 'bracket'
	| 'spine'
	| 'split'
	| 'ticket'
	| 'cap'
	| 'rule'
	| 'pill'
	| 'slant';

export interface PanelShapeMeta {
	value: PanelShape;
	label: string;
	/** What the shape SAYS, not what it looks like — the reason to pick it. */
	description: string;
}

/** Every shape, in the order the inspector steps through them. */
export const PANEL_SHAPES: readonly PanelShapeMeta[] = [
	{
		value: 'default',
		label: 'Default',
		description: 'Rounded rectangle, rule under the header. Right for most cards.'
	},
	{
		value: 'tab',
		label: 'Tab',
		description: 'One of several, even shown alone — the outline breaks for it.'
	},
	{
		value: 'legend',
		label: 'Legend',
		description: 'A named box rather than a labelled one; the title knocks out the border.'
	},
	{ value: 'notch', label: 'Notch', description: 'The card is cut to admit the header.' },
	{ value: 'chamfer', label: 'Chamfer', description: 'A plate, not a sheet.' },
	{
		value: 'bracket',
		label: 'Bracket',
		description: 'A reticle — four corners imply the outline.'
	},
	{
		value: 'spine',
		label: 'Spine',
		description: 'The header is the binding; the body keeps the full width.'
	},
	{ value: 'split', label: 'Split', description: 'Two objects, one owning the other.' },
	{ value: 'ticket', label: 'Ticket', description: 'A stub you tear off.' },
	{ value: 'cap', label: 'Cap', description: 'A lid the body hangs under.' },
	{ value: 'rule', label: 'Rule', description: 'The lightest a card gets and still is one.' },
	{
		value: 'pill',
		label: 'Pill',
		description: 'A marker pinned to the card rather than part of it.'
	},
	{
		value: 'slant',
		label: 'Slant',
		description: 'One non-level edge, so a stack stops reading as a table.'
	}
];

export const PANEL_SHAPE_VALUES: readonly PanelShape[] = PANEL_SHAPES.map((s) => s.value);

export function isPanelShape(v: unknown): v is PanelShape {
	return PANEL_SHAPE_VALUES.includes(v as PanelShape);
}

/**
 * Shapes that put something ABOVE or OUTSIDE the card's own box — a tab, a
 * legend, a pill, the ticket's bitten edges. Clipping to the rounded corners
 * would cut every one of them off.
 */
const OVERFLOW_SHAPES: readonly PanelShape[] = [
	'tab',
	'legend',
	'pill',
	'ticket',
	'split',
	'bracket',
	'rule'
];

/** Shapes that redraw the outline themselves, so the default one is taken away. */
const OUTLINE_SHAPES: readonly PanelShape[] = ['bracket', 'split', 'rule'];

/**
 * `clip-path` cannot carry a border, so these draw their outline as a clipped
 * layer behind a clipped fill. That fill is a flat token: the shape opts out of
 * the glass surface, because two stacked clipped layers cannot also be a
 * backdrop filter.
 */
const CLIPPED_SHAPES: readonly PanelShape[] = ['notch', 'chamfer'];

export function shapeOverflows(shape: PanelShape): boolean {
	return OVERFLOW_SHAPES.includes(shape);
}

/** True when the shape supplies its own outline and must not wear the default. */
export function shapeIsBare(shape: PanelShape): boolean {
	return CLIPPED_SHAPES.includes(shape) || OUTLINE_SHAPES.includes(shape);
}

/** True when the shape trades the glass surface for a flat fill. See above. */
export function shapeIsFlat(shape: PanelShape): boolean {
	return CLIPPED_SHAPES.includes(shape);
}

/**
 * The classes a shape contributes, as one list.
 *
 * `allowOverflow` and `cls` stay the caller's business; this covers only what
 * the shape itself decides, which is exactly the set the inspector has to swap.
 */
export function panelShapeClasses(shape: PanelShape, allowOverflow = false): string[] {
	const out = [`shape-${shape}`];
	out.push(shapeIsBare(shape) ? 'is-bare' : 'glass', ...(shapeIsBare(shape) ? [] : ['r-surface']));
	out.push(allowOverflow || shapeOverflows(shape) ? 'overflow-visible' : 'overflow-hidden');
	return out;
}

/** Every class any shape could have put on an element — what to strip first. */
function allShapeClasses(): string[] {
	const out = new Set<string>(['is-bare', 'glass', 'r-surface', 'overflow-visible', 'overflow-hidden']);
	for (const s of PANEL_SHAPE_VALUES) out.add(`shape-${s}`);
	return [...out];
}

/**
 * Re-shape a `.panel` element that is already on the page.
 *
 * Returns false when the element is not a panel, so a caller that got a click
 * on the wrong thing finds out rather than silently doing nothing.
 *
 * `allowOverflow` is read off the element's current state rather than passed:
 * whatever the page decided about escaping content is not the inspector's call
 * to overturn.
 */
export function applyPanelShape(el: Element | null | undefined, shape: PanelShape): boolean {
	if (!el || !el.classList.contains('panel')) return false;
	const allowOverflow = el.getAttribute('data-allow-overflow') === 'true';
	el.classList.remove(...allShapeClasses());
	el.classList.add(...panelShapeClasses(shape, allowOverflow));
	return true;
}

/** The shape an element is currently wearing. `default` when it says nothing. */
export function readPanelShape(el: Element): PanelShape {
	for (const s of PANEL_SHAPE_VALUES) if (el.classList.contains(`shape-${s}`)) return s;
	return 'default';
}
