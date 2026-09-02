// ── Agent-mode & tool icon library ─────────────────────────────────────────
// Line-glyph icons (24×24, single stroke, currentColor) for the registered
// agent modes and the built-in tools (engine/registry.go).
// Shared by the icon gallery AND the mesh example (each icon can be sampled
// into a node silhouette — see custom-shapes.ts `sampleMarkup`).
//
// The mode list, labels, colours and glyph choices come from each mode's own Go
// factory (agent.Factory.Describe), via modes.gen.ts — register a factory and
// the mode appears here. The SVG paths below are hand-drawn design work and are
// deliberately NOT generated; a new mode renders with no silhouette until
// someone draws one.

import { MODES, type ModeKey } from '../mesh-studio/modes.gen.js';

export interface IconOpt { name: string; svg: string }
export interface ModeIcons { key: string; desc: string; color: string; options: IconOpt[] }
export interface ToolIcon { key: string; desc: string; color: string; svg: string }
export interface MeshIcon { name: string; desc: string; svg: string }

/** Hand-drawn silhouette options per mode — the ONLY mode data not generated,
 *  because SVG paths are design work. Keyed by the mode's wire value.
 *  A mode with no entry here renders with no silhouette; it is still listed. */
const MODE_GLYPHS: Record<string, IconOpt[]> = {
	hello_world: [
		{ name: 'Terminal', svg: `<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 8.5h18"/><circle cx="6" cy="6.5" r=".7" fill="currentColor" stroke="none"/><path d="M6.5 12l2.5 2-2.5 2"/><path d="M11.5 16h5"/>` },
		{ name: 'Wave', svg: `<path d="M9 21v-6.5l-1.5-1.4a1 1 0 0 1 1.4-1.45l1.1 1V6a1 1 0 0 1 2 0v3.8m0-.3a1 1 0 0 1 2 0v3.7c0 3.2-1.8 5.3-4.3 5.3"/><path d="M15.5 5.5c1.7 1.7 1.7 4.3 0 6"/><path d="M18 3.2c2.6 2.6 2.6 7.2 0 9.8"/>` },
		{ name: 'First light', svg: `<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 8V5.5M5.5 10 4 8.5M18.5 10 20 8.5M3.5 14H2M22 14h-1.5"/>` },
		{ name: 'Sprout', svg: `<path d="M12 20v-8"/><path d="M12 12.5c-.6-3-3.2-4.6-6.2-4.4.2 3 2.6 5 6.2 4.4zM12 11c.4-2.6 2.6-4.2 5.6-4-.2 2.6-2.4 4.4-5.6 4z"/>` },
		{ name: 'Sparkle', svg: `<path d="M12 3v5M12 16v5M3 12h5M16 12h5"/><path d="M7 7l2.6 2.6M14.4 14.4 17 17M17 7l-2.6 2.6M9.6 14.4 7 17"/>` },
		{ name: 'Open hand', svg: `<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L9 15"/>` },
		{ name: 'Waving', svg: `<path d="M10 20.5c-2 0-3.6-1.1-4.6-2.9L3.6 14.4a1 1 0 0 1 1.7-1l1.2 1.7V8.2a1 1 0 0 1 2 0v3.3m0-4.3a1 1 0 0 1 2 0v3.8m0-2.8a1 1 0 0 1 2 0v5c0 3.6-1.6 6.3-4.4 6.3z"/><path d="M15.2 6.4c1.6 1.6 1.6 4.4 0 6M17.8 4c2.4 2.4 2.4 6.8 0 9.2"/>` },
	],
	intelligence: [
		{ name: 'Flushed', svg: `<path d="M2 16h20"/><path d="M5 16v-2M8 16v-1.5M15 16v-2M18 16v-1.5"/><path d="M11 16C11.5 12 12.5 9 15 6"/><path d="M15 6l-2.3.4M15 6l.6 2.3"/><path d="M9.5 15l-1 1M12.5 15l1 1"/>` },
		{ name: 'Console', svg: `<rect x="4.5" y="4" width="15" height="11" rx="1.5"/><path d="M2.5 18.5h19l-2-3.5H4.5z"/><path d="M7 12.5h10"/><path d="M9 12.5v-1M11.5 12.5v-1.3M14.5 12.5v-1"/><path d="M10.5 12.5C11 9.5 12 8 14 6.5"/><path d="M14 6.5l-1.5.3M14 6.5l.4 1.4"/>` },
		{ name: 'Covey', svg: `<path d="M2 17h20"/><path d="M5 17v-1.5M8 17v-2M17 17v-1.5"/><path d="M7.5 12.5l1.3-1 1.3 1M10.5 9.5l1.3-1 1.3 1M13.5 6.5l1.3-1 1.3 1"/><path d="M9.5 16l-.8 1M12 15.5l.8 1"/>` },
		{ name: 'Breakout', svg: `<path d="M2 15h7M15 15h7"/><path d="M9 15 12 5.5 15 15z"/><path d="M7.5 13.5 9 15M16.5 13.5 15 15"/>` },
		{ name: 'Startle', svg: `<path d="M2 17h20"/><path d="M4 17v-1.5M7 17v-2M16 17v-1.5M19 17v-2"/><path d="M10 16Q11 8 15 6"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><path d="M8.6 15.2l-1.2 1M10 14.6v1.4M11.4 15.2l1.2 1"/>` },
	],
	vendor_management: [
		{ name: 'Storefront', svg: `<path d="M4 10 5.5 5.5h13L20 10"/><path d="M5 10v9h14v-9"/><path d="M4 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M9 19v-5h6v5"/>` },
		{ name: 'Buildings', svg: `<path d="M4 20V7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v13"/><path d="M12 20V10h6a1 1 0 0 1 1 1v9"/><path d="M7 9h2M7 12h2M7 15h2M15 13h1M15 16h1"/><path d="M3 20h18"/>` },
		{ name: 'Rating', svg: `<path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.2l5.4-.8z"/>` },
		{ name: 'Exchange', svg: `<rect x="2.5" y="7.5" width="6" height="9" rx="1"/><rect x="15.5" y="7.5" width="6" height="9" rx="1"/><path d="M8.5 10.5H15.5M13.5 8.5 15.5 10.5 13.5 12.5M15.5 13.5H8.5M10.5 11.5 8.5 13.5 10.5 15.5"/>` },
		{ name: 'Contract', svg: `<rect x="6" y="3.5" width="12" height="17" rx="1.5"/><path d="M9 8h6M9 11h6"/><path d="M9 16c1-1.2 2 1.2 3 0s2-1.2 3 0"/>` },
	],
	codebase_analysis: [
		{ name: 'Source scan', svg: `<rect x="3" y="3.5" width="13" height="11" rx="1.5"/><path d="M6.5 7.5 8.5 9.5 6.5 11.5M10.5 11.5h3"/><circle cx="17" cy="17" r="3.4"/><path d="M19.4 19.4 21.8 21.8"/>` },
	],
	github_runner: [
		{ name: 'Sandbox', svg: `<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><rect x="6.5" y="7.5" width="11" height="9" rx="1"/><path d="M10.5 10 14 12l-3.5 2z" fill="currentColor" stroke="none"/>` },
		{ name: 'Secure shell', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M8.5 9.5 11 12l-2.5 2.5M13 14.5h3.5"/>` },
		{ name: 'Sealed artifact', svg: `<path d="M5 8 12 4l7 4v8l-7 4-7-4z"/><path d="M5 8 12 12 19 8"/><circle cx="12" cy="14.3" r="1.3"/><path d="M12 15.6v2.2"/>` },
		{ name: 'Enclave', svg: `<path d="M7 4H4v16h3M17 4h3v16h-3"/><circle cx="12" cy="12" r="3"/><path d="M12 7.5v1.5M12 15v1.5M7.5 12h1.5M15 12h1.5"/>` },
		{ name: 'Vault', svg: `<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.3"/><path d="M12 7.5V5M12 19v-2.5M16.5 12H19M5 12h2.5"/>` },
	],
	hardened_agent: [
		{ name: 'Contained', svg: `<path d="M12 4 18.5 7.2v6.6L12 17 5.5 13.8V7.2z"/><path d="M5.5 7.2 12 10.4l6.5-3.2M12 10.4V17"/><path d="M2.5 5.5V3h2.5M21.5 5.5V3h-2.5M2.5 18.5V21h2.5M21.5 18.5V21h-2.5"/>` },
	],
	supply_chain_proxy: [
		{ name: 'Funnel', svg: `<path d="M3.5 5h17l-6.5 7.5V19l-4-2v-4.5z"/>` },
		{ name: 'Inspect line', svg: `<rect x="3" y="13.5" width="4.5" height="4.5" rx=".6"/><rect x="9.75" y="13.5" width="4.5" height="4.5" rx=".6"/><rect x="16.5" y="13.5" width="4.5" height="4.5" rx=".6"/><path d="M2 19h20"/><path d="M12 4v6M9 7.5l3 3 3-3"/>` },
		{ name: 'Barcode', svg: `<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M8 8.5v7M11 8.5v7M14 8.5v4M17 8.5v7"/>` },
		{ name: 'Guarded pkg', svg: `<path d="M12 3 19 5.5v4.5c0 4-3 6.5-7 8-4-1.5-7-4-7-8V5.5z"/><path d="M8.5 8 12 6.3 15.5 8v3.5L12 13.2 8.5 11.5zM12 9.7v3.5M8.5 8 12 9.7 15.5 8"/>` },
		{ name: 'Scanner', svg: `<path d="M5 4H3.5V6M19 4h1.5V6M5 20H3.5v-2M19 20h1.5v-2"/><rect x="7.5" y="7.5" width="9" height="9" rx="1"/><path d="M7.5 12h9"/>` },
	],
	dns_proxy: [
		{ name: 'Globe filter', svg: `<circle cx="10" cy="11" r="6.5"/><path d="M3.5 11h13M10 4.5v13M6.5 6.5c-1.5 2.5-1.5 6.5 0 9M13.5 6.5c1.5 2.5 1.5 6.5 0 9"/><path d="M15 3.5h6l-2.3 3.2v3l-1.4-1.1V6.7z"/>` },
		{ name: 'Routing', svg: `<path d="M12 3.5v17"/><path d="M12 5.5h6l2 2-2 2h-6"/><path d="M12 11.5H6l-2 2 2 2h6"/>` },
		{ name: 'Block domain', svg: `<rect x="3" y="8.5" width="18" height="7" rx="2"/><circle cx="6.5" cy="12" r="1.2"/><path d="M9.5 12h9"/><path d="M5 7 19 17"/>` },
		{ name: 'Sinkhole', svg: `<path d="M4 7h16"/><path d="M6 7c0 5.5 6 5.5 6 10 0-4.5 6-4.5 6-10"/><ellipse cx="12" cy="18.5" rx="2.5" ry="1"/>` },
		{ name: 'Record', svg: `<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M6.5 10.5 8.5 12.5 12 8.5"/><path d="M14 11h4M14 14h3M6.5 14h4"/>` },
		{ name: 'Meridian', svg: `<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3.3" ry="8"/><path d="M4 12h16M5.4 7h13.2M5.4 17h13.2"/>` },
		{ name: 'Orbit', svg: `<circle cx="12" cy="12" r="6"/><path d="M6 12h12M8 7.5c-1.5 2.8-1.5 6.2 0 9M16 7.5c1.5 2.8 1.5 6.2 0 9"/><ellipse cx="12" cy="12" rx="10.5" ry="4" transform="rotate(-25 12 12)"/>` },
		{ name: 'Geo-pin', svg: `<circle cx="11" cy="11" r="7"/><path d="M4 11h14M11 4v14M7.5 6c-1.6 2.8-1.6 7.2 0 10M14.5 6c1.6 2.8 1.6 7.2 0 10"/><path d="M18 14.5a2.5 2.5 0 0 0-2.5 2.5c0 1.8 2.5 4 2.5 4s2.5-2.2 2.5-4A2.5 2.5 0 0 0 18 14.5z"/>` },
		{ name: 'Anycast', svg: `<circle cx="12" cy="14" r="6"/><path d="M6 14h12M12 8v12M8.2 9.5c-1.5 2.6-1.5 6.4 0 9M15.8 9.5c1.5 2.6 1.5 6.4 0 9"/><path d="M9 5.5a4 4 0 0 1 6 0M11 3.5a1.5 1.5 0 0 1 2 0"/>` },
		{ name: 'Resolved', svg: `<circle cx="11" cy="11" r="7"/><path d="M4 11h14M11 4v14M7.5 6c-1.6 2.8-1.6 7.2 0 10M14.5 6c1.6 2.8 1.6 7.2 0 10"/><path d="M14 17.5 16 19.5 20 15"/>` },
	],
	language: [
		{ name: 'Blades', svg: `<path d="M3 5.5h9a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 12 11.5H8l-3 2.3V11.5A1.5 1.5 0 0 1 3 10z"/><path d="M11 12h7a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 18 18h-2l-3 2.2V18"/>` },
		{ name: 'Reasoning', svg: `<path d="M12 5.5a2.5 2.5 0 0 0-2.5 2.5v.2A2.5 2.5 0 0 0 8 13a2.5 2.5 0 0 0 2 4.4V19M12 5.5a2.5 2.5 0 0 1 2.5 2.5v.2A2.5 2.5 0 0 1 16 13a2.5 2.5 0 0 1-2 4.4V19"/><path d="M12 5.5V19M9.5 10h2.5M12 13.5h2.5"/>` },
		{ name: 'Verdict', svg: `<path d="M12 4v15M8 20h8"/><path d="M5 8h14M12 5.5 5 8M12 5.5 19 8"/><path d="M5 8 3 13a2 2 0 0 0 4 0zM19 8l-2 5a2 2 0 0 0 4 0z"/>` },
		{ name: 'Neural', svg: `<circle cx="6" cy="7.5" r="1.5"/><circle cx="6" cy="16.5" r="1.5"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="7.5" r="1.5"/><circle cx="18" cy="16.5" r="1.5"/><path d="M7.4 8.3 10.6 11.2M7.4 15.7 10.6 12.8M13.4 11.2 16.6 8.3M13.4 12.8 16.6 15.7"/>` },
		{ name: 'Jury', svg: `<circle cx="12" cy="5.5" r="1.9"/><circle cx="6" cy="9.5" r="1.9"/><circle cx="18" cy="9.5" r="1.9"/><circle cx="8.5" cy="16" r="1.9"/><circle cx="15.5" cy="16" r="1.9"/><circle cx="12" cy="11.5" r="1" fill="currentColor" stroke="none"/><path d="M12 7.4v2.6M7.4 10.4 11 11.2M16.6 10.4 13 11.2M9.4 14.4 11.2 12.4M14.6 14.4 12.8 12.4"/>` },
	],
	harness: [
		{ name: 'Exchange line', svg: `<circle cx="4" cy="12" r="2.2"/><circle cx="20" cy="12" r="2.2"/><path d="M6.4 12h1.1M16.5 12h1.1"/><path d="M9.5 7.5h5A1.5 1.5 0 0 1 16 9v3a1.5 1.5 0 0 1-1.5 1.5H13l-2 1.9V13.5H9.5A1.5 1.5 0 0 1 8 12V9a1.5 1.5 0 0 1 1.5-1.5z"/>` },
	],
	momus: [
		{ name: 'Dispatch', svg: `<path d="M5 14.5v-4a5 5 0 0 1 10 0v4l1.5 2.5h-13z"/><path d="M8 19.5a2 2 0 0 0 4 0"/><path d="M17.5 6.5h4.5M22 6.5 19.4 4M22 6.5 19.4 9"/>` },
	],
	vscode_enforcement: [
		{ name: 'Editor policy', svg: `<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="M2.5 8.5h19"/><circle cx="5.5" cy="6.5" r=".7" fill="currentColor" stroke="none"/><path d="M7.5 11.5 5.5 14 7.5 16.5M10.5 17l2-6"/><path d="M17.5 11 21 12.1v2.4c0 2-1.4 3.3-3.5 4-2.1-.7-3.5-2-3.5-4v-2.4z"/>` },
	],
	// CLOSED, not an arc, and that is the one thing worth knowing about this
	// glyph. It was drawn as an open semicircle first — the speedometer every
	// icon set draws — and the mesh piece that extrudes it (`dial`) had to be
	// rebuilt four times before it read, coming out as a mound, a cog and a
	// bunker on the way. The fix there was closure: the globe looks down, so
	// height lands on screen at about half scale, and a squashed ARC is genuinely
	// ambiguous — nothing tells a flattened semicircle from a shallow arch. A
	// squashed CIRCLE is not, because a closed outline can only be a round thing
	// seen at an angle.
	//
	// So the flat glyph follows the solid rather than the other way round. Ring,
	// four graduations growing INWARD off it, one arrow. Inward matters: a mark
	// standing off the outside of a rim is a crenellation, which is what turned
	// the first attempt into a cog. And an arrow rather than a needle — a hairline
	// is a stick at 16px, and a head is the cheapest mark that says which end
	// means something, which is the whole difference between a gauge and a clock.
	posture: [
		{ name: 'Gauge', svg: `<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v2.1M12 18.5v2.1M3.4 12h2.1M18.5 12h2.1"/><path d="m10.9 13.1 3.7-3.7"/><path d="M13.5 8.2 16.4 7.6 15.8 10.5z"/><circle cx="10.9" cy="13.1" r="1.35" fill="currentColor" stroke="none"/>` },
	],
};

/** Mode icons = generated metadata (the Go factories) + hand-drawn options above.
 *  desc and colour live in the manifest, so they cannot disagree with the Go side. */
export const MODE_ICONS: ModeIcons[] = MODES.map((m) => ({
	key: m.key,
	desc: m.desc,
	color: m.color,
	options: MODE_GLYPHS[m.key] ?? [],
}));

// ── Outline injection seam ─────────────────────────────────────────────────
// The agent-mesh mockup renders each node's silhouette from the agent's MODE.
// MODE_GLYPH_CHOICE pins the chosen glyph per mode; anything not listed falls
// back to the Terminal glyph (hello_world, intelligence, language).

/** The Terminal glyph — the default node silhouette. */
export const TERMINAL_GLYPH =
	MODE_ICONS.find((m) => m.key === 'hello_world')!.options.find((o) => o.name === 'Terminal')!.svg;

/** The chosen silhouette (a MODE_ICONS option name) per agent mode.
 *  Generated from agent/modes.go — edit the Go catalog, not this. Modes with an
 *  empty glyph have no silhouette drawn yet and fall back to TERMINAL_GLYPH. */
const MODE_GLYPH_CHOICE: Record<string, string> = Object.fromEntries(
	MODES.filter((m) => m.glyph).map((m) => [m.key, m.glyph])
);

/** Resolve the node silhouette markup injected for an agent mode. */
export function glyphForMode(mode: string): string {
	const choice = MODE_GLYPH_CHOICE[mode];
	const svg = choice
		? MODE_ICONS.find((m) => m.key === mode)?.options.find((o) => o.name === choice)?.svg
		: undefined;
	return svg ?? TERMINAL_GLYPH;
}

// ── The modes, as ordinary named icons ─────────────────────────────────────
// `glyphForMode` hands back raw inner markup for the mesh, which samples it into
// a node silhouette. Everything ELSE that wants a mode — a button, a legend row,
// a list — wants the Icon primitive, so the same glyphs are registered under
// `mode-<key>` and merged into ICONS. Written out key by key rather than mapped
// from MODES: a literal keeps `IconName` a union of real names, and a mapped
// object would widen it to `string` and take every icon typo with it.
export const MODE_ICON_GLYPHS = {
	'mode-hello_world': glyphForMode('hello_world'),
	'mode-intelligence': glyphForMode('intelligence'),
	'mode-vendor_management': glyphForMode('vendor_management'),
	'mode-codebase_analysis': glyphForMode('codebase_analysis'),
	'mode-github_runner': glyphForMode('github_runner'),
	'mode-hardened_agent': glyphForMode('hardened_agent'),
	'mode-supply_chain_proxy': glyphForMode('supply_chain_proxy'),
	'mode-dns_proxy': glyphForMode('dns_proxy'),
	'mode-language': glyphForMode('language'),
	'mode-harness': glyphForMode('harness'),
	'mode-momus': glyphForMode('momus'),
	// Declared with an empty glyph in modes.gen.ts, so this resolves to the
	// Terminal fallback for now. Registering it anyway is the point of the entry:
	// without a key here `modeIconName` silently answers `mode-hello_world`, and
	// the browser agent would draw a terminal in every list and drawer with
	// nothing to say it was a substitution.
	'mode-browser': glyphForMode('browser'),
	'mode-vscode_enforcement': glyphForMode('vscode_enforcement'),
	'mode-posture': glyphForMode('posture'),
	// Same situation as mode-browser above: no glyph drawn yet, so this resolves
	// to the Terminal fallback. The entry still has to exist.
	'mode-fetch': glyphForMode('fetch')
	// `satisfies`, applied to the template-keyed record, is what makes a missing
	// mode a BUILD error instead of a silent terminal in the drawer. It checks
	// every mode has a `mode-<key>` entry while leaving the literal type intact,
	// which is what keeps `IconName` a union of real names — an annotation would
	// have widened the keys to `string` and taken every icon typo with it.
} as const satisfies Record<`mode-${ModeKey}`, string>;

/** The Icon name for an agent mode. Unknown keys fall back to the Terminal
 *  glyph's own name, so a caller can never hand Icon a missing entry. */
export function modeIconName(mode: string): keyof typeof MODE_ICON_GLYPHS {
	const name = `mode-${mode}` as keyof typeof MODE_ICON_GLYPHS;
	return name in MODE_ICON_GLYPHS ? name : 'mode-hello_world';
}

export const TOOL_ICONS: ToolIcon[] = [
	{ key: 'alert', desc: 'raise event / notify', color: '#5eead4', svg: `<path d="M6 16v-4.5a6 6 0 0 1 12 0V16l2 2.5H4z"/><path d="M9.5 19.5a2.5 2.5 0 0 0 5 0"/>` },
	{ key: 'echo', desc: 'reflect input', color: '#5eead4', svg: `<path d="M4 9.5v5h3l4.5 3.5v-12L7 9.5z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11"/>` },
	{ key: 'dnsquery', desc: 'resolve a name', color: '#5eead4', svg: `<circle cx="10" cy="10" r="6"/><path d="M4 10h12M10 4v12M6.8 6c-1.4 2.2-1.4 5.8 0 8M13.2 6c1.4 2.2 1.4 5.8 0 8"/><path d="M14.5 14.5 20 20"/>` },
	{ key: 'dnsproxy', desc: 'filter DNS traffic', color: '#5eead4', svg: `<circle cx="10" cy="11" r="6"/><path d="M4 11h12M10 5v12M7 6.8c-1.3 2.1-1.3 5.3 0 8.4M13 6.8c1.3 2.1 1.3 5.3 0 8.4"/><path d="M14.5 3.5h6l-2.3 3.2v3l-1.4-1.1V6.7z"/>` },
	{ key: 'feedfetch', desc: 'pull a threat feed', color: '#5eead4', svg: `<circle cx="5.5" cy="18.5" r="1.3" fill="currentColor" stroke="none"/><path d="M5.5 13a6.5 6.5 0 0 1 6.5 6.5M5.5 7.5A13 13 0 0 1 18.5 20.5"/><path d="M18 4v6M15 7l3 3 3-3"/>` },
	{ key: 'httprequest', desc: 'call an endpoint', color: '#5eead4', svg: `<path d="M4 9.5h13l-3-3M20 14.5H7l3 3"/>` },
	{ key: 'unicode_detect', desc: 'spot spoof glyphs', color: '#5eead4', svg: `<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5 20 20"/><path d="M8 7.5v3a2 2 0 0 0 4 0v-3"/>` },
	{ key: 'unicode_inject', desc: 'insert test glyphs', color: '#5eead4', svg: `<path d="M15.5 2.5 21.5 8.5M18.5 5.5 7 17l-2.5.5.5-2.5L16.5 3.5z"/><path d="M12 9l3 3M9 12l3 3"/><path d="M6 17.5 3.5 20"/>` },
];

// ── Mesh-node candidate glyphs ─────────────────────────────────────────────
// A short-list to PICK THE MESH NODE symbol. Each glyph riffs on the Armornet
// mesh: armor (plate, scale, mail, shield), mesh (weave, lattice, honeycomb,
// hub+spokes), or a deliberate fusion of the two. 24×24, single stroke,
// currentColor — same glyph grammar as the mode/tool sets so a winner drops
// straight into node-shapes / custom-shapes.
export const MESH_ICONS: MeshIcon[] = [
	{ name: 'Chainmail', desc: 'armored mesh — interlocking rings', svg: `<circle cx="8.5" cy="8.5" r="4"/><circle cx="15.5" cy="8.5" r="4"/><circle cx="8.5" cy="15.5" r="4"/><circle cx="15.5" cy="15.5" r="4"/>` },
	{ name: 'Mailguard', desc: 'ring mail behind a shield', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><circle cx="9.5" cy="10" r="1.7"/><circle cx="14.5" cy="10" r="1.7"/><circle cx="12" cy="13.6" r="1.7"/>` },
	{ name: 'Aegis', desc: 'shield laced with mesh', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M12 6v11M8 8.5l8 6M16 8.5l-8 6"/>` },
	{ name: 'Hexguard', desc: 'honeycomb-cored shield', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M12 7 14.9 8.8v3.4L12 13.9 9.1 12.2V8.8z"/><path d="M12 10.5V7M12 10.5 14.9 12.2M12 10.5 9.1 12.2"/>` },
	{ name: 'Trellis ward', desc: 'lattice-braced shield', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M12 5.5v13M6.5 11h11M8.5 8 15.5 14M15.5 8 8.5 14"/>` },
	{ name: 'Weaveguard', desc: 'basketweave shield', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9.5 6.8V8.6M9.5 10.4V15.5M14.5 6.8V12.1M14.5 13.9V15M6.8 9.5H13.4M15.6 9.5H17.2M7.4 13H8.9M11.1 13H16.6"/>` },
	{ name: 'Scaleward', desc: 'scale-mail shield', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M7 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0"/><path d="M7.5 13a2.5 2.5 0 0 0 4.5 0 2.5 2.5 0 0 0 4.5 0"/>` },
	{ name: 'Rivetguard', desc: 'studded shield boss', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><circle cx="9" cy="8.5" r="1"/><circle cx="15" cy="8.5" r="1"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><circle cx="12" cy="16" r="1"/><circle cx="12" cy="10.5" r="1.4"/>` },
	{ name: 'Netshield', desc: 'fine-mesh shield', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M8 9h8M8 12.5h7.5M9.7 6.8v10M14.3 6.8v9.5M12 6.3v12"/>` },
	{ name: 'Chainward', desc: 'chain-linked shield', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><rect x="9.8" y="6.8" width="4.4" height="5.2" rx="2.2"/><rect x="9.8" y="10.4" width="4.4" height="5.2" rx="2.2"/>` },
	{ name: 'Crestlink', desc: 'meshed node crest', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><circle cx="12" cy="11" r="1.3" fill="currentColor" stroke="none"/><path d="M12 11 8 8M12 11 16 8M12 11 8 14M12 11 16 14M12 11 12 16.5"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/><circle cx="12" cy="16.5" r="1"/>` },
	{ name: 'Bastionward', desc: 'bonded-course shield', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M6 9.3h12M6.5 13h11"/><path d="M12 6v3.3M8.7 9.3v3.7M15.3 9.3v3.7M12 13v4.5M9 13v2.8M15 13v2.8"/>` },
	{ name: 'Tessward', desc: 'triangular-mesh shield', svg: `<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M12 6.5 8.5 14h7z"/><path d="M10.25 10.25 13.75 10.25 12 14z"/>` },
	{ name: 'Mesh hub', desc: 'node with meshed peers', svg: `<circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><path d="M12 12 20 12M12 12 16 18.9M12 12 8 18.9M12 12 4 12M12 12 8 5.1M12 12 16 5.1"/><circle cx="20" cy="12" r="1.4"/><circle cx="16" cy="18.9" r="1.4"/><circle cx="8" cy="18.9" r="1.4"/><circle cx="4" cy="12" r="1.4"/><circle cx="8" cy="5.1" r="1.4"/><circle cx="16" cy="5.1" r="1.4"/>` },
	{ name: 'Honeycomb', desc: 'tessellating hex cell', svg: `<path d="M12 4 18.9 8V16L12 20 5.1 16V8z"/><path d="M12 12V4M12 12 18.9 16M12 12 5.1 16"/>` },
	{ name: 'Weave', desc: 'over-under basketweave', svg: `<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M9 5V7.5M9 10.5V19M15 5V13.5M15 16.5V19M5 9H13.5M16.5 9H19M5 15H7.5M10.5 15H19"/>` },
	{ name: 'Scale mail', desc: 'overlapping armor scales', svg: `<path d="M2 8a5 5 0 0 0 10 0 5 5 0 0 0 10 0"/><path d="M2 15a5 5 0 0 0 10 0 5 5 0 0 0 10 0"/>` },
	{ name: 'Riveted plate', desc: 'bolted armor plate', svg: `<rect x="4" y="4" width="16" height="16" rx="2.5"/><circle cx="7" cy="7" r="1"/><circle cx="17" cy="7" r="1"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/><circle cx="12" cy="12" r="2.6"/>` },
	{ name: 'Studded plate', desc: '8-rivet armor plate', svg: `<rect x="4" y="4" width="16" height="16" rx="2.5"/><circle cx="7" cy="7" r="1"/><circle cx="17" cy="7" r="1"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/><circle cx="12" cy="6.5" r="1"/><circle cx="12" cy="17.5" r="1"/><circle cx="6.5" cy="12" r="1"/><circle cx="17.5" cy="12" r="1"/><circle cx="12" cy="12" r="1.4"/>` },
	{ name: 'Beveled plate', desc: 'chamfered riveted plate', svg: `<path d="M8 4h8l4 4v8l-4 4H8l-4-4V8z"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/><circle cx="12" cy="12" r="2.2"/>` },
	{ name: 'Strapped plate', desc: 'cross-strapped riveted plate', svg: `<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M12 4v16M4 12h16"/><circle cx="12" cy="7.5" r=".9"/><circle cx="12" cy="16.5" r=".9"/><circle cx="7.5" cy="12" r=".9"/><circle cx="16.5" cy="12" r=".9"/>` },
	{ name: 'Riveted disc', desc: 'riveted porthole plate', svg: `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="4.5" r="1"/><circle cx="12" cy="19.5" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="19.5" cy="12" r="1"/><circle cx="6.7" cy="6.7" r="1"/><circle cx="17.3" cy="6.7" r="1"/><circle cx="6.7" cy="17.3" r="1"/><circle cx="17.3" cy="17.3" r="1"/>` },
	{ name: 'Quad plate', desc: 'paneled riveted plate', svg: `<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M12 4v16M4 12h16"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/>` },
	{ name: 'Lattice', desc: 'faceted diamond mesh', svg: `<path d="M12 3 21 12 12 21 3 12z"/><path d="M6 12h12M12 6v12M7.5 7.5 16.5 16.5M16.5 7.5 7.5 16.5"/>` },
	{ name: 'Interlink', desc: 'chained links', svg: `<rect x="3.5" y="8" width="10" height="8" rx="4"/><rect x="10.5" y="8" width="10" height="8" rx="4"/>` },
	{ name: 'Portcullis', desc: 'armored gate grid', svg: `<path d="M4 5h16v11l-2 2.5-2-2.5-2 2.5-2-2.5-2 2.5-2-2.5-2 2.5-2-2.5z"/><path d="M8 5v10M12 5v13M16 5v10M4 9h16M4 13h16"/>` },
	{ name: 'Tessellate', desc: 'triangular mesh cell', svg: `<path d="M12 3 21 19 3 19z"/><path d="M7.5 11 16.5 11 12 19z"/>` },
	{ name: 'Interlace', desc: 'woven shield knot', svg: `<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M12 3 21 12 12 21 3 12z"/>` },
	{ name: 'Pauldron', desc: 'layered shoulder plates', svg: `<path d="M4 10 A9 9 0 0 0 20 10"/><path d="M3 13 A10 10 0 0 0 21 13"/><path d="M2 16 A11 11 0 0 0 22 16"/>` },
	{ name: 'Bulwark', desc: 'bonded plate wall', svg: `<rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M3.5 9.3h17M3.5 14.6h17M9 4v5.3M15 4v5.3M6 9.3v5.3M12 9.3v5.3M18 9.3v5.3M9 14.6v5.4M15 14.6v5.4"/>` },
	{ name: 'Rampart', desc: 'crenellated wall', svg: `<rect x="3.5" y="8" width="17" height="12" rx="1"/><path d="M4 8V5h3v3M10.5 8V5h3v3M17 8V5h3v3"/><path d="M3.5 13h17M3.5 16.5h17M9 8v5M15 8v5M6 13v3.5M12 13v3.5M18 13v3.5M9 16.5v3.5M15 16.5v3.5"/>` },
	{ name: 'Casemate', desc: 'beveled plate bastion', svg: `<path d="M6.5 4h11l3 3v10l-3 3h-11l-3-3v-10z"/><path d="M3.5 10h17M3.5 14h17M9 4v6M15 4v6M6 10v4M12 10v4M18 10v4M9 14v6M15 14v6"/>` },
	{ name: 'Palisade', desc: 'staked plank wall', svg: `<path d="M5 20V8l1.5-3 1.5 3v12M11 20V8l1.5-3 1.5 3v12M17 20V8l1.5-3 1.5 3v12"/><path d="M3.5 11h17M3.5 15.5h17"/>` },
	{ name: 'Bastion dome', desc: 'gridded shield dome', svg: `<path d="M4 18 A8 8 0 0 0 20 18z"/><path d="M12 10v8M8 11.4v6.6M16 11.4v6.6M5.5 15h13"/>` },
];

// ── Multi-mode agent candidates ────────────────────────────────────────────
// One AGENT (not the control-plane/server) that has several modes registered.
// The metaphor: modes fan OUT from the agent, or collapse INTO it like a
// toolbox. Crestlink-inspired (hub + fanned satellites) — but the hub is the
// agent body and the satellites are its modes. 24×24, single stroke.
export const MULTIMODE_ICONS: MeshIcon[] = [
	{ name: 'Fan-out', desc: 'agent hub, modes fanned around it', svg: `<rect x="9.5" y="9.5" width="5" height="5" rx="1.2"/><path d="M12 9.5V6M14.6 10 16.9 8.6M14.6 14 15.9 15.4M9.4 14 8.1 15.4M9.4 10 7.1 8.6"/><rect x="10.7" y="3" width="2.6" height="2.6" rx=".5"/><rect x="16.7" y="6.7" width="2.6" height="2.6" rx=".5"/><rect x="15.7" y="15.2" width="2.6" height="2.6" rx=".5"/><rect x="5.7" y="15.2" width="2.6" height="2.6" rx=".5"/><rect x="4.7" y="6.7" width="2.6" height="2.6" rx=".5"/>` },
	{ name: 'Fan', desc: 'modes spreading from a pivot', svg: `<path d="M12 20 4.5 8.5A9 9 0 0 1 19.5 8.5z"/><path d="M12 20 8 9M12 20 12 6.8M12 20 16 9"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/>` },
	{ name: 'Toolbox', desc: 'modes collapsed into the agent', svg: `<rect x="3.5" y="8.5" width="17" height="10.5" rx="1.8"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/><path d="M3.5 12h17"/><rect x="6.6" y="13.5" width="2.6" height="3.5" rx=".4"/><rect x="10.7" y="13.5" width="2.6" height="3.5" rx=".4"/><rect x="14.8" y="13.5" width="2.6" height="3.5" rx=".4"/>` },
	{ name: 'Stack', desc: 'registered modes stacked', svg: `<rect x="6.5" y="7" width="9" height="12" rx="1.3"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h7A1.5 1.5 0 0 1 19 5.5V16"/><path d="M9 11h4M9 14h3"/>` },
	{ name: 'Facets', desc: 'one agent, modes as facets', svg: `<path d="M12 3 19.8 7.5v9L12 21 4.2 16.5v-9z"/><path d="M12 12 12 3M12 12 19.8 7.5M12 12 19.8 16.5M12 12 12 21M12 12 4.2 16.5M12 12 4.2 7.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>` },
];

/** The multi-mode "agent" container glyph (Strapped plate) — used when an agent
 *  runs more than one mode; the individual modes fan out from it. */
export const AGENT_GLYPH =
	MESH_ICONS.find((m) => m.name === 'Strapped plate')!.svg;

/** Resolve a node silhouette from an agent's mode set: a single mode shows its
 *  specific outline; multiple modes show the agent container (they fan out). */
export function glyphForModes(modes: string[]): string {
	if (modes.length > 1) return AGENT_GLYPH;
	return glyphForMode(modes[0] ?? '');
}

/** Frontend-only display names for agent modes. The wire values are long and
 *  snake_cased (`control_plane_management`) — fine as identifiers, unreadable
 *  inside a node disc. These are presentation only; nothing keys off them.
 *  Generated from agent/modes.go — edit the Go catalog, not this. */
const MODE_LABEL: Record<string, string> = Object.fromEntries(
	MODES.map((m) => [m.key, m.label])
);

/** Display name for a mode. Unmapped modes fall back to a title-cased split of
 *  the snake_case value, so a newly registered mode still reads sensibly. */
export function labelForMode(mode: string): string {
	const known = MODE_LABEL[mode];
	if (known) return known;
	return mode
		.split('_')
		.filter(Boolean)
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join(' ');
}
