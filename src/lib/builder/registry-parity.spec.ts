/**
 * Enforces that every Svelte component exported from index.ts is either:
 *   (a) in the REGISTRY (placeable or overlay), or
 *   (b) in INTENTIONALLY_EXCLUDED below with a reason.
 *
 * When you add a new component to index.ts, this test will fail until you
 * either add it to the REGISTRY or justify its exclusion here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { REGISTRY } from './registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INTENTIONALLY_EXCLUDED: Record<string, string> = {
	// Chart sub-components — internal implementation details, not standalone builder widgets
	ChartLegend: 'chart sub-component — rendered internally by Chart',
	DonutLegend: 'chart sub-component — rendered internally by DonutChart',
	DonutPopover: 'chart sub-component — rendered internally by DonutChart',

	// Canvas infrastructure — the canvas engine itself and its internal layers/controls
	Canvas: 'canvas host element — structural, not a droppable widget',
	CameraControls: 'canvas camera UI — rendered by Canvas, not draggable',
	Minimap: 'canvas minimap overlay — not a droppable widget',
	SelectionBox: 'canvas selection state UI — not a droppable widget',
	MeshMembrane: 'ambient frontier hero canvas — full composition with live data, not a droppable widget',
	LayerControls: 'builder-internal visibility/lock UI — not a canvas component',
	// Model Explorer — each view takes a live report fetched from the model
	// daemon (drift, ledger, captures, environments). A builder item carries only
	// scalar props from `PropDef`, so there is no honest way to place one: it
	// would render an empty shell of a screen that only exists with real data.
	ErdDiagram: 'schema diagram — owns its own pan/zoom canvas and layout, not a droppable widget',
	ErdOverviewView: 'model explorer view — renders a live DriftReport, not authorable from props',
	ErdLedgerView: 'model explorer view — renders live ledger entries, not authorable from props',
	ErdCompareView: 'model explorer view — renders a live schema comparison, not authorable from props',
	ErdEnvironmentsView:
		'model explorer view — renders live environment state, not authorable from props',
	ErdCapturesView: 'model explorer view — renders live captures, not authorable from props',
	AppearanceCard:
		'theme control — sets the global glass/flat appearance, so placing one on a canvas would restyle the builder around it',

	MeshStudio: 'mesh canvas composition — reads CANVAS_CTX, so it cannot render outside a Canvas host',
	MeshCanvas: 'mesh canvas host — owns its own viewport and camera, not a droppable widget',
	MeshViewControls: 'mesh view/zoom controls — rendered by the mesh canvas host, not draggable',
	GlobeFrame: 'globe viewport frame — structural host for the globe layout, not a droppable widget',
	TerritoryCaps:
		'globe territory layer — reads CANVAS_CTX and takes caps solved by the globe packer, so it cannot render outside a Canvas host',
	NodePiece:
		'a node BODY, not a node — draws one solid inside a MeshStudio node group from a tangent frame the globe supplies, so it has nowhere to stand on its own',
	EdgeToolbarCard: 'requires snippet children plus a docked toolbar snippet — nothing to place on its own',

	// Flow/timeline view — specific to the arch diagram, not a general builder widget

	// Layout infrastructure — page-level wrapper, not a droppable component
	PagePanel: 'page layout wrapper — structural, not a droppable widget',
	PageContextMenu:
		'page toolbar chrome — its chips, filters and actions are page state, and it takes a controls snippet',
	PersonListPanel:
		'list panel owned by its page — items plus add/remove callbacks come from page state, not from props you can set in the builder',

	// Theme control — not a UI widget
	ThemePicker: 'theme control',

	// App shell — structural layout chrome, not a droppable builder widget
	AppShell: 'app shell layout — requires injected sidebar/brand snippets',

	// Require Svelte snippet children — cannot be represented without child content
	Collapsible: 'requires snippet children (trigger + body)',
	TableWrap: 'requires snippet children',
	FormField: 'requires snippet children',
	Tooltip: 'wraps a trigger it is given as snippet children — nothing to place on its own',

	// Superseded by unified Card component (type=stat/doc/hud/pricing/summary)
	CompositeCard: 'card sub-component — rendered internally by Card for composite types',
	Tile: 'content tile — absorbed into Card composite/article types',
	StatCard: 'superseded by Card with type=stat',
	DocCard: 'superseded by Card with type=doc',
	HudCard: 'superseded by Card with type=hud',
	PricingCard: 'superseded by Card with type=pricing',
	SummaryCards: 'superseded by Card with type=summary',

	// Structural layout chrome — not droppable widgets
	SubFooter: 'page-level footer strip — structural, not a droppable widget',
	AlertBladeHost: 'toast notification host — renders the blade container, not a standalone widget',

	// Docs subsystem — internal to the docs shell
	DocsNav: 'docs navigation sidebar — internal to DocsShell, not a general builder widget',

	// Decorative / overlay utilities
	ProfileCard: 'marketing profile card — absorbed into Card with type=profile',
	GlowOutline: 'decorative glow border — CSS effect utility, not a standalone widget',
	SvgFx: 'wraps arbitrary art in an SVG filter — an effect applied TO a component, with nothing of its own to place',
	BreakoutStack: 'requires a container snippet plus an overlay snippet — a composition, not a placeable widget',

	// The forge. A title scene and its layers — each is a demo on /brand, and none
	// of them is a widget: they are all absolutely positioned against the centre
	// of whatever frame they are in, which is the opposite of what a canvas item
	// is for.
	LogoForge:
		'title scene — takes the whole frame it is in, blacks it out at the singularity beat and runs a clock nothing can pause, so a placed one would put the builder through a detonation',
	LogoForgeStudio: 'the same scene plus a scrubber — authoring chrome, not a placeable widget',
	ForgeMark:
		'two absolutely-positioned halves of one mark, registered on the host frame centre — it has no box of its own to place',
	ForgeFloor: 'scenery — fills its host and is meant to be behind something, not on a canvas',
	RimLight:
		'a lighting pass over contours the caller supplies; with no edges and no lamp there is nothing to place',
	ShockRings: 'a timed effect fired from a point — it has no resting state to drop on a canvas',
	SparkField:
		'a canvas of particles flying at seats the caller supplies; placed with no targets it draws nothing',

	// Dev / perf tooling — not UI components
	DevCog: 'dev feature-flag panel — developer tooling, not a product UI component',
	PerfPanel: 'performance budget panel — developer tooling, not a product UI component',
	GlobeDevControls: 'dev-cog globe intro controls — developer tooling, not a product UI component',

};

describe('index.ts ↔ REGISTRY parity', () => {
	it('every exported component is in REGISTRY or INTENTIONALLY_EXCLUDED', () => {
		const indexSrc = readFileSync(join(__dirname, '../index.ts'), 'utf8');
		const exported = [...indexSrc.matchAll(/export \{ default as (\w+)[,\s}]/g)].map((m) => m[1]);
		expect(exported.length, 'index.ts exports should not be empty').toBeGreaterThan(0);
		const registeredIds = new Set(REGISTRY.map((r) => r.id));
		const unaccounted: string[] = [];
		for (const name of exported) {
			if (!registeredIds.has(name) && !(name in INTENTIONALLY_EXCLUDED)) {
				unaccounted.push(name);
			}
		}
		expect(
			unaccounted,
			`These components are exported from index.ts but are neither in REGISTRY nor in INTENTIONALLY_EXCLUDED:\n  ${unaccounted.join(', ')}\n\nFix: add them to REGISTRY (registry.ts) or justify their exclusion in INTENTIONALLY_EXCLUDED (registry-parity.spec.ts).`
		).toHaveLength(0);
	});

	it('INTENTIONALLY_EXCLUDED entries are still exported from index.ts (catches stale entries)', () => {
		const indexSrc = readFileSync(join(__dirname, '../index.ts'), 'utf8');
		const exported = new Set(
			[...indexSrc.matchAll(/export \{ default as (\w+)[,\s}]/g)].map((m) => m[1])
		);
		const stale: string[] = [];
		for (const name of Object.keys(INTENTIONALLY_EXCLUDED)) {
			if (!exported.has(name)) stale.push(name);
		}
		expect(
			stale,
			`These entries are in INTENTIONALLY_EXCLUDED but no longer exported from index.ts — remove them:\n  ${stale.join(', ')}`
		).toHaveLength(0);
	});
});
