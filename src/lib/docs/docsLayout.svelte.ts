import { readJson, writeJson, clearStored } from '../storage.js';

export type NavPos = 'left' | 'right' | 'hidden';
export type TocPos = 'left' | 'right' | 'hidden';
export type MetaPos = 'above' | 'below' | 'hidden';

export type LayoutConfig = {
	nav: NavPos;
	toc: TocPos;
	meta: MetaPos;
	breadcrumbs: boolean;
};

const DEFAULTS: LayoutConfig = {
	nav: 'left',
	toc: 'right',
	meta: 'above',
	breadcrumbs: true
};

const STORAGE_KEY = 'docs-layout';

const NAV: NavPos[] = ['left', 'right', 'hidden'];
const TOC: TocPos[] = ['left', 'right', 'hidden'];
const META: MetaPos[] = ['above', 'below', 'hidden'];

function revive(parsed: unknown): LayoutConfig {
	const p = (parsed ?? {}) as Partial<LayoutConfig>;
	return {
		nav: NAV.includes(p.nav as NavPos) ? (p.nav as NavPos) : DEFAULTS.nav,
		toc: TOC.includes(p.toc as TocPos) ? (p.toc as TocPos) : DEFAULTS.toc,
		meta: META.includes(p.meta as MetaPos) ? (p.meta as MetaPos) : DEFAULTS.meta,
		breadcrumbs: typeof p.breadcrumbs === 'boolean' ? p.breadcrumbs : DEFAULTS.breadcrumbs
	};
}

/**
 * Where the docs shell puts its furniture — nav, table of contents, metadata
 * block, breadcrumbs. A reading preference, so it is remembered per browser.
 *
 * Named `docsLayout` rather than `layout`: a bare `layout` collides with
 * SvelteKit's own `+layout` vocabulary at every call site that imports it.
 */
class DocsLayout {
	#cfg = $state<LayoutConfig>({ ...DEFAULTS });
	#hydrated = false;

	get nav(): NavPos {
		return this.#cfg.nav;
	}

	get toc(): TocPos {
		return this.#cfg.toc;
	}

	get meta(): MetaPos {
		return this.#cfg.meta;
	}

	get breadcrumbs(): boolean {
		return this.#cfg.breadcrumbs;
	}

	/** Load the stored arrangement. Call from the docs shell on mount; idempotent. */
	hydrate(): void {
		if (this.#hydrated) return;
		this.#hydrated = true;
		this.#cfg = readJson(STORAGE_KEY, DEFAULTS, revive);
	}

	set(patch: Partial<LayoutConfig>): void {
		this.#cfg = { ...this.#cfg, ...patch };
		writeJson(STORAGE_KEY, this.#cfg);
	}

	reset(): void {
		this.#cfg = { ...DEFAULTS };
		clearStored(STORAGE_KEY);
	}
}

export const docsLayout = new DocsLayout();
