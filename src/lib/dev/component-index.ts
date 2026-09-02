import routeMap from '$lib/generated/route-map.json' with { type: 'json' };

/**
 * The component index, built from what is actually routable.
 *
 * The list this replaced was hand-maintained and had drifted both ways: it
 * linked `/edges`, `/svg-fx` and `/roadmap`, which 404, and omitted six pages
 * that exist. Vite resolves `import.meta.glob` at build time against the real
 * filesystem, so a section can only appear here if its page is on disk — a
 * dead link is no longer expressible.
 *
 * What each page *contains* comes from `generated/route-map.json`
 * (`npm run gen:api`), which parses the components each `+page.svelte`
 * imports. A route the generator has not seen yet still lists, with its blurb.
 */

// Only the paths are read — the pages themselves are never imported.
const pages = import.meta.glob('/src/routes/*/+page.svelte');

const components = routeMap as Record<string, string[]>;

/** Pages that are part of the shell rather than exhibits of the library. */
const HIDDEN = new Set(['overview']);

/** Labels the slug cannot produce, and blurbs for pages with no component list. */
const META: Record<string, { label?: string; note?: string }> = {
	'alert-blade': { label: 'AlertBlade' },
	backdrop: { label: 'Backdrop' },
	brand: { note: 'The mark forging itself — the title scene and every layer it is made of' },
	builder: { note: 'Drag-and-drop canvas builder with live AI generation' },
	compare: { label: 'Compare', note: 'Side-by-side mockup comparison with preference voting' },
	'design-patterns': { label: 'Design Patterns', note: 'The rules this interface is built on' },
	dev: { note: 'DevCog feature-flag panel' },
	entity: { label: 'Entity detail' },
	frames: { label: 'ItemFrames' },
	icons: { note: 'Lucide icon set, inlined SVG' },
	'model-explorer': { label: 'Model Explorer' },
	'node-drawer': { label: 'NodeDrawer' },
	theme: { note: 'ThemePicker + design token swatches' },
	toolbar: { label: 'IconToolbar' }
};

export interface IndexEntry {
	slug: string;
	href: string;
	label: string;
	components: string[];
	note?: string;
}

/** `node-drawer` → `Node Drawer`. */
function titleCase(slug: string): string {
	return slug
		.split('-')
		.filter(Boolean)
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join(' ');
}

function slugsOnDisk(): string[] {
	return Object.keys(pages)
		.map((path) => path.split('/routes/')[1]?.split('/')[0] ?? '')
		.filter((slug) => slug && !HIDDEN.has(slug))
		.sort();
}

export function componentIndex(): IndexEntry[] {
	return slugsOnDisk().map((slug) => {
		const meta = META[slug] ?? {};
		// `Icon` is imported by most pages as chrome rather than as the thing on
		// display, so listing it everywhere buries what the page is actually for.
		const listed = (components[`/${slug}`] ?? []).filter(
			(name) => name !== 'Icon' || slug === 'icons'
		);
		return {
			slug,
			href: `/${slug}`,
			label: meta.label ?? titleCase(slug),
			components: listed,
			note: meta.note
		};
	});
}
