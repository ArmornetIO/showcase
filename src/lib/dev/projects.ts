import type { NavItem, NavSection } from '$lib/navigation/SidebarNav.svelte';
import type { IconName } from '$lib/icons/Icon.svelte';

/**
 * The sidebar's Projects tree, built from whatever is actually on disk.
 *
 * A PROJECT is a body of in-progress design work — the mockups for one feature,
 * plus any storyboards that read those mockups in order. It is deliberately not
 * a library concept: `Foundations`, `Atoms` and the rest below it exhibit what
 * the library ships, while a project is the sketching that happens before
 * anything ships at all. That is why Projects sits first and alone.
 *
 * Mockups are gitignored — local sketches, not library surface — so the set
 * differs per machine and a hardcoded list would be a wall of dead links on a
 * fresh clone. Vite resolves `import.meta.glob` at build time against the real
 * filesystem, which makes "what exists here" the single source of truth.
 *
 * Labels, project membership and storyboards all come from the equally-ignored
 * `routes/mockups/nav.ts` when it is there. Without it every mockup lands in the
 * default project under a title-cased slug — good enough to click, and it means
 * a mockup someone drops in never has to be registered anywhere to show up.
 */

const DEFAULT_PROJECT = 'Mockups';
const MOCKUP_ICON: IconName = 'layout-template';
const PROJECT_ICON: IconName = 'package';
const STORYBOARD_ICON: IconName = 'layers';

interface MockupMeta {
	label: string;
	icon: IconName;
	/** Which project it belongs to. `section` is the pre-Projects spelling and is
	 *  still honoured, so an existing local nav.ts keeps working untouched. */
	project?: string;
	section?: string;
}

/** An ordered reading of a project's mockups — the flow, not the screens. */
interface StoryboardMeta {
	label: string;
	project?: string;
	icon?: IconName;
	/** Mockup slugs, in the order the story runs. A slug with no mockup on disk
	 *  is dropped rather than linked: a storyboard outlives the sketches it was
	 *  written against, and a dead frame is worse than a short board. */
	frames: string[];
}

// Eager because this runs once to build a nav, and the modules are tiny. The
// `+page.svelte` files themselves are NOT imported — only their paths are read.
const pages = import.meta.glob('/src/routes/mockups/*/+page.svelte');
const navMeta = import.meta.glob<{
	MOCKUP_NAV?: Record<string, MockupMeta>;
	MOCKUP_STORYBOARDS?: StoryboardMeta[];
}>('/src/routes/mockups/nav.ts', { eager: true });

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

function meta() {
	const mod = Object.values(navMeta)[0];
	return {
		labels: mod?.MOCKUP_NAV ?? {},
		storyboards: mod?.MOCKUP_STORYBOARDS ?? []
	};
}

/**
 * One nav section — `Projects` — holding one expandable row per project.
 *
 * Two levels rather than a section per project: the sidebar already spends nine
 * sections on the library, and a machine with four features in flight would push
 * everything else below the fold. Collapsed projects cost one row each.
 */
export function projectSections(base: string): NavSection[] {
	const { labels, storyboards } = meta();
	const href = (slug: string) => `${base}/mockups/${slug}`;
	const label = (slug: string) => labels[slug]?.label ?? titleCase(slug);

	const onDisk = new Set(slugsOnDisk());
	const projects = new Map<string, { boards: NavItem[]; mockups: NavItem[] }>();
	const project = (name: string) => {
		if (!projects.has(name)) projects.set(name, { boards: [], mockups: [] });
		return projects.get(name)!;
	};

	// The default project always exists, so an empty machine still shows the row
	// the nav is described by rather than a Projects section with nothing in it.
	project(DEFAULT_PROJECT);

	for (const board of storyboards) {
		const frames = board.frames.filter((slug) => onDisk.has(slug));
		if (!frames.length) continue;
		project(board.project ?? DEFAULT_PROJECT).boards.push({
			label: board.label,
			icon: board.icon ?? STORYBOARD_ICON,
			children: frames.map((slug) => ({
				label: label(slug),
				href: href(slug),
				icon: labels[slug]?.icon ?? MOCKUP_ICON
			}))
		});
	}

	for (const slug of onDisk) {
		const m = labels[slug];
		project(m?.project ?? m?.section ?? DEFAULT_PROJECT).mockups.push({
			label: label(slug),
			href: href(slug),
			icon: m?.icon ?? MOCKUP_ICON
		});
	}

	// Storyboards before loose mockups: a board is the reading order for the
	// screens under it, so it belongs above the pile it organises.
	const items: NavItem[] = [...projects.entries()]
		.sort(([a], [b]) => (a === DEFAULT_PROJECT ? -1 : b === DEFAULT_PROJECT ? 1 : a.localeCompare(b)))
		.map(([name, { boards, mockups }]) => ({
			label: name,
			icon: name === DEFAULT_PROJECT ? MOCKUP_ICON : PROJECT_ICON,
			// The first project is the one you are almost always here for.
			defaultOpen: name === DEFAULT_PROJECT,
			children: [...boards, ...mockups]
		}));

	return [{ title: 'Projects', items }];
}
