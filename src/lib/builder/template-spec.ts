import { REGISTRY_MAP } from './registry.js';

/**
 * Template regions — what a piece of a page IS, declared in typed source.
 *
 * The builder-template generator (armornet's scripts/gen-templates.mjs) reads a
 * rendered app-ui page back to the showcase components that drew it. Markup a
 * page hand-rolls has no component behind it, so it exports as nothing; and a
 * component that IS found still lands with registry defaults, because its real
 * props were expressions the generator cannot evaluate.
 *
 * A region fills both gaps by SPLITTING the problem along the line that
 * actually exists:
 *
 *   geometry  — only the browser knows it. The page marks the element with a
 *               `data-tpl="<key>"` anchor and the capture measures its box.
 *   props     — only the source knows them, and they are values, not text. They
 *               live here, in a module the generator imports, so they are
 *               ordinary typed objects that can reference the same sample data
 *               the screen renders from.
 *
 * The earlier version serialized props into the anchor attribute and parsed
 * them back out. That worked and was wrong: a JSON round-trip through the DOM
 * between two TypeScript packages we both own, untyped at every hop, failing as
 * a script warning rather than a compile error.
 */
export interface TemplateRegion {
	/** Registry id to place — `DataTable`, `StatStrip`, … */
	component: string;
	/**
	 * Prop overrides, as VALUES. A prop the registry stores as JSON text (a
	 * table's `columns`, a strip's `items`) is written here as the array it
	 * means; the generator serializes it on the way into the template.
	 */
	props?: Record<string, unknown>;
}

/** Anchor key → region, keyed by whatever the page's `data-tpl` says. */
export type TemplateRegions = Record<string, TemplateRegion>;

/**
 * Declare a page's regions.
 *
 * Registry ids cannot be a union type — REGISTRY is `ComponentMeta[]`, so every
 * `id` widens to `string` — which leaves this the only place a typo can be
 * caught. It throws rather than warns: the module is imported by the page's own
 * dev build, so a bad component id or prop name surfaces where it was written
 * instead of as a line in a generator log nobody is reading.
 */
export function defineRegions<T extends TemplateRegions>(regions: T): T {
	for (const [key, region] of Object.entries(regions)) {
		const meta = REGISTRY_MAP.get(region.component);
		if (!meta) {
			throw new Error(`template region "${key}": no component "${region.component}" in the registry`);
		}
		if (!meta.placeable) {
			throw new Error(`template region "${key}": ${region.component} is not placeable`);
		}
		for (const prop of Object.keys(region.props ?? {})) {
			if (!meta.props[prop]) {
				throw new Error(`template region "${key}": ${region.component} has no prop "${prop}"`);
			}
		}
	}
	return regions;
}
