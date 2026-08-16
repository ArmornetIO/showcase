import type { NavSection } from '$lib/layout/SidebarNav.svelte';
import type { IconName } from '$lib/icons/Icon.svelte';

/**
 * Builds the sidebar's mockup sections from whatever is actually on disk.
 *
 * Mockups are gitignored — they are local sketches, not library surface — so the
 * set differs per machine and a hardcoded list would be a wall of dead links on
 * a fresh clone. Vite resolves `import.meta.glob` at build time against the real
 * filesystem, which makes "what exists here" the single source of truth.
 *
 * Labels come from the equally-ignored `routes/mockups/nav.ts` when it is there.
 * Without it, a slug is title-cased — good enough to click, and it means a
 * mockup someone drops in never has to be registered anywhere to show up.
 */

const DEFAULT_SECTION = 'Mockups';
const DEFAULT_ICON: IconName = 'layout-template';

interface MockupMeta {
	label: string;
	icon: IconName;
	section?: string;
}

// Eager because this runs once to build a nav, and the modules are tiny. The
// `+page.svelte` files themselves are NOT imported — only their paths are read.
const pages = import.meta.glob('/src/routes/mockups/*/+page.svelte');
const navMeta = import.meta.glob<{ MOCKUP_NAV?: Record<string, MockupMeta> }>(
	'/src/routes/mockups/nav.ts',
	{ eager: true }
);

/** `mesh-nav-tree` → `Mesh Nav Tree`. */
function titleCase(slug: string): string {
	return slug
		.split('-')
		.filter(Boolean)
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join(' ');
}

function slugsOnDisk(): string[] {
	return Object.keys(pages)
		.map((path) => path.split('/mockups/')[1]?.split('/')[0] ?? '')
		.filter(Boolean)
		.sort();
}

function meta(): Record<string, MockupMeta> {
	const mod = Object.values(navMeta)[0];
	return mod?.MOCKUP_NAV ?? {};
}

/**
 * The mockup nav sections, in the order the labels file implies: sections appear
 * as they are first encountered, so moving an entry between sections in
 * `nav.ts` is the only thing that reorders the sidebar.
 */
export function mockupSections(base: string): NavSection[] {
	const labels = meta();
	const sections = new Map<string, NavSection>();

	for (const slug of slugsOnDisk()) {
		const m = labels[slug];
		const title = m?.section ?? DEFAULT_SECTION;
		if (!sections.has(title)) sections.set(title, { title, items: [] });
		sections.get(title)!.items.push({
			label: m?.label ?? titleCase(slug),
			href: `${base}/mockups/${slug}`,
			icon: m?.icon ?? DEFAULT_ICON
		});
	}

	// Keep the default section first — the named ones read as refinements of it.
	return [...sections.values()].sort((a, b) =>
		a.title === DEFAULT_SECTION ? -1 : b.title === DEFAULT_SECTION ? 1 : 0
	);
}
