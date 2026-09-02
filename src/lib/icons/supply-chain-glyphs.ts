// ── Software-supply-chain glyphs ───────────────────────────────────────────
// 24×24, single-stroke, `currentColor` — the same contract as
// `mesh-studio/mode-tool-icons.ts`, so each one can be sampled into a node
// silhouette and inherits the node's colour and health treatment for free.
//
// These are deliberately STYLISED rather than faithful logo traces: at the size
// a package node occupies on a phone, a faithful mark turns to mud. Each glyph
// only has to survive the silhouette test — recognisable at 24px, in one stroke
// weight, with no fill.

export interface Ecosystem {
	key: string;
	/** Shown inside the node disc. */
	label: string;
	/** Registry host, used as the caption's supporting line. */
	host: string;
	/** Muted brand hue — recognisable as the ecosystem without fighting the
	 *  canvas palette, which is otherwise teal/violet/blue/green. */
	color: string;
	glyph: string;
}

/** The five ecosystems armornet actually proxies today. Keep this list in step
 *  with `agent/supply-chain/listener/` — the demo's whole claim is that these
 *  are real intercepts, not an illustration. */
export const ECOSYSTEMS: Ecosystem[] = [
	{
		key: 'npm',
		label: 'npm',
		host: 'registry.npmjs.org',
		color: '#E8615F',
		glyph: `<rect x="2" y="6.5" width="20" height="11" rx="1.6"/><path d="M5.6 17.2v-6.7h3.2v6.7M8.8 10.5H12v6.7M12 10.5h3.2v4.1M15.2 10.5h3.2v6.7"/>`,
	},
	{
		key: 'pypi',
		label: 'PyPI',
		host: 'pypi.org',
		color: '#6FA8DC',
		glyph: `<path d="M12 2.6c-2.9 0-3.8 1.1-3.8 2.7v2h3.9v.9H6.7c-1.7 0-3.2 1.1-3.2 4s1.4 4 3.1 4h1.3v-2.4c0-1.9 1.6-3.4 3.4-3.4h3.8c1.6 0 2.8-1.3 2.8-2.9V5.3c0-1.6-1.3-2.7-3.2-2.7z"/><circle cx="9.9" cy="5.3" r=".8" fill="currentColor" stroke="none"/><path d="M12 21.4c2.9 0 3.8-1.1 3.8-2.7v-2h-3.9v-.9h5.4c1.7 0 3.2-1.1 3.2-4s-1.4-4-3.1-4h-1.3v2.4c0 1.9-1.6 3.4-3.4 3.4H8.9c-1.6 0-2.8 1.3-2.8 2.9v3.2c0 1.6 1.3 2.7 3.2 2.7z"/><circle cx="14.1" cy="18.7" r=".8" fill="currentColor" stroke="none"/>`,
	},
	{
		key: 'go',
		label: 'Go',
		host: 'proxy.golang.org',
		color: '#5FD0E8',
		glyph: `<path d="M2.2 9.4h5M1.4 12h4.2M3 14.6h5"/><path d="M21.8 12A6.6 6.6 0 1 1 15.2 5.4"/><path d="M21.8 8.2V12h-3.8"/><circle cx="15.2" cy="12" r="1.5"/>`,
	},
	{
		key: 'docker',
		label: 'Docker',
		host: 'registry-1.docker.io',
		color: '#5AA9E6',
		glyph: `<path d="M3.2 11.6h3.1v3.1H3.2zM6.8 11.6h3.1v3.1H6.8zM10.4 11.6h3.1v3.1h-3.1zM6.8 8.1h3.1v3.1H6.8zM10.4 8.1h3.1v3.1h-3.1zM10.4 4.6h3.1v3.1h-3.1z"/><path d="M2 14.9c0 3.3 2.4 5.4 6.3 5.4 4.9 0 8.8-2.6 10.2-7.2 1.6.5 3.1-.4 3.1-.4-.9-1.5-2.5-1.7-3.5-1.4"/>`,
	},
	{
		key: 'git',
		label: 'Git',
		host: 'github.com',
		color: '#E8975F',
		glyph: `<circle cx="6" cy="6" r="2.1"/><circle cx="6" cy="18" r="2.1"/><circle cx="18" cy="12" r="2.1"/><path d="M6 8.1v7.8M8 17.1l8-3.9M8 6.9l8 3.9"/>`,
	},
];

export const ECOSYSTEM_BY_KEY: Record<string, Ecosystem> = Object.fromEntries(
	ECOSYSTEMS.map((e) => [e.key, e]),
);

/** A generic transitive dependency — the anonymous mass of the graph. */
export const PACKAGE_GLYPH = `<path d="M12 2.6 3.6 7v10l8.4 4.4L20.4 17V7z"/><path d="M3.6 7 12 11.4 20.4 7M12 11.4v10"/>`;

/** A dependency that changed hands: the same carton, with something live in it.
 *  Deliberately the package glyph plus one stroke — the point of the beat is
 *  that a compromised package looks like every other package. */
export const COMPROMISED_GLYPH = `<path d="M12 2.6 3.6 7v10l8.4 4.4L20.4 17V7z"/><path d="M3.6 7 12 11.4 20.4 7"/><path d="m13.6 9.2-3 4.9h3.2l-2.6 4.7"/>`;

/** The interception point — one per ecosystem proxy. */
export const PROXY_GLYPH = `<path d="M12 2.9 19.8 6v5.4c0 4.7-3.3 8-7.8 9.5-4.5-1.5-7.8-4.8-7.8-9.5V6z"/><path d="M8.6 12.1 11 14.6l4.7-4.9"/>`;

/** The crest at the centre. Kept in step with `icons/Icon.svelte`'s `crestlink`
 *  so the hub reads as the same mark it is everywhere else in the product —
 *  copied rather than imported because library `.ts` never imports `.svelte`. */
export const HUB_GLYPH = `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><circle cx="12" cy="11" r="1.3" fill="currentColor" stroke="none"/><path d="M12 11 8 8M12 11 16 8M12 11 8 14M12 11 16 14M12 11 12 16.5"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/><circle cx="12" cy="16.5" r="1"/>`;
